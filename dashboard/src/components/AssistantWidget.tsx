import React from 'react';
import { useEffect, useMemo, useRef, useState } from "react"
import { apiAssistantChat, type AssistantContext, type AssistantMessage } from "../api/assistant"
import type { Plan } from "../api/types"
import { toast } from "./Toast"
import { errMsg } from "../utils/errMsg"
import {
  getAllowedAssistantModels,
  getDefaultAssistantModel,
  type AssistantModelId,
} from "../utils/planAccess"
import { useTranslation } from "../i18n/useTranslation"
import "./assistant-widget.css"

const PLAN_META_LABEL: Record<Plan, string> = {
  basis: "Basis",
  starter: "Starter",
  pro: "Pro",
  scale: "Scale",
}

type WidgetMessage = AssistantMessage & { id: string }
const ASSISTANT_MESSAGE_STORAGE_PREFIX = "se_assistant_messages_v1"

function readTheme() {
  if (typeof document === "undefined") return "dark"
  return document.body.getAttribute("data-theme") === "light" ? "light" : "dark"
}

function buildWelcomeMessage(context: AssistantContext): WidgetMessage {
  const focus =
    context.surface === "editor"
      ? context.projectName || "the current page"
      : context.workspace || "the dashboard"

  return {
    id: `welcome_${Date.now()}`,
    role: "assistant",
    content: `I’m your AI assistant for ${focus}. Ask me about imports, exports, AI Studio, edits, translations, or the next best move.`,
  }
}

function getQuickPrompts(context: AssistantContext) {
  if (context.surface === "editor") {
    return [
      "Explain my current export warnings.",
      "What should I improve on this page before export?",
      "Give me three edits for higher conversions.",
      "How should I localize this page next?",
    ]
  }

  return [
    "Which AI Studio workflow should I use next?",
    "How does my current plan compare to the next one?",
    "What should I improve first across my projects?",
    "Summarize the current workspace for me.",
  ]
}

function normalizeStoredMessages(raw: unknown): WidgetMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry, index) => {
      const role = entry?.role === "assistant" ? "assistant" : "user"
      const content = String(entry?.content || "").trim()
      if (!content) return null
      const id = String(entry?.id || `${role}_${Date.now()}_${index}`)
      return { id, role, content }
    })
    .filter(Boolean)
    .slice(-80) as WidgetMessage[]
}

