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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, Edit, Trash2, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react"
import { ImportIcon } from "@/components/custom-icons"
import { mockStudents } from "@/lib/data"
import { ImportDialog } from "@/components/import-dialog"
import { findColumn, type ParsedRow } from "@/lib/import-utils"
import { ExportDropdownWithDialog } from "@/components/export-dialog"

export default function StudentsPage() {
  const [students, setStudents] = useState(mockStudents)
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<(typeof mockStudents)[0] | null>(null)
  const [newStudent, setNewStudent] = useState({ id: "", name: "", major: "", year: 1, email: "" })
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filteredStudents = useMemo(() => students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.major.toLowerCase().includes(searchQuery.toLowerCase()),
  ), [students, searchQuery])

  const totalPages = Math.ceil(filteredStudents.length / pageSize)
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredStudents.slice(start, start + pageSize)
  }, [filteredStudents, currentPage, pageSize])

  const handleAddStudent = () => {
    if (newStudent.id && newStudent.name) {
      setStudents([...students, newStudent])
      setNewStudent({ id: "", name: "", major: "", year: 1, email: "" })
      setIsAddDialogOpen(false)
    }
  }

  const handleDeleteStudent = (id: string) => { setStudents(students.filter((s) => s.id !== id)) }

  const handleEditStudent = () => {
    if (editingStudent) {
      setStudents(students.map((s) => (s.id === editingStudent.id ? editingStudent : s)))
      setEditingStudent(null)
    }
  }

  const studentColumns = [
    { key: "id" as const, label: "ID" }, { key: "name" as const, label: "Name" }, { key: "email" as const, label: "Email" },
    { key: "major" as const, label: "Major" }, { key: "year" as const, label: "Year" },
  ]

  return (
    <EntityLayout title="Student Management" description="Add, edit, and manage student records.">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Students ({filteredStudents.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setIsImportDialogOpen(true)}>
              <ImportIcon className="mr-2 h-4 w-4" />Import
            </Button>
            <ExportDropdownWithDialog
              allData={students}
              filteredData={paginatedStudents}
              columns={studentColumns}
              filenamePrefix="students"
              pdfTitle="Students"
              totalLabel={`${students.length}`}
              filteredLabel={`${paginatedStudents.length}`}
              isFiltered={searchQuery !== ""}
              filterDescription={searchQuery ? `search: "${searchQuery}"` : undefined}
            />
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Student</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Student</DialogTitle>
                  <DialogDescription>Enter the student&apos;s information below.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="student-id">Student ID</Label>
                      <Input id="student-id" value={newStudent.id} onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value })} placeholder="STU006" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student-year">Academic Year</Label>
                      <Select value={newStudent.year.toString()} onValueChange={(v) => setNewStudent({ ...newStudent, year: Number.parseInt(v) })}>
                        <SelectTrigger id="student-year"><SelectValue placeholder="Select year" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Year 1</SelectItem>
                          <SelectItem value="2">Year 2</SelectItem>
                          <SelectItem value="3">Year 3</SelectItem>
                          <SelectItem value="4">Year 4</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-name">Full Name</Label>
                    <Input id="student-name" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} placeholder="Student Name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-email">Email</Label>
                    <Input id="student-email" type="email" value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} placeholder="student@psut.edu.jo" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-major">Major</Label>
                    <Select value={newStudent.major} onValueChange={(v) => setNewStudent({ ...newStudent, major: v })}>
                      <SelectTrigger id="student-major"><SelectValue placeholder="Select major" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Computer Science">Computer Science</SelectItem>
                        <SelectItem value="Software Engineering">Software Engineering</SelectItem>
                        <SelectItem value="Data Science">Data Science</SelectItem>
                        <SelectItem value="Information Systems">Information Systems</SelectItem>
                        <SelectItem value="Cybersecurity">Cybersecurity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddStudent}>Add Student</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search students..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }} className="pl-9 max-w-sm" />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Major</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-mono text-sm">{student.id}</TableCell>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell><Badge variant="secondary">{student.major}</Badge></TableCell>
                    <TableCell>Year {student.year}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingStudent({ ...student })}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteStudent(student.id)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page</span>
              <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1) }}>
                <SelectTrigger className="w-[80px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{[10, 15, 25, 50, 100].map((s) => (<SelectItem key={s} value={s.toString()}>{s}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages || 1}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ImportDialog
        open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}
        title="Import Students" description="Upload a CSV or Excel file with student data."
        exampleHeaders={["id", "name", "major", "year", "email"]}
        columns={[{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "major", label: "Major" }, { key: "year", label: "Year" }, { key: "email", label: "Email" }]}
        mapRow={(row: ParsedRow) => {
          const id = findColumn(row, "id", "student_id", "studentid", "student id")
          const name = findColumn(row, "name", "full_name", "fullname", "student_name", "student name")
          if (!id || !name) return null
          return { id, name, major: findColumn(row, "major", "department", "dept") ?? "", year: parseInt(findColumn(row, "year", "academic_year", "academicyear", "level") ?? "1", 10) || 1, email: findColumn(row, "email", "e-mail", "mail") ?? "" }
        }}
        onImport={(data) => {
          const existingIds = new Set(students.map((s) => s.id))
          const newEntries = data.filter((s) => !existingIds.has(s.id))
          setStudents((prev) => [...prev, ...newEntries])
        }}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>Update the student&apos;s information.</DialogDescription>
          </DialogHeader>
          {editingStudent && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Student ID</Label><Input value={editingStudent.id} disabled /></div>
                <div className="space-y-2">
                  <Label>Academic Year</Label>
                  <Select value={editingStudent.year.toString()} onValueChange={(v) => setEditingStudent({ ...editingStudent, year: Number.parseInt(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Year 1</SelectItem>
                      <SelectItem value="2">Year 2</SelectItem>
                      <SelectItem value="3">Year 3</SelectItem>
                      <SelectItem value="4">Year 4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Full Name</Label><Input value={editingStudent.name} onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={editingStudent.email} onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Major</Label>
                <Select value={editingStudent.major} onValueChange={(v) => setEditingStudent({ ...editingStudent, major: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Computer Science">Computer Science</SelectItem>
                    <SelectItem value="Software Engineering">Software Engineering</SelectItem>
                    <SelectItem value="Data Science">Data Science</SelectItem>
                    <SelectItem value="Information Systems">Information Systems</SelectItem>
                    <SelectItem value="Cybersecurity">Cybersecurity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStudent(null)}>Cancel</Button>
            <Button onClick={handleEditStudent}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityLayout>
  )
}
