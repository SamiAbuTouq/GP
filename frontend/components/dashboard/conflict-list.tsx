"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertTriangle, ExternalLink } from "lucide-react"
import Link from "next/link"

/** Conflict detection is driven by the solver / API; this shell stays empty until wired. */
const conflicts: { id: number; type: string; description: string; severity: string }[] = []

export function ConflictList() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Active Conflicts</CardTitle>
          <CardDescription>Issues requiring attention</CardDescription>
        </div>
        <Link href="/what-if">
          <Button variant="outline" size="sm">
            View All
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[250px] pr-4">
          <div className="space-y-4">
            {conflicts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No conflicts are listed here yet. Scheduling data comes from the database after import or generation.
              </p>
            ) : (
              conflicts.map((conflict) => (
                <div key={conflict.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{conflict.type} Conflict</span>
                      <Badge variant={conflict.severity === "High" ? "destructive" : "secondary"} className="text-xs">
                        {conflict.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{conflict.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
