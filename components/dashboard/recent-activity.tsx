"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, Zap, Settings } from "lucide-react"

const activities = [
  {
    id: 1,
    type: "success",
    title: "Timetable published",
    description: "Fall 2024 - Computer Science",
    time: "2 hours ago",
    icon: CheckCircle2,
    iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: 2,
    type: "error",
    title: "Conflict detected",
    description: "Room overlap in Engineering block",
    time: "5 hours ago",
    icon: XCircle,
    iconBg: "bg-red-500/10 dark:bg-red-500/20",
    iconColor: "text-red-600 dark:text-red-400",
  },
  {
    id: 3,
    type: "info",
    title: "Generation completed",
    description: "Spring 2024 - Mathematics",
    time: "1 day ago",
    icon: Zap,
    iconBg: "bg-blue-500/10 dark:bg-blue-500/20",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: 4,
    type: "settings",
    title: "Settings updated",
    description: "Constraint weights modified by Admin",
    time: "2 days ago",
    icon: Settings,
    iconBg: "bg-pink-500/10 dark:bg-pink-500/20",
    iconColor: "text-pink-600 dark:text-pink-400",
  },
]

export function RecentActivity() {
  return (
    <Card className="border bg-card shadow-sm h-full">
      <CardHeader className="pb-4 pt-6 px-6">
        <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="space-y-5">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${activity.iconBg}`}>
                <activity.icon className={`h-5 w-5 ${activity.iconColor}`} />
              </div>
              <div className="flex-1 space-y-0.5">
                <p className="text-sm font-semibold text-foreground">{activity.title}</p>
                <p className="text-sm text-muted-foreground">{activity.description}</p>
                <p className="text-xs text-muted-foreground/70">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
