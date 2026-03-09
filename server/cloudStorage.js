import { Storage } from "@google-cloud/storage"

const BUCKET_NAME = process.env.GCS_BUCKET || "edit-assets"

function getStorage() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set")
  const credentials = JSON.parse(json)
  return new Storage({ credentials, projectId: credentials.project_id })
}

export async function uploadThumbnail(filepath, filename) {
  const storage = getStorage()
  const bucket = storage.bucket(BUCKET_NAME)
  await bucket.upload(filepath, {
    destination: `thumbnails/${filename}`,
    metadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000" }
  })
  return `https://storage.googleapis.com/${BUCKET_NAME}/thumbnails/${filename}`
}

export async function uploadExportZip(buffer, filename) {
  const storage = getStorage()
  const bucket = storage.bucket(BUCKET_NAME)
  const file = bucket.file(`exports/${filename}`)
  await file.save(buffer, {
    metadata: { contentType: "application/zip" },
    resumable: false
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
