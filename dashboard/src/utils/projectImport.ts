import type { ProjectImportEntry, ProjectImportPreview } from "../api/projects"

function normalizeEntryName(name: string) {
  return String(name || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
}

export async function fileToImportEntry(file: File): Promise<ProjectImportEntry> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
  return {
    name: normalizeEntryName(file.webkitRelativePath || file.name),
    mimeType: file.type || "application/octet-stream",
    contentBase64: btoa(binary),
  }
}

export async function filesToImportEntries(files: Iterable<File>): Promise<ProjectImportEntry[]> {
  const entries = []
  for (const file of files) {
    entries.push(await fileToImportEntry(file))
  }
  return entries
}

export function summarizeImportPreview(preview: ProjectImportPreview) {
  const pageCount = Array.isArray(preview.pages) ? preview.pages.length : 0
  const pageLabel = `${pageCount} page${pageCount === 1 ? "" : "s"}`
  const urlLabel = preview.url ? preview.url.replace(/^https?:\/\//i, "") : "local project"
  return `${pageLabel} ready from ${urlLabel}`
}
