import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Days mask to day names mapping
const DAYS_MAP: Record<number, string> = {
  1: 'Sunday',
  2: 'Monday',
  4: 'Tuesday',
  8: 'Wednesday',
  16: 'Thursday',
}

function getDaysFromMask(mask: number): string[] {
  const days: string[] = []
  for (const [bit, day] of Object.entries(DAYS_MAP)) {
    if (mask & parseInt(bit)) {
      days.push(day)
    }
  }
  return days
}

function getMaskFromDays(days: string[]): number {
  let mask = 0
  const reverseDaysMap: Record<string, number> = {
    'Sunday': 1,
    'Monday': 2,
    'Tuesday': 4,
    'Wednesday': 8,
    'Thursday': 16,
  }
  for (const day of days) {
    mask |= reverseDaysMap[day] || 0
  }
  return mask
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5)
}

function parseTimeString(timeStr: string): { hours: number; minutes: number; totalMinutes: number } | null {
  const parts = timeStr.split(':').map(Number)
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null
  const hours = parts[0]
  const minutes = parts[1]
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return { hours, minutes, totalMinutes: hours * 60 + minutes }
}

export async function GET() {
  try {
    const timeslots = await prisma.timeslot.findMany({
      orderBy: [
        { days_mask: 'asc' },
        { start_time: 'asc' },
      ],
    })

    const transformedTimeslots = timeslots.map(slot => ({
      id: slot.slot_id,
      start: formatTime(slot.start_time),
      end: formatTime(slot.end_time),
      days: getDaysFromMask(slot.days_mask),
      daysMask: slot.days_mask,
      slotType: slot.slot_type,
    }))

    return NextResponse.json(transformedTimeslots)
  } catch (error) {
    console.error('Error fetching timeslots:', error)
    return NextResponse.json(
      { error: 'Failed to fetch timeslots. Please check database connection.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Page sends: start, end, slotType, days
    const startTimeStr = body.start || body.startTime
    const endTimeStr = body.end || body.endTime
    const slotType = (body.slotType || body.type || 'Lecture').trim()
    const days: string[] = body.days || []

    // Validate required fields
    if (!startTimeStr) {
      return NextResponse.json(
        { error: 'Start time is required.' },
        { status: 400 }
      )
    }
    if (!endTimeStr) {
      return NextResponse.json(
        { error: 'End time is required.' },
        { status: 400 }
      )
    }

    // Validate days
    if (!days.length && !body.daysMask) {
      return NextResponse.json(
        { error: 'At least one day must be selected.' },
        { status: 400 }
      )
    }

    // Parse and validate time
    const startParsed = parseTimeString(startTimeStr)
    const endParsed = parseTimeString(endTimeStr)

    if (!startParsed) {
      return NextResponse.json(
        { error: 'Invalid start time format. Use HH:MM format.' },
        { status: 400 }
      )
    }
    if (!endParsed) {
      return NextResponse.json(
        { error: 'Invalid end time format. Use HH:MM format.' },
        { status: 400 }
      )
    }

    // Validate end time is after start time
    if (endParsed.totalMinutes <= startParsed.totalMinutes) {
      return NextResponse.json(
        { error: 'End time must be after start time.' },
        { status: 400 }
      )
    }

    const startTime = new Date(1970, 0, 1, startParsed.hours, startParsed.minutes)
    const endTime = new Date(1970, 0, 1, endParsed.hours, endParsed.minutes)
    const daysMask = body.daysMask || getMaskFromDays(days)

    // Check for duplicate timeslot (same times and same days)
    const existingSlot = await prisma.timeslot.findFirst({
      where: {
        start_time: startTime,
        end_time: endTime,
        days_mask: daysMask,
      },
    })

    if (existingSlot) {
      return NextResponse.json(
        { error: 'A time slot with these exact times and days already exists.' },
        { status: 409 }
      )
    }

    const timeslot = await prisma.timeslot.create({
      data: {
        start_time: startTime,
        end_time: endTime,
        days_mask: daysMask,
        slot_type: slotType,
      },
    })

    return NextResponse.json({
      id: timeslot.slot_id,
      start: formatTime(timeslot.start_time),
      end: formatTime(timeslot.end_time),
      days: getDaysFromMask(timeslot.days_mask),
      daysMask: timeslot.days_mask,
      slotType: timeslot.slot_type,
    })
  } catch (error) {
    console.error('Error creating timeslot:', error)
    const prismaError = error as { code?: string }
    if (prismaError?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A time slot with these exact times and days already exists.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create timeslot. Please try again.' },
      { status: 500 }
    )
  }
}
