import crypto from "node:crypto"

const JOB_TTL_MS = Math.max(5 * 60_000, Number(process.env.JOB_TTL_MS || 30 * 60_000) || 30 * 60_000)
const jobs = new Map()

function nowIso() {
  return new Date().toISOString()
}

function purgeExpiredJobs() {
  const now = Date.now()
  for (const [id, job] of jobs.entries()) {
    const finishedAt = job.finishedAt ? Date.parse(job.finishedAt) : 0
    if (finishedAt && now - finishedAt > JOB_TTL_MS) {
      jobs.delete(id)
    }
  }
}

export function enqueueJob({ type = "job", userId = null, task }) {
  if (typeof task !== "function") {
    throw new Error("task must be a function")
  }
  purgeExpiredJobs()
  const id = crypto.randomUUID()
  const job = {
    id,
    type,
    userId,
    status: "queued",
    createdAt: nowIso(),
    startedAt: null,
    finishedAt: null,
    result: null,
    error: null,
  }
  jobs.set(id, job)

  Promise.resolve()
    .then(async () => {
      job.status = "running"
      job.startedAt = nowIso()
      const result = await task()
      job.result = result
      job.status = "completed"
      job.finishedAt = nowIso()
    })
    .catch((error) => {
      job.error = String(error?.message || error || "Job failed")
      job.status = "failed"
      job.finishedAt = nowIso()
    })

  return job
}

export function getJobForUser(jobId, userId) {
  purgeExpiredJobs()
  const job = jobs.get(String(jobId || ""))
  if (!job) return null
  if (job.userId !== null && String(job.userId) !== String(userId)) return null
  return job
}
