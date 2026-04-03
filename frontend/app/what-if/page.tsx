"use client"

import { useState, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Plus,
  Play,
  Trash2,
  GitCompare,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Copy,
  Eye,
  ArrowRight,
  Minus,
} from "lucide-react"

interface Scenario {
  id: number
  name: string
  description: string
  status: "completed" | "running" | "pending"
  conflicts: number | null
  utilization: number | null
  lecturerBalance: number | null
  studentConflicts: number | null
  avgClassSize: number | null
  createdAt: string
}

const mockScenarios: Scenario[] = [
  {
    id: 1,
    name: "Base Scenario",
    description: "Current timetable configuration",
    status: "completed",
    conflicts: 3,
    utilization: 78,
    lecturerBalance: 65,
    studentConflicts: 15,
    avgClassSize: 32,
    createdAt: "2024-01-15",
  },
  {
    id: 2,
    name: "Add New Lab Room",
    description: "What if we add room R401 as a lab?",
    status: "completed",
    conflicts: 2,
    utilization: 82,
    lecturerBalance: 72,
    studentConflicts: 8,
    avgClassSize: 34,
    createdAt: "2024-01-16",
  },
  {
    id: 3,
    name: "Increase CS101 Sections",
    description: "Add 2 more sections for CS101",
    status: "completed",
    conflicts: 4,
    utilization: 85,
    lecturerBalance: 60,
    studentConflicts: 12,
    avgClassSize: 28,
    createdAt: "2024-01-17",
  },
  {
    id: 4,
    name: "Remove Thursday Classes",
    description: "No classes on Thursday afternoons",
    status: "pending",
    conflicts: null,
    utilization: null,
    lecturerBalance: null,
    studentConflicts: null,
    avgClassSize: null,
    createdAt: "2024-01-17",
  },
]

const metricDefinitions = [
  { key: "conflicts", name: "Total Conflicts", unit: "", better: "lower" as const },
  { key: "utilization", name: "Room Utilization", unit: "%", better: "higher" as const },
  { key: "lecturerBalance", name: "Lecturer Load Balance", unit: "%", better: "higher" as const },
  { key: "studentConflicts", name: "Student Conflicts", unit: "", better: "lower" as const },
  { key: "avgClassSize", name: "Average Class Size", unit: "", better: "higher" as const },
]

