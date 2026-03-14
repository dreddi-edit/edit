// Zentraler Undo-Stack – max 50 Schritte
const stack: string[] = []
const MAX = 50

export function undoPush(html: string) {
  if (stack[stack.length - 1] === html) return // keine Duplikate
  stack.push(html)
  if (stack.length > MAX) stack.shift()
}

export function undoPop(): string | null {
  if (stack.length === 0) return null
  return stack.pop() ?? null
}

export function undoSize(): number {
  return stack.length
}
