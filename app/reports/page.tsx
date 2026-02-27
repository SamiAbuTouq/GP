"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { FileText, CalendarIcon, Clock, FileSpreadsheet, Filter, Eye, Trash2 } from "lucide-react"
import { ExportIcon } from "@/components/custom-icons"
import { format } from "date-fns"

const reportTypes = [
 {
    id: "room-utilization",
    name: "Room Utilization Report",
    description: "Analyze room usage across all time slots",
    icon: FileText,
    format: ["PDF", "Excel", "CSV"],
  },
  {
    id: "lecturer-load",
    name: "Lecturer Workload Report",
    description: "Teaching hours distribution by faculty",
    icon: FileText,
    format: ["PDF", "Excel", "CSV"],
  },
  {
    id: "conflict-analysis",
    name: "Conflict Analysis Report",
    description: "Detailed breakdown of scheduling conflicts",
    icon: FileText,
    format: ["PDF", "Excel"],
  },
  {
    id: "student-schedule",
    name: "Student Schedule Report",
    description: "Individual or batch student timetables",
    icon: FileText,
    format: ["PDF", "Excel"],
  },
  {
    id: "course-distribution",
    name: "Course Distribution Report",
    description: "Course offerings by department and semester",
    icon: FileText,
    format: ["PDF", "Excel", "CSV"],
  },
  {
    id: "optimization-summary",
    name: "Optimization Summary Report",
    description: "CBR/GWO algorithm performance metrics",
    icon: FileText,
    format: ["PDF", "Excel"],
  },
]

const recentReports = [
  {
    id: 1,
    name: "Room Utilization - Fall 2024",
    type: "Room Utilization Report",
    generatedAt: "2024-01-17 10:30",
    format: "PDF",
    size: "245 KB",
  },
  {
    id: 2,
    name: "Lecturer Workload - Q1 2024",
    type: "Lecturer Workload Report",
    generatedAt: "2024-01-15 14:22",
    format: "Excel",
    size: "128 KB",
  },
  {
    id: 3,
    name: "Conflict Analysis - Week 3",
    type: "Conflict Analysis Report",
    generatedAt: "2024-01-12 09:15",
    format: "PDF",
    size: "89 KB",
  },
]

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerateReport = () => {
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      setSelectedReport(null)
    }, 2000)
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-balance">Reports</h1>
            <p className="text-muted-foreground">Generate and export scheduling reports and analytics.</p>
          </div>

          <Tabs defaultValue="generate" className="space-y-6">
            <TabsList>
              <TabsTrigger value="generate">Generate Report</TabsTrigger>
              <TabsTrigger value="recent">Recent Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="generate" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {reportTypes.map((report) => (
                  <Card
                    key={report.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${selectedReport === report.id ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setSelectedReport(report.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <report.icon className="h-8 w-8 text-primary" />
                        <div className="flex gap-1">
                          {report.format.map((f) => (
                            <Badge key={f} variant="secondary" className="text-xs">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <CardTitle className="text-lg">{report.name}</CardTitle>
                      <CardDescription>{report.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              {selectedReport && (
                <Card>
                  <CardHeader>
                    <CardTitle>Report Configuration</CardTitle>
                    <CardDescription>
                      Configure options for {reportTypes.find((r) => r.id === selectedReport)?.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Semester</Label>
                        <Select defaultValue="fall-2024">
                          <SelectTrigger>
                            <SelectValue placeholder="Select semester" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fall-2024">Fall 2024</SelectItem>
                            <SelectItem value="spring-2024">Spring 2024</SelectItem>
                            <SelectItem value="summer-2024">Summer 2024</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Date From</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal bg-transparent"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label>Date To</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal bg-transparent"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label>Export Format</Label>
                        <Select defaultValue="pdf">
                          <SelectTrigger>
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pdf">PDF</SelectItem>
                            <SelectItem value="excel">Excel</SelectItem>
                            <SelectItem value="csv">CSV</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {selectedReport === "room-utilization" && (
                      <div className="space-y-2">
                        <Label>Filter by Building</Label>
                        <Select defaultValue="all">
                          <SelectTrigger className="max-w-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Buildings</SelectItem>
                            <SelectItem value="building-a">Building A</SelectItem>
                            <SelectItem value="building-b">Building B</SelectItem>
                            <SelectItem value="building-c">Building C</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectedReport === "lecturer-load" && (
                      <div className="space-y-2">
                        <Label>Filter by Department</Label>
                        <Select defaultValue="all">
                          <SelectTrigger className="max-w-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            <SelectItem value="cs">Computer Science</SelectItem>
                            <SelectItem value="se">Software Engineering</SelectItem>
                            <SelectItem value="ds">Data Science</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button onClick={handleGenerateReport} disabled={isGenerating}>
                        {isGenerating ? (
                          <>
                            <Clock className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Generate Report
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={() => setSelectedReport(null)} className="bg-transparent">
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="recent" className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Recent Reports</CardTitle>
                    <CardDescription>Previously generated reports</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Filter reports..." className="max-w-xs" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentReports.map((report) => (
                      <div
                        key={report.id}
                        className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="rounded-lg bg-primary/10 p-2">
                            {report.format === "PDF" ? (
                              <FileText className="h-5 w-5 text-primary" />
                            ) : (
                              <FileSpreadsheet className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{report.name}</p>
                            <p className="text-sm text-muted-foreground">{report.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right text-sm">
                            <p>{report.generatedAt}</p>
                            <p className="text-muted-foreground">{report.size}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <ExportIcon className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
