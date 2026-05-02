
"""
What-If Scenario System — Metrics Calculator
Computes all metrics from a (sandboxed) timetable snapshot.
All data the GWO fitness function already knows is surfaced here.
"""

from __future__ import annotations
from typing import Dict, List, Any
import statistics

from .schemas import MetricsSnapshot, MetricsDelta, ComparisonResult, ComparisonMode


# ---------------------------------------------------------------------------
# Core metric computation
# ---------------------------------------------------------------------------

def compute_metrics(schedule_entries: List[Dict[str, Any]],
                    rooms: List[Dict[str, Any]],
                    lecturers: List[Dict[str, Any]],
                    students: List[Dict[str, Any]],
                    gwo_result: Dict[str, Any]) -> MetricsSnapshot:
    """
    Compute all metrics from a completed timetable.

    Parameters
    ----------
    schedule_entries : list of dicts with keys:
        section_id, lecturer_id, room_id, timeslot_id, day, start_time, end_time,
        enrolled_count, room_capacity, building
    rooms : list of room dicts {room_id, building, capacity, room_type}
    lecturers : list of lecturer dicts {lecturer_id, max_sections}
    students : list of student-section assignments {student_id, section_id, day, start_time, end_time}
    gwo_result : dict returned by the GWO engine {fitness, hard_pct, soft_score, iterations, convergence_iter, seconds}
    """

    snap = MetricsSnapshot()

    # ── GWO algorithm stats ──────────────────────────────────────────────────
    snap.gwo_fitness_final       = gwo_result.get("fitness", 0.0)
    snap.soft_constraint_score   = gwo_result.get("soft_score", 0.0)
    snap.hard_constraint_pct     = gwo_result.get("hard_pct", 100.0)
    snap.gwo_iterations          = gwo_result.get("iterations", 0)
    snap.gwo_convergence_iter    = gwo_result.get("convergence_iter")
    snap.generation_seconds      = gwo_result.get("seconds", 0.0)
    snap.cbr_cases_used          = gwo_result.get("cbr_cases_used", 0)

    # ── Conflict counting ────────────────────────────────────────────────────
    room_conflicts, lecturer_conflicts, student_conflicts = _count_conflicts(schedule_entries)
    snap.room_conflicts     = room_conflicts
    snap.lecturer_conflicts = lecturer_conflicts
    snap.student_conflicts  = student_conflicts
    snap.total_conflicts    = room_conflicts + lecturer_conflicts + student_conflicts

    # ── Room utilization ─────────────────────────────────────────────────────
    snap.room_utilization_pct, snap.room_utilization_by_building = _room_utilization(
        schedule_entries, rooms
    )

    # ── Lecturer workload ────────────────────────────────────────────────────
    snap.lecturer_load_balance, snap.lecturer_overload_count = _workload_balance(
        schedule_entries, lecturers
    )

    # ── Student gaps ─────────────────────────────────────────────────────────
    snap.avg_student_gap_hours, snap.student_gap_total = _student_gaps(students)

    # ── Section fill rate ────────────────────────────────────────────────────
    snap.avg_section_fill_rate, snap.undersized_sections, snap.oversized_sections = _fill_rate(
        schedule_entries
    )

    return snap


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _count_conflicts(entries: List[Dict]) -> tuple[int, int, int]:
    """
    Detect overlapping assignments.
    A conflict exists when the same room / lecturer / student-group is
    scheduled in two entries that share the same day and overlapping times.
    """
    from itertools import combinations

    def overlaps(a, b) -> bool:
        same_day = a["day"] == b["day"]
        a_start, a_end = a["start_time"], a["end_time"]
        b_start, b_end = b["start_time"], b["end_time"]
        return same_day and a_start < b_end and b_start < a_end

    room_conflicts     = 0
    lecturer_conflicts = 0
    student_conflicts  = 0

    # Group entries by room and check pairs
    from collections import defaultdict
    by_room     = defaultdict(list)
    by_lecturer = defaultdict(list)
    by_section  = defaultdict(list)

    for e in entries:
        by_room[e["room_id"]].append(e)
        by_lecturer[e["lecturer_id"]].append(e)
        by_section[e["section_id"]].append(e)

    for group in by_room.values():
        for a, b in combinations(group, 2):
            if overlaps(a, b):
                room_conflicts += 1

    for group in by_lecturer.values():
        for a, b in combinations(group, 2):
            if overlaps(a, b):
                lecturer_conflicts += 1

    for group in by_section.values():
        for a, b in combinations(group, 2):
            if overlaps(a, b):
                student_conflicts += 1

    return room_conflicts, lecturer_conflicts, student_conflicts


