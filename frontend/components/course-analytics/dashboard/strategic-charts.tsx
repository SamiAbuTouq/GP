'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { cn, formatName } from '@/lib/utils'
import { usePalette } from '@/components/course-analytics/palette-provider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/course-analytics-ui/card'
import { ScrollArea } from '@/components/course-analytics-ui/scroll-area'
import { Badge } from '@/components/course-analytics-ui/badge'
import type {
  AcademicWeightRow,
  CourseData,
  CourseSaturationTrendSeries,
  DepartmentData,
  HeatmapData,
  LecturerStressPoint,
  ManagementActionItem,
  OnlineModeData,
  PlanningTermRow,
  RoomOccupancyHeatmapResult,
  RoomUtilizationTrendRoom,
  SectionExpansionRow,
  SemesterData,
  SlotDensityClusterRow,
  FacultyCreditLoadRow,
} from '@/lib/course-analytics/course-data'

const AXIS_STROKE = 'var(--color-muted-foreground)'
const AXIS_TICK = { fill: 'var(--color-muted-foreground)', opacity: 0.7 }

function useChartColors() {
  const { activePalette } = usePalette()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const isDark = resolvedTheme === 'dark'
  const vars = mounted && isDark ? activePalette.dark : activePalette.light
  return [
    vars['--chart-1'],
    vars['--chart-2'],
    vars['--chart-3'],
    vars['--chart-4'],
    vars['--chart-5'],
  ]
}

interface TipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; dataKey: string; color?: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md transition-all ca-dark:border-white/10 ca-dark:bg-black/60">
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full ring-2 ring-background shadow-inner"
                style={{ backgroundColor: entry.color }}
              />
              <span className="capitalize text-muted-foreground">{entry.name || entry.dataKey}</span>
            </div>
            <span className="font-medium tabular-nums text-foreground">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const actionCategoryStyles: Record<
  ManagementActionItem['category'],
  { label: string; className: string }
> = {
  resource: { label: 'Resource', className: 'bg-chart-2/15 text-chart-2 border-chart-2/30' },
  capacity: { label: 'Capacity', className: 'bg-chart-3/15 text-chart-3 border-chart-3/30' },
  hr: { label: 'HR', className: 'bg-chart-4/15 text-chart-4 border-chart-4/30' },
  scheduling: { label: 'Scheduling', className: 'bg-chart-5/15 text-chart-5 border-chart-5/30' },
}

