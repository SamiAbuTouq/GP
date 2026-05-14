export type HelpFaqCategory =
  | "timetable-generation"
  | "conflicts"
  | "reports-exports"
  | "entities"
  | "access-roles"
  | "what-if"
  | "saving-publishing";

export interface HelpFaqItem {
  readonly id: string;
  readonly category: HelpFaqCategory;
  readonly question: string;
  readonly answer: string;
}

export interface HostedVideoTutorial {
  readonly id: string;
  /** Shown on the thumbnail overlay and in the fullscreen player header. */
  readonly title: string;
  /** Short second line on the thumbnail (e.g. format or focus). */
  readonly tagline: string;
  /** Paragraph below the thumbnail. */
  readonly description: string;
  readonly mp4Url: string;
  readonly posterUrl: string;
}

export interface HelpPdfGuide {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Present when the guide is published; omit while `comingSoon` is true. */
  readonly publicPath?: `/help/${string}`;
  /** When true, the row is informational only—no download yet. */
  readonly comingSoon?: boolean;
}

export const HELP_FAQ_CATEGORY_LABELS: Record<HelpFaqCategory, string> = {
  "timetable-generation": "Generation",
  conflicts: "Conflicts",
  "reports-exports": "Reports & exports",
  entities: "Master data",
  "access-roles": "Access & roles",
  "what-if": "What-if scenarios",
  "saving-publishing": "Saving & publishing",
};

