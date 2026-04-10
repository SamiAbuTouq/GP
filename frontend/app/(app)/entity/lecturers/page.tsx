"use client"

import { useState, useMemo, useEffect } from "react"
import { EntityLayout } from "@/components/entity-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Search, Edit, Trash2, MoreHorizontal, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, Loader2 } from "lucide-react"
import { ImportIcon } from "@/components/custom-icons"
import { departments, type Department } from "@/lib/data"
import { ImportDialog } from "@/components/import-dialog"
import { findColumn, type ParsedRow } from "@/lib/import-utils"
import { ExportDropdownWithDialog } from "@/components/export-dialog"
import { useToast } from "@/hooks/use-toast"

type Lecturer = {
  id: string
  databaseId?: number
  name: string
  email: string
  department: Department
  load: number
  maxWorkload: number
  courses: string[]
}

type CourseOption = {
  code: string
  name: string
}

const normalizeCourseOption = (course: unknown): CourseOption | null => {
  if (!course || typeof course !== "object") return null
  const rawCode = (course as { code?: unknown }).code
  const rawName = (course as { name?: unknown }).name
  const code = typeof rawCode === "string" ? rawCode.trim() : ""
  const name = typeof rawName === "string" ? rawName.trim() : ""
  if (!code || !name) return null
  return { code, name }
}

