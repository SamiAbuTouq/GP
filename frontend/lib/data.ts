// Shared UI constants and helpers for the University Course Timetabling System.
// Course schedule rows and KPIs are loaded from the API / Prisma (seeded CSV), not from static lists here.

export const departments = [
  "Accounting",
  "Basic Sciences",
  "Business Administration",
  "Business Information Technology",
  "Communications Engineering",
  "Computer Engineering",
  "Computer Graphics",
  "Computer Science",
  "Coordination Unit for Service Courses",
  "Cyber Security",
  "Data Science",
  "E-Marketing & Social Media",
  "Electrical Engineering",
  "Software Engineering",
] as const

export type Department = (typeof departments)[number]

/** Prisma `DeliveryMode` — API and client state use these values; use `formatDeliveryModeLabel` for display. */
export const DELIVERY_MODE_VALUES = ["ONLINE", "BLENDED", "FACE_TO_FACE"] as const
export type DeliveryMode = (typeof DELIVERY_MODE_VALUES)[number]

export const deliveryModeOptions: readonly { value: DeliveryMode; label: string }[] = [
  { value: "ONLINE", label: "Online" },
  { value: "BLENDED", label: "Blended" },
  { value: "FACE_TO_FACE", label: "On-Campus" },
]

export function formatDeliveryModeLabel(mode: DeliveryMode): string {
  return deliveryModeOptions.find((o) => o.value === mode)?.label ?? mode
}

/** Normalize CSV/API/legacy UI strings to a Prisma `DeliveryMode`. */
export function parseDeliveryMode(value: unknown): DeliveryMode {
  if (typeof value !== "string") return "FACE_TO_FACE"
  const raw = value.trim()
  if (!raw) return "FACE_TO_FACE"
  const canonical = raw.toUpperCase().replace(/-/g, "_").replace(/\s+/g, "_")
  if (canonical === "ONLINE") return "ONLINE"
  if (canonical === "BLENDED") return "BLENDED"
  if (canonical === "FACE_TO_FACE" || canonical === "FACETOFACE") return "FACE_TO_FACE"
  const n = raw.toLowerCase()
  if (n === "online") return "ONLINE"
  if (n === "blended") return "BLENDED"
  if (n === "no" || n === "false") return "FACE_TO_FACE"
  if (
    n === "face_to_face" ||
    n === "face-to-face" ||
    n === "face to face" ||
    n === "on-campus" ||
    n === "on campus" ||
    n === "in-person" ||
    n === "in person"
  )
    return "FACE_TO_FACE"
  return "FACE_TO_FACE"
}

export const slotTypes = ["Lecture", "Lab"] as const
export type SlotType = (typeof slotTypes)[number]
