#!/usr/bin/env python3
"""
whatif/run_scenario.py
======================
What-If Scenario Runner — spawned by NestJS as a child process.

Responsibilities:
  1. Read the run config JSON written by WhatIfService._buildRunnerConfig()
  2. Deep-clone the timetable data into an isolated sandbox dict
  3. Apply each ScenarioCondition to mutate the sandbox (all 11 condition types)
  4. Write the mutated config to a temp file in GWO-v6.py's expected input format
  5. Spawn GWO-v6.py as a subprocess, forwarding its progress lines to stdout
  6. When GWO exits, collect its result JSON, save the result timetable to DB
     via psycopg2, and emit a final {"type":"result",...} line

Every line written to stdout is a JSON object.  NestJS reads these lines and
forwards them as SSE events to the frontend, which re-uses the existing
gwo-run-context.tsx / TimetableGenerationRunActions components unchanged.

Usage:
  python3 whatif/run_scenario.py --config /tmp/whatif_run_42.json

Exit codes:
  0 = success ({"type":"result",...} line emitted)
  1 = error   ({"type":"error",...} line emitted before exit)
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Stdout helpers — every line is a JSON object so NestJS can parse it
# ---------------------------------------------------------------------------

def emit(
    evt_type: str,
    *,
    phase: str = "",
    pct: int = 0,
    message: str = "",
    **extra,
) -> None:
    """Write a progress or result event to stdout (line-buffered)."""
    payload = {"type": evt_type, "phase": phase, "pct": pct, "message": message}
    payload.update(extra)
    print(json.dumps(payload), flush=True)


def emit_error(message: str, detail: str = "") -> None:
    emit("error", phase="error", pct=0, message=message, detail=detail)

def _norm(s: Any) -> str:
    return str(s or "").strip().lower()

def _day_mask(days: List[str]) -> int:
    day_to_bit = {
        "sunday": 0,
        "monday": 1,
        "tuesday": 2,
        "wednesday": 3,
        "thursday": 4,
    }
    mask = 0
    for d in days or []:
        bit = day_to_bit.get(_norm(d))
        if bit is not None:
            mask |= (1 << bit)
    return mask

def _decode_days_mask(days_mask: Any) -> List[str]:
    bit_to_day = {
        0: "Sunday",
        1: "Monday",
        2: "Tuesday",
        3: "Wednesday",
        4: "Thursday",
        5: "Friday",
        6: "Saturday",
    }
    try:
        mask = int(days_mask or 0)
    except Exception:
        mask = 0
    out: List[str] = []
    for bit in range(0, 7):
        if ((mask >> bit) & 1) == 1 and bit in bit_to_day:
            out.append(bit_to_day[bit])
    return out

def _hhmm_to_hour(hhmm: Any) -> float:
    text = str(hhmm or "").strip()
    if not text:
        return 0.0
    try:
        h, m = text.split(":", 1)
        return int(h) + (int(m) / 60.0)
    except Exception:
        return 0.0

def _room_type_name(room_type: Any) -> str:
    try:
        rt = int(room_type)
    except Exception:
        rt = 0
    if rt == 1:
        return "lecture_hall"
    if rt == 2:
        return "lab_room"
    if rt == 3:
        return "studio"
    return "any"

def _delivery_mode_name(mode: Any) -> str:
    val = _norm(mode)
    if val in {"online"}:
        return "online"
    if val in {"blended"}:
        return "blended"
    return "inperson"

def _build_legacy_gwo_config(
    config: Dict[str, Any],
    sandbox: Dict[str, Any],
    existing_config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Build frontend/data/config.json payload expected by legacy GWO-v6.py.
    This guarantees scenario runs optimize the current sandbox, not stale UI data.
    """
    is_summer = bool(config.get("is_summer", False))

    lecturers = sandbox.get("lecturers", []) or []
    rooms = sandbox.get("rooms", []) or []
    timeslots = sandbox.get("timeslots", []) or []
    courses = sandbox.get("courses", []) or []
    existing_entries = sandbox.get("existing_entries", []) or []

    lecturer_names: List[str] = []
    lecturer_index_by_user_id: Dict[int, int] = {}
    for idx, l in enumerate(lecturers):
        name = f"{l.get('first_name', '')} {l.get('last_name', '')}".strip() or f"Lecturer {idx+1}"
        lecturer_names.append(name)
        try:
            uid = int(l.get("user_id"))
            lecturer_index_by_user_id[uid] = idx
        except Exception:
            continue

    rooms_dict: Dict[str, Dict[str, Any]] = {}
    for r in rooms:
        room_number = str(r.get("room_number") or "").strip()
        if not room_number:
            continue
        rooms_dict[room_number] = {
            "capacity": int(r.get("capacity") or 0),
            "room_type": _room_type_name(r.get("room_type")),
        }

    timeslots_data: List[Dict[str, Any]] = []
    for t in timeslots:
        slot_id = t.get("slot_id")
        if slot_id is None:
            continue
        start = str(t.get("start_time") or "00:00")
        end = str(t.get("end_time") or "00:00")
        start_hour = _hhmm_to_hour(start)
        end_hour = _hhmm_to_hour(end)
        duration = end_hour - start_hour
        if duration <= 0:
            duration = 1.0
        timeslots_data.append({
            "id": f"slot_{slot_id}",
            "days": _decode_days_mask(t.get("days_mask")),
            "start_hour": start_hour,
            "duration": duration,
            "slot_type": t.get("slot_type") or "lecture_generic",
        })

    teachable_by_user: Dict[int, set] = {}
    for l in lecturers:
        try:
            uid = int(l.get("user_id"))
        except Exception:
            continue
        teachable = set()
        for cid in l.get("teachable_course_ids", []) or []:
            try:
                teachable.add(int(cid))
            except Exception:
                continue
        teachable_by_user[uid] = teachable

    seeded_sizes: Dict[tuple, int] = {}
    for e in existing_entries:
        try:
            key = (int(e.get("course_id")), str(e.get("section_number") or "").strip())
            size = int(e.get("registered_students") or 0)
        except Exception:
            continue
        if key[1]:
            seeded_sizes[key] = size

    lectures_data: List[Dict[str, Any]] = []
    lecture_id = 1
    for c in courses:
        try:
            course_id = int(c.get("course_id"))
        except Exception:
            continue
        course_code = str(c.get("course_code") or "").strip()
        if not course_code:
            continue
        course_name = str(c.get("course_name") or course_code)
        sections_count = int(c.get("sections_summer" if is_summer else "sections_normal") or 0)
        if sections_count <= 0:
            continue

        allowed_lecturer_indices: List[int] = []
        for uid, idx in lecturer_index_by_user_id.items():
            if course_id in teachable_by_user.get(uid, set()):
                allowed_lecturer_indices.append(idx)
        if not allowed_lecturer_indices:
            allowed_lecturer_indices = list(range(len(lecturer_names)))

        for s in range(1, sections_count + 1):
            section_number = f"S{s}"
            size = seeded_sizes.get((course_id, section_number), 30)
            lectures_data.append({
                "id": lecture_id,
                "course": course_code,
                "course_name": course_name,
                "allowed_lecturers": allowed_lecturer_indices,
                "size": max(0, int(size)),
                "credit_hours": int(c.get("credit_hours") or 0),
                "section_number": section_number,
                "delivery_mode": _delivery_mode_name(c.get("delivery_mode")),
                "session_type": "lab" if bool(c.get("is_lab")) else "lecture",
            })
            lecture_id += 1

    existing = existing_config or {}
    existing_gwo_params = existing.get("gwo_params", {}) if isinstance(existing, dict) else {}
    existing_soft_weights = existing.get("soft_weights", {}) if isinstance(existing, dict) else {}

    return {
        "rooms": rooms_dict,
        "timeslots": timeslots_data,
        "lecturers": lecturer_names,
        "lecturer_preferences": {},
        "lectures": lectures_data,
        # Preserve user-tuned optimizer settings from the existing UI config.
        "gwo_params": existing_gwo_params
        if isinstance(existing_gwo_params, dict) and existing_gwo_params
        else {
            "num_wolves": 30,
            "num_iterations": 200,
            "mutation_rate": 0.5,
            "gene_mutation_rate": 0.15,
            "improvement_threshold": 0.01,
            "random_fresh_fraction": 0.3,
            "stagnation_limit": 10,
            "num_runs": 5,
            "max_classes_per_lecturer": 5,
        },
        "soft_weights": existing_soft_weights if isinstance(existing_soft_weights, dict) else {},
    }