export const HELP_FAQ_ITEMS: readonly HelpFaqItem[] = [
  {
    id: "gen-prereq-data",
    category: "timetable-generation",
    question: "What data must be complete before I run timetable generation?",
    answer: `You need four things in place: courses with credit hours and delivery mode set, lecturers with max workload configured and courses assigned, rooms with capacities added, and timeslots defined for the correct semester type (regular or summer). Missing any of these won't always stop the run, but it produces empty sessions or misleading conflicts. Check the Courses, Lecturers, Rooms, and Time Slots pages in the sidebar before starting.`,
  },
  {
    id: "gen-draft-vs-published",
    category: "timetable-generation",
    question: "How should I treat a draft timetable versus a published one?",
    answer: `A draft is private - only admins see it and it has no effect on lecturers or exports. After running the optimizer, review the draft in the Schedule Viewer: check conflict counts, room utilization, and lecturer load. When you're satisfied, select the draft in Schedule Viewer, choose the academic year and semester, and click Publish. Publishing makes it the official timetable and triggers lecturer notifications.`,
  },
  {
    id: "gen-parameter-changes",
    category: "timetable-generation",
    question: "Why do small parameter changes sometimes produce very different results?",
    answer: `Timetabling is a constrained search - tightening one rule can eliminate many valid solutions at once. If a small change surprises you, save both runs as What-If scenarios and compare their conflict breakdowns side by side rather than trying to reason about it from the parameters alone.`,
  },
  {
    id: "conflict-hard-soft",
    category: "conflicts",
    question: "What is the difference between hard and soft conflicts?",
    answer: `Hard conflicts are rule violations the system cannot ignore - a double-booked room, a lecturer assigned to two sessions at the same time, or a cohort with overlapping required courses. Soft conflicts are preferences that weren't fully satisfied - a lecturer scheduled outside their preferred hours, or uneven workload spread. Fix hard conflicts first. If soft conflicts are overwhelming, either your constraint weights are too strict or your master data has gaps (missing room tags, incomplete timeslots).`,
  },
  {
    id: "conflict-lecturer-locations",
    category: "conflicts",
    question: "A lecturer is showing back-to-back sessions in different locations. Where do I start?",
    answer: `First check the lecturer's assigned rooms on the Lecturers page and confirm whether those rooms are physically in different locations. Then check whether the two sessions are in the same timeslot or adjacent ones. If the data is correct but the result is still unacceptable, create a What-If scenario with adjusted room pools or constraints for that lecturer and compare the outcome before touching the live timetable.`,
  },
  {
    id: "conflict-cohort-overlaps",
    category: "conflicts",
    question: "We see student cohort overlaps that look impossible. What usually causes this?",
    answer: `The most common causes are a course appearing more than once in a study plan, two courses that should be mutually exclusive sharing the same cohort pool, or elective sections not being properly separated. Start by opening Study Plans in the sidebar and verifying each course appears only once per plan and per year level. Fix the data first, then re-run generation - manual moves on top of bad data will keep recurring.`,
  },
  {
    id: "reports-before-publish",
    category: "reports-exports",
    question: "Which reports are most useful for reviewing a timetable before publishing?",
    answer: `Use the utilization summary to check room occupancy rates and spot over- or under-used spaces. Use the workload summary to verify lecturer hours are within contracted limits. Use the conflict summary to confirm no hard violations remain. All three are available from the Reports page in the sidebar. Export them to Excel or PDF to share with department heads before giving final approval.`,
  },
  {
    id: "exports-excel-vs-pdf",
    category: "reports-exports",
    question: "The Excel export from Schedule Viewer doesn't match the PDF a lecturer is holding. Is that a bug?",
    answer: `Usually not. The most common cause is that both exports are not from the same published timetable - one may be from a draft or an older version. Confirm both were exported from the same published timetable by checking the academic year and semester shown in the Schedule Viewer filter before exporting. If they still differ, check whether any filters (lecturer, room, or program) were active when one of the exports was made.`,
  },
  {
    id: "entities-study-plans-midcycle",
    category: "entities",
    question: "Study plans changed mid-cycle. How do we avoid breaking the live timetable?",
    answer: `Avoid editing study plans while a published timetable is active if possible. When changes are unavoidable, update the plan, then run a new draft generation and review it fully before publishing. Do not publish the new draft until department coordinators have confirmed the changes are correct - publishing replaces the live schedule immediately and lecturers are notified automatically.`,
  },
  {
    id: "entities-room-tags-vs-notes",
    category: "entities",
    question: "When should I use room tags versus just leaving a note on the room?",
    answer: `Use tags for anything that must influence where a course is placed - lab equipment, flat-floor requirement, IT lab setup, exam capacity, or projector availability. The optimizer reads tags and respects them during placement. Notes are for humans only and are invisible to the optimizer. If a constraint matters to scheduling, model it as a tag or it will keep causing the same soft conflicts every run.`,
  },
  {
    id: "entities-timeslot-semester-type",
    category: "entities",
    question: "How do timeslot types affect generation for summer versus regular semesters?",
    answer: `Timeslots in your system are marked as either regular or summer type. The optimizer only uses timeslots that match the semester mode you select when running generation. If you run in summer mode and have no summer timeslots defined, the run will produce empty or broken results. Verify your timeslots on the Time Slots page and make sure the correct semester type is assigned before running.`,
  },
  {
    id: "access-lecturer-vs-admin",
    category: "access-roles",
    question: "What can lecturers do in the system versus administrators?",
    answer: `Lecturers can set their time preferences, view their personal schedule, view the courses assigned to them, and submit course modification requests. They cannot run generation, publish timetables, edit rooms or courses, manage other users, or access What-If scenarios. If a lecturer cannot reach a page they need, check that their account is active and their role is set correctly on the Lecturers page.`,
  },
  {
    id: "access-lecturer-request",
    category: "access-roles",
    question: "How does a lecturer request access to the system?",
    answer: `Lecturers go to the public access request page (linked from the login screen) and submit their details. The request appears in the Access Requests queue in the admin sidebar. An admin reviews it, verifies the details, and approves or rejects it. Once approved, the lecturer receives an email with login instructions. If a request is stuck, check the Access Requests page - it may be waiting for admin action.`,
  },
  {
    id: "what-if-when-to-use",
    category: "what-if",
    question: "When should I use a What-If scenario instead of editing the live timetable directly?",
    answer: `Use What-If when the change touches shared resources - a room used by multiple departments, a lecturer shared across programs, or a cohort with linked required courses. For a single cosmetic move with no ripple effects, a direct edit in Schedule Viewer is faster. Name your scenarios clearly (e.g. "CS dept - move lab sessions to morning") so you can compare results meaningfully and explain the choice to stakeholders.`,
  },
  {
    id: "what-if-compare-runs",
    category: "what-if",
    question: "How do I compare two What-If runs fairly?",
    answer: `Use the same base timetable for both runs and change only one variable between them. Then open the Compare view from the What-If page to see a side-by-side breakdown of conflict counts and soft metric scores. If the runs used different random seeds and results vary widely, run each scenario a second time - large swings between seeds usually mean the constraint setup is too tight rather than one configuration being genuinely better.`,
  },
  {
    id: "what-if-publish-from-scenario",
    category: "what-if",
    question: "How do I publish a timetable that came from a What-If scenario?",
    answer: `You cannot publish a What-If result directly. First, go to the What-If page, open the scenario, and click Apply to timetable - this replaces the base timetable's schedule with the scenario result. If the base timetable is already published, it is now live immediately with no further steps. If the base is a draft, go to Schedule Viewer, select it, and click Publish to make it official.`,
  },
  {
    id: "saving-store-database",
    category: "saving-publishing",
    question: "Where do I save a generated timetable to the database?",
    answer: `After the optimizer finishes, go to the Rooms & Timeslots Grid tab on the Timetable Generation page and click "Store in database." This saves the current result as a new draft version. You will see a confirmation with the timetable ID and version number. The draft is then available in Schedule Viewer for review and publishing.`,
  },
  {
    id: "saving-apply-whatif",
    category: "saving-publishing",
    question: "What happens to the existing timetable when I apply a What-If result?",
    answer: `The base timetable's entire schedule is replaced with the scenario result - all session placements, room assignments, and metrics are overwritten. The result timetable is then deleted since its data now lives in the base. This cannot be undone, so open the result in Schedule Viewer and review it carefully before clicking Apply.`,
  },
  {
    id: "saving-manual-edit-after-generation",
    category: "saving-publishing",
    question: "Can I manually edit a timetable after generation?",
    answer: `Yes. On the Timetable Generation page, go to the Rooms & Timeslots Grid tab and click "Edit timetable." You can drag sessions to different rooms and timeslots. When done, click "Save to workspace file" to keep your changes, then "Store in database" to save the edited version as a draft. You can also edit directly in Schedule Viewer using the same Edit mode. Manual edits are checked against hard constraints in real time and violations are flagged immediately.`,
  },
];

