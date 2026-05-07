"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  Suspense,
} from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ApiClient, type UserProfile } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  ADMIN_NOTIFICATION_PREF_KEYS,
  LECTURER_NOTIFICATION_PREF_KEYS,
  defaultNotificationPrefsMerged,
} from "@/lib/notification-prefs";
import { cn } from "@/lib/utils";

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

type NotificationPrefRowDef = {
  key: string;
  title: string;
  description: string;
};

const ADMIN_NOTIFICATION_PREF_ROWS: NotificationPrefRowDef[] = [
  {
    key: ADMIN_NOTIFICATION_PREF_KEYS.GWO_BROWSER_COMPLETED,
    title: "Browser generation finished",
    description:
      "When the Grey Wolf optimizer completes on the Timetable generation page (in-memory result; save separately to store in the database).",
  },
  {
    key: ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_COMPLETED,
    title: "Timetable saved or simulation finished",
    description:
      "When a timetable is saved to the database from the app, or a What-If scenario run completes successfully.",
  },
  {
    key: ADMIN_NOTIFICATION_PREF_KEYS.HARD_CONFLICTS,
    title: "Hard conflicts detected",
    description: "When validation reports hard conflicts in a generated or saved timetable.",
  },
  {
    key: ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_FAILED,
    title: "Optimization or run failures",
    description:
      "When the browser optimizer, Python runner, or a What-If scenario reports a failure (excluding your own cancel).",
  },
  {
    key: ADMIN_NOTIFICATION_PREF_KEYS.LECTURER_PREFERENCES,
    title: "Lecturer preferences submitted",
    description: "When a lecturer submits or updates their time preferences.",
  },
  {
    key: ADMIN_NOTIFICATION_PREF_KEYS.ACCESS_REQUESTS,
    title: "Lecturer access requests",
    description: "When someone submits a new lecturer access request.",
  },
  {
    key: ADMIN_NOTIFICATION_PREF_KEYS.LECTURER_DEACTIVATION_IMPACT,
    title: "Lecturer deactivation — schedule impact",
    description:
      "When a lecturer is deactivated and still had sections assigned on timetables (may need rescheduling).",
  },
];

const LECTURER_NOTIFICATION_PREF_ROWS: NotificationPrefRowDef[] = [
  {
    key: LECTURER_NOTIFICATION_PREF_KEYS.SCHEDULE_PUBLISHED,
    title: "Schedule published",
    description: "Get notified when a new timetable that includes you is published.",
  },
  {
    key: LECTURER_NOTIFICATION_PREF_KEYS.SCHEDULE_REVISED,
    title: "Schedule revised",
    description: "Get notified when a published timetable you are part of gets updated.",
  },
  {
    key: LECTURER_NOTIFICATION_PREF_KEYS.PROFILE_UPDATED_BY_ADMIN,
    title: "Profile updated by admin",
    description: "Get notified when an admin makes changes to your account.",
  },
];

function SettingsTabHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <CardHeader>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription className="mt-1.5 text-pretty max-w-2xl">
            {description}
          </CardDescription>
        </div>
        {aside ? (
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
            {aside}
          </div>
        ) : null}
      </div>
    </CardHeader>
  );
}

