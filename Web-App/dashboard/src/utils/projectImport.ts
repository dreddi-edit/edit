import type { ProjectImportEntry, ProjectImportPreview } from "../api/projects"

export type ImportUploadItem = {
  file: File
  relativePath?: string
}

export type AutoImportPayload =
  | {
      kind: "zip" | "brief" | "screenshot"
      fileName: string
      mimeType?: string
      contentBase64: string
    }
  | {
      kind: "entries"
      entries: ProjectImportEntry[]
      title: string
      entryMode: "single-file" | "folder" | "assets" | "figma-export"
      summary?: string
    }

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null
}

const TEXT_EXTENSIONS = new Set([".html", ".htm", ".svg", ".md", ".markdown", ".txt", ".php", ".liquid", ".twig", ".njk", ".nunjucks", ".hbs", ".handlebars", ".mustache", ".ejs", ".erb", ".aspx", ".jsp"])
const BRIEF_EXTENSIONS = new Set([".pdf", ".docx"])
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"])
const ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".ico", ".mp4", ".webm", ".mov", ".mp3", ".wav", ".ogg", ".woff", ".woff2", ".ttf", ".otf", ".eot"])
const FIGMA_HINT_PATTERN = /(figma|frame|desktop|mobile|tablet|artboard|screen|variant)/i

function extensionOf(name: string) {
  const match = String(name || "").toLowerCase().match(/(\.[^./]+)$/)
  return match?.[1] || ""
}

