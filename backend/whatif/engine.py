
"""
What-If Scenario System — Simulation Engine

This is the core of the What-If system.
It:
  1. Deep-clones the base timetable into an isolated sandbox
  2. Applies each ScenarioCondition to mutate the sandbox config
  3. Re-runs CBR + GWO on the mutated config (using the same engine as timetable generation)
  4. Validates constraints and computes all metrics
  5. Streams real-time progress over WebSocket
  6. Saves the sandboxed result timetable (never touches production)

IMPORTANT: The engine NEVER writes to the production timetable tables.
           It always writes to a cloned copy tagged with scenario_run_id.
           Only an explicit "Apply" admin action promotes a scenario result to production.
"""

from __future__ import annotations

import asyncio
import copy
import logging
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    Scenario, ScenarioCondition, ScenarioRun, ScenarioStatus, ConditionType
)
from .schemas import (
    MetricsSnapshot, ProgressEvent,
    AddLecturerParams, DeleteLecturerParams, AmendLecturerParams,
    AddRoomParams, DeleteRoomParams, AdjustRoomCapacityParams,
    AddCourseParams, ChangeSectionCountParams, ChangeDeliveryModeParams,
    AddTimeslotParams, DeleteTimeslotParams,
    CONDITION_PARAMS_MAP
)
from .metrics import compute_metrics

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Type alias for the WebSocket broadcast callback
# ---------------------------------------------------------------------------
BroadcastFn = Callable[[ProgressEvent], None]


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def run_scenario(
    db: AsyncSession,
    run: ScenarioRun,
    scenario: Scenario,
    cbr_engine,        # your existing CBR module instance
    gwo_engine,        # your existing GWO module instance
    timetable_repo,    # your existing timetable repository/service
    broadcast: BroadcastFn,
) -> ScenarioRun:
    """
    Execute a full scenario simulation for one (run.scenario_id, run.base_timetable_id) pair.
    Updates run.status and run.metrics in the database.
    Broadcasts real-time progress events for the WebSocket listener.

    Returns the updated ScenarioRun with results populated.
    """
    run.status     = ScenarioStatus.RUNNING
    run.started_at = datetime.utcnow()
    await _save(db, run)

    async def emit(phase: str, pct: int, message: str, **kwargs):
        event = ProgressEvent(
            run_id=run.id,
            scenario_id=run.scenario_id,
            timetable_id=run.base_timetable_id,
            phase=phase,
            pct=pct,
            message=message,
            **kwargs
        )
        broadcast(event)
        logger.info("[ScenarioRun %d] %s (%d%%) — %s", run.id, phase, pct, message)

    try:
        # ── Phase 1: Load base timetable (5%) ───────────────────────────────
        await emit("cloning", 5, "Loading base timetable...")
        base_config = await timetable_repo.load_full_config(run.base_timetable_id)

        # Snapshot baseline metrics BEFORE any changes
        baseline_gwo = base_config.get("last_gwo_result", {})
        run.baseline_metrics = compute_metrics(
            schedule_entries=base_config["schedule_entries"],
            rooms=base_config["rooms"],
            lecturers=base_config["lecturers"],
            students=base_config["student_assignments"],
            gwo_result=baseline_gwo,
        ).dict()

        # ── Phase 2: Deep-clone into sandbox (10%) ──────────────────────────
        await emit("cloning", 10, "Cloning timetable into isolated sandbox...")
        sandbox_config = deep_clone_config(base_config)

        # ── Phase 3: Apply each condition to the sandbox (20%) ──────────────
        await emit("cloning", 20, f"Applying {len(scenario.conditions)} scenario condition(s)...")
        conditions_sorted = sorted(scenario.conditions, key=lambda c: c.order_index)

        for idx, condition in enumerate(conditions_sorted):
            apply_condition(sandbox_config, condition)
            pct = 20 + int((idx + 1) / max(len(conditions_sorted), 1) * 10)
            await emit("cloning", pct, f"Applied condition {idx+1}/{len(conditions_sorted)}: {condition.condition_type.value}")

        # ── Phase 4: CBR retrieval on mutated config (35%) ──────────────────
        await emit("cbr", 35, "Running CBR — retrieving similar historical cases...")
        cbr_result = await asyncio.to_thread(
            cbr_engine.retrieve_and_adapt,
            sandbox_config["courses"],
            sandbox_config["rooms"],
            sandbox_config["lecturers"],
            sandbox_config["timeslots"],
            sandbox_config["constraints"],
        )
        sandbox_config["initial_population"] = cbr_result["population"]
        cases_found = cbr_result.get("cases_found", 0)
        run.cbr_cases_found = cases_found
        await emit("cbr", 40, f"CBR complete — {cases_found} similar case(s) retrieved.")

        # ── Phase 5: GWO optimization (40–85%) ──────────────────────────────
        await emit("gwo", 40, "Starting GWO optimization...")

        gwo_progress_queue: asyncio.Queue = asyncio.Queue()

        def gwo_progress_callback(iteration: int, total: int, fitness: float, hard_pct: float, soft_pct: float):
            """Called by GWO on each iteration — queued and broadcast asynchronously."""
            gwo_progress_queue.put_nowait((iteration, total, fitness, hard_pct, soft_pct))

        # Run GWO in a thread (it's CPU-bound)
        gwo_task = asyncio.create_task(asyncio.to_thread(
            gwo_engine.optimize,
            initial_population=sandbox_config["initial_population"],
            constraints=sandbox_config["constraints"],
            rooms=sandbox_config["rooms"],
            lecturers=sandbox_config["lecturers"],
            timeslots=sandbox_config["timeslots"],
            progress_callback=gwo_progress_callback,
        ))

        # Stream GWO progress while it runs
        while not gwo_task.done():
            try:
                iteration, total, fitness, hard_pct, soft_pct = gwo_progress_queue.get_nowait()
                gwo_pct = 40 + int((iteration / max(total, 1)) * 45)
                await emit(
                    "gwo", gwo_pct,
                    f"GWO iteration {iteration}/{total} — Fitness: {fitness:.4f} — Hard: {hard_pct:.1f}% — Soft: {soft_pct:.1f}%",
                    iteration=iteration,
                    fitness=fitness,
                    hard_pct=hard_pct,
                    soft_pct=soft_pct,
                )
            except asyncio.QueueEmpty:
                await asyncio.sleep(0.1)

        gwo_result = await gwo_task
        run.gwo_iterations_run    = gwo_result.get("iterations", 0)
        run.gwo_convergence_iter  = gwo_result.get("convergence_iter")

        # ── Phase 6: Validate constraints (88%) ─────────────────────────────
        await emit("validating", 88, "Validating hard and soft constraints...")
        schedule_entries = gwo_result["schedule_entries"]
        sandbox_config["schedule_entries"] = schedule_entries

        # ── Phase 7: Compute metrics (93%) ──────────────────────────────────
        await emit("computing_metrics", 93, "Computing performance metrics...")
        t0 = time.perf_counter()
        metrics_snap = compute_metrics(
            schedule_entries=schedule_entries,
            rooms=sandbox_config["rooms"],
            lecturers=sandbox_config["lecturers"],
            students=_build_student_assignments(schedule_entries, sandbox_config),
            gwo_result=gwo_result,
        )
        metrics_snap.generation_seconds = round(time.perf_counter() - t0, 2)
        run.metrics             = metrics_snap.dict()
        run.generation_seconds  = metrics_snap.generation_seconds

        # ── Phase 8: Persist sandbox timetable (97%) ─────────────────────────
        await emit("computing_metrics", 97, "Saving sandbox timetable result...")
        result_timetable_id = await timetable_repo.save_sandbox_timetable(
            base_timetable_id=run.base_timetable_id,
            scenario_run_id=run.id,
            schedule_entries=schedule_entries,
            label=f"[SIMULATION] Scenario Run #{run.id}",
            is_simulation=True,
        )
        run.result_timetable_id = result_timetable_id

        # ── Done ──────────────────────────────────────────────────────────────
        run.status       = ScenarioStatus.COMPLETED
        run.completed_at = datetime.utcnow()
        await _save(db, run)
        await emit("done", 100, "Simulation complete — results ready.")

    except Exception as exc:
        logger.exception("ScenarioRun %d failed: %s", run.id, exc)
        run.status        = ScenarioStatus.FAILED
        run.error_message = str(exc)
        run.completed_at  = datetime.utcnow()
        await _save(db, run)
        await emit("error", 0, f"Simulation failed: {exc}")

    return run


