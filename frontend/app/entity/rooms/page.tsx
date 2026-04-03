"use client"

import { useState, useMemo, useEffect } from "react"
import { EntityLayout } from "@/components/entity-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { ImportDialog } from "@/components/import-dialog"
import { findColumn, type ParsedRow } from "@/lib/import-utils"
import { ExportDropdownWithDialog } from "@/components/export-dialog"
import { useToast } from "@/hooks/use-toast"

type Room = {
  id: string
  databaseId?: number
  type: string
  capacity: number
  isAvailable: boolean
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [saving, setSaving] = useState(false)
  const [newRoom, setNewRoom] = useState<Room>({ id: "", type: "Classroom", capacity: 30, isAvailable: true })
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { toast } = useToast()

  // Fetch rooms from API
  useEffect(() => {
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/rooms')
      if (!response.ok) throw new Error('Failed to fetch rooms')
      const data = await response.json()
      setRooms(data)
    } catch (error) {
      console.error('Error fetching rooms:', error)
      toast({
        title: "Error",
        description: "Failed to load rooms. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredRooms = useMemo(
    () =>
      rooms.filter(
        (room) =>
          room.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          room.type.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [rooms, searchQuery]
  )

  const totalPages = Math.ceil(filteredRooms.length / pageSize)
  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRooms.slice(start, start + pageSize)
  }, [filteredRooms, currentPage, pageSize])

  const handleAddRoom = async () => {
    if (!newRoom.id.trim()) {
      toast({
        title: "Validation Error",
        description: "Room number is required.",
        variant: "destructive",
      })
      return
    }
    
    try {
      setSaving(true)
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoom),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to create room. Please try again.",
          variant: "destructive",
        })
        return
      }
      
      setRooms([...rooms, data])
      setNewRoom({ id: "", type: "Classroom", capacity: 30, isAvailable: true })
      setIsAddDialogOpen(false)
      toast({
        title: "Success",
        description: "Room created successfully.",
      })
    } catch (error) {
      console.error('Error creating room:', error)
      toast({
        title: "Error",
        description: "Failed to create room. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEditRoom = async () => {
    if (!editingRoom) return
    
    try {
      setSaving(true)
      const response = await fetch(`/api/rooms/${editingRoom.databaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: editingRoom.type,
          capacity: editingRoom.capacity,
          isAvailable: editingRoom.isAvailable,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to update room. Please try again.",
          variant: "destructive",
        })
        return
      }
      
      setRooms(rooms.map((r) => (r.id === editingRoom.id ? data : r)))
      setEditingRoom(null)
      toast({
        title: "Success",
        description: "Room updated successfully.",
      })
    } catch (error) {
      console.error('Error updating room:', error)
      toast({
        title: "Error",
        description: "Failed to update room. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRoom = async (room: Room) => {
    try {
      const response = await fetch(`/api/rooms/${room.databaseId}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to delete room. Please try again.",
          variant: "destructive",
        })
        return
      }
      
      setRooms(rooms.filter((r) => r.id !== room.id))
      toast({
        title: "Success",
        description: "Room deleted successfully.",
      })
    } catch (error) {
      console.error('Error deleting room:', error)
      toast({
        title: "Error",
        description: "Failed to delete room. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleToggleAvailability = async (room: Room) => {
    try {
      const response = await fetch(`/api/rooms/${room.databaseId}/toggle`, {
        method: 'PATCH',
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to update room availability.",
          variant: "destructive",
        })
        return
      }
      
      setRooms(rooms.map((r) => (r.id === room.id ? data : r)))
    } catch (error) {
      console.error('Error toggling availability:', error)
      toast({
        title: "Error",
        description: "Failed to update room availability.",
        variant: "destructive",
      })
    }
  }

  const roomColumns = [
    { key: "id" as const, label: "Room Number" },
    { key: "type" as const, label: "Type" },
    { key: "capacity" as const, label: "Capacity" },
    { key: "isAvailable" as const, label: "Available" },
  ]

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Classroom":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
      case "Lab":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  if (loading) {
    return (
      <EntityLayout title="Room Management" description="Add, edit, and manage classrooms and labs.">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </EntityLayout>
    )
  }

  return (
    <EntityLayout title="Room Management" description="Add, edit, and manage classrooms and labs.">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Rooms ({filteredRooms.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setIsImportDialogOpen(true)}>
              <ImportIcon className="mr-2 h-4 w-4" />
              Import
            </Button>
            <ExportDropdownWithDialog
              allData={rooms.map((r) => ({ ...r, isAvailable: r.isAvailable ? "Yes" : "No" }))}
              filteredData={paginatedRooms.map((r) => ({ ...r, isAvailable: r.isAvailable ? "Yes" : "No" }))}
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
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Room
                </Button>
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
                      <Input
                        id="room-id"
                        value={newRoom.id}
                        onChange={(e) => setNewRoom({ ...newRoom, id: e.target.value })}
                        placeholder="R401"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="room-capacity">Capacity</Label>
                      <Input
                        id="room-capacity"
                        type="number"
                        min="1"
                        value={newRoom.capacity}
                        onChange={(e) => setNewRoom({ ...newRoom, capacity: Number.parseInt(e.target.value) || 30 })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room-type">Room Type</Label>
                    <Select value={newRoom.type} onValueChange={(v) => setNewRoom({ ...newRoom, type: v })}>
                      <SelectTrigger id="room-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Classroom">Classroom</SelectItem>
                        <SelectItem value="Lab">Lab</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="room-available">Is Available</Label>
                    <Switch
                      id="room-available"
                      checked={newRoom.isAvailable}
                      onCheckedChange={(checked) => setNewRoom({ ...newRoom, isAvailable: checked })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddRoom} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Room
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
                placeholder="Search rooms..."
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
                  <TableHead>Room Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRooms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No rooms found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRooms.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell className="font-mono font-medium">{room.id}</TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(room.type)}>{room.type}</Badge>
                      </TableCell>
                      <TableCell>{room.capacity} seats</TableCell>
                      <TableCell>
                        <Switch
                          checked={room.isAvailable}
                          onCheckedChange={() => handleToggleAvailability(room)}
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingRoom({ ...room })}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteRoom(room)}>
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
      <Dialog open={!!editingRoom} onOpenChange={(open) => !open && setEditingRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
            <DialogDescription>Update the room information.</DialogDescription>
          </DialogHeader>
          {editingRoom && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Room Number</Label>
                  <Input value={editingRoom.id} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editingRoom.capacity}
                    onChange={(e) =>
                      setEditingRoom({ ...editingRoom, capacity: Number.parseInt(e.target.value) || 30 })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Room Type</Label>
                <Select value={editingRoom.type} onValueChange={(v) => setEditingRoom({ ...editingRoom, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Classroom">Classroom</SelectItem>
                    <SelectItem value="Lab">Lab</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Is Available</Label>
                <Switch
                  checked={editingRoom.isAvailable}
                  onCheckedChange={(checked) => setEditingRoom({ ...editingRoom, isAvailable: checked })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRoom(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditRoom} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        title="Import Rooms"
        description="Upload a CSV or Excel file with room data."
        exampleHeaders={["id", "type (Classroom/Lab)", "capacity", "isAvailable"]}
        columns={[
          { key: "id", label: "Room Number" },
          { key: "type", label: "Type" },
          { key: "capacity", label: "Capacity" },
          { key: "isAvailable", label: "Available" },
        ]}
        getRowKey={(row) => row.id.toLowerCase()}
        mapRow={(row: ParsedRow) => {
          const id = findColumn(row, "id", "room_id", "roomid", "room_number", "room number", "room")
          if (!id) return null
          const availableStr = findColumn(row, "isAvailable", "is_available", "available", "isavailable") ?? "true"
          const rawType = findColumn(row, "type", "room_type", "roomtype") ?? "Lecture Hall"
          return {
            id,
            type: rawType,
            capacity: parseInt(findColumn(row, "capacity", "seats", "size") ?? "30", 10) || 30,
            isAvailable: availableStr.toLowerCase() === "true" || availableStr === "1" || availableStr.toLowerCase() === "yes",
          }
        }}
        onImport={async (data) => {
          let added = 0
          let duplicates = 0
          let errors = 0
          for (const room of data) {
            try {
              const response = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(room),
              })
              if (response.ok) {
                const created = await response.json()
                setRooms((prev) => [...prev, created])
                added++
              } else if (response.status === 409) {
                duplicates++
              } else {
                errors++
              }
            } catch (error) {
              console.error('Error importing room:', error)
              errors++
            }
          }
          return { added, duplicates, errors }
        }}
      />
    </EntityLayout>
  )
}