export function ActionCenterPanel({ items }: { items: ManagementActionItem[] }) {
  if (!items.length) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Action Center</CardTitle>
          <CardDescription>
            No automated actions for the current filter scope. Try broadening the time range or relaxing department filters.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Action Center</CardTitle>
        <CardDescription>
          Plain-language items derived from utilization, scheduling density, lab load, and faculty preparation metrics in the
          current dataset.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((item) => {
            const cat = actionCategoryStyles[item.category]
            return (
              <li
                key={item.id}
                className="flex gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/35"
              >
                <Badge variant="outline" className={`h-fit shrink-0 border font-semibold uppercase tracking-wide ${cat.className}`}>
                  {cat.label}
                </Badge>
                <p className="text-sm leading-relaxed text-foreground">{item.message}</p>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

export function DepartmentalSaturationChart({ data }: { data: DepartmentData[] }) {
  const colors = useChartColors()
  const chartData = useMemo(
    () =>
      [...data]
        .sort((a, b) => b.utilization - a.utilization)
        .slice(0, 14)
        .map((d) => ({
          ...d,
          label: d.name,
        })),
    [data],
  )
  const gradId = `sat-${colors[0].replace(/#/g, '')}`
  const maxU = Math.max(100, ...chartData.map((d) => d.utilization))

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Departmental Saturation</CardTitle>
        <CardDescription>
          Seat occupancy vs physical section capacity by department: (Σ enrolled ÷ Σ seats) × 100 for in-person sections only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(320, chartData.length * 32)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={colors[0]} stopOpacity={0.75} />
                <stop offset="100%" stopColor={colors[1]} stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis
              type="number"
              domain={[0, maxU]}
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
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
              dataKey="label"
              stroke={AXIS_STROKE}
              width={148}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatName}
              tick={AXIS_TICK}
            />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload as DepartmentData
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-lg backdrop-blur-md ca-dark:border-white/10 ca-dark:bg-black/60">
                    <p className="mb-2 text-sm font-semibold text-foreground">{formatName(row.fullName)}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Utilization</span>
                      <span className="font-medium tabular-nums">{row.utilization}%</span>
                      <span className="text-muted-foreground">Sections</span>
                      <span className="font-medium tabular-nums">{row.sections}</span>
                      <span className="text-muted-foreground">Seat enrollments</span>
                      <span className="font-medium tabular-nums">{row.students.toLocaleString()}</span>
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey="utilization" fill={`url(#${gradId})`} radius={[0, 6, 6, 0]} name="Utilization %" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function DeliveryModeDonutChart({ data }: { data: OnlineModeData[] }) {
  const colors = useChartColors()
  const pieData = data.map((d, i) => ({ ...d, fill: colors[i % colors.length] }))

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Delivery Mode Mix</CardTitle>
        <CardDescription>Section counts: Online, Face-to-Face, and Blended (from section delivery flags).</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="count"
              nameKey="mode"
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={100}
              paddingAngle={2}
              stroke="transparent"
              isAnimationActive
              animationDuration={900}
            >
              {pieData.map((e, i) => (
                <Cell key={i} fill={e.fill} />
              ))}
            </Pie>
            <Legend verticalAlign="bottom" height={28} formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
            <RechartsTooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function RoomOccupancyHeatmapChart({ data }: { data: RoomOccupancyHeatmapResult }) {
  const maxVal = useMemo(() => {
    let m = 0
    for (const row of data.matrix) for (const v of row) m = Math.max(m, v)
    return m || 1
  }, [data.matrix])

  const tint = (v: number) => {
    const t = v / maxVal
    if (t < 0.2) return 'bg-primary/10'
    if (t < 0.4) return 'bg-primary/25'
    if (t < 0.6) return 'bg-primary/45'
    if (t < 0.85) return 'bg-primary/65'
    return 'bg-primary/85'
  }

  if (!data.rooms.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Room Utilization Heatmap</CardTitle>
          <CardDescription>No physical room sections in the current scope.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Room Utilization Heatmap</CardTitle>
        <CardDescription>
          Busiest rooms (by section-meetings) × weekday: cell = average section occupancy % for that room on that day (
          <span className="text-primary">Registered</span> ÷ section seat capacity).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[480px]">
            <div className="mb-1 flex">
              <div className="w-28 shrink-0" />
              {data.days.map((d) => (
                <div key={d} className="flex-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>
            {data.rooms.map((room, ri) => (
              <div key={room} className="flex items-center gap-1 py-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-28 shrink-0 truncate text-xs text-muted-foreground">{room}</div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{room}</TooltipContent>
                </Tooltip>
                {data.days.map((_, di) => {
                  const v = data.matrix[ri][di]
                  const n = data.meetings[ri][di]
                  return (
                    <Tooltip key={`${room}-${di}`}>
                      <TooltipTrigger asChild>
                        <div className={`flex-1 h-7 cursor-default rounded-sm ${tint(v)}`} />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {room} · {data.days[di]}: avg occupancy {v}% ({n} section-day{n !== 1 ? 's' : ''})
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Lower</span>
          <div className="flex gap-1">
            <div className="h-3.5 w-3.5 rounded-sm bg-primary/10" />
            <div className="h-3.5 w-3.5 rounded-sm bg-primary/25" />
            <div className="h-3.5 w-3.5 rounded-sm bg-primary/45" />
            <div className="h-3.5 w-3.5 rounded-sm bg-primary/65" />
            <div className="h-3.5 w-3.5 rounded-sm bg-primary/85" />
          </div>
          <span>Higher</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function CampusConcurrentDensityChart({ data }: { data: HeatmapData[] }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']
  const hours = [...new Set(data.map((d) => d.hour))].sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
  const maxValue = Math.max(1, ...data.map((d) => d.value))

  const getColor = (value: number) => {
    const intensity = value / maxValue
    if (intensity < 0.2) return 'bg-chart-2/15'
    if (intensity < 0.4) return 'bg-chart-2/30'
    if (intensity < 0.6) return 'bg-chart-2/50'
    if (intensity < 0.8) return 'bg-chart-2/70'
    return 'bg-chart-2/90'
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Campus Density</CardTitle>
        <CardDescription>
          Concurrent enrolled seats on campus by calendar slot (physical and blended sections only;
          each counted once per meeting day at its start hour; fully online excluded).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[400px]">
            <div className="mb-2 flex">
              <div className="w-10" />
              {hours.map((hour) => (
                <div key={hour} className="flex-1 text-center text-[10px] text-muted-foreground">
                  {hour}
                </div>
              ))}
            </div>
            {days.map((day) => (
              <div key={day} className="flex items-center gap-1">
                <div className="w-10 text-xs text-muted-foreground">{day}</div>
                {hours.map((hour) => {
                  const cell = data.find((d) => d.day === day && d.hour === hour)
                  const v = cell?.value ?? 0
                  return (
                    <Tooltip key={`${day}-${hour}`}>
                      <TooltipTrigger asChild>
                        <div className={`flex-1 h-8 cursor-default rounded ${getColor(v)}`} />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {day} {hour}: {v.toLocaleString()} on-campus enrolled seats (summed)
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function SlotDensityComparisonChart({ rows }: { rows: SlotDensityClusterRow[] }) {
  const colors = useChartColors()
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Slot Pattern Density</CardTitle>
        <CardDescription>
          Average physical-section occupancy % weighted by section-day occurrences in Sun–Tue–Thu vs Mon–Wed bands.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows} margin={{ left: 8, right: 8, top: 8, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} vertical={false} />
            <XAxis dataKey="cluster" stroke={AXIS_STROKE} fontSize={11} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
              tick={AXIS_TICK}
            />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const r = payload[0].payload as SlotDensityClusterRow
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-lg backdrop-blur-md">
                    <p className="mb-1 text-sm font-semibold">{r.cluster}</p>
                    <p className="text-sm text-muted-foreground">Avg occupancy {r.avgSaturationPct}%</p>
                    <p className="text-xs text-muted-foreground">{r.sessionCount} section-day data points</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="avgSaturationPct" name="Avg occupancy %" radius={[6, 6, 0, 0]} animationDuration={900}>
              {rows.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function LecturerStressScatterChart({
  data,
  className,
  chartHeight = 340,
}: {
  data: LecturerStressPoint[]
  className?: string
  chartHeight?: number
}) {
  const colors = useChartColors()
  const plot = useMemo(() => data.filter((d) => d.creditHours > 0 || d.prepCount > 0).slice(0, 80), [data])

  return (
    <Card className={cn('flex h-full min-h-0 flex-col', className)}>
      <CardHeader className="shrink-0 pb-4">
        <CardTitle className="text-lg font-semibold">Lecturer Stress Matrix</CardTitle>
        <CardDescription>
          X: Σ credit hours in scope · Y: distinct course preparations (Course_Number) · bubble ∝ sections taught.
        </CardDescription>
      </CardHeader>
      <CardContent className="shrink-0 pt-0">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ScatterChart margin={{ left: 8, right: 12, top: 12, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.35} />
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
            <ZAxis type="number" dataKey="sections" range={[40, 400]} />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as LecturerStressPoint
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-lg backdrop-blur-md">
                    <p className="mb-2 text-sm font-semibold">{p.fullName}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Credit hours</span>
                      <span className="font-medium tabular-nums">{p.creditHours}</span>
                      <span className="text-muted-foreground">Preparations</span>
                      <span className="font-medium tabular-nums">{p.prepCount}</span>
                      <span className="text-muted-foreground">Sections</span>
                      <span className="font-medium tabular-nums">{p.sections}</span>
                    </div>
                  </div>
                )
              }}
            />
            <Scatter data={plot} fill={colors[0]} fillOpacity={0.72} isAnimationActive animationDuration={900} />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function AcademicWeightBarChart({ data }: { data: AcademicWeightRow[] }) {
  const colors = useChartColors()
  const rows = useMemo(() => data.slice(0, 12).map((d) => ({ ...d, label: d.department })), [data])
  const gradId = `aw-${colors[2].replace(/#/g, '')}`

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Academic Weight by Department</CardTitle>
        <CardDescription>Σ (Registered_Students × credit_hours) — relative instructional demand in the current scope.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(300, rows.length * 34)}>
          <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={colors[2]} stopOpacity={0.75} />
                <stop offset="100%" stopColor={colors[3]} stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis type="number" stroke={AXIS_STROKE} fontSize={11} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              type="category"
              dataKey="label"
              width={140}
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatName}
              tick={AXIS_TICK}
            />
            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="academicWeight" name="Academic weight" fill={`url(#${gradId})`} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function FacultyCreditHoursBarChart({
  data,
  className,
  chartHeight,
}: {
  data: FacultyCreditLoadRow[]
  className?: string
  /** When set (e.g. Staff tab), fixes plot height so cards match a paired chart. */
  chartHeight?: number
}) {
  const colors = useChartColors()
  const plotHeight = chartHeight ?? Math.max(300, data.length * 30)
  return (
    <Card className={cn('flex h-full min-h-0 flex-col', className)}>
      <CardHeader className="shrink-0 pb-4">
        <CardTitle className="text-lg font-semibold">Faculty Load (Credit Hours)</CardTitle>
        <CardDescription>Σ credit_hours by lecturer in the filtered scope.</CardDescription>
      </CardHeader>
      <CardContent className="shrink-0 pt-0">
        <ResponsiveContainer width="100%" height={plotHeight}>
          <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
            <XAxis type="number" stroke={AXIS_STROKE} fontSize={11} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              stroke={AXIS_STROKE}
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatName}
              tick={AXIS_TICK}
            />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const r = payload[0].payload as FacultyCreditLoadRow
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-lg backdrop-blur-md">
                    <p className="mb-1 text-sm font-semibold">{r.fullName}</p>
                    <p className="text-sm tabular-nums">{r.creditHours} credit hours</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="creditHours" name="Credit hours" fill={colors[1]} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function buildTrendChartRows(
  termLabels: string[],
  series: CourseSaturationTrendSeries[],
): Record<string, string | number>[] {
  return termLabels.map((term, i) => {
    const row: Record<string, string | number> = { term }
    for (const s of series) {
      row[s.courseNumber] = s.maxUtilByTermIndex[i] ?? 0
    }
    return row
  })
}

export function HighDemandCourseTrendChart({
  termLabels,
  series,
}: {
  termLabels: string[]
  series: CourseSaturationTrendSeries[]
}) {
  const colors = useChartColors()
  const rows = useMemo(() => buildTrendChartRows(termLabels, series), [termLabels, series])

  if (!rows.length || !series.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">High-Demand Course Saturation</CardTitle>
          <CardDescription>No courses with repeated ≥90% section occupancy across terms in this scope.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">High-Demand Course Saturation</CardTitle>
        <CardDescription>
          Per term, maximum physical-section occupancy % for each historically stressed course (observed registrations only).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.35} vertical={false} />
            <XAxis dataKey="term" stroke={AXIS_STROKE} fontSize={10} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              domain={[0, 100]}
              stroke={AXIS_STROKE}
              fontSize={11}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
            />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((s, i) => (
              <Line
                key={s.courseNumber}
                type="monotone"
                dataKey={s.courseNumber}
                name={s.label}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive
                animationDuration={900}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function LabPressureLineChart({ data }: { data: PlanningTermRow[] }) {
  const colors = useChartColors()
  const rows = data.map((d) => ({
    ...d,
    lab: d.labOccupancyPct ?? 0,
  }))

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Lab Capacity Pressure</CardTitle>
          <CardDescription>No lab sections in scope.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Lab Capacity Pressure</CardTitle>
        <CardDescription>
          Term-by-term seat occupancy for sections flagged as laboratories (islab = true), physical rooms only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.35} vertical={false} />
            <XAxis dataKey="termLabel" stroke={AXIS_STROKE} fontSize={10} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              domain={[0, 100]}
              stroke={AXIS_STROKE}
              fontSize={11}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
            />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const r = payload[0].payload as PlanningTermRow
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-lg backdrop-blur-md">
                    <p className="mb-1 text-sm font-semibold">{r.termLabel}</p>
                    <p className="text-sm">Lab occupancy: {r.labOccupancyPct != null ? `${r.labOccupancyPct}%` : 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{r.labSectionCount} lab sections</p>
                  </div>
                )
              }}
            />
            <Line type="monotone" dataKey="lab" name="Lab occupancy %" stroke={colors[2]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive animationDuration={900} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function HighSaturationPressureAreaChart({ data }: { data: PlanningTermRow[] }) {
  const colors = useChartColors()
  if (!data.length) return null
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Scheduling Pressure</CardTitle>
        <CardDescription>Count of physical sections at or above 90% seat occupancy per term.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="hpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[0]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={colors[0]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.35} vertical={false} />
            <XAxis dataKey="termLabel" stroke={AXIS_STROKE} fontSize={10} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis stroke={AXIS_STROKE} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} tick={AXIS_TICK} />
            <RechartsTooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="highSaturationSectionCount"
              name="High-saturation sections"
              stroke={colors[0]}
              fill="url(#hpGrad)"
              strokeWidth={2}
              isAnimationActive
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function RoomUtilizationTrendsChart({
  heavy,
  light,
}: {
  heavy: RoomUtilizationTrendRoom[]
  light: RoomUtilizationTrendRoom[]
}) {
  const colors = useChartColors()
  const rows = useMemo(() => {
    const termLabels =
      heavy[0]?.points.map((p) => p.termLabel) ?? light[0]?.points.map((p) => p.termLabel) ?? []
    return termLabels.map((term, i) => {
      const row: Record<string, string | number> = { term }
      heavy.forEach((h, hi) => {
        row[`H:${h.room}`] = h.points[i]?.occupancyPct ?? 0
      })
      light.forEach((l, li) => {
        row[`L:${l.room}`] = l.points[i]?.occupancyPct ?? 0
      })
      return row
    })
  }, [heavy, light])

  if (!rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Room Utilization Trends</CardTitle>
          <CardDescription>Not enough multi-term room history in this filter.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const keys = Object.keys(rows[0]).filter((k) => k !== 'term')

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Room Utilization Trends</CardTitle>
        <CardDescription>
          Heavy-use vs light-use rooms (by long-run average occupancy); each series is mean physical occupancy % within the
          term.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.35} vertical={false} />
            <XAxis dataKey="term" stroke={AXIS_STROKE} fontSize={10} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              domain={[0, 100]}
              stroke={AXIS_STROKE}
              fontSize={11}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <RechartsTooltip content={<CustomTooltip />} />
            {keys.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                name={k.replace(/^H:/, 'Heavy · ').replace(/^L:/, 'Light · ')}
                stroke={colors[i % colors.length]}
                strokeWidth={1.6}
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

export function SectionExpansionTable({
  rows,
  minTermsNote,
}: {
  rows: SectionExpansionRow[]
  minTermsNote?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Section Expansion Signals</CardTitle>
        <CardDescription>
          Courses with high physical-section occupancy (≥90%) in multiple observed terms — indicative of recurring demand
          pressure. {minTermsNote ? ` ${minTermsNote}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No courses meet the recurrence rule in the current scope.</p>
        ) : (
          <ScrollArea className="h-[360px] w-full">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card/95 backdrop-blur">
                <tr className="border-b text-left">
                  <th className="px-6 py-2.5 font-medium text-muted-foreground">Course</th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground">Department</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Terms ≥90%</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Max util</th>
                  <th className="px-6 py-2.5 text-right font-medium text-muted-foreground">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.courseNumber} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-2.5">
                      <div className="font-medium">{r.courseNumber}</div>
                      <div className="max-w-[220px] truncate text-xs text-muted-foreground">{r.courseName}</div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.department}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.termsWithHighSaturation}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.maxObservedUtilizationPct}%</td>
                    <td className="px-6 py-2.5 text-right text-xs text-muted-foreground">
                      Consider additional sections in future terms.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

export function SemesterSeatVolumeChart({ data }: { data: SemesterData[] }) {
  const colors = useChartColors()
  const rows = data.map((d) => ({ ...d, label: d.semester }))
  if (!rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Seat enrollments by term</CardTitle>
          <CardDescription>No term data in the current filter.</CardDescription>
        </CardHeader>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Seat enrollments by term</CardTitle>
        <CardDescription>Sum of Registered_Students across sections per academic term in scope (historical).</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.35} vertical={false} />
            <XAxis dataKey="label" stroke={AXIS_STROKE} fontSize={10} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis stroke={AXIS_STROKE} fontSize={11} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <RechartsTooltip content={<CustomTooltip />} />
            <Bar dataKey="students" name="Seat enrollments" fill={colors[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function TopCoursesEnrollmentBarChart({ data }: { data: CourseData[] }) {
  const colors = useChartColors()
  const rows = useMemo(() => data.slice(0, 12).map((d) => ({ ...d, label: d.name })), [data])
  if (!rows.length) return null
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Top courses by seat enrollments</CardTitle>
        <CardDescription>Σ Registered_Students across sections per course code in the filtered scope.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(280, rows.length * 28)}>
          <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
            <XAxis type="number" stroke={AXIS_STROKE} fontSize={11} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              type="category"
              dataKey="label"
              width={120}
              stroke={AXIS_STROKE}
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatName}
              tick={AXIS_TICK}
            />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const r = payload[0].payload as CourseData
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-lg backdrop-blur-md">
                    <p className="text-sm font-semibold">{r.code}</p>
                    <p className="mb-2 text-xs text-muted-foreground">{r.fullName}</p>
                    <p className="text-sm tabular-nums">{r.students.toLocaleString()} students</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="students" name="Students" fill={colors[3]} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
