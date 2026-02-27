"use client"

import { useState, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { DashboardFilters } from "@/components/dashboard/filters"
import { AnalyticsOverview } from "@/components/dashboard/charts"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { ConstraintSatisfaction } from "@/components/dashboard/constraint-satisfaction"
import { kpiDataBySemester, kpiDataByDepartment, kpiDataByCollege } from "@/lib/data"

export default function DashboardPage() {
  const [semester, setSemester] = useState("fall-2024")
  const [department, setDepartment] = useState("all")
  const [college, setCollege] = useState("all")

  const filteredKPIData = useMemo(() => {
    const semesterData = kpiDataBySemester[semester] || kpiDataBySemester["fall-2024"]
    const deptData = kpiDataByDepartment[department] || kpiDataByDepartment["all"]
    const collegeData = kpiDataByCollege[college] || kpiDataByCollege["all"]

    if (college !== "all") {
      return {
        totalStudents: collegeData.students,
        totalCourses: collegeData.courses,
        totalLecturers: collegeData.lecturers,
        roomUtilization: collegeData.utilization,
        conflictRate: collegeData.conflictRate,
        timeSlots: 42,
        optimizationScore: 94.2,
        avgProcessing: 2.3,
      }
    }

    if (department !== "all") {
      return {
        totalStudents: deptData.students,
        totalCourses: deptData.courses,
        totalLecturers: deptData.lecturers,
        roomUtilization: deptData.utilization,
        conflictRate: semesterData.conflictRate,
        timeSlots: 42,
        optimizationScore: 94.2,
        avgProcessing: 2.3,
      }
    }

    return {
      totalStudents: semesterData.totalStudents,
      totalCourses: semesterData.totalCourses,
      totalLecturers: semesterData.totalLecturers,
      roomUtilization: semesterData.roomUtilization,
      conflictRate: semesterData.conflictRate,
      timeSlots: 42,
      optimizationScore: 94.2,
      avgProcessing: 2.3,
    }
  }, [semester, department, college])

  const handleRefresh = () => {
    console.log("Refreshing data...")
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mb-5">
            <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">University Course Timetabling System Overview</p>
          </div>

          <div className="mb-5">
            <DashboardFilters
              semester={semester}
              department={department}
              college={college}
              onSemesterChange={setSemester}
              onDepartmentChange={setDepartment}
              onCollegeChange={setCollege}
              onRefresh={handleRefresh}
            />
          </div>

          <div className="mb-5">
            <KPICards data={filteredKPIData} />
          </div>

          <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <AnalyticsOverview />
            </div>
            <div className="xl:col-span-1">
              <RecentActivity />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-1">
            <ConstraintSatisfaction />
          </div>
        </main>
      </div>
    </div>
  )
}