# ---------------------------------------------------------------------------
# Deep clone
# ---------------------------------------------------------------------------

def deep_clone_config(base_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a completely independent deep copy of the base timetable config.
    This is the sandbox — mutating it never affects base_config.
    """
    return copy.deepcopy(base_config)


# ---------------------------------------------------------------------------
# Condition appliers — one function per ConditionType
# ---------------------------------------------------------------------------

def apply_condition(sandbox: Dict[str, Any], condition: ScenarioCondition) -> None:
    """
    Dispatch to the correct applier based on condition type.
    Mutates sandbox in place.
    """
    ctype = condition.condition_type
    params_cls = CONDITION_PARAMS_MAP.get(ctype)
    if not params_cls:
        raise ValueError(f"No params schema registered for condition type: {ctype}")

    params = params_cls(**condition.parameters)
    appliers = {
        ConditionType.ADD_LECTURER:         _apply_add_lecturer,
        ConditionType.DELETE_LECTURER:      _apply_delete_lecturer,
        ConditionType.AMEND_LECTURER:       _apply_amend_lecturer,
        ConditionType.ADD_ROOM:             _apply_add_room,
        ConditionType.DELETE_ROOM:          _apply_delete_room,
        ConditionType.ADJUST_ROOM_CAPACITY: _apply_adjust_room_capacity,
        ConditionType.ADD_COURSE:           _apply_add_course,
        ConditionType.CHANGE_SECTION_COUNT: _apply_change_section_count,
        ConditionType.CHANGE_DELIVERY_MODE: _apply_change_delivery_mode,
        ConditionType.ADD_TIMESLOT:         _apply_add_timeslot,
        ConditionType.DELETE_TIMESLOT:      _apply_delete_timeslot,
    }
    fn = appliers.get(ctype)
    if fn:
        fn(sandbox, params)
    else:
        raise NotImplementedError(f"Applier not implemented for: {ctype}")


def _apply_add_lecturer(sandbox: Dict, params: AddLecturerParams) -> None:
    lecturers = sandbox.setdefault("lecturers", [])
    new_id = min((l.get("user_id", 0) for l in lecturers), default=0) - 1
    lecturers.append({
        "user_id": new_id,
        "first_name": params.firstName,
        "last_name": params.lastName,
        "dept_id": params.deptId,
        "max_workload": params.maxWorkload,
        "teachable_course_ids": params.teachableCourseIds,
        "_simulated": True,
    })


def _apply_delete_lecturer(sandbox: Dict, params: DeleteLecturerParams) -> None:
    sandbox["lecturers"] = [
        l for l in sandbox.get("lecturers", [])
        if l.get("user_id") != params.lecturerUserId
    ]
    sandbox["schedule_entries"] = [
        e for e in sandbox.get("schedule_entries", [])
        if e.get("lecturer_id") != params.lecturerUserId
    ]


def _apply_amend_lecturer(sandbox: Dict, params: AmendLecturerParams) -> None:
    for lecturer in sandbox.get("lecturers", []):
        if lecturer.get("user_id") == params.lecturerUserId:
            if params.maxWorkload is not None:
                lecturer["max_workload"] = params.maxWorkload
            if params.teachableCourseIds is not None:
                lecturer["teachable_course_ids"] = params.teachableCourseIds
            break


def _apply_add_room(sandbox: Dict, params: AddRoomParams) -> None:
    new_id = min((r.get("room_id", 0) for r in sandbox.get("rooms", [])), default=0) - 1
    sandbox.setdefault("rooms", []).append({
        "room_id": new_id,
        "room_name": params.roomNumber,
        "room_type": params.roomType,
        "capacity": params.capacity,
        "is_available": params.isAvailable,
        "_simulated": True,
    })


def _apply_delete_room(sandbox: Dict, params: DeleteRoomParams) -> None:
    sandbox["rooms"] = [r for r in sandbox.get("rooms", []) if r.get("room_id") != params.roomId]
    sandbox["schedule_entries"] = [
        e for e in sandbox.get("schedule_entries", [])
        if e.get("room_id") != params.roomId
    ]


def _apply_adjust_room_capacity(sandbox: Dict, params: AdjustRoomCapacityParams) -> None:
    for room in sandbox.get("rooms", []):
        if room.get("room_id") == params.roomId:
            room["capacity"] = params.newCapacity
            break


def _apply_add_course(sandbox: Dict, params: AddCourseParams) -> None:
    new_id = min((c.get("course_id", 0) for c in sandbox.get("courses", [])), default=0) - 1
    sandbox.setdefault("courses", []).append({
        "course_id": new_id,
        "course_code": params.courseCode,
        "course_name": params.courseName,
        "dept_id": params.deptId,
        "academic_level": params.academicLevel,
        "is_lab": params.isLab,
        "credit_hours": params.creditHours,
        "delivery_mode": params.deliveryMode,
        "_simulated": True,
    })


def _apply_change_section_count(sandbox: Dict, params: ChangeSectionCountParams) -> None:
    target = max(0, params.newSectionsNormal)
    current_entries = [
        e for e in sandbox.get("schedule_entries", [])
        if e.get("course_id") == params.courseId
    ]
    current = len(current_entries)
    if target < current:
        keep_ids = {e.get("section_id") for e in current_entries[:target]}
        sandbox["schedule_entries"] = [
            e for e in sandbox.get("schedule_entries", [])
            if e.get("course_id") != params.courseId or e.get("section_id") in keep_ids
        ]
    elif target > current:
        to_add = target - current
        for i in range(to_add):
            new_id = -((params.courseId * 1000) + i + 1)
            sandbox.setdefault("sections_to_schedule", []).append({
                "section_id": new_id,
                "course_id": params.courseId,
                "section_number": current + i + 1,
                "_simulated": True,
            })


def _apply_change_delivery_mode(sandbox: Dict, params: ChangeDeliveryModeParams) -> None:
    new_mode = getattr(params, "newDeliveryMode", None) or getattr(params, "deliveryMode", None)
    if not isinstance(new_mode, str) or not new_mode.strip():
        return
    for course in sandbox.get("courses", []):
        if course.get("course_id") == params.courseId:
            course["delivery_mode"] = new_mode.strip().upper()
            break


def _apply_add_timeslot(sandbox: Dict, params: AddTimeslotParams) -> None:
    new_id = min((t.get("slot_id", 0) for t in sandbox.get("timeslots", [])), default=0) - 1
    sandbox.setdefault("timeslots", []).append({
        "slot_id": new_id,
        "start_time": params.startTime,
        "end_time": params.endTime,
        "days_mask": params.daysMask,
        "slot_type": params.slotType,
        "is_summer": params.isSummer,
        "_simulated": True,
    })


def _apply_delete_timeslot(sandbox: Dict, params: DeleteTimeslotParams) -> None:
    sandbox["timeslots"] = [
        t for t in sandbox.get("timeslots", [])
        if t.get("slot_id") != params.slotId
    ]
    sandbox["schedule_entries"] = [
        e for e in sandbox.get("schedule_entries", [])
        if e.get("slot_id") != params.slotId and e.get("timeslot_id") != params.slotId
    ]


def _apply_room_unavailable(sandbox: Dict, params: RoomUnavailableParams) -> None:
    """Remove the room from available rooms. Any sections using it become unassigned (GWO will reassign)."""
    sandbox["rooms"] = [r for r in sandbox["rooms"] if r["room_id"] != params.room_id]
    # Also remove existing assignments using this room so GWO starts clean
    sandbox["schedule_entries"] = [
        e for e in sandbox.get("schedule_entries", [])
        if e.get("room_id") != params.room_id
    ]
    logger.info("Condition applied: room %d marked unavailable.", params.room_id)


def _apply_room_capacity_change(sandbox: Dict, params: RoomCapacityChangeParams) -> None:
    """Change the capacity of a room in the sandbox."""
    for room in sandbox["rooms"]:
        if room["room_id"] == params.room_id:
            params.original_capacity = room["capacity"]   # capture for display
            room["capacity"] = params.new_capacity
            logger.info("Condition applied: room %d capacity → %d.", params.room_id, params.new_capacity)
            break


def _apply_room_add(sandbox: Dict, params: RoomAddParams) -> None:
    """Add a brand-new room to the sandbox room pool."""
    # Assign a temporary negative ID to distinguish from real rooms
    new_id = min((r["room_id"] for r in sandbox["rooms"]), default=0) - 1
    sandbox["rooms"].append({
        "room_id":   new_id,
        "room_name": params.room_name,
        "building":  params.building,
        "capacity":  params.capacity,
        "room_type": params.room_type,
        "_simulated": True,
    })
    logger.info("Condition applied: new room '%s' (temp_id=%d) added.", params.room_name, new_id)


def _apply_lecturer_unavailable(sandbox: Dict, params: LecturerUnavailableParams) -> None:
    """
    Mark a lecturer as unavailable.
    If reassign_sections_to is set, move their sections to that lecturer.
    Otherwise, sections become unassigned for GWO to handle.
    """
    if params.reassign_sections_to:
        for entry in sandbox.get("schedule_entries", []):
            if entry.get("lecturer_id") == params.lecturer_id:
                entry["lecturer_id"] = params.reassign_sections_to
        logger.info("Condition applied: lecturer %d sections moved to %d.",
                    params.lecturer_id, params.reassign_sections_to)
    else:
        # Remove their entries so GWO reassigns
        sandbox["schedule_entries"] = [
            e for e in sandbox.get("schedule_entries", [])
            if e.get("lecturer_id") != params.lecturer_id
        ]
        logger.info("Condition applied: lecturer %d marked unavailable — sections unassigned.",
                    params.lecturer_id)

    # Add to unavailability constraints so GWO won't schedule them
    sandbox.setdefault("constraints", {}).setdefault("lecturer_unavailability", []).append({
        "lecturer_id": params.lecturer_id,
        "start_date":  params.start_date,
        "end_date":    params.end_date,
    })


def _apply_lecturer_load_shift(sandbox: Dict, params: LecturerLoadShiftParams) -> None:
    """Move specific sections (or enough to balance) from one lecturer to another."""
    entries      = sandbox.get("schedule_entries", [])
    from_entries = [e for e in entries if e.get("lecturer_id") == params.from_lecturer_id]

    if params.section_ids:
        # Move only the explicitly listed sections
        to_move = {e["section_id"] for e in from_entries if e["section_id"] in params.section_ids}
    else:
        # Auto-balance: move half the excess sections
        to_count    = sum(1 for e in entries if e.get("lecturer_id") == params.to_lecturer_id)
        from_count  = len(from_entries)
        target      = (from_count + to_count) // 2
        move_count  = max(0, from_count - target)
        to_move     = {e["section_id"] for e in from_entries[:move_count]}

    for entry in entries:
        if entry.get("lecturer_id") == params.from_lecturer_id and entry["section_id"] in to_move:
            entry["lecturer_id"] = params.to_lecturer_id

    logger.info("Condition applied: %d section(s) moved from lecturer %d to %d.",
                len(to_move), params.from_lecturer_id, params.to_lecturer_id)


def _apply_section_add(sandbox: Dict, params: SectionAddParams) -> None:
    """Add additional sections for a course. GWO will schedule them."""
    courses  = sandbox.get("courses", [])
    course   = next((c for c in courses if c["course_id"] == params.course_id), None)
    if not course:
        raise ValueError(f"Course {params.course_id} not found in sandbox.")

    avg_enrollment = params.enrollment_per_section or course.get("avg_enrollment", 30)
    existing_count = len([e for e in sandbox.get("schedule_entries", [])
                          if e.get("course_id") == params.course_id])

    new_sections = []
    for i in range(params.sections_to_add):
        new_id = -(i + 1) * 1000 - params.course_id   # temporary negative ID
        new_sections.append({
            "section_id":       new_id,
            "course_id":        params.course_id,
            "section_number":   existing_count + i + 1,
            "enrolled_count":   avg_enrollment,
            "_simulated":       True,
        })
    sandbox.setdefault("sections_to_schedule", []).extend(new_sections)
    logger.info("Condition applied: %d new section(s) added for course %d.",
                params.sections_to_add, params.course_id)


def _apply_section_remove(sandbox: Dict, params: SectionRemoveParams) -> None:
    """Remove a course offering (all or specific sections) from the sandbox."""
    if params.section_ids:
        sandbox["schedule_entries"] = [
            e for e in sandbox.get("schedule_entries", [])
            if e.get("section_id") not in params.section_ids
        ]
    else:
        sandbox["schedule_entries"] = [
            e for e in sandbox.get("schedule_entries", [])
            if e.get("course_id") != params.course_id
        ]
    logger.info("Condition applied: course %d section(s) removed.", params.course_id)


def _apply_section_split(sandbox: Dict, params: SectionSplitParams) -> None:
    """
    Split one large section into two smaller ones.
    The original entry is removed; two new half-size entries are added for GWO to schedule.
    """
    entries = sandbox.get("schedule_entries", [])
    original = next((e for e in entries if e.get("section_id") == params.section_id), None)
    if not original:
        raise ValueError(f"Section {params.section_id} not found in sandbox.")

    half_enrollment = max(1, original.get("enrolled_count", 30) // 2)
    names = params.new_section_names or ["Part A", "Part B"]

    # Remove original
    sandbox["schedule_entries"] = [e for e in entries if e.get("section_id") != params.section_id]

    # Add two new sub-sections for GWO to place
    for i, name in enumerate(names[:2]):
        new_id = -(params.section_id * 100 + i)
        sandbox.setdefault("sections_to_schedule", []).append({
            "section_id":     new_id,
            "course_id":      original.get("course_id"),
            "section_number": name,
            "enrolled_count": half_enrollment,
            "split_from":     params.section_id,
            "split_type":     params.split_type,
            "_simulated":     True,
        })
    logger.info("Condition applied: section %d split into 2.", params.section_id)


def _apply_timeslot_block(sandbox: Dict, params: TimeslotBlockParams) -> None:
    """
    Block a time window (e.g., all afternoon slots) from being scheduled.
    Removes matching timeslots from the available pool.
    Any existing assignments in that window are removed for GWO to reschedule.
    """
    from_h = _time_to_hours(params.start_time)
    to_h   = _time_to_hours(params.end_time)

    def in_blocked_window(day: str, start: str, end: str) -> bool:
        if params.days and day not in params.days:
            return False
        s = _time_to_hours(start)
        e = _time_to_hours(end)
        return s >= from_h or e <= to_h  # overlaps with blocked window

    # Remove timeslots
    sandbox["timeslots"] = [
        t for t in sandbox.get("timeslots", [])
        if not in_blocked_window(t.get("day", ""), t.get("start_time", ""), t.get("end_time", ""))
    ]
    # Remove existing schedule entries in that window
    sandbox["schedule_entries"] = [
        e for e in sandbox.get("schedule_entries", [])
        if not in_blocked_window(e.get("day", ""), e.get("start_time", ""), e.get("end_time", ""))
    ]
    logger.info("Condition applied: timeslot window %s–%s blocked.", params.start_time, params.end_time)


def _apply_constraint_weight(sandbox: Dict, params: ConstraintWeightParams) -> None:
    """Change the weight of a soft constraint in the optimization config."""
    constraints = sandbox.setdefault("constraints", {})
    soft = constraints.setdefault("soft_weights", {})
    soft[params.constraint_name] = params.new_weight
    logger.info("Condition applied: constraint '%s' weight → %.2f.", params.constraint_name, params.new_weight)


def _apply_priority_mode(sandbox: Dict, params: PriorityModeParams) -> None:
    """Change the overall priority mode (student-first vs lecturer-first vs balanced)."""
    constraints = sandbox.setdefault("constraints", {})
    constraints["priority_mode"]    = params.new_mode
    constraints["student_weight"]   = params.student_weight
    constraints["lecturer_weight"]  = params.lecturer_weight
    logger.info("Condition applied: priority mode → '%s'.", params.new_mode)


# ---------------------------------------------------------------------------
# Apply scenario result to production
# ---------------------------------------------------------------------------

async def apply_run_to_production(
    db: AsyncSession,
    run: ScenarioRun,
    timetable_repo,
    applied_by: int,
) -> None:
    """
    Promote a completed scenario run result to the official production timetable.
    This is the ONLY point where simulation data touches production.
    Called only when the admin explicitly clicks 'Apply to Production'.
    """
    if run.status != ScenarioStatus.COMPLETED:
        raise ValueError("Only COMPLETED scenario runs can be applied to production.")

    await timetable_repo.promote_sandbox_to_production(
        sandbox_timetable_id=run.result_timetable_id,
        base_timetable_id=run.base_timetable_id,
        applied_by=applied_by,
        scenario_run_id=run.id,
    )
    run.status = ScenarioStatus.APPLIED
    await _save(db, run)
    logger.info("ScenarioRun %d applied to production by user %d.", run.id, applied_by)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _save(db: AsyncSession, obj) -> None:
    db.add(obj)
    await db.commit()
    await db.refresh(obj)


def _time_to_hours(t: str) -> float:
    try:
        h, m = t.split(":")
        return int(h) + int(m) / 60
    except Exception:
        return 0.0


def _build_student_assignments(schedule_entries: List[Dict], config: Dict) -> List[Dict]:
    """
    Build a flat list of {student_id, day, start_time, end_time} records
    from schedule entries and the sandbox student enrollment data.
    Used for student gap calculation.
    """
    section_to_students: Dict[int, List[int]] = {}
    for enrollment in config.get("student_enrollments", []):
        sid_list = section_to_students.setdefault(enrollment["section_id"], [])
        sid_list.append(enrollment["student_id"])

    assignments = []
    for entry in schedule_entries:
        for student_id in section_to_students.get(entry.get("section_id"), []):
            assignments.append({
                "student_id": student_id,
                "day":        entry["day"],
                "start_time": entry["start_time"],
                "end_time":   entry["end_time"],
            })
    return assignments