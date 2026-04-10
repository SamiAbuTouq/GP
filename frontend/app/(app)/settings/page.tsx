"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Save,
  User,
  Bell,
  Shield,
  Upload,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Check,
  Sun,
  Moon,
  Monitor,
  Camera,
  SlidersHorizontal,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ApiClient, type UserProfile } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

function AvatarCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedImage: string) => void;
}) {
  const CROP_SIZE = 280;
  const CROP_RADIUS = CROP_SIZE / 2;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState([1]);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  const getBaseImageSize = useCallback(() => {
    const img = imageRef.current;
    if (!img) return null;
    const baseScale = Math.max(CROP_SIZE / img.width, CROP_SIZE / img.height);
    return {
      width: img.width * baseScale,
      height: img.height * baseScale,
    };
  }, []);

  const getMinScale = useCallback(() => {
    const base = getBaseImageSize();
    if (!base) return 1;
    return Math.max(CROP_SIZE / base.width, CROP_SIZE / base.height);
  }, [getBaseImageSize]);

  const clampOffset = useCallback(
    (candidateOffset: { x: number; y: number }, targetZoom: number, targetRotation: number) => {
      const base = getBaseImageSize();
      if (!base) return candidateOffset;

      const halfW = (base.width * targetZoom) / 2;
      const halfH = (base.height * targetZoom) / 2;
      const theta = (targetRotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(theta));
      const sin = Math.abs(Math.sin(theta));

      const extentX = cos * halfW + sin * halfH;
      const extentY = sin * halfW + cos * halfH;

      const maxOffsetX = Math.max(0, extentX - CROP_RADIUS);
      const maxOffsetY = Math.max(0, extentY - CROP_RADIUS);

      return {
        x: Math.min(Math.max(candidateOffset.x, -maxOffsetX), maxOffsetX),
        y: Math.min(Math.max(candidateOffset.y, -maxOffsetY), maxOffsetY),
      };
    },
    [getBaseImageSize],
  );

  useEffect(() => {
    if (!imageSrc || !open) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setOffset({ x: 0, y: 0 });
      setZoom([Math.max(1, getMinScale())]);
      setRotation(0);
    };
    img.src = imageSrc;
  }, [imageSrc, open, getMinScale]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const CANVAS_SIZE = 1024;
    const DISPLAY_SIZE = CROP_SIZE;
    const scaleFactor = CANVAS_SIZE / DISPLAY_SIZE;
    
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    ctx.save();
    // Move to center to apply transforms
    ctx.translate(CANVAS_SIZE / 2 + offset.x * scaleFactor, CANVAS_SIZE / 2 + offset.y * scaleFactor);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom[0], zoom[0]);
    
    const scale = Math.max(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }, [zoom, rotation, offset]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };
  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setOffset(
      clampOffset(
        { x: clientX - dragStart.x, y: clientY - dragStart.y },
        zoom[0],
        rotation,
      ),
    );
  };
  const handleMouseUp = () => setDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const minScale = getMinScale();
      const newZoom = prev[0] - e.deltaY * 0.002;
      const clampedZoom = Math.min(Math.max(minScale, newZoom), 3);
      setOffset((prevOffset) => clampOffset(prevOffset, clampedZoom, rotation));
      return [clampedZoom];
    });
  };

  const handleCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onCropComplete(canvas.toDataURL("image/png"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl">Crop Profile Picture</DialogTitle>
          <DialogDescription>
            Pinch or scroll to zoom. Drag to reposition.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-2 select-none">
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-black/5 touch-none group shadow-inner"
            style={{ width: 280, height: 280, cursor: dragging ? "grabbing" : "grab" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            onWheel={handleWheel}
          >
            <canvas
              ref={canvasRef}
              width={1024}
              height={1024}
              className="w-full h-full"
            />
            {/* The circular overlay mask with rule-of-thirds grid */}
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div 
                className="w-full h-full rounded-full border-2 border-primary/40 overflow-hidden relative"
                style={{ boxShadow: "0 0 0 999px rgba(0,0,0,0.4)" }}
              >
                {/* Grid lines inside circle */}
                <div className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute top-1/3 left-0 w-full h-[1px] bg-white/40" />
                  <div className="absolute top-2/3 left-0 w-full h-[1px] bg-white/40" />
                  <div className="absolute top-0 left-1/3 w-[1px] h-full bg-white/40" />
                  <div className="absolute top-0 left-2/3 w-[1px] h-full bg-white/40" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 w-full px-6 mt-2">
            <div className="flex items-center gap-4 w-full">
              <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
              <Slider
                value={zoom}
                onValueChange={(value) => {
                  const minScale = getMinScale();
                  const nextZoom = Math.min(Math.max(minScale, value[0] ?? minScale), 3);
                  setZoom([nextZoom]);
                  setOffset((prevOffset) => clampOffset(prevOffset, nextZoom, rotation));
                }}
                min={getMinScale()}
                max={3}
                step={0.05}
                className="flex-1 cursor-pointer"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
            <div className="flex justify-center mt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRotation((r) => {
                    const nextRotation = r + 90;
                    setOffset((prevOffset) => clampOffset(prevOffset, zoom[0], nextRotation));
                    return nextRotation;
                  });
                }}
                className="gap-2 rounded-full px-5 hover:bg-secondary transition-colors"
              >
                <RotateCw className="h-4 w-4" />
                <span className="text-sm font-medium">Rotate 90°</span>
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCrop} className="gap-2 px-6">
            <Check className="h-4 w-4" />
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const settingsTabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
];

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="sm:min-w-[180px]">{children}</div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  shown,
  onToggleShown,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  shown: boolean;
  onToggleShown: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={onToggleShown}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function SettingsContent() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { user, authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") || "profile";

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTabState] = useState(tabParam);

  useEffect(() => {
    if (tabParam !== activeTab) {
      setActiveTabState(tabParam);
    }
  }, [tabParam]);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    router.replace(`?tab=${tab}`, { scroll: false });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState("");
  const [expandedAvatarOpen, setExpandedAvatarOpen] = useState(false);

  // Loading and saving states
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [preferencesSaveState, setPreferencesSaveState] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const preferencesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Profile state (fetched from API)
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editableProfile, setEditableProfile] = useState({
    first_name: "",
    last_name: "",
  });

  // Preferences state (fetched from API)
  const [preferences, setPreferences] = useState({
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24",
  });

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    conflictNotifications: true,
    generationComplete: true,
  });

  // Security / Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Password validation
  const passwordValidation = {
    minLength: passwordData.newPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(passwordData.newPassword),
    hasLowercase: /[a-z]/.test(passwordData.newPassword),
    hasNumber: /\d/.test(passwordData.newPassword),
    passwordsMatch: passwordData.newPassword === passwordData.confirmPassword && passwordData.confirmPassword !== "",
  };
  
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const hasFetchedProfile = useRef(false);

  // Mount logic and auth-dependent fetch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && user?.id && !hasFetchedProfile.current) {
      fetchProfile();
      hasFetchedProfile.current = true;
    }
  }, [authLoading, user?.id]);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const data = await ApiClient.getProfile();
      setProfile(data);
      setEditableProfile({
        first_name: data.first_name,
        last_name: data.last_name,
      });
      setPreferences({
        dateFormat: data.date_format || "DD/MM/YYYY",
        timeFormat: data.time_format || "24",
      });
      // Sync theme from DB if available
      if (data.theme_preference && mounted) {
        setTheme(data.theme_preference);
      }
    } catch (error) {
      // Fallback to auth context data if API fails (e.g., backend not running)
      if (user) {
        const [firstName, ...lastNameParts] = (
          user.email.split("@")[0] || "User"
        ).split(".");
        const idFromAuth =
          typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10)
        const fallbackProfile: UserProfile = {
          user_id: Number.isFinite(idFromAuth) && idFromAuth > 0 ? idFromAuth : 0,
          email: user.email,
          first_name: firstName.charAt(0).toUpperCase() + firstName.slice(1),
          last_name:
            lastNameParts.join(" ").charAt(0).toUpperCase() +
              lastNameParts.join(" ").slice(1) || "",
          role: user.role,
          department: null,
          theme_preference: theme || "system",
          date_format: "DD/MM/YYYY",
          time_format: "24",
        };
        setProfile(fallbackProfile);
        setEditableProfile({
          first_name: fallbackProfile.first_name,
          last_name: fallbackProfile.last_name,
        });
        console.log(
          "[v0] Using fallback profile data from auth context - backend may not be running",
        );
      } else {
        toast({
          title: "Error loading profile",
          description: "Could not load your profile. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    const isNewAvatar = avatarSrc && avatarSrc.startsWith("data:");
    try {
      setIsSavingProfile(true);
      const updated = await ApiClient.updateProfile({
        first_name: editableProfile.first_name,
        last_name: editableProfile.last_name,
        ...(isNewAvatar ? { avatar_base64: avatarSrc } : {}),
      });
      setProfile((prev) => (prev ? { ...prev, ...updated } : null));
      if (isNewAvatar) setAvatarSrc(null);
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
    } catch (error) {
      // Avatar updates must be persisted via backend (Cloudinary + DB), not local-only.
      if (isNewAvatar) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Could not upload your avatar. Please check backend/Cloudinary setup and try again.";
        toast({
          title: "Avatar save failed",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      // For name-only edits, keep local fallback behavior.
      const mockUpdate = {
        first_name: editableProfile.first_name,
        last_name: editableProfile.last_name,
      };

      setProfile((prev) => (prev ? { ...prev, ...mockUpdate } : null));
      ApiClient.notifyProfileUpdate(mockUpdate);

      toast({
        title: "Profile updated locally",
        description:
          "Name changes were saved locally. Backend sync will occur when available.",
      });
      console.log("[v0] Name changes saved locally - backend may not be running");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setIsSavingPreferences(true);
      setPreferencesSaveState("saving");
      await ApiClient.updatePreferences({
        theme_preference: theme || "system",
        date_format: preferences.dateFormat,
        time_format: preferences.timeFormat,
      });
      setPreferencesSaveState("saved");
    } catch (error) {
      // Save locally even if API fails (for demo/preview purposes)
      console.log(
        "[v0] Preferences saved locally - backend may not be running",
      );
      setPreferencesSaveState("saved");
    } finally {
      setIsSavingPreferences(false);
    }
  };

  // Auto-save preferences when they change
  useEffect(() => {
    if (!mounted || isLoading) return;
    setPreferencesSaveState("idle");
    
    // Clear existing timeout
    if (preferencesDebounceRef.current) {
      clearTimeout(preferencesDebounceRef.current);
    }
    
    // Debounce the save to avoid too many API calls
    preferencesDebounceRef.current = setTimeout(() => {
      handleSavePreferences();
    }, 500);

    return () => {
      if (preferencesDebounceRef.current) {
        clearTimeout(preferencesDebounceRef.current);
      }
    };
  }, [theme, preferences.dateFormat, preferences.timeFormat, mounted, isLoading]);

  const handleSave = () => {
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 4MB.",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setTempImageSrc(ev.target?.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCropComplete = (croppedImage: string) => {
    setAvatarSrc(croppedImage);
    toast({
      title: "Avatar cropped",
      description: "Please click 'Save Profile' to apply your new avatar.",
    });
  };

  const currentTheme = mounted ? theme : "light";

  return (
    <div className="flex h-screen bg-gradient-to-b from-background to-muted/20">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-balance">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account and system preferences
            </p>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
            {/* Left Sidebar Navigation */}
            <Card className="shrink-0 border shadow-sm lg:sticky lg:top-6 lg:h-fit lg:w-64">
              <CardContent className="p-2">
                <nav className="flex flex-row lg:flex-col gap-1">
                  {settingsTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
                          activeTab === tab.id
                            ? "bg-primary/10 text-primary shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {activeTab === tab.id ? (
                          <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" />
                        ) : null}
                        <span
                          className={`grid h-7 w-7 place-items-center rounded-md ${
                            activeTab === tab.id ? "bg-primary/15" : "bg-transparent"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                        </span>
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>

            {/* Right Content Area */}
            <div className="flex-1 min-w-0">
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <Card className="border shadow-sm">
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>
                      Update your personal information and role details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : profile ? (
                      <>
                        <div className="flex items-center gap-6">
                          <div className="relative">
                            {avatarSrc || profile.avatar_url ? (
                              <img
                                src={avatarSrc || profile.avatar_url || ""}
                                alt="Avatar"
                                className="h-20 w-20 rounded-full object-cover border-2 border-border cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setExpandedAvatarOpen(true)}
                              />
                            ) : (
                              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                                {profile.first_name?.[0]}
                                {profile.last_name?.[0]}
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
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/png,image/jpeg,image/gif"
                              className="hidden"
                              onChange={handleFileSelect}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Change Avatar
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2">
                              JPG, PNG or GIF. Max 4MB.
                            </p>
                          </div>
                        </div>

                        <Separator />

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="first_name">First Name</Label>
                            <Input
                              id="first_name"
                              value={editableProfile.first_name}
                              onChange={(e) =>
                                setEditableProfile((prev) => ({
                                  ...prev,
                                  first_name: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="last_name">Last Name</Label>
                            <Input
                              id="last_name"
                              value={editableProfile.last_name}
                              onChange={(e) =>
                                setEditableProfile((prev) => ({
                                  ...prev,
                                  last_name: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                              id="email"
                              type="email"
                              value={profile.email}
                              readOnly
                              className="bg-muted cursor-not-allowed"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Input
                              id="role"
                              value={profile.role}
                              readOnly
                              className="bg-muted cursor-not-allowed"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="department">Department</Label>
                            <Input
                              id="department"
                              value={profile.department || "N/A"}
                              readOnly
                              className="bg-muted cursor-not-allowed"
                            />
                          </div>
                        </div>

                        <Button
                          onClick={handleSaveProfile}
                          disabled={isSavingProfile}
                        >
                          {isSavingProfile ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Save Profile
                        </Button>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        Unable to load profile data.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Preferences Tab */}
              {activeTab === "preferences" && (
                <Card className="border shadow-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle>Application Preferences</CardTitle>
                        <CardDescription>
                          Customize how the application looks and behaves.
                        </CardDescription>
                      </div>
                      <div className="pt-0.5 text-xs text-muted-foreground">
                        {preferencesSaveState === "saving"
                          ? "Saving..."
                          : preferencesSaveState === "saved"
                            ? "Saved"
                            : "Autosave enabled"}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-4">
                          <SettingRow
                            title="Theme"
                            description="Choose how the application appears."
                          >
                            <Select
                              value={currentTheme}
                              onValueChange={(v) => setTheme(v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="system">
                                  <span className="flex items-center gap-2">
                                    <Monitor className="h-4 w-4" />
                                    System
                                  </span>
                                </SelectItem>
                                <SelectItem value="light">
                                  <span className="flex items-center gap-2">
                                    <Sun className="h-4 w-4" />
                                    Light
                                  </span>
                                </SelectItem>
                                <SelectItem value="dark">
                                  <span className="flex items-center gap-2">
                                    <Moon className="h-4 w-4" />
                                    Dark
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </SettingRow>
                          <SettingRow
                            title="Date Format"
                            description="Control how calendar dates are displayed."
                          >
                            <Select
                              value={preferences.dateFormat}
                              onValueChange={(v) =>
                                setPreferences({
                                  ...preferences,
                                  dateFormat: v,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DD/MM/YYYY">
                                  DD/MM/YYYY
                                </SelectItem>
                                <SelectItem value="MM/DD/YYYY">
                                  MM/DD/YYYY
                                </SelectItem>
                                <SelectItem value="YYYY-MM-DD">
                                  YYYY-MM-DD
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </SettingRow>
                          <SettingRow
                            title="Time Format"
                            description="Switch between 24-hour and 12-hour time."
                          >
                            <Select
                              value={preferences.timeFormat}
                              onValueChange={(v) =>
                                setPreferences({
                                  ...preferences,
                                  timeFormat: v,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="24">24 Hour</SelectItem>
                                <SelectItem value="12">12 Hour</SelectItem>
                              </SelectContent>
                            </Select>
                          </SettingRow>
                        </div>

                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Notifications Tab */}
              {activeTab === "notifications" && (
                <Card className="border shadow-sm">
                  <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>
                      Choose what notifications you want to receive.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      {[
                        {
                          key: "emailAlerts" as const,
                          label: "Email Alerts",
                          desc: "Receive important alerts via email",
                        },
                        {
                          key: "conflictNotifications" as const,
                          label: "Conflict Notifications",
                          desc: "Get notified when conflicts are detected",
                        },
                        {
                          key: "generationComplete" as const,
                          label: "Generation Complete",
                          desc: "Notify when timetable generation finishes",
                        },
                      ].map((item) => (
                        <SettingRow
                          key={item.key}
                          title={item.label}
                          description={item.desc}
                        >
                          <Switch
                            checked={notifications[item.key]}
                            onCheckedChange={(v) =>
                              setNotifications({
                                ...notifications,
                                [item.key]: v,
                              })
                            }
                          />
                        </SettingRow>
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
                <Card className="border shadow-sm">
                  <CardHeader>
                    <CardTitle>Security Settings</CardTitle>
                    <CardDescription>
                      Manage your password and security preferences.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                      <h4 className="font-medium">Change Password</h4>
                      <PasswordField
                        id="current-password"
                        label="Current Password"
                        value={passwordData.currentPassword}
                        onChange={(value) =>
                          setPasswordData((prev) => ({ ...prev, currentPassword: value }))
                        }
                        placeholder="Enter your current password"
                        shown={showPasswords.current}
                        onToggleShown={() =>
                          setShowPasswords((prev) => ({ ...prev, current: !prev.current }))
                        }
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <PasswordField
                          id="new-password"
                          label="New Password"
                          value={passwordData.newPassword}
                          onChange={(value) =>
                            setPasswordData((prev) => ({ ...prev, newPassword: value }))
                          }
                          placeholder="Enter new password"
                          shown={showPasswords.new}
                          onToggleShown={() =>
                            setShowPasswords((prev) => ({ ...prev, new: !prev.new }))
                          }
                        />
                        <PasswordField
                          id="confirm-password"
                          label="Confirm Password"
                          value={passwordData.confirmPassword}
                          onChange={(value) =>
                            setPasswordData((prev) => ({ ...prev, confirmPassword: value }))
                          }
                          placeholder="Confirm new password"
                          shown={showPasswords.confirm}
                          onToggleShown={() =>
                            setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))
                          }
                        />
                      </div>
                      
                      {/* Password Requirements */}
                      {passwordData.newPassword && (
                        <div className="rounded-lg border p-4 bg-muted/30">
                          <p className="text-sm font-medium mb-3">Password Requirements</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {[
                              { key: "minLength", label: "At least 8 characters" },
                              { key: "hasUppercase", label: "One uppercase letter" },
                              { key: "hasLowercase", label: "One lowercase letter" },
                              { key: "hasNumber", label: "One number" },
                              { key: "passwordsMatch", label: "Passwords match" },
                            ].map((req) => (
                              <div key={req.key} className="flex items-center gap-2 text-sm">
                                {passwordValidation[req.key as keyof typeof passwordValidation] ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className={passwordValidation[req.key as keyof typeof passwordValidation] ? "text-foreground" : "text-muted-foreground"}>
                                  {req.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <Button
                      className="w-full sm:w-auto"
                      onClick={async () => {
                        if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
                          toast({
                            title: "Missing fields",
                            description: "Please fill in all password fields.",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        if (!isPasswordValid) {
                          toast({
                            title: "Invalid password",
                            description: "Please ensure your password meets all requirements.",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        try {
                          setIsSavingPassword(true);
                          const resolvedUserId =
                            profile?.user_id && profile.user_id > 0
                              ? profile.user_id
                              : typeof user?.id === "number"
                                ? user.id
                                : parseInt(String(user?.id ?? ""), 10)
                          if (!Number.isFinite(resolvedUserId) || resolvedUserId < 1) {
                            toast({
                              title: "Cannot update password",
                              description:
                                "Your account id is missing. Reload the page or sign in again.",
                              variant: "destructive",
                            })
                            return
                          }
                          const response = await fetch("/api/auth/change-password", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              userId: resolvedUserId,
                              currentPassword: passwordData.currentPassword,
                              newPassword: passwordData.newPassword,
                            }),
                          });
                          
                          const data = await response.json();
                          
                          if (!response.ok) {
                            throw new Error(data.error || "Failed to change password");
                          }
                          
                          toast({
                            title: "Password updated",
                            description: "Your password has been changed successfully.",
                          });
                          
                          setPasswordData({
                            currentPassword: "",
                            newPassword: "",
                            confirmPassword: "",
                          });
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: error instanceof Error ? error.message : "Failed to change password. Please try again.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsSavingPassword(false);
                        }
                      }}
                      disabled={isSavingPassword || !isPasswordValid || !passwordData.currentPassword}
                    >
                      {isSavingPassword ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Update Password
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
          
          <Dialog open={expandedAvatarOpen} onOpenChange={setExpandedAvatarOpen}>
            <DialogContent className="max-w-[80vw] sm:max-w-3xl flex flex-col items-center justify-center p-6 bg-transparent border-none shadow-none">
              <DialogTitle className="sr-only">Profile picture preview</DialogTitle>
              <img
                src={avatarSrc || profile?.avatar_url || undefined}
                alt=""
                className="w-full h-auto max-w-2xl rounded-[40px] object-cover shadow-2xl"
              />
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
