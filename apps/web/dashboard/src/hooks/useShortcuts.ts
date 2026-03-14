import { useCallback, useEffect } from "react"

type Modifier = "meta" | "ctrl" | "alt" | "shift"

export type ShortcutDefinition = {
  key: string
  modifiers?: Modifier[]
  handler: (event: KeyboardEvent) => void
  allowInInput?: boolean
  description?: string
}

function isTypingTarget(target: EventTarget | null) {
  if (!target || !(target instanceof Element)) return false
  const element = target as HTMLElement
  const tag = element.tagName.toLowerCase()
  return tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable
}

function matchesModifiers(event: KeyboardEvent, modifiers: Modifier[]) {
  const required = new Set(modifiers)
  return (
    required.has("meta") === event.metaKey &&
    required.has("ctrl") === event.ctrlKey &&
    required.has("alt") === event.altKey &&
    required.has("shift") === event.shiftKey
  )
}

export function useShortcuts(shortcuts: ShortcutDefinition[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) continue
      const modifiers = shortcut.modifiers ?? []
      if (!matchesModifiers(event, modifiers)) continue
      if (!shortcut.allowInInput && isTypingTarget(event.target)) continue
      event.preventDefault()
      shortcut.handler(event)
      return
    }
  }, [shortcuts])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}
