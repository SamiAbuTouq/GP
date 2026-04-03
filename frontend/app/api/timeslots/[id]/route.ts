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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const timeslot = await prisma.timeslot.findUnique({
      where: { slot_id: parseInt(id) },
    })

    if (!timeslot) {
      return NextResponse.json({ error: 'Timeslot not found.' }, { status: 404 })
    }

    return NextResponse.json({
      id: timeslot.slot_id,
      start: formatTime(timeslot.start_time),
      end: formatTime(timeslot.end_time),
      days: getDaysFromMask(timeslot.days_mask),
      daysMask: timeslot.days_mask,
      slotType: timeslot.slot_type,
    })
  } catch (error) {
    console.error('Error fetching timeslot:', error)
    return NextResponse.json(
      { error: 'Failed to fetch timeslot.' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()

    const existing = await prisma.timeslot.findUnique({
      where: { slot_id: parseInt(id) },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Timeslot not found.' }, { status: 404 })
    }

    // Page sends: start, end, slotType, days
    const startTimeStr = body.start || body.startTime
    const endTimeStr = body.end || body.endTime
    const slotType = body.slotType || body.type

    // Parse time strings to Date objects if provided
    let startTime, endTime
    let startTotalMinutes: number | undefined
    let endTotalMinutes: number | undefined

    if (startTimeStr) {
      const parsed = parseTimeString(startTimeStr)
      if (!parsed) {
        return NextResponse.json(
          { error: 'Invalid start time format. Use HH:MM format.' },
          { status: 400 }
        )
      }
      startTime = new Date(1970, 0, 1, parsed.hours, parsed.minutes)
      startTotalMinutes = parsed.totalMinutes
    }

    if (endTimeStr) {
      const parsed = parseTimeString(endTimeStr)
      if (!parsed) {
        return NextResponse.json(
          { error: 'Invalid end time format. Use HH:MM format.' },
          { status: 400 }
        )
      }
      endTime = new Date(1970, 0, 1, parsed.hours, parsed.minutes)
      endTotalMinutes = parsed.totalMinutes
    }

    // Validate end time is after start time
    if (startTotalMinutes !== undefined && endTotalMinutes !== undefined) {
      if (endTotalMinutes <= startTotalMinutes) {
        return NextResponse.json(
          { error: 'End time must be after start time.' },
          { status: 400 }
        )
      }
    } else if (startTotalMinutes !== undefined && !endTimeStr) {
      // Only start changed, validate against existing end
      const existingEnd = formatTime(existing.end_time)
      const existingEndParsed = parseTimeString(existingEnd)
      if (existingEndParsed && existingEndParsed.totalMinutes <= startTotalMinutes) {
        return NextResponse.json(
          { error: 'End time must be after start time.' },
          { status: 400 }
        )
      }
    } else if (!startTimeStr && endTotalMinutes !== undefined) {
      // Only end changed, validate against existing start
      const existingStart = formatTime(existing.start_time)
      const existingStartParsed = parseTimeString(existingStart)
      if (existingStartParsed && endTotalMinutes <= existingStartParsed.totalMinutes) {
        return NextResponse.json(
          { error: 'End time must be after start time.' },
          { status: 400 }
        )
      }
    }

    const daysMask = body.daysMask || (body.days ? getMaskFromDays(body.days) : undefined)

    // Validate days if provided
    if (body.days && body.days.length === 0) {
      return NextResponse.json(
        { error: 'At least one day must be selected.' },
        { status: 400 }
      )
    }

    const timeslot = await prisma.timeslot.update({
      where: { slot_id: parseInt(id) },
      data: {
        ...(startTime && { start_time: startTime }),
        ...(endTime && { end_time: endTime }),
        ...(daysMask !== undefined && { days_mask: daysMask }),
        ...(slotType && { slot_type: slotType }),
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
    console.error('Error updating timeslot:', error)
    const prismaError = error as { code?: string }
    if (prismaError?.code === 'P2025') {
      return NextResponse.json({ error: 'Timeslot not found.' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to update timeslot. Please try again.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Check if timeslot is in use
    const scheduleEntries = await prisma.sectionScheduleEntry.count({
      where: { slot_id: parseInt(id) },
    })
    if (scheduleEntries > 0) {
      return NextResponse.json(
        { error: `Cannot delete this time slot because it is used in ${scheduleEntries} schedule entries. Remove the schedule entries first.` },
        { status: 409 }
      )
    }

    // Check lecturer preferences
    await prisma.lecturerPreference.deleteMany({
      where: { slot_id: parseInt(id) },
    })

    // Check lecturer office hours
    await prisma.lecturerOfficeHours.deleteMany({
      where: { slot_id: parseInt(id) },
    })

    await prisma.timeslot.delete({
      where: { slot_id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting timeslot:', error)
    const prismaError = error as { code?: string }
    if (prismaError?.code === 'P2025') {
      return NextResponse.json({ error: 'Timeslot not found.' }, { status: 404 })
    }
    if (prismaError?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete this timeslot because it is referenced by other records.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to delete timeslot. Please try again.' },
      { status: 500 }
    )
  }
}
