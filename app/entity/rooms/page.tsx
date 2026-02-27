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
import { mockRooms } from "@/lib/data"
import { ImportDialog } from "@/components/import-dialog"
import { findColumn, type ParsedRow } from "@/lib/import-utils"
import { ExportDropdownWithDialog } from "@/components/export-dialog"

export default function RoomsPage() {
  const [rooms, setRooms] = useState(mockRooms)
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<(typeof mockRooms)[0] | null>(null)
  const [newRoom, setNewRoom] = useState({ id: "", building: "", capacity: 30, type: "Classroom" })
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filteredRooms = useMemo(() => rooms.filter(
    (room) => room.id.toLowerCase().includes(searchQuery.toLowerCase()) || room.building.toLowerCase().includes(searchQuery.toLowerCase()),
  ), [rooms, searchQuery])

  const totalPages = Math.ceil(filteredRooms.length / pageSize)
  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRooms.slice(start, start + pageSize)
  }, [filteredRooms, currentPage, pageSize])

  const handleAddRoom = () => {
    if (newRoom.id && newRoom.building) {
      setRooms([...rooms, newRoom])
      setNewRoom({ id: "", building: "", capacity: 30, type: "Classroom" })
      setIsAddDialogOpen(false)
    }
  }

  const handleEditRoom = () => {
    if (editingRoom) {
      setRooms(rooms.map((r) => (r.id === editingRoom.id ? editingRoom : r)))
      setEditingRoom(null)
    }
  }

  const handleDeleteRoom = (id: string) => { setRooms(rooms.filter((r) => r.id !== id)) }

  const roomColumns = [
    { key: "id" as const, label: "Room Number" }, { key: "building" as const, label: "Building" },
    { key: "type" as const, label: "Type" }, { key: "capacity" as const, label: "Capacity" },
  ]

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Lecture Hall": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
      case "Lab": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      case "Seminar Room": return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
      default: return "bg-muted text-muted-foreground"
    }
  }

  return (
    <EntityLayout title="Room Management" description="Add, edit, and manage classrooms and labs.">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Rooms ({filteredRooms.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setIsImportDialogOpen(true)}>
              <ImportIcon className="mr-2 h-4 w-4" />Import
            </Button>
            <ExportDropdownWithDialog
              allData={rooms}
              filteredData={paginatedRooms}
              columns={roomColumns}
              filenamePrefix="rooms"
              pdfTitle="Rooms"
              totalLabel={`${rooms.length}`}
              filteredLabel={`${paginatedRooms.length}`}
              isFiltered={searchQuery !== ""}
              filterDescription={searchQuery ? `search: "${searchQuery}"` : undefined}
            />
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Room</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Room</DialogTitle>
                  <DialogDescription>Enter the room information below.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="room-id">Room Number</Label>
                      <Input id="room-id" value={newRoom.id} onChange={(e) => setNewRoom({ ...newRoom, id: e.target.value })} placeholder="R401" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="room-capacity">Capacity</Label>
                      <Input id="room-capacity" type="number" min="10" value={newRoom.capacity} onChange={(e) => setNewRoom({ ...newRoom, capacity: Number.parseInt(e.target.value) || 30 })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room-building">Building</Label>
                    <Select value={newRoom.building} onValueChange={(v) => setNewRoom({ ...newRoom, building: v })}>
                      <SelectTrigger id="room-building"><SelectValue placeholder="Select building" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Building A">Building A</SelectItem>
                        <SelectItem value="Building B">Building B</SelectItem>
                        <SelectItem value="Building C">Building C</SelectItem>
                        <SelectItem value="Building D">Building D</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room-type">Room Type</Label>
                    <Select value={newRoom.type} onValueChange={(v) => setNewRoom({ ...newRoom, type: v })}>
                      <SelectTrigger id="room-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Classroom">Classroom</SelectItem>
                        <SelectItem value="Lecture Hall">Lecture Hall</SelectItem>
                        <SelectItem value="Lab">Lab</SelectItem>
                        <SelectItem value="Seminar Room">Seminar Room</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddRoom}>Add Room</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search rooms..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }} className="pl-9 max-w-sm" />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room Number</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-mono font-medium">{room.id}</TableCell>
                    <TableCell>{room.building}</TableCell>
                    <TableCell><Badge className={getTypeColor(room.type)}>{room.type}</Badge></TableCell>
                    <TableCell>{room.capacity} seats</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingRoom({ ...room })}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteRoom(room.id)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
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

      {/* Edit Dialog */}
      <Dialog open={!!editingRoom} onOpenChange={(open) => !open && setEditingRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
            <DialogDescription>Update the room information.</DialogDescription>
          </DialogHeader>
          {editingRoom && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Room Number</Label><Input value={editingRoom.id} disabled /></div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input type="number" min="10" value={editingRoom.capacity} onChange={(e) => setEditingRoom({ ...editingRoom, capacity: Number.parseInt(e.target.value) || 30 })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Building</Label>
                <Select value={editingRoom.building} onValueChange={(v) => setEditingRoom({ ...editingRoom, building: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Building A">Building A</SelectItem>
                    <SelectItem value="Building B">Building B</SelectItem>
                    <SelectItem value="Building C">Building C</SelectItem>
                    <SelectItem value="Building D">Building D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Room Type</Label>
                <Select value={editingRoom.type} onValueChange={(v) => setEditingRoom({ ...editingRoom, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Classroom">Classroom</SelectItem>
                    <SelectItem value="Lecture Hall">Lecture Hall</SelectItem>
                    <SelectItem value="Lab">Lab</SelectItem>
                    <SelectItem value="Seminar Room">Seminar Room</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRoom(null)}>Cancel</Button>
            <Button onClick={handleEditRoom}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}
        title="Import Rooms" description="Upload a CSV or Excel file with room data."
        exampleHeaders={["id", "building", "capacity", "type"]}
        columns={[{ key: "id", label: "Room Number" }, { key: "building", label: "Building" }, { key: "capacity", label: "Capacity" }, { key: "type", label: "Type" }]}
        mapRow={(row: ParsedRow) => {
          const id = findColumn(row, "id", "room_id", "roomid", "room_number", "room number", "room")
          const building = findColumn(row, "building", "building_name", "buildingname")
          if (!id) return null
          return { id, building: building ?? "", capacity: parseInt(findColumn(row, "capacity", "seats", "size") ?? "30", 10) || 30, type: findColumn(row, "type", "room_type", "roomtype") ?? "Classroom" }
        }}
        onImport={(data) => {
          const existingIds = new Set(rooms.map((r) => r.id))
          const newEntries = data.filter((r) => !existingIds.has(r.id))
          setRooms((prev) => [...prev, ...newEntries])
        }}
      />
    </EntityLayout>
  )
}
