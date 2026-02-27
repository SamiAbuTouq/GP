"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useTheme } from "next-themes"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Save, User, Bell, Globe, Shield, Database, Upload, RotateCw, ZoomIn, ZoomOut, Check, Sun, Moon, Monitor, Camera, Palette, SlidersHorizontal } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

function AvatarCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageSrc: string
  onCropComplete: (croppedImage: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState([1])
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const imageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!imageSrc || !open) return
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      imageRef.current = img
      setOffset({ x: 0, y: 0 })
      setZoom([1])
      setRotation(0)
    }
    img.src = imageSrc
  }, [imageSrc, open])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const size = 280
    canvas.width = size
    canvas.height = size
    ctx.clearRect(0, 0, size, size)
    ctx.save()
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.translate(size / 2 + offset.x, size / 2 + offset.y)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(zoom[0], zoom[0])
    const scale = Math.max(size / img.width, size / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, -w / 2, -h / 2, w, h)
    ctx.restore()
  }, [zoom, rotation, offset])

  useEffect(() => { drawCanvas() }, [drawCanvas])

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }
  const handleMouseUp = () => setDragging(false)
  const handleCrop = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    onCropComplete(canvas.toDataURL("image/png"))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crop Avatar</DialogTitle>
          <DialogDescription>Drag to position, zoom and rotate your image.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div
            className="relative rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/30 cursor-move"
            style={{ width: 280, height: 280 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <canvas ref={canvasRef} width={280} height={280} className="w-full h-full" />
          </div>
          <div className="flex items-center gap-4 w-full max-w-xs">
            <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider value={zoom} onValueChange={setZoom} min={0.5} max={3} step={0.05} className="flex-1" />
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setRotation((r) => r + 90)} className="gap-2">
            <RotateCw className="h-4 w-4" />
            Rotate 90
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCrop} className="gap-2"><Check className="h-4 w-4" />Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const settingsTabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "system", label: "System", icon: Database },
]

