'use client'
 
import { formatName } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { useCourseAnalyticsTheme } from '@/lib/course-analytics/analytics-theme-context'
import { usePalette } from '@/components/course-analytics/palette-provider'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
  Legend,
  Scatter,
  ScatterChart,
  ZAxis,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/course-analytics-ui/card'
import type { 
  DepartmentData, 
  SemesterData, 
  OnlineModeData, 
  LecturerData,
  TimeSlotData,
  DayData,
  CourseData,
  CapacityDistribution,
  RoomWasteData,
  CourseGrowthData,
  HighDemandSection,
  FacultyWorkloadData,
  RoomTypeUtilization,
  AcademicLevelModeData,
  AcademicFocusData
} from '@/lib/course-analytics/course-data'


/**
 * Shared axis style for all Recharts axes.
 * Uses CSS custom properties so colors respond to theme and palette changes.
 */
const AXIS_STROKE = 'var(--color-muted-foreground)'
const AXIS_TICK = { fill: 'var(--color-muted-foreground)', opacity: 0.7 }
const AXIS_TICK_LIGHT = { fill: 'var(--color-muted-foreground)', opacity: 0.85 }

/** Hook that returns the 5 chart colors strictly driven by React context. */
function useChartColors() {
  const { activePalette } = usePalette()
  const { resolvedTheme } = useCourseAnalyticsTheme()
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

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; dataKey: string; color?: string; payload?: Record<string, unknown> }>
  label?: string
}

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
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

// Department Horizontal Bar Chart
interface DepartmentChartProps {
  data: DepartmentData[]
}

