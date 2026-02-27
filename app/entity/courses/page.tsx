"use client"

import { useState, useMemo } from "react"
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
import { Plus, Search, Edit, Trash2, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react"
import { ImportIcon } from "@/components/custom-icons"
import { mockCourses } from "@/lib/data"
import { ImportDialog } from "@/components/import-dialog"
import { findColumn, type ParsedRow } from "@/lib/import-utils"
import { ExportDropdownWithDialog } from "@/components/export-dialog"

export default function CoursesPage() {
  const [courses, setCourses] = useState(mockCourses)
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<(typeof mockCourses)[0] | null>(null)
  const [newCourse, setNewCourse] = useState({ code: "", name: "", credits: 3, type: "Core", sections: 1 })
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filteredCourses = useMemo(() => courses.filter(
    (course) =>
      course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.name.toLowerCase().includes(searchQuery.toLowerCase()),
  ), [courses, searchQuery])

  const totalPages = Math.ceil(filteredCourses.length / pageSize)
  const paginatedCourses = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredCourses.slice(start, start + pageSize)
  }, [filteredCourses, currentPage, pageSize])

  const handleAddCourse = () => {
    if (newCourse.code && newCourse.name) {
      setCourses([...courses, newCourse])
      setNewCourse({ code: "", name: "", credits: 3, type: "Core", sections: 1 })
      setIsAddDialogOpen(false)
    }
  }

  const handleEditCourse = () => {
    if (editingCourse) {
      setCourses(courses.map((c) => (c.code === editingCourse.code ? editingCourse : c)))
      setEditingCourse(null)
    }
  }

  const handleDeleteCourse = (code: string) => {
    setCourses(courses.filter((c) => c.code !== code))
  }

  const courseColumns = [
    { key: "code" as const, label: "Code" },
    { key: "name" as const, label: "Name" },
    { key: "credits" as const, label: "Credits" },
    { key: "type" as const, label: "Type" },
    { key: "sections" as const, label: "Sections" },
  ]

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
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Course</DialogTitle>
                  <DialogDescription>Enter the course information below.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="course-code">Course Code</Label>
                      <Input id="course-code" value={newCourse.code} onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })} placeholder="CS401" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="course-credits">Credits</Label>
                      <Select value={newCourse.credits.toString()} onValueChange={(v) => setNewCourse({ ...newCourse, credits: Number.parseInt(v) })}>
                        <SelectTrigger id="course-credits"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Credit</SelectItem>
                          <SelectItem value="2">2 Credits</SelectItem>
                          <SelectItem value="3">3 Credits</SelectItem>
                          <SelectItem value="4">4 Credits</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="course-name">Course Name</Label>
                    <Input id="course-name" value={newCourse.name} onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })} placeholder="Course Name" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="course-type">Type</Label>
                      <Select value={newCourse.type} onValueChange={(v) => setNewCourse({ ...newCourse, type: v })}>
                        <SelectTrigger id="course-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Core">Core</SelectItem>
                          <SelectItem value="Elective">Elective</SelectItem>
                          <SelectItem value="Lab">Lab</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="course-sections">Sections</Label>
                      <Input id="course-sections" type="number" min="1" value={newCourse.sections} onChange={(e) => setNewCourse({ ...newCourse, sections: Number.parseInt(e.target.value) || 1 })} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddCourse}>Add Course</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search courses..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }} className="pl-9 max-w-sm" />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sections</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCourses.map((course) => (
                  <TableRow key={course.code}>
                    <TableCell className="font-mono font-medium">{course.code}</TableCell>
                    <TableCell>{course.name}</TableCell>
                    <TableCell>{course.credits}</TableCell>
                    <TableCell>
                      <Badge variant={course.type === "Core" ? "default" : "secondary"}>{course.type}</Badge>
                    </TableCell>
                    <TableCell>{course.sections}</TableCell>
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
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteCourse(course.code)}>
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

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page</span>
              <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1) }}>
                <SelectTrigger className="w-[80px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 15, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages || 1}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingCourse} onOpenChange={(open) => !open && setEditingCourse(null)}>
        <DialogContent>
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
                  <Label>Credits</Label>
                  <Select value={editingCourse.credits.toString()} onValueChange={(v) => setEditingCourse({ ...editingCourse, credits: Number.parseInt(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Credit</SelectItem>
                      <SelectItem value="2">2 Credits</SelectItem>
                      <SelectItem value="3">3 Credits</SelectItem>
                      <SelectItem value="4">4 Credits</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Course Name</Label>
                <Input value={editingCourse.name} onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={editingCourse.type} onValueChange={(v) => setEditingCourse({ ...editingCourse, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Core">Core</SelectItem>
                      <SelectItem value="Elective">Elective</SelectItem>
                      <SelectItem value="Lab">Lab</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sections</Label>
                  <Input type="number" min="1" value={editingCourse.sections} onChange={(e) => setEditingCourse({ ...editingCourse, sections: Number.parseInt(e.target.value) || 1 })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCourse(null)}>Cancel</Button>
            <Button onClick={handleEditCourse}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        title="Import Courses"
        description="Upload a CSV or Excel file with course data."
        exampleHeaders={["code", "name", "credits", "type", "sections"]}
        columns={[
          { key: "code", label: "Code" },
          { key: "name", label: "Name" },
          { key: "credits", label: "Credits" },
          { key: "type", label: "Type" },
          { key: "sections", label: "Sections" },
        ]}
        mapRow={(row: ParsedRow) => {
          const code = findColumn(row, "code", "course_code", "coursecode", "course code")
          const name = findColumn(row, "name", "course_name", "coursename", "course name", "title")
          if (!code || !name) return null
          return {
            code, name,
            credits: parseInt(findColumn(row, "credits", "credit_hours", "credithours") ?? "3", 10) || 3,
            type: findColumn(row, "type", "course_type", "coursetype") ?? "Core",
            sections: parseInt(findColumn(row, "sections", "num_sections", "numsections") ?? "1", 10) || 1,
          }
        }}
        onImport={(data) => {
          const existingCodes = new Set(courses.map((c) => c.code))
          const newEntries = data.filter((c) => !existingCodes.has(c.code))
          setCourses((prev) => [...prev, ...newEntries])
        }}
      />
    </EntityLayout>
  )
}
