import {
  computeLecturerGapWarnings,
  computePreferenceWarnings,
  computeSingleSessionDayWarnings,
  computeStudentGapWarnings,
} from "./schedule-soft-metrics";

describe("schedule-soft-metrics", () => {
  const prefs = {
    Alice: { preferred: ["slot_1"], unpreferred: ["slot_3"] },
  };

  it("flags unpreferred and not-preferred timeslots", () => {
    const warnings = computePreferenceWarnings(
      [
        {
          lecturer: "Alice",
          course_code: "CS101",
          timeslot: "slot_3",
        },
        {
          lecturer: "Alice",
          course_code: "CS102",
          timeslot: "slot_2",
        },
      ],
      prefs,
    );
    expect(warnings).toHaveLength(2);
    expect(warnings[0]?.severity).toBe("unpreferred");
    expect(warnings[1]?.severity).toBe("not_preferred");
  });

  it("detects lecturer gaps on the same day", () => {
    const warnings = computeLecturerGapWarnings(
      [
        {
          lecturer: "Bob",
          course_code: "MATH",
          timeslot: "slot_1",
          days: ["Monday"],
          start_hour: 9,
          duration: 1.5,
        },
        {
          lecturer: "Bob",
          course_code: "PHYS",
          timeslot: "slot_2",
          days: ["Monday"],
          start_hour: 12,
          duration: 1.5,
        },
      ],
      new Map([
        ["slot_1", "Mon 09:00"],
        ["slot_2", "Mon 12:00"],
      ]),
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.gap_hours).toBe(1.5);
    expect(warnings[0]?.lecturer).toBe("Bob");
  });

  it("detects student cohort gaps", () => {
    const warnings = computeStudentGapWarnings(
      [
        {
          lecturer: "L1",
          course_code: "CS101",
          timeslot: "slot_1",
          days: ["Tuesday"],
          start_hour: 8,
          duration: 2,
        },
        {
          lecturer: "L2",
          course_code: "CS102",
          timeslot: "slot_2",
          days: ["Tuesday"],
          start_hour: 11,
          duration: 1,
        },
      ],
      { "CompEng | Y1 | S1": ["CS101", "CS102"] },
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.unit).toBe("CompEng | Y1 | S1");
    expect(warnings[0]?.gap_hours).toBe(1);
  });

  it("flags single-session days for cohorts and lecturers", () => {
    const warnings = computeSingleSessionDayWarnings(
      [
        {
          lecturer: "Eve",
          course_code: "CS101",
          timeslot: "slot_1",
          days: ["Wednesday"],
          start_hour: 10,
          duration: 1,
        },
        {
          lecturer: "Eve",
          course_code: "CS102",
          timeslot: "slot_2",
          days: ["Thursday"],
          start_hour: 10,
          duration: 1,
        },
      ],
      { UnitA: ["CS101"] },
    );
    const cohort = warnings.filter((w) => w.unit === "UnitA");
    const lecturer = warnings.filter((w) => w.unit === "Eve");
    expect(cohort).toHaveLength(1);
    expect(lecturer).toHaveLength(2);
  });
});
