'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { usePalette } from '@/components/course-analytics/palette-provider'
import { formatName } from '@/lib/utils'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ScatterChart,
  Scatter,
  ZAxis,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/course-analytics-ui/card'
import type {
  DepartmentData,
  OnlineModeData,
  SlotPatternDensityRow,
  LecturerStressPoint,
  CampusDensityPoint,
  RoomHourEfficiencyCell,
  LabPressurePoint,
  CourseSaturationTrend,
  AcademicWeightRow,
} from '@/lib/course-analytics/course-data'

const AXIS_STROKE = 'var(--color-muted-foreground)'
const AXIS_TICK = { fill: 'var(--color-muted-foreground)', opacity: 0.7 }
const AXIS_TICK_LIGHT = { fill: 'var(--color-muted-foreground)', opacity: 0.85 }

function useChartColors() {
  const { activePalette } = usePalette()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const isDark = resolvedTheme === 'dark'
  const vars = mounted && isDark ? activePalette.dark : activePalette.light
  return [vars['--chart-1'], vars['--chart-2'], vars['--chart-3'], vars['--chart-4'], vars['--chart-5']]
}

interface TipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; dataKey: string; color?: string }>
  label?: string
}

function SimpleTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md ca-dark:border-white/10 ca-dark:bg-black/60">
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-6 text-sm">
            <span className="text-muted-foreground">{entry.name || entry.dataKey}</span>
            <span className="font-medium tabular-nums text-foreground">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Department physical-room utilization (Σ students / Σ capacity), sorted for saturation view. */
