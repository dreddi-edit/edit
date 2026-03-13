import React, { useMemo, useState } from 'react';

import { EditorAudits } from "./EditorAudits";
import { EditorOverlay } from "./EditorOverlay";
import { EditorStructure } from "./EditorStructure";
import { EditorAiAssistant } from "./EditorAiAssistant";
import { COMPONENT_LIBRARY } from "./ComponentLibrary";
import type {
  ExportWarning,
  PlatformGuide,
  PublishDeployment,
  PublishTarget,
  PublishTargetInfo,
  Project,
  ProjectAsset,
  ProjectPage,
  ProjectShare,
  ProjectVersion,
  ProjectVersionDetail,
  WorkflowEvent,
} from "../api/projects";
import { TOP_TRANSLATION_LANGUAGES } from "../utils/htmlTranslation";

type PlatformMeta = {
  border: string;
  background: string;
  accent: string;
  shortLabel: string;
  label: string;
};

type TranslationSummary = {
  targetLanguage: string;
  detectedSourceLanguage: string;
  translatedCount: number;
};

type TranslationSegment = {
  id: string;
  selector: string;
  sourceText: string;
  translatedText: string;
};

type TranslationReview = TranslationSummary & {
  segments: TranslationSegment[];
};

type GlobalStyleOverrides = {
  fontFamily: string;
  textColor: string;
  backgroundColor: string;
  accentColor: string;
};

type PublishDraft = {
  target: PublishTarget;
  firebaseSiteId: string;
  netlifySiteId: string;
  netlifyToken: string;
  vercelToken: string;
  wpUrl: string;
  wpUser: string;
  wpAppPassword: string;
  wpPageId: string;
  shopDomain: string;
  shopAccessToken: string;
  shopThemeId: string;
  customDomain: string;
};

interface SidebarProps {
  isEditRailCollapsed: boolean;
  setIsEditRailCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isEditMode: boolean;
  currentPlatformMeta: PlatformMeta;
  currentPlatformGuide: PlatformGuide | null;
  handleAiRescan: (type: "block" | "page") => void;
  aiScanLoading: boolean;
  exportReadiness: "ready" | "guarded";
  exportWarnings: ExportWarning[];
  showExportWarnings: boolean;
  setShowExportWarnings: (value: boolean) => void;
  currentProject: Project | null;
  loadedUrl: string;
  titleCaseFallback: (text: string) => string;
  workflowHistory: WorkflowEvent[];
  projectPages: ProjectPage[];
  activePageId: string | null;
  scanningPages: boolean;
  savingPageMutation: boolean;
  scanProjectPages: () => void;
  openProjectPage: (page: ProjectPage) => void;
  createProjectPage: (payload: {
    name: string;
    title?: string;
    path?: string;
    slug?: string;
    seo?: {
      title?: string;
      description?: string;
      canonical?: string;
      robots?: string;
      og?: Record<string, string>;
    };
  }) => Promise<void>;
  updateProjectPageMetadata: (pageId: string, payload: {
    name?: string;
    title?: string;
    path?: string;
    slug?: string;
    seo?: {
      title?: string;
      description?: string;
      canonical?: string;
      robots?: string;
      og?: Record<string, string>;
    };
  }) => Promise<void>;
  deleteProjectPage: (pageId: string) => Promise<void>;
  versionPreview: ProjectVersionDetail | null;
  previewVersionTitle: string;
  versionMetaFor: (version?: ProjectVersion | ProjectVersionDetail | null) => string;
  projectVersions: ProjectVersion[];
  versionTitleFor: (version?: ProjectVersion | ProjectVersionDetail | null) => string;
  activeVersionActionId: number | null;
  previewProjectVersion: (id: number) => Promise<void>;
  compareProjectVersion: (id: number) => Promise<void>;
  restoreProjectVersion: (id: number) => Promise<void>;
  versionCompare: ProjectVersionDetail | null;
  clearVersionCompare: () => void;
  exitVersionPreview: (hard: boolean) => void;
  handleManualSnapshot: () => Promise<void>;
  savingSnapshot: boolean;
  loadingVersions: boolean;
  currentHtml: string;
  runEditorAudit: (source: "seo" | "cro" | "accessibility") => void;
  runningAudit: "seo" | "cro" | "accessibility" | null;
  editorAudit: {
    headline: string;
    summary: string;
    items: string[];
    scoreBadges?: string[];
  } | null;
  blockFilter: string;
  setBlockFilter: (filter: string) => void;
  BLOCK_FILTER_OPTIONS: Array<{ value: string; label: string }>;
  structureItems: Array<{
    id: string;
    rootId: string;
    displayLabel: string;
    kind: string;
    childCount: number;
    isSelected: boolean;
  }>;
  moveStructureItem: (id: string, delta: number) => void;
  leftAiModel: string;
  setLeftAiModel: (value: string) => void;
  leftAiTone: string;
  setLeftAiTone: (value: string) => void;
  leftAiPrompt: string;
  setLeftAiPrompt: (value: string) => void;
  AI_MODELS: Array<{ value: string; label: string }>;
  leftAiRunning: boolean;
  batchAiRunning: boolean;
  runLeftAiPrompt: () => void;
  runBatchAiAcrossPages: () => void;
  translationTargetLanguage: string;
  setTranslationTargetLanguage: (value: string) => void;
  availableLanguageVariants: Array<{ code: string; label: string }>;
  activeLanguageVariant: string;
  switchLanguageVariant: (variant: string) => void;
  handleTranslateSite: () => void;
  isTranslatingSite: boolean;
  translationInfo: TranslationSummary | null;
  translationReview: TranslationReview | null;
  translationOverrideDrafts: Record<string, string>;
  translationAppliedOverrides: Record<string, string>;
  activeTranslationSegmentId: string | null;
  selectTranslationSegment: (id: string) => void;
  updateTranslationOverrideDraft: (id: string, value: string) => void;
  applyTranslationOverride: (id: string) => Promise<void>;
  resetTranslationOverride: (id: string) => Promise<void>;
  resetAllTranslationOverrides: () => Promise<void>;
  storeCurrentAsLanguageVariant: () => Promise<void>;
  resetLanguageVariantFromBase: () => Promise<void>;
  deleteLanguageVariant: () => Promise<void>;
  showTranslationSplitView: boolean;
  toggleTranslationSplitView: () => void;
  selectedComponent: string;
  setSelectedComponent: (value: string) => void;
  addSelectedComponent: () => void;
  shareEmail: string;
  setShareEmail: (value: string) => void;
  createSharePreview: () => Promise<void>;
  sharingPreview: boolean;
  loadingShares: boolean;
  projectShares: ProjectShare[];
  copySharePreviewUrl: (shareUrl: string) => Promise<void>;
  revokeSharePreview: (shareId: number) => Promise<void>;
  publishDraft: PublishDraft;
  updatePublishDraft: <K extends keyof PublishDraft>(key: K, value: PublishDraft[K]) => void;
  selectedPublishTargetInfo: PublishTargetInfo | null;
  publishTargets: PublishTargetInfo[];
  loadingPublishTargets: boolean;
  createPublishPreview: () => Promise<void>;
  creatingPublishPreview: boolean;
  lastPublishPreview: {
    previewUrl: string;
    expiresAt: string;
    token: string;
  } | null;
  publishCurrentProject: () => Promise<void>;
  publishingTarget: PublishTarget | null;
  loadCustomDomainGuide: () => Promise<void>;
  customDomainGuide: {
    domain: string;
    target: string;
    guide: { steps: string[]; recordType: string; recordValue: string };
  } | null;
  loadingPublishHistory: boolean;
  recentPublishHistory: PublishDeployment[];
  rollbackPublishedDeployment: (deployment: PublishDeployment) => Promise<void>;
  rollingBackDeploymentId: number | null;
  assetLibraryQuery: string;
  setAssetLibraryQuery: (value: string) => void;
  filteredAssetLibrary: ProjectAsset[];
  selectedFontAssetId: string | null;
  setSelectedFontAssetId: (value: string | null) => void;
  handleAssetLibraryUpload: (files: FileList | null) => Promise<void>;
  globalStyleOverrides: GlobalStyleOverrides;
  updateGlobalStyleOverride: (key: keyof GlobalStyleOverrides, value: string) => void;
  cssVariableOverrides: Record<string, string>;
  updateCssVariableOverride: (name: string, value: string) => void;
  applyGlobalStyleOverridesNow: () => void;
  selectedFontAsset: ProjectAsset | null;
}