def _map_schedule_rows_to_entries(
    schedule_rows: List[Dict[str, Any]],
    tt: Dict[str, Any],
) -> List[Dict[str, Any]]:
    def _norm_day_token(day: Any) -> str:
        text = str(day or "").strip().lower()
        if text.startswith("sun"):
            return "sun"
        if text.startswith("mon"):
            return "mon"
        if text.startswith("tue"):
            return "tue"
        if text.startswith("wed"):
            return "wed"
        if text.startswith("thu"):
            return "thu"
        if text.startswith("fri"):
            return "fri"
        if text.startswith("sat"):
            return "sat"
        return text[:3]

    def _slot_sig(days: List[Any], start_hour: Any, duration: Any) -> str:
        norm_days = sorted([_norm_day_token(d) for d in (days or []) if str(d or "").strip()])
        try:
            start = round(float(start_hour), 4)
        except Exception:
            start = 0.0
        try:
            dur = round(float(duration), 4)
        except Exception:
            dur = 0.0
        return f"{'|'.join(norm_days)}::{start:.4f}::{dur:.4f}"

    course_id_by_code = {
        _norm(c.get("course_code")): c.get("course_id")
        for c in tt.get("courses", []) or []
    }
    room_id_by_number = {
        _norm(r.get("room_number")): r.get("room_id")
        for r in tt.get("rooms", []) or []
    }
    lecturer_id_by_name = {
        _norm(f"{l.get('first_name', '')} {l.get('last_name', '')}"): l.get("user_id")
        for l in tt.get("lecturers", []) or []
    }
    slot_id_by_signature: Dict[str, int] = {}
    for t in tt.get("timeslots", []) or []:
        try:
            slot_id = int(t.get("slot_id"))
        except Exception:
            continue
        sig = _slot_sig(
            _decode_days_mask(t.get("days_mask")),
            _hhmm_to_hour(t.get("start_time")),
            max(0.0, _hhmm_to_hour(t.get("end_time")) - _hhmm_to_hour(t.get("start_time"))),
        )
        if sig and sig not in slot_id_by_signature:
            slot_id_by_signature[sig] = slot_id

    rooms_list = tt.get("rooms", []) or []
    virtual_room_id = None
    for r in rooms_list:
        try:
            if int(r.get("room_type") or 0) == 3 and r.get("room_id") is not None:
                virtual_room_id = r.get("room_id")
                break
        except Exception:
            continue
    if virtual_room_id is None:
        for r in rooms_list:
            if r.get("room_id") is not None:
                virtual_room_id = r.get("room_id")
                break

    entries: List[Dict[str, Any]] = []
    per_course_section_counter: Dict[int, int] = {}
    for i, row in enumerate(schedule_rows, start=1):
        slot_raw = str(
            row.get("timeslot")
            or row.get("timeslot_id")
            or row.get("slot")
            or ""
        ).strip()
        slot_id: Optional[int] = None
        m = re.match(r"^slot_(\d+)$", slot_raw, flags=re.IGNORECASE)
        if m:
            try:
                slot_id = int(m.group(1))
            except Exception:
                slot_id = None
        if slot_id is None:
            sig = _slot_sig(
                row.get("days") if isinstance(row.get("days"), list) else [],
                row.get("start_hour"),
                row.get("duration"),
            )
            slot_id = slot_id_by_signature.get(sig)

        course_id = course_id_by_code.get(
            _norm(row.get("course_code") or row.get("course"))
        )
        room_id = room_id_by_number.get(_norm(row.get("room")))
        user_id = lecturer_id_by_name.get(_norm(row.get("lecturer")))

        if course_id is None or slot_id is None:
            continue

        raw_section_number = row.get("section_number")
        if raw_section_number is not None and str(raw_section_number).strip():
            section_number = str(raw_section_number)[:10]
        else:
            # When the optimizer output doesn't include a stable section label,
            # assign deterministic per-course labels (S1, S2, ...) to avoid
            # collisions under the DB unique constraint.
            per_course_section_counter[course_id] = per_course_section_counter.get(course_id, 0) + 1
            section_number = f"S{per_course_section_counter[course_id]}"[:10]

        if room_id is None:
            room_id = virtual_room_id

        entries.append({
            "user_id": user_id,
            "lecturer_name_snapshot": row.get("lecturer"),
            "slot_id": slot_id,
            "course_id": course_id,
            "room_id": room_id,
            "registered_students": int(row.get("class_size", 0) or 0),
            "section_number": section_number,
        })
    return entries

