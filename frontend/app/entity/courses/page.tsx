"use client"

import { useState, useMemo, useEffect } from "react"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, Edit, Trash2, MoreHorizontal, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { ImportIcon } from "@/components/custom-icons"
import { departments, deliveryModes, type Department, type DeliveryMode } from "@/lib/data"
import { ImportDialog } from "@/components/import-dialog"
import { findColumn, type ParsedRow } from "@/lib/import-utils"
import { ExportDropdownWithDialog } from "@/components/export-dialog"
import { useToast } from "@/hooks/use-toast"

type Course = {
  id?: number
  code: string
  name: string
  creditHours: number
  academicLevel: number
  deliveryMode: DeliveryMode
  department: Department
  sections: number
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [saving, setSaving] = useState(false)
  const [newCourse, setNewCourse] = useState<Course>({
    code: "",
    name: "",
    creditHours: 3,
    academicLevel: 1,
    deliveryMode: "On-Campus",
    department: "Computer Science",
    sections: 1,
  })
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { toast } = useToast()

  // Fetch courses from API
  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/courses')
      if (!response.ok) throw new Error('Failed to fetch courses')
      const data = await response.json()
      setCourses(data)
    } catch (error) {
      console.error('Error fetching courses:', error)
      toast({
        title: "Error",
        description: "Failed to load courses. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredCourses = useMemo(
    () =>
      courses.filter(
        (course) =>
          course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.department.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [courses, searchQuery]
  )

  const totalPages = Math.ceil(filteredCourses.length / pageSize)
  const paginatedCourses = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredCourses.slice(start, start + pageSize)
  }, [filteredCourses, currentPage, pageSize])

  const handleAddCourse = async () => {
    if (!newCourse.code.trim()) {
      toast({ title: "Validation Error", description: "Course code is required.", variant: "destructive" })
      return
    }
    if (!newCourse.name.trim()) {
      toast({ title: "Validation Error", description: "Course name is required.", variant: "destructive" })
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCourse),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to create course. Please try again.",
          variant: "destructive",
        })
        return
      }

      setCourses([...courses, data])
      setNewCourse({
        code: "",
        name: "",
        creditHours: 3,
        academicLevel: 1,
        deliveryMode: "On-Campus",
        department: "Computer Science",
        sections: 1,
      })
      setIsAddDialogOpen(false)
      toast({
        title: "Success",
        description: "Course created successfully.",
      })
    } catch (error) {
      console.error('Error creating course:', error)
      toast({
        title: "Error",
        description: "Failed to create course. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEditCourse = async () => {
    if (!editingCourse) return

    try {
      setSaving(true)
      const response = await fetch(`/api/courses/${editingCourse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: editingCourse.code,
          name: editingCourse.name,
          creditHours: editingCourse.creditHours,
          academicLevel: editingCourse.academicLevel,
          deliveryMode: editingCourse.deliveryMode,
          department: editingCourse.department,
          sections: editingCourse.sections,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to update course. Please try again.",
          variant: "destructive",
        })
        return
      }

      setCourses(courses.map((c) => (c.id === editingCourse.id ? data : c)))
      setEditingCourse(null)
      toast({
        title: "Success",
        description: "Course updated successfully.",
      })
    } catch (error) {
      console.error('Error updating course:', error)
      toast({
        title: "Error",
        description: "Failed to update course. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCourse = async (course: Course) => {
    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to delete course. Please try again.",
          variant: "destructive",
        })
        return
      }

      setCourses(courses.filter((c) => c.id !== course.id))
      toast({
        title: "Success",
        description: "Course deleted successfully.",
      })
    } catch (error) {
      console.error('Error deleting course:', error)
      toast({
        title: "Error",
        description: "Failed to delete course. Please try again.",
        variant: "destructive",
      })
    }
  }

  const courseColumns = [
    { key: "code" as const, label: "Code" },
    { key: "name" as const, label: "Name" },
    { key: "creditHours" as const, label: "Credit Hours" },
    { key: "academicLevel" as const, label: "Academic Level" },
    { key: "deliveryMode" as const, label: "Delivery Mode" },
    { key: "department" as const, label: "Department" },
    { key: "sections" as const, label: "Sections" },
  ]

  const getDeliveryModeColor = (mode: DeliveryMode) => {
    switch (mode) {
      case "Online":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
      case "Blended":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
      case "On-Campus":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      default:
        return "bg-muted text-muted-foreground"
    }
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
      <EntityLayout title="Course Management" description="Add, edit, and manage course catalog.">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </EntityLayout>
    )
  }

  return (
    <EntityLayout title="Course Management" description="Add, edit, and manage course catalog.">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Courses ({filteredCourses.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setIsImportDialogOpen(true)}>
              <ImportIcon className="mr-2 h-4 w-4" />
              Import
            </Button>
            <ExportDropdownWithDialog
              allData={courses}
              filteredData={paginatedCourses}
              columns={courseColumns}
              filenamePrefix="courses"
              pdfTitle="Courses"
              totalLabel={`${courses.length}`}
              filteredLabel={`${paginatedCourses.length}`}
              isFiltered={searchQuery !== ""}
              filterDescription={searchQuery ? `search: "${searchQuery}"` : undefined}
            />
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Course
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Course</DialogTitle>
                  <DialogDescription>Enter the course information below.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="course-code">Course Code</Label>
                      <Input
                        id="course-code"
                        value={newCourse.code}
                        onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                        placeholder="CS401"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="course-credits">Credit Hours</Label>
                      <Input
                        id="course-credits"
                        type="number"
                        min="1"
                        max="6"
                        value={newCourse.creditHours}
                        onChange={(e) =>
                          setNewCourse({ ...newCourse, creditHours: Number.parseInt(e.target.value) || 3 })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="course-name">Course Name</Label>
                    <Input
                      id="course-name"
                      value={newCourse.name}
                      onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                      placeholder="Course Name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="course-level">Academic Level</Label>
                      <Select
                        value={newCourse.academicLevel.toString()}
                        onValueChange={(v) => setNewCourse({ ...newCourse, academicLevel: Number.parseInt(v) || 1 })}
                      >
                        <SelectTrigger id="course-level">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((level) => (
                            <SelectItem key={level} value={level.toString()}>
                              Year {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="course-sections">Number of Sections</Label>
                      <Input
                        id="course-sections"
                        type="number"
                        min="1"
                        max="20"
                        value={newCourse.sections}
                        onChange={(e) =>
                          setNewCourse({ ...newCourse, sections: Math.max(1, Number.parseInt(e.target.value) || 1) })
                        }
                        placeholder="1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="course-delivery">Delivery Mode</Label>
                      <Select
                        value={newCourse.deliveryMode}
                        onValueChange={(v) => setNewCourse({ ...newCourse, deliveryMode: v as DeliveryMode })}
                      >
                        <SelectTrigger id="course-delivery">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {deliveryModes.map((mode) => (
                            <SelectItem key={mode} value={mode}>
                              {mode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="course-department">Department</Label>
                      <Select
                        value={newCourse.department}
                        onValueChange={(v) => setNewCourse({ ...newCourse, department: v as Department })}
                      >
                        <SelectTrigger id="course-department">
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
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddCourse} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Course
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
                placeholder="Search courses..."
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
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-center">Credit Hours</TableHead>
                  <TableHead className="text-center">Academic Level</TableHead>
                  <TableHead>Delivery Mode</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-center">Sections</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCourses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No courses found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCourses.map((course) => (
                    <TableRow key={course.id || course.code}>
                      <TableCell className="font-mono font-medium">{course.code}</TableCell>
                      <TableCell>{course.name}</TableCell>
                      <TableCell className="text-center">{course.creditHours}</TableCell>
                      <TableCell className="text-center">{course.academicLevel}</TableCell>
                      <TableCell>
                        <Badge className={getDeliveryModeColor(course.deliveryMode)}>{course.deliveryMode}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getDepartmentColor(course.department)}>{course.department}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{course.sections}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingCourse({ ...course })}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteCourse(course)}>
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
                  {[10, 15, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingCourse} onOpenChange={(open) => !open && setEditingCourse(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>Update the course information.</DialogDescription>
          </DialogHeader>
          {editingCourse && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Course Code</Label>
                  <Input value={editingCourse.code} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Credit Hours</Label>
                  <Input
                    type="number"
                    min="1"
                    max="6"
                    value={editingCourse.creditHours}
                    onChange={(e) =>
                      setEditingCourse({ ...editingCourse, creditHours: Number.parseInt(e.target.value) || 3 })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Course Name</Label>
                <Input
                  value={editingCourse.name}
                  onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Academic Level</Label>
                  <Select
                    value={editingCourse.academicLevel.toString()}
                    onValueChange={(v) => setEditingCourse({ ...editingCourse, academicLevel: Number.parseInt(v) || 1 })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((level) => (
                        <SelectItem key={level} value={level.toString()}>
                          Year {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Number of Sections</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={editingCourse.sections}
                    onChange={(e) =>
                      setEditingCourse({ ...editingCourse, sections: Math.max(1, Number.parseInt(e.target.value) || 1) })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 min-w-0">
                  <Label>Delivery Mode</Label>
                  <Select
                    value={editingCourse.deliveryMode}
                    onValueChange={(v) => setEditingCourse({ ...editingCourse, deliveryMode: v as DeliveryMode })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryModes.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 min-w-0">
                  <Label>Department</Label>
                  <Select
                    value={editingCourse.department}
                    onValueChange={(v) => setEditingCourse({ ...editingCourse, department: v as Department })}
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
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCourse(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditCourse} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        title="Import Courses"
        description="Upload a CSV or Excel file with course data."
        exampleHeaders={["code", "name", "creditHours", "academicLevel", "deliveryMode", "department", "sections"]}
        columns={courseColumns}
        getRowKey={(row) => row.code.toLowerCase()}
        mapRow={(row: ParsedRow) => {
          const code = findColumn(row, "code", "course_code", "coursecode")
          if (!code) return null
          return {
            code,
            name: findColumn(row, "name", "course_name", "coursename") ?? "",
            creditHours: parseInt(findColumn(row, "creditHours", "credit_hours", "credithours", "credits") ?? "3", 10) || 3,
            academicLevel: parseInt(findColumn(row, "academicLevel", "academic_level", "academiclevel", "level") ?? "1", 10) || 1,
            deliveryMode: (findColumn(row, "deliveryMode", "delivery_mode", "deliverymode", "delivery") ?? "On-Campus") as DeliveryMode,
            department: (findColumn(row, "department", "dept", "department_name") ?? "Computer Science") as Department,
            sections: parseInt(findColumn(row, "sections", "section_count", "sectioncount") ?? "1", 10) || 1,
          }
        }}
        onImport={async (data) => {
          let added = 0
          let duplicates = 0
          let errors = 0
          for (const course of data) {
            try {
              const response = await fetch('/api/courses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(course),
              })
              if (response.ok) {
                const created = await response.json()
                setCourses((prev) => [...prev, created])
                added++
              } else if (response.status === 409) {
                duplicates++
              } else {
                errors++
              }
            } catch (error) {
              console.error('Error importing course:', error)
              errors++
            }
          }
          return { added, duplicates, errors }
        }}
      />
    </EntityLayout>
  )
}