export default function AssistantWidget({
  plan,
  context,
  onUsage,
  avoidOverlay = false,
  onAction,
}: {
  plan: Plan
  context: AssistantContext
  onUsage?: (payload: unknown) => void
  avoidOverlay?: boolean
  onAction?: (command: string) => Promise<string | null> | string | null
}) {
  const { t } = useTranslation()
  const [theme, setTheme] = useState<"dark" | "light">(readTheme)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const allowedModels = useMemo(() => getAllowedAssistantModels(plan), [plan])
  const contextResetKey = useMemo(
    () =>
      JSON.stringify({
        surface: context.surface,
        workspace: context.workspace || "",
        projectId: context.projectId || "",
        projectName: context.projectName || "",
        projectUrl: context.projectUrl || "",
      }),
    [context.projectId, context.projectName, context.projectUrl, context.surface, context.workspace],
  )
  const welcomeMessage = useMemo(() => buildWelcomeMessage(context), [context])
  const messageStorageKey = useMemo(
    () => `${ASSISTANT_MESSAGE_STORAGE_PREFIX}:${contextResetKey}`,
    [contextResetKey],
  )
  const [model, setModel] = useState<AssistantModelId>(getDefaultAssistantModel(plan).id)
  const [messages, setMessages] = useState<WidgetMessage[]>(() => [buildWelcomeMessage(context)])

  useEffect(() => {
    setModel((current) => (allowedModels.some((item) => item.id === current) ? current : allowedModels[0].id))
  }, [allowedModels])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.sessionStorage.getItem(messageStorageKey)
      if (!raw) {
        setMessages([welcomeMessage])
        return
      }
      const parsed = JSON.parse(raw)
      const normalized = normalizeStoredMessages(parsed)
      setMessages(normalized.length ? normalized : [welcomeMessage])
    } catch {
      setMessages([welcomeMessage])
    }
  }, [messageStorageKey, welcomeMessage])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.sessionStorage.setItem(messageStorageKey, JSON.stringify(messages.slice(-80)))
    } catch {
      // Ignore storage write failures (private mode / quota).
    }
  }, [messageStorageKey, messages])

  useEffect(() => {
    if (typeof document === "undefined") return
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleOpen = () => {
      setOpen(true)
      window.requestAnimationFrame(() => textareaRef.current?.focus())
    }
    window.addEventListener("assistant:open", handleOpen)
    return () => window.removeEventListener("assistant:open", handleOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [open])

  const quickPrompts = getQuickPrompts(context)
  const currentModelMeta = allowedModels.find((item) => item.id === model) || allowedModels[0]
  const currentSurfaceLabel =
    context.surface === "editor"
      ? context.projectName || t("Current page")
      : context.workspace || t("Dashboard")
  const warningPreview = (context.warnings || []).slice(0, 2)

  const sendMessage = async (prompt?: string) => {
    const text = String(prompt ?? input).trim()
    if (!text || loading) return

    const nextUserMessage: WidgetMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
    }

    const nextMessages = [...messages, nextUserMessage]
    setMessages(nextMessages)
    setInput("")
    setLoading(true)

    try {
      if (context.surface === "editor" && onAction) {
        const reply = await onAction(text)
        if (reply) {
          setMessages((previous) => [
            ...previous,
            {
              id: `assistant_${Date.now()}`,
              role: "assistant",
              content: reply,
            },
          ])
          return
        }
        if (text.startsWith("/")) {
          const unknownActionMessage = t("Unknown action. Try /preview, /share, /audit seo, /translate de, or /export html-clean.")
          toast.error(unknownActionMessage)
          setMessages((previous) => [
            ...previous,
            {
              id: `assistant_${Date.now()}`,
              role: "assistant",
              content: unknownActionMessage,
            },
          ])
          return
        }
      }

      const response = await apiAssistantChat({
        model,
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
        context,
      })

      if (response.model_notice) {
        toast.warning(response.model_notice)
      }
      if (
        typeof response.model === "string" &&
        response.model !== model &&
        allowedModels.some((item) => item.id === response.model)
      ) {
        setModel(response.model as AssistantModelId)
      }

      setMessages((previous) => [
        ...previous,
        {
          id: `assistant_${Date.now()}`,
          role: "assistant",
          content: response.reply,
        },
      ])

      onUsage?.({
        model: response.model,
        usage: response.usage,
        cost_eur: response.cost_eur,
      })
    } catch (error) {
      const message = errMsg(error)
      toast.error(message)
      setMessages((previous) => [
        ...previous,
        {
          id: `assistant_${Date.now()}`,
          role: "assistant",
          content: `I couldn't complete that request: ${message}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`assistant-widget assistant-widget--${theme} ${open ? "is-open" : ""} ${avoidOverlay ? "assistant-widget--avoid" : ""} ${avoidOverlay && !open ? "assistant-widget--compact" : ""}`}
    >
      {open ? (
        <div className="assistant-widget__panel" role="dialog" aria-label={t("Assistant")}>
          <div className="assistant-widget__hero">
            <div className="assistant-widget__hero-top">
              <div className="assistant-widget__eyebrow-row">
                <span className="assistant-widget__eyebrow">{t("AI assistant")}</span>
                <span className="assistant-widget__surface-pill">
                  {context.surface === "editor" ? t("Page copilot") : t("Workspace copilot")}
                </span>
              </div>
              <div className="assistant-widget__header-actions">
                <span className="assistant-widget__plan">{plan.toUpperCase()}</span>
                <button
                  type="button"
                  className="assistant-widget__icon-button"
                  onClick={() => {
                    const cleared = [buildWelcomeMessage(context)]
                    setMessages(cleared)
                    if (typeof window !== "undefined") {
                      try {
                        window.sessionStorage.removeItem(messageStorageKey)
                      } catch {
                        // Ignore storage clear failures (private mode / quota).
                      }
                    }
                  }}
                  title={t("Clear chat")}
                >
                  ↺
                </button>
                <button
                  type="button"
                  className="assistant-widget__icon-button"
                  onClick={() => setOpen(false)}
                  title={t("Close")}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="assistant-widget__hero-main">
              <div>
                <div className="assistant-widget__title">
                  {context.surface === "editor" ? t("Page copilot") : t("Workspace copilot")}
                </div>
                <div className="assistant-widget__subtitle">{t("Need a hand? Ask the copilot anytime.")}</div>
              </div>
              <div className="assistant-widget__hero-mark">
                <span>AI</span>
              </div>
            </div>

            <div className="assistant-widget__deck">
              <div className="assistant-widget__context-card">
                <div className="assistant-widget__card-label">{t("Current context")}</div>
                <div className="assistant-widget__context-value">{currentSurfaceLabel}</div>
                <div className="assistant-widget__context-meta">
                  <span>{context.platform || t("Dashboard")}</span>
                  {context.selectedBlock ? <span>{context.selectedBlock}</span> : null}
                  {context.exportMode ? <span>{context.exportMode}</span> : null}
                </div>
                {warningPreview.length ? (
                  <div className="assistant-widget__warning-stack">
                    <div className="assistant-widget__warning-label">{t("Warnings in view")}</div>
                    {warningPreview.map((warning) => (
                      <div key={warning} className="assistant-widget__warning-chip">
                        {warning}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="assistant-widget__model-card">
                <label className="assistant-widget__card-label" htmlFor="assistant-model-select">
                  {t("Model")}
                </label>
                <select
                  id="assistant-model-select"
                  className="assistant-widget__select"
                  value={model}
                  onChange={(event) => setModel(event.target.value as AssistantModelId)}
                >
                  {allowedModels.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <div className="assistant-widget__model-vibe">{currentModelMeta.vibe}</div>
                <div className="assistant-widget__model-provider">
                  {currentModelMeta.provider} · {PLAN_META_LABEL[plan]}
                </div>
              </div>
            </div>
          </div>

          <div
            className="assistant-widget__messages"
            role="log"
            aria-live="polite"
            aria-label={t("AI assistant conversation")}
            aria-relevant="additions"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`assistant-widget__message assistant-widget__message--${message.role}`}
              >
                <div className="assistant-widget__bubble">{message.content}</div>
              </div>
            ))}
            {loading ? (
              <div className="assistant-widget__message assistant-widget__message--assistant">
                <div className="assistant-widget__bubble assistant-widget__bubble--loading">{t("Thinking...")}</div>
              </div>
            ) : null}
          </div>

          {messages.length <= 1 ? (
            <div className="assistant-widget__quick-prompts">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="assistant-widget__prompt-chip"
                  onClick={() => void sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          <div className="assistant-widget__composer">
            <textarea
              ref={textareaRef}
              className="assistant-widget__textarea"
              aria-label={t("Message to AI assistant")}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
              placeholder={
                context.surface === "editor"
                  ? t("Ask about this page, exports, warnings, or translations...")
                  : t("Ask about plans, imports, AI Studio, or next steps...")
              }
            />
            <button
              type="button"
              className="assistant-widget__send"
              aria-label={t("Send message")}
              onClick={() => void sendMessage()}
              disabled={loading || !input.trim()}
            >
              {loading ? t("...") : t("Send")}
            </button>
          </div>
        </div>
      ) : null}

      <button type="button" className="assistant-widget__launcher" onClick={() => setOpen((value) => !value)}>
        <span className="assistant-widget__launcher-mark">AI</span>
        <span className="assistant-widget__launcher-copy">
          <strong>{t("Open copilot")}</strong>
          <span>{currentModelMeta.label}</span>
        </span>
      </button>
    </div>
  )
}
