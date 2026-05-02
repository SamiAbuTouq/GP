
"""
What-If Scenario System — SQLAlchemy Database Models
Matches the DB physical schema from the documentation (Figure 41).
All scenario data is stored in isolation from production timetable data.
"""

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, Text, JSON, Enum as SAEnum
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ScenarioStatus(str, PyEnum):
    CREATED    = "created"
    CONFIGURED = "configured"
    RUNNING    = "running"
    COMPLETED  = "completed"
    FAILED     = "failed"
    APPLIED    = "applied"
    ARCHIVED   = "archived"


class ConditionType(str, PyEnum):
    ADD_LECTURER         = "add_lecturer"
    DELETE_LECTURER      = "delete_lecturer"
    AMEND_LECTURER       = "amend_lecturer"
    ADD_ROOM             = "add_room"
    DELETE_ROOM          = "delete_room"
    ADJUST_ROOM_CAPACITY = "adjust_room_capacity"
    ADD_COURSE           = "add_course"
    CHANGE_SECTION_COUNT = "change_section_count"
    CHANGE_DELIVERY_MODE = "change_delivery_mode"
    ADD_TIMESLOT         = "add_timeslot"
    DELETE_TIMESLOT      = "delete_timeslot"


class ComparisonMode(str, PyEnum):
    BEFORE_AFTER    = "before_after"    # One timetable, one scenario
    CROSS_TIMETABLE = "cross_timetable" # One scenario, many timetables
    CROSS_SCENARIO  = "cross_scenario"  # Many scenarios, one timetable


# ---------------------------------------------------------------------------
# Scenario — the top-level container (a reusable ruleset)
# ---------------------------------------------------------------------------

class Scenario(Base):
    __tablename__ = "scenarios"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(200), nullable=False)
    description     = Column(Text, nullable=True)
    status          = Column(SAEnum(ScenarioStatus), default=ScenarioStatus.CREATED, nullable=False)
    created_by      = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    conditions      = relationship("ScenarioCondition", back_populates="scenario", cascade="all, delete-orphan")
    runs            = relationship("ScenarioRun",       back_populates="scenario", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Scenario id={self.id} name='{self.name}' status={self.status}>"


# ---------------------------------------------------------------------------
# ScenarioCondition — one "what-if" rule inside a scenario
# ---------------------------------------------------------------------------

class ScenarioCondition(Base):
    __tablename__ = "scenario_conditions"

    id              = Column(Integer, primary_key=True, index=True)
    scenario_id     = Column(Integer, ForeignKey("scenarios.id"), nullable=False)
    condition_type  = Column(SAEnum(ConditionType), nullable=False)
    # All condition-specific parameters stored as JSON so schema stays flexible
    parameters      = Column(JSON, nullable=False, default=dict)
    order_index     = Column(Integer, default=0)   # controls application order

    scenario        = relationship("Scenario", back_populates="conditions")

    def __repr__(self):
        return f"<Condition id={self.id} type={self.condition_type}>"


# ---------------------------------------------------------------------------
# ScenarioRun — one execution of a scenario against a specific timetable
# ---------------------------------------------------------------------------

class ScenarioRun(Base):
    __tablename__ = "scenario_runs"

    id                   = Column(Integer, primary_key=True, index=True)
    scenario_id          = Column(Integer, ForeignKey("scenarios.id"),   nullable=False)
    base_timetable_id    = Column(Integer, ForeignKey("timetables.id"),  nullable=False)
    # The sandboxed timetable produced by this run (NULL until completed)
    result_timetable_id  = Column(Integer, ForeignKey("timetables.id"),  nullable=True)

    status               = Column(SAEnum(ScenarioStatus), default=ScenarioStatus.CREATED)
    started_at           = Column(DateTime, nullable=True)
    completed_at         = Column(DateTime, nullable=True)
    error_message        = Column(Text, nullable=True)

    # CBR + GWO algorithm stats surfaced for the admin
    cbr_cases_found      = Column(Integer, nullable=True)
    gwo_iterations_run   = Column(Integer, nullable=True)
    gwo_convergence_iter = Column(Integer, nullable=True)
    generation_seconds   = Column(Float, nullable=True)

    # Computed metrics (stored so comparison is instant without re-querying schedule)
    metrics              = Column(JSON, nullable=True)  # See MetricsSnapshot schema

    scenario             = relationship("Scenario", back_populates="runs")
    baseline_metrics     = Column(JSON, nullable=True)  # snapshot of base timetable at run time

    def __repr__(self):
        return f"<ScenarioRun id={self.id} scenario={self.scenario_id} base={self.base_timetable_id} status={self.status}>"


# ---------------------------------------------------------------------------
# ScenarioComparison — saved comparison view (which runs are being compared)
# ---------------------------------------------------------------------------

class ScenarioComparison(Base):
    __tablename__ = "scenario_comparisons"

    id              = Column(Integer, primary_key=True, index=True)
    mode            = Column(SAEnum(ComparisonMode), nullable=False)
    # JSON array of ScenarioRun IDs included in this comparison
    run_ids         = Column(JSON, nullable=False)
    created_by      = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow)
    # Cache of the comparison result so the page loads instantly
    result_cache    = Column(JSON, nullable=True)
    recommendation  = Column(Text, nullable=True)   # AI/rule-based recommendation text

    def __repr__(self):
        return f"<ScenarioComparison id={self.id} mode={self.mode}>"
