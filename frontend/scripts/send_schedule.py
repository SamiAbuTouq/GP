
"""
send_schedule.py  (v6 — supports delivery_mode, session_type, structured timeslots,
                         study-plan units, student gap warnings, early Thursday warnings)
-------------------------------------------------------------------------------------
Call this at the end of your GWO script to push the result to the web UI.

Usage (bottom of GWO-v5.py):
    from send_schedule import send_to_ui
    send_to_ui(
        best_schedule,
        LECTURES,
        ROOM_NAMES,
        TIMESLOTS,
        LECTURERS,
        timeslots_data=TIMESLOTS_DATA,
        room_types=ROOM_TYPES,
        study_plan_units=STUDY_PLAN_UNITS,
        ...
    )
"""

import urllib.request
import urllib.error
import json
import os
from datetime import datetime, timezone

import numpy as np

# Prefer env so a dev server on another port still receives the POST; fallback uses 127.0.0.1 (reliable on Windows vs ::1).
API_URL = os.environ.get(
    "SCHEDULE_API_URL",
    "http://127.0.0.1:3000/api/schedule",
)

# BUG FIX 3: Define full defaults at module level so the merge is always applied
# regardless of whether the caller passes soft_weights or not.
_DEFAULT_SOFT_WEIGHTS = {
    "preferred_timeslot":     80,
    "unpreferred_timeslot":   70,
    "minimize_gaps":          60,
    "room_utilization":       90,
    "balanced_workload":      50,
    "distribute_classes":     65,
    "student_gaps":           70,
    "single_session_day":     50,
}


def _fmt_hour_label(h: float) -> str:
    hh = int(h)
    mm = int(round((h - hh) * 60)) % 60
    return f"{hh:02d}:{mm:02d}"


def timeslot_label_from(ts_data: dict) -> str:
    """Human-readable label for UI (matches frontend derivedTimeslotLabel)."""
    if ts_data.get("label"):
        return str(ts_data["label"])
    days = ts_data.get("days") or []
    day_part = "/".join(d[:3] for d in days) if days else "—"
    sh = float(ts_data.get("start_hour", 0))
    dur = float(ts_data.get("duration", 1.5))
    return f"{day_part} {_fmt_hour_label(sh)}–{_fmt_hour_label(sh + dur)}"


def _room_compatible_with_slot(room_type: str, slot_type: str) -> bool:
    """Whether a room of this type may be scheduled in a timeslot with this engine slot_type."""
    rt = (room_type or "any").strip().lower()
    st = (slot_type or "lecture_mw").strip().lower()
    if rt in ("any", ""):
        return True
    if rt == "lab_room":
        return st == "lab"
    if rt == "lecture_hall":
        return st != "lab"
    return True


def _slot_day_count(ts_data: dict) -> int:
    days = ts_data.get("days") or []
    return max(len(days), 1)


