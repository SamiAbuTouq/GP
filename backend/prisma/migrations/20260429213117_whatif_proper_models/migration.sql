-- CreateTable
CREATE TABLE "scenario_condition" (
    "condition_id" SERIAL NOT NULL,
    "scenario_id" INTEGER NOT NULL,
    "condition_type" VARCHAR(50) NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "scenario_condition_pkey" PRIMARY KEY ("condition_id")
);

-- CreateTable
CREATE TABLE "scenario_run" (
    "run_id" SERIAL NOT NULL,
    "scenario_id" INTEGER NOT NULL,
    "base_timetable_id" INTEGER NOT NULL,
    "result_timetable_id" INTEGER,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "baseline_metrics" JSONB,
    "result_metrics" JSONB,
    "gwo_iterations_run" INTEGER,
    "generation_seconds" DOUBLE PRECISION,

    CONSTRAINT "scenario_run_pkey" PRIMARY KEY ("run_id")
);

-- CreateIndex
CREATE INDEX "scenario_condition_scenario_id_idx" ON "scenario_condition"("scenario_id");

-- CreateIndex
CREATE INDEX "scenario_run_scenario_id_idx" ON "scenario_run"("scenario_id");

-- CreateIndex
CREATE INDEX "scenario_run_base_timetable_id_idx" ON "scenario_run"("base_timetable_id");

-- AddForeignKey
ALTER TABLE "scenario_condition" ADD CONSTRAINT "scenario_condition_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenario"("scenario_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_run" ADD CONSTRAINT "scenario_run_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenario"("scenario_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_run" ADD CONSTRAINT "scenario_run_base_timetable_id_fkey" FOREIGN KEY ("base_timetable_id") REFERENCES "timetable"("timetable_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_run" ADD CONSTRAINT "scenario_run_result_timetable_id_fkey" FOREIGN KEY ("result_timetable_id") REFERENCES "timetable"("timetable_id") ON DELETE SET NULL ON UPDATE CASCADE;