export function DepartmentSaturationBarChart({ data }: { data: DepartmentData[] }) {
  const colors = useChartColors()
  const chartData = useMemo(
    () => [...data].sort((a, b) => b.utilization - a.utilization).slice(0, 14),
    [data],
  )
  return (
    <Card className="col-span-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Departmental saturation</CardTitle>
        <CardDescription>
          Physical sections only: weighted room utilization by department (Registered ÷ Section capacity).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(320, chartData.length * 34)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 12, right: 28, top: 8, bottom: 12 }}>
            <XAxis
              type="number"
              domain={[0, 100]}
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              tick={AXIS_TICK}
              label={{
                value: 'Utilization %',
                position: 'bottom',
                offset: 0,
                fill: 'var(--color-muted-foreground)',
                fontSize: 10,
              }}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={150}
              tickFormatter={formatName}
              tick={AXIS_TICK_LIGHT}
            />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload as DepartmentData
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md ca-dark:border-white/10 ca-dark:bg-black/60">
                    <p className="mb-2 text-sm font-semibold text-foreground">{formatName(row.fullName)}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Utilization</span>
                      <span className="text-right font-medium tabular-nums">{row.utilization}%</span>
                      <span className="text-muted-foreground">Sections</span>
                      <span className="text-right font-medium tabular-nums">{row.sections}</span>
                      <span className="text-muted-foreground">Seat enrollments</span>
                      <span className="text-right font-medium tabular-nums">{row.students.toLocaleString()}</span>
                    </div>
                  </div>
                )
              }}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar
              dataKey="utilization"
              name="Utilization %"
              fill={colors[0]}
              radius={[0, 8, 8, 0]}
              isAnimationActive
              animationDuration={900}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function LecturerStressScatterChart({ data }: { data: LecturerStressPoint[] }) {
  const colors = useChartColors()
  const trimmed = useMemo(() => data.filter((d) => d.creditHours > 0 || d.prepCount > 0).slice(0, 120), [data])
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Lecturer stress matrix</CardTitle>
        <CardDescription>
          Each point is one lecturer: X = Σ credit hours (section rows), Y = distinct course preparations (Course_Number).
          Bubble size scales with section count.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ left: 4, right: 12, top: 12, bottom: 4 }}>
            <XAxis
              type="number"
              dataKey="creditHours"
              name="Credit hours"
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Σ Credit hours', position: 'bottom', offset: 0, fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <YAxis
              type="number"
              dataKey="prepCount"
              name="Preparations"
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              allowDecimals={false}
              label={{ value: 'Distinct courses', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <ZAxis type="number" dataKey="sections" range={[40, 320]} />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as LecturerStressPoint
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md ca-dark:border-white/10 ca-dark:bg-black/60">
                    <p className="mb-1 text-sm font-semibold text-foreground">{p.name}</p>
                    <p className="mb-2 text-xs text-muted-foreground">{p.department}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Credit hours</span>
                      <span className="text-right font-medium tabular-nums">{p.creditHours}</span>
                      <span className="text-muted-foreground">Preparations</span>
                      <span className="text-right font-medium tabular-nums">{p.prepCount}</span>
                      <span className="text-muted-foreground">Sections</span>
                      <span className="text-right font-medium tabular-nums">{p.sections}</span>
                    </div>
                  </div>
                )
              }}
            />
            <Scatter data={trimmed} fill={colors[1]} fillOpacity={0.75} isAnimationActive animationDuration={900} />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function DeliveryModeDonutChart({ data }: { data: OnlineModeData[] }) {
  const colors = useChartColors()
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Delivery mode distribution</CardTitle>
        <CardDescription>Section counts: on-campus, blended, and online</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={3}
              dataKey="count"
              nameKey="mode"
              strokeWidth={0}
              isAnimationActive
              animationDuration={900}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={colors[index % colors.length]} className="transition-opacity hover:opacity-90" />
              ))}
            </Pie>
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload as OnlineModeData
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md ca-dark:border-white/10 ca-dark:bg-black/60">
                    <p className="mb-2 text-sm font-semibold text-foreground">{row.mode}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Sections</span>
                      <span className="text-right font-medium tabular-nums">{row.count}</span>
                      <span className="text-muted-foreground">Share</span>
                      <span className="text-right font-medium tabular-nums">{row.percentage}%</span>
                    </div>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {data.map((item, index) => (
            <div key={item.mode} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
              <span className="text-muted-foreground">{item.mode}</span>
              <span className="font-medium tabular-nums text-foreground">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function roomHeatColor(util: number, max: number) {
  if (max <= 0) return 'bg-muted/30'
  const t = util / max
  if (t < 0.2) return 'bg-primary/10'
  if (t < 0.4) return 'bg-primary/25'
  if (t < 0.6) return 'bg-primary/45'
  if (t < 0.8) return 'bg-primary/65'
  return 'bg-primary/85'
}

export function RoomEfficiencyHeatmap({ cells }: { cells: RoomHourEfficiencyCell[] }) {
  const { matrix, rooms, hours, maxUtil } = useMemo(() => {
    const roomsSet = [...new Set(cells.map((c) => c.room))].sort()
    const hoursSet = [...new Set(cells.map((c) => c.hour))].sort((a, b) => {
      const na = parseInt(a.split(':')[0], 10)
      const nb = parseInt(b.split(':')[0], 10)
      return na - nb
    })
    const key = (r: string, h: string) => `${r}\u0000${h}`
    const map = new Map<string, number>()
    let maxUtil = 0
    for (const c of cells) {
      map.set(key(c.room, c.hour), c.utilizationPct)
      maxUtil = Math.max(maxUtil, c.utilizationPct)
    }
    return {
      matrix: map,
      rooms: roomsSet,
      hours: hoursSet,
      maxUtil,
    }
  }, [cells])

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Room efficiency heatmap</CardTitle>
        <CardDescription>
          Heavily used physical rooms (top by section volume): cell color = weighted utilization for that room and start hour.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rooms.length === 0 || hours.length === 0 ? (
          <p className="text-sm text-muted-foreground">No physical room timing data in the current scope.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              <div className="mb-1 flex">
                <div className="w-28 shrink-0" />
                {hours.map((h) => (
                  <div key={h} className="min-w-[36px] flex-1 text-center text-[10px] text-muted-foreground">
                    {h.replace(':00', '')}
                  </div>
                ))}
              </div>
              {rooms.map((room) => (
                <div key={room} className="flex items-center gap-0.5 py-0.5">
                  <div className="w-28 shrink-0 truncate text-xs text-muted-foreground" title={room}>
                    {room}
                  </div>
                  {hours.map((hour) => {
                    const util = matrix.get(`${room}\u0000${hour}`) ?? 0
                    const tip = `${room} · ${hour}: ${util}% utilization (weighted)`
                    return (
                      <Tooltip key={`${room}-${hour}`}>
                        <TooltipTrigger asChild>
                          <div className={`min-w-[36px] flex-1 h-7 cursor-default rounded-sm ${roomHeatColor(util, maxUtil)}`} />
                        </TooltipTrigger>
                        <TooltipContent side="top">{tip}</TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              ))}
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>Lower</span>
                <div className="flex gap-0.5">
                  <div className="h-3.5 w-3.5 rounded-sm bg-primary/10" />
                  <div className="h-3.5 w-3.5 rounded-sm bg-primary/25" />
                  <div className="h-3.5 w-3.5 rounded-sm bg-primary/45" />
                  <div className="h-3.5 w-3.5 rounded-sm bg-primary/65" />
                  <div className="h-3.5 w-3.5 rounded-sm bg-primary/85" />
                </div>
                <span>Higher</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SlotPatternBarChart({ data }: { data: SlotPatternDensityRow[] }) {
  const colors = useChartColors()
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Slot pattern density</CardTitle>
        <CardDescription>
          Compares capacity-weighted utilization between Sun–Tue–Thu-only patterns, Mon–Wed-only patterns, and mixed schedules
          (physical rooms).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 28 }}>
            <XAxis dataKey="label" stroke={AXIS_STROKE} fontSize={11} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              label={{ value: 'Weighted utilization %', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <RechartsTooltip content={<SimpleTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="weightedUtilizationPct" name="Utilization %" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={900}>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Section counts — STT: {data.find((d) => d.patternId === 'sun_tue_thu')?.sections ?? 0}, MW:{' '}
          {data.find((d) => d.patternId === 'mon_wed')?.sections ?? 0}, other: {data.find((d) => d.patternId === 'other')?.sections ?? 0}
        </p>
      </CardContent>
    </Card>
  )
}

function pivotCampusDensity(points: CampusDensityPoint[]) {
  const slotOrder = [
    ...new Map(
      [...points]
        .sort((a, b) => a.slotMinutes - b.slotMinutes)
        .map((p) => [p.slotMinutes, p.slotLabel] as const),
    ).values(),
  ]
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'] as const
  return slotOrder.map((slotLabel) => {
    const row: Record<string, string | number> = { slot: slotLabel }
    for (const day of days) {
      row[day] = points.find((p) => p.day === day && p.slotLabel === slotLabel)?.concurrentStudents ?? 0
    }
    return row
  })
}

export function CampusDensityLineChart({ data }: { data: CampusDensityPoint[] }) {
  const colors = useChartColors()
  const chartData = useMemo(() => pivotCampusDensity(data), [data])
  return (
    <Card className="col-span-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Campus density (concurrent seat load)</CardTitle>
        <CardDescription>
          For each 30-minute window, sums Registered_Students for physical sections whose meeting interval overlaps that window on
          that weekday (overlap-based, not a forecast).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <XAxis dataKey="slot" stroke={AXIS_STROKE} fontSize={10} tickLine={false} axisLine={false} tick={AXIS_TICK} interval={2} />
            <YAxis
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
            />
            <RechartsTooltip content={<SimpleTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
            <Line type="monotone" dataKey="Sun" name="Sun" stroke={colors[0]} strokeWidth={2} dot={false} isAnimationActive animationDuration={700} />
            <Line type="monotone" dataKey="Mon" name="Mon" stroke={colors[1]} strokeWidth={2} dot={false} isAnimationActive animationDuration={700} />
            <Line type="monotone" dataKey="Tue" name="Tue" stroke={colors[2]} strokeWidth={2} dot={false} isAnimationActive animationDuration={700} />
            <Line type="monotone" dataKey="Wed" name="Wed" stroke={colors[3]} strokeWidth={2} dot={false} isAnimationActive animationDuration={700} />
            <Line type="monotone" dataKey="Thu" name="Thu" stroke={colors[4]} strokeWidth={2} dot={false} isAnimationActive animationDuration={700} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function buildCourseSaturationChartRows(trends: CourseSaturationTrend[]) {
  const termOrder = [
    ...new Set(
      trends.flatMap((t) => t.series.map((s) => s.termLabel)),
    ),
  ].sort()
  return termOrder.map((term) => {
    const row: Record<string, string | number> = { term }
    for (const t of trends) {
      const hit = t.series.find((s) => s.termLabel === term)
      row[t.courseCode] = hit ? hit.avgSaturationPct : 0
    }
    return row
  })
}

export function CourseSaturationTrendChart({ trends }: { trends: CourseSaturationTrend[] }) {
  const colors = useChartColors()
  const rows = useMemo(() => buildCourseSaturationChartRows(trends), [trends])
  if (!trends.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Course saturation history</CardTitle>
          <CardDescription>No multi-term physical section history for the current filters.</CardDescription>
        </CardHeader>
      </Card>
    )
  }
  return (
    <Card className="col-span-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">High-demand course signals (historical)</CardTitle>
        <CardDescription>
          Average physical-section utilization by term for the top courses in the current scope (observed registration vs room
          capacity only).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <XAxis dataKey="term" stroke={AXIS_STROKE} fontSize={10} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <RechartsTooltip content={<SimpleTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={7} />
            {trends.map((t, i) => (
              <Line
                key={t.courseCode}
                type="monotone"
                dataKey={t.courseCode}
                name={t.courseCode}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive
                animationDuration={800}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function LabPressureLineChart({ data }: { data: LabPressurePoint[] }) {
  const colors = useChartColors()
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Lab capacity pressure</CardTitle>
        <CardDescription>
          islab = true, physical rooms: weighted utilization (Σ students ÷ Σ capacity) by academic term.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 28 }}>
            <XAxis dataKey="termLabel" stroke={AXIS_STROKE} fontSize={10} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              domain={[0, 100]}
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              tickFormatter={(v) => `${v}%`}
            />
            <RechartsTooltip content={<SimpleTooltip />} />
            <Line
              type="monotone"
              dataKey="weightedLabUtilizationPct"
              name="Lab utilization %"
              stroke={colors[2]}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function AcademicWeightBarChart({ data }: { data: AcademicWeightRow[] }) {
  const colors = useChartColors()
  const chartData = useMemo(() => [...data].slice(0, 12), [data])
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Academic weight by department</CardTitle>
        <CardDescription>Σ (Registered_Students × credit_hours) — instructional demand from actual enrollments.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 30)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
            <XAxis type="number" stroke={AXIS_STROKE} fontSize={11} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              type="category"
              dataKey="department"
              width={130}
              stroke={AXIS_STROKE}
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK_LIGHT}
              tickFormatter={(v) => (String(v).length > 18 ? `${String(v).slice(0, 16)}…` : String(v))}
            />
            <RechartsTooltip content={<SimpleTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="academicWeight" name="Academic weight" fill={colors[3]} radius={[0, 6, 6, 0]} isAnimationActive animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function RoomUtilizationTrendChart({
  rooms,
  points,
}: {
  rooms: string[]
  points: { termLabel: string; utilByRoom: Record<string, number> }[]
}) {
  const colors = useChartColors()
  const data = useMemo(
    () =>
      points.map((p) => {
        const row: Record<string, string | number> = { term: p.termLabel }
        for (const r of rooms) {
          row[r] = p.utilByRoom[r] ?? 0
        }
        return row
      }),
    [points, rooms],
  )
  if (!rooms.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Room utilization trends</CardTitle>
          <CardDescription>No physical room series in scope.</CardDescription>
        </CardHeader>
      </Card>
    )
  }
  return (
    <Card className="col-span-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Room utilization trends</CardTitle>
        <CardDescription>
          Top physical rooms by section volume: weighted utilization % per term (same formula as the saturation KPI).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 28 }}>
            <XAxis dataKey="term" stroke={AXIS_STROKE} fontSize={10} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              domain={[0, 100]}
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              tickFormatter={(v) => `${v}%`}
            />
            <RechartsTooltip content={<SimpleTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={7} />
            {rooms.map((room, i) => (
              <Line
                key={room}
                type="monotone"
                dataKey={room}
                name={room}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={700}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
