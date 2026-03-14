import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { spawn } from "node:child_process"

async function collectJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectJsFiles(fullPath)))
      continue
    }
    if (entry.isFile() && fullPath.endsWith(".js")) files.push(fullPath)
  }
  return files
}

function checkFileSyntax(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--check", filePath], { stdio: "pipe" })
    let stderr = ""
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })
    child.on("close", (code) => {
      if (code === 0) return resolve()
      reject(new Error(stderr || `Syntax check failed: ${filePath}`))
    })
  })
}

async function main() {
  const files = await collectJsFiles(join(process.cwd(), "apps", "web", "server"))
  for (const file of files) {
    await checkFileSyntax(file)
  }
  console.log(`Checked ${files.length} server files`) 
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
