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
  autoPrint = true,
) {
  const thStyle = `padding:11px 12px;font-size:12px;font-weight:700;color:#1e3a8a;text-align:left;border-bottom:2px solid #2563eb;background:#eff6ff;white-space:nowrap;`
  const tdStyle = `padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#111827;vertical-align:top;`

  const headerRow = columns.map((c) => `<th style="${thStyle}">${c.label}</th>`).join("")
  const bodyRows = data
    .map(
      (row, index) =>
        `<tr style="background:${index % 2 ? "#fcfcfd" : "#ffffff"};">${columns.map((c) => `<td style="${tdStyle}">${String(row[c.key] ?? "")}</td>`).join("")}</tr>`,
    )
    .join("")

  const html = `<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @page { size: landscape; margin: 14mm; }
      }
      :root { color-scheme: light; }
      body {
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        color: #111827;
        margin: 0;
        padding: 20px;
        background: #f8fafc;
      }
      .sheet {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 18px 20px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 12px;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 10px;
      }
      .title {
        font-size: 20px;
        font-weight: 700;
        margin: 0;
        color: #111827;
        line-height: 1.2;
      }
      .subtitle {
        margin: 4px 0 0;
        color: #6b7280;
        font-size: 13px;
      }
      .meta {
        font-size: 11px;
        color: #6b7280;
        white-space: nowrap;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 14px;
        border: 1px solid #e5e7eb;
      }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; break-inside: avoid; }
    </style>
  </head><body${autoPrint ? ` onload="setTimeout(function(){ window.print(); }, 300)"` : ""}>
    <div class="sheet">
      <div class="header">
        <div>
          <h1 class="title">${title}</h1>
          <p class="subtitle">${subtitle || `${data.length} records`}</p>
        </div>
        <div class="meta">Generated ${new Date().toLocaleString()}</div>
      </div>
      <table>
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  </body></html>`

  const printWindow = window.open("", "_blank")
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
  }
}
