export type HelpFaqCategory =
  | "timetable-generation"
  | "conflicts"
  | "reports-exports"
  | "entities"
  | "access-roles"
  | "what-if"
  | "schedule-viewer";

export type AppRole = "ADMIN" | "LECTURER";

export interface HelpFaqItem {
  readonly id: string;
  readonly category: HelpFaqCategory;
  readonly question: string;
  readonly answer: string;
}

export interface QuickStartArea {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly href: string;
  /** Empty means visible to everyone (including signed-out visitors reading Help). */
  readonly roles: readonly AppRole[];
}

export interface HostedVideoTutorial {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly durationLabel: string;
  readonly mp4Url: string;
  readonly posterUrl: string;
}

export interface HelpPdfGuide {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Served from `frontend/public/help/`. */
  readonly publicPath: `/help/${string}`;
}

export const HELP_FAQ_CATEGORY_LABELS: Record<HelpFaqCategory, string> = {
  "timetable-generation": "Generation",
  conflicts: "Conflicts",
  "reports-exports": "Reports & exports",
  entities: "Master data",
  "access-roles": "Access & roles",
  "what-if": "What-if",
  "schedule-viewer": "Schedule viewer",
};

export const HELP_FAQ_ITEMS: readonly HelpFaqItem[] = [
  {
    id: "gen-prereq-data",
    category: "timetable-generation",
    question: "What data must be complete before I run timetable generation?",
    answer:
      "Generation needs a coherent academic scope: active study plans or offerings, lecturer assignments where your process requires them, rooms with capacities and tags, and time slots that reflect official teaching windows. Incomplete entities do not always block a run, but they produce misleading soft conflicts or empty sessions. Use Reports to sanity-check row counts before committing wall-clock time to a long optimization.",
  },
  {
    id: "gen-draft-vs-publish",
    category: "timetable-generation",
    question: "How should we treat a “draft” generation versus a timetable we publish?",
    answer:
      "Keep draft runs labeled and time-stamped in your team’s process. Compare draft metrics (conflict totals, room utilization, lecturer spread) in Schedule Viewer and Reports before publishing. Publishing should be a deliberate step after academic sign-off, because downstream exports and lecturer views are often interpreted as final unless your communications say otherwise.",
  },
  {
    id: "gen-parameters-change-outcomes",
    category: "timetable-generation",
    question: "Why do small parameter changes sometimes swing results dramatically?",
    answer:
      "Course timetabling is a constrained search problem: tightening one constraint can eliminate large parts of the feasible space. Seeding, iteration budgets, and weighting between soft goals also shift which “good enough” solution the optimizer returns. When a small change surprises you, capture the two runs as what-if scenarios and compare conflict breakdowns rather than chasing a single magic configuration.",
  },
  {
    id: "conflict-hard-soft",
    category: "conflicts",
    question: "How do I interpret hard versus soft conflicts in the UI and reports?",
    answer:
      "Hard conflicts violate non-negotiable rules—double-booked rooms, overlapping required sessions for the same cohort, or impossible time placement. Soft conflicts are preferences or load-balancing goals you asked the system to minimize. Fix hard issues first; soft issues are triaged by academic priority. If soft noise is overwhelming, your weights may be too aggressive relative to incomplete master data.",
  },
  {
    id: "conflict-lecturer-load",
    category: "conflicts",
    question: "A lecturer shows back-to-back sessions across campuses. Where do I start?",
    answer:
      "Verify the lecturer’s contracted sites, session binding to room locations, and any missing travel buffers in constraints. Check whether a course should be split across lecturers or sections. If the data is correct but still undesirable, capture a what-if run adjusting weights or room pools, and document the trade-off for the department chair.",
  },
  {
    id: "conflict-student-overlap",
    category: "conflicts",
    question: "We see student cohort overlaps that look impossible on paper. What usually causes this?",
    answer:
      "Common causes are mis-linked study plan lines, cross-listed courses represented twice, elective pools modeled too narrowly, or sections that should be mutually exclusive but are not. Start from the cohort’s plan in Study Plans, then trace individual sections in Schedule Viewer. Fix data first; only then re-run generation or apply targeted manual moves.",
  },
  {
    id: "reports-audit-trail",
    category: "reports-exports",
    question: "Which reports best support accreditation or internal audit questions?",
    answer:
      "Use utilization and workload summaries for space and staffing accountability, conflict summaries for risk disclosure, and change logs if your deployment tracks amendments. Export the same snapshot to PDF or Excel so reviewers can see the exact dataset timestamp you relied on. Keep exports alongside committee minutes when decisions reference a specific build.",
  },
  {
    id: "exports-consistency",
    category: "reports-exports",
    question: "Excel from Schedule Viewer does not exactly match a faculty PDF. Is that a bug?",
    answer:
      "Often no—exports can differ by rounding, hidden columns, filters, or which view produced the extract. Align on a single source of truth for each meeting: either a report template or a grid export. If numbers diverge materially, compare generation IDs or timestamps and confirm both exports reference the same published revision.",
  },
  {
    id: "entities-study-plans",
    category: "entities",
    question: "Study plans changed mid-cycle. How do we avoid corrupting the live timetable?",
    answer:
      "Freeze plan edits during publish windows where possible. When mid-cycle edits are unavoidable, import or adjust plans in a controlled batch, re-run a draft generation, and route changes through a coordinator who understands section linkage. Communicate deltas to departments so manual tweaks in Schedule Viewer are not fighting refreshed machine proposals.",
  },
  {
    id: "entities-rooms-tags",
    category: "entities",
    question: "When should we use room tags versus ad-hoc notes?",
    answer:
      "Use tags for anything the solver must respect: lab equipment, flat floors, exam capacity, IT lab images, or professional-school accreditation requirements. Ad-hoc notes are invisible to optimization. If a constraint matters to placement, model it explicitly—even if setup takes longer—otherwise you will keep patching the same soft conflicts manually.",
  },
  {
    id: "entities-timeslots-blackouts",
    category: "entities",
    question: "How do blackout periods interact with elective-heavy programs?",
    answer:
      "Blackouts shrink feasible space. Elective-heavy programs need spare capacity across multiple windows. If blackouts are too tight, you will see artificial hard conflicts or odd section spreads. Validate blackout calendars with the registrar before encoding them, and test elective-rich departments in what-if runs before institution-wide publish.",
  },
  {
    id: "access-roles-lecturer-limits",
    category: "access-roles",
    question: "What can lecturers change on their own versus needing an administrator?",
    answer:
      "Typically lecturers submit time preferences and view personal schedules or assigned courses, while structural edits—new sections, room changes with policy impact, or plan edits—stay with administrators. Exact permissions depend on your deployment’s guards. If a lecturer cannot access an area they need, verify role, account status, and any pending access request approvals.",
  },
  {
    id: "access-requests-workflow",
    category: "access-roles",
    question: "How should we process access requests without creating security drift?",
    answer:
      "Use a single queue, default-deny posture, and least-privilege templates. Tie approvals to HR or registrar confirmation for elevated roles. Periodically review active accounts against HR lists. Document approvers in your policy so emergency grants are rare, time-bound, and logged.",
  },
  {
    id: "what-if-when-to-use",
    category: "what-if",
    question: "When is a what-if scenario worth the extra effort instead of tweaking the live grid?",
    answer:
      "Use what-if when the change touches shared resources—rooms, cohorts, or cross-department chains—or when you need a defensible comparison for leadership. For single-section cosmetic moves with no ripple effects, Schedule Viewer edits may be faster. Name scenarios clearly and attach the metrics snapshot you used to choose a winner.",
  },
  {
    id: "what-if-compare-runs",
    category: "what-if",
    question: "How do we compare two solver runs fairly?",
    answer:
      "Lock the same dataset version, time slot grid, and constraint profile when possible. Compare total hard conflicts first, then prioritized soft metrics, then qualitative goals like commuter gaps or room churn. If runs use different random seeds, treat large deltas cautiously—rerun with medians across a few seeds if your process requires stability proofs.",
  },
  {
    id: "schedule-viewer-bulk-edits",
    category: "schedule-viewer",
    question: "What is a safe pattern for bulk moves during peak registration?",
    answer:
      "Stage changes in small batches with immediate conflict checks after each batch. Avoid mixing machine-proposed moves and manual edits without labeling which is authoritative. Communicate visible changes to affected lecturers the same day. If throughput is high, temporarily add coordinator shifts rather than turning off validation warnings.",
  },
  {
    id: "schedule-viewer-readonly",
    category: "schedule-viewer",
    question: "Some users insist the viewer is “wrong” but conflicts look clean. What should we check?",
    answer:
      "Timezone and personal calendar overlays, cached browser tabs, and unpublished versus published revisions are frequent culprits. Confirm they are signed into the correct tenant or term, then compare the session timestamp to the official export PDF they are holding. If everything aligns, the issue is usually interpretation—pair them with a short screen share using the same filter set.",
  },
];

