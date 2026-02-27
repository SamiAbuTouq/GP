"use client"

import { useState, useMemo } from "react"
import { EntityLayout } from "@/components/entity-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, Edit, Trash2, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react"
import { ImportIcon } from "@/components/custom-icons"
import { mockLecturers } from "@/lib/data"
import { ImportDialog } from "@/components/import-dialog"
import { findColumn, type ParsedRow } from "@/lib/import-utils"
import { ExportDropdownWithDialog } from "@/components/export-dialog"

export default function LecturersPage() {
  const [lecturers, setLecturers] = useState(mockLecturers)
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingLecturer, setEditingLecturer] = useState<(typeof mockLecturers)[0] | null>(null)
  const [newLecturer, setNewLecturer] = useState({ id: "", name: "", department: "", load: 12, email: "" })
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filteredLecturers = useMemo(() => lecturers.filter(
    (l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.department.toLowerCase().includes(searchQuery.toLowerCase()),
  ), [lecturers, searchQuery])

  const totalPages = Math.ceil(filteredLecturers.length / pageSize)
  const paginatedLecturers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredLecturers.slice(start, start + pageSize)
  }, [filteredLecturers, currentPage, pageSize])

  const handleAddLecturer = () => {
    if (newLecturer.id && newLecturer.name) {
      setLecturers([...lecturers, newLecturer])
      setNewLecturer({ id: "", name: "", department: "", load: 12, email: "" })
      setIsAddDialogOpen(false)
    }
  }

  const handleEditLecturer = () => {
    if (editingLecturer) {
      setLecturers(lecturers.map((l) => (l.id === editingLecturer.id ? editingLecturer : l)))
      setEditingLecturer(null)
    }
  }

  const handleDeleteLecturer = (id: string) => {
    setLecturers(lecturers.filter((l) => l.id !== id))
  }

  const lecturerColumns = [
    { key: "id" as const, label: "ID" }, { key: "name" as const, label: "Name" }, { key: "email" as const, label: "Email" },
    { key: "department" as const, label: "Department" }, { key: "load" as const, label: "Teaching Load" },
  ]

  const getLoadColor = (load: number) => {
    if (load <= 9) return "bg-green-500"
    if (load <= 12) return "bg-amber-500"
    return "bg-red-500"
  }

  return (
    <EntityLayout title="Lecturer Management" description="Add, edit, and manage faculty members.">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Lecturers ({filteredLecturers.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setIsImportDialogOpen(true)}>
              <ImportIcon className="mr-2 h-4 w-4" />Import
            </Button>
            <ExportDropdownWithDialog
              allData={lecturers}
              filteredData={paginatedLecturers}
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
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Lecturer</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Lecturer</DialogTitle>
                  <DialogDescription>Enter the lecturer&apos;s information below.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lecturer-id">Lecturer ID</Label>
                      <Input id="lecturer-id" value={newLecturer.id} onChange={(e) => setNewLecturer({ ...newLecturer, id: e.target.value })} placeholder="LEC005" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lecturer-load">Teaching Load (hrs)</Label>
                      <Input id="lecturer-load" type="number" min="3" max="18" value={newLecturer.load} onChange={(e) => setNewLecturer({ ...newLecturer, load: Number.parseInt(e.target.value) || 12 })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lecturer-name">Full Name</Label>
                    <Input id="lecturer-name" value={newLecturer.name} onChange={(e) => setNewLecturer({ ...newLecturer, name: e.target.value })} placeholder="Dr. Full Name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lecturer-email">Email</Label>
                    <Input id="lecturer-email" type="email" value={newLecturer.email} onChange={(e) => setNewLecturer({ ...newLecturer, email: e.target.value })} placeholder="lecturer@psut.edu.jo" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lecturer-dept">Department</Label>
                    <Select value={newLecturer.department} onValueChange={(v) => setNewLecturer({ ...newLecturer, department: v })}>
                      <SelectTrigger id="lecturer-dept"><SelectValue placeholder="Select department" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Computer Science">Computer Science</SelectItem>
                        <SelectItem value="Software Engineering">Software Engineering</SelectItem>
                        <SelectItem value="Data Science">Data Science</SelectItem>
                        <SelectItem value="Information Systems">Information Systems</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddLecturer}>Add Lecturer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search lecturers..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }} className="pl-9 max-w-sm" />
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
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLecturers.map((lecturer) => (
                  <TableRow key={lecturer.id}>
                    <TableCell className="font-mono text-sm">{lecturer.id}</TableCell>
                    <TableCell className="font-medium">{lecturer.name}</TableCell>
                    <TableCell>{lecturer.email}</TableCell>
                    <TableCell><Badge variant="secondary">{lecturer.department}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={(lecturer.load / 18) * 100} className={`h-2 w-20 ${getLoadColor(lecturer.load)}`} />
                        <span className="text-sm">{lecturer.load}h</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingLecturer({ ...lecturer })}>
                            <Edit className="mr-2 h-4 w-4" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteLecturer(lecturer.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />Delete
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
                  {[10, 15, 25, 50, 100].map((s) => (<SelectItem key={s} value={s.toString()}>{s}</SelectItem>))}
                </SelectContent>
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

      {/* Edit Dialog */}
      <Dialog open={!!editingLecturer} onOpenChange={(open) => !open && setEditingLecturer(null)}>
        <DialogContent>
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
                  <Label>Teaching Load (hrs)</Label>
                  <Input type="number" min="3" max="18" value={editingLecturer.load} onChange={(e) => setEditingLecturer({ ...editingLecturer, load: Number.parseInt(e.target.value) || 12 })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={editingLecturer.name} onChange={(e) => setEditingLecturer({ ...editingLecturer, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={editingLecturer.email} onChange={(e) => setEditingLecturer({ ...editingLecturer, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={editingLecturer.department} onValueChange={(v) => setEditingLecturer({ ...editingLecturer, department: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Computer Science">Computer Science</SelectItem>
                    <SelectItem value="Software Engineering">Software Engineering</SelectItem>
                    <SelectItem value="Data Science">Data Science</SelectItem>
                    <SelectItem value="Information Systems">Information Systems</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLecturer(null)}>Cancel</Button>
            <Button onClick={handleEditLecturer}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}
        title="Import Lecturers" description="Upload a CSV or Excel file with lecturer data."
        exampleHeaders={["id", "name", "department", "load", "email"]}
        columns={[{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "department", label: "Department" }, { key: "load", label: "Load" }, { key: "email", label: "Email" }]}
        mapRow={(row: ParsedRow) => {
          const id = findColumn(row, "id", "lecturer_id", "lecturerid", "lecturer id")
          const name = findColumn(row, "name", "full_name", "fullname", "lecturer_name")
          if (!id || !name) return null
          return { id, name, department: findColumn(row, "department", "dept", "department_name") ?? "", load: parseInt(findColumn(row, "load", "teaching_load", "teachingload", "hours") ?? "12", 10) || 12, email: findColumn(row, "email", "e-mail", "mail") ?? "" }
        }}
        onImport={(data) => {
          const existingIds = new Set(lecturers.map((l) => l.id))
          const newEntries = data.filter((l) => !existingIds.has(l.id))
          setLecturers((prev) => [...prev, ...newEntries])
        }}
      />
    </EntityLayout>
  )
}
