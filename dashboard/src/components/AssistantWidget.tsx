import { useEffect, useMemo, useState } from "react"
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

type WidgetMessage = AssistantMessage & { id: string }

function readTheme() {
  if (typeof document === "undefined") return "dark"
  return document.body.getAttribute("data-theme") === "light" ? "light" : "dark"
}

function buildWelcomeMessage(context: AssistantContext, plan: Plan): WidgetMessage {
  const focus =
    context.surface === "editor"
      ? context.projectName || "the current page"
      : context.workspace || "the dashboard"

  return {
    id: "welcome",
    role: "assistant",
    content: `I’m your AI assistant for ${focus}. This widget uses the models available on your ${plan} plan only.`,
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

export default function AssistantWidget({
  plan,
  context,
  onUsage,
  avoidOverlay = false,
}: {
  plan: Plan
  context: AssistantContext
  onUsage?: (payload: unknown) => void
  avoidOverlay?: boolean
}) {
  const { t } = useTranslation()
  const [theme, setTheme] = useState<"dark" | "light">(readTheme)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const allowedModels = useMemo(() => getAllowedAssistantModels(plan), [plan])
  const [model, setModel] = useState<AssistantModelId>(getDefaultAssistantModel(plan).id)
  const [messages, setMessages] = useState<WidgetMessage[]>(() => [buildWelcomeMessage(context, plan)])

  useEffect(() => {
    setModel((current) => (allowedModels.some((item) => item.id === current) ? current : allowedModels[0].id))
  }, [allowedModels])

  useEffect(() => {
    setMessages((previous) => {
      if (previous.length > 1) return previous
      return [buildWelcomeMessage(context, plan)]
    })
  }, [context.projectName, context.surface, context.workspace, plan])

  useEffect(() => {
    if (typeof document === "undefined") return
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] })
    return () => observer.disconnect()
  }, [])

  const quickPrompts = getQuickPrompts(context)
  const currentModelMeta = allowedModels.find((item) => item.id === model) || allowedModels[0]

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
      const response = await apiAssistantChat({
        model,
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
        context,
      })

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
      toast.error(errMsg(error))
      setMessages((previous) => previous.filter((message) => message.id !== nextUserMessage.id))
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
          <div className="assistant-widget__header">
            <div>
              <div className="assistant-widget__eyebrow">{t("Assistant")}</div>
              <div className="assistant-widget__title">
                {context.surface === "editor" ? t("Page copilot") : t("Workspace copilot")}
              </div>
            </div>
            <div className="assistant-widget__header-actions">
              <span className="assistant-widget__plan">{plan.toUpperCase()}</span>
              <button
                type="button"
                className="assistant-widget__icon-button"
                onClick={() => setMessages([buildWelcomeMessage(context, plan)])}
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

          <div className="assistant-widget__meta">
            <div className="assistant-widget__context">
              {context.surface === "editor"
                ? context.projectName || t("Current page")
                : context.workspace || t("Dashboard")}
            </div>
            <select
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
          </div>

          <div className="assistant-widget__hint">
            {currentModelMeta.vibe}
          </div>

          <div className="assistant-widget__messages">
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
              className="assistant-widget__textarea"
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
                  ? t("Ask about this page, export warnings, translation, or edits...")
                  : t("Ask about plans, projects, AI Studio, or next steps...")
              }
            />
            <button
              type="button"
              className="assistant-widget__send"
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
          <strong>{t("Assistant")}</strong>
          <span>{currentModelMeta.label}</span>
        </span>
      </button>
    </div>
  )
}
