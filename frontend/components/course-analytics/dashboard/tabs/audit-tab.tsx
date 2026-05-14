'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/course-analytics-ui/card'
import { RoomWasteTable } from '@/components/course-analytics/dashboard/charts'
import { ActionCenterPanel } from '@/components/course-analytics/dashboard/action-center-panel'
import {
  AcademicWeightBarChart,
  CampusDensityLineChart,
  DeliveryModeDonutChart,
  DepartmentSaturationBarChart,
  LecturerStressScatterChart,
  RoomEfficiencyHeatmap,
  SlotPatternBarChart,
} from '@/components/course-analytics/dashboard/decision-charts'
import type {
  ActionInsight,
  AcademicWeightRow,
  CampusDensityPoint,
  DepartmentData,
  LecturerStressPoint,
  OnlineModeData,
  RoomHourEfficiencyCell,
  RoomWasteData,
  SlotPatternDensityRow,
} from '@/lib/course-analytics/course-data'

interface AuditTabProps {
  departmentData: DepartmentData[]
  onlineModeData: OnlineModeData[]
  lecturerStress: LecturerStressPoint[]
  slotPatterns: SlotPatternDensityRow[]
  campusDensity: CampusDensityPoint[]
  roomHourCells: RoomHourEfficiencyCell[]
  academicWeight: AcademicWeightRow[]
  roomWasteData: RoomWasteData[]
  actionInsights: ActionInsight[]
  totalPhysicalRoomWaste: number
}

export function AuditTab({
  departmentData,
  onlineModeData,
  lecturerStress,
  slotPatterns,
  campusDensity,
  roomHourCells,
  academicWeight,
  roomWasteData,
  actionInsights,
  totalPhysicalRoomWaste,
}: AuditTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_340px] xl:items-start">
        <div className="space-y-6">
          <Card className="border-primary/15 bg-primary/[0.03]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Historical audit mode</CardTitle>
              <CardDescription>
                Operational readout for the selected filters: all values are computed from stored section schedules (Prisma-backed
                API), using Registered_Students, Section_Capacity, credit hours, lecturer identifiers, course codes, and meeting
                times—no synthetic enrollment projections.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Aggregate unused physical seats in this view:{' '}
                <span className="font-semibold tabular-nums text-foreground">{totalPhysicalRoomWaste.toLocaleString()}</span>{' '}
                (Σ capacity − Σ enrollment, on-campus rooms only).
              </p>
            </CardContent>
          </Card>

          <DepartmentSaturationBarChart data={departmentData} />

          <div className="grid gap-6 lg:grid-cols-2">
            <LecturerStressScatterChart data={lecturerStress} />
            <DeliveryModeDonutChart data={onlineModeData} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <RoomEfficiencyHeatmap cells={roomHourCells} />
            <SlotPatternBarChart data={slotPatterns} />
          </div>

          <CampusDensityLineChart data={campusDensity} />

          <div className="grid gap-6 lg:grid-cols-2">
            <AcademicWeightBarChart data={academicWeight} />
            <RoomWasteTable data={roomWasteData} className="min-h-[360px]" />
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24">
          <ActionCenterPanel insights={actionInsights} />
        </div>
      </div>
    </div>
  )
}
