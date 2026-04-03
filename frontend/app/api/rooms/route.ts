import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Room type mapping: 0 = Classroom, 2 = Lab
const ROOM_TYPES: Record<number, string> = {
  0: 'Classroom',
  1: 'Classroom', // Fallbacks for old data
  2: 'Lab',
  3: 'Classroom', // Fallbacks for old data
}

const ROOM_TYPE_REVERSE: Record<string, number> = {
  'classroom': 0,
  'lab': 2,
}

function toRoomTypeInt(value: string | undefined): number {
  if (!value) return 0
  const lower = value.toLowerCase()
  return ROOM_TYPE_REVERSE[lower] ?? 0
}

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: { room_number: 'asc' },
    })

    return NextResponse.json(
      rooms.map(room => ({
        id: room.room_number,
        databaseId: room.room_id,
        type: ROOM_TYPES[room.room_type as any] ?? 'Classroom',
        capacity: room.capacity,
        isAvailable: room.is_available,
      }))
    )
  } catch (error) {
    console.error('Error fetching rooms:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rooms. Please check database connection.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Accept both 'id' (from frontend) and 'number' as room number
    const roomNumber = (body.id || body.number || '').toString().trim()
    if (!roomNumber) {
      return NextResponse.json({ error: 'Room number is required.' }, { status: 400 })
    }

    // Validate capacity
    const capacity = Number(body.capacity)
    if (!capacity || capacity < 1) {
      return NextResponse.json({ error: 'Capacity must be a positive number.' }, { status: 400 })
    }

    // Validate room type
    const roomType = body.type || 'Classroom'
    const roomTypeInt = toRoomTypeInt(roomType)

    // Check for existing room with same number
    const existing = await prisma.room.findFirst({ where: { room_number: roomNumber } })
    if (existing) {
      return NextResponse.json(
        { error: `Room "${roomNumber}" already exists. Please use a different room number.` },
        { status: 409 }
      )
    }

    const room = await prisma.room.create({
      data: {
        room_number: roomNumber,
        room_type: roomTypeInt,
        capacity: capacity,
        is_available: body.isAvailable ?? true,
      },
    })

    return NextResponse.json({
      id: room.room_number,
      databaseId: room.room_id,
      type: ROOM_TYPES[room.room_type] ?? 'Classroom',
      capacity: room.capacity,
      isAvailable: room.is_available,
    })
  } catch (error) {
    console.error('Error creating room:', error)
    const prismaError = error as { code?: string; meta?: { target?: string[] } }
    if (prismaError?.code === 'P2002') {
      const field = prismaError?.meta?.target?.[0]
      if (field === 'room_number') {
        return NextResponse.json(
          { error: 'A room with this number already exists.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'A room with these details already exists.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create room. Please try again.' },
      { status: 500 }
    )
  }
}
