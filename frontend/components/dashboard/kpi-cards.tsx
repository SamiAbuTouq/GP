"use client"

import { Card } from "@/components/ui/card"
import {
  Users,
  BookOpen,
  DoorOpen,
  AlertTriangle,
  Clock,
  GraduationCap,
  Zap,
  Timer,
  TrendingUp,
  TrendingDown,
} from "lucide-react"

interface KPIData {
  totalStudents: number
  totalCourses: number
  totalLecturers: number
  roomUtilization: number
  conflictRate: number
  timeSlots: number
  optimizationScore: number
  avgProcessing: number
}

interface KPICardsProps {
  data: KPIData
}

const kpis = [
  {
    key: "totalStudents" as const,
    label: "TOTAL STUDENTS",
    icon: GraduationCap,
    change: "+5.2%",
    up: true,
    fmt: (v: number) => v.toLocaleString(),
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-50 dark:bg-blue-500/10",
  },
  {
    key: "totalCourses" as const,
    label: "ACTIVE COURSES",
    icon: BookOpen,
    change: "+3",
    up: true,
    fmt: (v: number) => v.toString(),
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-50 dark:bg-blue-500/10",
  },
  {
    key: "roomUtilization" as const,
    label: "ROOM UTILIZATION",
    icon: DoorOpen,
    change: "+4.5%",
    up: true,
    fmt: (v: number) => `${v}%`,
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-50 dark:bg-blue-500/10",
  },
  {
    key: "conflictRate" as const,
    label: "CONFLICT RATE",
    icon: AlertTriangle,
    change: "-1.2%",
    up: false,
    fmt: (v: number) => `${v}%`,
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-50 dark:bg-blue-500/10",
  },
  {
    key: "totalLecturers" as const,
    label: "LECTURERS",
    icon: Users,
    change: "+8",
    up: true,
    fmt: (v: number) => v.toString(),
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
  },
  {
    key: "timeSlots" as const,
    label: "TIME SLOTS",
    icon: Clock,
    change: "0",
    up: null,
    fmt: (v: number) => v.toString(),
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
  },
  {
    key: "optimizationScore" as const,
    label: "OPTIMIZATION SCORE",
    icon: Zap,
    change: "+2.1%",
    up: true,
    fmt: (v: number) => `${v}%`,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
  },
  {
    key: "avgProcessing" as const,
    label: "AVG PROCESSING",
    icon: Timer,
    change: "-0.5s",
    up: true,
    fmt: (v: number) => `${v}s`,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
  },
]

export function KPICards({ data }: KPICardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        const value = data[kpi.key]
        const isPositiveChange = kpi.up === true
        const isNegativeChange = kpi.up === false
        const isNeutral = kpi.up === null

        return (
          <Card key={kpi.key} className="hover:shadow-md transition-shadow">
            <div className="pt-4 px-5 pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {kpi.label}
                  </p>
                  <p className="text-xl lg:text-2xl font-bold text-foreground mt-0.5">
                    {kpi.fmt(value)}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {!isNeutral && (
                      <>
                        {isPositiveChange ? (
                          <TrendingUp className="w-3 h-3 text-emerald-500" />
                        ) : isNegativeChange ? (
                          <TrendingDown className="w-3 h-3 text-red-500" />
                        ) : null}
                        <span
                          className={`text-xs font-semibold ${
                            isPositiveChange
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {kpi.change}
                        </span>
                      </>
                    )}
                    {isNeutral && (
                      <>
                        <TrendingUp className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">{kpi.change}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className={`p-2.5 rounded-xl ${kpi.iconBg}`}>
                  <Icon className={`w-5 h-5 ${kpi.iconColor}`} />
                </div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