export default function LecturersPage() {
  const [lecturers, setLecturers] = useState<Lecturer[]>([])
  const [availableCourses, setAvailableCourses] = useState<CourseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingLecturer, setEditingLecturer] = useState<Lecturer | null>(null)
  const [saving, setSaving] = useState(false)
  const [newLecturer, setNewLecturer] = useState<Lecturer>({
    id: "",
    name: "",
    email: "",
    department: "Computer Science",
    load: 0,
    maxWorkload: 15,
    courses: [],
  })
  const [addCourseQuery, setAddCourseQuery] = useState("")
  const [editCourseQuery, setEditCourseQuery] = useState("")
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { toast } = useToast()

  // Fetch lecturers and courses from API
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch lecturers — required; throw if it fails
      const lecturersRes = await fetch('/api/lecturers')
      if (!lecturersRes.ok) throw new Error('Failed to fetch lecturers')
      const lecturersData = await lecturersRes.json()
      setLecturers(Array.isArray(lecturersData) ? lecturersData : [])

      // Fetch courses — optional; if it fails just leave the courses list empty
      try {
        const coursesRes = await fetch('/api/courses')
        if (coursesRes.ok) {
          const coursesData = await coursesRes.json()
          setAvailableCourses(
            Array.isArray(coursesData)
              ? coursesData
                  .map(normalizeCourseOption)
                  .filter((course): course is CourseOption => course !== null)
              : []
          )
        }
      } catch {
        // courses list is optional — silently ignore failures
        setAvailableCourses([])
      }
    } catch (error) {
      console.error('Error fetching lecturers:', error)
      setLecturers([])
      toast({
        title: "Error",
        description: "Failed to load lecturers. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredLecturers = useMemo(
    () =>
      lecturers.filter(
        (l) =>
          l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.email.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [lecturers, searchQuery]
  )

  const addCourseQueryLower = addCourseQuery.toLowerCase()
  const filteredAddCourses = useMemo(
    () =>
      availableCourses.filter(
        (c) => c.code.toLowerCase().includes(addCourseQueryLower) || c.name.toLowerCase().includes(addCourseQueryLower)
      ),
    [availableCourses, addCourseQueryLower]
  )

  const editCourseQueryLower = editCourseQuery.toLowerCase()
  const filteredEditCourses = useMemo(
    () =>
      availableCourses.filter(
        (c) => c.code.toLowerCase().includes(editCourseQueryLower) || c.name.toLowerCase().includes(editCourseQueryLower)
      ),
    [availableCourses, editCourseQueryLower]
  )

  const totalPages = Math.ceil(filteredLecturers.length / pageSize)
  const maxPage = totalPages || 1
  const paginatedLecturers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredLecturers.slice(start, start + pageSize)
  }, [filteredLecturers, currentPage, pageSize])

  const handleAddLecturer = async () => {
    if (!newLecturer.name.trim()) {
      toast({ title: "Validation Error", description: "Lecturer name is required.", variant: "destructive" })
      return
    }
    if (!newLecturer.email.trim()) {
      toast({ title: "Validation Error", description: "Email address is required.", variant: "destructive" })
      return
    }
    
    try {
      setSaving(true)
      const response = await fetch('/api/lecturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLecturer.name,
          email: newLecturer.email,
          department: newLecturer.department,
          maxWorkload: newLecturer.maxWorkload,
          courses: newLecturer.courses,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        toast({ title: "Error", description: data.error || "Failed to create lecturer. Please try again.", variant: "destructive" })
        return
      }
      
      setLecturers([...lecturers, data])
      setNewLecturer({
        id: "",
        name: "",
        email: "",
        department: "Computer Science",
        load: 0,
        maxWorkload: 15,
        courses: [],
      })
      setIsAddDialogOpen(false)
      toast({ title: "Success", description: "Lecturer created successfully." })
    } catch (error) {
      console.error('Error creating lecturer:', error)
      toast({ title: "Error", description: "Failed to create lecturer. Please try again.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleEditLecturer = async () => {
    if (!editingLecturer) return
    
    try {
      setSaving(true)
      const response = await fetch(`/api/lecturers/${editingLecturer.databaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingLecturer.name,
          email: editingLecturer.email,
          department: editingLecturer.department,
          maxWorkload: editingLecturer.maxWorkload,
          courses: editingLecturer.courses,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        toast({ title: "Error", description: data.error || "Failed to update lecturer. Please try again.", variant: "destructive" })
        return
      }
      
      setLecturers(lecturers.map((l) => (l.id === editingLecturer.id ? data : l)))
      setIsEditDialogOpen(false)
      toast({ title: "Success", description: "Lecturer updated successfully." })
    } catch (error) {
      console.error('Error updating lecturer:', error)
      toast({ title: "Error", description: "Failed to update lecturer. Please try again.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLecturer = async (lecturer: Lecturer) => {
    try {
      const response = await fetch(`/api/lecturers/${lecturer.databaseId}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        toast({ title: "Error", description: data.error || "Failed to delete lecturer. Please try again.", variant: "destructive" })
        return
      }
      
      setLecturers(lecturers.filter((l) => l.id !== lecturer.id))
      toast({ title: "Success", description: "Lecturer deleted successfully." })
    } catch (error) {
      console.error('Error deleting lecturer:', error)
      toast({ title: "Error", description: "Failed to delete lecturer. Please try again.", variant: "destructive" })
    }
  }

  const toggleCourse = (course: string, lecturer: Lecturer, setLecturer: (l: Lecturer) => void) => {
    const newCourses = lecturer.courses.includes(course)
      ? lecturer.courses.filter((c) => c !== course)
      : [...lecturer.courses, course]
    setLecturer({ ...lecturer, courses: newCourses })
  }

  const lecturerColumns = [
    { key: "id" as const, label: "ID" },
    { key: "name" as const, label: "Name" },
    { key: "email" as const, label: "Email" },
    { key: "department" as const, label: "Department" },
    { key: "load" as const, label: "Teaching Load" },
    { key: "maxWorkload" as const, label: "Max Workload" },
    { key: "courses" as const, label: "Courses" },
  ]

  const getLoadColor = (load: number, maxWorkload: number) => {
    const ratio = load / maxWorkload
    if (ratio <= 0.6) return "bg-green-500"
    if (ratio <= 0.85) return "bg-amber-500"
    return "bg-red-500"
  }

  const getDepartmentColor = (dept: Department) => {
    const colors: Record<string, string> = {
      "Computer Science": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      "Software Engineering": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
      "Data Science": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
      "Cyber Security": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      "Electrical Engineering": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      "Computer Engineering": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      "Communications Engineering": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
      "Business Administration": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      "Business Information Technology": "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
      "E-Marketing & Social Media": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
      "Computer Graphics": "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
      "Basic Sciences": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
      "Accounting": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      "Coordination Unit for Service Courses": "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
    }
    return colors[dept] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
  }

  if (loading) {
    return (
      <EntityLayout title="Lecturer Management" description="Add, edit, and manage faculty members.">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </EntityLayout>
    )
  }

  return (
    <EntityLayout title="Lecturer Management" description="Add, edit, and manage faculty members.">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Lecturers ({filteredLecturers.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setIsImportDialogOpen(true)}>
              <ImportIcon className="mr-2 h-4 w-4" />
              Import
            </Button>
            <ExportDropdownWithDialog
              allData={lecturers.map((l) => ({ ...l, courses: l.courses.join(", ") }))}
              filteredData={paginatedLecturers.map((l) => ({ ...l, courses: l.courses.join(", ") }))}
              columns={lecturerColumns}
              filenamePrefix="lecturers"
              pdfTitle="Lecturers"
              totalLabel={`${lecturers.length}`}
              filteredLabel={`${paginatedLecturers.length}`}
              isFiltered={searchQuery !== ""}
              filterDescription={searchQuery ? `search: "${searchQuery}"` : undefined}
            />
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Lecturer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Lecturer</DialogTitle>
                  <DialogDescription>Enter the lecturer&apos;s information below.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lecturer-name">Full Name</Label>
                      <Input
                        id="lecturer-name"
                        value={newLecturer.name}
                        onChange={(e) => setNewLecturer({ ...newLecturer, name: e.target.value })}
                        placeholder="Dr. Full Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lecturer-email">Email</Label>
                      <Input
                        id="lecturer-email"
                        type="email"
                        value={newLecturer.email}
                        onChange={(e) => setNewLecturer({ ...newLecturer, email: e.target.value })}
                        placeholder="lecturer@psut.edu.jo"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lecturer-dept">Department</Label>
                      <Select
                        value={newLecturer.department}
                        onValueChange={(v) => setNewLecturer({ ...newLecturer, department: v as Department })}
                      >
                        <SelectTrigger id="lecturer-dept">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lecturer-max">Max Workload (hrs)</Label>
                      <Input
                        id="lecturer-max"
                        type="number"
                        min="1"
                        max="24"
                        value={newLecturer.maxWorkload}
                        onChange={(e) =>
                          setNewLecturer({ ...newLecturer, maxWorkload: Number.parseInt(e.target.value) || 15 })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>Courses Can Teach</Label>
                    <Input 
                      placeholder="Search courses..." 
                      value={addCourseQuery}
                      onChange={(e) => setAddCourseQuery(e.target.value)}
                      className="h-8 mb-2"
                    />
                    <div className="flex flex-col gap-2 max-h-32 overflow-y-auto border rounded-md p-3">
                      {filteredAddCourses.map((course) => (
                        <div key={course.code} className="flex items-start space-x-2">
                          <Checkbox
                            id={`new-course-${course.code}`}
                            checked={newLecturer.courses.includes(course.code)}
                            onCheckedChange={() => toggleCourse(course.code, newLecturer, setNewLecturer)}
                            className="mt-0.5"
                          />
                          <label htmlFor={`new-course-${course.code}`} className="text-sm cursor-pointer leading-tight">
                            <span className="font-semibold">{course.code}</span> - <span className="capitalize">{course.name}</span>
                          </label>
                        </div>
                      ))}
                      {availableCourses.length === 0 && (
                        <span className="text-sm text-muted-foreground text-center py-2">No courses available</span>
                      )}
                      {availableCourses.length > 0 && filteredAddCourses.length === 0 && (
                        <span className="text-sm text-muted-foreground text-center py-2">No courses match search</span>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddLecturer} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Lecturer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search lecturers..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-9 max-w-sm"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Teaching Load</TableHead>
                  <TableHead className="text-center">Max Workload</TableHead>
                  <TableHead>Courses</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLecturers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No lecturers found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLecturers.map((lecturer) => (
                    <TableRow key={lecturer.id}>
                      <TableCell className="font-mono text-sm">{lecturer.id}</TableCell>
                      <TableCell className="font-medium">{lecturer.name}</TableCell>
                      <TableCell>{lecturer.email}</TableCell>
                      <TableCell>
                        <Badge className={getDepartmentColor(lecturer.department)}>{lecturer.department}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={(lecturer.load / lecturer.maxWorkload) * 100}
                            className={`h-2 w-20 ${getLoadColor(lecturer.load, lecturer.maxWorkload)}`}
                          />
                          <span className="text-sm">{lecturer.load}h</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{lecturer.maxWorkload}h</TableCell>
                      <TableCell>
                        {lecturer.courses.length === 0 ? (
                          <span className="text-sm text-muted-foreground">None</span>
                        ) : (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-auto py-1 px-2 font-normal data-[state=open]:bg-muted hover:bg-muted/80">
                                <span className="text-sm font-medium">{lecturer.courses.length} course{lecturer.courses.length !== 1 ? 's' : ''}</span>
                                <ChevronDown className="ml-1 h-3 w-3 text-muted-foreground" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0 overflow-hidden border-border/50 shadow-md" align="end">
                              <div className="bg-muted/30 p-3 border-b border-border/50">
                                <p className="font-semibold text-sm text-foreground">Can Teach ({lecturer.courses.length})</p>
                              </div>
                              <ScrollArea className="max-h-[280px]">
                                <div className="p-1.5 space-y-0.5">
                                  {lecturer.courses.map((courseCode) => {
                                    const courseInfo = availableCourses.find(c => c.code === courseCode)
                                    return (
                                      <div key={courseCode} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/60 transition-colors">
                                        <Badge variant="secondary" className="text-xs font-medium font-mono shrink-0 bg-primary/10 text-primary hover:bg-primary/20 border-0">
                                          {courseCode}
                                        </Badge>
                                        <span className="text-sm font-medium text-foreground capitalize leading-tight">
                                          {courseInfo?.name || 'Unknown Course'}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setEditingLecturer({ ...lecturer })
                              setEditCourseQuery("")
                              setIsEditDialogOpen(true)
                            }}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteLecturer(lecturer)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(v) => {
                  setPageSize(Number(v))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[80px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 15, 25, 50, 100].map((s) => (
                    <SelectItem key={s} value={s.toString()}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {maxPage}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                aria-label="Go to first page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="Go to previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((p) => Math.min(maxPage, p + 1))}
                disabled={currentPage >= maxPage}
                aria-label="Go to next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(maxPage)}
                disabled={currentPage >= maxPage}
                aria-label="Go to last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Lecturer</DialogTitle>
            <DialogDescription>Update the lecturer&apos;s information.</DialogDescription>
          </DialogHeader>
          {editingLecturer && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lecturer ID</Label>
                  <Input value={editingLecturer.id} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editingLecturer.email}
                    onChange={(e) => setEditingLecturer({ ...editingLecturer, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={editingLecturer.name}
                  onChange={(e) => setEditingLecturer({ ...editingLecturer, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={editingLecturer.department}
                    onValueChange={(v) => setEditingLecturer({ ...editingLecturer, department: v as Department })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Max Workload (hrs)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="24"
                    value={editingLecturer.maxWorkload}
                    onChange={(e) =>
                      setEditingLecturer({ ...editingLecturer, maxWorkload: Number.parseInt(e.target.value) || 15 })
                    }
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label>Courses Can Teach</Label>
                <Input 
                  placeholder="Search courses..." 
                  value={editCourseQuery}
                  onChange={(e) => setEditCourseQuery(e.target.value)}
                  className="h-8 mb-2"
                />
                <div className="flex flex-col gap-2 max-h-32 overflow-y-auto border rounded-md p-3">
                  {filteredEditCourses.map((course) => (
                    <div key={course.code} className="flex items-start space-x-2">
                      <Checkbox
                        id={`edit-course-${course.code}`}
                        checked={editingLecturer.courses.includes(course.code)}
                        onCheckedChange={() => toggleCourse(course.code, editingLecturer, setEditingLecturer)}
                        className="mt-0.5"
                      />
                      <label htmlFor={`edit-course-${course.code}`} className="text-sm cursor-pointer leading-tight">
                        <span className="font-semibold">{course.code}</span> - <span className="capitalize">{course.name}</span>
                      </label>
                    </div>
                  ))}
                  {availableCourses.length === 0 && (
                    <span className="text-sm text-muted-foreground text-center py-2">No courses available</span>
                  )}
                  {availableCourses.length > 0 && filteredEditCourses.length === 0 && (
                    <span className="text-sm text-muted-foreground text-center py-2">No courses match search</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditLecturer} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        title="Import Lecturers"
        description="Upload a CSV, Excel, or JSON file with lecturer data."
        exampleHeaders={["name", "email", "department", "maxWorkload", "courses"]}
        columns={lecturerColumns}
        getRowKey={(row) => row.email.toLowerCase()}
        mapRow={(row: ParsedRow) => {
          const name = findColumn(row, "name", "full_name", "fullname", "lecturer_name")
          const email = findColumn(row, "email", "email_address", "emailaddress")
          if (!name || !email) return null

          const dept = findColumn(row, "department", "dept", "department_name")
          if (!dept || !departments.includes(dept as Department)) return null

          return {
            id: "",
            name,
            email,
            department: dept as Department,
            load: 0,
            maxWorkload: parseInt(findColumn(row, "maxWorkload", "max_workload", "workload") ?? "15", 10) || 15,
            courses: (findColumn(row, "courses", "course_list", "can_teach") ?? "").split(",").map((c) => c.trim()).filter(Boolean),
          }
        }}
        onImport={async (data) => {
          let added = 0
          let duplicates = 0
          let errors = 0
          for (const lecturer of data) {
            try {
              const response = await fetch('/api/lecturers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lecturer),
              })
              if (response.ok) {
                const created = await response.json()
                setLecturers((prev) => [...prev, created])
                added++
              } else if (response.status === 409) {
                duplicates++
              } else {
                errors++
              }
            } catch (error) {
              console.error('Error importing lecturer:', error)
              errors++
            }
          }
          return { added, duplicates, errors }
        }}
      />
    </EntityLayout>
  )
}
