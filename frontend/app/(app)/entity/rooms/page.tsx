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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Archive,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react"
import { ImportIcon } from "@/components/custom-icons"
import { ImportDialog } from "@/components/import-dialog"
import { findColumn, type ParsedRow } from "@/lib/import-utils"
import { ExportDropdownWithDialog } from "@/components/export-dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Room = {
  id: string
  databaseId?: number
  type: string
  capacity: number
  isAvailable: boolean
}

type RoomSortColumn = "capacity"

function sortRoomsCopy(
  list: Room[],
  sortColumn: RoomSortColumn | null,
  sortDirection: "asc" | "desc",
): Room[] {
  const copy = [...list]
  if (!sortColumn) return copy
  const mult = sortDirection === "asc" ? 1 : -1
  copy.sort((a, b) => {
    let cmp = 0
    if (sortColumn === "capacity") {
      cmp = a.capacity - b.capacity
    }
    if (cmp !== 0) return cmp * mult
    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" }) * mult
  })
  return copy
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [archivedRooms, setArchivedRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingArchived, setLoadingArchived] = useState(false)
  const [tab, setTab] = useState<"active" | "archived">("active")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [saving, setSaving] = useState(false)
  const [newRoom, setNewRoom] = useState<Room>({ id: "", type: "Classroom", capacity: 30, isAvailable: true })
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortColumn, setSortColumn] = useState<RoomSortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [pendingAvailabilityIds, setPendingAvailabilityIds] = useState<Set<string>>(new Set())
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null)
  const [archivedRoomToPermanentlyDelete, setArchivedRoomToPermanentlyDelete] =
    useState<Room | null>(null)
  const [archivedRoomDeletionImpact, setArchivedRoomDeletionImpact] = useState<{
    entryCount: number
    timetables: { timetableId: number; generationType: string; status: string; versionNumber: number }[]
  } | null>(null)
  const [loadingDeletionImpact, setLoadingDeletionImpact] = useState(false)
  const [permanentlyDeleting, setPermanentlyDeleting] = useState(false)
  const { toast } = useToast()
  const formatTimetableLabel = (t: {
    timetableId: number
    generationType: string
    status: string
    versionNumber: number
  }) => `Timetable ${t.timetableId} (${t.status}, ${t.generationType} v${t.versionNumber})`

  // Fetch rooms from API
  useEffect(() => {
    fetchRooms()
  }, [])

  useEffect(() => {
    if (tab !== "archived") return
    fetchArchivedRooms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    if (tab !== "archived") return
    const interval = setInterval(() => {
      fetchArchivedRooms()
    }, 15000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

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

  const fetchArchivedRooms = async () => {
    try {
      setLoadingArchived(true)
      const response = await fetch("/api/rooms/archived/list", { cache: "no-store" })
      if (!response.ok) throw new Error("Failed to fetch archived rooms")
      const data = (await response.json()) as unknown[]
      setArchivedRooms(Array.isArray(data) ? (data as Room[]) : [])
    } catch (error) {
      console.error("Error fetching archived rooms:", error)
      toast({
        title: "Error",
        description: "Failed to load archived rooms. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingArchived(false)
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

  const sortedFilteredRooms = useMemo(
    () => sortRoomsCopy(filteredRooms, sortColumn, sortDirection),
    [filteredRooms, sortColumn, sortDirection],
  )

  const sortedAllRooms = useMemo(
    () => sortRoomsCopy(rooms, sortColumn, sortDirection),
    [rooms, sortColumn, sortDirection],
  )

  const totalPages = Math.ceil(sortedFilteredRooms.length / pageSize)
  const maxPage = totalPages || 1
  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedFilteredRooms.slice(start, start + pageSize)
  }, [sortedFilteredRooms, currentPage, pageSize])

  const handleSortCapacity = () => {
    setCurrentPage(1)
    if (sortColumn !== "capacity") {
      setSortColumn("capacity")
      setSortDirection("asc")
    } else {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    }
  }

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
      const errorMessage =
        (typeof data?.message === "string" && data.message) ||
        (Array.isArray(data?.message) ? data.message.join(", ") : undefined) ||
        data?.error
      
      if (!response.ok) {
        toast({
          title: "Error",
          description: errorMessage || "Failed to archive room. Please try again.",
          variant: "destructive",
        })
        return
      }
      
      setRooms(rooms.filter((r) => r.id !== room.id))
      await fetchArchivedRooms()
      toast({
        title: "Success",
        description: `${room.id} archived — it won't be used in future scheduling`,
      })
    } catch (error) {
      console.error('Error deleting room:', error)
      toast({
        title: "Error",
        description: "Failed to archive room. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRestoreArchivedRoom = async (room: Room) => {
    try {
      const response = await fetch(`/api/rooms/${room.databaseId}/restore`, { method: "PATCH" })
      const data = await response.json()
      const errorMessage =
        (typeof data?.message === "string" && data.message) ||
        (Array.isArray(data?.message) ? data.message.join(", ") : undefined) ||
        data?.error

      if (!response.ok) {
        toast({
          title: "Error",
          description: errorMessage || "Failed to restore room. Please try again.",
          variant: "destructive",
        })
        return
      }

      setArchivedRooms((prev) => prev.filter((r) => r.id !== room.id))
      await fetchRooms()
      toast({ title: "Success", description: "Room restored successfully." })
    } catch (error) {
      console.error("Error restoring room:", error)
      toast({
        title: "Error",
        description: "Failed to restore room. Please try again.",
        variant: "destructive",
      })
    }
  }

  const openPermanentDeleteRoomModal = async (room: Room) => {
    try {
      setLoadingDeletionImpact(true)
      const response = await fetch(`/api/rooms/${room.databaseId}/deletion-impact`, { cache: "no-store" })
      const data = await response.json()
      const errorMessage =
        (typeof data?.message === "string" && data.message) ||
        (Array.isArray(data?.message) ? data.message.join(", ") : undefined) ||
        data?.error

      if (!response.ok) {
        toast({
          title: "Error",
          description: errorMessage || "Failed to check deletion impact. Please try again.",
          variant: "destructive",
        })
        return
      }

      setArchivedRoomToPermanentlyDelete(room)
      setArchivedRoomDeletionImpact({
        entryCount: Number((data as { entryCount?: unknown }).entryCount ?? 0) || 0,
        timetables: Array.isArray((data as { timetables?: unknown }).timetables)
          ? ((data as { timetables: unknown[] }).timetables as {
              timetableId: number
              generationType: string
              status: string
              versionNumber: number
            }[])
          : [],
      })
    } catch (error) {
      console.error("Error checking deletion impact:", error)
      toast({
        title: "Error",
        description: "Failed to check deletion impact. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingDeletionImpact(false)
    }
  }

  const confirmPermanentDeleteArchivedRoom = async () => {
    if (!archivedRoomToPermanentlyDelete) return
    try {
      setPermanentlyDeleting(true)
      const response = await fetch(`/api/rooms/${archivedRoomToPermanentlyDelete.databaseId}/permanent`, {
        method: "DELETE",
      })
      const data = await response.json()
      const errorMessage =
        (typeof data?.message === "string" && data.message) ||
        (Array.isArray(data?.message) ? data.message.join(", ") : undefined) ||
        data?.error

      if (!response.ok) {
        toast({
          title: "Error",
          description: errorMessage || "Failed to permanently delete room. Please try again.",
          variant: "destructive",
        })
        return
      }

      setArchivedRooms((prev) => prev.filter((r) => r.id !== archivedRoomToPermanentlyDelete.id))
      setArchivedRoomToPermanentlyDelete(null)
      setArchivedRoomDeletionImpact(null)
      toast({ title: "Success", description: "Room permanently deleted successfully." })
    } catch (error) {
      console.error("Error permanently deleting room:", error)
      toast({
        title: "Error",
        description: "Failed to permanently delete room. Please try again.",
        variant: "destructive",
      })
    } finally {
      setPermanentlyDeleting(false)
    }
  }

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return
    await handleDeleteRoom(roomToDelete)
    setRoomToDelete(null)
  }

  const handleToggleAvailability = async (room: Room) => {
    if (pendingAvailabilityIds.has(room.id)) return
    const previousAvailability = room.isAvailable

    setPendingAvailabilityIds((prev) => {
      const next = new Set(prev)
      next.add(room.id)
      return next
    })
    setRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, isAvailable: !r.isAvailable } : r))
    )

    try {
      const response = await fetch(`/api/rooms/${room.databaseId}/toggle`, {
        method: 'PATCH',
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setRooms((prev) =>
          prev.map((r) => (r.id === room.id ? { ...r, isAvailable: previousAvailability } : r))
        )
        toast({
          title: "Error",
          description: data.error || "Failed to update room availability.",
          variant: "destructive",
        })
        return
      }
      
      setRooms((prev) => prev.map((r) => (r.id === room.id ? data : r)))
    } catch (error) {
      setRooms((prev) =>
        prev.map((r) => (r.id === room.id ? { ...r, isAvailable: previousAvailability } : r))
      )
      console.error('Error toggling availability:', error)
      toast({
        title: "Error",
        description: "Failed to update room availability.",
        variant: "destructive",
      })
    } finally {
      setPendingAvailabilityIds((prev) => {
        const next = new Set(prev)
        next.delete(room.id)
        return next
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
    <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")}>
      <EntityLayout
        title="Room Management"
        description="Add, edit, and manage classrooms and labs."
        headerActions={
          <TabsList>
            <TabsTrigger value="active">Rooms</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="active">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
              <CardTitle>Rooms ({sortedFilteredRooms.length})</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  onClick={() => setIsImportDialogOpen(true)}
                >
                  <ImportIcon className="mr-2 h-4 w-4" />
                  Import
                </Button>
                <ExportDropdownWithDialog
                  allData={sortedAllRooms.map((r) => ({ ...r, isAvailable: r.isAvailable ? "Yes" : "No" }))}
                  filteredData={paginatedRooms.map((r) => ({ ...r, isAvailable: r.isAvailable ? "Yes" : "No" }))}
                  columns={roomColumns}
                  filenamePrefix="rooms"
                  pdfTitle="Rooms"
                  totalLabel={`${rooms.length}`}
                  filteredLabel={`${paginatedRooms.length}`}
                  isFiltered={searchQuery !== "" || sortColumn != null}
                  filterDescription={
                    [
                      searchQuery ? `search: "${searchQuery}"` : null,
                      sortColumn ? `sort: capacity ${sortDirection}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
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
                  <TableHead>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1 font-medium hover:text-foreground",
                        sortColumn === "capacity" ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={handleSortCapacity}
                    >
                      Capacity
                      {sortColumn === "capacity" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
                      )}
                    </button>
                  </TableHead>
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
                  paginatedRooms.map((room) => {
                    return (
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
                            <DropdownMenuItem
                              className="text-destructive hover:text-destructive focus:text-destructive data-[highlighted]:text-destructive"
                              onClick={() => setRoomToDelete(room)}
                            >
                              <Archive className="mr-2 h-4 w-4 text-destructive" />
                              Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      </TableRow>
                    )
                  })
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
        </TabsContent>

        <TabsContent value="archived">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="space-y-1">
                <CardTitle>Archived rooms ({archivedRooms.length})</CardTitle>
                <p className="text-sm font-normal text-muted-foreground">
                  Archived rooms are excluded from future scheduling.
                </p>
              </div>
              {loadingArchived ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            </CardHeader>
            <CardContent>
              {loadingArchived ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Room Number</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead className="w-[70px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedRooms.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No archived rooms
                          </TableCell>
                        </TableRow>
                      ) : (
                        archivedRooms.map((room) => (
                          <TableRow key={room.id}>
                            <TableCell className="font-mono font-medium">{room.id}</TableCell>
                            <TableCell>
                              <Badge className={getTypeColor(room.type)}>{room.type}</Badge>
                            </TableCell>
                            <TableCell>{room.capacity} seats</TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleRestoreArchivedRoom(room)}>
                                    Restore
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => openPermanentDeleteRoomModal(room)}
                                    disabled={loadingDeletionImpact}
                                  >
                                    Permanently Delete
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
        description="Upload a CSV, Excel, or JSON file with room data."
        exampleHeaders={["id", "type", "capacity", "isAvailable"]}
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

      <AlertDialog open={roomToDelete !== null} onOpenChange={(open) => !open && setRoomToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive room?</AlertDialogTitle>
            <AlertDialogDescription>
              {roomToDelete
                ? `Room "${roomToDelete.id}" will be archived. Archived rooms are excluded from future scheduling.`
                : "Archived rooms are excluded from future scheduling."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteRoom}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={archivedRoomToPermanentlyDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setArchivedRoomToPermanentlyDelete(null)
            setArchivedRoomDeletionImpact(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete room?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This will permanently remove this room and delete{" "}
                  <span className="font-semibold text-foreground">{archivedRoomDeletionImpact?.entryCount ?? 0}</span>{" "}
                  schedule entries.
                </p>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Affected Timetables
                  </p>
                  {(archivedRoomDeletionImpact?.timetables?.length ?? 0) === 0 ? (
                    <p>No timetables</p>
                  ) : (
                    <ul className="max-h-36 list-disc space-y-1 overflow-y-auto pl-5">
                      {(archivedRoomDeletionImpact?.timetables ?? []).map((t) => (
                        <li key={`${t.timetableId}-${t.versionNumber}`}>{formatTimetableLabel(t)}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="font-medium text-destructive">This cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={permanentlyDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmPermanentDeleteArchivedRoom}
              disabled={permanentlyDeleting || archivedRoomDeletionImpact == null}
            >
              {permanentlyDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Permanently Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </EntityLayout>
    </Tabs>
  )
}