def _normalize_gwo_result_shape(gwo_result: Dict[str, Any], tt: Dict[str, Any]) -> Dict[str, Any]:
    """
    Accept multiple optimizer output schemas and normalize to the persistence schema:
    { schedule_entries, metrics, conflicts, iterations_run }.
    """
    if not isinstance(gwo_result, dict):
        return {
            "schedule_entries": [],
            "metrics": {},
            "conflicts": [],
            "iterations_run": 0,
        }

    entries = gwo_result.get("schedule_entries", [])
    if not isinstance(entries, list):
        entries = []

    # Some scripts return "schedule" rows instead of "schedule_entries".
    if not entries:
        schedule_rows = gwo_result.get("schedule", [])
        if isinstance(schedule_rows, list) and schedule_rows:
            mapped = _map_schedule_rows_to_entries(
                [r for r in schedule_rows if isinstance(r, dict)],
                tt,
            )
            if mapped:
                entries = mapped

    metrics = gwo_result.get("metrics", {})
    if not isinstance(metrics, dict):
        metrics = {}

    conflicts = gwo_result.get("conflicts", [])
    if not isinstance(conflicts, list):
        conflicts = []

    iterations_run = gwo_result.get("iterations_run", 0)
    try:
        iterations_run = int(iterations_run or 0)
    except Exception:
        iterations_run = 0

    return {
        "schedule_entries": entries,
        "metrics": metrics,
        "conflicts": conflicts,
        "iterations_run": iterations_run,
    }