export default function WhatIfPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>(mockScenarios)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [newScenario, setNewScenario] = useState({ name: "", description: "", type: "room-change" })

  const completedScenarios = scenarios.filter((s) => s.status === "completed")
  const selectedScenarios = completedScenarios.filter((s) => selectedIds.includes(s.id))

  const handleCreateScenario = () => {
    const scenario: Scenario = {
      id: Date.now(),
      name: newScenario.name,
      description: newScenario.description,
      status: "pending",
      conflicts: null,
      utilization: null,
      lecturerBalance: null,
      studentConflicts: null,
      avgClassSize: null,
      createdAt: new Date().toISOString().split("T")[0],
    }
    setScenarios([...scenarios, scenario])
    setNewScenario({ name: "", description: "", type: "room-change" })
    setIsNewDialogOpen(false)
  }

  const handleDeleteScenario = (id: number) => {
    setScenarios(scenarios.filter((s) => s.id !== id))
    setSelectedIds(selectedIds.filter((i) => i !== id))
  }

  const handleRunScenario = (id: number) => {
    setScenarios(scenarios.map((s) => (s.id === id ? { ...s, status: "running" as const } : s)))
    setTimeout(() => {
      setScenarios((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: "completed" as const,
                conflicts: Math.floor(Math.random() * 5),
                utilization: 75 + Math.floor(Math.random() * 15),
                lecturerBalance: 55 + Math.floor(Math.random() * 30),
                studentConflicts: Math.floor(Math.random() * 20),
                avgClassSize: 25 + Math.floor(Math.random() * 15),
              }
            : s,
        ),
      )
    }, 3000)
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const getBestValue = (key: string, better: "higher" | "lower") => {
    const values = selectedScenarios.map((s) => (s as Record<string, unknown>)[key] as number).filter((v) => v != null)
    if (values.length === 0) return null
    return better === "higher" ? Math.max(...values) : Math.min(...values)
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-balance">What-If Scenarios</h1>
              <p className="text-muted-foreground">Explore different scheduling configurations and compare outcomes.</p>
            </div>
            <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Scenario
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Scenario</DialogTitle>
                  <DialogDescription>Define a hypothetical change to explore its impact on the timetable.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="scenario-name">Scenario Name</Label>
                    <Input id="scenario-name" value={newScenario.name} onChange={(e) => setNewScenario({ ...newScenario, name: e.target.value })} placeholder="e.g., Add New Lab Room" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scenario-type">Scenario Type</Label>
                    <Select value={newScenario.type} onValueChange={(v) => setNewScenario({ ...newScenario, type: v })}>
                      <SelectTrigger id="scenario-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="room-change">Room Change</SelectItem>
                        <SelectItem value="section-change">Section Change</SelectItem>
                        <SelectItem value="time-change">Time Slot Change</SelectItem>
                        <SelectItem value="lecturer-change">Lecturer Change</SelectItem>
                        <SelectItem value="constraint-change">Constraint Change</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scenario-desc">Description</Label>
                    <Input id="scenario-desc" value={newScenario.description} onChange={(e) => setNewScenario({ ...newScenario, description: e.target.value })} placeholder="Describe the hypothetical change..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsNewDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateScenario} disabled={!newScenario.name}>Create Scenario</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Tabs defaultValue="scenarios" className="space-y-6">
            <TabsList>
              <TabsTrigger value="scenarios">All Scenarios</TabsTrigger>
              <TabsTrigger value="compare" className="gap-2">
                Compare
                {selectedIds.length >= 2 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                    {selectedIds.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scenarios" className="space-y-4">
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <GitCompare className="h-4 w-4 text-primary" />
                  <span className="text-sm text-foreground">
                    {selectedIds.length} scenario{selectedIds.length > 1 ? "s" : ""} selected for comparison.
                    {selectedIds.length >= 2 && " Switch to the Compare tab to view."}
                  </span>
                  <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelectedIds([])}>
                    Clear
                  </Button>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {scenarios.map((scenario) => (
                  <Card key={scenario.id} className={`relative transition-all ${selectedIds.includes(scenario.id) ? "ring-2 ring-primary" : ""}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {scenario.status === "completed" && (
                            <Checkbox
                              checked={selectedIds.includes(scenario.id)}
                              onCheckedChange={() => toggleSelect(scenario.id)}
                              className="mt-1"
                            />
                          )}
                          <div>
                            <CardTitle className="text-lg">{scenario.name}</CardTitle>
                            <CardDescription className="mt-1">{scenario.description}</CardDescription>
                          </div>
                        </div>
                        <Badge
                          variant={scenario.status === "completed" ? "default" : scenario.status === "running" ? "secondary" : "outline"}
                        >
                          {scenario.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {scenario.status === "running" ? (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Running simulation...</span>
                            <span>45%</span>
                          </div>
                          <Progress value={45} className="h-2" />
                        </div>
                      ) : scenario.status === "completed" ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-muted p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {scenario.conflicts! <= 2 ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                              <span className="text-xl font-bold">{scenario.conflicts}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Conflicts</p>
                          </div>
                          <div className="rounded-lg bg-muted p-3 text-center">
                            <p className="text-xl font-bold">{scenario.utilization}%</p>
                            <p className="text-xs text-muted-foreground">Utilization</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Run this scenario to see results</p>
                      )}

                      <div className="flex gap-2">
                        {scenario.status === "pending" && (
                          <Button size="sm" className="flex-1" onClick={() => handleRunScenario(scenario.id)}>
                            <Play className="mr-2 h-3 w-3" />
                            Run
                          </Button>
                        )}
                        {scenario.status === "completed" && (
                          <Button size="sm" variant="outline" className="flex-1">
                            <Eye className="mr-2 h-3 w-3" />
                            View
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <Copy className="h-3 w-3" />
                        </Button>
                        {scenario.id !== 1 && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDeleteScenario(scenario.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">Created: {scenario.createdAt}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="compare" className="space-y-6">
              {selectedScenarios.length >= 2 ? (
                <>
                  {/* Side-by-Side Comparison Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Side-by-Side Comparison</CardTitle>
                      <CardDescription>
                        Comparing {selectedScenarios.length} scenarios across key metrics
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-3 font-medium text-muted-foreground min-w-[160px]">Metric</th>
                              {selectedScenarios.map((s) => (
                                <th key={s.id} className="text-center p-3 font-semibold min-w-[140px]">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-foreground">{s.name}</span>
                                    <Badge variant="outline" className="text-xs font-normal">{s.createdAt}</Badge>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {metricDefinitions.map((metric) => {
                              const best = getBestValue(metric.key, metric.better)
                              return (
                                <tr key={metric.key} className="border-b last:border-b-0">
                                  <td className="p-3 font-medium">{metric.name}</td>
                                  {selectedScenarios.map((s) => {
                                    const value = (s as Record<string, unknown>)[metric.key] as number | null
                                    const isBest = value != null && value === best && selectedScenarios.length > 1
                                    return (
                                      <td key={s.id} className="p-3 text-center">
                                        <span className={`inline-flex items-center gap-1 text-base font-semibold tabular-nums ${isBest ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
                                          {value != null ? `${value}${metric.unit}` : "-"}
                                          {isBest && <CheckCircle className="h-3.5 w-3.5" />}
                                        </span>
                                      </td>
                                    )
                                  })}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Metric-by-Metric Bars */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Metric Breakdown</CardTitle>
                      <CardDescription>Visual comparison of each metric across selected scenarios</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {metricDefinitions.map((metric) => {
                        const maxVal = Math.max(
                          ...selectedScenarios.map((s) => ((s as Record<string, unknown>)[metric.key] as number) || 0),
                          1
                        )
                        const best = getBestValue(metric.key, metric.better)
                        return (
                          <div key={metric.key} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{metric.name}</span>
                              <span className="text-xs text-muted-foreground">
                                Best: {metric.better === "higher" ? "Higher" : "Lower"}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {selectedScenarios.map((s) => {
                                const value = (s as Record<string, unknown>)[metric.key] as number | null
                                const isBest = value != null && value === best
                                const width = value != null ? Math.max((value / (maxVal * 1.2)) * 100, 5) : 0
                                return (
                                  <div key={s.id} className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground w-28 truncate">{s.name}</span>
                                    <div className="flex-1 h-6 rounded-md bg-muted relative overflow-hidden">
                                      <div
                                        className={`h-full rounded-md transition-all ${isBest ? "bg-green-500 dark:bg-green-600" : "bg-primary/60"}`}
                                        style={{ width: `${width}%` }}
                                      />
                                    </div>
                                    <span className={`text-sm font-semibold w-12 text-right tabular-nums ${isBest ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
                                      {value != null ? `${value}${metric.unit}` : "-"}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>

                  {/* Recommendation */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Recommendation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">
                              &quot;{(() => {
                                let bestCount: Record<number, number> = {}
                                metricDefinitions.forEach((m) => {
                                  const best = getBestValue(m.key, m.better)
                                  selectedScenarios.forEach((s) => {
                                    const val = (s as Record<string, unknown>)[m.key] as number | null
                                    if (val === best) bestCount[s.id] = (bestCount[s.id] || 0) + 1
                                  })
                                })
                                const winnerId = Object.entries(bestCount).sort((a, b) => b[1] - a[1])[0]?.[0]
                                return selectedScenarios.find((s) => s.id === Number(winnerId))?.name || selectedScenarios[0].name
                              })()}&quot; performs best overall
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              This scenario leads in the most metrics among the {selectedScenarios.length} compared configurations.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Button className="w-full">Apply Best Scenario Configuration</Button>
                        <Button variant="outline" className="w-full">Export Comparison Report</Button>
                        <Button variant="outline" className="w-full">Create New Scenario from Results</Button>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <GitCompare className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">Select at Least 2 Scenarios to Compare</h3>
                    <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
                      Go to the Scenarios tab and check the boxes on completed scenarios you want to compare side by side. You can select 2 or more.
                    </p>
                    <p className="text-sm text-muted-foreground mt-4">
                      Currently selected: {selectedIds.length} / {completedScenarios.length} available
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
