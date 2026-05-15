"use client"

import { Input } from "@/components/ui/input"
import { isValidAcademicYear, normalizeAcademicYear } from "@/lib/academic-years"
import { cn } from "@/lib/utils"

type AcademicYearInputProps = {
  id: string
  value: string
  onChange: (value: string) => void
  suggestions?: string[]
  disabled?: boolean
  className?: string
  inputClassName?: string
  placeholder?: string
  showFormatHint?: boolean
  /** When false, no browser datalist (avoids implying a fixed set of allowed years). */
  showSuggestions?: boolean
}

export function AcademicYearInput({
  id,
  value,
  onChange,
  suggestions = [],
  disabled,
  className,
  inputClassName,
  placeholder = "2025-2026",
  showFormatHint = false,
  showSuggestions = true,
}: AcademicYearInputProps) {
  const listId = `${id}-suggestions`
  const showInvalid = value.trim() !== "" && !isValidAcademicYear(value)
  const normalized = normalizeAcademicYear(value)
  const datalistYears =
    showSuggestions && suggestions.length > 0
      ? [
          ...new Set([
            ...suggestions,
            ...(normalized ? [normalized] : []),
          ]),
        ]
      : []

  return (
    <div className={cn("space-y-1", className)}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        list={datalistYears.length > 0 ? listId : undefined}
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        className={cn(showInvalid && "border-destructive", inputClassName)}
        aria-invalid={showInvalid}
      />
      {datalistYears.length > 0 ? (
        <datalist id={listId}>
          {datalistYears.map((y) => (
            <option key={y} value={y} />
          ))}
        </datalist>
      ) : null}
      {showInvalid ? (
        <p className="text-xs text-destructive">Use format YYYY-YYYY (e.g. 2035-2036).</p>
      ) : showFormatHint ? (
        <p className="text-xs text-muted-foreground">
          Type any academic year (YYYY-YYYY). The end year must be one more than the start (e.g. 2040-2041).
        </p>
      ) : null}
    </div>
  )
}