def convert_to_native(obj):
    if isinstance(obj, dict):
        return {k: convert_to_native(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_native(item) for item in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.bool_):
        return bool(obj)
    return obj


def send_to_ui(
    best_wolf,
    lectures,
    rooms,
    timeslots,
    lecturers,
    # ── v6 parameters ──────────────────────────────────────────────────────────
    timeslots_data=None,      # list of structured timeslot dicts
    room_types=None,          # list of room type strings matching `rooms`
    # ── NEW: study plan / student constraint data ──────────────────────────────
    study_plan_units=None,    # dict[unit_id -> list[course_code]]
    # ── Existing parameters ────────────────────────────────────────────────────
    days=None,
    iterations=None,
    wolves=None,
    best_fitness=None,
    lecturer_preferences=None,
    rooms_dict=None,
    max_classes_per_lecturer=5,
    validation_result=None,
    soft_weights=None,
):
    """Send the optimised schedule (including delivery modes and lab sessions) to the UI."""

    # ── Defaults ───────────────────────────────────────────────────────────────
    if days is None:
        days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]
    if lecturer_preferences is None:
        lecturer_preferences = {}
    if rooms_dict is None:
        rooms_dict = {r: 0 for r in rooms}
    if validation_result is None:
        validation_result = {}
    if study_plan_units is None:
        study_plan_units = {}

    # BUG FIX 3: Always deep-merge with defaults so the new keys are guaranteed
    # to exist even if the caller passes an old-style soft_weights dict.
    if soft_weights is None:
        soft_weights = dict(_DEFAULT_SOFT_WEIGHTS)
    else:
        soft_weights = {k: int(v) for k, v in {**_DEFAULT_SOFT_WEIGHTS, **soft_weights}.items()}

    # Fall back to stub dicts if no structured data provided (legacy compat)
    if timeslots_data is None:
        timeslots_data = [
            {"id": t, "days": ["Monday", "Wednesday"],
             "start_hour": float(i), "duration": 1.5, "slot_type": "lecture_mw"}
            for i, t in enumerate(timeslots)
        ]
    if room_types is None:
        room_types = ["any"] * len(rooms)

    room_caps = [rooms_dict.get(r, 0) for r in rooms]

    schedule      = []
    lecturer_load = {}
    lecturer_courses = {}
    preference_warnings = []

    for i, lec in enumerate(lectures):
        base  = i * 3
        r_idx = int(best_wolf[base])     % len(rooms)
        t_idx = int(best_wolf[base + 1]) % len(timeslots_data)
        l_idx = int(best_wolf[base + 2]) % len(lecturers)

        room_name      = rooms[r_idx]
        ts_data        = timeslots_data[t_idx]
        timeslot_id    = ts_data["id"]
        lecturer_name  = lecturers[l_idx]
        course_code    = lec.get("course_code", lec.get("course", "UNKNOWN"))
        course_size    = lec.get("size", 0)
        room_cap       = room_caps[r_idx]
        allowed_ids    = lec.get("allowed_lecturers", [])
        allowed_names  = [lecturers[x] for x in allowed_ids if x < len(lecturers)]

        delivery_mode  = lec.get("delivery_mode", "inperson")
        session_type   = lec.get("session_type",  "lecture")
        requires_room  = delivery_mode != "online"
        ts_label       = timeslot_label_from(ts_data)
        room_display   = room_name if requires_room else None
        room_type_val  = room_types[r_idx] if requires_room else "none"

        # Preference issues
        prefs = lecturer_preferences.get(lecturer_name, {})
        pref_issues = []
        if timeslot_id in prefs.get("unpreferred", []):
            pref_issues.append(f"assigned to unpreferred timeslot {timeslot_id}")
            preference_warnings.append({
                "lecturer": lecturer_name,
                "course": course_code,
                "timeslot": timeslot_id,
                "reason": "assigned to unpreferred timeslot",
                "severity": "unpreferred",
            })
        if prefs.get("preferred") and timeslot_id not in prefs["preferred"]:
            pref_issues.append(f"not in preferred timeslots {prefs['preferred']}")
            preference_warnings.append({
                "lecturer": lecturer_name,
                "course": course_code,
                "timeslot": timeslot_id,
                "reason": "not assigned to a preferred timeslot",
                "severity": "not_preferred",
            })

        lecturer_load[lecturer_name]   = lecturer_load.get(lecturer_name, 0) + 1
        lecturer_courses.setdefault(lecturer_name, []).append(course_code)

        schedule.append({
            # ── Identifiers ────────────────────────────────────────────────────
            "lecture_id":         lec.get("id", lec.get("lecture_id", f"lecture_{i}")),
            "course_code":        course_code,
            "course_name":        lec.get("course_name", lec.get("name", "Unknown Course")),
            # ── Delivery / session info ────────────────────────────────────────
            "delivery_mode":      delivery_mode,
            "session_type":       session_type,
            "room_required":      requires_room,
            "requires_room":      requires_room,
            # ── Timeslot info ──────────────────────────────────────────────────
            "timeslot":           timeslot_id,
            "timeslot_label":     ts_label,
            "slot_type":          ts_data.get("slot_type", "lecture_mw"),
            "days":               ts_data.get("days", []),
            "start_hour":         ts_data.get("start_hour", 0.0),
            "duration":           ts_data.get("duration", 1.5),
            # ── Room info ─────────────────────────────────────────────────────
            "room":               room_display,
            "room_type":          room_type_val,
            "room_capacity":      room_cap if requires_room else 0,
            # ── Lecturer / class ──────────────────────────────────────────────
            "class_size":         course_size,
            "lecturer":           lecturer_name,
            "allowed_lecturers":  allowed_names,
            # ── Warnings ─────────────────────────────────────────────────────
            "preference_issues":  pref_issues,
            "has_pref_warning":   len(pref_issues) > 0,
            # Legacy day field
            "day":                ts_data["days"][0] if ts_data.get("days") else days[0],
        })

    # ── Lecturer summary ───────────────────────────────────────────────────────
    lecturer_summary = []
    for name in lecturers:
        load      = lecturer_load.get(name, 0)
        prefs     = lecturer_preferences.get(name, {})
        courses   = lecturer_courses.get(name, [])
        overloaded = load > max_classes_per_lecturer
        lec_warnings = [w for w in preference_warnings if w["lecturer"] == name]
        lecturer_summary.append({
            "name":              name,
            "teaching_load":     load,
            "max_load":          max_classes_per_lecturer,
            "overloaded":        overloaded,
            "courses":           courses,
            "preferred_slots":   prefs.get("preferred", []),
            "unpreferred_slots": prefs.get("unpreferred", []),
            "warning_count":     len(lec_warnings),
            "warnings":          lec_warnings,
        })

    # ── Room summary ──────────────────────────────────────────────────────────
    total_capacity  = sum(rooms_dict.get(r, 0) for r in rooms)
    total_enrolled  = sum(lec.get("size", 0) for lec in lectures
                          if lec.get("delivery_mode", "inperson") != "online")
    room_util_pct   = round(100 * total_enrolled / total_capacity, 1) if total_capacity else 0

    util_info = validation_result.get("utilization_info", [])
    room_wasted: dict = {}
    room_waste_pcts: dict = {}
    for u in util_info:
        rn = u.get("room", "")
        ws = u.get("wasted_seats", u.get("capacity", 0) - u.get("class_size", 0))
        room_wasted[rn] = room_wasted.get(rn, 0) + ws
        room_waste_pcts.setdefault(rn, []).append(u.get("waste_pct", 100.0))

    ts_by_id = {str(t.get("id")): t for t in timeslots_data if t.get("id") is not None}

    room_summary = []
    for idx, r in enumerate(rooms):
        room_type_rt = room_types[idx] if idx < len(room_types) else "any"
        compatible_ts = [
            t
            for t in timeslots_data
            if _room_compatible_with_slot(room_type_rt, t.get("slot_type", "lecture_mw"))
        ]
        # Physical room–period capacity: each catalogue row may cover multiple calendar days (e.g. MW).
        total_slot_units = sum(_slot_day_count(t) for t in compatible_ts)
        used_slot_units = 0
        for e in schedule:
            if e.get("room") != r:
                continue
            tid = e.get("timeslot")
            ts_row = ts_by_id.get(str(tid)) if tid is not None else None
            if ts_row is not None:
                used_slot_units += _slot_day_count(ts_row)
            else:
                used_slot_units += 1
        room_summary.append({
            "name":               r,
            "room_type":          room_type_rt,
            "capacity":           rooms_dict.get(r, 0),
            "used_slots":         used_slot_units,
            "total_slots":        total_slot_units,
            "total_wasted_seats": room_wasted.get(
                r, rooms_dict.get(r, 0) * total_slot_units
            ),
            "avg_waste_pct":      round(
                sum(room_waste_pcts.get(r, [100.0])) / max(len(room_waste_pcts.get(r, [100.0])), 1),
                1
            ),
        })

    # ── Session type counts ───────────────────────────────────────────────────
    session_counts = {
        "inperson_lectures": sum(1 for l in lectures
                                 if l.get("delivery_mode","inperson")=="inperson"
                                 and l.get("session_type","lecture")=="lecture"),
        "online_lectures":   sum(1 for l in lectures if l.get("delivery_mode","inperson")=="online"),
        "blended_lectures":  sum(1 for l in lectures if l.get("delivery_mode","inperson")=="blended"),
        "lab_sessions":      sum(1 for l in lectures if l.get("session_type","lecture")=="lab"),
    }

    # ── Soft constraint data from validation_result ────────────────────────────
    gap_warnings_raw = validation_result.get("gap_warnings", [])
    gap_warnings = []
    for g in gap_warnings_raw:
        gh = g.get("gap_hours", g.get("gap", 0))
        gap_warnings.append({
            "lecturer": g.get("lecturer", ""),
            "between":  g.get("between", ""),
            "gap_hours": gh,
            "gap":       gh,
        })

    wrong_slot_type_violations = validation_result.get(
        "invalid_timeslot_types",
        validation_result.get("wrong_slot_type_violations", []),
    )
    utilization_info     = validation_result.get("utilization_info", [])
    workload_info        = validation_result.get("workload_info", [])
    distribution_info    = validation_result.get("distribution_info", [])
    workload_penalty     = validation_result.get("workload_penalty", 0)
    distribution_penalty = validation_result.get("distribution_penalty", 0)
    total_conflicts      = validation_result.get("total_conflicts", 0)

    # Share of all catalog room×timeslot seat capacity that is filled (higher is better).
    # Contrasts with metadata["utilization_pct"], which is total_enrolled / sum(room caps)
    # (no timeslot dimension).
    _seat_slot_capacity = sum(int(u.get("capacity", 0) or 0) for u in utilization_info)
    _seat_slots_wasted = sum(
        int(u.get("wasted_seats", (u.get("capacity", 0) or 0) - (u.get("class_size", 0) or 0)))
        for u in utilization_info
    )
    timetable_seat_utilization_pct = (
        round(100.0 * (1.0 - (_seat_slots_wasted / _seat_slot_capacity)), 1)
        if _seat_slot_capacity > 0
        else 0.0
    )

    # ── NEW: Study-plan data ───────────────────────────────────────────────────
    unit_conflict_violations = validation_result.get("unit_conflict_violations", [])
    student_gap_warnings     = validation_result.get("student_gap_warnings", [])
    single_session_day_warnings  = validation_result.get("single_session_day_warnings", [])

    # Build a UI-friendly per-unit summary
    study_plan_summary = []
    for unit_id, courses in study_plan_units.items():
        conflict_count   = sum(1 for v in unit_conflict_violations if v.get("unit") == unit_id)
        gap_count        = sum(1 for g in student_gap_warnings      if g.get("unit") == unit_id)
        single_day_count  = sum(1 for w in single_session_day_warnings   if w.get("unit") == unit_id)
        study_plan_summary.append({
            "unit_id":         unit_id,
            "courses":         courses,
            "conflict_count":  conflict_count,
            "gap_count":       gap_count,
            "single_session_day_count": single_day_count,
        })

    # ── Build payload ─────────────────────────────────────────────────────────
    generated_at = datetime.now(timezone.utc).isoformat()
    payload_data = convert_to_native({
        "schedule": schedule,
        "metadata": {
            "total_lectures":            len(schedule),
            "total_rooms":               len(rooms),
            "total_timeslots":           len(set(s["timeslot"] for s in schedule)),
            "total_lecturers":           len(set(s["lecturer"] for s in schedule)),
            "conflicts":                 total_conflicts,
            "iterations":                iterations,
            "wolves":                    wolves,
            "best_fitness":              best_fitness,
            "generated_at":              generated_at,
            "soft_preference_warnings":  len(preference_warnings),
            "gap_warnings":              len(gap_warnings),
            "overload_violations":       sum(1 for ls in lecturer_summary if ls["overloaded"]),
            "max_classes_per_lecturer":  max_classes_per_lecturer,
            "total_capacity":            total_capacity,
            "total_enrolled":            total_enrolled,
            "utilization_pct":           room_util_pct,
            "timetable_seat_utilization_pct": timetable_seat_utilization_pct,
            "workload_penalty":          workload_penalty,
            "distribution_penalty":      distribution_penalty,
            "soft_weights":              soft_weights,
            # NEW summary counters for the dashboard
            "unit_conflict_count":   len(unit_conflict_violations),
            "student_gap_count":     len(student_gap_warnings),
            "single_session_day_count":  len(single_session_day_warnings),
            **session_counts,
        },
        "lecturer_summary":    lecturer_summary,
        "preference_warnings": preference_warnings,
        "room_summary":        room_summary,
        "lecturer_preferences": {
            name: {
                "preferred":   prefs.get("preferred", []),
                "unpreferred": prefs.get("unpreferred", []),
            }
            for name, prefs in lecturer_preferences.items()
        },
        # Soft constraint detail
        "gap_warnings":       gap_warnings,
        "utilization_info":   utilization_info,
        "workload_info":      workload_info,
        "distribution_info":  distribution_info,
        "soft_weights":       soft_weights,
        # v6: timeslot catalogue and room type info
        "timeslots_catalogue":      timeslots_data,
        "room_types_map":           {r: rt for r, rt in zip(rooms, room_types)},
        "session_counts":           session_counts,
        "wrong_slot_type_violations": wrong_slot_type_violations,
        # NEW: study plan / student constraint data
        "study_plan_units":         study_plan_units,
        "study_plan_summary":       study_plan_summary,
        "unit_conflict_violations": unit_conflict_violations,
        "student_gap_warnings":     student_gap_warnings,
        "single_session_day_warnings":  single_session_day_warnings,
    })

    payload = json.dumps(payload_data).encode("utf-8")

    # Always mirror to disk (same file Next GET reads) so the UI stays consistent even if HTTP POST is misrouted or cached.
    _data_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data"))
    _schedule_file = os.path.join(_data_dir, "schedule.json")
    os.makedirs(_data_dir, exist_ok=True)
    with open(_schedule_file, "w", encoding="utf-8") as sf:
        sf.write(json.dumps(payload_data, indent=2))

    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = json.loads(resp.read())
            print(f"[UI] Schedule sent successfully!")
            print(f"     - {body.get('count', len(schedule))} courses updated")
            print(f"     - Fitness: {best_fitness:.4f}")
            print(f"     - Hard conflicts: {total_conflicts}")
            print(f"     - Unit conflicts (study plan): {len(unit_conflict_violations)}")
            print(f"     - Student gap warnings: {len(student_gap_warnings)}")
            print(f"     - Single-session day warnings: {len(single_session_day_warnings)}")
            print(f"     - In-person: {session_counts['inperson_lectures']}  "
                  f"Online: {session_counts['online_lectures']}  "
                  f"Blended: {session_counts['blended_lectures']}  "
                  f"Labs: {session_counts['lab_sessions']}")
    except urllib.error.URLError as e:
        print(f"[UI] Could not reach UI server: {e.reason}")
        print(f"[UI] Schedule was still written to data/schedule.json")
        print(f"[UI] POST target was {API_URL} — override with SCHEDULE_API_URL if needed")
        print(f"[UI] Start Next with: npm run dev")