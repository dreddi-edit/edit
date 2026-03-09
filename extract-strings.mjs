import { readFileSync } from "fs"
import { glob } from "fs/promises"

const files = []
for await (const f of glob("dashboard/src/**/*.tsx")) files.push(f)

const results = new Set()
for (const file of files) {
  const src = readFileSync(file, "utf8")
  // Match JSX text content and string props that look like human-readable text
  const matches = src.matchAll(/>\s*([A-ZÄÖÜa-zäöüß][^<>{}\n]{3,60})\s*</g)
  for (const m of matches) results.add(m[1].trim())
}

console.log(JSON.stringify([...results], null, 2))