export default function SettingsPage() {
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [tempImageSrc, setTempImageSrc] = useState("")

  useEffect(() => { setMounted(true) }, [])

  const [profile, setProfile] = useState({
    name: "Admin User",
    email: "admin@psut.edu.jo",
    role: "Admin",
    department: "Computer Science",
    phone: "+962 6 515 xxxx",
    location: "Amman, Jordan",
  })

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    conflictNotifications: true,
    generationComplete: true,
    weeklyReports: false,
  })

  const [preferences, setPreferences] = useState({
    language: "english",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24",
  })



  const handleSave = () => {
    toast({ title: "Settings saved", description: "Your preferences have been updated successfully." })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 2MB.", variant: "destructive" })
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setTempImageSrc(ev.target?.result as string)
      setCropDialogOpen(true)
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleCropComplete = (croppedImage: string) => {
    setAvatarSrc(croppedImage)
    toast({ title: "Avatar updated", description: "Your profile photo has been updated." })
  }

  const currentTheme = mounted ? theme : "light"

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-balance">Settings</h1>
            <p className="text-muted-foreground">Manage your account and system preferences</p>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Left Sidebar Navigation */}
            <Card className="lg:w-64 shrink-0">
              <CardContent className="p-2">
                <nav className="flex flex-row lg:flex-col gap-1">
                  {settingsTabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors w-full text-left ${
                          activeTab === tab.id
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    )
                  })}
                </nav>
              </CardContent>
            </Card>

            {/* Right Content Area */}
            <div className="flex-1 min-w-0">
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Update your personal information and role details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        {avatarSrc ? (
                          <img src={avatarSrc} alt="Avatar" className="h-20 w-20 rounded-full object-cover border-2 border-border" />
                        ) : (
                          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                            AU
                          </div>
                        )}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted hover:bg-accent transition-colors"
                        >
                          <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={handleFileSelect} />
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-4 w-4" />
                          Change Avatar
                        </Button>
                        <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select value={profile.role} onValueChange={(v) => setProfile({ ...profile, role: v })}>
                          <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="Scheduler">Scheduler</SelectItem>
                            <SelectItem value="Viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Select value={profile.department} onValueChange={(v) => setProfile({ ...profile, department: v })}>
                          <SelectTrigger id="department"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Computer Science">Computer Science</SelectItem>
                            <SelectItem value="Software Engineering">Software Engineering</SelectItem>
                            <SelectItem value="Data Science">Data Science</SelectItem>
                            <SelectItem value="Registrar Office">Registrar Office</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input id="location" value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} />
                      </div>
                    </div>

                    <Button onClick={handleSave}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Preferences Tab */}
              {activeTab === "preferences" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Application Preferences</CardTitle>
                    <CardDescription>Customize how the application looks and behaves.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Theme</Label>
                        <Select value={currentTheme} onValueChange={(v) => setTheme(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="system">
                              <span className="flex items-center gap-2"><Monitor className="h-4 w-4" />System</span>
                            </SelectItem>
                            <SelectItem value="light">
                              <span className="flex items-center gap-2"><Sun className="h-4 w-4" />Light</span>
                            </SelectItem>
                            <SelectItem value="dark">
                              <span className="flex items-center gap-2"><Moon className="h-4 w-4" />Dark</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Language</Label>
                        <Select value={preferences.language} onValueChange={(v) => setPreferences({ ...preferences, language: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="english">English</SelectItem>
                            <SelectItem value="arabic">Arabic</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Date Format</Label>
                        <Select value={preferences.dateFormat} onValueChange={(v) => setPreferences({ ...preferences, dateFormat: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                            <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Time Format</Label>
                        <Select value={preferences.timeFormat} onValueChange={(v) => setPreferences({ ...preferences, timeFormat: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="24">24 Hour</SelectItem>
                            <SelectItem value="12">12 Hour</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={handleSave}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Preferences
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Notifications Tab */}
              {activeTab === "notifications" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>Choose what notifications you want to receive.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      {[
                        { key: "emailAlerts" as const, label: "Email Alerts", desc: "Receive important alerts via email" },
                        { key: "conflictNotifications" as const, label: "Conflict Notifications", desc: "Get notified when conflicts are detected" },
                        { key: "generationComplete" as const, label: "Generation Complete", desc: "Notify when timetable generation finishes" },
                        { key: "weeklyReports" as const, label: "Weekly Reports", desc: "Receive weekly summary reports" },
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <Label>{item.label}</Label>
                            <p className="text-sm text-muted-foreground">{item.desc}</p>
                          </div>
                          <Switch
                            checked={notifications[item.key]}
                            onCheckedChange={(v) => setNotifications({ ...notifications, [item.key]: v })}
                          />
                        </div>
                      ))}
                    </div>
                    <Button onClick={handleSave}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Preferences
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Security Tab */}
              {activeTab === "security" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Security Settings</CardTitle>
                    <CardDescription>Manage your password and security preferences.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <Input id="current-password" type="password" />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="new-password">New Password</Label>
                          <Input id="new-password" type="password" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">Confirm Password</Label>
                          <Input id="confirm-password" type="password" />
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="font-medium">Two-Factor Authentication</h4>
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <Label>Enable 2FA</Label>
                          <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                        </div>
                        <Switch />
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="font-medium">Sessions</h4>
                      <div className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">Current Session</p>
                            <p className="text-xs text-muted-foreground">Chrome on Windows - Active now</p>
                          </div>
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Active</Badge>
                        </div>
                      </div>
                    </div>
                    <Button onClick={handleSave}>
                      <Save className="mr-2 h-4 w-4" />
                      Update Security
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* System Tab */}
              {activeTab === "system" && (
                <Card>
                  <CardHeader>
                    <CardTitle>System Configuration</CardTitle>
                    <CardDescription>Configure system-wide settings for the timetabling system.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Default Semester Duration</Label>
                        <Select defaultValue="16">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="14">14 Weeks</SelectItem>
                            <SelectItem value="15">15 Weeks</SelectItem>
                            <SelectItem value="16">16 Weeks</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Class Duration</Label>
                        <Select defaultValue="90">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="50">50 Minutes</SelectItem>
                            <SelectItem value="75">75 Minutes</SelectItem>
                            <SelectItem value="90">90 Minutes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Max GWO Iterations</Label>
                        <Input type="number" defaultValue="1000" />
                      </div>
                      <div className="space-y-2">
                        <Label>CBR Similarity Threshold</Label>
                        <Input type="number" defaultValue="0.8" step="0.1" />
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="font-medium">Database</h4>
                      <div className="rounded-lg border p-4 bg-muted/50">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Status</p>
                            <p className="font-medium text-emerald-600 dark:text-emerald-400">Connected</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Type</p>
                            <p className="font-medium text-foreground">PostgreSQL</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Last Backup</p>
                            <p className="font-medium text-foreground">2024-01-17 03:00</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Size</p>
                            <p className="font-medium text-foreground">245 MB</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button onClick={handleSave}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Configuration
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <AvatarCropDialog
            open={cropDialogOpen}
            onOpenChange={setCropDialogOpen}
            imageSrc={tempImageSrc}
            onCropComplete={handleCropComplete}
          />
        </main>
      </div>
    </div>
  )
}