function SettingRow({
  title,
  description,
  children,
  controlClassName,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  controlClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className={cn("sm:min-w-[180px]", controlClassName)}>{children}</div>
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
  const [notificationPrefsSaveState, setNotificationPrefsSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const preferencesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationPrefsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationPrefsBaselineRef = useRef<string>(
    JSON.stringify(defaultNotificationPrefsMerged(null)),
  );

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

  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>(() =>
    defaultNotificationPrefsMerged(null),
  );

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
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

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

  const notificationPrefRows = useMemo(() => {
    if (profile?.role === "ADMIN") return ADMIN_NOTIFICATION_PREF_ROWS;
    return LECTURER_NOTIFICATION_PREF_ROWS;
  }, [profile?.role]);

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
      const np = defaultNotificationPrefsMerged(data.notification_preferences ?? null);
      setNotificationPrefs(np);
      notificationPrefsBaselineRef.current = JSON.stringify(np);
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
        const fallbackNp = defaultNotificationPrefsMerged(null);
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
          notification_preferences: fallbackNp,
        };
        setProfile(fallbackProfile);
        setNotificationPrefs(fallbackNp);
        notificationPrefsBaselineRef.current = JSON.stringify(fallbackNp);
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
      ApiClient.notifyProfileUpdate({
        theme_preference: theme || "system",
        date_format: preferences.dateFormat,
        time_format: preferences.timeFormat,
      });
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

  const handleSaveNotificationPrefs = useCallback(async () => {
    try {
      setNotificationPrefsSaveState("saving");
      const { notification_preferences } =
        await ApiClient.updateNotificationPreferences(notificationPrefs);
      setNotificationPrefs(notification_preferences);
      notificationPrefsBaselineRef.current = JSON.stringify(notification_preferences);
      setProfile((prev) =>
        prev ? { ...prev, notification_preferences } : null,
      );
      setNotificationPrefsSaveState("saved");
    } catch {
      setNotificationPrefsSaveState("error");
      toast({
        title: "Could not save notification preferences",
        description: "Check your connection and try toggling again. Your choices stay on screen until they sync.",
        variant: "destructive",
      });
    }
  }, [notificationPrefs, toast]);

  useEffect(() => {
    if (!mounted || isLoading) return;
    const serialized = JSON.stringify(notificationPrefs);
    if (serialized === notificationPrefsBaselineRef.current) return;

    setNotificationPrefsSaveState("idle");
    if (notificationPrefsDebounceRef.current) {
      clearTimeout(notificationPrefsDebounceRef.current);
    }
    notificationPrefsDebounceRef.current = setTimeout(() => {
      void handleSaveNotificationPrefs();
    }, 500);
    return () => {
      if (notificationPrefsDebounceRef.current) {
        clearTimeout(notificationPrefsDebounceRef.current);
      }
    };
  }, [notificationPrefs, mounted, isLoading, handleSaveNotificationPrefs]);

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
          <div className="mx-auto w-full min-w-0 max-w-[1680px]">
          <div className="mb-6 min-w-0 max-w-2xl">
            <h1 className="text-2xl font-bold text-balance">Settings</h1>
            <p className="text-muted-foreground text-pretty">
              Manage your account and system preferences.
            </p>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
            {/* Left Sidebar Navigation */}
            <Card className="shrink-0 border shadow-sm lg:sticky lg:top-6 lg:h-fit lg:w-64 py-0 gap-0">
              <CardContent className="p-2">
                <nav className="flex flex-row lg:flex-col gap-2 py-1">
                  {settingsTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors duration-200 ease-in-out",
                          activeTab === tab.id
                            ? "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground bg-transparent",
                        )}
                      >
                        {activeTab === tab.id ? (
                          <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-primary" />
                        ) : null}
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
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
                  <SettingsTabHeader
                    title="Profile"
                    description="Update your name, avatar, and read-only account details."
                  />
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
                  <SettingsTabHeader
                    title="Preferences"
                    description="Customize how the application looks and behaves."
                    aside={
                      preferencesSaveState === "saving" ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : preferencesSaveState === "saved" ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700 dark:text-emerald-400">Saved</span>
                        </>
                      ) : (
                        <span>Autosave on</span>
                      )
                    }
                  />
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
                  <SettingsTabHeader
                    title="Notifications"
                    description={
                      <>
                        Choose which events appear in your notification center (bell). Turning a
                        category off stops{" "}
                        <span className="font-medium text-foreground">new</span> notifications of
                        that type — existing messages stay in your list.
                      </>
                    }
                    aside={
                      notificationPrefsSaveState === "saving" ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : notificationPrefsSaveState === "saved" ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700 dark:text-emerald-400">Saved</span>
                        </>
                      ) : notificationPrefsSaveState === "error" ? (
                        <>
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                          <span className="text-destructive">Not saved — check connection</span>
                        </>
                      ) : (
                        <span>Autosave on</span>
                      )
                    }
                  />
                  <CardContent className="space-y-6">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : profile ? (
                      <>
                        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground text-pretty">
                          These toggles only apply to{" "}
                          <span className="font-medium text-foreground">in-app</span> notifications.
                          They do not send email or push alerts. Email (e.g. access-request messages)
                          is controlled separately by the server.
                        </div>

                        <div className="space-y-4">
                          {notificationPrefRows.map((row) => {
                            const checked = notificationPrefs[row.key] !== false;
                            return (
                              <SettingRow
                                key={row.key}
                                title={row.title}
                                description={row.description}
                                controlClassName="sm:min-w-[52px] flex shrink-0 justify-end"
                              >
                                <Switch
                                  checked={checked}
                                  onCheckedChange={(v) =>
                                    setNotificationPrefs((prev) => ({
                                      ...prev,
                                      [row.key]: v,
                                    }))
                                  }
                                />
                              </SettingRow>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="py-8 text-center text-muted-foreground">
                        Unable to load notification preferences.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Security Tab */}
              {activeTab === "security" && (
                <Card className="border shadow-sm">
                  <SettingsTabHeader
                    title="Security"
                    description="Change your password. Requirements update as you type."
                  />
                  <CardContent className="space-y-6">
                    <div className="space-y-4 rounded-xl border bg-card p-4">
                      <p className="text-sm font-medium">Change password</p>
                      <PasswordField
                        id="current-password"
                        label="Current Password"
                        value={passwordData.currentPassword}
                          onChange={(value) => {
                            setPasswordFeedback(null);
                            setPasswordData((prev) => ({ ...prev, currentPassword: value }));
                          }}
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
                          onChange={(value) => {
                            setPasswordFeedback(null);
                            setPasswordData((prev) => ({ ...prev, newPassword: value }));
                          }}
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
                          onChange={(value) => {
                            setPasswordFeedback(null);
                            setPasswordData((prev) => ({ ...prev, confirmPassword: value }));
                          }}
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
                    {passwordFeedback && (
                      <Alert
                        variant={passwordFeedback.type === "error" ? "destructive" : "default"}
                      >
                        {passwordFeedback.type === "error" ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                        <AlertTitle>
                          {passwordFeedback.type === "error" ? "Password not updated" : "Success"}
                        </AlertTitle>
                        <AlertDescription>{passwordFeedback.message}</AlertDescription>
                      </Alert>
                    )}
                    
                    <Button
                      className="w-full sm:w-auto"
                      onClick={async () => {
                        setPasswordFeedback(null);
                        if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
                          setPasswordFeedback({
                            type: "error",
                            message: "Please fill in all password fields.",
                          });
                          return;
                        }
                        
                        if (!isPasswordValid) {
                          setPasswordFeedback({
                            type: "error",
                            message: "Please ensure your password meets all requirements.",
                          });
                          return;
                        }
                        
                        try {
                          setIsSavingPassword(true);
                          const response = await fetch("/api/auth/change-password", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              currentPassword: passwordData.currentPassword,
                              newPassword: passwordData.newPassword,
                            }),
                          });
                          
                          const data = await response.json();
                          
                          if (!response.ok) {
                            if (response.status === 401) {
                              setPasswordFeedback({
                                type: "error",
                                message: "The current password you entered is incorrect.",
                              });
                              return;
                            }

                            if (response.status === 404) {
                              setPasswordFeedback({
                                type: "error",
                                message:
                                  "We could not find your account for this session. Please sign out and sign in again.",
                              });
                              return;
                            }

                            setPasswordFeedback({
                              type: "error",
                              message: data.error || "Failed to change password. Please try again.",
                            });
                            return;
                          }
                          
                          setPasswordFeedback({
                            type: "success",
                            message: "Your password has been changed successfully.",
                          });

                          // Refresh access token so auth state reflects cleared
                          // must_change_password flag without requiring re-login.
                          await ApiClient.refresh();
                          
                          setPasswordData({
                            currentPassword: "",
                            newPassword: "",
                            confirmPassword: "",
                          });
                        } catch (error) {
                          setPasswordFeedback({
                            type: "error",
                            message:
                              error instanceof Error
                                ? error.message
                                : "Failed to change password. Please try again.",
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
          </div>
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