export const QUICK_START_AREAS: readonly QuickStartArea[] = [
  {
    id: "timetable-generation",
    title: "Timetable generation",
    description: "Configure runs, monitor progress, and capture solver output for review.",
    href: "/timetable-generation",
    roles: ["ADMIN"],
  },
  {
    id: "what-if",
    title: "What-if scenarios",
    description: "Branch configurations, compare runs, and document trade-offs before you publish.",
    href: "/dashboard/what-if",
    roles: ["ADMIN"],
  },
  {
    id: "schedule-viewer",
    title: "Schedule viewer",
    description: "Inspect sessions, validate conflicts, and perform controlled manual adjustments.",
    href: "/schedule",
    roles: ["ADMIN"],
  },
  {
    id: "reports",
    title: "Reports & exports",
    description: "Generate evidence packs for committees, auditors, and faculty leadership.",
    href: "/reports",
    roles: ["ADMIN"],
  },
  {
    id: "study-plans",
    title: "Study plans & curricula",
    description: "Keep cohort pathways accurate so the solver respects real program structure.",
    href: "/entity/study-plans",
    roles: ["ADMIN"],
  },
  {
    id: "access-requests",
    title: "Access requests",
    description: "Approve least-privilege access aligned with HR and registrar records.",
    href: "/entity/access-requests",
    roles: ["ADMIN"],
  },
  {
    id: "lecturer-preferences",
    title: "Time preferences",
    description: "Register unavailable windows and standing commitments for fair assignment.",
    href: "/lecturer-time-preferences",
    roles: ["LECTURER"],
  },
  {
    id: "lecturer-schedule",
    title: "My teaching schedule",
    description: "Review confirmed sessions and raise issues with your coordinator early.",
    href: "/lecturer-schedule",
    roles: ["LECTURER"],
  },
  {
    id: "my-courses",
    title: "My courses",
    description: "See allocations tied to you and confirm section metadata matches reality.",
    href: "/my-courses",
    roles: ["LECTURER"],
  },
];

