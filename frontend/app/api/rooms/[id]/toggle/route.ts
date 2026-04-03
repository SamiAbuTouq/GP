import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Room type mapping
const ROOM_TYPES: Record<number, string> = {
  0: 'Classroom',
  1: 'Classroom',
  2: 'Lab',
  3: 'Classroom',
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const currentRoom = await prisma.room.findUnique({ where: { room_id: parseInt(id) } })
    if (!currentRoom) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })

    const room = await prisma.room.update({
      where: { room_id: parseInt(id) },
      data: { is_available: !currentRoom.is_available },
    })

    return NextResponse.json({
      id: room.room_number,
      databaseId: room.room_id,
      type: ROOM_TYPES[room.room_type] ?? 'Classroom',
      capacity: room.capacity,
      isAvailable: room.is_available,
    })
  } catch (error) {
    console.error('Error toggling room availability:', error)
    return NextResponse.json({ error: 'Failed to toggle room availability.' }, { status: 500 })
  }
}