export const HOSTED_VIDEO_TUTORIALS: readonly HostedVideoTutorial[] = [
  {
    id: "quick-start-hosted",
    title: "From data to published timetable",
    tagline: "Full system walkthrough · tap for full screen",
    description:
      "Covers the dashboard, course and lecturer data, the Grey Wolf Optimizer, scenario planning, and publishing - the end-to-end path a coordinator takes each term.",
    mp4Url:
      "https://res.cloudinary.com/dhiwczysm/video/upload/v1778765331/Quick_Start_Guide_xiquvy.mp4",
    posterUrl:
      "https://res.cloudinary.com/dhiwczysm/video/upload/w_1280,h_720,c_fill,q_auto,f_jpg/so_1/v1778765331/Quick_Start_Guide_xiquvy.jpg",
  },
];

export const HELP_PDF_GUIDES: readonly HelpPdfGuide[] = [
  {
    id: "pdf-timetable-generation",
    title: "Timetable generation (PDF)",
    description:
      "Start and monitor a generation run, read results and conflicts, and know when the timetable is safe to treat as final.",
    comingSoon: true,
  },
  {
    id: "pdf-reports",
    title: "Reports (PDF)",
    description:
      "Use the Reports page to pick semester and report type, then export PDF or Excel for committees and audits.",
    comingSoon: true,
  },
  {
    id: "pdf-dashboard-charts",
    title: "Dashboard & charts (PDF)",
    description:
      "Read dashboard summary metrics and course analytics charts to track load and catch problems during the term.",
    comingSoon: true,
  },
];
