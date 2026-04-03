"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertTriangle, ExternalLink } from "lucide-react"
import { mockConflicts } from "@/lib/data"
import Link from "next/link"

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
            {mockConflicts.map((conflict) => (
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
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