function normalizeEntryName(name: string) {
  return String(name || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
}

function normalizeUploadName(file: File, overrideName?: string) {
  return normalizeEntryName(overrideName || file.webkitRelativePath || file.name)
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
  return btoa(binary)
}

export async function fileToImportEntry(file: File, overrideName?: string): Promise<ProjectImportEntry> {
  return {
    name: normalizeUploadName(file, overrideName),
    mimeType: file.type || "application/octet-stream",
    contentBase64: await fileToBase64(file),
  }
}

export async function filesToImportEntries(files: Iterable<File | ImportUploadItem>): Promise<ProjectImportEntry[]> {
  const entries = []
  for (const item of files) {
    if (item instanceof File) {
      entries.push(await fileToImportEntry(item))
      continue
    }
    entries.push(await fileToImportEntry(item.file, item.relativePath))
  }
  return entries
}

function detectCommonRoot(names: string[]) {
  const parts = names
    .map((name) => normalizeEntryName(name).split("/").filter(Boolean))
    .filter((segments) => segments.length > 1)
  if (!parts.length) return ""
  const root = parts[0]?.[0] || ""
  return root && parts.every((segments) => segments[0] === root) ? root : ""
}

function isLikelyLogoOrAsset(name: string) {
  return /(logo|icon|favicon|brand|font|asset|sprite|thumb|thumbnail|cover|hero-image)/i.test(name)
}

function isAssetLike(item: ImportUploadItem) {
  const name = normalizeUploadName(item.file, item.relativePath)
  const ext = extensionOf(name)
  return ASSET_EXTENSIONS.has(ext)
}

function isImageFrameLike(item: ImportUploadItem) {
  const name = normalizeUploadName(item.file, item.relativePath)
  const ext = extensionOf(name)
  if (!IMAGE_EXTENSIONS.has(ext) && ext !== ".svg") return false
  return FIGMA_HINT_PATTERN.test(name) || /\/(mobile|desktop|tablet|frames?)\//i.test(name)
}

function looksLikeFigmaExport(uploads: ImportUploadItem[]) {
  if (uploads.length < 2) return false
  const imageLike = uploads.filter((item) => {
    const ext = extensionOf(normalizeUploadName(item.file, item.relativePath))
    return IMAGE_EXTENSIONS.has(ext) || ext === ".svg"
  })
  if (imageLike.length < 2) return false
  const frameHints = uploads.filter(isImageFrameLike).length
  return imageLike.length / uploads.length >= 0.66 || frameHints >= 2
}

export async function buildAutoImportPayload(items: ImportUploadItem[]): Promise<AutoImportPayload> {
  const uploads = Array.from(items || []).filter((item) => item?.file)
  if (!uploads.length) throw new Error("No files selected.")

  const names = uploads.map((item) => normalizeUploadName(item.file, item.relativePath))
  const rootName = detectCommonRoot(names)

  if (uploads.length === 1) {
    const single = uploads[0]
    const fileName = normalizeUploadName(single.file, single.relativePath)
    const ext = extensionOf(fileName)
    const contentBase64 = await fileToBase64(single.file)
    if (ext === ".zip") {
      return { kind: "zip", fileName: single.file.name, contentBase64, mimeType: single.file.type || "application/zip" }
    }
    if (BRIEF_EXTENSIONS.has(ext)) {
      return { kind: "brief", fileName: single.file.name, contentBase64, mimeType: single.file.type || "" }
    }
    if (IMAGE_EXTENSIONS.has(ext) && !isLikelyLogoOrAsset(fileName)) {
      return { kind: "screenshot", fileName: single.file.name, contentBase64, mimeType: single.file.type || "" }
    }
    if (isAssetLike(single) && !TEXT_EXTENSIONS.has(ext)) {
      return {
        kind: "entries",
        entries: await filesToImportEntries(uploads),
        title: "Asset library",
        entryMode: "assets",
        summary: "Asset library imported into one project page",
      }
    }
    return {
      kind: "entries",
      entries: await filesToImportEntries(uploads),
      title: fileName.replace(/\.[^.]+$/, "") || "Imported file",
      entryMode: "single-file",
    }
  }

  if (uploads.every(isAssetLike)) {
    return {
      kind: "entries",
      entries: await filesToImportEntries(uploads),
      title: "Asset library",
      entryMode: "assets",
      summary: "Asset library imported into one project page",
    }
  }

  if (looksLikeFigmaExport(uploads)) {
    return {
      kind: "entries",
      entries: await filesToImportEntries(uploads),
      title: rootName || "Figma export",
      entryMode: "figma-export",
      summary: "Figma frame export imported into editable page drafts",
    }
  }

  return {
    kind: "entries",
    entries: await filesToImportEntries(uploads),
    title: rootName || "Imported upload",
    entryMode: "folder",
    summary: "Folder imported into project pages",
  }
}

async function readDirectoryEntry(entry: FileSystemEntry | null, prefix = ""): Promise<ImportUploadItem[]> {
  if (!entry) return []
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry
    const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject))
    return [{ file, relativePath: normalizeEntryName(prefix || entry.fullPath || file.name) }]
  }
  if (!entry.isDirectory) return []
  const directoryEntry = entry as FileSystemDirectoryEntry
  const reader = directoryEntry.createReader()
  const children: FileSystemEntry[] = await new Promise((resolve, reject) => {
    const collected: FileSystemEntry[] = []
    const readNext = () => {
      reader.readEntries((entries: FileSystemEntry[]) => {
        if (!entries.length) {
          resolve(collected)
          return
        }
        collected.push(...entries)
        readNext()
      }, reject)
    }
    readNext()
  })
  const nested = await Promise.all(children.map((child) => readDirectoryEntry(child, child.fullPath || "")))
  return nested.flat()
}

export async function collectDroppedUploadItems(dataTransfer: DataTransfer): Promise<ImportUploadItem[]> {
  const items = Array.from(dataTransfer.items || [])
  const entryItems = items
    .map((item) => {
      const withEntry = item as DataTransferItemWithEntry
      return withEntry.webkitGetAsEntry ? withEntry.webkitGetAsEntry() : null
    })
    .filter((entry): entry is FileSystemEntry => Boolean(entry))
  if (entryItems.length) {
    const nested = await Promise.all(entryItems.map((entry) => readDirectoryEntry(entry, entry.fullPath || "")))
    const results = nested.flat().filter((item) => item?.file)
    if (results.length) return results
  }
  return Array.from(dataTransfer.files || []).map((file) => ({ file }))
}

export function summarizeImportPreview(preview: Partial<ProjectImportPreview>) {
  if (preview.analysis?.overview) return preview.analysis.overview
  const pageCount = Array.isArray(preview.pages) ? preview.pages.length : 0
  const pageLabel = `${pageCount} page${pageCount === 1 ? "" : "s"}`
  const urlLabel = preview.url ? preview.url.replace(/^https?:\/\//i, "") : "local project"
  return `${pageLabel} ready from ${urlLabel}`
}
