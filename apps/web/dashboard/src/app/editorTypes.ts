import type { ProjectAsset } from "../api/projects"
import type { WebsiteTranslationSegment } from "../utils/htmlTranslation"

export type BlockFilter =
  | "all"
  | "button"
  | "heading"
  | "image"
  | "form"
  | "navigation"
  | "container"
  | "list"
  | "content"

export type StructureSnapshotItem = {
  id: string
  rootId: string
  displayLabel: string
  label: string
  kind: string
  childCount: number
  isExpanded: boolean
  isSelected: boolean
}

export type ExportMode =
  | "wp-placeholder"
  | "html-clean"
  | "html-raw"
  | "shopify-section"
  | "wp-theme"
  | "wp-block"
  | "web-component"
  | "react-component"
  | "webflow-json"
  | "email-newsletter"
  | "markdown-content"
  | "pdf-print"

export type ViewportPreset = "desktop" | "tablet" | "mobile"

export type EditorAudit = {
  source: "seo" | "cro" | "accessibility"
  headline: string
  summary: string
  items: string[]
  scoreBadges?: string[]
}

export type AiDiffState = {
  id: string
  scope: "block" | "page"
  beforeHtml: string
  afterHtml: string
  beforeDocumentHtml: string
}

export type TranslationReviewState = {
  targetLanguage: string
  detectedSourceLanguage: string
  translatedCount: number
  segments: WebsiteTranslationSegment[]
}

export type AssetEntry = ProjectAsset

export type GlobalStyleOverrides = {
  fontFamily: string
  textColor: string
  backgroundColor: string
  accentColor: string
}
