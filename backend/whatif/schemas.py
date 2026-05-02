
"""
What-If Scenario System — Pydantic Schemas
Used for FastAPI request validation and response serialization.
"""

from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, validator

from .models import ConditionType, ScenarioStatus, ComparisonMode


# ---------------------------------------------------------------------------
# Condition parameter schemas — one per condition type
# ---------------------------------------------------------------------------

class AddLecturerParams(BaseModel):
    firstName: str
    lastName: str
    deptId: int
    maxWorkload: int = Field(..., ge=1)
    teachableCourseIds: List[int] = Field(default_factory=list)

class DeleteLecturerParams(BaseModel):
    lecturerUserId: int

class AmendLecturerParams(BaseModel):
    lecturerUserId: int
    teachableCourseIds: Optional[List[int]] = None
    maxWorkload: Optional[int] = Field(default=None, ge=1)

class AddRoomParams(BaseModel):
    roomNumber: str
    roomType: int
    capacity: int = Field(..., ge=1)
    isAvailable: bool = True

class DeleteRoomParams(BaseModel):
    roomId: int

class AdjustRoomCapacityParams(BaseModel):
    roomId: int
    newCapacity: int = Field(..., ge=1)

class AddCourseParams(BaseModel):
    courseCode: str
    courseName: str
    deptId: int
    academicLevel: int = Field(..., ge=1)
    isLab: bool = False
    creditHours: int = Field(..., ge=1)
    deliveryMode: str
    sectionsNormal: int = Field(0, ge=0)
    sectionsSummer: int = Field(0, ge=0)
    assignableLecturerIds: List[int] = Field(default_factory=list)

class ChangeSectionCountParams(BaseModel):
    courseId: int
    newSectionsNormal: int
    newSectionsSummer: Optional[int] = 0

class ChangeDeliveryModeParams(BaseModel):
    courseId: int
    newDeliveryMode: Optional[str] = None
    deliveryMode: Optional[str] = None

    @validator("newDeliveryMode", pre=True, always=True)
    def _coalesce_delivery_mode(cls, v, values):
        chosen = v if v not in (None, "") else values.get("deliveryMode")
        if chosen in (None, ""):
            raise ValueError("newDeliveryMode or deliveryMode is required")
        return str(chosen).strip().upper()

class AddTimeslotParams(BaseModel):
    startTime: str
    endTime: str
    daysMask: int = Field(0, ge=0)
    slotType: str
    isSummer: bool = False

class DeleteTimeslotParams(BaseModel):
    slotId: int


# Map condition type → its params schema (used by engine for validation)
CONDITION_PARAMS_MAP: Dict[ConditionType, type] = {
    ConditionType.ADD_LECTURER:         AddLecturerParams,
    ConditionType.DELETE_LECTURER:      DeleteLecturerParams,
    ConditionType.AMEND_LECTURER:       AmendLecturerParams,
    ConditionType.ADD_ROOM:             AddRoomParams,
    ConditionType.DELETE_ROOM:          DeleteRoomParams,
    ConditionType.ADJUST_ROOM_CAPACITY: AdjustRoomCapacityParams,
    ConditionType.ADD_COURSE:           AddCourseParams,
    ConditionType.CHANGE_SECTION_COUNT: ChangeSectionCountParams,
    ConditionType.CHANGE_DELIVERY_MODE: ChangeDeliveryModeParams,
    ConditionType.ADD_TIMESLOT:         AddTimeslotParams,
    ConditionType.DELETE_TIMESLOT:      DeleteTimeslotParams,
}


# ---------------------------------------------------------------------------
# Generic condition schema (used in scenario create/update)
# ---------------------------------------------------------------------------

class ConditionIn(BaseModel):
    condition_type: ConditionType
    parameters: Dict[str, Any]
    order_index: int = 0

class ConditionOut(ConditionIn):
    id: int
    scenario_id: int
    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Scenario CRUD schemas
# ---------------------------------------------------------------------------

class ScenarioCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    conditions: List[ConditionIn] = Field(default_factory=list)

class ScenarioUpdate(BaseModel):
    name:        Optional[str]           = None
    description: Optional[str]          = None
    conditions:  Optional[List[ConditionIn]] = None

