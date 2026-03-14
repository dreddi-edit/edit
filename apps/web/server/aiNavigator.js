export function parseInstruction(text) {

  const t = String(text || "").toLowerCase()

  const insertMatch = t.match(/(unter|after|below)\s*block\s*(\d+)/)
  if (insertMatch) {
    return {
      action: "insert_after",
      targetBlock: Number(insertMatch[2])
    }
  }

  const beforeMatch = t.match(/(vor|before)\s*block\s*(\d+)/)
  if (beforeMatch) {
    return {
      action: "insert_before",
      targetBlock: Number(beforeMatch[2])
    }
  }

  const replaceMatch = t.match(/block\s*(\d+)\s*(ersetzen|replace)/)
  if (replaceMatch) {
    return {
      action: "replace",
      targetBlock: Number(replaceMatch[1])
    }
  }

  return {
    action: "ai_full"
  }
}
