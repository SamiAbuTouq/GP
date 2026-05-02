import { PrismaService } from '../prisma/prisma.service';
export declare class TimetablesService {
    private prisma;
    constructor(prisma: PrismaService);
    private mapTimetableSummary;
    list(semesterId?: number, draftsOnly?: boolean, scenarioRunBasesOnly?: boolean): Promise<{
        timetableId: any;
        semesterId: any;
        academicYear: any;
        semesterType: any;
        semester: string;
        totalStudents: any;
        generatedAt: any;
        status: any;
        generationType: any;
        versionNumber: any;
        isDraft: boolean;
        isPublished: boolean;
        isScenarioResult: boolean;
        draftOrigin: "scenario" | "optimizer" | "other" | null;
        canUseAsScenarioBase: boolean;
        timetableKind: string;
        metrics: {
            roomUtilizationRate: any;
            softConstraintsScore: any;
            fitnessScore: any;
            isValid: any;
        } | null;
    }[]>;
    getTimetableConflictSummary(timetableId: number): Promise<{
        timetableId: number;
        metricsIsValid: boolean | null;
        requiresConflictAcknowledgment: boolean;
        hardConflictCount: number;
        conflicts: {
            conflictId: number;
            timetableId: number;
            conflictType: string;
            severity: string;
            courseCode: string;
            sectionNumber: string;
            lecturerName: string | null;
            roomNumber: string | null;
            timeslotLabel: string | null;
            detail: string;
        }[];
    }>;
    ensureHardConflictsAcknowledged(timetableId: number, acknowledgedHardConflicts: boolean | undefined): Promise<void>;
    publishDraftTimetable(timetableId: number, params: {
        academicYear?: string;
        semesterType?: number;
        acknowledgedHardConflicts?: boolean;
    }): Promise<{
        timetableId: any;
        semesterId: any;
        academicYear: any;
        semesterType: any;
        semester: string;
        totalStudents: any;
        generatedAt: any;
        status: any;
        generationType: any;
        versionNumber: any;
        isDraft: boolean;
        isPublished: boolean;
        isScenarioResult: boolean;
        draftOrigin: "scenario" | "optimizer" | "other" | null;
        canUseAsScenarioBase: boolean;
        timetableKind: string;
        metrics: {
            roomUtilizationRate: any;
            softConstraintsScore: any;
            fitnessScore: any;
            isValid: any;
        } | null;
    }>;
    listEntries(params: {
        timetableId: number;
        courseId?: number;
        lecturerUserId?: number;
        roomId?: number;
    }): Promise<{
        entryId: number;
        timetableId: number;
        slotId: number;
        courseId: number;
        courseCode: string;
        courseName: string;
        lecturerUserId: number | null;
        lecturerName: string;
        roomId: number;
        roomNumber: string;
        daysMask: number;
        days: string[];
        startTime: string;
        endTime: string;
        sectionNumber: string;
        isLab: boolean;
        registeredStudents: number;
        sectionCapacity: number;
        isOnline: boolean;
    }[]>;
    buildSchedulePayload(timetableId: number): Promise<{
        schedule: {
            lecture_id: string;
            template_lecture_id: string;
            section_number: string;
            course_code: string;
            course_name: string;
            room: string | null;
            room_capacity: number;
            class_size: number;
            timeslot: string;
            timeslot_label: string;
            day: string;
            lecturer: string;
            allowed_lecturers: string[];
            preference_issues: never[];
            has_pref_warning: boolean;
            delivery_mode: string;
            session_type: string;
            slot_type: string;
            days: string[];
            start_hour: number;
            duration: number;
            room_type: string;
            room_required: boolean;
        }[];
        metadata: {
            total_lectures: number;
            total_rooms: number;
            total_timeslots: number;
            total_lecturers: number;
            conflicts: number;
            iterations: null;
            wolves: null;
            best_fitness: number | null;
            generated_at: string;
            algorithm: string;
            soft_preference_warnings: number;
            gap_warnings: number;
            overload_violations: number;
            max_classes_per_lecturer: number;
            total_slots: number;
            used_slots: number;
            utilization_pct: number;
            timetable_seat_utilization_pct: number;
            workload_penalty: number;
            distribution_penalty: number;
            soft_weights: {
                preferred_timeslot: number;
                unpreferred_timeslot: number;
                minimize_gaps: number;
                room_utilization: number;
                balanced_workload: number;
                distribute_classes: number;
                student_gaps: number;
                single_session_day: number;
            };
            unit_conflict_count: number;
            student_gap_count: number;
            single_session_day_count: number;
        };
        lecturer_summary: {
            name: string;
            teaching_load: number;
            max_load: number;
            overloaded: boolean;
            courses: string[];
            preferred_slots: string[];
            unpreferred_slots: string[];
            warning_count: number;
            warnings: never[];
            gap_count: number;
        }[];
        preference_warnings: never[];
        gap_warnings: never[];
        utilization_info: {
            room: string;
            course: string;
            timeslot: string;
            capacity: number;
            class_size: number;
            wasted_seats: number;
            waste_pct: number;
            is_empty: boolean;
            penalty: number;
            room_type: string;
            days: string[];
            start_hour: number;
            duration: number;
            slot_type: string;
        }[];
        workload_info: {
            lecturer: string;
            classes: number;
            credit_hour_load: number;
            max_workload: number;
            within_limit: boolean;
        }[];
        distribution_info: {
            timeslot: string;
            classes: number;
            slot_type: string | undefined;
        }[];
        room_summary: {
            name: string;
            capacity: number;
            used_slots: number;
            total_slots: number;
            total_wasted_seats: number;
            avg_waste_pct: number;
            room_type: string;
        }[];
        lecturer_preferences: Record<string, {
            preferred: string[];
            unpreferred: string[];
        }>;
        soft_weights: {
            preferred_timeslot: number;
            unpreferred_timeslot: number;
            minimize_gaps: number;
            room_utilization: number;
            balanced_workload: number;
            distribute_classes: number;
            student_gaps: number;
            single_session_day: number;
        };
        timeslots_catalogue: {
            id: string;
            days: string[];
            start_hour: number;
            duration: number;
            slot_type: string;
            start_time: string;
            duration_minutes: number;
        }[];
        room_types_map: Record<string, string>;
        wrong_slot_type_violations: {
            lecture: string;
            assigned_type: string;
            delivery_mode: string;
            session_type: string;
        }[];
        study_plan_units: {};
        study_plan_summary: never[];
        unit_conflict_violations: {
            unit: string;
            course_a: string;
            course_b: string;
            timeslot_a: string;
            timeslot_b: string;
        }[];
        student_gap_warnings: never[];
        single_session_day_warnings: never[];
    }>;
    replaceScheduleFromPayload(timetableId: number, scheduleRaw: unknown): Promise<{
        ok: boolean;
        timetableId: number;
        entryCount: number;
    }>;
}
