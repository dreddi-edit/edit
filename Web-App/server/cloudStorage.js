import { Storage } from "@google-cloud/storage"
import path from "path"

const BUCKET_NAME = process.env.GCS_BUCKET || "edit-assets"
const GCS_PREFIX = `https://storage.googleapis.com/${BUCKET_NAME}/`

function hasGcsConfig() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
}

function getStorage() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set")
  const credentials = JSON.parse(json)
  return new Storage({ credentials, projectId: credentials.project_id })
}

function detectContentType(filename) {
  const ext = path.extname(String(filename || "")).toLowerCase()
  if (ext === ".svg") return "image/svg+xml"
  if (ext === ".png") return "image/png"
  if (ext === ".webp") return "image/webp"
  return "image/jpeg"
}

export function getManagedCloudPath(url) {
  if (typeof url !== "string" || !url.startsWith(GCS_PREFIX)) return null
  const pathname = url.slice(GCS_PREFIX.length).replace(/^\/+/, "")
  return pathname || null
}

export function normalizeManagedThumbnailUrl(url) {
  if (!url) return url || null
  const pathname = getManagedCloudPath(url)
  if (!pathname || !pathname.startsWith("thumbnails/")) return url
  const filename = pathname.slice("thumbnails/".length)
  if (!filename || filename.includes("/")) return url
  return `/thumbnails/${filename}`
}

export async function streamManagedFile(pathname, res) {
  if (!pathname || !hasGcsConfig()) return false

  const storage = getStorage()
  const file = storage.bucket(BUCKET_NAME).file(pathname)
  const [exists] = await file.exists()
  if (!exists) return false

  const [metadata] = await file.getMetadata().catch(() => [{}])
  res.setHeader("Cache-Control", metadata.cacheControl || "public, max-age=31536000")
  res.type(metadata.contentType || "application/octet-stream")

  await new Promise((resolve, reject) => {
    const stream = file.createReadStream()
    stream.on("error", reject)
    stream.on("end", resolve)
    stream.pipe(res)
  })

  return true
}

export async function uploadThumbnail(filepath, filename) {
  if (!hasGcsConfig()) {
    throw new Error("GCS disabled")
  }

  const storage = getStorage()
  const bucket = storage.bucket(BUCKET_NAME)
  const contentType = detectContentType(filename)

  const [file] = await bucket.upload(filepath, {
    destination: `thumbnails/${filename}`,
    metadata: {
      contentType,
      cacheControl: "public, max-age=31536000",
    },
  })

  await file.makePublic()
  return `https://storage.googleapis.com/${BUCKET_NAME}/thumbnails/${filename}`
}

export async function uploadExportZip(buffer, filename) {
  const storage = getStorage()
  const bucket = storage.bucket(BUCKET_NAME)
  const file = bucket.file(`exports/${filename}`)

  await file.save(buffer, {
    metadata: { contentType: "application/zip" },
    resumable: false,
  })

  await file.makePublic()
  return `https://storage.googleapis.com/${BUCKET_NAME}/exports/${filename}`
}

export async function deleteFile(gcsUrl) {
  try {
    const path = gcsUrl.replace(`https://storage.googleapis.com/${BUCKET_NAME}/`, "")
    const storage = getStorage()
    await storage.bucket(BUCKET_NAME).file(path).delete()
  } catch (e) {
    console.warn("GCS delete failed:", e.message)
  }
}
