"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Search, Book, MessageCircle, Video, FileText, ExternalLink, Mail, Phone } from "lucide-react"

const faqs = [
  {
    question: "How do I generate a new timetable?",
    answer:
      "Navigate to Timetable Generation from the sidebar. Configure your settings including semester, algorithm type, and constraints. Then click 'Start Generation' to begin the optimization process.",
  },
  {
    question: "What is the difference between CBR and GWO algorithms?",
    answer:
      "CBR (Case-Based Reasoning) generates initial solutions based on historical timetables. GWO (Grey Wolf Optimizer) is a meta-heuristic optimization algorithm that improves solutions by minimizing conflicts. The hybrid approach uses both for optimal results.",
  },
  {
    question: "How do I resolve scheduling conflicts?",
    answer:
      "Go to the What-If Scenarios page to explore different configurations. You can also manually adjust schedules in the Schedule Viewer by clicking on entries and editing their time slots or rooms.",
  },
  {
    question: "Can I export the timetable to Excel?",
    answer:
      "Yes! Go to Schedule Viewer and click the 'Export' button. You can choose between PDF and Excel formats. For more detailed reports, visit the Reports page.",
  },
  {
    question: "How do I add a new course or lecturer?",
    answer:
      "Navigate to Entity Management in the sidebar and select the appropriate category (Courses, Lecturers, etc.). Click 'Add' and fill in the required information.",
  },
  {
    question: "What do the different conflict severity levels mean?",
    answer:
      "High severity conflicts are hard constraint violations (e.g., double-booked rooms). Medium severity are soft constraint violations that should be addressed. Low severity are recommendations for optimization.",
  },
]

const guides = [
  { title: "Getting Started Guide", icon: Book, type: "PDF", size: "2.4 MB" },
  { title: "Algorithm Configuration", icon: FileText, type: "PDF", size: "1.8 MB" },
  { title: "Video Tutorial: Basic Usage", icon: Video, type: "Video", size: "15 min" },
  { title: "Advanced Constraints Setup", icon: FileText, type: "PDF", size: "3.1 MB" },
]

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-balance">Help & Support</h1>
            <p className="text-muted-foreground">Find answers, guides, and contact support.</p>
          </div>

          {/* Search */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search for help..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* FAQs */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Frequently Asked Questions</CardTitle>
                  <CardDescription>Quick answers to common questions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {filteredFaqs.map((faq, index) => (
                      <AccordionItem key={index} value={`item-${index}`}>
                        <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  {filteredFaqs.length === 0 && (
                    <p className="py-8 text-center text-muted-foreground">
                      No results found for &quot;{searchQuery}&quot;
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Documentation */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Documentation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {guides.map((guide, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <guide.icon className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{guide.title}</p>
                          <p className="text-xs text-muted-foreground">{guide.size}</p>
                        </div>
                      </div>
                      <Badge variant="secondary">{guide.type}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Contact Support */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contact Support</CardTitle>
                  <CardDescription>Need more help? Reach out to us.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Email Support</p>
                      <p className="text-sm text-muted-foreground">support@psut.edu.jo</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Phone Support</p>
                      <p className="text-sm text-muted-foreground">+962 6 534 1234</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MessageCircle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Live Chat</p>
                      <p className="text-sm text-muted-foreground">Available 8AM - 5PM</p>
                    </div>
                  </div>

                  <Button className="w-full">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Start Live Chat
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="ghost" className="w-full justify-start">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    PSUT Official Website
                  </Button>
                  <Button variant="ghost" className="w-full justify-start">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    IT Department Portal
                  </Button>
                  <Button variant="ghost" className="w-full justify-start">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Release Notes
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
