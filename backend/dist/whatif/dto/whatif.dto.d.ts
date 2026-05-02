export declare enum ConditionType {
    ADD_LECTURER = "add_lecturer",
    DELETE_LECTURER = "delete_lecturer",
    AMEND_LECTURER = "amend_lecturer",
    ADD_ROOM = "add_room",
    DELETE_ROOM = "delete_room",
    ADJUST_ROOM_CAPACITY = "adjust_room_capacity",
    ADD_COURSE = "add_course",
    CHANGE_SECTION_COUNT = "change_section_count",
    CHANGE_DELIVERY_MODE = "change_delivery_mode",
    ADD_TIMESLOT = "add_timeslot",
    DELETE_TIMESLOT = "delete_timeslot"
}
export declare class AddLecturerParams {
    firstName: string;
    lastName: string;
    deptId: number;
    maxWorkload: number;
    teachableCourseIds: number[];
}
export declare class DeleteLecturerParams {
    lecturerUserId: number;
}
export declare class AmendLecturerParams {
    lecturerUserId: number;
    teachableCourseIds?: number[];
    maxWorkload?: number;
}
export declare class AddRoomParams {
    roomNumber: string;
    roomType: number;
    capacity: number;
    isAvailable: boolean;
}
export declare class DeleteRoomParams {
    roomId: number;
}
export declare class AdjustRoomCapacityParams {
    roomId: number;
    newCapacity: number;
}
export declare class AddCourseParams {
    courseCode: string;
    courseName: string;
    deptId: number;
    academicLevel: number;
    isLab: boolean;
    creditHours: number;
    deliveryMode: string;
    sectionsNormal: number;
    sectionsSummer: number;
    assignableLecturerIds: number[];
}
export declare class ChangeSectionCountParams {
    courseId: number;
    newSectionsNormal: number;
    newSectionsSummer?: number;
}
export declare class ChangeDeliveryModeParams {
    courseId: number;
    newDeliveryMode: string;
}
export declare class AddTimeslotParams {
    startTime: string;
    endTime: string;
    daysMask: number;
    slotType: string;
    isSummer: boolean;
}
export declare class DeleteTimeslotParams {
    slotId: number;
}
export declare class ConditionDto {
    type: ConditionType;
    parameters: Record<string, unknown>;
    orderIndex?: number;
}
export declare class CreateScenarioDto {
    name: string;
    description?: string;
    conditions?: ConditionDto[];
}
export declare class UpdateScenarioDto {
    name?: string;
    description?: string;
    conditions?: ConditionDto[];
}
export declare class RunScenarioDto {
    timetableIds: number[];
}
export declare class ControlRunDto {
    action: 'pause' | 'resume';
}
export declare enum CompareMode {
    BEFORE_AFTER = "before_after",
    CROSS_TIMETABLE = "cross_timetable",
    CROSS_SCENARIO = "cross_scenario"
}
export declare class CompareDto {
    mode: CompareMode;
    runIds: number[];
}
export declare class ApplyScenarioRunDto {
    acknowledgedHardConflicts?: boolean;
}
export declare class DeleteScenarioQueryDto {
    force?: boolean;
}
