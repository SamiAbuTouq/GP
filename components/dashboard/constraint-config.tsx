"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Plus, Settings2, Save, Pencil, Trash2, X, Check } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Constraint {
  id: string
  name: string
  description: string
  type: "hard" | "soft"
  enabled: boolean
  priority: number
}

const initialConstraints: Constraint[] = [
  { id: "1", name: "No Room Double-Booking", description: "A room cannot be assigned to more than one class at the same time slot.", type: "hard", enabled: true, priority: 100 },
  { id: "2", name: "No Lecturer Overlap", description: "A lecturer cannot teach two classes simultaneously.", type: "hard", enabled: true, priority: 100 },
  { id: "3", name: "Room Capacity Limit", description: "The number of enrolled students must not exceed the room capacity.", type: "hard", enabled: true, priority: 100 },
  { id: "4", name: "No Student Group Overlap", description: "Students in the same cohort cannot have overlapping classes.", type: "hard", enabled: true, priority: 100 },
  { id: "5", name: "Lecturer Preferred Times", description: "Schedule classes during the lecturer's preferred time slots when possible.", type: "soft", enabled: true, priority: 75 },
  { id: "6", name: "Minimize Back-to-Back Classes", description: "Reduce consecutive classes for both students and lecturers.", type: "soft", enabled: true, priority: 60 },
  { id: "7", name: "Prefer Morning Classes", description: "Prioritize scheduling core courses in the morning.", type: "soft", enabled: false, priority: 40 },
  { id: "8", name: "Balance Room Usage", description: "Distribute classes evenly across available rooms.", type: "soft", enabled: true, priority: 50 },
  { id: "9", name: "Minimize Campus Travel", description: "Avoid scheduling consecutive classes in distant buildings.", type: "soft", enabled: true, priority: 55 },
]

export function ConstraintConfig() {
  const [constraints, setConstraints] = useState<Constraint[]>(initialConstraints)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConstraint, setEditingConstraint] = useState<Constraint | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Constraint | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "", type: "soft" as "hard" | "soft", priority: 50 })

  const openAddDialog = () => {
    setEditingConstraint(null)
    setFormData({ name: "", description: "", type: "soft", priority: 50 })
    setDialogOpen(true)
  }

  const openEditDialog = (constraint: Constraint) => {
    setEditingConstraint(constraint)
    setFormData({ name: constraint.name, description: constraint.description, type: constraint.type, priority: constraint.priority })
    setDialogOpen(true)
  }

  const handleSaveConstraint = () => {
    if (!formData.name.trim()) return
    if (editingConstraint) {
      setConstraints(constraints.map((c) =>
        c.id === editingConstraint.id
          ? { ...c, name: formData.name, description: formData.description, type: formData.type, priority: formData.type === "hard" ? 100 : formData.priority }
          : c
      ))
    } else {
      setConstraints([
        ...constraints,
        {
          id: Date.now().toString(),
          name: formData.name,
          description: formData.description,
          type: formData.type,
          enabled: true,
          priority: formData.type === "hard" ? 100 : formData.priority,
        },
      ])
    }
    setDialogOpen(false)
  }

  const handleDeleteConstraint = () => {
    if (!deleteTarget) return
    setConstraints(constraints.filter((c) => c.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const toggleConstraint = (id: string) => {
    setConstraints(constraints.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)))
  }

  const updatePriority = (id: string, priority: number[]) => {
    setConstraints(constraints.map((c) => (c.id === id ? { ...c, priority: priority[0] } : c)))
  }

  const hardConstraints = constraints.filter((c) => c.type === "hard")
  const softConstraints = constraints.filter((c) => c.type === "soft")

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Constraint Configuration
          </CardTitle>
          <CardDescription className="text-sm">Manage scheduling rules and preferences</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openAddDialog} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add
          </Button>
          <Button size="sm" className="gap-1.5">
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Hard Constraints */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Hard Constraints (Mandatory)
            </h4>
            <Badge variant="secondary" className="text-xs">{hardConstraints.length}</Badge>
          </div>
          <div className="space-y-2">
            {hardConstraints.map((constraint) => (
              <div
                key={constraint.id}
                className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Switch checked={constraint.enabled} onCheckedChange={() => toggleConstraint(constraint.id)} />
                  <div className="min-w-0">
                    <span className={`text-sm font-medium block ${constraint.enabled ? "text-foreground" : "text-muted-foreground"}`}>
                      {constraint.name}
                    </span>
                    {constraint.description && (
                      <span className="text-xs text-muted-foreground block truncate">{constraint.description}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 shrink-0">Required</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEditDialog(constraint)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => setDeleteTarget(constraint)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Soft Constraints */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Soft Constraints (Preferences)
            </h4>
            <Badge variant="secondary" className="text-xs">{softConstraints.length}</Badge>
          </div>
          <div className="space-y-3">
            {softConstraints.map((constraint) => (
              <div key={constraint.id} className="rounded-lg border p-3 group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Switch checked={constraint.enabled} onCheckedChange={() => toggleConstraint(constraint.id)} />
                    <div className="min-w-0">
                      <span className={`text-sm font-medium block ${constraint.enabled ? "text-foreground" : "text-muted-foreground"}`}>
                        {constraint.name}
                      </span>
                      {constraint.description && (
                        <span className="text-xs text-muted-foreground block truncate">{constraint.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary tabular-nums">{constraint.priority}%</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEditDialog(constraint)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => setDeleteTarget(constraint)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {constraint.enabled && (
                  <div className="pl-10 pt-1">
                    <Slider
                      value={[constraint.priority]}
                      onValueChange={(v) => updatePriority(constraint.id, v)}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConstraint ? "Edit Constraint" : "Add New Constraint"}</DialogTitle>
            <DialogDescription>
              {editingConstraint ? "Modify the constraint details below." : "Create a new scheduling constraint rule."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="c-name">Constraint Name</Label>
              <Input
                id="c-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Avoid Friday Afternoons"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-desc">Description</Label>
              <Textarea
                id="c-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Explain what this constraint does..."
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-type">Constraint Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as "hard" | "soft" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hard">Hard (Mandatory)</SelectItem>
                  <SelectItem value="soft">Soft (Preference)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.type === "soft" && (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Priority Weight</Label>
                  <span className="text-sm font-semibold text-primary">{formData.priority}%</span>
                </div>
                <Slider
                  value={[formData.priority]}
                  onValueChange={(v) => setFormData({ ...formData, priority: v[0] })}
                  max={100}
                  step={5}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveConstraint} disabled={!formData.name.trim()} className="gap-1.5">
              <Check className="h-4 w-4" />
              {editingConstraint ? "Update" : "Add"} Constraint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Constraint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConstraint} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