def _room_utilization(entries: List[Dict], rooms: List[Dict]) -> tuple[float, Dict[str, float]]:
    """
    Room utilization = (total scheduled hours) / (total available hours) × 100
    Broken down by building.
    Assumes a standard working week of 5 days × 10 hours.
    """
    TOTAL_HOURS_PER_ROOM_PER_WEEK = 50.0  # 5 days × 10 hours

    used_hours: Dict[str, float] = {}      # room_id → hours
    buildings:  Dict[str, str]   = {r["room_id"]: r["building"] for r in rooms}

    for e in entries:
        rid = e["room_id"]
        start = _time_to_hours(e["start_time"])
        end   = _time_to_hours(e["end_time"])
        used_hours[rid] = used_hours.get(rid, 0.0) + max(0.0, end - start)

    if not rooms:
        return 0.0, {}

    total_available = len(rooms) * TOTAL_HOURS_PER_ROOM_PER_WEEK
    total_used      = sum(used_hours.values())
    overall_pct     = round((total_used / total_available) * 100, 2) if total_available else 0.0

    # Per building
    building_used  : Dict[str, float] = {}
    building_avail : Dict[str, int]   = {}
    for r in rooms:
        b = r["building"]
        building_avail[b] = building_avail.get(b, 0) + 1
    for rid, hrs in used_hours.items():
        b = buildings.get(rid, "Unknown")
        building_used[b] = building_used.get(b, 0.0) + hrs
    by_building = {
        b: round((building_used.get(b, 0.0) / (building_avail[b] * TOTAL_HOURS_PER_ROOM_PER_WEEK)) * 100, 2)
        for b in building_avail
    }

    return overall_pct, by_building


def _workload_balance(entries: List[Dict], lecturers: List[Dict]) -> tuple[float, int]:
    """
    Lecturer load balance = std-dev of section counts across lecturers.
    Lower std-dev = better balanced.
    Also counts lecturers who exceed their max_sections.
    """
    from collections import Counter
    max_sections = {l["lecturer_id"]: l.get("max_sections", 6) for l in lecturers}
    counts = Counter(e["lecturer_id"] for e in entries)

    if not counts:
        return 0.0, 0

    values    = list(counts.values())
    std_dev   = round(statistics.stdev(values), 3) if len(values) > 1 else 0.0
    overloads = sum(1 for lid, cnt in counts.items() if cnt > max_sections.get(lid, 6))

    return std_dev, overloads


def _student_gaps(students: List[Dict]) -> tuple[float, int]:
    """
    Student gap score = average idle hours between consecutive classes per student per day.
    students: [{student_id, day, start_time, end_time}, ...]
    """
    from collections import defaultdict
    by_student_day: Dict[tuple, List] = defaultdict(list)
    for s in students:
        key = (s["student_id"], s["day"])
        by_student_day[key].append((_time_to_hours(s["start_time"]), _time_to_hours(s["end_time"])))

    total_gap  = 0.0
    total_days = 0

    for slots in by_student_day.values():
        slots.sort()
        daily_gap = 0.0
        for i in range(1, len(slots)):
            gap = slots[i][0] - slots[i - 1][1]
            if gap > 0:
                daily_gap += gap
        total_gap  += daily_gap
        total_days += 1

    avg = round(total_gap / total_days, 3) if total_days else 0.0
    return avg, int(total_gap)


def _fill_rate(entries: List[Dict]) -> tuple[float, int, int]:
    """Section fill rate = enrolled / capacity."""
    rates = []
    undersized = oversized = 0
    seen = set()
    for e in entries:
        sid = e["section_id"]
        if sid in seen:
            continue
        seen.add(sid)
        cap     = e.get("room_capacity", 1) or 1
        enroll  = e.get("enrolled_count", 0)
        rate    = enroll / cap
        rates.append(rate)
        if rate < 0.5:
            undersized += 1
        elif rate > 0.95:
            oversized  += 1

    avg = round(sum(rates) / len(rates) * 100, 2) if rates else 0.0
    return avg, undersized, oversized


def _time_to_hours(t: str) -> float:
    """Convert 'HH:MM' string to decimal hours."""
    try:
        h, m = t.split(":")
        return int(h) + int(m) / 60
    except Exception:
        return 0.0


# ---------------------------------------------------------------------------
# Comparison builder
# ---------------------------------------------------------------------------

