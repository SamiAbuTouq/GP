# -*- coding: utf-8 -*-
import sys
import io

# Force UTF-8 encoding for stdout/stderr to avoid Windows encoding issues
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import numpy as np
import random
import time
from tqdm import tqdm
import json
import os
from typing import List, Dict, Tuple, Optional, Set
from collections import defaultdict

# =============================================================================
# DEFAULT STRUCTURED TIMESLOTS
# =============================================================================
# Each timeslot is a dict:
#   id         – unique string label sent to the UI
#   days       – list of weekdays this pattern meets
#   start_hour – float (e.g. 8.0, 9.5 = 09:30)
#   duration   – float hours per meeting
#   slot_type  – one of:
#       "lecture_mw"   regular in-person: Monday + Wednesday, 1.5 h
#       "lecture_stt"  regular in-person: Sunday + Tuesday + Thursday, 1 h
#       "blended_mon"  blended: Monday only, 1.5 h
#       "blended_wed"  blended: Wednesday only, 1.5 h
#       "blended_st"   blended: Sunday + Tuesday, 1 h
#       "lab"          lab block: single day, 3 consecutive hours
# =============================================================================
DEFAULT_TIMESLOTS_DATA = [
    # ── Regular in-person ──────────────────────────────────────────────────────
    # Monday + Wednesday, 1.5 h each meeting
    {"id": "MW_0800", "days": ["Monday", "Wednesday"], "start_hour": 8.0,  "duration": 1.5, "slot_type": "lecture_mw"},
    {"id": "MW_0930", "days": ["Monday", "Wednesday"], "start_hour": 9.5,  "duration": 1.5, "slot_type": "lecture_mw"},
    {"id": "MW_1100", "days": ["Monday", "Wednesday"], "start_hour": 11.0, "duration": 1.5, "slot_type": "lecture_mw"},
    {"id": "MW_1300", "days": ["Monday", "Wednesday"], "start_hour": 13.0, "duration": 1.5, "slot_type": "lecture_mw"},
    {"id": "MW_1430", "days": ["Monday", "Wednesday"], "start_hour": 14.5, "duration": 1.5, "slot_type": "lecture_mw"},

    # Sunday + Tuesday + Thursday, 1 h each meeting
    {"id": "STTh_0800", "days": ["Sunday", "Tuesday", "Thursday"], "start_hour": 8.0,  "duration": 1.0, "slot_type": "lecture_stt"},
    {"id": "STTh_0900", "days": ["Sunday", "Tuesday", "Thursday"], "start_hour": 9.0,  "duration": 1.0, "slot_type": "lecture_stt"},
    {"id": "STTh_1000", "days": ["Sunday", "Tuesday", "Thursday"], "start_hour": 10.0, "duration": 1.0, "slot_type": "lecture_stt"},
    {"id": "STTh_1100", "days": ["Sunday", "Tuesday", "Thursday"], "start_hour": 11.0, "duration": 1.0, "slot_type": "lecture_stt"},
    {"id": "STTh_1200", "days": ["Sunday", "Tuesday", "Thursday"], "start_hour": 12.0, "duration": 1.0, "slot_type": "lecture_stt"},

    # ── Blended ────────────────────────────────────────────────────────────────
    # Monday only, 1.5 h
    {"id": "MON_0800", "days": ["Monday"], "start_hour": 8.0,  "duration": 1.5, "slot_type": "blended_mon"},
    {"id": "MON_0930", "days": ["Monday"], "start_hour": 9.5,  "duration": 1.5, "slot_type": "blended_mon"},
    {"id": "MON_1100", "days": ["Monday"], "start_hour": 11.0, "duration": 1.5, "slot_type": "blended_mon"},
    {"id": "MON_1300", "days": ["Monday"], "start_hour": 13.0, "duration": 1.5, "slot_type": "blended_mon"},

    # Wednesday only, 1.5 h
    {"id": "WED_0800", "days": ["Wednesday"], "start_hour": 8.0,  "duration": 1.5, "slot_type": "blended_wed"},
    {"id": "WED_0930", "days": ["Wednesday"], "start_hour": 9.5,  "duration": 1.5, "slot_type": "blended_wed"},
    {"id": "WED_1100", "days": ["Wednesday"], "start_hour": 11.0, "duration": 1.5, "slot_type": "blended_wed"},
    {"id": "WED_1300", "days": ["Wednesday"], "start_hour": 13.0, "duration": 1.5, "slot_type": "blended_wed"},

    # Sunday + Tuesday, 1 h each meeting
    {"id": "ST_0800", "days": ["Sunday", "Tuesday"], "start_hour": 8.0,  "duration": 1.0, "slot_type": "blended_st"},
    {"id": "ST_0900", "days": ["Sunday", "Tuesday"], "start_hour": 9.0,  "duration": 1.0, "slot_type": "blended_st"},
    {"id": "ST_1000", "days": ["Sunday", "Tuesday"], "start_hour": 10.0, "duration": 1.0, "slot_type": "blended_st"},
    {"id": "ST_1100", "days": ["Sunday", "Tuesday"], "start_hour": 11.0, "duration": 1.0, "slot_type": "blended_st"},

    # ── Lab blocks: 3 consecutive hours ────────────────────────────────────────
    {"id": "MON_LAB_0800", "days": ["Monday"],    "start_hour": 8.0,  "duration": 3.0, "slot_type": "lab"},
    {"id": "MON_LAB_1100", "days": ["Monday"],    "start_hour": 11.0, "duration": 3.0, "slot_type": "lab"},
    {"id": "MON_LAB_1400", "days": ["Monday"],    "start_hour": 14.0, "duration": 3.0, "slot_type": "lab"},
    {"id": "TUE_LAB_0800", "days": ["Tuesday"],   "start_hour": 8.0,  "duration": 3.0, "slot_type": "lab"},
    {"id": "TUE_LAB_1100", "days": ["Tuesday"],   "start_hour": 11.0, "duration": 3.0, "slot_type": "lab"},
    {"id": "WED_LAB_0800", "days": ["Wednesday"], "start_hour": 8.0,  "duration": 3.0, "slot_type": "lab"},
    {"id": "WED_LAB_1100", "days": ["Wednesday"], "start_hour": 11.0, "duration": 3.0, "slot_type": "lab"},
    {"id": "THU_LAB_0800", "days": ["Thursday"],  "start_hour": 8.0,  "duration": 3.0, "slot_type": "lab"},
    {"id": "THU_LAB_1100", "days": ["Thursday"],  "start_hour": 11.0, "duration": 3.0, "slot_type": "lab"},
]

# Slot types that are allowed per (delivery_mode, session_type) combination
SLOT_TYPE_RULES: Dict[Tuple[str, str], List[str]] = {
    ("inperson", "lecture"): ["lecture_mw", "lecture_stt", "lecture_generic"],
    ("online",   "lecture"): ["lecture_mw", "lecture_stt", "lecture_generic", "blended_mon", "blended_wed", "blended_st", "blended_generic"],
    # BUG 1 FIX: blended lectures must use blended-type slots only (constraint 3).
    # lecture_mw / lecture_stt are regular in-person patterns and must NOT be
    # offered to blended courses.
    ("blended",  "lecture"): ["blended_mon", "blended_wed", "blended_st", "blended_generic"],
    ("inperson", "lab"):     ["lab"],
    ("online",   "lab"):     ["lab"],
    ("blended",  "lab"):     ["lab"],
}