export function DepartmentChart({ data }: DepartmentChartProps) {
  const chartData = data.slice(0, 12)
  const colors = useChartColors()
  
  return (
    <Card className="col-span-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Students by Department</CardTitle>
        <CardDescription>Total enrolled students across academic departments</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 36)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 40, top: 10, bottom: 20 }}>
            <defs>
              <linearGradient id={`deptGradient-${colors[0].replace('#', '')}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={colors[0]} stopOpacity={0.8} />
                <stop offset="100%" stopColor={colors[0]} stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis 
              type="number" 
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toString()}
              label={{ value: 'Number of Students', position: 'bottom', offset: 0, fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              width={160}
              tickFormatter={formatName}
              tick={AXIS_TICK_LIGHT}
              label={{ value: 'Department', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const item = payload[0].payload as DepartmentData
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md ca-dark:border-white/10 ca-dark:bg-black/60">
                    <p className="mb-2 text-sm font-semibold text-foreground">{formatName(item.fullName)}</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                      <p className="text-muted-foreground">Students</p>
                      <p className="font-medium tabular-nums text-foreground">{item.students.toLocaleString()}</p>
                      <p className="text-muted-foreground">Sections</p>
                      <p className="font-medium tabular-nums text-foreground">{item.sections}</p>
                      <p className="text-muted-foreground">Courses</p>
                      <p className="font-medium tabular-nums text-foreground">{item.courses}</p>
                      <p className="text-muted-foreground">Utilization</p>
                      <p className="font-medium tabular-nums text-foreground">{item.utilization}%</p>
                    </div>
                  </div>
                )
              }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
            />
            <Bar 
              dataKey="students" 
              fill={`url(#deptGradient-${colors[0].replace('#', '')})`}
              radius={[0, 8, 8, 0]}
              name="Students"
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Enrollment Trends with Area + Line
interface SemesterChartProps {
  data: SemesterData[]
}

export function SemesterChart({ data }: SemesterChartProps) {
  const colors = useChartColors()
  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Enrollment Trends</CardTitle>
        <CardDescription>Student enrollment and sections by semester</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 20 }}>
            <defs>
              <linearGradient id={`studentGradient-${colors[0].replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[0]} stopOpacity={0.5} />
                <stop offset="100%" stopColor={colors[0]} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="semester" 
              stroke={AXIS_STROKE}
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Semester', position: 'bottom', offset: 0, fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <YAxis 
              yAxisId="left"
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              tick={AXIS_TICK}
              label={{ value: 'Students', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Sections', angle: 90, position: 'insideRight', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }}
              iconType="circle"
              iconSize={8}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="students"
              stroke={colors[0]}
              strokeWidth={3}
              fill={`url(#studentGradient-${colors[0].replace('#', '')})`}
              name="Students"
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="sections"
              stroke={colors[1]}
              strokeWidth={3}
              dot={{ fill: colors[1], strokeWidth: 2, r: 4, stroke: 'var(--background)' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              name="Sections"
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Delivery Mode Pie Chart
interface OnlineModeChartProps {
  data: OnlineModeData[]
}

export function OnlineModeChart({ data }: OnlineModeChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const colors = useChartColors()
  
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Delivery Mode</CardTitle>
        <CardDescription>Course delivery format distribution</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={4}
              dataKey="count"
              nameKey="mode"
              strokeWidth={0}
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} className="hover:opacity-80 transition-opacity drop-shadow-md" />
              ))}
            </Pie>
            <Tooltip 
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const item = payload[0].payload as OnlineModeData
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md ca-dark:border-white/10 ca-dark:bg-black/60">
                    <p className="mb-2 text-sm font-semibold text-foreground">{item.mode}</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                      <p className="text-muted-foreground">Sections</p>
                      <p className="font-medium tabular-nums text-foreground">{item.count.toLocaleString()}</p>
                      <p className="text-muted-foreground">Students</p>
                      <p className="font-medium tabular-nums text-foreground">{item.students.toLocaleString()}</p>
                      <p className="text-muted-foreground">Share</p>
                      <p className="font-medium tabular-nums text-foreground">{item.percentage}%</p>
                    </div>
                  </div>
                )
              }} 
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-4">
          {data.map((item, index) => (
            <div key={item.mode} className="flex items-center gap-2">
              <div 
                className="h-3 w-3 rounded-full" 
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="text-xs text-muted-foreground">
                {item.mode}
              </span>
              <span className="text-xs font-medium text-foreground">
                {item.percentage}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}



// Time Slot Distribution
interface TimeSlotChartProps {
  data: TimeSlotData[]
}

export function TimeSlotChart({ data }: TimeSlotChartProps) {
  const colors = useChartColors()
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Class Schedule Distribution</CardTitle>
        <CardDescription>Number of sections by start time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 20 }}>
            <defs>
              <linearGradient id={`timeGradient-${colors[2].replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[2]} stopOpacity={0.5} />
                <stop offset="100%" stopColor={colors[2]} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="hour" 
              stroke={AXIS_STROKE}
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Start Time', position: 'bottom', offset: 0, fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <YAxis 
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Sections', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="sections"
              stroke={colors[2]}
              strokeWidth={3}
              fill={`url(#timeGradient-${colors[2].replace('#', '')})`}
              name="Sections"
              dot={{ fill: colors[2], strokeWidth: 2, r: 3, stroke: 'var(--background)' }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Weekly Distribution
interface DayChartProps {
  data: DayData[]
}

export function DayChart({ data }: DayChartProps) {
  const colors = useChartColors()
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Weekly Distribution</CardTitle>
        <CardDescription>Section-days and student-seat-days by day</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 20 }}>
            <XAxis 
              dataKey="day" 
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Day of Week', position: 'bottom', offset: 0, fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <YAxis 
              yAxisId="left"
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Section-Days', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toString()}
              label={{ value: 'Student-Seat-Days', angle: 90, position: 'insideRight', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }}
              iconType="circle"
              iconSize={8}
            />
            <Bar 
              yAxisId="left"
              dataKey="sections" 
              fill={colors[3]}
              radius={[6, 6, 0, 0]}
              name="Section-Days"
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="students"
              stroke={colors[0]}
              strokeWidth={3}
              dot={{ fill: colors[0], strokeWidth: 2, r: 4, stroke: 'var(--background)' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              name="Student-Seat-Days"
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Capacity Distribution
interface CapacityChartProps {
  data: CapacityDistribution[]
}

export function CapacityChart({ data }: CapacityChartProps) {
  const colors = useChartColors()
  // Use palette colors for capacity chart - reversed to show progression
  const capacityColors = [colors[4], colors[3], colors[2], colors[1], colors[0]]
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Capacity Utilization</CardTitle>
        <CardDescription>Section fill rate distribution</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 20 }}>
            <XAxis 
              dataKey="range" 
              stroke={AXIS_STROKE}
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Utilization Range (%)', position: 'bottom', offset: 0, fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <YAxis 
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Number of Sections', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar 
              dataKey="count" 
              radius={[6, 6, 0, 0]}
              name="Sections"
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={capacityColors[index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Top Courses Chart
interface TopCoursesChartProps {
  data: CourseData[]
}

export function TopCoursesChart({ data }: TopCoursesChartProps) {
  const colors = useChartColors()
  return (
    <Card className="col-span-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Top Courses by Enrollment</CardTitle>
        <CardDescription>Most popular courses by total student enrollment</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(360, data.length * 32)}>
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 40, top: 10, bottom: 20 }}>
            <defs>
              <linearGradient id={`courseGradient-${colors[4].replace('#', '')}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={colors[4]} stopOpacity={0.8} />
                <stop offset="100%" stopColor={colors[4]} stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis 
              type="number" 
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Total Enrollments', position: 'bottom', offset: 0, fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              stroke={AXIS_STROKE}
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              width={180}
              tickFormatter={formatName}
              tick={AXIS_TICK_LIGHT}
              label={{ value: 'Course', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const item = payload[0].payload as CourseData
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md ca-dark:border-white/10 ca-dark:bg-black/60">
                    <p className="text-sm font-semibold text-foreground">{item.code}</p>
                    <p className="mb-2 text-xs text-muted-foreground">{formatName(item.name)}</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                      <p className="text-muted-foreground">Students</p>
                      <p className="font-medium tabular-nums text-foreground">{item.students.toLocaleString()}</p>
                      <p className="text-muted-foreground">Sections</p>
                      <p className="font-medium tabular-nums text-foreground">{item.sections}</p>
                      <p className="text-muted-foreground">Avg Class</p>
                      <p className="font-medium tabular-nums text-foreground">{item.avgClassSize}</p>
                    </div>
                  </div>
                )
              }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
            />
            <Bar 
              dataKey="students" 
              fill={`url(#courseGradient-${colors[4].replace('#', '')})`}
              radius={[0, 6, 6, 0]}
              name="Students"
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Department Comparison — Grouped Horizontal Bar
interface DepartmentComparisonChartProps {
  data: { name: string; students: number; sections: number; courses: number; utilization: number }[]
}

export function DepartmentComparisonChart({ data }: DepartmentComparisonChartProps) {
  const colors = useChartColors()

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Department Comparison</CardTitle>
        <CardDescription>Students, sections & courses by top departments</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 20 }}>
            <XAxis
              type="number"
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toString()}
              label={{ value: 'Count', position: 'bottom', offset: 0, fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke={AXIS_STROKE}
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={120}
              tickFormatter={formatName}
              tick={AXIS_TICK_LIGHT}
              label={{ value: 'Department', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const item = payload[0].payload as { name: string; students: number; sections: number; courses: number; utilization: number }
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md ca-dark:border-white/10 ca-dark:bg-black/60">
                    <p className="mb-2 text-sm font-semibold text-foreground">{formatName(item.name)}</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                      <p className="text-muted-foreground">Students</p>
                      <p className="font-medium tabular-nums text-foreground">{item.students.toLocaleString()}</p>
                      <p className="text-muted-foreground">Sections</p>
                      <p className="font-medium tabular-nums text-foreground">{item.sections}</p>
                      <p className="text-muted-foreground">Courses</p>
                      <p className="font-medium tabular-nums text-foreground">{item.courses}</p>
                      <p className="text-muted-foreground">Utilization</p>
                      <p className="font-medium tabular-nums text-foreground">{item.utilization}%</p>
                    </div>
                  </div>
                )
              }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="students" name="Students" fill={colors[0]} radius={[0, 4, 4, 0]} isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" />
            <Bar dataKey="sections" name="Sections" fill={colors[1]} radius={[0, 4, 4, 0]} isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" />
            <Bar dataKey="courses" name="Courses" fill={colors[2]} radius={[0, 4, 4, 0]} isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}


// Section Size vs Utilization Scatter
interface ScatterDataPoint {
  name: string
  classSize: number
  utilization: number
  sections: number
}

interface SectionScatterChartProps {
  data: ScatterDataPoint[]
}

export function SectionScatterChart({ data }: SectionScatterChartProps) {
  const colors = useChartColors()
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Class Size vs Utilization</CardTitle>
        <CardDescription>Department efficiency analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ left: 0, right: 20, top: 20, bottom: 10 }}>
            <XAxis 
              type="number" 
              dataKey="classSize" 
              name="Avg Class Size"
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Avg Class Size', position: 'bottom', offset: 0, fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <YAxis 
              type="number" 
              dataKey="utilization" 
              name="Utilization %"
              stroke={AXIS_STROKE}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Utilization %', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
              domain={[0, 100]}
            />
            <ZAxis type="number" dataKey="sections" range={[50, 400]} />
            <Tooltip 
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const item = payload[0].payload as ScatterDataPoint
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md ca-dark:border-white/10 ca-dark:bg-black/60">
                    <p className="mb-2 text-sm font-semibold text-foreground">{formatName(item.name)}</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                      <p className="text-muted-foreground">Class Size</p>
                      <p className="font-medium tabular-nums text-foreground">{item.classSize}</p>
                      <p className="text-muted-foreground">Utilization</p>
                      <p className="font-medium tabular-nums text-foreground">{item.utilization}%</p>
                      <p className="text-muted-foreground">Sections</p>
                      <p className="font-medium tabular-nums text-foreground">{item.sections}</p>
                    </div>
                  </div>
                )
              }}
            />
            <Scatter 
              data={data} 
              fill={colors[0]}
              fillOpacity={0.7}
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Course Level Distribution
interface CourseLevelData {
  level: string
  count: number
  students: number
}

interface CourseLevelChartProps {
  data: CourseLevelData[]
}

export function CourseLevelChart({ data }: CourseLevelChartProps) {
  const colors = useChartColors()
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Course Level Distribution</CardTitle>
        <CardDescription>Sections by course level</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 20 }}>
            <XAxis 
              dataKey="level" 
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Course Level', position: 'bottom', offset: 0, fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <YAxis 
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Number of Sections', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar 
              dataKey="count" 
              fill={colors[4]}
              radius={[6, 6, 0, 0]}
              name="Sections"
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Utilization Heatmap (simplified as bars for each day-hour combo)
interface HeatmapData {
  day: string
  hour: string
  value: number
}

interface UtilizationHeatmapProps {
  data: HeatmapData[]
}

export function UtilizationHeatmap({ data }: UtilizationHeatmapProps) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Sat']
  const hours = [...new Set(data.map(d => d.hour))].sort()
  
  const maxValue = Math.max(...data.map(d => d.value))
  
  const getColor = (value: number) => {
    const intensity = value / maxValue
    if (intensity < 0.2) return 'bg-primary/10'
    if (intensity < 0.4) return 'bg-primary/25'
    if (intensity < 0.6) return 'bg-primary/40'
    if (intensity < 0.8) return 'bg-primary/60'
    return 'bg-primary/80'
  }
  
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Schedule Heatmap</CardTitle>
        <CardDescription>Class session density by day and hour</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[400px]">
            <div className="mb-2 flex">
              <div className="w-12" />
              {hours.map(hour => (
                <div key={hour} className="flex-1 text-center text-[10px] text-muted-foreground">
                  {hour}
                </div>
              ))}
            </div>
            {days.map(day => (
              <div key={day} className="flex items-center gap-1">
                <div className="w-12 text-xs text-muted-foreground">{day}</div>
                {hours.map(hour => {
                  const cell = data.find(d => d.day === day && d.hour === hour)
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={`flex-1 h-8 rounded ${cell ? getColor(cell.value) : 'bg-muted/30'}`}
                      title={cell ? `${day} ${hour}: ${cell.value} Student-Seat-Days` : `${day} ${hour}: 0 Student-Seat-Days`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="h-4 w-4 rounded bg-primary/10" />
              <div className="h-4 w-4 rounded bg-primary/25" />
              <div className="h-4 w-4 rounded bg-primary/40" />
              <div className="h-4 w-4 rounded bg-primary/60" />
              <div className="h-4 w-4 rounded bg-primary/80" />
            </div>
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}



// Underenrolled Sections Alert
interface UnderenrolledSection {
  course: string
  courseName: string
  section: string
  students: number
  capacity: number
  utilization: number
  lecturer: string
  department: string
}

interface UnderenrolledAlertProps {
  data: UnderenrolledSection[]
  threshold?: number
}

export function UnderenrolledAlert({ data, threshold = 10 }: UnderenrolledAlertProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-chart-2/20 text-chart-2">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            Enrollment Health
          </CardTitle>
          <CardDescription>No critically underenrolled sections found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All sections have at least {threshold} students enrolled.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/20 text-destructive">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          Underenrolled Sections
        </CardTitle>
        <CardDescription>
          {data.length} sections with fewer than {threshold} students
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-left">
                <th className="px-6 py-2.5 font-medium text-muted-foreground">Course</th>
                <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Sec</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Students</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Cap</th>
                <th className="px-6 py-2.5 text-right font-medium text-muted-foreground">Fill %</th>
              </tr>
            </thead>
            <tbody>
              {data.map((section, idx) => (
                <tr key={`${section.course}-${section.section}-${idx}`} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-2.5">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{section.course}</span>
                      <span className="truncate text-xs text-muted-foreground max-w-[200px]" title={section.courseName}>
                        {section.courseName}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">{section.section}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-destructive">{section.students}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{section.capacity}</td>
                  <td className="px-6 py-2.5 text-right">
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      {section.utilization}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// Semester Year-over-Year Comparison Chart
interface SemesterYoYChartProps {
  data: { year: string; first: number; second: number; summer: number }[]
}

export function SemesterYoYChart({ data }: SemesterYoYChartProps) {
  const colors = useChartColors()
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Semester Comparison by Year</CardTitle>
        <CardDescription>Year-over-year enrollment trends for each semester type</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
            <XAxis 
              dataKey="year" 
              stroke="var(--color-muted-foreground)"
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
            />
            <YAxis 
              stroke="var(--color-muted-foreground)"
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toString()}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Legend 
              wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="first" name="First Semester" fill={colors[0]} radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" />
            <Bar dataKey="second" name="Second Semester" fill={colors[1]} radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" />
            <Bar dataKey="summer" name="Summer Semester" fill={colors[2]} radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Department Utilization Gauges
export interface DepartmentUtilization {
  name: string
  fullName: string
  students: number
  capacity: number
  utilization: number
  sections: number
  status: 'low' | 'medium' | 'high' | 'full'
}

export function DepartmentUtilizationGauges({ data }: { data: DepartmentUtilization[] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'low': return 'bg-destructive'
      case 'medium': return 'bg-chart-3'
      case 'high': return 'bg-chart-2'
      case 'full': return 'bg-primary'
      default: return 'bg-muted'
    }
  }

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'low': return 'bg-destructive/20'
      case 'medium': return 'bg-chart-3/20'
      case 'high': return 'bg-chart-2/20'
      case 'full': return 'bg-primary/20'
      default: return 'bg-muted/20'
    }
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Department Efficiency</CardTitle>
        <CardDescription>Utilization rate by department</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2">
          {data.map((dept) => (
            <div key={dept.fullName} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate text-muted-foreground" title={dept.fullName}>
                  {dept.name}
                </span>
                <span className="font-semibold tabular-nums">{dept.utilization}%</span>
              </div>
              <div className={`h-2.5 w-full rounded-full ${getStatusBg(dept.status)}`}>
                <div 
                  className={`h-full rounded-full transition-all ${getStatusColor(dept.status)}`}
                  style={{ width: `${Math.min(dept.utilization, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Room Waste Analysis Table
export function RoomWasteTable({ data, className }: { data: RoomWasteData[], className?: string }) {
  return (
    <Card className={`flex flex-col h-full border-border/40 overflow-hidden ${className || ''}`}>
      <CardHeader className="pb-4 shrink-0">
        <CardTitle className="text-lg font-semibold text-destructive">Room Efficiency Analysis</CardTitle>
        <CardDescription>Top rooms with highest number of unused seats</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden px-0 pb-0 min-h-0">
        <div className="h-full overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card/95 backdrop-blur">
              <tr className="border-b text-left">
                <th className="px-6 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Room</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs uppercase tracking-wider">Unused</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs uppercase tracking-wider">Fill %</th>
                <th className="px-6 py-2.5 text-right font-medium text-muted-foreground text-xs uppercase tracking-wider">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {data.map((room, idx) => (
                <tr key={`${room.room}-${idx}`} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3 font-medium text-foreground">{room.room}</td>
                  <td className="px-3 py-3 text-right">
                    <span className="font-semibold text-destructive">{room.unusedSeats}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <span className="text-xs text-muted-foreground">{room.efficiencyScore}%</span>
                       <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                         <div 
                           className={`h-full ${room.efficiencyScore < 30 ? 'bg-destructive' : room.efficiencyScore < 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                           style={{ width: `${room.efficiencyScore}%` }}
                         />
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right text-muted-foreground tabular-nums">{room.totalCapacity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// Course Growth Comparison Chart
export function CourseGrowthChart({ data }: { data: CourseGrowthData[] }) {
  const colors = useChartColors()
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Course Enrollment Growth</CardTitle>
        <CardDescription>Top courses by enrollment change vs previous academic year</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 40, top: 10, bottom: 20 }}>
            <XAxis type="number" stroke={AXIS_STROKE} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis 
              type="category" 
              dataKey="code" 
              stroke={AXIS_STROKE} 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              width={80}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const item = payload[0].payload as CourseGrowthData
                return (
                  <div className="rounded-xl border border-white/20 bg-background/60 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md ca-dark:border-white/10 ca-dark:bg-black/60">
                    <p className="text-sm font-semibold text-foreground">{item.code}</p>
                    <p className="mb-2 text-xs text-muted-foreground">{item.name}</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                      <p className="text-muted-foreground">Previous</p>
                      <p className="font-medium tabular-nums">{item.previousStudents}</p>
                      <p className="text-muted-foreground">Current</p>
                      <p className="font-medium tabular-nums">{item.currentStudents}</p>
                      <p className="text-muted-foreground">Change</p>
                      <p className={`font-bold tabular-nums ${item.growth >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                        {item.growth >= 0 ? '+' : ''}{item.growth}%
                      </p>
                    </div>
                  </div>
                )
              }}
            />
            <Bar 
              dataKey="growth" 
              radius={[0, 4, 4, 0]} 
              isAnimationActive={true}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.growth >= 0 ? colors[3] : colors[4]} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export interface HighDemandAlertProps {
  data: HighDemandSection[]
  threshold?: number
}

export function HighDemandAlert({ data, threshold = 95 }: HighDemandAlertProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            Capacity Health
          </CardTitle>
          <CardDescription>No critically overenrolled sections found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All sections have less than {threshold}% fill rate.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-warning/30 border-amber-500/30">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-500">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          High Demand Sections
        </CardTitle>
        <CardDescription>
          {data.length} sections operating at or above {threshold}% capacity
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-left">
                <th className="px-6 py-2.5 font-medium text-muted-foreground">Course</th>
                <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Sec</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Students</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Cap</th>
                <th className="px-6 py-2.5 text-right font-medium text-muted-foreground">Fill %</th>
              </tr>
            </thead>
            <tbody>
              {data.map((section, idx) => (
                <tr key={`${section.course}-${section.section}-${idx}`} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-2.5">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{section.course}</span>
                      <span className="truncate text-xs text-muted-foreground max-w-[200px]" title={section.courseName}>
                        {section.courseName}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">{section.section}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-amber-500">{section.students}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{section.capacity}</td>
                  <td className="px-6 py-2.5 text-right">
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500">
                      {section.utilization}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export interface FacultyWorkloadChartProps {
  data: FacultyWorkloadData[]
}

export function FacultyWorkloadChart({ data }: FacultyWorkloadChartProps) {
  const colors = useChartColors()
  
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Faculty Workload Distribution</CardTitle>
        <CardDescription>Number of sections assigned per lecturer</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 20 }}>
            <XAxis 
              dataKey="sections" 
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Sections Taught', position: 'bottom', offset: 0, fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <YAxis 
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Number of Lecturers', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar 
              dataKey="count" 
              fill={colors[2]}
              radius={[6, 6, 0, 0]}
              name="Lecturers"
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export interface RoomTypeChartProps {
  data: RoomTypeUtilization[]
}

export function RoomTypeChart({ data }: RoomTypeChartProps) {
  const colors = useChartColors()
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Room Type Utilization</CardTitle>
        <CardDescription>Average utilization percentage by room type</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 20 }}>
            <XAxis 
              dataKey="type" 
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
            />
            <YAxis 
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              domain={[0, 100]}
              label={{ value: 'Utilization %', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar 
              dataKey="avgUtilization" 
              fill={colors[1]}
              radius={[6, 6, 0, 0]}
              name="Avg Utilization %"
              isAnimationActive={true}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export interface AcademicLevelStackedChartProps {
  data: AcademicLevelModeData[]
}

export function AcademicLevelStackedChart({ data }: AcademicLevelStackedChartProps) {
  const colors = useChartColors()
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Academic Level & Delivery Mode</CardTitle>
        <CardDescription>Number of sections grouped by level and instruction mode</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 20 }}>
            <XAxis 
              dataKey="level" 
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Course Level', position: 'bottom', offset: 0, fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <YAxis 
              stroke={AXIS_STROKE}
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tick={AXIS_TICK}
              label={{ value: 'Sections', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} />
            <Bar dataKey="inPerson" stackId="a" fill={colors[0]} name="On-Campus" radius={[0, 0, 0, 0]} isAnimationActive={true} />
            <Bar dataKey="online" stackId="a" fill={colors[1]} name="Online" radius={[0, 0, 0, 0]} isAnimationActive={true} />
            <Bar dataKey="blended" stackId="a" fill={colors[2]} name="Blended" radius={[4, 4, 0, 0]} isAnimationActive={true} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export interface AcademicFocusRadarChartProps {
  data: AcademicFocusData[]
}

export function AcademicFocusRadarChart({ data }: AcademicFocusRadarChartProps) {
  const colors = useChartColors()
  const mainColor = colors[0]

  return (
    <Card className="overflow-hidden bg-card/60 backdrop-blur-xl transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5">
      <CardHeader className="pb-2">
        <div>
          <CardTitle className="text-lg font-bold tracking-tight">Academic Focus</CardTitle>
          <CardDescription className="text-sm">Course distribution across levels</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="h-[270px] p-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid 
              stroke="var(--color-border)" 
              strokeDasharray="4 4" 
              gridType="polygon"
            />
            <PolarAngleAxis 
              dataKey="level" 
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12, fontWeight: 500 }}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, 'auto']} 
              tick={false} 
              axisLine={false} 
            />
            <Radar
              name="Courses"
              dataKey="count"
              stroke={mainColor}
              strokeWidth={3}
              fill={mainColor}
              fillOpacity={0.3}
              dot={{ r: 4, fill: 'var(--background)', stroke: mainColor, strokeWidth: 2 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              isAnimationActive={true}
              animationDuration={2000}
              animationEasing="ease-in-out"
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const item = payload[0].payload as AcademicFocusData
                return (
                  <div className="rounded-xl border border-white/20 bg-background/80 px-4 py-3 shadow-xl backdrop-blur-xl ca-dark:border-white/10 ca-dark:bg-black/80">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.level}</p>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: mainColor }} />
                      <p className="text-sm font-bold text-foreground">{item.count} <span className="font-normal text-muted-foreground">Sections</span></p>
                    </div>
                  </div>
                )
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

