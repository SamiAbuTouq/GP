"use client"

import { useState } from "react"
import { EntityLayout } from "@/components/entity-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Trash2, MoreHorizontal } from "lucide-react"
import { ImportIcon } from "@/components/custom-icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { mockTimeSlots } from "@/lib/data"
import { ImportDialog } from "@/components/import-dialog"
import { findColumn, type ParsedRow } from "@/lib/import-utils"
import { ExportDropdownWithDialog } from "@/components/export-dialog"

export default function TimeSlotsPage() {
  const [timeSlots, setTimeSlots] = useState(mockTimeSlots)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newSlot, setNewSlot] = useState({ id: timeSlots.length + 1, day: "", start: "", end: "" })
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)

  const handleAddSlot = () => {
    if (newSlot.day && newSlot.start && newSlot.end) {
      setTimeSlots([...timeSlots, newSlot])
      setNewSlot({ id: timeSlots.length + 2, day: "", start: "", end: "" })
      setIsAddDialogOpen(false)
    }
  }

  const handleDeleteSlot = (id: number) => {
    setTimeSlots(timeSlots.filter((s) => s.id !== id))
  }

  const getDayColor = (day: string) => {
    const colors: Record<string, string> = {
      Sunday: "bg-blue-100 text-blue-800",
      Monday: "bg-green-100 text-green-800",
      Tuesday: "bg-amber-100 text-amber-800",
      Wednesday: "bg-purple-100 text-purple-800",
      Thursday: "bg-pink-100 text-pink-800",
    }
    return colors[day] || "bg-gray-100 text-gray-800"
  }

  // Group slots by day
  const slotsByDay = timeSlots.reduce(
    (acc, slot) => {
      if (!acc[slot.day]) acc[slot.day] = []
      acc[slot.day].push(slot)
      return acc
    },
    {} as Record<string, typeof timeSlots>,
  )

  return (
    <EntityLayout title="Time Slot Management" description="Configure available time slots for scheduling.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Time Slots ({timeSlots.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setIsImportDialogOpen(true)}>
                <ImportIcon className="mr-2 h-4 w-4" />
                Import
              </Button>
              <ExportDropdownWithDialog
                allData={timeSlots}
                filteredData={timeSlots}
                columns={[
                  { key: "day" as const, label: "Day" },
                  { key: "start" as const, label: "Start" },
                  { key: "end" as const, label: "End" },
                ]}
                filenamePrefix="timeslots"
                pdfTitle="Time Slots"
                totalLabel={`${timeSlots.length}`}
                filteredLabel={`${timeSlots.length}`}
              />
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Time Slot
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Time Slot</DialogTitle>
                  <DialogDescription>Define a new time slot for scheduling.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="slot-day">Day</Label>
                    <Select value={newSlot.day} onValueChange={(v) => setNewSlot({ ...newSlot, day: v })}>
                      <SelectTrigger id="slot-day">
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sunday">Sunday</SelectItem>
                        <SelectItem value="Monday">Monday</SelectItem>
                        <SelectItem value="Tuesday">Tuesday</SelectItem>
                        <SelectItem value="Wednesday">Wednesday</SelectItem>
                        <SelectItem value="Thursday">Thursday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="slot-start">Start Time</Label>
                      <Input
                        id="slot-start"
                        type="time"
                        value={newSlot.start}
                        onChange={(e) => setNewSlot({ ...newSlot, start: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slot-end">End Time</Label>
                      <Input
                        id="slot-end"
                        type="time"
                        value={newSlot.end}
                        onChange={(e) => setNewSlot({ ...newSlot, end: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddSlot}>Add Time Slot</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeSlots.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell>
                        <Badge className={getDayColor(slot.day)}>{slot.day}</Badge>
                      </TableCell>
                      <TableCell>{slot.start}</TableCell>
                      <TableCell>{slot.end}</TableCell>
                      <TableCell>1.5 hrs</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteSlot(slot.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(slotsByDay).map(([day, slots]) => (
                <div key={day} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getDayColor(day)}>{day}</Badge>
                    <span className="text-sm text-muted-foreground">{slots.length} slots</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <div key={slot.id} className="rounded-md border bg-muted/50 px-3 py-1 text-sm">
                        {slot.start} - {slot.end}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <ImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        title="Import Time Slots"
        description="Upload a CSV or Excel file with time slot data."
        exampleHeaders={["day", "start", "end"]}
        columns={[
          { key: "id", label: "ID" },
          { key: "day", label: "Day" },
          { key: "start", label: "Start" },
          { key: "end", label: "End" },
        ]}
        mapRow={(row: ParsedRow, index: number) => {
          const day = findColumn(row, "day", "day_of_week", "dayofweek")
          const start = findColumn(row, "start", "start_time", "starttime", "from")
          const end = findColumn(row, "end", "end_time", "endtime", "to")
          if (!day || !start || !end) return null
          return {
            id: timeSlots.length + index + 1,
            day,
            start,
            end,
          }
        }}
        onImport={(data) => {
          const existingKeys = new Set(timeSlots.map((s) => `${s.day}-${s.start}-${s.end}`))
          const newEntries = data.filter((s) => !existingKeys.has(`${s.day}-${s.start}-${s.end}`))
          setTimeSlots((prev) => [...prev, ...newEntries])
        }}
      />
    </EntityLayout>
  )
}
