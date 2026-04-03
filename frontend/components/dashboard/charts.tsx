"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { roomUtilizationData, weeklyDistribution, semesterComparison } from "@/lib/data"

const COLORS = ["#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"]

const departmentData = [
  { name: "CS", students: 420 },
  { name: "SE", students: 280 },
  { name: "DS", students: 180 },
  { name: "IS", students: 220 },
  { name: "CYS", students: 150 },
]

const conflictTypeData = [
  { name: "Room", value: 35 },
  { name: "Lecturer", value: 25 },
  { name: "Time", value: 20 },
  { name: "Capacity", value: 20 },
]

const hourlyLoadData = [
  { hour: "8AM", load: 45 },
  { hour: "9AM", load: 78 },
  { hour: "10AM", load: 92 },
  { hour: "11AM", load: 88 },
  { hour: "12PM", load: 65 },
  { hour: "1PM", load: 72 },
  { hour: "2PM", load: 85 },
  { hour: "3PM", load: 70 },
  { hour: "4PM", load: 55 },
  { hour: "5PM", load: 30 },
]

const optimizationTrend = [
  { week: "W1", score: 82 },
  { week: "W2", score: 85 },
  { week: "W3", score: 88 },
  { week: "W4", score: 91 },
  { week: "W5", score: 94 },
]

// Extended room data for bar chart like image3
const roomBarData = [
  { room: "R101", utilization: 85 },
  { room: "R102", utilization: 71 },
  { room: "R103", utilization: 92 },
  { room: "R201", utilization: 68 },
  { room: "R202", utilization: 76 },
  { room: "R301", utilization: 55 },
  { room: "R302", utilization: 80 },
  { room: "Lab1", utilization: 95 },
  { room: "Lab2", utilization: 87 },
]

const weeklyDistExtended = [
  { day: "Sun", classes: 24, rooms: 18 },
  { day: "Mon", classes: 28, rooms: 22 },
  { day: "Tue", classes: 22, rooms: 16 },
  { day: "Wed", classes: 26, rooms: 20 },
  { day: "Thu", classes: 18, rooms: 14 },
]

const semesterTrendsData = [
  { semester: "Fall '22", students: 980, score: 78 },
  { semester: "Spr '23", students: 1020, score: 82 },
  { semester: "Fall '23", students: 1150, score: 85 },
  { semester: "Spr '24", students: 1180, score: 88 },
  { semester: "Fall '24", students: 1250, score: 94 },
]

const conflictTrendData = [
  { week: "W1", hard: 5, soft: 12 },
  { week: "W2", hard: 4, soft: 10 },
  { week: "W3", hard: 3, soft: 8 },
  { week: "W4", hard: 2, soft: 7 },
  { week: "W5", hard: 1, soft: 5 },
  { week: "W6", hard: 1, soft: 4 },
]

const deptStatsData = [
  { dept: "CS", courses: 14, rooms: 8 },
  { dept: "SE", courses: 10, rooms: 6 },
  { dept: "DS", courses: 8, rooms: 5 },
  { dept: "IS", courses: 9, rooms: 5 },
  { dept: "CYS", courses: 7, rooms: 4 },
]

const optimizationProgressData = [
  { iteration: 0, gwo: 60, cbr: 58 },
  { iteration: 100, gwo: 72, cbr: 65 },
  { iteration: 200, gwo: 80, cbr: 70 },
  { iteration: 300, gwo: 85, cbr: 73 },
  { iteration: 400, gwo: 89, cbr: 75 },
  { iteration: 500, gwo: 91, cbr: 76 },
  { iteration: 600, gwo: 93, cbr: 77 },
  { iteration: 700, gwo: 94, cbr: 77 },
  { iteration: 800, gwo: 94.2, cbr: 77.5 },
]

const tabs = [
  { id: "room-utilization", label: "Room Usage" },
  { id: "weekly", label: "Weekly Dist." },
  { id: "trends", label: "Trends" },
  { id: "conflicts", label: "Conflicts" },
  { id: "departments", label: "Departments" },
  { id: "hourly", label: "Hourly Load" },
  { id: "optimization", label: "Optimization" },
]

export function AnalyticsOverview() {
  const [activeTab, setActiveTab] = useState("room-utilization")

  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="pb-3 pt-6 px-6">
        <CardTitle className="text-lg font-bold">Analytics Overview</CardTitle>
        <CardDescription className="text-sm">
          Scheduling performance metrics across all dimensions
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="flex flex-wrap gap-1 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="h-64">
          {activeTab === "room-utilization" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roomBarData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="room" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="utilization" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Utilization %" />
              </BarChart>
            </ResponsiveContainer>
          )}
          {activeTab === "weekly" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyDistExtended}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="classes" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Classes" />
                <Bar dataKey="rooms" fill="#10b981" radius={[4, 4, 0, 0]} name="Rooms Used" />
              </BarChart>
            </ResponsiveContainer>
          )}
          {activeTab === "trends" && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={semesterTrendsData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="semester" tick={{ fontSize: 10 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="students" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Students" />
                <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Score %" />
              </LineChart>
            </ResponsiveContainer>
          )}
          {activeTab === "conflicts" && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={conflictTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="hard" stroke="#ef4444" fill="#fef2f2" strokeWidth={2} name="Hard Conflicts" className="dark:fill-red-500/10" />
                <Area type="monotone" dataKey="soft" stroke="#f59e0b" fill="#fffbeb" strokeWidth={2} name="Soft Conflicts" className="dark:fill-amber-500/10" />
              </AreaChart>
            </ResponsiveContainer>
          )}
          {activeTab === "departments" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptStatsData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="dept" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="courses" fill="#6366f1" radius={[4, 4, 0, 0]} name="Courses" />
                <Bar dataKey="rooms" fill="#10b981" radius={[4, 4, 0, 0]} name="Rooms" />
              </BarChart>
            </ResponsiveContainer>
          )}
          {activeTab === "hourly" && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyLoadData}>
                <defs>
                  <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area type="monotone" dataKey="load" stroke="#3b82f6" fill="url(#loadGrad)" strokeWidth={2} name="Classes" />
              </AreaChart>
            </ResponsiveContainer>
          )}
          {activeTab === "optimization" && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={optimizationProgressData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="iteration" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} domain={[55, 100]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="gwo" stroke="#3b82f6" strokeWidth={2} dot={false} name="GWO Score" />
                <Line type="monotone" dataKey="cbr" stroke="#10b981" strokeWidth={2} dot={false} name="CBR Baseline" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function RoomUtilizationChart() { return null }
export function WeeklyDistributionChart() { return null }
export function SemesterTrendChart() { return null }
export function DepartmentDistributionChart() { return null }
export function ConflictTypesChart() { return null }
export function HourlyLoadChart() { return null }
export function OptimizationScoreChart() { return null }
