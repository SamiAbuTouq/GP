export type OptimizerOwner = 'timetable' | 'whatif';
export declare function tryAcquireOptimizerGlobalLock(owner: OptimizerOwner): {
    ok: true;
} | {
    ok: false;
    holder: OptimizerOwner;
};
export declare function releaseOptimizerGlobalLock(owner: OptimizerOwner): void;