def build_comparison(
    mode: ComparisonMode,
    labels: List[str],
    snapshots: List[MetricsSnapshot],
    baseline_index: int = 0
) -> ComparisonResult:
    """
    Build a full ComparisonResult given a list of MetricsSnapshot objects.
    The snapshot at baseline_index is treated as the reference (baseline).

    For BEFORE_AFTER:  labels = ["Baseline", "After Scenario"]
    For CROSS_TABLE:   labels = ["Timetable A", "Timetable B", ...]
    For CROSS_SCENARIO: labels = ["Scenario A", "Scenario B", ...]
    """
    baseline = snapshots[baseline_index]

    # Which direction is "better" for each metric?
    LOWER_IS_BETTER = {
        "total_conflicts", "room_conflicts", "lecturer_conflicts", "student_conflicts",
        "lecturer_load_balance", "lecturer_overload_count",
        "avg_student_gap_hours", "student_gap_total",
        "undersized_sections", "oversized_sections",
        "generation_seconds"
    }
    HIGHER_IS_BETTER = {
        "hard_constraint_pct", "soft_constraint_score", "gwo_fitness_final",
        "room_utilization_pct", "avg_section_fill_rate", "cbr_cases_used"
    }

    # Build deltas comparing each snapshot to the baseline
    metric_fields = list(MetricsSnapshot.__fields__.keys())
    # Exclude dict/complex fields for the flat comparison table
    skip = {"room_utilization_by_building", "gwo_convergence_iter"}

    deltas: List[MetricsDelta] = []
    for field in metric_fields:
        if field in skip:
            continue
        base_val = float(getattr(baseline, field) or 0)
        # Use the first non-baseline snapshot as the "scenario" for BEFORE_AFTER
        scenario_snap = snapshots[1] if len(snapshots) > 1 else baseline
        scen_val      = float(getattr(scenario_snap, field) or 0)
        delta         = round(scen_val - base_val, 4)
        delta_pct     = round((delta / base_val * 100), 2) if base_val != 0 else 0.0

        if field in LOWER_IS_BETTER:
            direction = "better" if delta < 0 else ("worse" if delta > 0 else "neutral")
        elif field in HIGHER_IS_BETTER:
            direction = "better" if delta > 0 else ("worse" if delta < 0 else "neutral")
        else:
            direction = "neutral"

        deltas.append(MetricsDelta(
            metric_name=field,
            baseline=base_val,
            scenario=scen_val,
            delta=delta,
            delta_pct=delta_pct,
            direction=direction,
        ))

    recommendation = _generate_recommendation(baseline, scenario_snap if len(snapshots) > 1 else baseline)

    return ComparisonResult(
        mode=mode,
        columns=labels,
        deltas=deltas,
        recommendation=recommendation,
    )


def _generate_recommendation(baseline: MetricsSnapshot, scenario: MetricsSnapshot) -> str:
    """
    Rule-based recommendation text. This runs instantly without any AI call.
    """
    lines = []

    conflict_change = scenario.total_conflicts - baseline.total_conflicts
    if conflict_change < 0:
        lines.append(f"✅ Conflicts reduced by {abs(conflict_change)} — the scenario improves schedule quality.")
    elif conflict_change > 0:
        lines.append(f"⚠️ Conflicts increased by {conflict_change} — review whether this is acceptable.")
    else:
        lines.append("✅ No change in conflict count.")

    util_change = scenario.room_utilization_pct - baseline.room_utilization_pct
    if util_change > 2:
        lines.append(f"✅ Room utilization improved by {util_change:.1f}%.")
    elif util_change < -2:
        lines.append(f"⚠️ Room utilization dropped by {abs(util_change):.1f}% — some rooms may be underused.")

    if scenario.lecturer_overload_count < baseline.lecturer_overload_count:
        lines.append("✅ Fewer lecturers are overloaded — workload is more balanced.")
    elif scenario.lecturer_overload_count > baseline.lecturer_overload_count:
        lines.append("⚠️ More lecturers are overloaded — consider redistributing load.")

    if scenario.avg_student_gap_hours < baseline.avg_student_gap_hours:
        lines.append("✅ Student idle time reduced — better student experience expected.")

    if not lines:
        lines.append("ℹ️ The scenario produces results comparable to the baseline.")

    if conflict_change <= 0 and util_change >= 0:
        lines.append("💡 Recommendation: This scenario is safe to apply to production.")
    else:
        lines.append("💡 Recommendation: Review the warnings above before applying.")

    return " ".join(lines)