# =============================================================================
# LOAD CONFIGURATION FROM JSON FILE
# =============================================================================
def load_config():
    """Load configuration from data/config.json file."""
    config_path = os.path.join(os.path.dirname(__file__), "..", "data", "config.json")

    default_config = {
        "rooms": {
            "LH1": {"capacity": 60, "room_type": "lecture_hall"},
            "LH2": {"capacity": 50, "room_type": "lecture_hall"},
            "LH3": {"capacity": 40, "room_type": "lecture_hall"},
            "LAB1": {"capacity": 30, "room_type": "lab_room"},
            "LAB2": {"capacity": 25, "room_type": "lab_room"},
        },
        "timeslots": DEFAULT_TIMESLOTS_DATA,
        "lecturers": ["Alice", "Bob", "Charlie", "David", "Eva", "Frank"],
        "lecturer_preferences": {
            "Alice":   {"preferred": ["MW_0800", "MW_0930"],   "unpreferred": ["MW_1430"]},
            "Bob":     {"preferred": ["STTh_1000"],            "unpreferred": ["STTh_0800"]},
            "Charlie": {"preferred": ["MW_1100", "STTh_1100"], "unpreferred": []},
            "David":   {"preferred": [],                       "unpreferred": ["STTh_1200", "MW_1430"]},
            "Eva":     {"preferred": ["MW_0800"],              "unpreferred": ["STTh_1000"]},
            "Frank":   {"preferred": ["MW_1430", "STTh_1200"],"unpreferred": ["MW_0800", "MW_0930"]},
        },
        "lectures": [
            # in-person regular lectures
            {"id": 1,  "course": "CS101",  "allowed_lecturers": [0, 2],    "size": 28, "delivery_mode": "inperson", "session_type": "lecture"},
            {"id": 2,  "course": "CS201",  "allowed_lecturers": [1, 3, 4], "size": 45, "delivery_mode": "inperson", "session_type": "lecture"},
            {"id": 3,  "course": "CS301",  "allowed_lecturers": [0, 1, 5], "size": 38, "delivery_mode": "inperson", "session_type": "lecture"},
            {"id": 4,  "course": "CS401",  "allowed_lecturers": [2, 3],    "size": 55, "delivery_mode": "inperson", "session_type": "lecture"},
            # online lectures (no room needed)
            {"id": 5,  "course": "CS102",  "allowed_lecturers": [1, 4, 5], "size": 30, "delivery_mode": "online",   "session_type": "lecture"},
            {"id": 6,  "course": "CS202",  "allowed_lecturers": [0, 3, 4], "size": 25, "delivery_mode": "online",   "session_type": "lecture"},
            # blended lectures
            {"id": 7,  "course": "CS303",  "allowed_lecturers": [2, 5],    "size": 40, "delivery_mode": "blended",  "session_type": "lecture"},
            {"id": 8,  "course": "CS403",  "allowed_lecturers": [0, 1, 2], "size": 32, "delivery_mode": "blended",  "session_type": "lecture"},
            # lab sessions (3 consecutive hours, need a lab room)
            {"id": 9,  "course": "CS101L", "allowed_lecturers": [3, 4, 5], "size": 20, "delivery_mode": "inperson", "session_type": "lab"},
            {"id": 10, "course": "CS201L", "allowed_lecturers": [1, 2, 3], "size": 22, "delivery_mode": "inperson", "session_type": "lab"},
            {"id": 11, "course": "CS301L", "allowed_lecturers": [0, 5],    "size": 18, "delivery_mode": "inperson", "session_type": "lab"},
            # more in-person
            {"id": 12, "course": "MATH101","allowed_lecturers": [1, 3, 5], "size": 48, "delivery_mode": "inperson", "session_type": "lecture"},
            {"id": 13, "course": "MATH201","allowed_lecturers": [0, 2, 4], "size": 30, "delivery_mode": "inperson", "session_type": "lecture"},
            {"id": 14, "course": "PHY101", "allowed_lecturers": [3, 4],    "size": 55, "delivery_mode": "inperson", "session_type": "lecture"},
            {"id": 15, "course": "PHY101L","allowed_lecturers": [1, 2, 5], "size": 20, "delivery_mode": "inperson", "session_type": "lab"},
        ],
        "gwo_params": {
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
        "soft_weights": {
            "preferred_timeslot":   80,
            "unpreferred_timeslot": 70,
            "minimize_gaps":        60,
            "room_utilization":     90,
            "balanced_workload":    50,
            "distribute_classes":   65,
            "student_gaps":         70,
            "single_session_day":   50,
        },
    }

    try:
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            for key in default_config:
                if key not in loaded:
                    loaded[key] = default_config[key]
            for sub in ("gwo_params", "soft_weights"):
                if sub in loaded:
                    for k in default_config[sub]:
                        if k not in loaded[sub]:
                            loaded[sub][k] = default_config[sub][k]
            return loaded
    except Exception as e:
        print(f"Warning: Could not load config.json: {e}")
        print("Using default configuration.")

    return default_config


# Load configuration
CONFIG = load_config()

# =============================================================================
# ROOM PROCESSING
# Supports two formats:
#   Legacy:  {"R1": 30, "R2": 50, ...}               (capacity only, type = "any")
#   New:     {"LH1": {"capacity": 60, "room_type": "lecture_hall"}, ...}
# =============================================================================
def _parse_rooms(raw_rooms: dict):
    names, caps, types = [], [], []
    for name, value in raw_rooms.items():
        names.append(name)
        if isinstance(value, dict):
            caps.append(int(value.get("capacity", 0)))
            types.append(value.get("room_type", "any"))
        else:
            caps.append(int(value))
            types.append("any")
    return names, caps, types


ROOM_NAMES, ROOM_CAPS, ROOM_TYPES = _parse_rooms(CONFIG["rooms"])

# =============================================================================
# TIMESLOT PROCESSING
# Supports two formats:
#   Legacy:  ["T1", "T2", ...]   (plain strings — mapped to stub dicts)
#   New:     [{"id":..., "days":..., "start_hour":..., "duration":..., "slot_type":...}, ...]
# =============================================================================
def _parse_timeslots(raw_ts):
    """Normalise timeslots to a list of dicts regardless of input format."""
    if not raw_ts:
        return DEFAULT_TIMESLOTS_DATA[:]
    if isinstance(raw_ts[0], str):
        # Legacy string list — wrap each as a generic lecture timeslot
        _BASE_HOUR, _STEP = 8.0, 1.5
        return [
            {"id": t, "days": ["Monday", "Wednesday"],
             "start_hour": _BASE_HOUR + i * _STEP,
             "duration": 1.5, "slot_type": "lecture_mw"}
            for i, t in enumerate(raw_ts)
        ]
    return raw_ts


TIMESLOTS_DATA: List[Dict] = _parse_timeslots(CONFIG["timeslots"])
TIMESLOTS: List[str] = [ts["id"] for ts in TIMESLOTS_DATA]   # kept for back-compat

# =============================================================================
# TIMESLOT OVERLAP MATRIX
# TIMESLOT_OVERLAP[i][j] = True  iff slot i and slot j share a day AND their
# time windows overlap.  Used for all conflict detection.
# =============================================================================
def _build_overlap_matrix(ts_data: List[Dict]) -> List[List[bool]]:
    n = len(ts_data)
    matrix = [[False] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                matrix[i][j] = True
                continue
            common_days = set(ts_data[i]["days"]) & set(ts_data[j]["days"])
            if not common_days:
                continue
            s1, e1 = ts_data[i]["start_hour"], ts_data[i]["start_hour"] + ts_data[i]["duration"]
            s2, e2 = ts_data[j]["start_hour"], ts_data[j]["start_hour"] + ts_data[j]["duration"]
            if s1 < e2 and s2 < e1:
                matrix[i][j] = True
    return matrix


TIMESLOT_OVERLAP: List[List[bool]] = _build_overlap_matrix(TIMESLOTS_DATA)

# Index helpers: slot_type -> [timeslot indices]
SLOT_TYPE_INDICES: Dict[str, List[int]] = {}
for _idx, _ts in enumerate(TIMESLOTS_DATA):
    SLOT_TYPE_INDICES.setdefault(_ts["slot_type"], []).append(_idx)

# =============================================================================
# LECTURERS / LECTURES / GWO PARAMS
# =============================================================================
LECTURERS            = CONFIG["lecturers"]
LECTURER_PREFERENCES = CONFIG["lecturer_preferences"]
LECTURES             = CONFIG["lectures"]

# BUG 2 FIX: per-timeslot lecturer availability (constraint 4).
# Key = lecturer name, value = list of allowed timeslot IDs (e.g. "slot_3",
# "MW_0800").  An empty list means no restriction — lecturer is available at
# all times.  Populated from DB via lecturer_availability in config.json.
LECTURER_AVAILABILITY: Dict[str, List[str]] = CONFIG.get("lecturer_availability", {})

# BUG 4 FIX: per-lecturer credit-hour teaching ceiling (constraints 8 & 11).
# Key = lecturer name, value = max total credit-hours they may be assigned.
# Falls back to MAX_CLASSES_PER_LECTURER (loaded below) when absent.
LECTURER_MAX_WORKLOAD: Dict[str, int] = {
    k: int(v) for k, v in CONFIG.get("lecturer_max_workload", {}).items()
}

# Semester mode written by the TypeScript layer before each run.
# "normal" = first/second semester timeslots; "summer" = summer timeslots.
# The timeslots list in config.json is already pre-filtered to the correct mode
# by db-schedule-config.ts — this variable is used only for logging.
SEMESTER_MODE: str = CONFIG.get("semester_mode", "normal")

gwo_params             = CONFIG.get("gwo_params", {})
NUM_WOLVES             = gwo_params.get("num_wolves", 30)
NUM_ITERATIONS         = gwo_params.get("num_iterations", 200)
# mutation_rate: per-wolf rate used during stagnation recovery (higher = more disruption)
# gene_mutation_rate: per-gene rate used inside mutate() for individual gene perturbation
MUTATION_RATE          = float(gwo_params.get("mutation_rate", 0.5))
GENE_MUTATION_RATE     = float(gwo_params.get("gene_mutation_rate", 0.15))
IMPROVEMENT_THRESHOLD  = float(gwo_params.get("improvement_threshold", 0.01))
RANDOM_FRESH_FRACTION  = float(gwo_params.get("random_fresh_fraction", 0.3))
STAGNATION_LIMIT       = gwo_params.get("stagnation_limit", 10)
NUM_RUNS               = gwo_params.get("num_runs", 5)
MAX_CLASSES_PER_LECTURER = gwo_params.get("max_classes_per_lecturer", 5)

_default_soft_weights = {
    "preferred_timeslot":     80,
    "unpreferred_timeslot":   70,
    "minimize_gaps":          60,
    "room_utilization":       90,
    "balanced_workload":      50,
    "distribute_classes":     65,
    "student_gaps":           70,   # NEW: idle time between student's consecutive lectures
    "single_session_day":     50,   # Penalise unit with only 1 session on any day (poor commute)
}
_cfg_sw = dict(CONFIG.get("soft_weights", {}))
if _cfg_sw.get("single_session_day") is None and "early_thursday_penalty" in _cfg_sw:
    _cfg_sw["single_session_day"] = _cfg_sw["early_thursday_penalty"]
SOFT_WEIGHTS = {k: int(_cfg_sw.get(k, v)) for k, v in _default_soft_weights.items()}

# =============================================================================
# LAST ALLOWED HOUR — hard cutoff for in-person and blended lectures
# Set via config key "last_allowed_hour" as an "HH:MM" string (e.g. "15:00").
# When set, any in-person or blended section whose timeslot ENDS after this
# hour is treated as a hard-constraint violation.  Online lectures are exempt.
# =============================================================================
def _parse_last_allowed_hour(raw) -> "Optional[float]":
    """Parse 'HH:MM' → float hours, or return None if not set / invalid."""
    if not raw:
        return None
    try:
        h, m = str(raw).strip().split(":")
        return int(h) + int(m) / 60.0
    except Exception:
        return None

LAST_ALLOWED_HOUR: "Optional[float]" = _parse_last_allowed_hour(
    CONFIG.get("last_allowed_hour")
)


# =============================================================================
# PER-LECTURER HELPERS — workload ceiling & timeslot availability
# (BUGs 2, 3, 4 fix)  Must be defined after MAX_CLASSES_PER_LECTURER.
# =============================================================================
def get_lecturer_max_workload(l: int) -> float:
    """Return the credit-hour teaching ceiling for lecturer index l.

    Priority:
      1. Per-lecturer value from LECTURER_MAX_WORKLOAD (DB-sourced, in credit-hours).
      2. Global MAX_CLASSES_PER_LECTURER fallback (from gwo_params).

    A value of 0 in the DB means "unavailable" — treat as 0 ceiling so any
    assignment triggers an overload penalty and the lecturer is skipped.
    """
    name = LECTURERS[l]
    val  = LECTURER_MAX_WORKLOAD.get(name)
    if val is not None:
        # 0 from DB means unavailable; keep it (any load > 0 will fire penalty)
        return float(val)
    return float(MAX_CLASSES_PER_LECTURER)


def lecturer_timeslot_available(l: int, t: int) -> bool:
    """Return True if lecturer l is available at timeslot index t.

    If the lecturer has no availability list defined (missing key or empty
    list) the function returns True — no restriction applies.
    The availability list contains timeslot ID strings (e.g. 'slot_3',
    'MW_0800') that match the IDs used in TIMESLOTS.
    """
    name  = LECTURERS[l]
    avail = LECTURER_AVAILABILITY.get(name)
    if not avail:          # None or [] → no restriction
        return True
    return TIMESLOTS[t] in avail


# =============================================================================
# COHORT GROUPS FROM programs.json (loaded once at startup)
# A cohort group is one (program + year + semester) unit.
# =============================================================================
PROGRAMS_PATH = os.path.join(os.path.dirname(__file__), "..", "programs.json")


def normalize_course_id(course_id) -> str:
    return str(course_id).strip().lower()


def load_program_cohort_groups(path: str) -> Dict[str, List[str]]:
    if not os.path.exists(path):
        print(f"Warning: programs.json not found at {os.path.abspath(path)}; cohort constraints disabled.")
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)
    except Exception as e:
        print(f"Warning: Could not load programs.json: {e}; cohort constraints disabled.")
        return {}

    cohorts: Dict[str, List[str]] = {}
    for program_name, years in payload.items():
        if not isinstance(years, dict):
            continue
        for year_name, semesters in years.items():
            if not isinstance(semesters, dict):
                continue
            for semester_name, course_ids in semesters.items():
                if not isinstance(course_ids, list):
                    continue
                cohort_id = f"{program_name} | {year_name} | {semester_name}"
                cohorts[cohort_id] = [str(c).strip() for c in course_ids]
    return cohorts


COHORT_GROUPS: Dict[str, List[str]] = load_program_cohort_groups(PROGRAMS_PATH)

# ── Derived lookups (built once at startup) ───────────────────────────────────
COURSE_TO_IDX: Dict[str, int] = {
    normalize_course_id(lec["course"]): i for i, lec in enumerate(LECTURES)
}

COHORT_TO_LECTURE_INDICES: Dict[str, List[int]] = {}
for _cohort_id, _courses in COHORT_GROUPS.items():
    _idxs: List[int] = []
    for _c in _courses:
        _idx = COURSE_TO_IDX.get(normalize_course_id(_c))
        if _idx is not None:
            _idxs.append(_idx)
    # Keep unique lecture indices per cohort, preserving file order
    COHORT_TO_LECTURE_INDICES[_cohort_id] = list(dict.fromkeys(_idxs))

LECTURE_TO_COHORTS: Dict[int, List[str]] = defaultdict(list)
for _cohort_id, _idxs in COHORT_TO_LECTURE_INDICES.items():
    for _idx in _idxs:
        LECTURE_TO_COHORTS[_idx].append(_cohort_id)

# Per-cohort pair list to enforce hard conflicts independently for each cohort.
COHORT_CONFLICT_PAIRS: List[Tuple[str, int, int]] = []
for _cohort_id, _idxs in COHORT_TO_LECTURE_INDICES.items():
    for _a in range(len(_idxs)):
        for _b in range(_a + 1, len(_idxs)):
            COHORT_CONFLICT_PAIRS.append((_cohort_id, _idxs[_a], _idxs[_b]))

# Lecture indices grouped by (delivery_mode, session_type) for local_search swaps
_BUCKET_BY_MODE: Dict[Tuple[str, str], List[int]] = {}
for _i, _lec in enumerate(LECTURES):
    _k = (_lec.get("delivery_mode", "inperson"), _lec.get("session_type", "lecture"))
    _BUCKET_BY_MODE.setdefault(_k, []).append(_i)
COMPAT_SWAP_POOLS: List[List[int]] = [idxs for idxs in _BUCKET_BY_MODE.values() if len(idxs) >= 2]

max_capacity = len(ROOM_NAMES) * len(TIMESLOTS)
PERFECT_THRESHOLD = float(gwo_params.get("perfect_threshold", 1e-6))


# =============================================================================
# HELPER: lecture-level allowed sets
# =============================================================================
def get_allowed_timeslot_indices(lec: Dict) -> List[int]:
    """Return timeslot indices valid for this lecture's delivery_mode + session_type.

    For in-person and blended lectures, timeslots whose END time exceeds
    LAST_ALLOWED_HOUR are excluded (end = start_hour + duration).
    Online lectures are not subject to the cutoff.
    """
    mode  = lec.get("delivery_mode", "inperson")
    stype = lec.get("session_type",  "lecture")
    key   = (mode, stype)
    allowed_types = SLOT_TYPE_RULES.get(key, list(SLOT_TYPE_INDICES.keys()))
    indices = []
    for st in allowed_types:
        indices.extend(SLOT_TYPE_INDICES.get(st, []))

    # Apply last-allowed-hour cutoff for physical (non-online) lectures.
    # A timeslot is excluded if its end time exceeds the cutoff.
    if LAST_ALLOWED_HOUR is not None and mode in ("inperson", "blended"):
        indices = [
            idx for idx in indices
            if (TIMESLOTS_DATA[idx]["start_hour"] + TIMESLOTS_DATA[idx]["duration"])
               <= LAST_ALLOWED_HOUR
        ]

    return indices if indices else list(range(len(TIMESLOTS_DATA)))


def get_allowed_room_indices(lec: Dict) -> List[int]:
    """
    Return room indices valid for this lecture.
    Online lectures  -> empty list (no room needed, room index is a don't-care)
    Lab sessions     -> only lab_room or any
    In-person        -> only lecture_hall or any
    Blended          -> only lecture_hall or any
    """
    mode  = lec.get("delivery_mode", "inperson")
    stype = lec.get("session_type",  "lecture")

    if mode == "online":
        return []   # no room required

    if stype == "lab":
        required_type = "lab_room"
    else:
        required_type = "lecture_hall"

    indices = [
        i for i, rt in enumerate(ROOM_TYPES)
        if rt == required_type or rt == "any"
    ]
    return indices if indices else list(range(len(ROOM_NAMES)))


def needs_room(lec: Dict) -> bool:
    """Online lectures do not need a physical room."""
    return lec.get("delivery_mode", "inperson") != "online"


# Per-lecture allowed sets (pure function of LECTURES; avoids recomputing in hot paths)
LECTURE_ALLOWED_TS: List[List[int]] = [get_allowed_timeslot_indices(lec) for lec in LECTURES]
LECTURE_ALLOWED_ROOMS: List[List[int]] = [get_allowed_room_indices(lec) for lec in LECTURES]
LECTURE_NEEDS_ROOM: List[bool] = [needs_room(lec) for lec in LECTURES]


def _repair_constraint_tightness(i: int) -> int:
    """Fewer valid (timeslot × room) combos → more constrained (online: rooms not counted as 999)."""
    n_ts = len(LECTURE_ALLOWED_TS[i])
    n_rm = len(LECTURE_ALLOWED_ROOMS[i]) if LECTURE_NEEDS_ROOM[i] else 1
    return n_ts * max(n_rm, 1)


def _repair_lecture_order() -> List[int]:
    """Most constrained first; secondary key groups cohort mates."""
    def sort_key(i: int):
        cohort_key = "|".join(sorted(LECTURE_TO_COHORTS.get(i, [])))
        return (_repair_constraint_tightness(i), cohort_key, i)

    return sorted(range(len(LECTURES)), key=sort_key)


# =============================================================================
# CONFIGURATION VALIDATION
# =============================================================================
def validate_configuration():
    issues, warnings = [], []

    if MAX_CLASSES_PER_LECTURER <= 0:
        issues.append(f"MAX_CLASSES_PER_LECTURER must be > 0, got {MAX_CLASSES_PER_LECTURER}")

    for lec in LECTURES:
        mode  = lec.get("delivery_mode", "inperson")
        stype = lec.get("session_type",  "lecture")

        # Check timeslots
        allowed_ts = get_allowed_timeslot_indices(lec)
        if not allowed_ts:
            issues.append(f"{lec['course']} ({mode}/{stype}) has no valid timeslots")

        # Check rooms (skip online)
        if needs_room(lec):
            allowed_r = get_allowed_room_indices(lec)
            if not allowed_r:
                issues.append(f"{lec['course']} ({mode}/{stype}) has no valid rooms")
            # Capacity check for labs / lectures
            feasible = [r for r in allowed_r if ROOM_CAPS[r] >= lec['size']]
            if not feasible:
                max_cap = max(ROOM_CAPS[r] for r in allowed_r) if allowed_r else 0
                issues.append(
                    f"{lec['course']} (size {lec['size']}) — no room large enough "
                    f"(max matching type cap: {max_cap})"
                )

        # Check lecturers
        if not lec.get("allowed_lecturers"):
            issues.append(f"{lec['course']} has no allowed lecturers")
        for l_idx in lec.get("allowed_lecturers", []):
            if l_idx < 0 or l_idx >= len(LECTURERS):
                issues.append(f"{lec['course']} references invalid lecturer index {l_idx}")

    n_lec = len(LECTURES)
    if n_lec / MAX_CLASSES_PER_LECTURER > len(LECTURERS):
        warnings.append(
            f"May need {n_lec/MAX_CLASSES_PER_LECTURER:.1f} lecturer-slots "
            f"but only {len(LECTURERS)} lecturers available"
        )

    return issues, warnings


# =============================================================================
# PRINT STARTUP INFO
# =============================================================================
print(
    f"GWO v6 | {len(LECTURES)} lectures | {len(ROOM_NAMES)} rooms | "
    f"{len(TIMESLOTS_DATA)} slots | {len(LECTURERS)} lecturers | "
    f"{NUM_WOLVES} wolves × {NUM_ITERATIONS} iters × {NUM_RUNS} runs | "
    f"semester: {SEMESTER_MODE}"
)

config_issues, config_warnings = validate_configuration()
if config_issues:
    print("Config errors:")
    for e in config_issues:
        print(f"  - {e}")
    print("Fix config and retry.\n")
    exit(1)
if config_warnings:
    print("Config warnings:")
    for w in config_warnings:
        print(f"  - {w}")
print("Config OK\n")


# =============================================================================
# SOFT CONSTRAINT HELPERS
# =============================================================================
def _soft(raw_penalty: float, weight_key: str) -> float:
    return raw_penalty * (SOFT_WEIGHTS[weight_key] / 100.0)


def soft_preferred_timeslot(lecturer_name: str, timeslot_id: str) -> float:
    prefs = LECTURER_PREFERENCES.get(lecturer_name, {})
    # Penalise only when the lecturer has an explicit non-empty preferred list
    # and the slot is not in it. Missing key / None / [] all mean "no preferred
    # set defined" — do not treat [] as "must match one of zero slots".
    preferred = prefs.get("preferred")
    if preferred is not None and len(preferred) > 0 and timeslot_id not in preferred:
        return _soft(1.0, "preferred_timeslot")
    return 0.0


def soft_unpreferred_timeslot(lecturer_name: str, timeslot_id: str) -> float:
    prefs = LECTURER_PREFERENCES.get(lecturer_name, {})
    if timeslot_id in prefs.get("unpreferred", []):
        return _soft(1.0, "unpreferred_timeslot")
    return 0.0


def soft_minimize_gaps(lecturer_timeslots: Dict[int, List[int]]) -> float:
    """
    Penalise dead time between a lecturer's sessions based on start_hour ordering.
    Groups sessions by day so that slots on different days don't create false gaps.
    Uses each slot's actual duration (handles heterogeneous labs/lectures correctly).
    Multi-day patterns (e.g. MW) are counted once per timeslot using a representative
    day so the same calendar gap is not double-counted on each meeting day.
    """
    total_gaps = 0.0
    for l, slot_idxs in lecturer_timeslots.items():
        if len(slot_idxs) < 2:
            continue
        # Group (start_hour, end_hour) by day — one entry per timeslot index (deduped)
        day_sessions: Dict[str, List[Tuple[float, float]]] = {}
        for t in set(slot_idxs):
            ts = TIMESLOTS_DATA[t]
            start = ts["start_hour"]
            end = start + ts["duration"]
            rep_day = ts["days"][0]
            day_sessions.setdefault(rep_day, []).append((start, end))
        # Sum gaps per day
        for day, sessions in day_sessions.items():
            if len(sessions) < 2:
                continue
            sessions_sorted = sorted(sessions, key=lambda x: x[0])
            for k in range(len(sessions_sorted) - 1):
                gap = sessions_sorted[k + 1][0] - sessions_sorted[k][1]
                if gap > 0:
                    total_gaps += gap
    return _soft(total_gaps, "minimize_gaps")


def soft_room_utilization(room_usage: List[Tuple[int, int, int]], lectures: List[Dict]) -> float:
    total_waste = 0.0
    for t, r, lec_idx in room_usage:
        cap   = ROOM_CAPS[r]
        size  = lectures[lec_idx]['size']
        waste = (cap - size) / cap
        total_waste += waste
    return _soft(total_waste, "room_utilization")


def soft_balanced_workload(lecturer_load: Dict[int, float]) -> float:
    # BUG 4 FIX: normalise against the average per-lecturer ceiling so that
    # heterogeneous limits don't distort the standard deviation scaling.
    all_loads = [lecturer_load.get(l, 0.0) for l in range(len(LECTURERS))]
    std_dev   = float(np.std(all_loads))
    max_wl    = max(
        (get_lecturer_max_workload(l) for l in range(len(LECTURERS))),
        default=float(MAX_CLASSES_PER_LECTURER),
    )
    if max_wl <= 0:
        return 0.0
    return _soft(std_dev / max_wl, "balanced_workload")


def soft_distribute_classes(timeslot_usage: Dict[int, int]) -> float:
    """Balance load within each slot_type group (lab vs lecture slots are incomparable)."""
    stds: List[float] = []
    for _stype, idxs in SLOT_TYPE_INDICES.items():
        counts = [timeslot_usage.get(t, 0) for t in idxs]
        if len(counts) < 2:
            continue
        stds.append(float(np.std(counts)))
    if not stds:
        return 0.0
    combined = float(np.mean(stds))
    return _soft(combined, "distribute_classes")


# =============================================================================
# NEW SOFT CONSTRAINTS — Student-centric
# =============================================================================

def soft_student_gaps(wolf_int: np.ndarray) -> float:
    """
    Soft constraint S7: Minimise idle time between a student's consecutive
    lectures within a day.

    Logic: For every cohort group, collect the timeslots of its courses.
    On each day where the group has more than one session, sort sessions by
    start time and sum the gaps between the end of one session and the start
    of the next.  Weighted by SOFT_WEIGHTS["student_gaps"].
    """
    total_gap = 0.0
    for cohort_id, indices in COHORT_TO_LECTURE_INDICES.items():
        if len(indices) < 2:
            continue

        # At most one session interval per course per calendar day (multi-day slots)
        day_sessions: Dict[str, Dict[int, Tuple[float, float]]] = {}
        for idx in indices:
            lec = LECTURES[idx]
            if lec.get("delivery_mode", "inperson") == "online":
                continue
            si = int(wolf_int[idx * 3 + 1]) % len(TIMESLOTS_DATA)
            ts = TIMESLOTS_DATA[si]
            span = (ts["start_hour"], ts["start_hour"] + ts["duration"])
            for day in ts["days"]:
                day_sessions.setdefault(day, {})[idx] = span

        for day, by_course in day_sessions.items():
            sessions = list(by_course.values())
            if len(sessions) < 2:
                continue
            sessions_sorted = sorted(sessions, key=lambda x: x[0])
            for k in range(len(sessions_sorted) - 1):
                gap = sessions_sorted[k + 1][0] - sessions_sorted[k][1]
                if gap > 0:
                    total_gap += gap

    return _soft(total_gap, "student_gaps")


def soft_single_session_day(wolf_int: np.ndarray) -> float:
    """
    Soft constraint S8: Penalise a cohort group that has only ONE session on
    any given day.

    If students must commute to campus for just a single lecture and then go
    home, that is a poor experience regardless of the day or time.  Each
    (cohort, day) pair with exactly one in-person session incurs one penalty unit.
    Weighted by SOFT_WEIGHTS["single_session_day"].
    """
    penalty = 0.0
    for cohort_id, indices in COHORT_TO_LECTURE_INDICES.items():
        if not indices:
            continue

        # Distinct courses touching each calendar day (multi-day slot = one course/day)
        day_courses: Dict[str, Set[int]] = {}
        for idx in indices:
            lec = LECTURES[idx]
            if lec.get("delivery_mode", "inperson") == "online":
                continue
            si = int(wolf_int[idx * 3 + 1]) % len(TIMESLOTS_DATA)
            ts = TIMESLOTS_DATA[si]
            for day in ts["days"]:
                day_courses.setdefault(day, set()).add(idx)

        for day, cset in day_courses.items():
            if len(cset) == 1:
                penalty += 1.0

    return _soft(penalty, "single_session_day")


# =============================================================================
# OVERLAP-AWARE CONFLICT DETECTION HELPERS
# =============================================================================
def lecturer_has_conflict(l: int, t: int, lecturer_assignments: Dict[int, List[int]]) -> bool:
    """True if lecturer l already has an assignment whose timeslot overlaps t."""
    for assigned_t in lecturer_assignments.get(l, []):
        if TIMESLOT_OVERLAP[t][assigned_t]:
            return True
    return False


def room_has_conflict(r: int, t: int, room_assignments: Dict[int, List[int]]) -> bool:
    """True if room r already has an assignment whose timeslot overlaps t."""
    for assigned_t in room_assignments.get(r, []):
        if TIMESLOT_OVERLAP[t][assigned_t]:
            return True
    return False


def cohorts_have_conflict(
    cohort_ids: List[str], t_cand: int, cohort_assignments: Dict[str, List[int]]
) -> bool:
    """True if t_cand overlaps any already-assigned slot in any shared cohort."""
    if not cohort_ids:
        return False
    for cohort_id in cohort_ids:
        for assigned_t in cohort_assignments.get(cohort_id, []):
            if TIMESLOT_OVERLAP[t_cand][assigned_t]:
                return True
    return False


# =============================================================================
# GWO STEP 1 — INITIALISE THE WOLF POPULATION
# =============================================================================
def greedy_init_wolf() -> List[float]:
    """Greedy forward construction: most-constrained first, conflict-aware when possible."""
    vec = [0.0] * (len(LECTURES) * 3)
    lecturer_assignments: Dict[int, List[int]] = {}
    room_assignments: Dict[int, List[int]] = {}
    cohort_assignments: Dict[str, List[int]] = {}
    for i in _repair_lecture_order():
        lec = LECTURES[i]
        allowed_ts = list(LECTURE_ALLOWED_TS[i])
        random.shuffle(allowed_ts)
        allowed_r = LECTURE_ALLOWED_ROOMS[i]
        require_room = LECTURE_NEEDS_ROOM[i]
        cohort_ids = LECTURE_TO_COHORTS.get(i, [])
        placed = False
        lecturers_shuffled = list(lec["allowed_lecturers"])
        random.shuffle(lecturers_shuffled)
        for l_cand in lecturers_shuffled:
            for t_cand in allowed_ts:
                if lecturer_has_conflict(l_cand, t_cand, lecturer_assignments):
                    continue
                if cohorts_have_conflict(cohort_ids, t_cand, cohort_assignments):
                    continue
                if not require_room:
                    vec[i * 3 : i * 3 + 3] = [0, t_cand, l_cand]
                    lecturer_assignments.setdefault(l_cand, []).append(t_cand)
                    for cohort_id in cohort_ids:
                        cohort_assignments.setdefault(cohort_id, []).append(t_cand)
                    placed = True
                    break
                cap_ok = [x for x in allowed_r if ROOM_CAPS[x] >= lec["size"]]
                for r_cand in cap_ok if cap_ok else allowed_r:
                    if room_has_conflict(r_cand, t_cand, room_assignments):
                        continue
                    vec[i * 3 : i * 3 + 3] = [r_cand, t_cand, l_cand]
                    lecturer_assignments.setdefault(l_cand, []).append(t_cand)
                    room_assignments.setdefault(r_cand, []).append(t_cand)
                    for cohort_id in cohort_ids:
                        cohort_assignments.setdefault(cohort_id, []).append(t_cand)
                    placed = True
                    break
                if placed:
                    break
            if placed:
                break
        if not placed:
            t_cand = random.choice(LECTURE_ALLOWED_TS[i])
            l_cand = random.choice(lec["allowed_lecturers"])
            if require_room and allowed_r:
                cap_ok = [x for x in allowed_r if ROOM_CAPS[x] >= lec["size"]]
                r_cand = random.choice(cap_ok if cap_ok else allowed_r)
                vec[i * 3 : i * 3 + 3] = [r_cand, t_cand, l_cand]
                lecturer_assignments.setdefault(l_cand, []).append(t_cand)
                room_assignments.setdefault(r_cand, []).append(t_cand)
            else:
                vec[i * 3 : i * 3 + 3] = [0, t_cand, l_cand]
                lecturer_assignments.setdefault(l_cand, []).append(t_cand)
            for cohort_id in cohort_ids:
                cohort_assignments.setdefault(cohort_id, []).append(t_cand)
    return vec


def random_init_wolf_vector() -> List[float]:
    wolf: List[float] = []
    for i, lec in enumerate(LECTURES):
        allowed_ts = LECTURE_ALLOWED_TS[i]
        allowed_r = LECTURE_ALLOWED_ROOMS[i]
        t_idx = random.choice(allowed_ts)
        r_idx = random.choice(allowed_r) if allowed_r else 0
        l_idx = random.choice(lec["allowed_lecturers"])
        wolf.extend([r_idx, t_idx, l_idx])
    return wolf


def init_population() -> np.ndarray:
    population = []
    for k in range(NUM_WOLVES):
        if k < max(1, NUM_WOLVES // 3):
            population.append(greedy_init_wolf())
        else:
            population.append(random_init_wolf_vector())
    return np.array(population, dtype=float)


# =============================================================================
# REPAIR — enforce hard constraints, type rules, and resolve conflicts
# =============================================================================
def repair(wolf: np.ndarray) -> np.ndarray:
    wolf = wolf.copy().astype(int)

    # Clamp raw values to valid ranges
    for i in range(len(LECTURES)):
        wolf[i*3]   = wolf[i*3]   % len(ROOM_NAMES)
        wolf[i*3+1] = wolf[i*3+1] % len(TIMESLOTS_DATA)
        wolf[i*3+2] = wolf[i*3+2] % len(LECTURERS)

    # Track assignments (room/lecturer -> list of timeslot indices)
    lecturer_assignments: Dict[int, List[int]] = {}
    room_assignments:     Dict[int, List[int]] = {}
    # Track per-cohort assigned timeslots for cohort conflict avoidance
    cohort_assignments: Dict[str, List[int]] = {}

    lecture_order = _repair_lecture_order()

    for i in lecture_order:
        lec = LECTURES[i]
        r   = int(wolf[i*3])
        t   = int(wolf[i*3+1])
        l   = int(wolf[i*3+2])

        allowed_ts = LECTURE_ALLOWED_TS[i]
        allowed_ts_sorted = sorted(allowed_ts, key=lambda idx: TIMESLOTS_DATA[idx]["start_hour"])
        allowed_r = LECTURE_ALLOWED_ROOMS[i]
        require_room = LECTURE_NEEDS_ROOM[i]

        ts_fallback = [x for x in allowed_ts if x != t]
        random.shuffle(ts_fallback)

        # Fix invalid lecturer
        if l not in lec["allowed_lecturers"]:
            l = lec["allowed_lecturers"][0]

        # Fix invalid timeslot type
        if t not in allowed_ts:
            t = allowed_ts_sorted[0]

        # Fix invalid room type (for room-requiring sessions)
        if require_room and r not in allowed_r:
            r = allowed_r[0] if allowed_r else r

        if not require_room:
            r = 0

        # Try to resolve conflicts ─────────────────────────────────────────────
        resolved = False

        cohort_ids = LECTURE_TO_COHORTS.get(i, [])

        for t_cand in ([t] if t in allowed_ts else []) + ts_fallback:
            l_conflict = lecturer_has_conflict(l, t_cand, lecturer_assignments)
            if l_conflict:
                continue

            # BUG 2 FIX: skip slots where the lecturer is not available.
            if not lecturer_timeslot_available(l, t_cand):
                continue

            # Cohort hard constraint: no overlap with same-cohort courses
            if cohorts_have_conflict(cohort_ids, t_cand, cohort_assignments):
                continue

            if not require_room:
                # Online: no room conflict check needed; room gene is sentinel 0
                t, r = t_cand, 0
                resolved = True
                break

            cap_ok = [x for x in allowed_r if ROOM_CAPS[x] >= lec["size"]]
            room_pool = cap_ok if cap_ok else allowed_r
            # Try rooms in priority: same type first, then fallback
            room_search = [x for x in room_pool if x != r] if r in room_pool else list(room_pool)
            room_search = ([r] if r in room_pool else []) + room_search

            for r_cand in room_search:
                if not room_has_conflict(r_cand, t_cand, room_assignments):
                    t, r = t_cand, r_cand
                    resolved = True
                    break
            if resolved:
                break

        # If still not resolved, try alternate lecturers
        if not resolved:
            alt_ts_order = list(allowed_ts)
            random.shuffle(alt_ts_order)
            for alt_l in lec["allowed_lecturers"]:
                if alt_l == l:
                    continue
                for t_cand in alt_ts_order:
                    if lecturer_has_conflict(alt_l, t_cand, lecturer_assignments):
                        continue
                    # BUG 2 FIX: check availability for alternate lecturer too.
                    if not lecturer_timeslot_available(alt_l, t_cand):
                        continue
                    if cohorts_have_conflict(cohort_ids, t_cand, cohort_assignments):
                        continue
                    if not require_room:
                        l, t, r = alt_l, t_cand, 0
                        resolved = True
                        break
                    cap_ok2 = [x for x in allowed_r if ROOM_CAPS[x] >= lec["size"]]
                    r_iter = cap_ok2 if cap_ok2 else allowed_r
                    for r_cand in r_iter:
                        if not room_has_conflict(r_cand, t_cand, room_assignments):
                            l, t, r = alt_l, t_cand, r_cand
                            resolved = True
                            break
                    if resolved:
                        break
                if resolved:
                    break

        if not resolved:
            # Last resort: valid (t, r, l) for this lecture type — may still conflict
            # globally; fitness will penalise. Avoid silently keeping a stale triple.
            if allowed_ts:
                t = random.choice(allowed_ts)
            l = random.choice(lec["allowed_lecturers"])
            if require_room and allowed_r:
                cap_ok3 = [x for x in allowed_r if ROOM_CAPS[x] >= lec["size"]]
                r = random.choice(cap_ok3 if cap_ok3 else allowed_r)
            elif not require_room:
                r = 0
            print(f"[warn] repair fallback: {lec['course']}")

        if not require_room:
            r = 0

        # Register assignment
        lecturer_assignments.setdefault(l, []).append(t)
        if require_room:
            room_assignments.setdefault(r, []).append(t)
        for cohort_id in cohort_ids:
            cohort_assignments.setdefault(cohort_id, []).append(t)

        wolf[i*3], wolf[i*3+1], wolf[i*3+2] = r, t, l

    return wolf.astype(float)


# =============================================================================
# GWO STEP 2 — FITNESS EVALUATION
# =============================================================================
def fitness_hard_soft(wolf: np.ndarray) -> Tuple[float, float]:
    """
    Return (hard_penalty, soft_penalty). Genes are clamped like repair() so
    evaluation matches stored integer schedules after repair().
    """
    wolf_int = wolf.astype(int).copy()
    n_r, n_t, n_lg = len(ROOM_NAMES), len(TIMESLOTS_DATA), len(LECTURERS)
    for i in range(len(LECTURES)):
        wolf_int[i * 3] = wolf_int[i * 3] % n_r
        wolf_int[i * 3 + 1] = wolf_int[i * 3 + 1] % n_t
        wolf_int[i * 3 + 2] = wolf_int[i * 3 + 2] % n_lg

    lecturer_assignments: Dict[int, List[int]] = {}
    room_assignments: Dict[int, List[int]] = {}
    lecturer_load: Dict[int, float] = {}   # BUG 3 FIX: credit-hour accumulator (float)
    lecturer_ts: Dict[int, List[int]] = {}
    timeslot_usage: Dict[int, int] = {}
    room_usage_list: List[Tuple] = []

    hard = 0.0
    pref_viol = defaultdict(int)
    unpref_viol = defaultdict(int)

    for i, lec in enumerate(LECTURES):
        r = int(wolf_int[i * 3])
        t = int(wolf_int[i * 3 + 1])
        l = int(wolf_int[i * 3 + 2])

        require_room = needs_room(lec)

        # ── Hard 1: valid lecturer ────────────────────────────────────────────
        if l not in lec["allowed_lecturers"]:
            hard += 5

        # ── Hard 1b: lecturer timeslot availability (BUG 2 FIX) ──────────────
        # Only penalise when the lecturer has a defined availability list.
        if not lecturer_timeslot_available(l, t):
            hard += 10

        # ── Hard 2: valid timeslot type ───────────────────────────────────────
        allowed_ts = LECTURE_ALLOWED_TS[i]
        if t not in allowed_ts:
            hard += 5

        # ── Hard 3: valid room type ───────────────────────────────────────────
        if require_room:
            allowed_r = LECTURE_ALLOWED_ROOMS[i]
            if r not in allowed_r:
                hard += 5

        # ── Hard 4: lecturer overlap conflict ─────────────────────────────────
        if lecturer_has_conflict(l, t, lecturer_assignments):
            hard += 20

        # ── Hard 5: room overlap conflict (in-person / blended / lab only) ────
        if require_room and room_has_conflict(r, t, room_assignments):
            hard += 20

        # ── Hard 6: room capacity ─────────────────────────────────────────────
        if require_room and ROOM_CAPS[r] < lec['size']:
            hard += 10

        # ── Hard 7: last allowed hour for in-person / blended lectures ────────
        # Timeslot end = start_hour + duration.  Online lectures are exempt.
        if LAST_ALLOWED_HOUR is not None:
            _mode = lec.get("delivery_mode", "inperson")
            if _mode in ("inperson", "blended"):
                _ts_end = TIMESLOTS_DATA[t]["start_hour"] + TIMESLOTS_DATA[t]["duration"]
                if _ts_end > LAST_ALLOWED_HOUR:
                    hard += 10

        # Register assignment (even if conflicting, so we don't keep retrying)
        lecturer_assignments.setdefault(l, []).append(t)
        if require_room:
            room_assignments.setdefault(r, []).append(t)
            room_usage_list.append((t, r, i))

        # ── Soft 1 & 2: timeslot preferences (capped per lecturer) ────────────
        lecturer_name = LECTURERS[l]
        timeslot_id = TIMESLOTS[t]
        prefs = LECTURER_PREFERENCES.get(lecturer_name, {})
        preferred = prefs.get("preferred")
        if preferred is not None and len(preferred) > 0 and timeslot_id not in preferred:
            pref_viol[l] += 1
        if timeslot_id in prefs.get("unpreferred", []):
            unpref_viol[l] += 1

        # BUG 3 FIX: accumulate credit hours instead of a raw count.
        # lec["credit_hours"] is written by db-schedule-config.ts (BUG 5 fix).
        # Falls back to 1 so legacy/test configs without the field still work.
        lecturer_load[l] = lecturer_load.get(l, 0.0) + float(lec.get("credit_hours", 1))
        lecturer_ts.setdefault(l, []).append(t)
        timeslot_usage[t] = timeslot_usage.get(t, 0) + 1

    # ── Hard 7: lecturer workload overload (BUG 4 FIX: per-lecturer ceiling) ─
    # Uses credit-hour load vs each lecturer's individual DB ceiling.
    for l, load in lecturer_load.items():
        limit = get_lecturer_max_workload(l)
        if load > limit:
            hard += (load - limit) * 8

    # ── Hard 8: cohort conflicts (program+year+semester) ─────────────────────
    for (_cohort_id, idx_a, idx_b) in COHORT_CONFLICT_PAIRS:
        ta = int(wolf_int[idx_a * 3 + 1]) % n_t
        tb = int(wolf_int[idx_b * 3 + 1]) % n_t
        if TIMESLOT_OVERLAP[ta][tb]:
            hard += 20

    soft = 0.0
    for l in set(pref_viol) | set(unpref_viol):
        # Use log(1 + n) scaling: penalises every additional violation but with
        # diminishing returns, avoiding one heavy lecturer dominating the soft score.
        if pref_viol.get(l, 0):
            soft += _soft(float(np.log1p(pref_viol[l])), "preferred_timeslot")
        if unpref_viol.get(l, 0):
            soft += _soft(float(np.log1p(unpref_viol[l])), "unpreferred_timeslot")

    soft += soft_minimize_gaps(lecturer_ts)
    soft += soft_room_utilization(room_usage_list, LECTURES)
    soft += soft_balanced_workload(lecturer_load)
    soft += soft_distribute_classes(timeslot_usage)
    soft += soft_student_gaps(wolf_int)
    soft += soft_single_session_day(wolf_int)

    return hard, soft


def fitness(wolf: np.ndarray) -> float:
    h, s = fitness_hard_soft(wolf)
    return h + s


# =============================================================================
# MUTATE / LOCAL SEARCH
# =============================================================================
def mutate(wolf: np.ndarray, mutation_rate: float = GENE_MUTATION_RATE) -> np.ndarray:
    wolf = wolf.copy()
    for i, lec in enumerate(LECTURES):
        allowed_ts = LECTURE_ALLOWED_TS[i]
        allowed_r = LECTURE_ALLOWED_ROOMS[i]
        if random.random() < mutation_rate:
            wolf[i * 3] = random.choice(allowed_r) if allowed_r else wolf[i * 3]
        if random.random() < mutation_rate:
            wolf[i * 3 + 1] = random.choice(allowed_ts)
        if random.random() < mutation_rate:
            wolf[i * 3 + 2] = random.choice(lec["allowed_lecturers"])
    return wolf


def local_search(wolf: np.ndarray, max_iterations: int = 50) -> np.ndarray:
    current = wolf.copy()
    current_fitness = fitness(current)

    for _it in range(max_iterations):
        if _it % 5 == 0:
            _wait_if_paused()
        neighbor = current.copy().astype(int)
        if random.random() < 0.5 and (COMPAT_SWAP_POOLS or len(LECTURES) >= 2):
            if COMPAT_SWAP_POOLS:
                _pool = random.choice(COMPAT_SWAP_POOLS)
                i1, i2 = random.sample(_pool, 2)
            else:
                i1, i2 = random.sample(range(len(LECTURES)), 2)
            neighbor[i1 * 3 : i1 * 3 + 3], neighbor[i2 * 3 : i2 * 3 + 3] = (
                neighbor[i2 * 3 : i2 * 3 + 3].copy(),
                neighbor[i1 * 3 : i1 * 3 + 3].copy(),
            )
        else:
            i = random.randrange(len(LECTURES))
            lec = LECTURES[i]
            gene = random.randint(0, 2)
            if gene == 1:
                neighbor[i * 3 + 1] = random.choice(LECTURE_ALLOWED_TS[i])
            elif gene == 0 and LECTURE_NEEDS_ROOM[i]:
                ar = LECTURE_ALLOWED_ROOMS[i]
                if ar:
                    neighbor[i * 3] = random.choice(ar)
            else:
                neighbor[i * 3 + 2] = random.choice(lec["allowed_lecturers"])
        neighbor = repair(neighbor.astype(float))
        neighbor_fitness = fitness(neighbor)
        if neighbor_fitness < current_fitness:
            current = neighbor
            current_fitness = neighbor_fitness

    return current


# =============================================================================
# GWO MAIN LOOP
# =============================================================================
def _ui_progress_enabled() -> bool:
    return os.environ.get("GWO_UI_PROGRESS", "").strip() == "1"


def _control_file_path() -> Optional[str]:
    p = os.environ.get("GWO_CONTROL_FILE", "").strip()
    return p if p else None


def _wait_if_paused() -> None:
    """Block while the UI control file says pause (Stop); resume writes run."""
    path = _control_file_path()
    if not path:
        return
    while True:
        try:
            if not os.path.isfile(path):
                break
            with open(path, "r", encoding="utf-8") as f:
                content = (f.read() or "").strip().lower()
            if content != "pause":
                break
        except OSError:
            break
        time.sleep(0.15)


def _emit_ui_progress_line(pbar, run_number: int, best: float) -> None:
    """One JSON line per update for the Next.js UI (parsed from stdout)."""
    if not _ui_progress_enabled() or pbar is None:
        return
    payload = {
        "current": int(pbar.n),
        "total": int(pbar.total),
        "run": run_number,
        "numRuns": NUM_RUNS,
        "best": round(float(best), 4),
    }
    print("__GWO_PROGRESS__" + json.dumps(payload), flush=True)


def gwo(run_number: int = 1, pbar=None) -> Tuple[np.ndarray, float, List[float]]:
    population = init_population()
    population = np.array([repair(w) for w in population])
    scores     = np.array([fitness(w) for w in population])

    sorted_idx  = np.argsort(scores)
    alpha       = population[sorted_idx[0]].copy()
    beta        = population[sorted_idx[1]].copy()
    delta       = population[sorted_idx[2]].copy()
    alpha_score = scores[sorted_idx[0]]
    beta_score  = scores[sorted_idx[1]]
    delta_score = scores[sorted_idx[2]]

    stagnation_counter = 0
    prev_alpha_score   = alpha_score
    convergence_curve  = []

    print(f"Run {run_number}/{NUM_RUNS} | start {alpha_score:.4f}")

    for iteration in range(NUM_ITERATIONS):
        _wait_if_paused()

        # ── Adaptive `a` parameter (mirrors standard GWO: a decreases 2→0) ──────
        # Controls exploration (high a, early) vs exploitation (low a, late).
        # We map `a` to the alpha-weight: starts at 0.33 (equal share) and
        # rises to 0.70 (strong convergence on best solution) as a → 0.
        #   a(t) = 2 * (1 - t / T)
        #   alpha_w(t) = 0.33 + 0.37 * (1 - a(t)/2)  → [0.33, 0.70]
        #   beta_w(t)  = alpha_w + 0.30 * (a(t)/2)    → decreasing β share
        a_param    = 2.0 * (1.0 - iteration / max(NUM_ITERATIONS - 1, 1))
        alpha_w    = 0.33 + 0.37 * (1.0 - a_param / 2.0)   # 0.33 → 0.70
        beta_w     = alpha_w + 0.30 * (a_param / 2.0)       # threshold for β vs δ

        # Discrete schedule encoding: each gene inherits from α / β / δ (categorical crossover).
        # Omega wolves (index >= 3) update toward leaders; elites (0,1,2) are
        # preserved from the previous iteration and only replaced by re-sorting.
        for i in range(3, len(population)):
            new_pos = population[i].copy()
            for g in range(len(new_pos)):
                roll = random.random()
                if roll < alpha_w:
                    new_pos[g] = alpha[g]
                elif roll < beta_w:
                    new_pos[g] = beta[g]
                else:
                    new_pos[g] = delta[g]
            population[i] = repair(new_pos)

        scores = np.array([fitness(w) for w in population])

        sorted_indices = np.argsort(scores)
        alpha_score = float(scores[sorted_indices[0]])
        alpha = population[sorted_indices[0]].copy()
        beta_score = float(scores[sorted_indices[1]])
        beta = population[sorted_indices[1]].copy()
        delta_score = float(scores[sorted_indices[2]])
        delta = population[sorted_indices[2]].copy()

        # Stagnation: increment only when fitness does not improve at all, OR when the
        # relative improvement is below the threshold (avoids premature restarts during
        # slow-but-steady convergence by requiring truly zero progress to accumulate).
        rel_improve = (prev_alpha_score - alpha_score) / max(prev_alpha_score, 1e-9)
        if alpha_score < prev_alpha_score and rel_improve > IMPROVEMENT_THRESHOLD:
            stagnation_counter = 0
        elif alpha_score >= prev_alpha_score:
            stagnation_counter += 1
        # else: small positive improvement — don't reset but don't penalise either
        prev_alpha_score = alpha_score

        if stagnation_counter >= STAGNATION_LIMIT:
            for i in range(len(population)):
                if random.random() < RANDOM_FRESH_FRACTION:
                    population[i] = repair(np.array(random_init_wolf_vector(), dtype=float))
                else:
                    choice = random.random()
                    base = alpha if choice < 0.33 else (beta if choice < 0.66 else delta)
                    population[i] = repair(mutate(base, MUTATION_RATE))
            population[0], population[1], population[2] = alpha.copy(), beta.copy(), delta.copy()
            stagnation_counter = 0
            print(f"  iter {iteration + 1} | stagnation recovery")

        if iteration % 20 == 0 and iteration > 0:
            refined_alpha = local_search(alpha, max_iterations=30)
            refined_score = fitness(refined_alpha)
            if refined_score < alpha_score:
                alpha = refined_alpha
                alpha_score = refined_score
                worst_idx = int(np.argmax(scores))
                population[worst_idx] = alpha.copy()
                scores[worst_idx] = alpha_score
                print(f"  iter {iteration + 1} | local search -> {alpha_score:.4f}")

        convergence_curve.append(alpha_score)

        if pbar is not None:
            pbar.set_postfix(run=f"{run_number}/{NUM_RUNS}", best=f"{alpha_score:.4f}")
            pbar.update(1)
            _emit_ui_progress_line(pbar, run_number, alpha_score)

        if (iteration + 1) % 40 == 0:
            print(
                f"  iter {iteration + 1} | best {alpha_score:.4f} | "
                f"avg {np.mean(scores):.2f} | worst {np.max(scores):.2f}"
            )

        alpha_hard, _alpha_soft = fitness_hard_soft(alpha)
        if alpha_hard == 0.0:
            print(f"  iter {iteration + 1} | all hard constraints satisfied")
            break

    if pbar is not None:
        remaining_iters = NUM_ITERATIONS - len(convergence_curve)
        if remaining_iters > 0:
            pbar.update(remaining_iters)
            _emit_ui_progress_line(pbar, run_number, alpha_score)

    _wait_if_paused()
    print("  final local search…", end=" ", flush=True)
    alpha = local_search(alpha, max_iterations=100)
    alpha_score = fitness(alpha)
    print(f"done | fitness {alpha_score:.4f}\n")
    return alpha, alpha_score, convergence_curve


# =============================================================================
# VALIDATION
# =============================================================================
def validate_schedule(schedule: np.ndarray) -> Dict:
    schedule = schedule.astype(int)

    validation = {
        'lecturer_conflicts':       [],
        'room_conflicts':           [],
        'invalid_lecturers':        [],
        'invalid_timeslot_types':   [],
        'invalid_room_types':       [],
        'capacity_violations':      [],
        'overload_violations':      [],
        'preference_warnings':      [],
        'gap_warnings':             [],
        'utilization_info':         [],
        'workload_info':            [],
        'distribution_info':        [],
        'unit_conflict_violations': [],  # NEW: study-plan hard conflicts
        'student_gap_warnings':     [],  # NEW: per-unit idle time gaps
        'single_session_day_warnings': [],  # NEW: units with only 1 session on a day
        'total_conflicts':          0,
        'is_valid':                 True,
    }

    lecturer_assignments: Dict[int, List[int]] = {}
    room_assignments:     Dict[int, List[int]] = {}
    lecturer_load:        Dict[int, float]      = {}   # BUG 3 FIX: credit-hour float
    lecturer_ts:          Dict[int, List[int]]  = {}
    timeslot_usage:       Dict[int, int]        = {}
    room_usage_list:      List[Tuple]           = []

    for i, lec in enumerate(LECTURES):
        r = schedule[i*3]   % len(ROOM_NAMES)
        t = schedule[i*3+1] % len(TIMESLOTS_DATA)
        l = schedule[i*3+2] % len(LECTURERS)

        require_room = needs_room(lec)
        allowed_ts   = get_allowed_timeslot_indices(lec)
        allowed_r    = get_allowed_room_indices(lec)

        # Hard checks
        if l not in lec["allowed_lecturers"]:
            validation['invalid_lecturers'].append({
                'lecture': lec['course'], 'assigned': LECTURERS[l],
                'allowed': [LECTURERS[x] for x in lec['allowed_lecturers']]
            })
            validation['is_valid'] = False

        if t not in allowed_ts:
            ts_data = TIMESLOTS_DATA[t]
            validation['invalid_timeslot_types'].append({
                'lecture': lec['course'],
                'assigned_type': ts_data['slot_type'],
                'delivery_mode': lec.get('delivery_mode', 'inperson'),
                'session_type':  lec.get('session_type',  'lecture'),
            })
            validation['is_valid'] = False

        if require_room and r not in allowed_r:
            validation['invalid_room_types'].append({
                'lecture': lec['course'],
                'room': ROOM_NAMES[r],
                'room_type': ROOM_TYPES[r],
                'session_type': lec.get('session_type', 'lecture'),
            })
            validation['is_valid'] = False

        # Lecturer conflict
        if lecturer_has_conflict(l, t, lecturer_assignments):
            # Find the conflicting lecture
            conflict_lec_idx = next(
                (j for j, lec2 in enumerate(LECTURES)
                 if j != i and
                 int(schedule[j*3+2]) % len(LECTURERS) == l and
                 TIMESLOT_OVERLAP[t][int(schedule[j*3+1]) % len(TIMESLOTS_DATA)]),
                -1
            )
            conflict_course = LECTURES[conflict_lec_idx]['course'] if conflict_lec_idx >= 0 else '?'
            validation['lecturer_conflicts'].append({
                'timeslot': TIMESLOTS[t], 'lecturer': LECTURERS[l],
                'courses': [lec['course'], conflict_course]
            })
            validation['is_valid'] = False

        # Room conflict
        if require_room and room_has_conflict(r, t, room_assignments):
            validation['room_conflicts'].append({
                'timeslot': TIMESLOTS[t], 'room': ROOM_NAMES[r],
                'course': lec['course']
            })
            validation['is_valid'] = False

        # Capacity
        if require_room and ROOM_CAPS[r] < lec['size']:
            validation['capacity_violations'].append({
                'lecture': lec['course'], 'room': ROOM_NAMES[r],
                'room_cap': ROOM_CAPS[r], 'class_size': lec['size']
            })
            validation['is_valid'] = False

        # Register
        lecturer_assignments.setdefault(l, []).append(t)
        if require_room:
            room_assignments.setdefault(r, []).append(t)
            room_usage_list.append((t, r, i))

        # Preference warnings
        lecturer_name = LECTURERS[l]
        timeslot_id   = TIMESLOTS[t]
        prefs = LECTURER_PREFERENCES.get(lecturer_name, {})
        if timeslot_id in prefs.get("unpreferred", []):
            validation['preference_warnings'].append({
                'lecturer': lecturer_name, 'course': lec['course'],
                'timeslot': timeslot_id, 'reason': 'assigned to unpreferred timeslot'
            })
        elif prefs.get("preferred") and timeslot_id not in prefs["preferred"]:
            validation['preference_warnings'].append({
                'lecturer': lecturer_name, 'course': lec['course'],
                'timeslot': timeslot_id, 'reason': 'not assigned to a preferred timeslot'
            })

        # BUG 3 FIX: accumulate credit hours, not a raw count.
        lecturer_load[l]  = lecturer_load.get(l, 0.0) + float(lec.get("credit_hours", 1))
        lecturer_ts.setdefault(l, []).append(t)
        timeslot_usage[t] = timeslot_usage.get(t, 0) + 1

    # Overload — flagged when the credit-hour load exceeds the per-lecturer ceiling.
    # BUG 4 FIX: each lecturer has their own limit from the DB.
    # We record one violation entry per whole-unit of excess so the count
    # remains proportional and meaningful in the UI.
    for l, load in lecturer_load.items():
        limit = get_lecturer_max_workload(l)
        if load > limit:
            excess = int(max(1, round(load - limit)))
            for _ in range(excess):
                validation['overload_violations'].append({
                    'lecturer':        LECTURERS[l],
                    'credit_hour_load': round(load, 2),
                    'max_workload':     round(limit, 2),
                    # Keep legacy key so any UI code still referencing 'classes' doesn't break.
                    'classes':          round(load, 2),
                    'max':              round(limit, 2),
                })
            validation['is_valid'] = False

    # ── Hard 8: cohort conflicts (program+year+semester) ─────────────────────
    for (cohort_id, idx_a, idx_b) in COHORT_CONFLICT_PAIRS:
        ta = schedule[idx_a * 3 + 1] % len(TIMESLOTS_DATA)
        tb = schedule[idx_b * 3 + 1] % len(TIMESLOTS_DATA)
        if TIMESLOT_OVERLAP[ta][tb]:
            validation['unit_conflict_violations'].append({
                'unit':      cohort_id,
                'course_a':  LECTURES[idx_a]['course'],
                'course_b':  LECTURES[idx_b]['course'],
                'timeslot_a': TIMESLOTS[ta],
                'timeslot_b': TIMESLOTS[tb],
            })
            validation['is_valid'] = False

    # ── Soft 7: student gaps within cohort groups ─────────────────────────────
    for cohort_id, indices in COHORT_TO_LECTURE_INDICES.items():
        if len(indices) < 2:
            continue
        day_sessions: Dict[str, Dict[int, Tuple[float, float]]] = {}
        for idx in indices:
            lec = LECTURES[idx]
            if lec.get("delivery_mode", "inperson") == "online":
                continue
            si = schedule[idx * 3 + 1] % len(TIMESLOTS_DATA)
            ts = TIMESLOTS_DATA[si]
            span = (ts["start_hour"], ts["start_hour"] + ts["duration"])
            for day in ts["days"]:
                day_sessions.setdefault(day, {})[idx] = span
        for day, by_course in day_sessions.items():
            sessions = list(by_course.values())
            if len(sessions) < 2:
                continue
            sessions_sorted = sorted(sessions, key=lambda x: x[0])
            for k in range(len(sessions_sorted) - 1):
                gap = round(sessions_sorted[k + 1][0] - sessions_sorted[k][1], 2)
                if gap > 0:
                    validation['student_gap_warnings'].append({
                        'unit':      cohort_id,
                        'day':       day,
                        'gap_hours': gap,
                    })

    # ── Soft 8: penalise cohorts with only one session on any day ─────────────
    for cohort_id, indices in COHORT_TO_LECTURE_INDICES.items():
        if not indices:
            continue
        day_courses: Dict[str, Set[int]] = {}
        for idx in indices:
            lec = LECTURES[idx]
            if lec.get("delivery_mode", "inperson") == "online":
                continue
            si = schedule[idx * 3 + 1] % len(TIMESLOTS_DATA)
            ts = TIMESLOTS_DATA[si]
            for day in ts["days"]:
                day_courses.setdefault(day, set()).add(idx)
        for day, idx_set in day_courses.items():
            if len(idx_set) == 1:
                only_idx = next(iter(idx_set))
                validation['single_session_day_warnings'].append({
                    'unit':   cohort_id,
                    'day':    day,
                    'course': LECTURES[only_idx]['course'],
                    'reason': f'Only one session on {day} — students commute for just one class',
                })

    # Gap warnings — grouped by day to avoid false cross-day gaps
    for l, slots in lecturer_ts.items():
        day_slot_map: Dict[str, List[int]] = {}
        for s in slots:
            for day in TIMESLOTS_DATA[s]["days"]:
                day_slot_map.setdefault(day, []).append(s)
        for day, day_slots in day_slot_map.items():
            if len(day_slots) < 2:
                continue
            day_slots_sorted = sorted(day_slots, key=lambda s: TIMESLOTS_DATA[s]["start_hour"])
            for sa, sb in zip(day_slots_sorted, day_slots_sorted[1:]):
                end_a   = TIMESLOTS_DATA[sa]["start_hour"] + TIMESLOTS_DATA[sa]["duration"]
                start_b = TIMESLOTS_DATA[sb]["start_hour"]
                gap     = start_b - end_a
                if gap > 0:
                    validation['gap_warnings'].append({
                        'lecturer': LECTURERS[l],
                        'gap_hours': round(gap, 2),
                        'day':       day,
                        'between': f"{TIMESLOTS[sa]} and {TIMESLOTS[sb]}"
                    })

    # Room utilisation — occupied slots
    occupied_rt = set()  # (room_idx, timeslot_idx) pairs that are occupied
    for (t, r, lec_idx) in room_usage_list:
        cap   = ROOM_CAPS[r]
        size  = LECTURES[lec_idx]['size']
        waste = round(100 * (cap - size) / cap, 1)
        ts_data = TIMESLOTS_DATA[t]
        validation['utilization_info'].append({
            'room':        ROOM_NAMES[r],
            'room_type':   ROOM_TYPES[r],
            'course':      LECTURES[lec_idx]['course'],
            'timeslot':    TIMESLOTS[t],
            'days':        ts_data['days'],
            'start_hour':  ts_data['start_hour'],
            'duration':    ts_data['duration'],
            'slot_type':   ts_data['slot_type'],
            'capacity':    cap,
            'class_size':  size,
            'wasted_seats': cap - size,
            'waste_pct':   waste,
            'is_empty':    False,
            'penalty':     round(soft_room_utilization([(t, r, lec_idx)], LECTURES), 4)
        })
        occupied_rt.add((r, t))

    # Room utilisation — empty slots (no section placed → all seats wasted)
    for r in range(len(ROOM_NAMES)):
        cap = ROOM_CAPS[r]
        for t in range(len(TIMESLOTS_DATA)):
            if (r, t) not in occupied_rt:
                ts_data = TIMESLOTS_DATA[t]
                validation['utilization_info'].append({
                    'room':        ROOM_NAMES[r],
                    'room_type':   ROOM_TYPES[r],
                    'course':      '',
                    'timeslot':    TIMESLOTS[t],
                    'days':        ts_data['days'],
                    'start_hour':  ts_data['start_hour'],
                    'duration':    ts_data['duration'],
                    'slot_type':   ts_data['slot_type'],
                    'capacity':    cap,
                    'class_size':  0,
                    'wasted_seats': cap,
                    'waste_pct':   100.0,
                    'is_empty':    True,
                    'penalty':     0.0
                })

    # BUG 3 + 4 FIX: report credit-hour-weighted load alongside per-lecturer ceiling.
    # 'classes' kept for backward compatibility with the UI (timetable.tsx reads w.classes).
    validation['workload_info'] = [
        {
            'lecturer':          LECTURERS[l],
            'classes':           round(lecturer_load.get(l, 0.0), 2),   # credit-hour load (UI compat)
            'credit_hour_load':  round(lecturer_load.get(l, 0.0), 2),   # explicit alias
            'max_workload':      round(get_lecturer_max_workload(l), 2),
            'within_limit':      lecturer_load.get(l, 0.0) <= get_lecturer_max_workload(l),
        }
        for l in range(len(LECTURERS))
    ]
    validation['workload_penalty']      = round(soft_balanced_workload(lecturer_load), 4)

    validation['distribution_info'] = [
        {'timeslot': TIMESLOTS[t], 'slot_type': TIMESLOTS_DATA[t]['slot_type'],
         'classes': timeslot_usage.get(t, 0)}
        for t in range(len(TIMESLOTS_DATA))
    ]
    validation['distribution_penalty'] = round(soft_distribute_classes(timeslot_usage), 4)

    validation['total_conflicts'] = (
        len(validation['lecturer_conflicts'])       +
        len(validation['room_conflicts'])           +
        len(validation['invalid_lecturers'])        +
        len(validation['invalid_timeslot_types'])   +
        len(validation['invalid_room_types'])       +
        len(validation['capacity_violations'])      +
        len(validation['overload_violations'])      +
        len(validation['unit_conflict_violations'])  # NEW: study-plan unit conflicts
    )
    # UI alias (same rows as invalid_timeslot_types)
    validation['wrong_slot_type_violations'] = validation['invalid_timeslot_types']
    return validation


# =============================================================================
# MULTI-RUN EXECUTION
# =============================================================================
print("Optimising…\n")
all_results = []
total_optim_steps = NUM_RUNS * NUM_ITERATIONS
# When the UI streams progress, hide tqdm output (still tracks n) to avoid noisy logs.
_pbar_file = io.StringIO() if _ui_progress_enabled() else sys.stdout
with tqdm(
    total=total_optim_steps,
    unit="iter",
    desc="GWO",
    file=_pbar_file,
    disable=False,
    mininterval=0.25,
) as optim_pbar:
    for run in range(1, NUM_RUNS + 1):
        best_schedule, best_fitness, convergence = gwo(run_number=run, pbar=optim_pbar)
        all_results.append((best_schedule, best_fitness, convergence))

best_schedule, best_fitness, best_convergence = min(all_results, key=lambda x: x[1])
validation_result = validate_schedule(best_schedule)

hard_conflicts_only = validation_result['total_conflicts']
# "perfect"   = zero hard conflicts AND total fitness below the soft-only threshold
# "feasible"  = zero hard conflicts (some soft violations may remain)
# "infeasible" = one or more hard constraint violations
quality = (
    "perfect"
    if hard_conflicts_only == 0 and best_fitness < PERFECT_THRESHOLD
    else ("feasible" if hard_conflicts_only == 0 else "infeasible")
)
print(
    f"Done | best fitness {best_fitness:.4f} | hard conflicts {hard_conflicts_only} | {quality}\n"
)

# ── Schedule (compact) ───────────────────────────────────────────────────────
print("Schedule")
print("-" * 72)

schedule_data = []
for i, lec in enumerate(LECTURES):
    r = int(best_schedule[i*3])   % len(ROOM_NAMES)
    t = int(best_schedule[i*3+1]) % len(TIMESLOTS_DATA)
    l = int(best_schedule[i*3+2]) % len(LECTURERS)

    ts_data       = TIMESLOTS_DATA[t]
    mode          = lec.get("delivery_mode", "inperson")
    stype         = lec.get("session_type",  "lecture")
    require_room  = needs_room(lec)
    room_display  = ROOM_NAMES[r] if require_room else "ONLINE"

    print(
        f"{lec['course']:<10} {ts_data['id']:<16} {room_display:<8} {LECTURERS[l]:<10} "
        f"{mode}/{stype}"
    )

    schedule_data.append({
        "course":        lec["course"],
        "delivery_mode": mode,
        "session_type":  stype,
        "timeslot_id":   ts_data["id"],
        "days":          ts_data["days"],
        "start_hour":    ts_data["start_hour"],
        "duration":      ts_data["duration"],
        "slot_type":     ts_data["slot_type"],
        "room":          room_display,
        "room_type":     ROOM_TYPES[r] if require_room else "none",
        "lecturer":      LECTURERS[l],
        "size":          lec["size"],
        "requires_room": require_room,
    })

print("-" * 72)

n_ip = sum(
    1
    for l in LECTURES
    if l.get("delivery_mode", "inperson") == "inperson" and l.get("session_type", "lecture") == "lecture"
)
n_on = sum(1 for l in LECTURES if l.get("delivery_mode", "inperson") == "online")
n_bl = sum(1 for l in LECTURES if l.get("delivery_mode", "inperson") == "blended")
n_lab = sum(1 for l in LECTURES if l.get("session_type", "lecture") == "lab")
vr = validation_result
soft_counts = (
    f"prefs={len(vr['preference_warnings'])} | "
    f"lec_gaps={len(vr['gap_warnings'])} | "
    f"unit_hard={len(vr['unit_conflict_violations'])} | "
    f"stu_gaps={len(vr['student_gap_warnings'])} | "
    f"single_day={len(vr['single_session_day_warnings'])}"
)
print(
    f"Mix in-person/online/blended/lab: {n_ip}/{n_on}/{n_bl}/{n_lab} | "
    f"hard breakdown L/R/ts/rm/cap/ld/unit: "
    f"{len(vr['lecturer_conflicts'])}/{len(vr['room_conflicts'])}/"
    f"{len(vr['invalid_timeslot_types'])}/{len(vr['invalid_room_types'])}/"
    f"{len(vr['capacity_violations'])}/{len(vr['overload_violations'])}/"
    f"{len(vr['unit_conflict_violations'])}"
)
print(f"Soft-issue counts: {soft_counts}\n")


# =============================================================================
# EXPORT — schedule_output.txt
# =============================================================================
print("Writing schedule_output.txt…", end=" ", flush=True)
with open('schedule_output.txt', 'w', encoding='utf-8') as f:
    f.write("OPTIMISED TIMETABLE SCHEDULE — GWO v6\n")
    f.write("=" * 70 + "\n\n")
    f.write("SCHEDULE DETAILS:\n")
    f.write("-" * 70 + "\n")
    for entry in schedule_data:
        f.write(
            f"{entry['course']:10s} | {entry['delivery_mode']:9s} | {entry['session_type']:7s} | "
            f"{entry['timeslot_id']:18s} | "
            f"{'  '.join(entry['days']):28s} | "
            f"{entry['room']:8s} | {entry['lecturer']}\n"
        )
    f.write(f"\nFinal Fitness: {best_fitness:.4f}\n")
    f.write(f"Hard Conflicts: {validation_result['total_conflicts']}\n")
print("ok")

# =============================================================================
# SEND TO UI
# =============================================================================
print("UI push…", end=" ", flush=True)
try:
    from send_schedule import send_to_ui

    send_to_ui(
        best_schedule,
        LECTURES,
        ROOM_NAMES,
        TIMESLOTS,
        LECTURERS,
        timeslots_data=TIMESLOTS_DATA,
        room_types=ROOM_TYPES,
        iterations=NUM_ITERATIONS,
        wolves=NUM_WOLVES,
        best_fitness=best_fitness,
        lecturer_preferences=LECTURER_PREFERENCES,
        rooms_dict={n: c for n, c in zip(ROOM_NAMES, ROOM_CAPS)},
        max_classes_per_lecturer=MAX_CLASSES_PER_LECTURER,
        validation_result=validation_result,
        soft_weights=SOFT_WEIGHTS,
        study_plan_units=COHORT_GROUPS,
    )
except ImportError:
    print("skipped (no send_schedule)")
else:
    print("ok")

print("Finished.\n")