def _load_schedule_output_result(gwo_script: str, gwo_config_path: str) -> Optional[Dict[str, Any]]:
    """
    Last-resort fallback for legacy scripts that only write schedule_output.txt.
    Parses human-readable rows and maps them to DB IDs via timetable_data.
    """
    script_dir = os.path.dirname(os.path.abspath(gwo_script))
    candidates = [
        os.path.normpath(os.path.join(os.getcwd(), "schedule_output.txt")),
        os.path.normpath(os.path.join(os.getcwd(), "backend", "schedule_output.txt")),
        os.path.normpath(os.path.join(script_dir, "..", "schedule_output.txt")),
    ]
    output_path = next((p for p in candidates if os.path.exists(p)), None)
    if not output_path:
        return None

    with open(gwo_config_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    # GWO input config already contains the resolved entity arrays at top-level.
    tt = cfg or {}

    with open(output_path, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    schedule_rows: List[Dict[str, Any]] = []
    hard_conflicts = 0
    best_fitness = 0.0
    for line in lines:
        raw = line.strip()
        if not raw:
            continue
        if "|" in raw and raw.lower() != "schedule details:" and not raw.startswith("---"):
            parts = [p.strip() for p in raw.split("|")]
            if len(parts) >= 7:
                course_code, delivery_mode, session_type, timeslot_id, days_text, room_text, lecturer = parts[:7]
                days = [d for d in re.split(r"\s+", days_text) if d]
                schedule_rows.append({
                    "course_code": course_code,
                    "course": course_code,
                    "delivery_mode": delivery_mode,
                    "session_type": session_type,
                    "timeslot": timeslot_id,
                    "days": days,
                    "room": None if room_text.upper() == "ONLINE" else room_text,
                    "lecturer": lecturer,
                    "class_size": 30,
                })
                continue
        if raw.lower().startswith("hard conflicts:"):
            try:
                hard_conflicts = int(raw.split(":", 1)[1].strip())
            except Exception:
                hard_conflicts = 0
        elif raw.lower().startswith("final fitness:"):
            try:
                best_fitness = float(raw.split(":", 1)[1].strip())
            except Exception:
                best_fitness = 0.0

    if not schedule_rows:
        return None

    entries = _map_schedule_rows_to_entries(schedule_rows, tt)
    metrics = {
        "roomUtilizationRate": 0.0,
        "softConstraintsScore": 0.0,
        "fitnessScore": best_fitness,
        "isValid": hard_conflicts == 0,
    }
    conflicts = [
        {
            "conflict_type": "hard_conflicts",
            "severity": "warning",
            "course_code": "",
            "section_number": "",
            "lecturer_name": None,
            "room_number": None,
            "timeslot_label": None,
            "detail": f"Total hard conflicts reported by schedule_output.txt: {hard_conflicts}",
        }
    ] if hard_conflicts > 0 else []

    return {
        "schedule_entries": entries,
        "metrics": metrics,
        "conflicts": conflicts,
        "iterations_run": 0,
    }

def _load_ui_schedule_result(gwo_script: str, gwo_config_path: str) -> Optional[Dict]:
    """
    Compatibility fallback for GWO scripts that do not emit --output JSON.
    Reads frontend/data/schedule.json (written by send_schedule.py) and converts
    it into the shape expected by save_result_timetable().
    """
    script_dir = os.path.dirname(os.path.abspath(gwo_script))
    candidates = [
        # frontend/scripts -> frontend/data (current setup)
        os.path.normpath(os.path.join(script_dir, "..", "data", "schedule.json")),
        # repo root/backend cwd -> frontend/data
        os.path.normpath(os.path.join(os.getcwd(), "..", "frontend", "data", "schedule.json")),
        os.path.normpath(os.path.join(os.getcwd(), "frontend", "data", "schedule.json")),
        # legacy/backend-local fallback
        os.path.normpath(os.path.join(os.getcwd(), "data", "schedule.json")),
    ]
    ui_schedule_path = next((p for p in candidates if os.path.exists(p)), None)
    if not ui_schedule_path:
        return None

    with open(ui_schedule_path, "r", encoding="utf-8") as f:
        ui_payload = json.load(f)
    with open(gwo_config_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    schedule_rows = ui_payload.get("schedule", []) or []
    metadata = ui_payload.get("metadata", {}) or {}
    # GWO input config already contains the resolved entity arrays at top-level.
    tt = cfg or {}

    entries = _map_schedule_rows_to_entries(
        [r for r in schedule_rows if isinstance(r, dict)],
        tt,
    )

    # Build minimal metrics payload expected by downstream.
    hard_conflicts = int(metadata.get("conflicts", 0) or 0)
    metrics = {
        "roomUtilizationRate": float(metadata.get("timetable_seat_utilization_pct", 0) or 0),
        "softConstraintsScore": 0.0,
        "fitnessScore": float(metadata.get("best_fitness", 0) or 0),
        "isValid": hard_conflicts == 0,
    }
    conflicts = [
        {
            "conflict_type": "hard_conflicts",
            "severity": "warning",
            "course_code": "",
            "section_number": "",
            "lecturer_name": None,
            "room_number": None,
            "timeslot_label": None,
            "detail": f"Total hard conflicts reported by GWO UI payload: {hard_conflicts}",
        }
    ] if hard_conflicts > 0 else []

    return {
        "schedule_entries": entries,
        "metrics": metrics,
        "conflicts": conflicts,
        "iterations_run": int(metadata.get("iterations", 0) or 0),
    }

def _to_numeric_5_2(value: Any) -> float:
    """
    Normalize to PostgreSQL NUMERIC(5,2) safe range: [-999.99, 999.99].
    """
    try:
        num = float(value)
    except Exception:
        num = 0.0
    if num > 999.99:
        return 999.99
    if num < -999.99:
        return -999.99
    return round(num, 2)

# ---------------------------------------------------------------------------
# Condition appliers
# ---------------------------------------------------------------------------

def apply_conditions(sandbox: Dict[str, Any], conditions: List[Dict]) -> None:
    """Apply all scenario conditions to the sandbox config in order."""
    sorted_conditions = sorted(conditions, key=lambda c: c.get("order_index", 0))

    for i, condition in enumerate(sorted_conditions):
        ctype = condition["type"]
        params = condition.get("parameters", {})
        pct = 25 + int((i + 1) / max(len(sorted_conditions), 1) * 10)

        emit(
            "progress",
            phase="conditions",
            pct=pct,
            message=f"Applying condition {i+1}/{len(sorted_conditions)}: {ctype}",
        )

        try:
            _APPLIERS[ctype](sandbox, params)
        except KeyError:
            emit("progress", phase="conditions", pct=pct,
                 message=f"Warning: unknown condition type '{ctype}' — skipped.")


def _apply_add_lecturer(sandbox: Dict, params: Dict) -> None:
    """Inject a brand-new lecturer into the sandbox pool."""
    # Use a large negative user_id to signal it is simulated (no real DB row)
    existing_ids = [l["user_id"] for l in sandbox["lecturers"]]
    new_id = min(existing_ids, default=0) - 1

    sandbox["lecturers"].append({
        "user_id": new_id,
        "first_name": params.get("firstName", "Simulated"),
        "last_name": params.get("lastName", "Lecturer"),
        "dept_id": params.get("deptId", 1),
        "max_workload": params.get("maxWorkload", 3),
        "is_available": params.get("isAvailable", True),
        "teachable_course_ids": params.get("teachableCourseIds", []),
        "_simulated": True,
    })


def _apply_delete_lecturer(sandbox: Dict, params: Dict) -> None:
    """Remove lecturer; their sections become unassigned (no user_id / slot_id)."""
    uid = params["lecturerUserId"]
    sandbox["lecturers"] = [l for l in sandbox["lecturers"] if l["user_id"] != uid]
    # Unassign sections held by this lecturer so GWO will reschedule them
    for entry in sandbox.get("existing_entries", []):
        if entry.get("user_id") == uid:
            entry["user_id"] = None
            entry["lecturer_name_snapshot"] = "UNASSIGNED"


def _apply_amend_lecturer(sandbox: Dict, params: Dict) -> None:
    """Change a lecturer's teachable courses or max workload."""
    uid = params["lecturerUserId"]
    for lect in sandbox["lecturers"]:
        if lect["user_id"] == uid:
            if "teachableCourseIds" in params:
                lect["teachable_course_ids"] = params["teachableCourseIds"]
            if "maxWorkload" in params:
                lect["max_workload"] = params["maxWorkload"]
            if "isAvailable" in params:
                lect["is_available"] = params["isAvailable"]
            break


def _apply_add_room(sandbox: Dict, params: Dict) -> None:
    """Add a brand-new room to the sandbox pool."""
    existing_ids = [r["room_id"] for r in sandbox["rooms"]]
    new_id = min(existing_ids, default=0) - 1

    sandbox["rooms"].append({
        "room_id": new_id,
        "room_number": params.get("roomNumber", f"SIM-{abs(new_id)}"),
        "room_type": params.get("roomType", 1),
        "capacity": params.get("capacity", 30),
        "is_available": params.get("isAvailable", True),
        "_simulated": True,
    })


def _apply_delete_room(sandbox: Dict, params: Dict) -> None:
    """Remove room from the pool; sections that used it become unassigned for GWO."""
    rid = params["roomId"]
    sandbox["rooms"] = [r for r in sandbox["rooms"] if r["room_id"] != rid]
    for entry in sandbox.get("existing_entries", []):
        if entry.get("room_id") == rid:
            entry["room_id"] = None


def _apply_adjust_room_capacity(sandbox: Dict, params: Dict) -> None:
    """Change the capacity of an existing room."""
    rid = params["roomId"]
    new_cap = params["newCapacity"]
    for room in sandbox["rooms"]:
        if room["room_id"] == rid:
            room["capacity"] = new_cap
            break


def _apply_add_course(sandbox: Dict, params: Dict) -> None:
    """Add a new course offering to be scheduled."""
    existing_ids = [c["course_id"] for c in sandbox["courses"]]
    new_id = min(existing_ids, default=0) - 1

    sandbox["courses"].append({
        "course_id": new_id,
        "course_code": params.get("courseCode", f"SIM{abs(new_id)}"),
        "course_name": params.get("courseName", "Simulated Course"),
        "dept_id": params.get("deptId", 1),
        "academic_level": params.get("academicLevel", 1),
        "is_lab": params.get("isLab", False),
        "credit_hours": params.get("creditHours", 3),
        "delivery_mode": params.get("deliveryMode", "FACE_TO_FACE"),
        "sections_normal": params.get("sectionsNormal", 1),
        "sections_summer": params.get("sectionsSummer", 0),
        "_simulated": True,
    })

    # Register assignable lecturers for this course
    for uid in params.get("assignableLecturerIds", []):
        for lect in sandbox["lecturers"]:
            if lect["user_id"] == uid:
                if new_id not in lect.get("teachable_course_ids", []):
                    lect.setdefault("teachable_course_ids", []).append(new_id)
                break


def _apply_change_section_count(sandbox: Dict, params: Dict) -> None:
    """Increase or decrease parallel sections for a course."""
    cid = params["courseId"]
    for course in sandbox["courses"]:
        if course["course_id"] == cid:
            if "newSectionsNormal" in params:
                course["sections_normal"] = max(0, params["newSectionsNormal"])
            if "newSectionsSummer" in params:
                course["sections_summer"] = max(0, params["newSectionsSummer"])
            break


def _apply_change_delivery_mode(sandbox: Dict, params: Dict) -> None:
    """
    Flip a course between ONLINE / FACE_TO_FACE / BLENDED.
    When flipping to ONLINE, remove existing room assignments for this course —
    online courses don't need physical rooms, freeing them for GWO.
    """
    cid = params["courseId"]
    new_mode = params.get("newDeliveryMode") or params.get("deliveryMode")
    if not isinstance(new_mode, str) or not new_mode.strip():
        return
    new_mode = new_mode.strip().upper()

    old_mode = None
    for course in sandbox["courses"]:
        if course["course_id"] == cid:
            old_mode = course["delivery_mode"]
            course["delivery_mode"] = new_mode
            break

    if new_mode == "ONLINE" and old_mode != "ONLINE":
        # Free up rooms: set room_id to a sentinel that GWO ignores for online courses
        for entry in sandbox.get("existing_entries", []):
            if entry.get("course_id") == cid:
                entry["room_id"] = None  # GWO will skip room assignment for ONLINE


def _apply_add_timeslot(sandbox: Dict, params: Dict) -> None:
    """Add a new available timeslot to the pool."""
    existing_ids = [t["slot_id"] for t in sandbox["timeslots"]]
    new_id = min(existing_ids, default=0) - 1

    day_to_bit = {
        "sunday": 0,
        "monday": 1,
        "tuesday": 2,
        "wednesday": 3,
        "thursday": 4,
    }
    if isinstance(params.get("days"), list):
        days_mask = 0
        for d in params.get("days", []):
            bit = day_to_bit.get(str(d).strip().lower())
            if bit is not None:
                days_mask |= (1 << bit)
    else:
        days_mask = params.get("daysMask", 0)

    sandbox["timeslots"].append({
        "slot_id": new_id,
        "start_time": params.get("startTime", "08:00"),
        "end_time": params.get("endTime", "09:30"),
        "days_mask": days_mask,
        "slot_type": params.get("slotType", "Traditional"),
        "is_summer": params.get("isSummer", False),
        "_simulated": True,
    })


def _apply_delete_timeslot(sandbox: Dict, params: Dict) -> None:
    """
    Remove a timeslot from the pool. Sections that used it become unassigned
    so GWO can reschedule them into remaining timeslots.
    """
    sid = params["slotId"]
    sandbox["timeslots"] = [t for t in sandbox["timeslots"] if t["slot_id"] != sid]
    for entry in sandbox.get("existing_entries", []):
        if entry.get("slot_id") == sid:
            entry["slot_id"] = None


# ---------------------------------------------------------------------------
# Applier dispatch table
# ---------------------------------------------------------------------------

_APPLIERS = {
    "add_lecturer":          _apply_add_lecturer,
    "delete_lecturer":       _apply_delete_lecturer,
    "amend_lecturer":        _apply_amend_lecturer,
    "add_room":              _apply_add_room,
    "delete_room":           _apply_delete_room,
    "adjust_room_capacity":  _apply_adjust_room_capacity,
    "add_course":            _apply_add_course,
    "change_section_count":  _apply_change_section_count,
    "change_delivery_mode":  _apply_change_delivery_mode,
    "add_timeslot":          _apply_add_timeslot,
    "delete_timeslot":       _apply_delete_timeslot,
}


# ---------------------------------------------------------------------------
# GWO runner
# ---------------------------------------------------------------------------

def run_gwo(
    gwo_script: str,
    gwo_config_path: str,
    gwo_output_path: str,
    run_id: int,
) -> Optional[Dict]:
    """
    Spawn GWO-v6.py, forward its progress lines (phases 40–92%), then return
    the parsed result JSON written by GWO to gwo_output_path.

    GWO-v6.py is expected to:
      • Read its input config from the path passed as first positional arg
        (or --config).
      • Write its output JSON to the path passed as --output.
      • Stream progress lines to stdout.  Lines that are valid JSON objects
        with a "type" field are forwarded as-is; other lines are wrapped.

    Adjust the subprocess call below if your GWO-v6.py uses different args.
    """
    python = os.environ.get("PYTHON_BIN") or os.environ.get("PYTHON") or sys.executable
    gwo_args = [python, gwo_script, "--config", gwo_config_path, "--output", gwo_output_path]

    emit("progress", phase="gwo", pct=40, message="Starting GWO optimization...")

    try:
        proc = subprocess.Popen(
            gwo_args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,          # line-buffered
            env={
                **os.environ,
                "PYTHONUNBUFFERED": "1",
                "PYTHONIOENCODING": "utf-8",
            },
        )
    except FileNotFoundError:
        emit_error(
            f"GWO script not found: {gwo_script}",
            detail=f"Set the GWO_SCRIPT_PATH environment variable or ensure GWO-v6.py "
                   f"exists at the path in the config.",
        )
        return None

    # Stream GWO stdout lines, remapping its 0-100% scale to our 40-92% range
    for raw_line in iter(proc.stdout.readline, ""):
        line = raw_line.strip()
        if not line:
            continue
        try:
            if line.startswith("__GWO_PROGRESS__"):
                inner = line[len("__GWO_PROGRESS__") :].strip()
                pdata = json.loads(inner)
                unified: Dict[str, Any] = {"type": "progress"}
                for key in ("current", "total", "run", "numRuns", "best"):
                    if key in pdata and pdata[key] is not None:
                        unified[key] = pdata[key]
                print(json.dumps(unified), flush=True)
                continue
            parsed = json.loads(line)
            # Remap pct: GWO emits 0-100, we display 40-92
            if "pct" in parsed:
                parsed["pct"] = 40 + int(parsed["pct"] * 0.52)
            print(json.dumps(parsed), flush=True)
        except json.JSONDecodeError:
            # Plain text progress from GWO — wrap it
            emit("progress", phase="gwo", pct=65, message=line)

    proc.stdout.close()
    return_code = proc.wait()

    if return_code != 0:
        stderr_output = proc.stderr.read()
        emit_error(
            f"GWO exited with code {return_code}.",
            detail=stderr_output[:2000] if stderr_output else "",
        )
        return None

    # Read GWO result JSON
    if not os.path.exists(gwo_output_path):
        # Compatibility path for current GWO script variants that write only
        # frontend/data/schedule.json via send_schedule.py.
        fallback_result = _load_ui_schedule_result(gwo_script, gwo_config_path)
        if fallback_result is not None:
            emit(
                "progress",
                phase="gwo",
                pct=94,
                message="Using UI schedule output fallback (no gwo_output.json generated).",
            )
            return fallback_result
        emit_error(
            "GWO completed but did not write an output file.",
            detail=f"Expected output at: {gwo_output_path}",
        )
        return None

    with open(gwo_output_path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Save result timetable to DB via psycopg2
# ---------------------------------------------------------------------------

def save_result_timetable(
    database_url: str,
    base_timetable_id: int,
    semester_id: Optional[int],
    gwo_result: Dict,
) -> int:
    """
    Create a new timetable row and populate it with schedule entries produced
    by GWO.  Returns the new timetable_id.

    Uses psycopg2 so this script has no NestJS / Prisma dependency.
    """
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(database_url)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            # Resolve a "virtual" room for simulated / online sessions.
            # The DB schema requires a non-null room_id; when the scenario introduces
            # simulated rooms, we map them to a real fallback room instead of
            # dropping the session row on save.
            cur.execute(
                """
                SELECT room_id
                FROM room
                WHERE COALESCE(is_available, TRUE) = TRUE
                ORDER BY
                  CASE WHEN room_type = 3 THEN 0 ELSE 1 END,
                  room_id ASC
                LIMIT 1
                """,
            )
            virtual_room_row = cur.fetchone()
            virtual_room_id = virtual_room_row[0] if virtual_room_row else None

            # Resolve a "virtual" slot for unassigned or simulated sessions.
            # The DB schema requires a non-null slot_id.
            cur.execute(
                """
                SELECT slot_id
                FROM timeslot
                WHERE is_active = TRUE
                ORDER BY slot_id ASC
                LIMIT 1
                """
            )
            virtual_slot_row = cur.fetchone()
            virtual_slot_id = virtual_slot_row[0] if virtual_slot_row else None

            # ── 1. Determine next version number ──
            if semester_id is None:
                cur.execute(
                    "SELECT COALESCE(MAX(version_number), 0) + 1 FROM timetable WHERE semester_id IS NULL"
                )
            else:
                cur.execute(
                    "SELECT COALESCE(MAX(version_number), 0) + 1 FROM timetable WHERE semester_id = %s",
                    (semester_id,),
                )
            next_version = cur.fetchone()[0]

            # ── 2. Create result timetable row ──
            # Use UTC wall time for generated_at. The column is TIMESTAMP WITHOUT TIME ZONE;
            # PostgreSQL NOW() follows the session timezone, while Prisma/API treat values as
            # UTC — mismatch caused wrong times in the UI for scenario-result timetables.
            generated_at_utc = datetime.now(timezone.utc).replace(tzinfo=None)
            cur.execute(
                """
                INSERT INTO timetable
                  (semester_id, generated_at, status, generation_type, version_number)
                VALUES (%s, %s, 'draft', 'what_if', %s)
                RETURNING timetable_id
                """,
                (semester_id, generated_at_utc, next_version),
            )
            result_timetable_id = cur.fetchone()[0]

            # ── 3. Insert schedule entries ──
            entries = gwo_result.get("schedule_entries", [])
            skipped_missing_core_fk = 0
            skipped_missing_room = 0
            if entries:
                rows = []
                for e in entries:
                    user_id = e.get("user_id")
                    room_id = e.get("room_id")
                    slot_id = e.get("slot_id")
                    course_id = e.get("course_id")

                    # Always skip invalid core FKs.
                    if course_id is None or (course_id is not None and course_id <= 0):
                        skipped_missing_core_fk += 1
                        continue
                        
                    if slot_id is None or (slot_id is not None and slot_id <= 0):
                        slot_id = virtual_slot_id
                        
                    if slot_id is None:
                        skipped_missing_core_fk += 1
                        continue

                    # Simulated lecturers (negative user_id) are persisted as unassigned.
                    if user_id is not None and user_id < 0:
                        user_id = None

                    # Simulated rooms (negative room_id) or missing (ONLINE) must be mapped to a real DB room.
                    if room_id is None or (room_id is not None and room_id <= 0):
                        room_id = virtual_room_id

                    # If room is still unknown, we cannot persist this row reliably.
                    if room_id is None:
                        skipped_missing_room += 1
                        continue

                    rows.append((
                        user_id,
                        e.get("lecturer_name_snapshot"),
                        slot_id,
                        course_id,
                        result_timetable_id,
                        room_id,
                        e.get("registered_students", 0),
                        str(e.get("section_number", "1")),
                    ))

                if rows:
                    execute_values(
                        cur,
                        """
                        INSERT INTO section_schedule_entry
                          (user_id, lecturer_name_snapshot, slot_id, course_id,
                           timetable_id, room_id, registered_students, section_number)
                        VALUES %s
                        """,
                        rows,
                    )
                else:
                    raise ValueError(
                        "Scenario run produced 0 persistable schedule rows "
                        f"(input entries={len(entries)}, "
                        f"missing_core_fk={skipped_missing_core_fk}, "
                        f"missing_room={skipped_missing_room})."
                    )
            else:
                raise ValueError(
                    "Scenario run produced no schedule entries in optimizer output."
                )

            # ── 4. Insert timetable metrics ──
            metrics = gwo_result.get("metrics", {})
            if metrics:
                room_utilization_rate = _to_numeric_5_2(metrics.get("roomUtilizationRate", 0))
                soft_constraints_score = _to_numeric_5_2(metrics.get("softConstraintsScore", 0))
                fitness_score = _to_numeric_5_2(metrics.get("fitnessScore", 0))
                cur.execute(
                    """
                    INSERT INTO timetable_metrics
                      (timetable_id, room_utilization_rate,
                       soft_constraints_score, fitness_score, is_valid)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (timetable_id) DO UPDATE SET
                      room_utilization_rate  = EXCLUDED.room_utilization_rate,
                      soft_constraints_score = EXCLUDED.soft_constraints_score,
                      fitness_score          = EXCLUDED.fitness_score,
                      is_valid               = EXCLUDED.is_valid
                    """,
                    (
                        result_timetable_id,
                        room_utilization_rate,
                        soft_constraints_score,
                        fitness_score,
                        metrics.get("isValid", False),
                    ),
                )

            # ── 5. Insert conflict records ──
            conflicts = gwo_result.get("conflicts", [])
            if conflicts:
                conflict_rows = [
                    (
                        result_timetable_id,
                        c.get("conflict_type", "unknown"),
                        c.get("severity", "warning"),
                        c.get("course_code", ""),
                        c.get("section_number", ""),
                        c.get("lecturer_name"),
                        c.get("room_number"),
                        c.get("timeslot_label"),
                        c.get("detail", ""),
                    )
                    for c in conflicts
                ]
                execute_values(
                    cur,
                    """
                    INSERT INTO timetable_conflict
                      (timetable_id, conflict_type, severity, course_code,
                       section_number, lecturer_name, room_number,
                       timeslot_label, detail)
                    VALUES %s
                    """,
                    conflict_rows,
                )

            # ── 6. Link to scenario via scenario_produces_timetable ──
            cur.execute(
                """
                INSERT INTO scenario_produces_timetable (timetable_id, scenario_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
                """,
                (result_timetable_id, gwo_result.get("scenario_id")),
            )

        conn.commit()
        return result_timetable_id

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="What-If Scenario Runner")
    parser.add_argument("--config", required=True, help="Path to the run config JSON")
    args = parser.parse_args()

    # ── Load config ──────────────────────────────────────────────────────────
    try:
        with open(args.config, "r", encoding="utf-8") as f:
            config: Dict = json.load(f)
    except Exception as exc:
        emit_error(f"Failed to read config file: {exc}")
        return 1

    run_id        = config["run_id"]
    scenario_id   = config["scenario_id"]
    base_tt_id    = config["base_timetable_id"]
    semester_id   = config.get("semester_id")
    gwo_script    = config.get("gwo_script_path", "GWO-v6.py")
    database_url  = config.get("database_url") or os.environ.get("DATABASE_URL", "")
    conditions    = config.get("conditions", [])
    timetable_data = config.get("timetable_data", {})
    baseline_metrics = config.get("baseline_metrics", {})
    t_start       = time.perf_counter()

    emit("progress", phase="cloning", pct=5,
         message="Initialising what-if sandbox...")

    # ── Phase 1: Deep-clone timetable data ──────────────────────────────────
    emit("progress", phase="cloning", pct=10,
         message="Deep-cloning timetable into isolated sandbox...")

    sandbox: Dict = copy.deepcopy(timetable_data)

    emit("progress", phase="cloning", pct=20,
         message=f"Sandbox ready — applying {len(conditions)} condition(s)...")

    # ── Phase 2: Apply conditions ────────────────────────────────────────────
    apply_conditions(sandbox, conditions)

    emit("progress", phase="conditions", pct=35,
         message="All conditions applied. Building GWO input config...")

    # ── Phase 3: Write mutated config for GWO ───────────────────────────────
    # Build the config structure that GWO-v6.py expects.
    # Adjust the keys below if your GWO script uses different field names.
    gwo_input_config = {
        "run_id": run_id,
        "scenario_id": scenario_id,
        "base_timetable_id": base_tt_id,
        "semester_id": semester_id,
        "is_summer": config.get("is_summer", False),
        "lecturers": sandbox.get("lecturers", []),
        "rooms": sandbox.get("rooms", []),
        "courses": sandbox.get("courses", []),
        "timeslots": sandbox.get("timeslots", []),
        # Seed GWO with the existing entries — unassigned ones have no slot_id/room_id
        "existing_assignments": sandbox.get("existing_entries", []),
        "mode": "what_if",
    }

    tmp_dir = tempfile.mkdtemp(prefix=f"whatif_{run_id}_")
    gwo_config_path = os.path.join(tmp_dir, "gwo_input.json")
    gwo_output_path = os.path.join(tmp_dir, "gwo_output.json")

    with open(gwo_config_path, "w", encoding="utf-8") as f:
        json.dump(gwo_input_config, f, ensure_ascii=False)

    emit("progress", phase="gwo", pct=38,
         message="GWO input config written. Launching optimizer...")

    # ── Phase 4: Run GWO ─────────────────────────────────────────────────────
    # Legacy GWO-v6.py reads frontend/data/config.json and ignores --config.
    # Write a per-run config snapshot so scenario runs use the sandbox data.
    legacy_config_path = os.path.normpath(
        os.path.join(os.path.dirname(os.path.abspath(gwo_script)), "..", "data", "config.json")
    )
    legacy_backup: Optional[str] = None
    legacy_existing_config: Optional[Dict[str, Any]] = None
    try:
        if os.path.exists(legacy_config_path):
            with open(legacy_config_path, "r", encoding="utf-8") as f:
                legacy_backup = f.read()
            try:
                legacy_existing_config = json.loads(legacy_backup)
            except Exception:
                legacy_existing_config = None
        os.makedirs(os.path.dirname(legacy_config_path), exist_ok=True)
        with open(legacy_config_path, "w", encoding="utf-8") as f:
            json.dump(
                _build_legacy_gwo_config(config, sandbox, legacy_existing_config),
                f,
                ensure_ascii=False,
                indent=2,
            )

        gwo_result = run_gwo(gwo_script, gwo_config_path, gwo_output_path, run_id)
    finally:
        try:
            if legacy_backup is None:
                if os.path.exists(legacy_config_path):
                    os.remove(legacy_config_path)
            else:
                with open(legacy_config_path, "w", encoding="utf-8") as f:
                    f.write(legacy_backup)
        except Exception:
            # Non-fatal restore issue; run result handling should continue.
            pass

    if gwo_result is None:
        # Error already emitted inside run_gwo
        return 1

    gwo_result["scenario_id"] = scenario_id

    emit("progress", phase="validating", pct=93,
         message="GWO complete. Validating constraints...")

    # ── Phase 5: Save result timetable to DB ─────────────────────────────────
    emit("progress", phase="computing_metrics", pct=96,
         message="Saving sandbox timetable to database...")

    if not database_url:
        emit_error(
            "DATABASE_URL not configured.",
            detail="Set DATABASE_URL in the environment or include it in the run config.",
        )
        return 1

    normalized_direct = _normalize_gwo_result_shape(
        gwo_result,
        config.get("timetable_data", {}) or {},
    )
    direct_entries = normalized_direct.get("schedule_entries", []) or []

    # Legacy GWO variants often emit useful schedule rows via send_schedule.py
    # even when their direct JSON output is missing/partial. Prefer non-empty data.
    fallback_ui = _load_ui_schedule_result(gwo_script, gwo_config_path)
    fallback_entries = (
        (fallback_ui or {}).get("schedule_entries", [])
        if isinstance(fallback_ui, dict)
        else []
    ) or []

    fallback_text = _load_schedule_output_result(gwo_script, gwo_config_path)
    fallback_text_entries = (
        (fallback_text or {}).get("schedule_entries", [])
        if isinstance(fallback_text, dict)
        else []
    ) or []

    result_for_persistence = normalized_direct
    if direct_entries:
        # Keep direct output when it already contains persistable entries.
        result_for_persistence = normalized_direct
    elif fallback_ui and fallback_entries:
        result_for_persistence = fallback_ui
    elif fallback_text and fallback_text_entries:
        result_for_persistence = fallback_text

    try:
        result_timetable_id = save_result_timetable(
            database_url=database_url,
            base_timetable_id=base_tt_id,
            # Scenario outputs are always drafts until an explicit publish action.
            semester_id=None,
            gwo_result=result_for_persistence,
        )
    except Exception as exc:
        # Last-chance recovery: if the selected payload couldn't be persisted,
        # retry with the other payload (direct vs UI fallback) before failing.
        candidates: List[Dict[str, Any]] = []
        for c in [normalized_direct, fallback_ui, fallback_text]:
            if isinstance(c, dict) and (c.get("schedule_entries") or []):
                if c is not result_for_persistence:
                    candidates.append(c)
        recovered_ok = False
        for candidate in candidates:
            try:
                result_timetable_id = save_result_timetable(
                    database_url=database_url,
                    base_timetable_id=base_tt_id,
                    semester_id=None,
                    gwo_result=candidate,
                )
                gwo_result = candidate
                recovered_ok = True
                break
            except Exception:
                continue
        if not recovered_ok:
            emit_error(
                "Failed to save result timetable.",
                detail=traceback.format_exc(),
            )
            return 1

    generation_seconds = round(time.perf_counter() - t_start, 2)

    # ── Phase 6: Emit final result ────────────────────────────────────────────
    result_metrics = gwo_result.get("metrics", {})

    emit(
        "result",
        phase="done",
        pct=100,
        message="Simulation complete — results ready.",
        run_id=run_id,
        result_timetable_id=result_timetable_id,
        baseline_metrics=baseline_metrics,
        result_metrics={
            "conflicts": len(gwo_result.get("conflicts", [])),
            "roomUtilizationRate":   result_metrics.get("roomUtilizationRate", 0),
            "softConstraintsScore":  result_metrics.get("softConstraintsScore", 0),
            "fitnessScore":          result_metrics.get("fitnessScore", 0),
            "lecturerBalanceScore":  result_metrics.get("lecturerBalanceScore", 0),
            "isValid":               result_metrics.get("isValid", False),
        },
        gwo_iterations_run=gwo_result.get("iterations_run", 0),
        generation_seconds=generation_seconds,
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
