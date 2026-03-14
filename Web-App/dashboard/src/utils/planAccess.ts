import type { Plan } from "../api/types"

export type StudioToolId =
  | "company-box"
  | "visual-product"
  | "funnel-generator"
  | "cro-agent"
  | "self-healing"
  | "global-expansion"
  | "sales-closer"
  | "brand-brain"
  | "war-room"
  | "personalization"

export type AssistantModelId =
  | "claude-haiku-4-5-20251001"
  | "gemini-2.5-flash"
  | "claude-sonnet-4-6"
  | "gemini-2.5-pro"
  | "groq:llama-3.3-70b-versatile"

export type AssistantModelMeta = {
  id: AssistantModelId
  label: string
  provider: "anthropic" | "google" | "groq"
  vibe: string
}

type PlanMeta = {
  label: string
  price: string
  projects: string
  assistantModels: AssistantModelId[]
  studioTools: StudioToolId[]
}

const PLAN_ORDER: Plan[] = ["basis", "starter", "pro", "scale"]

export const ASSISTANT_MODELS: Record<AssistantModelId, AssistantModelMeta> = {
  "claude-haiku-4-5-20251001": {
    id: "claude-haiku-4-5-20251001",
    label: "Claude Haiku",
    provider: "anthropic",
    vibe: "Fast, concise, low-cost",
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "google",
    vibe: "Fast multimodal planning",
  },
  "claude-sonnet-4-6": {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    vibe: "Deeper reasoning and writing",
  },
  "gemini-2.5-pro": {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
    vibe: "Heavy analysis and strategy",
  },
  "groq:llama-3.3-70b-versatile": {
    id: "groq:llama-3.3-70b-versatile",
    label: "Groq Llama 3.3 70B",
    provider: "groq",
    vibe: "Fast broad reasoning",
  },
}

export const PLAN_META: Record<Plan, PlanMeta> = {
  basis: {
    label: "Basis",
    price: "EUR9/mo",
    projects: "3 projects",
    assistantModels: ["claude-haiku-4-5-20251001"],
    studioTools: ["brand-brain", "self-healing", "cro-agent", "global-expansion"],
  },
  starter: {
    label: "Starter",
    price: "EUR29/mo",
    projects: "10 projects",
    assistantModels: ["claude-haiku-4-5-20251001", "gemini-2.5-flash"],
    studioTools: [
      "brand-brain",
      "self-healing",
      "cro-agent",
      "global-expansion",
      "war-room",
      "personalization",
      "funnel-generator",
    ],
  },
  pro: {
    label: "Pro",
    price: "EUR79/mo",
    projects: "30 projects",
    assistantModels: [
      "claude-haiku-4-5-20251001",
      "gemini-2.5-flash",
      "claude-sonnet-4-6",
      "gemini-2.5-pro",
    ],
    studioTools: [
      "company-box",
      "visual-product",
      "funnel-generator",
      "cro-agent",
      "self-healing",
      "global-expansion",
      "sales-closer",
      "brand-brain",
      "war-room",
      "personalization",
    ],
  },
  scale: {
    label: "Scale",
    price: "EUR149/mo",
    projects: "100 projects",
    assistantModels: [
      "claude-haiku-4-5-20251001",
      "gemini-2.5-flash",
      "claude-sonnet-4-6",
      "gemini-2.5-pro",
      "groq:llama-3.3-70b-versatile",
    ],
    studioTools: [
      "company-box",
      "visual-product",
      "funnel-generator",
      "cro-agent",
      "self-healing",
      "global-expansion",
      "sales-closer",
      "brand-brain",
      "war-room",
      "personalization",
    ],
  },
}

export function getPlanRank(plan: Plan): number {
  return PLAN_ORDER.indexOf(plan)
}

export function getAllowedStudioTools(plan: Plan): StudioToolId[] {
  return PLAN_META[plan].studioTools
}

export function getAllowedAssistantModels(plan: Plan): AssistantModelMeta[] {
  return PLAN_META[plan].assistantModels.map(modelId => ASSISTANT_MODELS[modelId])
}

export function getDefaultAssistantModel(plan: Plan): AssistantModelMeta {
  return ASSISTANT_MODELS[PLAN_META[plan].assistantModels[0]]
}

export function hasStudioAccess(plan: Plan, tool: StudioToolId): boolean {
  return PLAN_META[plan].studioTools.includes(tool)
}

export function getRequiredPlanForTool(tool: StudioToolId): Plan {
  const plan = PLAN_ORDER.find(candidate => PLAN_META[candidate].studioTools.includes(tool))
  return plan || "scale"
}

export function isAssistantModelAllowed(plan: Plan, model: string): model is AssistantModelId {
  return PLAN_META[plan].assistantModels.includes(model as AssistantModelId)
}
