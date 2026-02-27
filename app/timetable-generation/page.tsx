"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Settings2,
  Zap,
  Target,
  Clock,
  XCircle,
  TrendingUp,
  Loader2,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react"

type ConstraintType = "hard" | "soft"
interface Constraint {
  id: string
  label: string
  type: ConstraintType
  enabled: boolean
}

const semesterOptions = [
  { id: "fall-2025", label: "Fall 2025" },
  { id: "spring-2025", label: "Spring 2025" },
  { id: "summer-2025", label: "Summer 2025" },
]

export default function TimetableGenerationPage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generationComplete, setGenerationComplete] = useState(false)
  const [selectedSemesters, setSelectedSemesters] = useState<string[]>(["fall-2025"])
  const [currentPhase, setCurrentPhase] = useState(1)
  const [currentIteration, setCurrentIteration] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [config, setConfig] = useState({
    algorithm: "hybrid",
    maxIterations: 1000,
    useCBR: true,
    useGWO: true,
    prioritizeRoomUtilization: 70,
    prioritizeStudentConflicts: 90,
    prioritizeLecturerLoad: 60,
  })

  // Constraints state
  const [constraints, setConstraints] = useState<Constraint[]>([
    { id: "no-room-conflict", label: "No room double-booking", type: "hard", enabled: true },
    { id: "no-lecturer-conflict", label: "No lecturer double-booking", type: "hard", enabled: true },
    { id: "room-capacity", label: "Room capacity must fit students", type: "hard", enabled: true },
    { id: "time-windows", label: "Respect time slot boundaries", type: "hard", enabled: true },
    { id: "balanced-load", label: "Balance lecturer teaching load", type: "soft", enabled: true },
    { id: "student-gaps", label: "Minimize student schedule gaps", type: "soft", enabled: true },
    { id: "consecutive-labs", label: "Prefer consecutive lab sessions", type: "soft", enabled: false },
    { id: "building-proximity", label: "Minimize building transitions", type: "soft", enabled: true },
  ])
  const [constraintDialogOpen, setConstraintDialogOpen] = useState(false)
  const [editingConstraint, setEditingConstraint] = useState<Constraint | null>(null)
  const [constraintForm, setConstraintForm] = useState({ label: "", type: "hard" as ConstraintType })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingConstraintId, setDeletingConstraintId] = useState<string | null>(null)

  const hardConstraints = constraints.filter((c) => c.type === "hard")
  const softConstraints = constraints.filter((c) => c.type === "soft")

  const openAddConstraint = (type: ConstraintType) => {
    setEditingConstraint(null)
    setConstraintForm({ label: "", type })
    setConstraintDialogOpen(true)
  }

  const openEditConstraint = (constraint: Constraint) => {
    setEditingConstraint(constraint)
    setConstraintForm({ label: constraint.label, type: constraint.type })
    setConstraintDialogOpen(true)
  }

  const handleSaveConstraint = () => {
    if (!constraintForm.label.trim()) return
    if (editingConstraint) {
      setConstraints((prev) =>
        prev.map((c) =>
          c.id === editingConstraint.id ? { ...c, label: constraintForm.label.trim(), type: constraintForm.type } : c,
        ),
      )
    } else {
      const newConstraint: Constraint = {
        id: `custom-${Date.now()}`,
        label: constraintForm.label.trim(),
        type: constraintForm.type,
        enabled: true,
      }
      setConstraints((prev) => [...prev, newConstraint])
    }
    setConstraintDialogOpen(false)
  }

  const confirmDeleteConstraint = (id: string) => {
    setDeletingConstraintId(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConstraint = () => {
    if (deletingConstraintId) {
      setConstraints((prev) => prev.filter((c) => c.id !== deletingConstraintId))
    }
    setDeleteDialogOpen(false)
    setDeletingConstraintId(null)
  }

  const toggleConstraint = (id: string) => {
    setConstraints((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)))
  }

  const toggleSemester = (semesterId: string) => {
    setSelectedSemesters((prev) =>
      prev.includes(semesterId) ? prev.filter((id) => id !== semesterId) : [...prev, semesterId],
    )
  }

  const startGeneration = () => {
    if (selectedSemesters.length === 0) return

    setIsGenerating(true)
    setProgress(0)
    setGenerationComplete(false)
    setCurrentPhase(1)
    setCurrentIteration(0)
    setBestScore(0)

    const maxIterations = config.maxIterations
    let iteration = 0

    const interval = setInterval(() => {
      iteration += Math.floor(Math.random() * 50) + 20
      const newProgress = Math.min((iteration / maxIterations) * 100, 100)

      setProgress(newProgress)
      setCurrentIteration(Math.min(iteration, maxIterations))
      setBestScore(Math.min(89.4 + (newProgress / 100) * 5, 94.2))

      // Update phase based on progress
      if (newProgress < 33) {
        setCurrentPhase(1)
      } else if (newProgress < 67) {
        setCurrentPhase(2)
      } else {
        setCurrentPhase(3)
      }

      if (newProgress >= 100) {
        clearInterval(interval)
        setIsGenerating(false)
        setGenerationComplete(true)
        setCurrentPhase(3)
        setCurrentIteration(maxIterations)
        setBestScore(94.2)
      }
    }, 300)
  }

  const resetGeneration = () => {
    setIsGenerating(false)
    setProgress(0)
    setGenerationComplete(false)
    setCurrentPhase(1)
    setCurrentIteration(0)
    setBestScore(0)
  }

  const getEstimatedTime = () => {
    const remaining = 100 - progress
    const minutes = Math.ceil((remaining / 100) * 4)
    return `~${minutes} minute${minutes !== 1 ? "s" : ""}`
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 text-balance">Timetable Generation</h1>
            <p className="text-slate-600">Configure and generate optimized timetables using CBR + GWO algorithms.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Configuration Panel */}
            <div className="lg:col-span-2 space-y-6">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-slate-100">
                  <TabsTrigger value="basic" className="data-[state=active]:bg-white">
                    Basic Settings
                  </TabsTrigger>
                  <TabsTrigger value="constraints" className="data-[state=active]:bg-white">
                    Constraints
                  </TabsTrigger>
                  <TabsTrigger value="priorities" className="data-[state=active]:bg-white">
                    Priorities
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <Card className="bg-white border-slate-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-slate-900">
                        <Settings2 className="h-5 w-5 text-[#0066CC]" />
                        Basic Configuration
                      </CardTitle>
                      <CardDescription>Set up the core parameters for timetable generation</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-slate-700">Target Semesters</Label>
                        <p className="text-xs text-slate-500">
                          Select one or more semesters to generate timetables for
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {semesterOptions.map((semester) => (
                            <div
                              key={semester.id}
                              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                                selectedSemesters.includes(semester.id)
                                  ? "border-[#0066CC] bg-[#0066CC]/5"
                                  : "border-slate-200 hover:border-slate-300 bg-white"
                              }`}
                              onClick={() => toggleSemester(semester.id)}
                            >
                              <Checkbox
                                checked={selectedSemesters.includes(semester.id)}
                                onCheckedChange={() => toggleSemester(semester.id)}
                                className="data-[state=checked]:bg-[#0066CC] data-[state=checked]:border-[#0066CC]"
                              />
                              <span
                                className={`text-sm font-medium ${
                                  selectedSemesters.includes(semester.id) ? "text-[#0066CC]" : "text-slate-700"
                                }`}
                              >
                                {semester.label}
                              </span>
                            </div>
                          ))}
                        </div>
                        {selectedSemesters.length === 0 && (
                          <p className="text-xs text-red-500">Please select at least one semester</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="algorithm">Algorithm</Label>
                        <Select value={config.algorithm} onValueChange={(v) => setConfig({ ...config, algorithm: v })}>
                          <SelectTrigger id="algorithm" className="bg-white border-slate-200">
                            <SelectValue placeholder="Select algorithm" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hybrid">Hybrid (CBR + GWO)</SelectItem>
                            <SelectItem value="cbr-only">CBR Only</SelectItem>
                            <SelectItem value="gwo-only">GWO Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Maximum Iterations: {config.maxIterations}</Label>
                        <Slider
                          value={[config.maxIterations]}
                          onValueChange={([v]) => setConfig({ ...config, maxIterations: v })}
                          min={100}
                          max={5000}
                          step={100}
                          className="[&_[role=slider]]:bg-[#0066CC]"
                        />
                        <p className="text-xs text-slate-500">Higher iterations may improve results but take longer</p>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4 bg-white">
                        <div className="space-y-0.5">
                          <Label htmlFor="use-cbr">Use Case-Based Reasoning (CBR)</Label>
                          <p className="text-sm text-slate-500">Generate initial solution from historical data</p>
                        </div>
                        <Switch
                          id="use-cbr"
                          checked={config.useCBR}
                          onCheckedChange={(v) => setConfig({ ...config, useCBR: v })}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4 bg-white">
                        <div className="space-y-0.5">
                          <Label htmlFor="use-gwo">Use Grey Wolf Optimizer (GWO)</Label>
                          <p className="text-sm text-slate-500">Optimize solution for minimal conflicts</p>
                        </div>
                        <Switch
                          id="use-gwo"
                          checked={config.useGWO}
                          onCheckedChange={(v) => setConfig({ ...config, useGWO: v })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="constraints" className="space-y-4">
                  <Card className="bg-white border-slate-200">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-slate-900">
                            <Target className="h-5 w-5 text-[#0066CC]" />
                            Hard Constraints
                          </CardTitle>
                          <CardDescription>These constraints must be satisfied</CardDescription>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-200 bg-white hover:bg-slate-50"
                          onClick={() => openAddConstraint("hard")}
                        >
                          <Plus className="mr-1.5 h-4 w-4" />
                          Add
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {hardConstraints.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">No hard constraints defined.</p>
                      )}
                      {hardConstraints.map((constraint) => (
                        <div
                          key={constraint.id}
                          className="flex items-center justify-between rounded-lg border border-slate-200 p-3 bg-white group"
                        >
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                            <span className="text-sm font-medium text-slate-700">{constraint.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">Required</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600"
                              onClick={() => openEditConstraint(constraint)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600"
                              onClick={() => confirmDeleteConstraint(constraint.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-slate-200">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-slate-900">
                            <Zap className="h-5 w-5 text-amber-500" />
                            Soft Constraints
                          </CardTitle>
                          <CardDescription>Preferred but not mandatory</CardDescription>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-200 bg-white hover:bg-slate-50"
                          onClick={() => openAddConstraint("soft")}
                        >
                          <Plus className="mr-1.5 h-4 w-4" />
                          Add
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {softConstraints.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">No soft constraints defined.</p>
                      )}
                      {softConstraints.map((constraint) => (
                        <div
                          key={constraint.id}
                          className="flex items-center justify-between rounded-lg border border-slate-200 p-3 bg-white group"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-700">{constraint.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600"
                              onClick={() => openEditConstraint(constraint)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600"
                              onClick={() => confirmDeleteConstraint(constraint.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Delete</span>
                            </Button>
                            <Switch
                              checked={constraint.enabled}
                              onCheckedChange={() => toggleConstraint(constraint.id)}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="priorities" className="space-y-4">
                  <Card className="bg-white border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-slate-900">Optimization Priorities</CardTitle>
                      <CardDescription>Adjust the weight of each optimization objective</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-slate-700">Student Conflict Avoidance</Label>
                          <span className="text-sm font-medium text-[#0066CC]">
                            {config.prioritizeStudentConflicts}%
                          </span>
                        </div>
                        <Slider
                          value={[config.prioritizeStudentConflicts]}
                          onValueChange={([v]) => setConfig({ ...config, prioritizeStudentConflicts: v })}
                          max={100}
                          className="[&_[role=slider]]:bg-[#0066CC]"
                        />
                        <p className="text-xs text-slate-500">Higher priority reduces student scheduling conflicts</p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-slate-700">Room Utilization</Label>
                          <span className="text-sm font-medium text-[#0066CC]">
                            {config.prioritizeRoomUtilization}%
                          </span>
                        </div>
                        <Slider
                          value={[config.prioritizeRoomUtilization]}
                          onValueChange={([v]) => setConfig({ ...config, prioritizeRoomUtilization: v })}
                          max={100}
                          className="[&_[role=slider]]:bg-[#0066CC]"
                        />
                        <p className="text-xs text-slate-500">Higher priority maximizes room usage efficiency</p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-slate-700">Lecturer Load Balance</Label>
                          <span className="text-sm font-medium text-[#0066CC]">{config.prioritizeLecturerLoad}%</span>
                        </div>
                        <Slider
                          value={[config.prioritizeLecturerLoad]}
                          onValueChange={([v]) => setConfig({ ...config, prioritizeLecturerLoad: v })}
                          max={100}
                          className="[&_[role=slider]]:bg-[#0066CC]"
                        />
                        <p className="text-xs text-slate-500">Higher priority distributes teaching load evenly</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Generation Panel */}
            <div className="space-y-6">
              {isGenerating && (
                <Card className="bg-white border-slate-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-slate-900">Generation in Progress</CardTitle>
                        <CardDescription>Optimizing timetable using CBR + GWO algorithm</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 bg-transparent"
                        onClick={() => setIsGenerating(false)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Overall Progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Overall Progress</span>
                        <span className="font-semibold text-slate-900">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2.5 bg-slate-100" />
                    </div>

                    {/* Phase Cards */}
                    <div className="grid grid-cols-3 gap-2">
                      <div
                        className={`p-3 rounded-lg border ${currentPhase >= 1 ? (currentPhase > 1 ? "border-emerald-200 bg-emerald-50" : "border-[#0066CC] bg-[#0066CC]/5") : "border-slate-200 bg-slate-50"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {currentPhase > 1 ? (
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          ) : currentPhase === 1 ? (
                            <Loader2 className="h-4 w-4 text-[#0066CC] animate-spin" />
                          ) : (
                            <Clock className="h-4 w-4 text-slate-400" />
                          )}
                          <span className="text-xs text-slate-500">Phase 1</span>
                        </div>
                        <p
                          className={`text-xs font-medium ${currentPhase > 1 ? "text-emerald-600" : currentPhase === 1 ? "text-[#0066CC]" : "text-slate-500"}`}
                        >
                          {currentPhase > 1 ? "CBR Complete" : "CBR Processing"}
                        </p>
                      </div>
                      <div
                        className={`p-3 rounded-lg border ${currentPhase >= 2 ? (currentPhase > 2 ? "border-emerald-200 bg-emerald-50" : "border-[#0066CC] bg-[#0066CC]/5") : "border-slate-200 bg-slate-50"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {currentPhase > 2 ? (
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          ) : currentPhase === 2 ? (
                            <Loader2 className="h-4 w-4 text-[#0066CC] animate-spin" />
                          ) : (
                            <Clock className="h-4 w-4 text-slate-400" />
                          )}
                          <span className="text-xs text-slate-500">Phase 2</span>
                        </div>
                        <p
                          className={`text-xs font-medium ${currentPhase > 2 ? "text-emerald-600" : currentPhase === 2 ? "text-[#0066CC]" : "text-slate-500"}`}
                        >
                          {currentPhase > 2 ? "GWO Complete" : currentPhase === 2 ? "GWO Optimizing" : "Pending"}
                        </p>
                      </div>
                      <div
                        className={`p-3 rounded-lg border ${currentPhase >= 3 ? "border-[#0066CC] bg-[#0066CC]/5" : "border-slate-200 bg-slate-50"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {currentPhase >= 3 ? (
                            <Loader2 className="h-4 w-4 text-[#0066CC] animate-spin" />
                          ) : (
                            <Clock className="h-4 w-4 text-slate-400" />
                          )}
                          <span className="text-xs text-slate-500">Phase 3</span>
                        </div>
                        <p className={`text-xs font-medium ${currentPhase >= 3 ? "text-[#0066CC]" : "text-slate-500"}`}>
                          {currentPhase >= 3 ? "Finalizing" : "Pending"}
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Current Iteration</span>
                        <span className="font-medium text-slate-900">
                          {currentIteration} / {config.maxIterations}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Best Solution Score</span>
                        <span className="font-medium text-emerald-600 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {bestScore.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Estimated Time Remaining</span>
                        <span className="font-medium text-slate-900">{getEstimatedTime()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900">Generation Control</CardTitle>
                  <CardDescription>Start or monitor the generation process</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {generationComplete ? (
                    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <AlertTitle>Generation Complete!</AlertTitle>
                      <AlertDescription>
                        Timetable generated successfully for {selectedSemesters.length} semester(s) with 2 minor
                        conflicts detected.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    !isGenerating && (
                      <div className="text-center py-4">
                        <p className="text-sm text-slate-600 mb-2">Ready to generate timetable for:</p>
                        <div className="flex flex-wrap gap-1 justify-center">
                          {selectedSemesters.map((id) => {
                            const semester = semesterOptions.find((s) => s.id === id)
                            return semester ? (
                              <Badge key={id} className="bg-[#0066CC]/10 text-[#0066CC] hover:bg-[#0066CC]/20">
                                {semester.label}
                              </Badge>
                            ) : null
                          })}
                        </div>
                      </div>
                    )
                  )}

                  <div className="flex gap-2">
                    {isGenerating ? (
                      <Button
                        variant="outline"
                        className="flex-1 bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        onClick={() => setIsGenerating(false)}
                      >
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </Button>
                    ) : (
                      <Button
                        className="flex-1 bg-[#0066CC] hover:bg-[#0055AA] text-white"
                        onClick={startGeneration}
                        disabled={generationComplete || selectedSemesters.length === 0}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        {generationComplete ? "Generated" : "Start Generation"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={resetGeneration}
                      className="bg-white border-slate-200 hover:bg-slate-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {generationComplete && (
                <Card className="bg-white border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-slate-900">Generation Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                        <p className="text-2xl font-bold text-[#0066CC]">124</p>
                        <p className="text-xs text-slate-500">Sections Scheduled</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                        <p className="text-2xl font-bold text-emerald-600">98%</p>
                        <p className="text-xs text-slate-500">Room Utilization</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                        <p className="text-2xl font-bold text-amber-600">2</p>
                        <p className="text-xs text-slate-500">Soft Conflicts</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                        <p className="text-2xl font-bold text-emerald-600">0</p>
                        <p className="text-xs text-slate-500">Hard Conflicts</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1 bg-[#0066CC] hover:bg-[#0055AA] text-white" asChild>
                        <a href="/schedule">View Schedule</a>
                      </Button>
                      <Button variant="outline" className="flex-1 bg-white border-slate-200 hover:bg-slate-50">
                        Export
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Courses</span>
                      <span className="font-medium text-slate-900">48</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Sections</span>
                      <span className="font-medium text-slate-900">124</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Available Rooms</span>
                      <span className="font-medium text-slate-900">28</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Time Slots</span>
                      <span className="font-medium text-slate-900">45</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Lecturers</span>
                      <span className="font-medium text-slate-900">35</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Add / Edit Constraint Dialog */}
      <Dialog open={constraintDialogOpen} onOpenChange={setConstraintDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingConstraint ? "Edit Constraint" : "Add Constraint"}</DialogTitle>
            <DialogDescription>
              {editingConstraint ? "Update the constraint details below." : "Define a new constraint for timetable generation."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Constraint Name</Label>
              <Input
                placeholder="e.g. No back-to-back lectures"
                value={constraintForm.label}
                onChange={(e) => setConstraintForm({ ...constraintForm, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={constraintForm.type}
                onValueChange={(v) => setConstraintForm({ ...constraintForm, type: v as ConstraintType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hard">Hard (Required)</SelectItem>
                  <SelectItem value="soft">Soft (Preferred)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConstraintDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#0066CC] hover:bg-[#0055AA] text-white"
              onClick={handleSaveConstraint}
              disabled={!constraintForm.label.trim()}
            >
              {editingConstraint ? "Save Changes" : "Add Constraint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Constraint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this constraint? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteConstraint}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
