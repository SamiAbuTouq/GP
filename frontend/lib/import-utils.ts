import * as XLSX from "xlsx"

export type ParsedRow = Record<string, string>

/**
 * Parse a CSV string into an array of row objects keyed by header names.
 */
export function parseCSV(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 2) return []

  const headers = splitCSVLine(lines[0]).map((h) => h.trim())
  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i])
    const row: ParsedRow = {}
    headers.forEach((header, idx) => {
      row[header] = (values[idx] ?? "").trim()
    })
    rows.push(row)
  }

  return rows
}

/**
 * Handle quoted fields and commas inside CSV cells.
 */
function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

/**
 * Parse an Excel file (ArrayBuffer) into an array of row objects
 * using the first sheet, with the first row as headers.
 */
export function parseExcel(buffer: ArrayBuffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  })

  return jsonData.map((row) => {
    const parsed: ParsedRow = {}
    for (const [key, value] of Object.entries(row)) {
      parsed[key] = String(value ?? "").trim()
    }
    return parsed
  })
}

export function parseJSON(text: string): ParsedRow[] {
  try {
    const data = JSON.parse(text)
    if (!Array.isArray(data)) {
      throw new Error("JSON file must contain an array of objects.")
    }
    return data.map((item) => {
      if (typeof item !== "object" || item === null) return {}
      const parsed: ParsedRow = {}
      for (const [key, value] of Object.entries(item)) {
        parsed[key] = String(value ?? "").trim()
      }
      return parsed
    })
  } catch (error) {
    if (error instanceof Error && error.message === "JSON file must contain an array of objects.") {
      throw error
    }
    throw new Error("Invalid JSON format.")
  }
}

/**
 * Read a File and return parsed rows, detecting CSV vs Excel vs JSON by extension.
 */
export async function parseFile(file: File): Promise<ParsedRow[]> {
  const name = file.name.toLowerCase()

  if (name.endsWith(".json")) {
    const text = await file.text()
    return parseJSON(text)
  }

  if (name.endsWith(".csv")) {
    const text = await file.text()
    return parseCSV(text)
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer()
    return parseExcel(buffer)
  }

  throw new Error("Unsupported file format. Please upload a CSV, Excel (.xlsx/.xls), or JSON file.")
}

/**
 * Attempt to find a matching header from the parsed data.
 * Performs case-insensitive, whitespace-trimmed, underscore/dash-normalised matching.
 */
export function findColumn(row: ParsedRow, ...candidates: string[]): string | undefined {
  const keys = Object.keys(row)
  for (const candidate of candidates) {
    const normalised = candidate.toLowerCase().replace(/[\s_-]/g, "")
    const match = keys.find((k) => k.toLowerCase().replace(/[\s_-]/g, "") === normalised)
    if (match) return row[match]
  }
  return undefined
}
