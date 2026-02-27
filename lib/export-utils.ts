/**
 * Shared export utilities for CSV, JSON, Excel (.xlsx), and PDF downloads.
 */
import * as XLSX from "xlsx"

export function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string }[],
  filename: string,
) {
  const header = columns.map((c) => c.label).join(",")
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = String(row[c.key] ?? "")
        return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
      })
      .join(","),
  )
  const csv = [header, ...rows].join("\n")
  downloadBlob(csv, `${filename}.csv`, "text/csv;charset=utf-8;")
}

export function exportToJSON<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string }[],
  filename: string,
) {
  const mapped = data.map((row) => {
    const obj: Record<string, unknown> = {}
    columns.forEach((c) => { obj[c.label] = row[c.key] ?? "" })
    return obj
  })
  const json = JSON.stringify(mapped, null, 2)
  downloadBlob(json, `${filename}.json`, "application/json")
}

export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string }[],
  filename: string,
) {
  const wsData = [
    columns.map((c) => c.label),
    ...data.map((row) => columns.map((c) => row[c.key] ?? "")),
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportToPDF<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string }[],
  title: string,
  subtitle?: string,
) {
  const thStyle = `padding:12px 16px;font-size:13px;font-weight:600;color:#991b1b;text-align:left;border-bottom:2px solid #991b1b;`
  const tdStyle = `padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1a1a1a;`

  const headerRow = columns.map((c) => `<th style="${thStyle}">${c.label}</th>`).join("")
  const bodyRows = data
    .map(
      (row) =>
        `<tr>${columns.map((c) => `<td style="${tdStyle}">${String(row[c.key] ?? "")}</td>`).join("")}</tr>`,
    )
    .join("")

  const html = `<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { size: landscape; margin: 20mm; } }
      body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 40px 48px; color: #1a1a1a; margin: 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    </style>
  </head><body>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 4px 0;color:#111827;">${title}</h1>
    <p style="color:#6b7280;margin:0;font-size:14px;font-style:italic;">${subtitle || `${data.length} records`}</p>
    <table>
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body></html>`

  const printWindow = window.open("", "_blank")
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 500)
  }
}
