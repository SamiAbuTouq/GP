"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function ConstraintSatisfaction() {
  const constraints = [
    {
      label: "Hard Constraints",
      value: 100,
      color: "bg-emerald-500",
      trackColor: "bg-emerald-500/20",
      textColor: "text-emerald-600 dark:text-emerald-400",
      description: "All mandatory rules satisfied",
    },
    {
      label: "Soft Constraints",
      value: 87,
      color: "bg-amber-500",
      trackColor: "bg-amber-500/20",
      textColor: "text-amber-600 dark:text-amber-400",
      description: "Good preference optimization",
    },
    {
      label: "Overall Quality Score",
      value: 92,
      color: "bg-blue-600",
      trackColor: "bg-blue-600/20",
      textColor: "text-blue-600 dark:text-blue-400",
      description: "Excellent scheduling performance",
    },
  ]

  return (
    <Card className="border bg-card shadow-sm">
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-foreground">Constraint Satisfaction</h3>
            <p className="text-sm text-muted-foreground">Current timetable quality assessment</p>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15 shrink-0">
            High Quality
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {constraints.map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{item.label}</span>
                <span className={`text-sm font-bold ${item.textColor}`}>{item.value}%</span>
              </div>
              <div className={`relative h-2.5 w-full overflow-hidden rounded-full ${item.trackColor}`}>
                <div
                  className={`h-full rounded-full transition-all ${item.color}`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