class ScenarioOut(BaseModel):
    id:          int
    name:        str
    description: Optional[str]
    status:      ScenarioStatus
    created_by:  int
    created_at:  datetime
    updated_at:  Optional[datetime]
    conditions:  List[ConditionOut] = []
    runs:        List["ScenarioRunOut"] = []
    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Metrics — the numbers shown in every comparison panel
# ---------------------------------------------------------------------------

class MetricsSnapshot(BaseModel):
    """
    All metrics the GWO fitness function already computes.
    Stored as JSON in ScenarioRun.metrics for instant retrieval.
    """
    # Hard constraint metrics
    total_conflicts:         int   = 0
    room_conflicts:          int   = 0
    lecturer_conflicts:      int   = 0
    student_conflicts:       int   = 0
    hard_constraint_pct:     float = 100.0   # % of hard constraints satisfied

    # Soft constraint / quality metrics
    soft_constraint_score:   float = 0.0    # GWO fitness value 0–1
    gwo_fitness_final:       float = 0.0

    # Utilization
    room_utilization_pct:    float = 0.0    # overall
    room_utilization_by_building: Dict[str, float] = Field(default_factory=dict)

    # Workload
    lecturer_load_balance:   float = 0.0   # lower std-dev = better
    lecturer_overload_count: int   = 0     # how many lecturers are overloaded

    # Student experience
    avg_student_gap_hours:   float = 0.0   # average idle hours per student per day
    student_gap_total:       int   = 0

    # Section sizing
    avg_section_fill_rate:   float = 0.0   # enrollment / capacity
    undersized_sections:     int   = 0
    oversized_sections:      int   = 0

    # Algorithm performance
    cbr_cases_used:          int   = 0
    gwo_iterations:          int   = 0
    gwo_convergence_iter:    Optional[int] = None
    generation_seconds:      float = 0.0


class MetricsDelta(BaseModel):
    """Delta between baseline and scenario result for one metric."""
    metric_name:  str
    baseline:     float
    scenario:     float
    delta:        float        # scenario - baseline
    delta_pct:    float        # percentage change
    direction:    str          # "better" | "worse" | "neutral"
    # "better" when lower is better (conflicts), or higher is better (utilization)

class ComparisonResult(BaseModel):
    """Full side-by-side comparison output."""
    mode:             ComparisonMode
    columns:          List[str]          # column labels (e.g. ["Baseline", "Scenario A"])
    deltas:           List[MetricsDelta]
    recommendation:   str
    apply_run_id:     Optional[int] = None  # which run to apply if admin accepts


# ---------------------------------------------------------------------------
# ScenarioRun schemas
# ---------------------------------------------------------------------------

class RunRequest(BaseModel):
    """Request to execute a scenario against one or more timetables."""
    timetable_ids: List[int] = Field(..., min_items=1)

class ScenarioRunOut(BaseModel):
    id:                  int
    scenario_id:         int
    base_timetable_id:   int
    result_timetable_id: Optional[int]
    status:              ScenarioStatus
    started_at:          Optional[datetime]
    completed_at:        Optional[datetime]
    error_message:       Optional[str]
    metrics:             Optional[MetricsSnapshot]
    baseline_metrics:    Optional[MetricsSnapshot]
    cbr_cases_found:     Optional[int]
    gwo_iterations_run:  Optional[int]
    generation_seconds:  Optional[float]
    class Config:
        from_attributes = True

ScenarioOut.update_forward_refs()


# ---------------------------------------------------------------------------
# WebSocket progress event
# ---------------------------------------------------------------------------

class ProgressEvent(BaseModel):
    """Sent over WebSocket during simulation (matches timetable generation pattern)."""
    run_id:          int
    scenario_id:     int
    timetable_id:    int
    phase:           str    # "cloning" | "cbr" | "gwo" | "validating" | "computing_metrics" | "done" | "error"
    pct:             int    # 0–100
    message:         str
    iteration:       Optional[int] = None
    fitness:         Optional[float] = None
    hard_pct:        Optional[float] = None
    soft_pct:        Optional[float] = None
