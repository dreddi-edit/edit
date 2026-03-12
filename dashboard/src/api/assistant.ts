import { apiFetch } from "./client"
import type { Plan } from "./types"
import type { AssistantModelId } from "../utils/planAccess"

export type AssistantMessage = {
  role: "user" | "assistant"
  content: string
}

export type AssistantSurface = "dashboard" | "editor"

export type AssistantContext = {
  surface: AssistantSurface
  plan: Plan
  workspace?: string
  projectId?: number | string
  projectName?: string
  projectUrl?: string
  platform?: string
  exportMode?: string
  selectedBlock?: string | null
  warnings?: string[]
  brandContext?: string
}

type AssistantChatRes = {
  ok: true
  model: string
  provider: string
  reply: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  } | null
  cost_eur?: number
}

export async function apiAssistantChat(input: {
  model: AssistantModelId
  messages: AssistantMessage[]
  context: AssistantContext
}) {
  return apiFetch<AssistantChatRes>("/api/assistant/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
}