export const HOSTED_VIDEO_TUTORIALS: readonly HostedVideoTutorial[] = [
  {
    id: "quick-start-hosted",
    title: "Quick start walkthrough",
    description:
      "Orientation to the Smart University Timetabling System—core navigation and the scheduling workflow your team will repeat each term.",
    durationLabel: "Hosted on Cloudinary",
    mp4Url:
      "https://res.cloudinary.com/dhiwczysm/video/upload/v1778765331/Quick_Start_Guide_xiquvy.mp4",
    posterUrl:
      "https://res.cloudinary.com/dhiwczysm/video/upload/w_1280,h_720,c_fill,q_auto,f_jpg/so_1/v1778765331/Quick_Start_Guide_xiquvy.jpg",
  },
];

export const HELP_PDF_GUIDES: readonly HelpPdfGuide[] = [
  {
    id: "administrator-guide",
    title: "Administrator orientation (PDF)",
    description: "Printable overview aligned with coordinator workflows before each publish cycle.",
    publicPath: "/help/administrator-guide.pdf",
  },
  {
    id: "lecturer-reference",
    title: "Lecturer quick reference (PDF)",
    description: "Short guidance on preferences, schedule review, and how to escalate conflicts responsibly.",
    publicPath: "/help/lecturer-quick-reference.pdf",
  },
  {
    id: "data-quality",
    title: "Data quality checklist (PDF)",
    description: "A practical pre-flight list to reduce noisy soft conflicts and rework during peak weeks.",
    publicPath: "/help/data-quality-checklist.pdf",
  },
];