const FALLBACK_PUBLISH_TARGETS: PublishTarget[] = ["firebase", "netlify", "vercel", "wordpress", "shopify"];

function formatDateTime(value: string) {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function openExternal(url: string) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

async function copyText(value: string, promptLabel: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // fall through
  }
  window.prompt(promptLabel, value);
}

type TranslationFilter = "all" | "issues" | "overrides";

function getTranslationReviewIssues(segment: TranslationSegment, draftValue: string) {
  const issues: string[] = [];
  const source = String(segment.sourceText || "").trim();
  const draft = String(draftValue || "").trim();
  if (!draft) issues.push("empty");
  if (source && draft && source.toLowerCase() === draft.toLowerCase()) {
    issues.push("same as source");
  }
  if (source.length >= 16 && draft.length >= 4) {
    const ratio = draft.length / Math.max(1, source.length);
    if (ratio < 0.35 || ratio > 2.8) issues.push("length mismatch");
  }
  return issues;
}

export const EditorSidebar: React.FC<SidebarProps> = (props) => {
  const componentEntries = Object.entries(COMPONENT_LIBRARY);
  const selectedComponentMeta =
    props.selectedComponent && props.selectedComponent in COMPONENT_LIBRARY
      ? COMPONENT_LIBRARY[props.selectedComponent as keyof typeof COMPONENT_LIBRARY]
      : null;
  const fontAssets = props.filteredAssetLibrary.filter((asset) => asset.type === "font");
  const visibleAssets = props.filteredAssetLibrary.slice(0, 10);
  const [translationSearch, setTranslationSearch] = useState("");
  const [translationFilter, setTranslationFilter] = useState<TranslationFilter>("all");
  const translationSegments = useMemo(
    () => props.translationReview?.segments ?? [],
    [props.translationReview]
  );
  const translationReviewEntries = useMemo(
    () =>
      translationSegments.map((segment) => {
        const draft = props.translationOverrideDrafts[segment.id] ?? segment.translatedText;
        const issues = getTranslationReviewIssues(segment, draft);
        const isOverridden = Boolean(props.translationAppliedOverrides[segment.id]);
        return { segment, draft, issues, isOverridden };
      }),
    [translationSegments, props.translationOverrideDrafts, props.translationAppliedOverrides]
  );
  const filteredTranslationEntries = useMemo(() => {
    const query = translationSearch.trim().toLowerCase();
    return translationReviewEntries.filter((entry) => {
      if (translationFilter === "issues" && !entry.issues.length) return false;
      if (translationFilter === "overrides" && !entry.isOverridden) return false;
      if (!query) return true;
      const haystack = [
        entry.segment.selector,
        entry.segment.sourceText,
        entry.segment.translatedText,
        entry.draft,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [translationReviewEntries, translationFilter, translationSearch]);
  const activeFilteredIndex = filteredTranslationEntries.findIndex(
    (entry) => entry.segment.id === props.activeTranslationSegmentId
  );
  const totalIssueSegments = translationReviewEntries.filter((entry) => entry.issues.length).length;
  const totalOverrides = Object.keys(props.translationAppliedOverrides).length;
  const publishTargetOptions = props.publishTargets.length
    ? props.publishTargets.map((target) => target.id)
    : FALLBACK_PUBLISH_TARGETS;

  const promptCreatePage = async () => {
    const name = window.prompt("Page name", "New page")?.trim() || ""
    if (!name) return
    const path = window.prompt("Page path", `/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "new-page"}`)?.trim() || ""
    await props.createProjectPage({ name, path })
  }

  const promptEditPage = async (page: ProjectPage) => {
    const name = window.prompt("Page name", page.name || "")?.trim()
    if (!name) return
    const path = window.prompt("Page path", page.path || "/")?.trim()
    if (!path) return
    const title = window.prompt("Meta title", page.seo?.title || page.title || "")?.trim() || ""
    const description = window.prompt("Meta description", page.seo?.description || "")?.trim() || ""
    await props.updateProjectPageMetadata(page.id, {
      name,
      path,
      title: page.title || "",
      seo: {
        ...(page.seo || {}),
        title,
        description,
      },
    })
  }

  const renderPublishFields = () => {
    if (props.publishDraft.target === "firebase") {
      return (
        <input
          className="editor-select editor-select--full"
          value={props.publishDraft.firebaseSiteId}
          onChange={(event) => props.updatePublishDraft("firebaseSiteId", event.target.value)}
          placeholder="Firebase site ID"
          aria-label="Firebase site ID"
        />
      );
    }

    if (props.publishDraft.target === "netlify") {
      return (
        <div className="editor-panel__publish-grid">
          <input
            className="editor-select editor-select--full"
            value={props.publishDraft.netlifySiteId}
            onChange={(event) => props.updatePublishDraft("netlifySiteId", event.target.value)}
            placeholder="Netlify site ID"
            aria-label="Netlify site ID"
          />
          <input
            className="editor-select editor-select--full"
            value={props.publishDraft.netlifyToken}
            onChange={(event) => props.updatePublishDraft("netlifyToken", event.target.value)}
            placeholder="Netlify token"
            aria-label="Netlify token"
          />
        </div>
      );
    }

    if (props.publishDraft.target === "vercel") {
      return (
        <input
          className="editor-select editor-select--full"
          value={props.publishDraft.vercelToken}
          onChange={(event) => props.updatePublishDraft("vercelToken", event.target.value)}
          placeholder="Vercel token"
          aria-label="Vercel token"
        />
      );
    }

    if (props.publishDraft.target === "wordpress") {
      return (
        <div className="editor-panel__version-list">
          <input
            className="editor-select editor-select--full"
            value={props.publishDraft.wpUrl}
            onChange={(event) => props.updatePublishDraft("wpUrl", event.target.value)}
            placeholder="WordPress site URL"
            aria-label="WordPress site URL"
          />
          <div className="editor-panel__publish-grid">
            <input
              className="editor-select editor-select--full"
              value={props.publishDraft.wpUser}
              onChange={(event) => props.updatePublishDraft("wpUser", event.target.value)}
              placeholder="WordPress username"
              aria-label="WordPress username"
            />
            <input
              className="editor-select editor-select--full"
              value={props.publishDraft.wpAppPassword}
              onChange={(event) => props.updatePublishDraft("wpAppPassword", event.target.value)}
              placeholder="Application password"
              aria-label="WordPress application password"
            />
          </div>
          <input
            className="editor-select editor-select--full"
            value={props.publishDraft.wpPageId}
            onChange={(event) => props.updatePublishDraft("wpPageId", event.target.value)}
            placeholder="Optional page ID"
            aria-label="WordPress page ID"
          />
        </div>
      );
    }

    if (props.publishDraft.target === "shopify") {
      return (
        <div className="editor-panel__version-list">
          <div className="editor-panel__publish-grid">
            <input
              className="editor-select editor-select--full"
              value={props.publishDraft.shopDomain}
              onChange={(event) => props.updatePublishDraft("shopDomain", event.target.value)}
              placeholder="Shop domain"
              aria-label="Shop domain"
            />
            <input
              className="editor-select editor-select--full"
              value={props.publishDraft.shopThemeId}
              onChange={(event) => props.updatePublishDraft("shopThemeId", event.target.value)}
              placeholder="Optional theme ID"
              aria-label="Shopify theme ID"
            />
          </div>
          <input
            className="editor-select editor-select--full"
            value={props.publishDraft.shopAccessToken}
            onChange={(event) => props.updatePublishDraft("shopAccessToken", event.target.value)}
            placeholder="Shop access token"
            aria-label="Shop access token"
          />
        </div>
      );
    }

    return null;
  };

  return (
    <aside
      className={`editor-panel ${props.isEditRailCollapsed ? "is-collapsed" : ""}`}
      aria-label="Editor tools panel"
    >
      <button
        type="button"
        className="editor-panel__collapse"
        onClick={() => props.setIsEditRailCollapsed((prev) => !prev)}
        title={props.isEditRailCollapsed ? "Expand tools" : "Collapse tools"}
        aria-label={props.isEditRailCollapsed ? "Expand editor tools" : "Collapse editor tools"}
      >
        {props.isEditRailCollapsed ? ">" : "<"}
      </button>

      {props.isEditRailCollapsed ? (
        <div className="editor-panel__collapsed-stack">
          <div
            className="editor-panel__mini-platform"
            style={{
              borderColor: props.currentPlatformMeta.border,
              background: props.currentPlatformMeta.background,
              color: props.currentPlatformMeta.accent,
            }}
          >
            {props.currentPlatformMeta.shortLabel}
          </div>

          <button
            type="button"
            className="editor-panel__mini-action"
            onClick={() => props.handleAiRescan("block")}
            disabled={props.aiScanLoading || Boolean(props.versionPreview)}
            title="AI Block"
            aria-label="Run AI block scan"
          >
            AI
          </button>

          <button
            type="button"
            className="editor-panel__mini-action"
            onClick={() => props.handleAiRescan("page")}
            disabled={props.aiScanLoading || Boolean(props.versionPreview)}
            title="AI Page"
            aria-label="Run AI page scan"
          >
            Pg
          </button>

          <div className={`editor-panel__mini-readiness ${props.exportReadiness}`}>
            {props.exportReadiness === "guarded" ? "!" : "OK"}
          </div>
        </div>
      ) : (
        <div className="editor-panel__scroll">
          <section className="editor-panel__section">
            <h2 className="editor-panel__label">Page</h2>
            <div className="editor-panel__site-card">
              <div
                className="editor-panel__site-icon"
                style={{
                  borderColor: props.currentPlatformMeta.border,
                  background: props.currentPlatformMeta.background,
                  color: props.currentPlatformMeta.accent,
                }}
              >
                {props.currentPlatformMeta.shortLabel}
              </div>

              <div className="editor-panel__site-copy">
                <div className="editor-panel__site-name">
                  {props.currentProject?.name || props.loadedUrl.replace(/^https?:\/\//, "") || "No site loaded"}
                </div>
                <div className="editor-panel__site-meta">
                  <span className="editor-panel__site-dot" style={{ background: props.currentPlatformMeta.accent }} />
                  {props.currentPlatformMeta.label}
                  {props.currentProject ? ` · ${props.titleCaseFallback(props.currentProject.workflowStage || "draft")}` : ""}
                </div>
              </div>
            </div>

            {props.loadedUrl ? <div className="editor-panel__url">{props.loadedUrl}</div> : null}

            <div className="editor-panel__delivery">
              <span className={`editor-panel__delivery-pill ${props.exportReadiness}`}>
                {props.exportReadiness === "guarded" ? "Needs review" : "Export ready"}
              </span>
              <span className="editor-panel__page-count">
                {props.projectPages.length ? `${props.projectPages.length} pages` : "Single page"}
              </span>
            </div>

            {props.currentPlatformGuide ? (
              <div className="editor-panel__translation-card">
                <div className="editor-panel__translation-title">Platform guide</div>
                <div className="editor-panel__note">{props.currentPlatformGuide.safeEditScope}</div>
                <div className="editor-panel__note">{props.currentPlatformGuide.exportNotes}</div>
                {props.currentPlatformGuide.riskyAreas.length ? (
                  <div className="editor-panel__warning-list">
                    {props.currentPlatformGuide.riskyAreas.slice(0, 4).map((item) => (
                      <div key={item} className="editor-panel__warning-item">
                        <span className="editor-panel__warning-item-code">!</span>
                        <span className="editor-panel__warning-item-copy">{item}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {props.workflowHistory.length ? (
              <div className="editor-panel__warning-list">
                {props.workflowHistory.slice(0, 3).map((entry) => (
                  <div key={entry.id} className="editor-panel__warning-item">
                    <span className="editor-panel__warning-item-code">•</span>
                    <span className="editor-panel__warning-item-copy">
                      {props.titleCaseFallback(entry.to_stage || "draft")} · {formatDateTime(entry.created_at)}
                      {entry.comment ? ` · ${entry.comment}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <div className="editor-panel__divider" />

          <section className="editor-panel__section">
            <h2 className="editor-panel__label">Pages</h2>
            <div className="editor-panel__page-tools">
              <div className="editor-panel__page-count">
                {props.projectPages.length
                  ? `${props.projectPages.length} scanned page${props.projectPages.length === 1 ? "" : "s"}`
                  : "Build a page map"}
              </div>
              <button
                type="button"
                className="editor-btn editor-btn--panel editor-btn--compact"
                onClick={props.scanProjectPages}
                disabled={props.scanningPages || props.savingPageMutation || !props.currentProject?.url}
              >
                {props.scanningPages ? "Scanning..." : "Scan"}
              </button>
              <button
                type="button"
                className="editor-btn editor-btn--panel editor-btn--compact"
                onClick={() => void promptCreatePage()}
                disabled={props.savingPageMutation || !props.currentProject?.id}
              >
                {props.savingPageMutation ? "Saving..." : "New"}
              </button>
            </div>

            {props.projectPages.length ? (
              <div className="editor-panel__page-list">
                {props.projectPages.map((page) => (
                  <div key={page.id} className={`editor-panel__page-item ${props.activePageId === page.id ? "is-active" : ""}`}>
                    <button
                      type="button"
                      className="editor-panel__page-item-main"
                      onClick={() => props.openProjectPage(page)}
                    >
                      <div className="editor-panel__page-item-copy">
                        <strong>{page.name}</strong>
                        <span>{page.path || page.url}</span>
                      </div>
                      <div className="editor-panel__page-item-state">
                        {props.activePageId === page.id ? "Open" : page.html?.trim() ? "Ready" : "Fetch"}
                      </div>
                    </button>
                    <div className="editor-panel__page-actions">
                      <button
                        type="button"
                        className="editor-btn editor-btn--panel editor-btn--compact"
                        onClick={() => void promptEditPage(page)}
                        disabled={props.savingPageMutation}
                      >
                        Meta
                      </button>
                      <button
                        type="button"
                        className="editor-btn editor-btn--panel editor-btn--compact"
                        onClick={() => void props.deleteProjectPage(page.id)}
                        disabled={props.savingPageMutation || props.projectPages.length <= 1}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="editor-panel__note">
                {props.currentProject?.url
                  ? "Scan the live project to load individual internal pages into the editor."
                  : "Save or open a live project before building a page list."}
              </div>
            )}
          </section>

          {props.exportWarnings.length ? (
            <>
              <div className="editor-panel__divider" />
              <section className="editor-panel__section">
                <button
                  type="button"
                  className="editor-panel__warning-toggle"
                  onClick={() => props.setShowExportWarnings(!props.showExportWarnings)}
                  aria-expanded={props.showExportWarnings}
                >
                  <span className="editor-panel__label">Delivery warnings</span>
                  <span className="editor-panel__warning-arrow">{props.showExportWarnings ? "−" : "+"}</span>
                </button>
                {props.showExportWarnings ? (
                  <div className="editor-panel__warning-list">
                    {props.exportWarnings.map((warning) => (
                      <div key={`${warning.code}-${warning.message}`} className="editor-panel__warning-item">
                        <span className="editor-panel__warning-item-code">{warning.level === "warning" ? "!" : "i"}</span>
                        <span className="editor-panel__warning-item-copy">
                          {warning.message}
                          {warning.detail ? ` · ${warning.detail}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            </>
          ) : null}

          <div className="editor-panel__divider" />

          <section className="editor-panel__section">
            <h2 className="editor-panel__label">Localization</h2>
            <div className="editor-panel__translation-card">
              <div className="editor-panel__translation-head">
                <div className="editor-panel__translation-title">Language workflow</div>
                {props.activeLanguageVariant !== "base" ? (
                  <span className="editor-panel__translation-language">{props.activeLanguageVariant.toUpperCase()}</span>
                ) : null}
              </div>

              <select
                className="editor-select editor-select--full editor-select--language"
                value={props.translationTargetLanguage}
                onChange={(event) => props.setTranslationTargetLanguage(event.target.value)}
                aria-label="Translation target language"
              >
                {TOP_TRANSLATION_LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>

              {props.availableLanguageVariants.length > 1 ? (
                <select
                  className="editor-select editor-select--full"
                  value={props.activeLanguageVariant}
                  onChange={(event) => props.switchLanguageVariant(event.target.value)}
                  aria-label="Active language variant"
                >
                  {props.availableLanguageVariants.map((variant) => (
                    <option key={variant.code} value={variant.code}>
                      {variant.label}
                    </option>
                  ))}
                </select>
              ) : null}

              <div className="editor-panel__translation-controls">
                <button
                  className="editor-btn editor-btn--panel editor-btn--translate"
                  onClick={() => void props.handleTranslateSite()}
                  disabled={props.isTranslatingSite || Boolean(props.versionPreview)}
                >
                  {props.isTranslatingSite ? "Translating..." : "Translate"}
                </button>
                <button
                  className="editor-btn editor-btn--panel editor-btn--panel-muted"
                  onClick={props.toggleTranslationSplitView}
                  disabled={props.activeLanguageVariant === "base"}
                >
                  {props.showTranslationSplitView ? "Hide base" : "Split view"}
                </button>
                <button
                  className="editor-btn editor-btn--panel editor-btn--panel-muted"
                  onClick={() => void props.storeCurrentAsLanguageVariant()}
                  disabled={!props.currentProject?.id || !props.activePageId}
                >
                  Save variant
                </button>
                <button
                  className="editor-btn editor-btn--panel editor-btn--panel-muted"
                  onClick={() =>
                    void (props.activeLanguageVariant === "base"
                      ? props.deleteLanguageVariant()
                      : props.resetLanguageVariantFromBase())
                  }
                  disabled={!props.currentProject?.id || !props.activePageId || props.activeLanguageVariant === "base"}
                >
                  Reset variant
                </button>
              </div>

              {props.translationInfo ? (
                <div className="editor-panel__translation-summary">
                  {props.translationInfo.translatedCount} segments translated to {props.translationInfo.targetLanguage.toUpperCase()}
                  {props.translationInfo.detectedSourceLanguage
                    ? ` from ${props.translationInfo.detectedSourceLanguage.toUpperCase()}`
                    : ""}
                </div>
              ) : (
                <div className="editor-panel__note">
                  Translate the current page, save alternates, and compare localized output against the base version.
                </div>
              )}

              {translationSegments.length ? (
                <>
                  <div className="editor-panel__translation-review-controls">
                    <input
                      className="editor-select editor-select--full"
                      type="search"
                      value={translationSearch}
                      onChange={(event) => setTranslationSearch(event.target.value)}
                      placeholder="Search segments, selectors, or translations"
                      aria-label="Search translation segments"
                    />
                    <div className="editor-panel__translation-filters">
                      <button
                        className={`editor-btn editor-btn--panel editor-btn--compact ${translationFilter === "all" ? "" : "editor-btn--panel-muted"}`}
                        onClick={() => setTranslationFilter("all")}
                      >
                        All ({translationReviewEntries.length})
                      </button>
                      <button
                        className={`editor-btn editor-btn--panel editor-btn--compact ${translationFilter === "issues" ? "" : "editor-btn--panel-muted"}`}
                        onClick={() => setTranslationFilter("issues")}
                      >
                        Issues ({totalIssueSegments})
                      </button>
                      <button
                        className={`editor-btn editor-btn--panel editor-btn--compact ${translationFilter === "overrides" ? "" : "editor-btn--panel-muted"}`}
                        onClick={() => setTranslationFilter("overrides")}
                      >
                        Overrides ({totalOverrides})
                      </button>
                    </div>
                    <div className="editor-panel__translation-filters">
                      <button
                        className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                        onClick={() => {
                          if (!filteredTranslationEntries.length) return;
                          const previousIndex =
                            activeFilteredIndex <= 0 ? filteredTranslationEntries.length - 1 : activeFilteredIndex - 1;
                          props.selectTranslationSegment(filteredTranslationEntries[previousIndex].segment.id);
                        }}
                        disabled={!filteredTranslationEntries.length}
                      >
                        Previous
                      </button>
                      <button
                        className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                        onClick={() => {
                          if (!filteredTranslationEntries.length) return;
                          const nextIndex =
                            activeFilteredIndex < 0 || activeFilteredIndex >= filteredTranslationEntries.length - 1
                              ? 0
                              : activeFilteredIndex + 1;
                          props.selectTranslationSegment(filteredTranslationEntries[nextIndex].segment.id);
                        }}
                        disabled={!filteredTranslationEntries.length}
                      >
                        Next
                      </button>
                      <button
                        className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                        onClick={() => void props.resetAllTranslationOverrides()}
                        disabled={!totalOverrides || props.activeLanguageVariant === "base"}
                      >
                        Reset all overrides
                      </button>
                    </div>
                    <div className="editor-panel__note">
                      {filteredTranslationEntries.length} visible · {totalIssueSegments} with issues · {totalOverrides} override
                      {totalOverrides === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="editor-panel__version-list">
                    {filteredTranslationEntries.map((entry) => (
                      <div
                        key={entry.segment.id}
                        className={`editor-panel__version-item ${props.activeTranslationSegmentId === entry.segment.id ? "is-active" : ""}`}
                      >
                        <div className="editor-panel__version-copy">
                          <strong>{entry.segment.sourceText || entry.segment.selector}</strong>
                          <span>{entry.segment.selector}</span>
                        </div>
                        {entry.issues.length ? (
                          <div className="editor-panel__translation-issues">Issues: {entry.issues.join(" · ")}</div>
                        ) : null}
                        <textarea
                          className="editor-textarea"
                          value={entry.draft}
                          onChange={(event) => props.updateTranslationOverrideDraft(entry.segment.id, event.target.value)}
                          aria-label={`Translation override for ${entry.segment.selector}`}
                        />
                        <div className="editor-panel__version-actions">
                          <button
                            className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                            onClick={() => props.selectTranslationSegment(entry.segment.id)}
                          >
                            Focus
                          </button>
                          <button
                            className="editor-btn editor-btn--panel editor-btn--compact"
                            onClick={() => void props.applyTranslationOverride(entry.segment.id)}
                            disabled={!entry.draft.trim()}
                          >
                            Apply
                          </button>
                          <button
                            className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                            onClick={() => void props.resetTranslationOverride(entry.segment.id)}
                            disabled={!entry.isOverridden || props.activeLanguageVariant === "base"}
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!filteredTranslationEntries.length ? (
                    <div className="editor-panel__note">No translation segments match the current filter.</div>
                  ) : null}
                </>
              ) : null}
            </div>
          </section>

          <div className="editor-panel__divider" />

          <section className="editor-panel__section">
            <h2 className="editor-panel__label">Components</h2>
            <select
              className="editor-select editor-select--full"
              value={props.selectedComponent}
              onChange={(event) => props.setSelectedComponent(event.target.value)}
              aria-label="Reusable component library"
            >
              <option value="">Choose a reusable section</option>
              {componentEntries.map(([key, component]) => (
                <option key={key} value={key}>
                  {component.name} · {component.category}
                </option>
              ))}
            </select>
            <div className="editor-panel__note">
              {selectedComponentMeta
                ? selectedComponentMeta.description
                : "Insert a ready-made block into the selected structure node."}
            </div>
            <button
              className="editor-btn editor-btn--panel editor-btn--accent"
              onClick={props.addSelectedComponent}
              disabled={!props.selectedComponent || !props.isEditMode || Boolean(props.versionPreview)}
            >
              Insert component
            </button>
          </section>

          <div className="editor-panel__divider" />

          <EditorAudits
            runEditorAudit={props.runEditorAudit}
            runningAudit={props.runningAudit}
            editorAudit={props.editorAudit}
          />

          <div className="editor-panel__divider" />

          <EditorOverlay
            blockFilter={props.blockFilter}
            setBlockFilter={props.setBlockFilter}
            BLOCK_FILTER_OPTIONS={props.BLOCK_FILTER_OPTIONS}
            handleAiRescan={props.handleAiRescan}
            aiScanLoading={props.aiScanLoading}
            versionPreview={props.versionPreview}
          />

          <div className="editor-panel__divider" />

          <EditorStructure
            structureItems={props.structureItems}
            moveStructureItem={props.moveStructureItem}
            titleCaseFallback={props.titleCaseFallback}
          />

          <div className="editor-panel__divider" />

          <section className="editor-panel__section">
            <h2 className="editor-panel__label">Assets</h2>
            <input
              className="editor-select editor-select--full"
              value={props.assetLibraryQuery}
              onChange={(event) => props.setAssetLibraryQuery(event.target.value)}
              placeholder="Search assets"
              aria-label="Search assets"
            />
            <input
              className="editor-select editor-select--full"
              type="file"
              accept="image/*,.woff,.woff2,.ttf,.otf,.eot"
              multiple
              aria-label="Upload project assets"
              onChange={(event) => {
                void props.handleAssetLibraryUpload(event.target.files);
                event.currentTarget.value = "";
              }}
            />
            {visibleAssets.length ? (
              <div className="editor-panel__version-list">
                {visibleAssets.map((asset) => (
                  <div key={asset.id} className="editor-panel__version-item">
                    <div className="editor-panel__version-copy">
                      <strong>{asset.label}</strong>
                      <span>{asset.type.toUpperCase()}</span>
                    </div>
                    <div className="editor-panel__version-actions">
                      <button
                        className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                        onClick={() => openExternal(asset.url)}
                      >
                        Open
                      </button>
                      {asset.type === "font" ? (
                        <button
                          className="editor-btn editor-btn--panel editor-btn--compact"
                          onClick={() => props.setSelectedFontAssetId(asset.id)}
                        >
                          {props.selectedFontAssetId === asset.id ? "Selected" : "Use font"}
                        </button>
                      ) : (
                        <button
                          className="editor-btn editor-btn--panel editor-btn--compact"
                          onClick={() => void copyText(asset.url, "Copy this asset URL")}
                        >
                          Copy URL
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="editor-panel__note">Upload fonts or images to create a reusable project asset library.</div>
            )}
          </section>

          <div className="editor-panel__divider" />

          <section className="editor-panel__section">
            <h2 className="editor-panel__label">Global styles</h2>
            <select
              className="editor-select editor-select--full"
              value={props.selectedFontAssetId || ""}
              onChange={(event) => props.setSelectedFontAssetId(event.target.value || null)}
              aria-label="Site font source"
            >
              <option value="">Use page font stack</option>
              {fontAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.label}
                </option>
              ))}
            </select>
            <input
              className="editor-select editor-select--full"
              value={props.globalStyleOverrides.fontFamily}
              onChange={(event) => props.updateGlobalStyleOverride("fontFamily", event.target.value)}
              placeholder="Font family override"
              aria-label="Font family override"
            />
            <div className="editor-panel__publish-grid">
              <input
                className="editor-select editor-select--full"
                value={props.globalStyleOverrides.textColor}
                onChange={(event) => props.updateGlobalStyleOverride("textColor", event.target.value)}
                placeholder="Text color"
                aria-label="Global text color"
              />
              <input
                className="editor-select editor-select--full"
                value={props.globalStyleOverrides.backgroundColor}
                onChange={(event) => props.updateGlobalStyleOverride("backgroundColor", event.target.value)}
                placeholder="Background color"
                aria-label="Global background color"
              />
            </div>
            <input
              className="editor-select editor-select--full"
              value={props.globalStyleOverrides.accentColor}
              onChange={(event) => props.updateGlobalStyleOverride("accentColor", event.target.value)}
              placeholder="Accent color"
              aria-label="Global accent color"
            />
            {Object.keys(props.cssVariableOverrides).length ? (
              <div className="editor-panel__version-list">
                {Object.entries(props.cssVariableOverrides)
                  .slice(0, 8)
                  .map(([name, value]) => (
                    <input
                      key={name}
                      className="editor-select editor-select--full"
                      value={value}
                      onChange={(event) => props.updateCssVariableOverride(name, event.target.value)}
                      placeholder={name}
                      aria-label={`Override ${name}`}
                    />
                  ))}
              </div>
            ) : null}
            <div className="editor-panel__note">
              {props.selectedFontAsset ? `Selected font: ${props.selectedFontAsset.label}` : "No custom font selected yet."}
            </div>
            <button className="editor-btn editor-btn--panel editor-btn--accent" type="button" onClick={props.applyGlobalStyleOverridesNow}>
              Apply site-wide styles
            </button>
          </section>

          <div className="editor-panel__divider" />

          <section className="editor-panel__section">
            <h2 className="editor-panel__label">Snapshots</h2>
            <div className="editor-panel__version-toolbar">
              <button
                className="editor-btn editor-btn--panel"
                onClick={() => void props.handleManualSnapshot()}
                disabled={props.savingSnapshot || !props.currentProject?.id || Boolean(props.versionPreview)}
              >
                {props.savingSnapshot ? "Saving..." : "Save snapshot"}
              </button>
              <button
                className="editor-btn editor-btn--panel editor-btn--panel-muted"
                onClick={() => void props.previewProjectVersion(props.projectVersions[0].id)}
                disabled={!props.projectVersions.length || props.loadingVersions}
              >
                Latest
              </button>
            </div>

            {props.versionPreview ? (
              <div className="editor-panel__version-preview">
                <div className="editor-panel__version-preview-title">{props.previewVersionTitle}</div>
                <div className="editor-panel__version-preview-meta">{props.versionMetaFor(props.versionPreview)}</div>
                <div className="editor-panel__version-actions">
                  <button
                    className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                    onClick={() => props.exitVersionPreview(true)}
                  >
                    Exit preview
                  </button>
                  <button
                    className="editor-btn editor-btn--panel editor-btn--compact"
                    onClick={() => void props.restoreProjectVersion(props.versionPreview!.id)}
                    disabled={props.activeVersionActionId === props.versionPreview.id}
                  >
                    {props.activeVersionActionId === props.versionPreview.id ? "Restoring..." : "Restore"}
                  </button>
                </div>
              </div>
            ) : null}

            {props.versionCompare ? (
              <div className="editor-panel__version-compare">
                <div className="editor-panel__publish-row">
                  <strong>Version compare</strong>
                  <button
                    className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                    onClick={props.clearVersionCompare}
                  >
                    Clear
                  </button>
                </div>
                <div className="editor-panel__compare-grid">
                  <div className="editor-panel__compare-pane">
                    <div className="editor-panel__compare-label">Current</div>
                    <iframe className="editor-panel__compare-frame" srcDoc={props.currentHtml} title="Current document" />
                  </div>
                  <div className="editor-panel__compare-pane">
                    <div className="editor-panel__compare-label">{props.versionTitleFor(props.versionCompare)}</div>
                    <iframe className="editor-panel__compare-frame" srcDoc={props.versionCompare.html} title="Snapshot compare" />
                  </div>
                </div>
              </div>
            ) : null}

            {props.loadingVersions ? (
              <div className="editor-panel__note">Loading snapshot history…</div>
            ) : props.projectVersions.length ? (
              <div className="editor-panel__version-list">
                {props.projectVersions.slice(0, 8).map((version) => (
                  <div
                    key={version.id}
                    className={`editor-panel__version-item ${props.versionPreview?.id === version.id ? "is-active" : ""}`}
                  >
                    <div className="editor-panel__version-copy">
                      <strong>{props.versionTitleFor(version)}</strong>
                      <span>{props.versionMetaFor(version)}</span>
                    </div>
                    <div className="editor-panel__version-actions">
                      <button
                        className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                        onClick={() => void props.previewProjectVersion(version.id)}
                        disabled={props.activeVersionActionId === version.id}
                      >
                        Preview
                      </button>
                      <button
                        className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                        onClick={() => void props.compareProjectVersion(version.id)}
                        disabled={props.activeVersionActionId === version.id}
                      >
                        Compare
                      </button>
                      <button
                        className="editor-btn editor-btn--panel editor-btn--compact"
                        onClick={() => void props.restoreProjectVersion(version.id)}
                        disabled={props.activeVersionActionId === version.id}
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="editor-panel__note">No snapshots yet. Manual saves and autosaves will appear here.</div>
            )}
          </section>

          <div className="editor-panel__divider" />

          <section className="editor-panel__section">
            <h2 className="editor-panel__label">Client review</h2>
            <input
              className="editor-select editor-select--full"
              value={props.shareEmail}
              onChange={(event) => props.setShareEmail(event.target.value)}
              placeholder="Optional reviewer email"
              aria-label="Reviewer email"
            />
            <div className="editor-panel__two-up">
              <button
                className="editor-btn editor-btn--panel"
                onClick={() => void props.createSharePreview()}
                disabled={props.sharingPreview || !props.currentProject?.id}
              >
                {props.sharingPreview ? "Creating..." : "Create share"}
              </button>
              <button
                className="editor-btn editor-btn--panel editor-btn--panel-muted"
                onClick={() => void props.copySharePreviewUrl(props.projectShares[0].url)}
                disabled={!props.projectShares.length}
              >
                Copy latest
              </button>
            </div>

            {props.loadingShares ? (
              <div className="editor-panel__note">Loading share previews…</div>
            ) : props.projectShares.length ? (
              <div className="editor-panel__version-list">
                {props.projectShares.slice(0, 6).map((share) => (
                  <div key={share.id} className="editor-panel__version-item">
                    <div className="editor-panel__version-copy">
                      <strong>{share.pageId || "Project-wide share"}</strong>
                      <span>
                        {share.languageVariant ? `${share.languageVariant.toUpperCase()} · ` : ""}
                        {formatDateTime(share.created_at)}
                      </span>
                    </div>
                    <div className="editor-panel__version-actions">
                      <button
                        className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                        onClick={() => openExternal(share.url)}
                      >
                        Open
                      </button>
                      <button
                        className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                        onClick={() => void props.copySharePreviewUrl(share.url)}
                      >
                        Copy
                      </button>
                      <button
                        className="editor-btn editor-btn--panel editor-btn--compact"
                        onClick={() => void props.revokeSharePreview(share.id)}
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="editor-panel__note">Create review links for the current project, page, or language variant.</div>
            )}
          </section>

          <div className="editor-panel__divider" />

          <section className="editor-panel__section">
            <h2 className="editor-panel__label">Publish</h2>
            <select
              className="editor-select editor-select--full"
              value={props.publishDraft.target}
              onChange={(event) => props.updatePublishDraft("target", event.target.value as PublishTarget)}
              aria-label="Publish target"
            >
              {publishTargetOptions.map((target) => (
                <option key={target} value={target}>
                  {props.titleCaseFallback(target)}
                </option>
              ))}
            </select>

            {props.selectedPublishTargetInfo ? (
              <div className="editor-panel__publish-target">
                <span
                  className={`editor-panel__publish-badge ${
                    props.selectedPublishTargetInfo.configured ? "is-ready" : "is-manual"
                  }`}
                >
                  {props.selectedPublishTargetInfo.configured ? "Configured" : "Manual input"}
                </span>
                <div className="editor-panel__note">
                  {props.selectedPublishTargetInfo.requiredEnv.length
                    ? `Required env: ${props.selectedPublishTargetInfo.requiredEnv.join(", ")}`
                    : "No server env required."}
                  {props.selectedPublishTargetInfo.requiredBody.length
                    ? ` Runtime fields: ${props.selectedPublishTargetInfo.requiredBody.join(", ")}.`
                    : ""}
                </div>
              </div>
            ) : props.loadingPublishTargets ? (
              <div className="editor-panel__note">Checking target configuration…</div>
            ) : null}

            {renderPublishFields()}

            <div className="editor-panel__publish-toolbar">
              <button
                className="editor-btn editor-btn--panel editor-btn--panel-muted"
                onClick={() => void props.createPublishPreview()}
                disabled={props.creatingPublishPreview}
              >
                {props.creatingPublishPreview ? "Building..." : "Preview"}
              </button>
              <button
                className="editor-btn editor-btn--panel editor-btn--accent"
                onClick={() => void props.publishCurrentProject()}
                disabled={props.publishingTarget !== null}
              >
                {props.publishingTarget ? `Publishing ${props.publishingTarget}...` : "Publish now"}
              </button>
            </div>

            {props.lastPublishPreview ? (
              <div className="editor-panel__publish-preview">
                <div className="editor-panel__publish-row">
                  <strong>Latest preview</strong>
                  <span>{formatDateTime(props.lastPublishPreview.expiresAt)}</span>
                </div>
                <div className="editor-panel__publish-url">{props.lastPublishPreview.previewUrl}</div>
                <div className="editor-panel__version-actions">
                  <button
                    className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                    onClick={() => openExternal(props.lastPublishPreview!.previewUrl)}
                  >
                    Open
                  </button>
                  <button
                    className="editor-btn editor-btn--panel editor-btn--compact"
                    onClick={() => void copyText(props.lastPublishPreview!.previewUrl, "Copy this preview URL")}
                  >
                    Copy
                  </button>
                </div>
              </div>
            ) : null}

            <input
              className="editor-select editor-select--full"
              value={props.publishDraft.customDomain}
              onChange={(event) => props.updatePublishDraft("customDomain", event.target.value)}
              placeholder="Custom domain"
              aria-label="Custom domain"
            />

            <button className="editor-btn editor-btn--panel editor-btn--panel-muted" type="button" onClick={() => void props.loadCustomDomainGuide()}>
              Load domain guide
            </button>

            {props.customDomainGuide ? (
              <div className="editor-panel__publish-guide">
                <div className="editor-panel__publish-row">
                  <strong>{props.customDomainGuide.domain}</strong>
                  <span>{props.customDomainGuide.guide.recordType}</span>
                </div>
                <div className="editor-panel__publish-url">{props.customDomainGuide.guide.recordValue}</div>
                <div className="editor-panel__version-actions">
                  <button
                    className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                    onClick={() => void copyText(props.customDomainGuide!.guide.recordValue, "Copy this DNS record")}
                  >
                    Copy record
                  </button>
                </div>
                <div className="editor-panel__publish-guide-steps">
                  {props.customDomainGuide.guide.steps.map((step, index) => (
                    <div key={`${props.customDomainGuide?.domain}-${index}`} className="editor-panel__publish-guide-step">
                      <span>{index + 1}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {props.loadingPublishHistory ? (
              <div className="editor-panel__note">Loading deployment history…</div>
            ) : props.recentPublishHistory.length ? (
              <div className="editor-panel__publish-history">
                {props.recentPublishHistory.map((deployment) => (
                  <div
                    key={deployment.id}
                    className={`editor-panel__publish-item is-${deployment.status}`}
                  >
                    <div className="editor-panel__publish-row">
                      <strong>
                        {props.titleCaseFallback(deployment.target)} · {deployment.export_mode}
                      </strong>
                      <span>{formatDateTime(deployment.created_at)}</span>
                    </div>
                    <div className="editor-panel__publish-url">
                      {deployment.deploy_url || deployment.preview_url || deployment.error_message || "Queued deployment"}
                    </div>
                    <div className="editor-panel__version-actions">
                      {(deployment.deploy_url || deployment.preview_url) ? (
                        <button
                          className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                          onClick={() => openExternal(deployment.deploy_url || deployment.preview_url || "")}
                        >
                          Open
                        </button>
                      ) : null}
                      <button
                        className="editor-btn editor-btn--panel editor-btn--compact"
                        onClick={() => void props.rollbackPublishedDeployment(deployment)}
                        disabled={props.rollingBackDeploymentId === deployment.id || deployment.status !== "success"}
                      >
                        {props.rollingBackDeploymentId === deployment.id ? "Rolling back..." : "Rollback"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="editor-panel__note">Deployment previews, rollbacks, and custom-domain setup will collect here.</div>
            )}
          </section>

          <div className="editor-panel__divider" />

          <EditorAiAssistant
            leftAiModel={props.leftAiModel}
            setLeftAiModel={props.setLeftAiModel}
            leftAiTone={props.leftAiTone}
            setLeftAiTone={props.setLeftAiTone}
            leftAiPrompt={props.leftAiPrompt}
            setLeftAiPrompt={props.setLeftAiPrompt}
            AI_MODELS={props.AI_MODELS}
            leftAiRunning={props.leftAiRunning}
            batchAiRunning={props.batchAiRunning}
            runLeftAiPrompt={props.runLeftAiPrompt}
            runBatchAiAcrossPages={props.runBatchAiAcrossPages}
            versionPreview={props.versionPreview}
          />
        </div>
      )}
    </aside>
  );
};
