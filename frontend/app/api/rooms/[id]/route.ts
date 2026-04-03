import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Room type mapping
const ROOM_TYPES: Record<number, string> = {
  0: 'Classroom',
  1: 'Classroom',
  2: 'Lab',
  3: 'Classroom',
}

const ROOM_TYPE_REVERSE: Record<string, number> = {
  'classroom': 0,
  'lab': 2,
}

function toRoomTypeInt(value: string | undefined): number {
  if (!value) return 0
  return ROOM_TYPE_REVERSE[value.toLowerCase()] ?? 0
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const room = await prisma.room.findUnique({ where: { room_id: parseInt(id) } })
    if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
    return NextResponse.json({
      id: room.room_number,
      databaseId: room.room_id,
      type: ROOM_TYPES[room.room_type as any] ?? 'Classroom',
      capacity: room.capacity,
      isAvailable: room.is_available,
    })
  } catch (error) {
    console.error('Error fetching room:', error)
    return NextResponse.json({ error: 'Failed to fetch room.' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()

    const existing = await prisma.room.findUnique({ where: { room_id: parseInt(id) } })
    if (!existing) {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
    }

    // Validate capacity if provided
    if (body.capacity !== undefined) {
      const capacity = Number(body.capacity)
      if (!capacity || capacity < 1) {
        return NextResponse.json({ error: 'Capacity must be a positive number.' }, { status: 400 })
      }
    }

    const room = await prisma.room.update({
      where: { room_id: parseInt(id) },
      data: {
        ...((body.type) && { room_type: toRoomTypeInt(body.type) }),
        ...(body.capacity !== undefined && { capacity: Number(body.capacity) }),
        ...(body.isAvailable !== undefined && { is_available: body.isAvailable }),
      },
    })
    return NextResponse.json({
      id: room.room_number,
      databaseId: room.room_id,
      type: ROOM_TYPES[room.room_type as any] ?? 'Classroom',
      capacity: room.capacity,
      isAvailable: room.is_available,
    })
  } catch (error) {
    console.error('Error updating room:', error)
    const prismaError = error as { code?: string }
    if (prismaError?.code === 'P2025') {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update room. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    // Check if room is in use
    const scheduleEntries = await prisma.sectionScheduleEntry.count({
      where: { room_id: parseInt(id) },
    })
    if (scheduleEntries > 0) {
      return NextResponse.json(
        { error: `Cannot delete this room because it is used in ${scheduleEntries} schedule entries. Remove the schedule entries first.` },
        { status: 409 }
      )
    }

    await prisma.room.delete({ where: { room_id: parseInt(id) } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting room:', error)
    const prismaError = error as { code?: string }
    if (prismaError?.code === 'P2025') {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
    }
    if (prismaError?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete this room because it is referenced by other records.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Failed to delete room. Please try again.' }, { status: 500 })
  }
}
