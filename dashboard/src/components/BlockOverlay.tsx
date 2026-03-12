import { useTranslation } from "../i18n/useTranslation";
import React, { useCallback, useEffect, useRef,
useState } from "react";
import { fetchWithAuth } from "../api/client";
import { toast } from "./Toast";
import { getRequireApproval } from "../approval-settings";
import { ENDPOINTS } from "../config";

let __autoScrollDoneForKey: string | null = null;

async function __autoScrollOnce(win: Window, opts?: { stepPx?: number; delayMs?: number; maxSteps?: number }) {
  const stepPx = opts?.stepPx ?? 900;
  const delayMs = opts?.delayMs ?? 35;
  const maxSteps = opts?.maxSteps ?? 60;
  const doc = win.document;
  const getMaxScroll = () => Math.max(doc.documentElement?.scrollHeight || 0, doc.body?.scrollHeight || 0) - (win.innerHeight || 0);
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < maxSteps; i++) {
    const max = getMaxScroll();
    const y = Math.min(max, (i + 1) * stepPx);
    win.scrollTo(0, y);
    await sleep(delayMs);
    if (y >= max - 2) break;
  }
  win.scrollTo(0, 0);
  await sleep(80);
}

type BlockEntry = {
  id: string;
  label: string;
  selector: string;
  isButton: boolean;
  docTop: number;
  parentId?: string | null;
  kind?: string;
  pathSignature?: string;
  isExpandable?: boolean;
  isExpanded?: boolean;
  depth?: number;
};

type PanelType = "text" | "button" | "heading-list" | "nav-links" | "form-fields" | "generic" | "image" | "group";

type StructureSnapshotItem = {
  id: string;
  rootId: string;
  displayLabel: string;
  label: string;
  kind: string;
  childCount: number;
  isExpanded: boolean;
  isSelected: boolean;
};

type Props = {
  canvasMode?: boolean;

  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  enabled: boolean;
  blockFilter?: "all" | "button" | "heading" | "image" | "form" | "navigation" | "container" | "list" | "content";
  onStatus?: (s: "idle" | "blocked" | "ok") => void;
  onHtmlChange?: (html: string) => void;
};

function matchesBlockFilter(
  block: BlockEntry,
  filter: Props["blockFilter"]
): boolean {
  if (!filter || filter === "all") return true;
  if (filter === "button") return !!block.isButton || block.kind === "button";
  return (block.kind || "content") === filter;
}

const SUB_BLOCK_TOKEN = "-sub-";

function isSubBlockId(id: string | null | undefined): boolean {
  return String(id || "").includes(SUB_BLOCK_TOKEN);
}

function getBlockRootId(id: string | null | undefined): string | null {
  const value = String(id || "").trim();
  if (!value) return null;
  const markerIndex = value.indexOf(SUB_BLOCK_TOKEN);
  return markerIndex >= 0 ? value.slice(0, markerIndex) : value;
}

function parseTopLevelBlockNumber(id: string | null | undefined): number | null {
  const match = String(id || "").match(/^block-(\d+)$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function getElementDepth(el: Element): number {
  let depth = 0;
  let current: Element | null = el.parentElement;
  while (current && current.tagName.toLowerCase() !== "body") {
    depth += 1;
    current = current.parentElement;
  }
  return depth;
}

function getStableClassPart(el: Element): string {
  return String(el.getAttribute("class") || "")
    .split(/\s+/)
    .filter((cls) => cls && !cls.startsWith("__bo-") && /^[a-z][\w-]*$/i.test(cls))
    .slice(0, 2)
    .join(".");
}

function getElementTextWithoutMedia(el: Element): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("img, picture, svg, video, source, figure").forEach((node) => node.remove());
  return (clone.textContent || "").replace(/\s+/g, " ").trim();
}

function isPureImageLink(el: Element): el is HTMLAnchorElement {
  if (el.tagName.toLowerCase() !== "a") return false;
  return !!el.querySelector("img, picture img") && getElementTextWithoutMedia(el).length === 0;
}

function isMeaningfulVisibleNode(el: HTMLElement, win: Window): boolean {
  try {
    const style = win.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  } catch {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width >= 8 && rect.height >= 8;
}

function getCanonicalChildElement(el: HTMLElement, scopeRoot: HTMLElement): HTMLElement | null {
  if (el === scopeRoot || !scopeRoot.contains(el)) return null;
  const tag = el.tagName.toLowerCase();
  const cls = String(el.getAttribute("class") || "").toLowerCase();

  if (tag === "a") return el;
  if (tag === "button") return el;

  if (tag === "img") {
    const linkedImage = el.closest("a[href]") as HTMLElement | null;
    if (linkedImage && scopeRoot.contains(linkedImage) && isPureImageLink(linkedImage)) return linkedImage;
    const figure = el.closest("figure, .wp-block-image, .wp-block-cover") as HTMLElement | null;
    if (figure && scopeRoot.contains(figure)) return figure;
    return el;
  }

  if (tag === "figure" || cls.includes("wp-block-image") || cls.includes("wp-block-cover")) {
    const linkedImage = el.querySelector("a[href]") as HTMLElement | null;
    if (linkedImage && isPureImageLink(linkedImage)) return linkedImage;
    return el;
  }

  if (cls.includes("wp-block-button")) {
    return (el.querySelector("a.wp-block-button__link, button") as HTMLElement | null) || el;
  }

  if (/^h[1-6]$/.test(tag) || tag === "p" || tag === "ul" || tag === "ol" || tag === "form") {
    return el;
  }

  if (tag === "input" || tag === "textarea" || tag === "select") {
    const form = el.closest("form") as HTMLElement | null;
    return form && scopeRoot.contains(form) ? form : el;
  }

  if ((cls.includes("btn") || cls.includes("button")) && (tag === "div" || tag === "span")) {
    return (el.querySelector("a[href], button") as HTMLElement | null) || el;
  }

  return null;
}

function collectExpandedChildElements(containerEl: HTMLElement, win: Window): HTMLElement[] {
  const rawSelector = [
    "a[href]",
    "button",
    "img",
    "figure",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "ul",
    "ol",
    "form",
    "input",
    "textarea",
    "select",
    ".wp-block-button",
    ".wp-block-heading",
    ".wp-block-paragraph",
    ".wp-block-image",
    ".wp-block-list",
    ".wp-block-cover",
    "[class*='btn']",
    "[class*='button']",
  ].join(",");

  const rawNodes = Array.from(containerEl.querySelectorAll(rawSelector)) as HTMLElement[];
  const seen = new Set<HTMLElement>();
  const unique: HTMLElement[] = [];

  for (const rawNode of rawNodes) {
    const canonical = getCanonicalChildElement(rawNode, containerEl);
    if (!canonical || seen.has(canonical)) continue;
    if (!isMeaningfulVisibleNode(canonical, win)) continue;
    seen.add(canonical);
    unique.push(canonical);
  }

  unique.sort((a, b) => {
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    return aRect.top - bRect.top || aRect.left - bRect.left;
  });

  const deduped: HTMLElement[] = [];
  for (const candidate of unique) {
    const coveredBy = deduped.find((existing) => existing !== candidate && existing.contains(candidate));
    if (coveredBy) continue;
    deduped.push(candidate);
  }

  return deduped;
}

function getElementPathSignature(el: Element, scopeRoot?: Element | null): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current.tagName.toLowerCase() !== "html") {
    const parent: Element | null = current.parentElement;
    const siblings: Element[] = parent
      ? Array.from(parent.children).filter((sibling): sibling is Element => sibling.tagName === current!.tagName)
      : [current];
    const index = Math.max(1, siblings.indexOf(current) + 1);
    const classPart = getStableClassPart(current);
    const tag = current.tagName.toLowerCase();
    parts.unshift(`${tag}${classPart ? `.${classPart}` : ""}:${index}`);
    if (scopeRoot && current === scopeRoot) break;
    current = parent;
    if (!scopeRoot && current?.tagName.toLowerCase() === "body") {
      parts.unshift("body:1");
      break;
    }
  }
  return parts.join(">");
}

function isExpandableContainer(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  const cls = String(el.getAttribute("class") || "").toLowerCase();
  return ["header", "nav", "footer", "section", "main", "article", "aside", "div"].includes(tag) ||
    cls.includes("wp-block-group") ||
    cls.includes("wp-block-columns") ||
    cls.includes("wp-block-cover") ||
    cls.includes("shopify-section") ||
    cls.includes("site-header") ||
    cls.includes("site-nav") ||
    cls.includes("site-footer");
}

function titleCaseBlockLabel(label: string): string {
  const normalized = String(label || "block")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "Block";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getOrderedTopLevelBlocks(blocks: BlockEntry[]): BlockEntry[] {
  return blocks
    .filter((entry) => !entry.parentId)
    .sort((a, b) => a.docTop - b.docTop);
}

function getBlockDisplayLabel(block: BlockEntry, blocks: BlockEntry[]): string {
  const rootId = getBlockRootId(block.id) || block.id;
  const topLevel = getOrderedTopLevelBlocks(blocks);
  const rootIndex = Math.max(0, topLevel.findIndex((entry) => entry.id === rootId));
  const baseLabel = titleCaseBlockLabel(block.label);

  if (!block.parentId) {
    return `${rootIndex + 1}: ${baseLabel}`;
  }

  const childBlocks = blocks
    .filter((entry) => !!entry.parentId && getBlockRootId(entry.id) === rootId)
    .sort((a, b) => a.docTop - b.docTop);
  const childIndex = Math.max(0, childBlocks.findIndex((entry) => entry.id === block.id));
  return `${rootIndex + 1}.${childIndex + 1}: ${baseLabel}`;
}

function buildStructureSnapshot(blocks: BlockEntry[], selectedId: string | null): { items: StructureSnapshotItem[]; selectedRootId: string | null } {
  const selectedRootId = getBlockRootId(selectedId);
  const topLevel = getOrderedTopLevelBlocks(blocks);
  const items = topLevel.map((entry) => {
    const rootId = entry.id;
    const childCount = blocks.filter((block) => !!block.parentId && getBlockRootId(block.id) === rootId).length;
    return {
      id: entry.id,
      rootId,
      displayLabel: getBlockDisplayLabel(entry, blocks),
      label: entry.label,
      kind: entry.kind || "content",
      childCount,
      isExpanded: !!entry.isExpanded || childCount > 0,
      isSelected: selectedRootId === rootId,
    };
  });
  return { items, selectedRootId };
}

function buildGroupPreviewHtml(doc: Document, el: HTMLElement): string {
  const headClone = doc.head.cloneNode(true) as HTMLElement;
  headClone.querySelectorAll("script").forEach((node) => node.remove());
  const bodyClone = doc.createElement("body");
  bodyClone.style.margin = "0";
  bodyClone.style.background = "#ffffff";
  bodyClone.style.padding = "0";
  bodyClone.appendChild(el.cloneNode(true));
  return `<!doctype html><html>${headClone.outerHTML}${bodyClone.outerHTML}</html>`;
}

function collectSplitRootSegments(rootEl: HTMLElement, win: Window): HTMLElement[] {
  const rootRect = rootEl.getBoundingClientRect();
  const minBandHeight = Math.max(72, Math.min(220, rootRect.height * 0.14));
  const minBandWidth = Math.max(180, rootRect.width * 0.52);

  const semanticCandidates = Array.from(
    rootEl.querySelectorAll(
      [
        "section",
        "article",
        "form",
        "header",
        "footer",
        "main",
        "[class*='section']",
        "[class*='hero']",
        "[class*='contact']",
        "[class*='feature']",
        "[class*='story']",
        "[class*='pricing']",
        "[class*='faq']",
        "[class*='content']",
        "[class*='wrap']",
        "[class*='group']",
        "[class*='container']",
      ].join(",")
    )
  ).filter((node): node is HTMLElement => {
    if (!(node instanceof HTMLElement) || node === rootEl) return false;
    if (!isMeaningfulVisibleNode(node, win)) return false;
    const rect = node.getBoundingClientRect();
    return rect.height >= minBandHeight && rect.width >= minBandWidth;
  });

  const semanticTopLevel = semanticCandidates
    .filter((candidate) => !semanticCandidates.some((other) => other !== candidate && other.contains(candidate)))
    .sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return aRect.top - bRect.top || aRect.left - bRect.left;
    });

  if (semanticTopLevel.length >= 2) {
    return semanticTopLevel;
  }

  const isSegment = (node: Element): node is HTMLElement => {
    if (!(node instanceof HTMLElement)) return false;
    const tag = node.tagName.toLowerCase();
    if (["script", "style", "noscript"].includes(tag)) return false;
    if (!isMeaningfulVisibleNode(node, win)) return false;
    return node.getBoundingClientRect().height >= 36;
  };

  const groupByVerticalBand = (nodes: HTMLElement[]) => {
    const sorted = nodes
      .slice()
      .sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return aRect.top - bRect.top || aRect.left - bRect.left;
      });

    const groups: HTMLElement[][] = [];
    for (const node of sorted) {
      const rect = node.getBoundingClientRect();
      const group = groups[groups.length - 1];
      if (!group) {
        groups.push([node]);
        continue;
      }
      const referenceRects = group.map((entry) => entry.getBoundingClientRect());
      const latestBottom = Math.max(...referenceRects.map((entry) => entry.bottom));
      const earliestTop = Math.min(...referenceRects.map((entry) => entry.top));
      const overlapsVertically = rect.top <= latestBottom - 12;
      const isSameBand = overlapsVertically || Math.abs(rect.top - earliestTop) <= 36;
      if (isSameBand) group.push(node);
      else groups.push([node]);
    }
    return groups;
  };

  let current: HTMLElement | null = rootEl;
  let segments: HTMLElement[] = [];
  let depth = 0;

  while (current && depth < 8) {
    segments = Array.from(current.children).filter(isSegment);
    const bandGroups = groupByVerticalBand(segments);
    const bandRepresentatives = bandGroups
      .map((group) => {
        if (group.length === 1) return group[0];
        const fullWidth = group.find((node) => node.getBoundingClientRect().width >= minBandWidth);
        return fullWidth || group[0];
      })
      .filter((node, index, all) => all.indexOf(node) === index);

    if (bandRepresentatives.length >= 2) return bandRepresentatives;
    current = segments.length === 1 ? segments[0] : null;
    depth += 1;
  }

  const expandedSegments = collectExpandedChildElements(rootEl, win).filter((node) => node !== rootEl);
  const expandedBands = groupByVerticalBand(expandedSegments)
    .map((group) => {
      if (group.length === 1) return group[0];
      const widest = group
        .slice()
        .sort((left, right) => right.getBoundingClientRect().width - left.getBoundingClientRect().width)[0];
      return widest || group[0];
    })
    .filter((node, index, all) => all.indexOf(node) === index);
  if (expandedBands.length >= 2) return expandedBands;
  if (expandedSegments.length >= 2) return expandedSegments;

  return segments;
}

function findEditableFieldWrapper(node: HTMLElement, scope: HTMLElement): HTMLElement | null {
  const selectors = [
    "label",
    ".wpforms-field",
    ".gfield",
    ".form-field",
    ".field",
    ".jetpack-field",
    ".contact-form__input-group",
    "p",
    "li",
    "div",
  ];
  for (const selector of selectors) {
    const match = node.closest(selector) as HTMLElement | null;
    if (match && match !== scope && scope.contains(match)) return match;
  }
  return node.parentElement && node.parentElement !== scope ? node.parentElement : null;
}

function getEditableFormFieldRecords(scope: HTMLElement) {
  const doc = scope.ownerDocument;
  const labels = Array.from(doc.querySelectorAll("label")) as HTMLLabelElement[];
  const fields = Array.from(scope.querySelectorAll("input, textarea, select"))
    .filter((node) => String((node as HTMLElement).getAttribute("type") || "").toLowerCase() !== "hidden") as HTMLElement[];

  return fields.map((node) => {
    const currentId = node.getAttribute("id") || "";
    let labelEl =
      (currentId ? labels.find((label) => label.getAttribute("for") === currentId) || null : null) ||
      ((node.closest("label") as HTMLLabelElement | null) || null);
    if (labelEl && !scope.contains(labelEl) && !labelEl.closest("form")) {
      labelEl = null;
    }
    return {
      node,
      labelEl,
      wrapper: findEditableFieldWrapper(node, scope),
    };
  });
}

function setFormLabelText(labelEl: HTMLLabelElement | null, fieldNode: HTMLElement, text: string) {
  if (!labelEl) return;
  const nextText = String(text || "").trim();
  if (!nextText) return;

  if (!labelEl.contains(fieldNode)) {
    labelEl.textContent = nextText;
    return;
  }

  const textNodes = Array.from(labelEl.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
  if (textNodes[0]) {
    textNodes[0].textContent = `${nextText} `;
    textNodes.slice(1).forEach((node) => node.remove());
  } else {
    labelEl.insertBefore(labelEl.ownerDocument.createTextNode(`${nextText} `), labelEl.firstChild);
  }
}

function sanitizeFieldId(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findPrimaryTextTarget(el: HTMLElement): HTMLElement | null {
  const tag = el.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag) || ["p", "span", "li", "label", "figcaption", "blockquote", "small", "strong", "em"].includes(tag)) {
    return el;
  }
  const directChild = Array.from(el.children).find((child) =>
    /^(h[1-6]|p|span|li|label|figcaption|blockquote)$/i.test(child.tagName)
  ) as HTMLElement | undefined;
  if (directChild) return directChild;
  return el.querySelector("h1,h2,h3,h4,h5,h6,p,span,li,label,figcaption,blockquote,strong,em") as HTMLElement | null;
}

function getBlockKind(el: Element, label: string): string {
  const tag = el.tagName.toLowerCase();
  const lower = String(label || tag).toLowerCase();
  if (isPureImageLink(el)) return "image";
  if (isExpandableContainer(el) || lower.includes("section") || lower.includes("group") || lower.includes("columns")) return "container";
  if (lower.includes("button") || lower.includes("cta") || tag === "button") return "button";
  if (lower.includes("heading") || /^h[1-6]$/.test(tag)) return "heading";
  if (tag === "a" && !!(el.closest("nav,header,footer") || el.querySelector("span, strong, em"))) return "navigation";
  if (lower.includes("image") || lower.includes("gallery") || tag === "img" || tag === "figure") return "image";
  if (lower.includes("form") || tag === "form") return "form";
  if (lower.includes("nav") || tag === "nav") return "navigation";
  if (lower.includes("list") || tag === "ul" || tag === "ol") return "list";
  return "content";
}

// Universal Block Discovery - Works on ANY website regardless of broken JS
function discoverUniversalBlocks(doc: Document): Map<string, string> {
  const discoveries = new Map<string, string>();
  
  // Find ALL clickable elements (no dependency on JS working)
  const clickables = doc.querySelectorAll('a, button, [onclick], [role="button"], [data-toggle], .dropdown-toggle, .accordion-header, input[type="button"], input[type="submit"]');
  
  clickables.forEach((el) => {
    try {
      const element = el as HTMLElement;
      const selector = generateSelector(element);
      
      // Skip if selector generation failed
      if (selector === 'element-issue') {
        discoveries.set(selector, 'Issue: Cannot generate valid selector');
        return;
      }
      
      // Analyze what this element does WITHOUT triggering it
      let behavior = 'clickable';
      let description = '';
      
      // Check if it's a link
      if (element.tagName === 'A') {
        const href = (element as HTMLAnchorElement).href;
        if (href && href !== '#') {
          behavior = 'link';
          description = `Links to: ${href}`;
        } else if (href === '#' || !href) {
          behavior = 'anchor';
          description = 'Page anchor or action button';
        }
      }
      
      // Check if it's a button
      if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
        const text = (element.textContent || '').trim();
        const type = element.getAttribute('type');
        
        if (type === 'submit') {
          behavior = 'submit';
          description = 'Submits form';
        } else if (type === 'reset') {
          behavior = 'reset';
          description = 'Resets form';
        } else if (text.toLowerCase().includes('menu') || element.closest('nav')) {
          behavior = 'menu';
          description = 'Menu button';
        } else if (text.toLowerCase().includes('search')) {
          behavior = 'search';
          description = 'Search button';
        } else if (text.toLowerCase().includes('cart') || text.toLowerCase().includes('basket')) {
          behavior = 'cart';
          description = 'Shopping cart';
        } else if (text.toLowerCase().includes('login') || text.toLowerCase().includes('sign in')) {
          behavior = 'login';
          description = 'Login button';
        } else if (text.toLowerCase().includes('register') || text.toLowerCase().includes('sign up')) {
          behavior = 'register';
          description = 'Registration button';
        } else if (text.toLowerCase().includes('download')) {
          behavior = 'download';
          description = 'Download button';
        } else if (text.toLowerCase().includes('play')) {
          behavior = 'play';
          description = 'Play button';
        } else {
          behavior = 'button';
          description = `Button: ${text}`;
        }
      }
      
      // Check for dropdown indicators
      if (element.hasAttribute('data-toggle') || element.classList.contains('dropdown-toggle') || element.closest('.dropdown')) {
        behavior = 'dropdown';
        description = 'Dropdown menu';
        
        // Find dropdown items without triggering
        const dropdownId = element.getAttribute('data-target') || element.getAttribute('href');
        if (dropdownId) {
          try {
            const dropdown = doc.querySelector(dropdownId);
            if (dropdown) {
              const items = dropdown.querySelectorAll('a, li, button');
              if (items.length > 0) {
                const itemCount = items.length;
                const itemTexts = Array.from(items).slice(0, 3).map(item => 
                  (item.textContent || '').trim()
                ).filter(text => text);
                
                if (itemCount > 3) {
                  description += ` containing: ${itemTexts.join(', ')} +${itemCount - 3} more`;
                } else {
                  description += ` containing: ${itemTexts.join(', ')}`;
                }
              }
            }
          } catch (e) {
            description += ' (cannot analyze items)';
          }
        }
      }
      
      // Check for accordion/collapsible
      if (element.closest('.accordion') || element.closest('.collapse') || element.hasAttribute('data-toggle') && element.getAttribute('data-toggle') === 'collapse') {
        behavior = 'accordion';
        description = 'Collapsible section';
      }
      
      // Check for tabs
      if (element.closest('[role="tablist"]') || element.getAttribute('role') === 'tab') {
        behavior = 'tab';
        description = 'Tab navigation';
      }
      
      // Check for modal triggers
      if (element.hasAttribute('data-target') && element.getAttribute('data-target')?.includes('modal') || element.closest('.modal')) {
        behavior = 'modal';
        description = 'Modal popup';
      }
      
      // Check for form inputs
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
        behavior = 'input';
        const type = element.getAttribute('type') || element.tagName.toLowerCase();
        const placeholder = element.getAttribute('placeholder') || '';
        description = `Input field: ${type}${placeholder ? ` (${placeholder})` : ''}`;
      }
      
      // Store discovery with description
      discoveries.set(selector, description || behavior);
    } catch (error) {
      // Skip problematic elements but continue processing others
      console.warn('Skipping problematic element:', (error as Error).message);
    }
  });
  
  return discoveries;
}

// Generate unique selector for element with error handling
function generateSelector(el: Element): string {
  try {
    if (el.id) {
      // Ensure ID is valid (no special chars)
      const id = el.id.replace(/[^a-zA-Z0-9_-]/g, '');
      if (id) return `#${id}`;
    }
    
    if (el.className) {
      const classes = el.className.split(' ')
        .filter(c => c && !c.includes('wp-block') && /^[a-zA-Z][\w-]*$/.test(c))
        .slice(0, 2); // Limit to 2 classes
      if (classes.length > 0) return `.${classes.join('.')}`;
    }
    
    // Use tag with data attributes if available
    if (el.getAttribute('data-block-id')) {
      return `${el.tagName.toLowerCase()}[data-block-id="${el.getAttribute('data-block-id')}"]`;
    }
    
    // Fallback to tag with nth-child to ensure uniqueness
    const parent = el.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(el) + 1;
      return `${el.tagName.toLowerCase()}:nth-child(${index})`;
    }
    
    return el.tagName.toLowerCase();
  } catch (error) {
    // If selector generation fails, return safe fallback
    return 'element-issue';
  }
}

// Enhanced block detection with universal discovery
function pickLabel(el: Element, discoveries?: Map<string, string>): string {
  const tag = el.tagName.toLowerCase();
  const cls = (el.getAttribute("class") || "").trim();
  if (isPureImageLink(el)) return "image";
  
  // Check if element was discovered as interactive
  if (discoveries) {
    const selector = generateSelector(el);
    const discoveredBehavior = discoveries.get(selector);
    if (discoveredBehavior) {
      return discoveredBehavior;
    }
  }
  
  // WP Blocks
  if (cls.includes("wp-block-button")) return "button";
  if (cls.includes("wp-block-heading")) return "heading";
  if (cls.includes("wp-block-image")) return "image";
  if (cls.includes("wp-block-cover")) return "cover/image";
  if (cls.includes("wp-block-media-text")) return "media+text";
  if (cls.includes("wp-block-columns")) return "columns";
  if (cls.includes("wp-block-column")) return "column";
  if (cls.includes("wp-block-group")) return "group";
  if (cls.includes("wp-block-paragraph")) return "text";
  if (cls.includes("wp-block-list")) return "list";
  if (cls.includes("wp-block-gallery")) return "gallery";
  if (cls.includes("wp-block-video")) return "video";
  if (cls.includes("wp-block-embed")) return "embed";
  if (cls.includes("jetpack-contact-form") || cls.includes("contact-form")) return "form";
  if (cls.includes("wp-block-separator")) return "divider";
  // HTML tags
  if (tag === "header") return "header";
  if (tag === "nav") return "nav";
  if (tag === "main") return "main";
  if (tag === "footer") return "footer";
  if (tag === "section") return "section";
  if (tag === "article") return "article";
  if (tag === "form") return "form";
  if (tag === "h1" || tag === "h2" || tag === "h3") return "heading";
  if (tag === "p") return "text";
  if (tag === "ul" || tag === "ol") return "list";
  if (tag === "a" && (el as HTMLAnchorElement).href) return "link";
  if (tag === "button") return "button";
  if (tag === "input" || tag === "textarea" || tag === "select") return "input";
  // Image detection (consolidated)
  if (tag === "img" || tag === "figure" || 
      cls.includes("wp-block-image") || cls.includes("wp-block-cover")) return "image";
  if (tag === "video") return "video";
  return tag;
}

function isButtonElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  const cls = el.getAttribute("class") || "";
  return cls.includes("wp-block-button") || cls.includes("wp-block-button__link") ||
    tag === "button" || el.getAttribute("role") === "button" ||
    (tag === "a" && (cls.includes("btn") || cls.includes("button")));
}

function findButtonNode(el: HTMLElement): HTMLAnchorElement | HTMLButtonElement | null {
  if (el.tagName.toLowerCase() === "a") {
    return isPureImageLink(el) ? null : (el as HTMLAnchorElement);
  }
  if (el.tagName.toLowerCase() === "button") return el as HTMLButtonElement;
  if ((el.getAttribute("class") || "").includes("wp-block-button")) {
    return el.querySelector("a.wp-block-button__link, button") as HTMLAnchorElement | HTMLButtonElement | null;
  }
  const candidates = Array.from(
    el.querySelectorAll("button, [role='button'], a.wp-block-button__link, a[class*='btn'], a[class*='button']")
  ) as Array<HTMLAnchorElement | HTMLButtonElement>;
  return candidates.find((candidate) => {
    if (candidate.tagName.toLowerCase() !== "a") return true;
    return !isPureImageLink(candidate);
  }) || null;
}

function findImageNode(el: HTMLElement): HTMLImageElement | null {
  if (el.tagName.toLowerCase() === "img") return el as HTMLImageElement;
  return el.querySelector("img");
}

function findImageLinkNode(el: HTMLElement, imageNode: HTMLImageElement | null): HTMLAnchorElement | null {
  if (el.tagName.toLowerCase() === "a" && imageNode) return el as HTMLAnchorElement;
  const link = imageNode?.closest("a[href]") as HTMLAnchorElement | null;
  return link && el.contains(link) ? link : null;
}

function findImageFigure(el: HTMLElement, imageNode: HTMLImageElement | null): HTMLElement | null {
  const figure = imageNode?.closest("figure") as HTMLElement | null;
  return figure && el.contains(figure) ? figure : null;
}

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return rgb.startsWith("#") ? rgb : "#3b82f6";
  return "#" + [m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, "0")).join("");
}

function normalizeStyleColor(value: string, fallback = ""): string {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "transparent" || normalized === "rgba(0, 0, 0, 0)") return fallback;
  return rgbToHex(value);
}

function serializeIframeHtml(doc: Document): string {
  // IMPORTANT: work on a clone so we don't mutate the live iframe DOM
  const clone = doc.documentElement.cloneNode(true) as HTMLElement;

  clone
    .querySelectorAll(".__bo-box, .__bo-label-outside, #__block-overlay-css")
    .forEach(el => el.remove());

  // Export rule: preview-uploaded images (blob:) become placeholders for WP
  clone.querySelectorAll("img").forEach((img) => {
    const src = (img.getAttribute("src") || "").trim();
    if (src.startsWith("blob:")) {
      img.setAttribute("data-bo-placeholder", "1");
      img.setAttribute("src", "");
      const alt = (img.getAttribute("alt") || "").trim();
      if (!alt) img.setAttribute("alt", "TODO: Bild in WordPress ersetzen");
    }
  });


  const dt = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>` : "<!DOCTYPE html>";
  
    // Export rule: local-preview images must NOT be shipped in ZIP.
    // Replace with a placeholder so user can re-attach in WordPress Media Library.
    clone.querySelectorAll("img").forEach((img) => {
      const src = (img.getAttribute("src") || "").trim();
      const isLocal = img.getAttribute("data-bo-local-src") === "1";
      const isBlob = src.startsWith("blob:");
      const isData = src.startsWith("data:");
      if (isLocal || isBlob || isData) {
        img.setAttribute("src", "__REPLACE_IN_WORDPRESS__");
        img.setAttribute("data-bo-note", "Replace image in WordPress Media Library");
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
      }
      img.removeAttribute("data-bo-local-src");
    });

return `${dt}\n${clone.outerHTML}`;

}

function ensureOverlayCss(doc: Document) {
  if (doc.getElementById("__block-overlay-css")) return;
  const style = doc.createElement("style");
  style.id = "__block-overlay-css";
  style.textContent = `
    .__bo-box {
      position: absolute !important;
      pointer-events: none !important;
      border-radius: 8px !important;
      box-sizing: border-box !important;
      z-index: 99998 !important;
    }
    .__bo-label-outside {
      position: absolute !important;
      pointer-events: auto !important;
      cursor: pointer !important;
      font-size: 11px !important;
      font-weight: 800 !important;
      padding: 3px 8px !important;
      border-radius: 999px !important;
      color: white !important;
      font-family: system-ui, sans-serif !important;
      white-space: nowrap !important;
      z-index: 99999 !important;
      user-select: none !important;
      line-height: 16px !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25) !important;
    }
    .__bo-label-outside:hover {
      opacity: 0.85 !important;
    }
  `;
  doc.head.appendChild(style);
}

// Color coding nach Block-Typ
function getBlockColor(label: string, isSel: boolean, isHover: boolean): {bg: string; border: string; box: string} {
  if (isSel) return { bg: "rgba(59,130,246,0.95)", border: "rgba(59,130,246,0.95)", box: "rgba(59,130,246,0.08)" };
  if (isHover) return { bg: "rgba(34,197,94,0.95)", border: "rgba(34,197,94,0.95)", box: "rgba(34,197,94,0.06)" };
  const l = label.toLowerCase();
  if (l.includes("button") || l.includes("cta")) return { bg: "rgba(239,68,68,0.9)", border: "rgba(239,68,68,0.7)", box: "rgba(239,68,68,0.04)" };
  if (l.includes("heading")) return { bg: "rgba(168,85,247,0.9)", border: "rgba(168,85,247,0.7)", box: "rgba(168,85,247,0.04)" };
  if (l.includes("nav") || l.includes("menu")) return { bg: "rgba(14,165,233,0.9)", border: "rgba(14,165,233,0.7)", box: "rgba(14,165,233,0.04)" };
  if (l.includes("image") || l.includes("img") || l.includes("cover") || l.includes("gallery") || l.includes("figure") || l.includes("media")) return { bg: "rgba(20,184,166,0.9)", border: "rgba(20,184,166,0.7)", box: "rgba(20,184,166,0.04)" };
  if (l.includes("video") || l.includes("embed")) return { bg: "rgba(6,182,212,0.9)", border: "rgba(6,182,212,0.7)", box: "rgba(6,182,212,0.04)" };
  if (l.includes("form") || l.includes("input")) return { bg: "rgba(234,179,8,0.9)", border: "rgba(234,179,8,0.7)", box: "rgba(234,179,8,0.04)" };
  if (l.includes("footer")) return { bg: "rgba(100,116,139,0.9)", border: "rgba(100,116,139,0.7)", box: "rgba(100,116,139,0.04)" };
  if (l.includes("header")) return { bg: "rgba(251,146,60,0.9)", border: "rgba(251,146,60,0.7)", box: "rgba(251,146,60,0.04)" };
  if (l.includes("text") || l.includes("paragraph")) return { bg: "rgba(156,163,175,0.9)", border: "rgba(156,163,175,0.7)", box: "rgba(156,163,175,0.03)" };
  if (l.includes("list")) return { bg: "rgba(167,139,250,0.9)", border: "rgba(167,139,250,0.7)", box: "rgba(167,139,250,0.03)" };
  if (l.includes("column") || l.includes("columns")) return { bg: "rgba(245,158,11,0.9)", border: "rgba(245,158,11,0.7)", box: "rgba(245,158,11,0.03)" };
  if (l.includes("group") || l.includes("section") || l.includes("article")) return { bg: "rgba(245,158,11,0.85)", border: "rgba(245,158,11,0.65)", box: "rgba(245,158,11,0.03)" };
  return { bg: "rgba(245,158,11,0.9)", border: "rgba(245,158,11,0.75)", box: "rgba(245,158,11,0.03)" };
}

function renderBoxesInIframe(
  doc: Document,
  blocks: BlockEntry[],
  hoverId: string | null,
  selectedId: string | null,
  onClickLabel: (id: string) => void
) {
  if (!doc.body) return;
  ensureOverlayCss(doc);
  doc.querySelectorAll(".__bo-box, .__bo-label-outside").forEach(el => el.remove());
  const win = doc.defaultView;
  if (!win) return;

  const viewTop = win.scrollY;
  const viewBottom = win.scrollY + win.innerHeight;

  // Label-Slots nur für Label-gegen-Label Overlap
  const usedSlots: Array<{left: number; right: number; top: number; bottom: number}> = [];

  function findFreeLabelPos(preferredLeft: number, labelWidth: number, labelH: number, preferredTop: number): {left: number; top: number} {
    const minTop = viewTop + 2;
    let left = preferredLeft;
    let top = Math.max(minTop, preferredTop - labelH - 2);

    for (let attempt = 0; attempt < 24; attempt++) {
      const bottom = top + labelH;
      const right = left + labelWidth;
      const blocker = usedSlots.find(s =>
        s.top < bottom && s.bottom > top && s.left < right && s.right > left
      );
      if (!blocker) break;

      // Erst versuchen: nach rechts neben den Blocker
      const tryLeft = blocker.right + 4;
      const rightBlocked = usedSlots.some(s =>
        s.top < bottom && s.bottom > top && s.left < tryLeft + labelWidth && s.right > tryLeft
      );
      if (!rightBlocked) { left = tryLeft; break; }

      // Sonst: nach oben (eine Reihe höher)
      top -= labelH + 2;
      if (top < minTop) { top = minTop; left = blocker.right + 4; break; }
    }

    usedSlots.push({ left, right: left + labelWidth, top, bottom: top + labelH });
    return { left, top };
  }

  // Build map of all block elements for parent-child detection
  const blockEls = new Map<string, HTMLElement>();
  for (const b of blocks) {
    const el = doc.querySelector(b.selector) as HTMLElement | null;
    if (el) blockEls.set(b.id, el);
  }
  const selectedRootId = getBlockRootId(selectedId);
  const expandedRootId = selectedRootId && blocks.some((entry) => entry.id.startsWith(`${selectedRootId}${SUB_BLOCK_TOKEN}`))
    ? selectedRootId
    : null;

  for (const b of blocks) {
    const target = blockEls.get(b.id) || null;
    if (!target) continue;
    if (expandedRootId && b.id === expandedRootId && b.isExpanded) continue;
    const rect = target.getBoundingClientRect();
    const docLeft = rect.left + win.scrollX;
    const docTop = rect.top + win.scrollY;
    const docBottom = docTop + rect.height;
    if (rect.width < 1 || rect.height < 1) continue;

    // Hide children of non-selected parent blocks
    let isChildOfNonSelected = false;
    for (const [otherId, otherEl] of blockEls) {
      if (otherId === b.id) continue;
      if (otherEl !== target && otherEl.contains(target)) {
        const sameExpandedFamily =
          !!expandedRootId &&
          (getBlockRootId(otherId) === expandedRootId || getBlockRootId(b.id) === expandedRootId);
        if (sameExpandedFamily) continue;
        if (otherId !== selectedId) { isChildOfNonSelected = true; break; }
      }
    }
    if (isChildOfNonSelected) continue;

    const visibleTop = Math.max(docTop, viewTop);
    const visibleBottom = Math.min(docBottom, viewBottom);
    const isVisible = visibleBottom - visibleTop > 20;
    if (!isVisible) continue;

    const isSel = selectedId === b.id;
    const isHover = hoverId === b.id;
    const colors = getBlockColor(b.label, isSel, isHover);

    // Rahmen-Box
    const box = doc.createElement("div");
    box.className = "__bo-box";
    box.setAttribute("data-bo-id", b.id);
    box.style.cssText = `left:${docLeft}px;top:${docTop}px;width:${rect.width}px;height:${rect.height}px;border:2px solid ${colors.border};background:${colors.box};`;
    doc.body.appendChild(box);

    // Label
    const labelText = getBlockDisplayLabel(b, blocks);
    const estimatedWidth = labelText.length * 8 + 16;
    const labelH = 22;
    const labelPos = findFreeLabelPos(docLeft, estimatedWidth, labelH, docTop);

    const label = doc.createElement("div");
    label.className = "__bo-label-outside";
    label.setAttribute("data-bo-label-id", b.id);
    label.style.cssText = `left:${labelPos.left}px;top:${labelPos.top}px;background:${colors.bg};`;
    label.textContent = labelText;
    label.addEventListener("click", (e) => { e.stopPropagation(); onClickLabel(b.id); });
    doc.body.appendChild(label);
  }
}
export default function BlockOverlay({ iframeRef, enabled, canvasMode, blockFilter = "all", onStatus, onHtmlChange }: Props) {

  const { t } = useTranslation();
  const boApplyCanvasMode = (on: boolean) => {
    const iframe = iframeRef?.current
    const doc = iframe?.contentDocument || null
    const win = iframe?.contentWindow || null
    if (!doc || !win) return

    const body = doc.body as HTMLElement
    if (!body) return

    const els = (Array.from(doc.querySelectorAll("[data-block-id]"))
      .filter((el) => !(el.parentElement?.closest("[data-block-id]")))) as HTMLElement[]
    if (!els.length) return

    if (!on) {
      for (const el of els) {
        const prev = el.getAttribute("data-bo-prev-style")
        if (prev != null) {
          el.setAttribute("style", prev)
          el.removeAttribute("data-bo-prev-style")
        } else {
          el.style.removeProperty("position")
          el.style.removeProperty("left")
          el.style.removeProperty("top")
          el.style.removeProperty("width")
          el.style.removeProperty("height")
          el.style.removeProperty("margin")
        }
      }
      body.style.removeProperty("min-height")
      body.style.removeProperty("position")
      return
    }

    const measured: Array<{ el: HTMLElement; left: number; top: number; w: number; h: number }> = []

    for (const el of els) {
      if (!el.getAttribute("data-bo-prev-style")) {
        el.setAttribute("data-bo-prev-style", el.getAttribute("style") || "")
      }
      const r = el.getBoundingClientRect()
      measured.push({
        el,
        left: r.left + win.scrollX,
        top: r.top + win.scrollY,
        w: Math.max(1, r.width),
        h: Math.max(1, r.height),
      })
    }

    body.style.position = "relative"

    let maxBottom = 0
    for (const m of measured) {
      const el = m.el
      el.style.position = "absolute"
      el.style.left = `${m.left}px`
      el.style.top = `${m.top}px`
      el.style.width = `${m.w}px`
      el.style.minHeight = `${m.h}px`
      el.style.margin = "0"
      maxBottom = Math.max(maxBottom, m.top + m.h)
    }

    body.style.minHeight = `${Math.max(maxBottom + 200, win.innerHeight + win.scrollY + 200)}px`
  }

  // BO_PLACE_GRID
  const [boPickArmed, setBoPickArmed] = useState(false);
  const [boPickType, setBoPickType] = useState<string>("");
  const [boGridRect, setBoGridRect] = useState<{left:number;top:number;width:number;height:number} | null>(null);
  const historyRef = useRef<string[]>([]);
  const [blocks, setBlocks] = useState<BlockEntry[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pushHistorySnapshot = useCallback((doc?: Document | null) => {
    const d = doc || iframeRef.current?.contentDocument || null;
    if (!d) return;
    const html = serializeIframeHtml(d);
    const arr = historyRef.current;
    if (arr.length && arr[arr.length - 1] === html) return;
    arr.push(html);
    if (arr.length > 40) arr.splice(0, arr.length - 40);
  }, [iframeRef]);

  const undoLastChange = useCallback(() => {
    const arr = historyRef.current;
    if (arr.length < 2) {
      toast.error(t("No undo history available."));
      return;
    }
    arr.pop();
    const prev = arr[arr.length - 1];
    try { onHtmlChange?.(prev); } catch {}
    setTimeout(() => {
      try { window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { mode: "page" } })); } catch {}
    }, 120);
  }, [onHtmlChange]);

  const commitDocumentMutation = useCallback((doc: Document, opts?: { forceRescan?: boolean; preserveSelectionId?: string | null }) => {
    try { onHtmlChange?.(serializeIframeHtml(doc)); } catch (e) { console.warn("serialize error:", e); }
    const keepId = opts?.preserveSelectionId ?? null;
    window.setTimeout(() => {
      if (keepId) setSelectedId(keepId);
      try { window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { force: opts?.forceRescan !== false } })); } catch {}
    }, 20);
  }, [onHtmlChange]);

  // Draw-to-Place
  const [drawRect, setDrawRect] = useState<{left:number;top:number;width:number;height:number} | null>(null);

  const boUpdateGridRect = () => {
    const iframe = iframeRef.current;
    if (!iframe) { setBoGridRect(null); return; }
    const r = iframe.getBoundingClientRect();
    setBoGridRect({ left: r.left, top: r.top, width: r.width, height: r.height });
  };

  
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument || null
    if (!doc) return

    if (!enabled) {
      boApplyCanvasMode(false)
      return
    }

    // Entering edit mode must not rewrite srcdoc from a freshly serialized iframe.
    // That re-render can blank dynamic pages before the overlay even finishes scanning.
    boApplyCanvasMode(!!canvasMode)

    return () => {
      if (canvasMode) boApplyCanvasMode(false)
    }
  }, [enabled, canvasMode, iframeRef])


  useEffect(() => {
    if (!enabled) return

    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!iframe || !doc) return

    const stopInteractive = (e: Event) => {
      const t = e.target as HTMLElement | null
      if (!t) return

      // Always stop images from triggering navigation
      if (t.tagName === 'IMG' || t.closest('img')) {
        e.preventDefault()
        e.stopPropagation()
        try { (e as any).stopImmediatePropagation?.() } catch {}
        return
      }

      const interactive = t.closest("a, button, select, option, input, textarea, label, form, summary, details")
      if (!interactive) return

      e.preventDefault()
      e.stopPropagation()
      try { (e as any).stopImmediatePropagation?.() } catch {}

      if (interactive instanceof HTMLElement) {
        try { interactive.blur() } catch {}
      }
    }

    const stopSubmit = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      try { (e as any).stopImmediatePropagation?.() } catch {}
    }

    doc.addEventListener("click", stopInteractive, true)
    doc.addEventListener("mousedown", stopInteractive, true)
    doc.addEventListener("mouseup", stopInteractive, true)
    doc.addEventListener("pointerdown", stopInteractive, true)
    doc.addEventListener("pointerup", stopInteractive, true)
    doc.addEventListener("change", stopInteractive, true)
    doc.addEventListener("submit", stopSubmit, true)

    return () => {
      try {
        doc.removeEventListener("click", stopInteractive, true)
        doc.removeEventListener("mousedown", stopInteractive, true)
        doc.removeEventListener("mouseup", stopInteractive, true)
        doc.removeEventListener("pointerdown", stopInteractive, true)
        doc.removeEventListener("pointerup", stopInteractive, true)
        doc.removeEventListener("change", stopInteractive, true)
        doc.removeEventListener("submit", stopSubmit, true)
      } catch (cleanupError) {
        console.warn("Interactive events cleanup error:", cleanupError)
      }
    }
  }, [enabled, iframeRef])


useEffect(() => {
    const onPick = (ev: Event) => {
      const ce = ev as any;
      const t = String(ce?.detail?.blockType || "");
      if (!t) return;
      setBoPickType(t);
      setBoPickArmed(true);
      boUpdateGridRect();
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setBoPickArmed(false); setBoPickType(""); setBoGridRect(null); }
    };
    window.addEventListener("bo:pick-block", onPick as any);
    window.addEventListener("resize", boUpdateGridRect as any);

    // ResizeObserver auf iframe – feuert auch bei Safari fullscreen
    let resizeObs: ResizeObserver | null = null
    const iframeEl = iframeRef.current
    if (typeof ResizeObserver !== "undefined" && iframeEl) {
      resizeObs = new ResizeObserver(() => {
        boUpdateGridRect()
        setTimeout(() => {
          try { scanFreePrecise() } catch {}
        }, 150)
      })
      resizeObs.observe(iframeEl)
    }

    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("bo:pick-block", onPick as any);
      window.removeEventListener("resize", boUpdateGridRect as any);
      resizeObs?.disconnect();
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    if (!boPickArmed) return;
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!iframe || !doc || !win) return;

    let startX = 0, startY = 0;
    let drawing = false;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const r = iframe.getBoundingClientRect();
      startX = e.clientX - r.left;
      startY = e.clientY - r.top;
      drawing = true;
      setDrawRect({ left: e.clientX, top: e.clientY, width: 0, height: 0 });
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!drawing) return;
      const r = iframe.getBoundingClientRect();
      const curX = e.clientX - r.left;
      const curY = e.clientY - r.top;
      const left = Math.min(startX, curX) + r.left;
      const top = Math.min(startY, curY) + r.top;
      const width = Math.abs(curX - startX);
      const height = Math.abs(curY - startY);
      setDrawRect({ left, top, width, height });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!drawing) return;
      drawing = false;
      setDrawRect(null);

      const r = iframe.getBoundingClientRect();
      const endX = e.clientX - r.left;
      const endY = e.clientY - r.top;
      const rectW = Math.abs(endX - startX);
      const rectH = Math.abs(endY - startY);

      // Zu kleines Rechteck → ignorieren (responsive minimum size)
      const minSize = window.innerWidth < 768 ? 15 : 20; // Smaller on mobile
      if (rectW < minSize || rectH < minSize) {
        setBoPickArmed(false);
        setBoPickType("");
        setBoGridRect(null);
        return;
      }

      const type = (boPickType || "paragraph").toLowerCase();
      const templates: Record<string, string> = {
        button: '<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Click Here</a></div>',
        image: '<figure class="wp-block-image size-large" style="margin:0;height:100%;"><img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDgwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNGM0Y0RjYiLz48dGV4dCB4PSI0MDAiIHk9IjIwMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSIjOUNBM0FGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgUGxhY2Vob2xkZXI8L3RleHQ+PC9zdmc+" alt="Image placeholder" style="width:100%;height:100%;object-fit:cover;display:block;" /></figure>',
        heading: '<h2 class="wp-block-heading">Your Heading Here</h2>',
        list: '<ul class="wp-block-list"><li>First item</li><li>Second item</li><li>Third item</li></ul>',
        section: '<div class="wp-block-group" style="padding:40px 20px"><h2 class="wp-block-heading">Section Title</h2><p>Add your content here.</p></div>',
        divider: '<hr class="wp-block-separator"/>',
        paragraph: '<p>Your paragraph content goes here.</p>',
      };

      const html = templates[type] || templates.paragraph;
      const wrap = doc.createElement("div");
      wrap.innerHTML = html;
      const node = wrap.firstElementChild as HTMLElement | null;
      if (!node) return;

      // Y-Range des gezeichneten Rechtecks (Dokument-Koordinaten)
      const drawDocTop = Math.min(startY, endY) + win.scrollY;
      const drawDocBottom = Math.max(startY, endY) + win.scrollY;
      const drawDocLeft = Math.min(startX, endX) + win.scrollX;
      const centerX = drawDocLeft + rectW / 2;
      const iframeW = iframe.getBoundingClientRect().width;

      // Alle Blocks die die Y-Range überschneiden finden
      const overlappingBlocks = blocksRef.current.filter(b => {
        const el = doc.querySelector(b.selector) as HTMLElement | null;
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const elTop = r.top + win.scrollY;
        const elBottom = elTop + r.height;
        return elTop < drawDocBottom - 10 && elBottom > drawDocTop + 10;
      }).sort((a, b) => a.docTop - b.docTop);

      if (type === "image" && overlappingBlocks.length > 0) {
        // Bild-Spezial-Logik: alle überschneidenden Blocks in Column zusammenfassen
        const leftOfDraw = centerX < iframeW / 2;

        // Content-Column: alle überschneidenden Blocks in einen wrapper
        const contentCol = doc.createElement("div");
        contentCol.className = "wp-block-column";
        contentCol.style.cssText = "flex:1;min-width:0;display:flex;flex-direction:column;gap:1em;";

        const firstBlock = doc.querySelector(overlappingBlocks[0].selector) as HTMLElement | null;
        if (!firstBlock || !firstBlock.parentElement) {
          if (!doc.body) return;
          doc.body.appendChild(node);
        }
        else {
          // Bild-Column: gezeichnete Breite als flex-basis verwenden
          const iframeW2 = iframe.getBoundingClientRect().width;
          const imgWidthPct = Math.round((rectW / iframeW2) * 100);
          node.style.width = "100%";
          node.style.height = "100%";
          node.style.margin = "0";
          const imgEl = node.querySelector("img") as HTMLImageElement | null;
          if (imgEl) { imgEl.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;"; }
          const imgCol = doc.createElement("div");
          imgCol.className = "wp-block-column";
          // Gezeichnete Breite für Bild, Rest für Content
          imgCol.style.cssText = `flex:0 0 ${imgWidthPct}%;min-width:0;`;

          // Content-Column bekommt den restlichen Platz
          contentCol.style.cssText = `flex:1;min-width:0;display:flex;flex-direction:column;gap:1em;`;
          imgCol.appendChild(node);

          // Columns-Wrapper ZUERST einfügen (bevor Blocks verschoben werden!)
          const colWrap = doc.createElement("div");
          colWrap.className = "wp-block-columns is-layout-flex";
          colWrap.style.cssText = "display:flex;gap:2em;align-items:stretch;width:100%;";

          if (leftOfDraw) {
            colWrap.appendChild(imgCol);
            colWrap.appendChild(contentCol);
          } else {
            colWrap.appendChild(contentCol);
            colWrap.appendChild(imgCol);
          }

          // colWrap VOR firstBlock einfügen
          firstBlock.parentElement.insertBefore(colWrap, firstBlock);

          // DANN Blocks in contentCol verschieben (nach insertBefore!)
          overlappingBlocks.forEach(b => {
            const el = doc.querySelector(b.selector) as HTMLElement | null;
            if (el) contentCol.appendChild(el);
          });
        }
      } else {
        // Normaler Block: nächsten Block finden und davor/danach einfügen
        node.style.width = rectW / iframeW < 0.95 ? `${Math.round(rectW / iframeW * 100)}%` : "100%";
        node.style.minHeight = `${Math.round(rectH)}px`;
        node.style.boxSizing = "border-box";

        const centerY = Math.min(startY, endY) + rectH / 2 + win.scrollY;
        let bestBlock = overlappingBlocks[0] || null;
        if (!bestBlock) {
          // Fallback: nächster Block per Distanz
          let bestDist = Infinity;
          for (const b of blocksRef.current) {
            const el = doc.querySelector(b.selector) as HTMLElement | null;
            if (!el) continue;
            const r = el.getBoundingClientRect();
            const dist = Math.abs((r.top + win.scrollY + r.height/2) - centerY);
            if (dist < bestDist) { bestDist = dist; bestBlock = b; }
          }
        }

      pushHistorySnapshot(doc);
      if (bestBlock) {
        const el = doc.querySelector(bestBlock.selector) as HTMLElement | null;
          if (el && el.parentElement) {
            const r = el.getBoundingClientRect();
            const elDocTop = r.top + win.scrollY;
            if (centerY < elDocTop + r.height / 2) {
              el.parentElement.insertBefore(node, el);
            } else {
              el.parentElement.insertBefore(node, el.nextSibling);
            }
          } else if (doc.body) { doc.body.appendChild(node); }
        } else if (doc.body) { doc.body.appendChild(node); }
      }

      commitDocumentMutation(doc);
      setBoPickArmed(false);
      setBoPickType("");
      setBoGridRect(null);
    };

    const onEscLocal = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        drawing = false;
        setDrawRect(null);
        setBoPickArmed(false);
        setBoPickType("");
        setBoGridRect(null);
      }
    };

    // Events auf dem Overlay-div (nicht iframe) damit mouseup außerhalb auch funktioniert
    const overlayDiv = document.querySelector("[data-bo-place-overlay]") as HTMLElement | null;
    const target = overlayDiv || window;
    (target as any).addEventListener("mousedown", onMouseDown);
    (target as any).addEventListener("mousemove", onMouseMove);
    (target as any).addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onEscLocal);

    return () => {
      (target as any).removeEventListener("mousedown", onMouseDown);
      (target as any).removeEventListener("mousemove", onMouseMove);
      (target as any).removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onEscLocal);
    };
  }, [boPickArmed, boPickType, commitDocumentMutation, pushHistorySnapshot]);

  // --- SMART DRAG DROP ---
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const doc = iframe.contentDocument
    if (!doc) return

    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const onDrop = (e: DragEvent) => {
      e.preventDefault()

      const dt = e.dataTransfer
      const type =
        dt?.getData("application/x-site-editor-block") ||
        dt?.getData("text/plain") ||
        ""

      if (!type) return

      const el = doc.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const target = (el?.closest?.("[data-block-id]") as HTMLElement | null)

      // basic nodes (extend later)
      let node: HTMLElement
      if (type === "heading") {
        node = doc.createElement("h2")
        node.textContent = "New Heading"
      } else if (type === "paragraph") {
        node = doc.createElement("p")
        node.textContent = "New paragraph…"
      } else if (type === "button") {
        node = doc.createElement("a")
        node.textContent = "Button"
        node.setAttribute("href", "#")
        node.style.display = "inline-block"
        node.style.padding = "10px 14px"
        node.style.borderRadius = "10px"
      } else {
        node = doc.createElement("div")
        node.textContent = "New Block"
      }

      if (!target) {
        if (!doc.body) return
        doc.body.appendChild(node)
      } else {
        const r = target.getBoundingClientRect()
        const before = e.clientY < r.top + r.height / 2
        if (before) target.parentNode?.insertBefore(node, target)
        else target.parentNode?.insertBefore(node, target.nextSibling)
      }

      commitDocumentMutation(doc)
    }

    doc.addEventListener("dragover", onDragOver)
    doc.addEventListener("drop", onDrop)

    return () => {
      doc.removeEventListener("dragover", onDragOver)
      doc.removeEventListener("drop", onDrop)
    }
  }, [commitDocumentMutation, iframeRef, onHtmlChange])


/* BO_DRAGGRID_GLOBAL_V1 */
const [isDraggingBlock, setIsDraggingBlock] = useState(false)

useEffect(() => {
  if (!enabled) return

  const onStart = (e: DragEvent) => {
    try {
      const t = (e.dataTransfer?.getData("text/plain") || "").trim()
      if (t.startsWith("bo:block:")) setIsDraggingBlock(true)
    } catch {}
  }

  const onEnd = () => setIsDraggingBlock(false)

  window.addEventListener("dragstart", onStart, true)
  window.addEventListener("dragend", onEnd, true)
  window.addEventListener("drop", onEnd, true)

  return () => {
    window.removeEventListener("dragstart", onStart, true)
    window.removeEventListener("dragend", onEnd, true)
    window.removeEventListener("drop", onEnd, true)
  }
}, [enabled])
  const [editValue, setEditValue] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editBg, setEditBg] = useState("#3b82f6");
  const [editColor, setEditColor] = useState("#ffffff");
  const [editBorderColor, setEditBorderColor] = useState("#94a3b8");
  const [editFontFamily, setEditFontFamily] = useState("");
  const [editFontSize, setEditFontSize] = useState("16px");
  const [editFontWeight, setEditFontWeight] = useState("400");
  const [editLineHeight, setEditLineHeight] = useState("1.5");
  const [editPadding, setEditPadding] = useState("");
  const [editMargin, setEditMargin] = useState("");
  const [editImgSrc, setEditImgSrc] = useState("");
  const [editImgWidth, setEditImgWidth] = useState("");
  const [editImgHeight, setEditImgHeight] = useState("");
  const [editImgFit, setEditImgFit] = useState("cover");
  const [editImgPosition, setEditImgPosition] = useState("center center");
  const [editImgAlt, setEditImgAlt] = useState("");
  const [editImgCaption, setEditImgCaption] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageGenerating, setImageGenerating] = useState(false);
  const [showRawHtml, setShowRawHtml] = useState(false);
  const [rawHtmlValue, setRawHtmlValue] = useState("");
  const [, setIsButtonSelected] = useState(false);
  // Heading + List Panel
  const [panelType, setPanelType] = useState<PanelType>("generic");
  const [editHeading, setEditHeading] = useState("");
  const [editBullets, setEditBullets] = useState<string[]>([]);
  
  type NavLinkItem = { text: string; href: string };
  type FormFieldItem = { label: string; name: string; placeholder: string; type: string };

  const [editNavLinks, setEditNavLinks] = useState<NavLinkItem[]>([]);
  const [editFormFields, setEditFormFields] = useState<FormFieldItem[]>([]);
const [aiLoading, setAiLoading] = useState(false);
const [showCostModal, setShowCostModal] = useState(false);
const [pendingAiAction, setPendingAiAction] = useState<null | (() => void)>(null);
  const [groupPreviewHtml, setGroupPreviewHtml] = useState("");
  const splitRootIdsRef = useRef<Set<string>>(new Set());
  const [, setSplitVersion] = useState(0);

  const blocksRef = useRef<BlockEntry[]>([]);
  const hoverIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const pendingExpandRootRef = useRef<string | null>(null);
  const onClickLabelRef = useRef<(id: string) => void>(() => {});
  const inlineEditRef = useRef<{ element: HTMLElement; originalText: string } | null>(null);
  blocksRef.current = blocks;
  hoverIdRef.current = hoverId;
  selectedIdRef.current = selectedId;

  const getIframe = useCallback(() => iframeRef.current, [iframeRef]);
  const getDoc = useCallback(() => getIframe()?.contentDocument ?? null, [getIframe]);
  const getWin = useCallback(() => getIframe()?.contentWindow ?? null, [getIframe]);

  const resetEditorPanelState = useCallback(() => {
    setPanelType("generic");
    setIsButtonSelected(false);
    setEditValue("");
    setEditLink("");
    setEditHeading("");
    setEditBullets([]);
    setEditNavLinks([]);
    setEditFormFields([]);
    setEditImgSrc("");
    setEditImgWidth("");
    setEditImgHeight("");
    setEditImgFit("cover");
    setEditImgPosition("center center");
    setEditImgAlt("");
    setEditImgCaption("");
    setImagePrompt("");
    setImageGenerating(false);
    setShowRawHtml(false);
    setRawHtmlValue("");
    setEditBg("#3b82f6");
    setEditColor("#ffffff");
    setEditBorderColor("#94a3b8");
    setEditFontFamily("");
    setEditFontSize("16px");
    setEditFontWeight("400");
    setEditLineHeight("1.5");
    setEditPadding("");
    setEditMargin("");
    setGroupPreviewHtml("");
  }, []);

  const openGroupPanel = useCallback((blockId: string, containerEl: HTMLElement) => {
    const doc = containerEl.ownerDocument;
    setSelectedId(blockId);
    setPanelType("group");
    setIsButtonSelected(false);
    setGroupPreviewHtml(buildGroupPreviewHtml(doc, containerEl));
    setEditValue("");
    setEditLink("");
    setEditHeading("");
    setEditBullets([]);
    setEditNavLinks([]);
    setEditFormFields([]);
    setEditImgSrc("");
    setEditImgAlt("");
    setEditImgCaption("");
  }, []);

  const selectBlock = useCallback((id: string) => {
    const doc = getDoc();
    if (!doc) return;
    const b = blocksRef.current.find(x => x.id === id);
    if (!b) return;
    const currentSelectedId = selectedIdRef.current;
    const currentRootId = getBlockRootId(currentSelectedId);
    const nextRootId = getBlockRootId(id);

    // 2-LEVEL EDITING:
    // If user clicks same block again AND it's a container → drill into sub-elements
    const isSameBlock = currentSelectedId === id;
    const el = doc.querySelector(b.selector) as HTMLElement | null;
    if (!el) return;

    const isContainer = isExpandableContainer(el);
    const currentExpandedFamily = !!currentRootId && blocksRef.current.some((entry) => entry.id.startsWith(`${currentRootId}${SUB_BLOCK_TOKEN}`));
    const isTopLevelContainer = isContainer && !b.parentId && !isSubBlockId(id);

    if (isTopLevelContainer) {
      if (currentExpandedFamily && currentRootId && currentRootId !== id) {
        resetEditorPanelState();
        setSelectedId(null);
        setHoverId(null);
        pendingExpandRootRef.current = id;
        setTimeout(() => {
          try { window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { force: true } })); } catch {}
        }, 10);
        return;
      }

      if ((isSameBlock || !currentExpandedFamily) && expandIntoSubBlocks(id)) return;
    }

    // Only collapse sub-block mode when switching away from a previously expanded container.
    const switchingExpandedFamily =
      !!currentSelectedId &&
      currentSelectedId !== id &&
      (isSubBlockId(currentSelectedId) || currentExpandedFamily) &&
      !!currentRootId &&
      !!nextRootId &&
      currentRootId !== nextRootId;

    if (switchingExpandedFamily) {
      // Trigger a fresh scan to collapse previous sub-blocks
      setTimeout(() => {
        try { window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { force: true } })); } catch {}
      }, 10);
    }

    setSelectedId(id);
    resetEditorPanelState();

    const btnNode = findButtonNode(el);
    const imgNode = findImageNode(el);
    const imageLinkNode = findImageLinkNode(el, imgNode);
    const isBtn = b.isButton || !!btnNode;
    const styleTarget = (btnNode as HTMLElement | null) || (imgNode as HTMLElement | null) || el;
    const computed = el.ownerDocument?.defaultView?.getComputedStyle(styleTarget);
    setRawHtmlValue(el.outerHTML);
    setShowRawHtml(false);
    setEditBg(normalizeStyleColor(computed?.backgroundColor || "", ""));
    setEditColor(normalizeStyleColor(computed?.color || "", "#ffffff"));
    setEditBorderColor(normalizeStyleColor(computed?.borderColor || "", ""));
    setEditFontFamily(computed?.fontFamily || "");
    setEditFontSize(computed?.fontSize || "16px");
    setEditFontWeight(computed?.fontWeight || "400");
    setEditLineHeight(computed?.lineHeight || "1.5");
    setEditPadding(computed?.padding || "");
    setEditMargin(computed?.margin || "");
    if (imgNode) {
      setEditImgWidth(imgNode.style.width || computed?.width || "");
      setEditImgHeight(imgNode.style.height || computed?.height || "");
      setEditImgFit(imgNode.style.objectFit || "cover");
      setEditImgPosition(imgNode.style.objectPosition || computed?.objectPosition || "center center");
      setEditImgAlt((imgNode.getAttribute("alt") || "").trim());
      setEditImgCaption((findImageFigure(el, imgNode)?.querySelector("figcaption")?.textContent || "").trim());
    }

    const heading = el.querySelector("h1,h2,h3,h4") as HTMLElement | null;
    const list = el.querySelector("ul,ol") as HTMLElement | null;
    const hasHeadingAndList = heading && list;
    const isHeadingEl = ["H1","H2","H3","H4"].includes(el.tagName);
    const isListEl = ["UL","OL"].includes(el.tagName);

    const linkNodes = [
      ...(el.matches("a[href]") ? [el as HTMLAnchorElement] : []),
      ...Array.from(el.querySelectorAll("a[href]")) as HTMLAnchorElement[],
    ];
    const uniqLinks: HTMLAnchorElement[] = [];
    for (const a of linkNodes) {
      const href = (a.getAttribute("href") || "").trim();
      const text = (a.textContent || "").trim();
      if (!href && !text) continue;
      if (!uniqLinks.includes(a)) uniqLinks.push(a);
    }

    const inputNodes = Array.from(el.querySelectorAll("input, textarea, select")) as HTMLElement[];
    const isFormLike = el.tagName === "FORM" || inputNodes.length >= 2;
    const isNavLike = el.tagName === "NAV" || (uniqLinks.length >= 2 && !!el.closest("header, nav, footer"));

    if (isNavLike && uniqLinks.length >= 2) {
      setPanelType("nav-links");
      setIsButtonSelected(false);
      const items = uniqLinks.slice(0, 30).map(a => ({
        text: (a.textContent || "").trim(),
        href: (a.getAttribute("href") || "").toString(),
      }));
      setEditNavLinks(items.length ? items : [{ text: "", href: "" }]);
      return;
    }

    if (isFormLike && inputNodes.length >= 1) {
      setPanelType("form-fields");
      setIsButtonSelected(false);
      const docx = el.ownerDocument;
      const items = [];
      for (const node of inputNodes.slice(0, 30)) {
        const tag = node.tagName.toLowerCase();
        const type = tag === "input" ? ((node.getAttribute("type") || "text").toLowerCase()) : tag;
        // Skip hidden fields - they are internal WordPress/plugin fields
        if (type === "hidden") continue;
        const name = (node.getAttribute("name") || node.getAttribute("id") || "").trim();
        const placeholder = (node.getAttribute("placeholder") || "").trim();
        let labelText = "";
        const idv = (node.getAttribute("id") || "").trim();
        if (idv) {
          const lab = docx.querySelector(`label[for="${idv}"]`) as HTMLLabelElement | null;
          if (lab) labelText = (lab.textContent || "").trim();
        }
        if (!labelText) labelText = (node.getAttribute("aria-label") || "").trim();
        if (!labelText) labelText = placeholder;
        items.push({ label: labelText, name, placeholder, type });
      }
      setEditFormFields(items.length ? items : [{ label: "", name: "", placeholder: "", type: "text" }]);
      return;
    }

    if (imgNode) {
      setPanelType("image");
      setIsButtonSelected(false);
      setEditImgSrc((imgNode.getAttribute("src") || "").trim());
      setEditLink((imageLinkNode?.getAttribute("href") || "").trim());
      setEditImgAlt((imgNode.getAttribute("alt") || "").trim());
      setEditImgCaption((findImageFigure(el, imgNode)?.querySelector("figcaption")?.textContent || "").trim());
      return;
    }

    if (isBtn && btnNode) {
      setPanelType("button");
      setIsButtonSelected(true);
      const textNode = (btnNode.querySelector("span") as HTMLElement | null) || btnNode;
      setEditValue((textNode.textContent || "").trim());
      // Always show existing link URL
      const existingHref = (btnNode as HTMLAnchorElement).getAttribute("href") || "";
      setEditLink(existingHref);
      setEditBg(normalizeStyleColor(computed?.backgroundColor || "", ""));
      setEditColor(normalizeStyleColor(computed?.color || "", "#ffffff"));
      setEditFontSize(computed?.fontSize || "16px");
    } else if (el.tagName === "A") {
      // Standalone link - show as button panel with href
      setPanelType("button");
      setIsButtonSelected(true);
      setEditValue((el.textContent || "").trim());
      setEditLink((el as HTMLAnchorElement).getAttribute("href") || "");
      setEditBg(normalizeStyleColor(computed?.backgroundColor || "", ""));
      setEditColor(normalizeStyleColor(computed?.color || "", "#000000"));
      setEditFontSize(computed?.fontSize || "16px");
    } else if (hasHeadingAndList || isListEl) {
      setPanelType("heading-list");
      setIsButtonSelected(false);
      const h = isListEl ? null : (heading || (isHeadingEl ? el : null));
      setEditHeading((h?.textContent || "").trim());
      const listEl = isListEl ? el : list;
      const items = Array.from(listEl?.querySelectorAll("li") || []).map(li => (li.textContent || "").trim());
      setEditBullets(items.length ? items : [""]);
    } else {
      setPanelType(isHeadingEl ? "text" : "generic");
      setIsButtonSelected(false);
      setEditValue((el.innerText || "").trim().slice(0, 2000));
    }
  }, [getDoc, resetEditorPanelState]);

  onClickLabelRef.current = selectBlock;

  useEffect(() => {
    if (!enabled) return;
    const doc = getDoc();
    if (!doc) return;

    const cleanupInlineEdit = (restore = false) => {
      const active = inlineEditRef.current;
      if (!active) return;
      if (restore) {
        active.element.textContent = active.originalText;
      }
      active.element.removeAttribute("contenteditable");
      active.element.removeAttribute("spellcheck");
      inlineEditRef.current = null;
    };

    const commitInlineEdit = () => {
      const active = inlineEditRef.current;
      if (!active) return;
      const before = active.originalText.trim();
      const after = (active.element.innerText || active.element.textContent || "").trim();
      cleanupInlineEdit(false);
      if (before === after) return;
      pushHistorySnapshot(doc);
      commitDocumentMutation(doc, { preserveSelectionId: selectedIdRef.current });
    };

    const beginInlineEdit = (blockId: string) => {
      const entry = blocksRef.current.find((block) => block.id === blockId);
      if (!entry) return;
      const blockEl = doc.querySelector(entry.selector) as HTMLElement | null;
      if (!blockEl) return;
      const target = findPrimaryTextTarget(blockEl);
      if (!target) return;
      cleanupInlineEdit(false);
      selectBlock(blockId);
      inlineEditRef.current = {
        element: target,
        originalText: target.innerText || target.textContent || "",
      };
      target.setAttribute("contenteditable", "true");
      target.setAttribute("spellcheck", "true");
      target.focus();
      const selection = doc.defaultView?.getSelection();
      const range = doc.createRange();
      range.selectNodeContents(target);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    };

    const onDoubleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const block = target.closest("[data-block-id]") as HTMLElement | null;
      const blockId = block?.getAttribute("data-block-id") || "";
      if (!blockId) return;
      event.preventDefault();
      event.stopPropagation();
      beginInlineEdit(blockId);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!inlineEditRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        cleanupInlineEdit(true);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        commitInlineEdit();
      }
    };

    const onFocusOut = (event: FocusEvent) => {
      if (!inlineEditRef.current) return;
      if (event.target === inlineEditRef.current.element) {
        commitInlineEdit();
      }
    };

    doc.addEventListener("dblclick", onDoubleClick, true);
    doc.addEventListener("keydown", onKeyDown, true);
    doc.addEventListener("focusout", onFocusOut, true);
    return () => {
      doc.removeEventListener("dblclick", onDoubleClick, true);
      doc.removeEventListener("keydown", onKeyDown, true);
      doc.removeEventListener("focusout", onFocusOut, true);
      cleanupInlineEdit(false);
    };
  }, [commitDocumentMutation, enabled, getDoc, pushHistorySnapshot, selectBlock]);

  useEffect(() => {
    if (!enabled) return;

    const onPrefillImage = (event: Event) => {
      const url = String((event as CustomEvent).detail?.url || "").trim();
      if (!url) return;
      setEditImgSrc(url);

      const doc = getDoc();
      const selectedBlockId = selectedIdRef.current;
      if (!doc || !selectedBlockId) return;

      const chosen = blocksRef.current.find((entry) => entry.id === selectedBlockId);
      if (!chosen) return;
      const el = doc.querySelector(chosen.selector) as HTMLElement | null;
      if (!el) return;
      const img = findImageNode(el);
      if (!img) return;

      pushHistorySnapshot(doc);
      img.setAttribute("src", url);
      img.setAttribute("data-bo-local-src", "1");
      img.removeAttribute("data-bo-placeholder");
      commitDocumentMutation(doc, { preserveSelectionId: selectedBlockId });
      toast.success("Project asset applied to the selected image block");
    };

    window.addEventListener("bo:prefill-image-src", onPrefillImage as EventListener);
    return () => window.removeEventListener("bo:prefill-image-src", onPrefillImage as EventListener);
  }, [commitDocumentMutation, enabled, getDoc, pushHistorySnapshot]);

  // --- Drag & Drop: insert new blocks into iframe ---
  useEffect(() => {
    if (!enabled) return;
    const doc = getDoc();
    if (!doc) return;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      try { e.dataTransfer!.dropEffect = "copy"; } catch {}
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();

      const kind =
        (e.dataTransfer?.getData("application/x-bo-block") || "").trim() ||
        (e.dataTransfer?.getData("text/plain") || "").trim();

      if (!kind) return;

      // Find best target at drop point
      let target: Element | null = null;
      try {
        target = doc.elementFromPoint(e.clientX, e.clientY);
      } catch {}

      const container =
        (target && (target as HTMLElement).closest?.("[data-block-id]")) ||
        (target && (target as HTMLElement).closest?.("main,section,article,div")) ||
        doc.body;

      let newEl: HTMLElement | null = null;

      if (kind === "paragraph") {
        const p = doc.createElement("p");
        p.textContent = "New paragraph…";
        newEl = p;
      } else if (kind === "button") {
        const wrap = doc.createElement("div");
        wrap.className = "wp-block-button";
        const a = doc.createElement("a");
        a.className = "wp-block-button__link wp-element-button";
        a.href = "#";
        a.textContent = "New Button";
        wrap.appendChild(a);
        newEl = wrap;
      } else if (kind === "image") {
        const fig = doc.createElement("figure");
        fig.className = "wp-block-image";
        const img = doc.createElement("img");
        img.setAttribute("src", "");
        img.setAttribute("alt", "PLACEHOLDER: replace image in WordPress");
        img.setAttribute("data-bo-placeholder", "1");
        fig.appendChild(img);
        newEl = fig;
      }

      if (!newEl) return;

      try {
        (container as HTMLElement).appendChild(newEl);
      } catch {
        if (!doc.body) return;
        doc.body.appendChild(newEl);
      }

      // notify editor
      try {
        commitDocumentMutation(doc)
      } catch (dropError) {
        console.error("Error in onDrop handler:", dropError);
        toast.error(t("Failed to add element"));
      }

      // optional: rescan blocks so it becomes selectable
      try {
        window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: {} }));
      } catch (rescanError) {
        console.warn("Rescan error:", rescanError);
      }
    };

    doc.addEventListener("dragover", onDragOver as any);
    doc.addEventListener("drop", onDrop as any);

    return () => {
      try { doc.removeEventListener("dragover", onDragOver as any); } catch {}
      try { doc.removeEventListener("drop", onDrop as any); } catch {}
    };
  }, [commitDocumentMutation, enabled, getDoc, onHtmlChange]);


  // Boxes neu zeichnen
  useEffect(() => {
    const doc = getDoc();
    if (!doc || !enabled) return;
    renderBoxesInIframe(
      doc,
      blocks.filter((entry) => matchesBlockFilter(entry, blockFilter)),
      hoverId,
      selectedId,
      (id) => onClickLabelRef.current(id)
    );
  }, [blocks, hoverId, selectedId, enabled, getDoc, blockFilter]);

  useEffect(() => {
    if (!enabled) {
      const doc = getDoc();
      if (doc) doc.querySelectorAll(".__bo-box, .__bo-label-outside, #__block-overlay-css").forEach(el => el.remove());
    }
  }, [enabled, getDoc]);

  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent("bo:structure", {
        detail: buildStructureSnapshot(blocks, selectedId),
      }));
    } catch {}
  }, [blocks, selectedId]);

  const assignIds = useCallback((els: Element[], win: Window, opts?: { scopeRoot?: Element | null; parentId?: string | null }) => {
    const doc = win.document;
    const discoveries = discoverUniversalBlocks(doc);
    const prevByPath = new Map(
      blocksRef.current
        .filter((entry) => entry.pathSignature)
        .map((entry) => [String(entry.pathSignature), entry.id])
    );
    const usedTopLevelIds = new Set<number>();
    doc.querySelectorAll("[data-block-id]").forEach((node) => {
      const num = parseTopLevelBlockNumber((node as HTMLElement).getAttribute("data-block-id"));
      if (num != null) usedTopLevelIds.add(num);
    });

    let nextTopLevelId = 1;
    const claimNextTopLevelId = () => {
      while (usedTopLevelIds.has(nextTopLevelId)) nextTopLevelId += 1;
      usedTopLevelIds.add(nextTopLevelId);
      return `block-${nextTopLevelId}`;
    };

    const subIdCursor = new Map<string, number>();
    const withRects = els.map((el) => ({
      el,
      top: el.getBoundingClientRect().top + win.scrollY,
      depth: getElementDepth(el),
    }));
    withRects.sort((a, b) => a.depth - b.depth || a.top - b.top);

    return withRects.map(({ el, top, depth }) => {
      const node = el as HTMLElement;
      const pathSignature = getElementPathSignature(node, opts?.scopeRoot || null);
      const label = pickLabel(node, discoveries);
      const explicitParentId = opts?.parentId ?? null;
      const inferredParentId = explicitParentId || (node.parentElement?.closest("[data-block-id]") as HTMLElement | null)?.getAttribute("data-block-id") || null;
      const previousPathId = prevByPath.get(pathSignature) || "";
      let id = node.getAttribute("data-block-id") || "";

      if (!id && previousPathId) {
        const canReuseSubId = explicitParentId ? previousPathId.startsWith(`${explicitParentId}${SUB_BLOCK_TOKEN}`) : !previousPathId.includes(SUB_BLOCK_TOKEN);
        if (canReuseSubId) id = previousPathId;
      }

      if (!id) {
        if (explicitParentId) {
          const nextSubId = (subIdCursor.get(explicitParentId) || 0) + 1;
          subIdCursor.set(explicitParentId, nextSubId);
          id = `${explicitParentId}${SUB_BLOCK_TOKEN}${nextSubId}`;
        } else {
          id = claimNextTopLevelId();
        }
      }

      node.setAttribute("data-block-id", id);
      node.setAttribute("data-bo-path", pathSignature);
      if (inferredParentId) node.setAttribute("data-bo-parent", inferredParentId);
      else node.removeAttribute("data-bo-parent");

      return {
        id,
        el: node,
        docTop: top,
        label,
        selector: `[data-block-id="${id}"]`,
        isButton: isButtonElement(node),
        parentId: inferredParentId,
        kind: getBlockKind(node, label),
        pathSignature,
        isExpandable: isExpandableContainer(node),
        isExpanded: false,
        depth,
      };
    });
  }, []);

  const scanFreePrecise = useCallback((force = false) => {
    const doc = getDoc();
    const win = getWin();
    if (!doc || !win) return;
    const currentSel = selectedIdRef.current;
    const expandedSubMode = blocksRef.current.some((entry) => entry.id.includes(SUB_BLOCK_TOKEN));
    if (!force && (String(currentSel || "").includes(SUB_BLOCK_TOKEN) || expandedSubMode)) return;
    onStatus?.("blocked");

    type C = { el: Element; r: DOMRect; priority: number };
    const seen = new Set<Element>();
    const candidates: C[] = [];

    const addElement = (el: Element, priority: number) => {
      if (seen.has(el)) return;
      if (el.classList.contains("__bo-box") || el.classList.contains("__bo-label-outside")) return;
      const h = el as HTMLElement;
      try {
        const style = win.getComputedStyle(h);
        if (style.display === "none" || style.visibility === "hidden") return;
      } catch { return; }
      const r = h.getBoundingClientRect();
      if (!Number.isFinite(r.left) || !Number.isFinite(r.top)) return;
      if (r.width < 8 || r.height < 8) return;
      seen.add(el);
      candidates.push({ el, r, priority });
    };

    // LEVEL 1: Top-level containers (these are the main blocks shown by default)
    const CONTAINER_SELECTORS = [
      "header", "footer", "main", "nav",
      ".site-header", ".site-footer", ".site-nav", ".site-main",
      // WordPress top-level
      ".wp-block-group", ".wp-block-cover", ".wp-block-media-text",
      ".wp-block-columns", ".wp-block-image", ".wp-block-video",
      "[data-section-type]", ".shopify-section",
      // Generic sections
      "section", "article",
      // Hero/Banner patterns
      "div[class*='hero']", "div[class*='banner']", "div[class*='slider']",
      "div[class*='carousel']", "div[class*='featured']",
    ];

    // LEVEL 2: Specific elements - always detected individually
    const SPECIFIC_SELECTORS = [
      "h1", "h2", "h3", "h4",
      "p", "span[class]",
      "figure.wp-block-image", ".wp-block-button",
      "a.wp-block-button__link",
      "button", "a.btn", "[class*='btn-']",
      "img",
      "ul", "ol",
      "form",
    ];

    for (const sel of CONTAINER_SELECTORS) {
      try { doc.querySelectorAll(sel).forEach(el => addElement(el, 1)); } catch {}
    }
    for (const sel of SPECIFIC_SELECTORS) {
      try { doc.querySelectorAll(sel).forEach(el => addElement(el, 2)); } catch {}
    }

    // Smart dedup: keep containers, remove children that are inside a container
    // EXCEPTION: always keep specific important child elements
    const ALWAYS_KEEP = new Set(["h1", "h2", "h3", "figure", "img"]);

    const deduped: C[] = [];
    for (const c of candidates) {
      const tag = c.el.tagName.toLowerCase();
      // Find if a parent container already exists in deduped
      const parentEntry = deduped.find(k => k.el !== c.el && k.el.contains(c.el));

      if (parentEntry) {
        // Keep if it's a significantly distinct section (more than 30% of parent)
        const parentArea = parentEntry.r.width * parentEntry.r.height;
        const childArea = c.r.width * c.r.height;
        const isDistinct = childArea < parentArea * 0.7;

        // Skip generic children that are inside containers
        if (isDistinct && !ALWAYS_KEEP.has(tag) && c.priority !== 1) continue;
        
        // Skip nav links - nav itself is the block
        if (parentEntry.el.tagName === "NAV" || parentEntry.el.tagName === "HEADER") {
          if (tag === "a" || tag === "button" || tag === "li") continue;
        }
      }

      // Remove exact duplicates
      const isDupe = deduped.some(k =>
        Math.abs(c.r.left - k.r.left) < 2 &&
        Math.abs(c.r.top - k.r.top) < 2 &&
        Math.abs(c.r.width - k.r.width) < 2 &&
        Math.abs(c.r.height - k.r.height) < 2
      );
      if (!isDupe) deduped.push(c);
    }

    // Sort by document order
    deduped.sort((a, b) => {
      const topDiff = a.r.top - b.r.top;
      if (Math.abs(topDiff) > 5) return topDiff;
      return a.r.left - b.r.left;
    });

    const topLevelCandidates = deduped.filter((candidate) => {
      return !deduped.some((parent) => parent !== candidate && parent.el.contains(candidate.el));
    });

    const resolvedTopLevelEls = topLevelCandidates.flatMap((candidate) => {
      const existingId = (candidate.el as HTMLElement).getAttribute("data-block-id") || "";
      if (!existingId || !splitRootIdsRef.current.has(existingId)) return [candidate.el];
      const segments = collectSplitRootSegments(candidate.el as HTMLElement, win);
      return segments.length >= 2 ? segments : [candidate.el];
    });

    const withIds = assignIds(resolvedTopLevelEls, win);
    const next: BlockEntry[] = withIds.map(({ id, el, docTop, parentId, kind, pathSignature, isExpandable, isExpanded, depth }) => ({
      id,
      label: pickLabel(el),
      selector: `[data-block-id="${id}"]`,
      isButton: isButtonElement(el),
      docTop,
      parentId,
      kind,
      pathSignature,
      isExpandable,
      isExpanded,
      depth,
    }));

    next.sort((a, b) => a.docTop - b.docTop);
    const keepIds = new Set(next.map((entry) => entry.id));
    doc.querySelectorAll("[data-block-id]").forEach((node) => {
      const id = (node as HTMLElement).getAttribute("data-block-id") || "";
      if (keepIds.has(id)) return;
      (node as HTMLElement).removeAttribute("data-block-id");
      (node as HTMLElement).removeAttribute("data-bo-parent");
      (node as HTMLElement).removeAttribute("data-bo-path");
    });

    const previousSelection = selectedIdRef.current
      ? blocksRef.current.find((entry) => entry.id === selectedIdRef.current)
      : null;
    const nextSelection = previousSelection
      ? next.find((entry) => entry.id === previousSelection.id) ||
        next.find((entry) => entry.pathSignature && entry.pathSignature === previousSelection.pathSignature)
      : null;

    setBlocks(next);
    setHoverId((prev) => (prev && keepIds.has(prev) ? prev : null));
    setSelectedId(nextSelection?.id || null);
    if (!nextSelection) resetEditorPanelState();
    try {
      window.dispatchEvent(new CustomEvent("bo:structure", {
        detail: buildStructureSnapshot(next, nextSelection?.id || null),
      }));
    } catch {}
    onStatus?.("ok");
  }, [assignIds, getDoc, getWin, onStatus, resetEditorPanelState]);

  const expandIntoSubBlocks = useCallback((blockId: string) => {
    const doc = getDoc();
    const win = getWin();
    if (!doc || !win) return false;

    const chosen = blocksRef.current.find((entry) => entry.id === blockId);
    if (!chosen) return false;
    const containerEl = doc.querySelector(chosen.selector) as HTMLElement | null;
    if (!containerEl) return false;

    const directSubs = collectExpandedChildElements(containerEl, win);

    if (!directSubs.length) return false;

    containerEl.querySelectorAll("[data-block-id]").forEach((node) => {
      if (node === containerEl) return;
      (node as HTMLElement).removeAttribute("data-block-id");
      (node as HTMLElement).removeAttribute("data-bo-parent");
      (node as HTMLElement).removeAttribute("data-bo-path");
    });

    const scopedIds = assignIds(directSubs, win, { scopeRoot: containerEl, parentId: blockId });
    const scopedBlocks: BlockEntry[] = scopedIds.map(({ id, el, docTop, parentId, kind, pathSignature, isExpandable, depth }) => ({
      id,
      label: pickLabel(el),
      selector: `[data-block-id="${id}"]`,
      isButton: isButtonElement(el),
      docTop,
      parentId,
      kind,
      pathSignature,
      isExpandable,
      isExpanded: false,
      depth,
    }));

    const next = blocksRef.current
      .filter((entry) => {
        if (entry.id === blockId) return false;
        const existing = doc.querySelector(entry.selector) as HTMLElement | null;
        return existing && !containerEl.contains(existing);
      })
      .concat([{ ...chosen, isExpanded: true }], scopedBlocks)
      .sort((a, b) => a.docTop - b.docTop);

    setBlocks(next);
    setHoverId(null);
    openGroupPanel(blockId, containerEl);
    return true;
  }, [assignIds, getDoc, getWin, openGroupPanel]);

  useEffect(() => {
    const pendingRootId = pendingExpandRootRef.current;
    if (!pendingRootId) return;
    if (blocks.some((entry) => entry.id.startsWith(`${pendingRootId}${SUB_BLOCK_TOKEN}`))) {
      pendingExpandRootRef.current = null;
      return;
    }
    if (!blocks.some((entry) => entry.id === pendingRootId)) return;

    pendingExpandRootRef.current = null;
    const timer = window.setTimeout(() => {
      try { expandIntoSubBlocks(pendingRootId); } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, [blocks, expandIntoSubBlocks]);

  const moveTopLevelRoot = useCallback((rootId: string, delta: number) => {
    const doc = getDoc();
    if (!doc || !delta) return;
    const topLevel = getOrderedTopLevelBlocks(blocksRef.current);
    const index = topLevel.findIndex((entry) => entry.id === rootId);
    if (index < 0) return;
    const nextIndex = Math.max(0, Math.min(topLevel.length - 1, index + delta));
    if (nextIndex === index) return;

    const rootEl = doc.querySelector(topLevel[index].selector) as HTMLElement | null;
    const targetEl = doc.querySelector(topLevel[nextIndex].selector) as HTMLElement | null;
    if (!rootEl || !targetEl || !rootEl.parentElement || rootEl === targetEl) return;

    pushHistorySnapshot(doc);
    if (nextIndex < index) {
      targetEl.parentElement?.insertBefore(rootEl, targetEl);
    } else {
      targetEl.parentElement?.insertBefore(rootEl, targetEl.nextSibling);
    }
    commitDocumentMutation(doc, { preserveSelectionId: rootId });
  }, [commitDocumentMutation, getDoc, pushHistorySnapshot]);

  const deleteBlockTree = useCallback((blockId: string) => {
    const doc = getDoc();
    if (!doc) return;
    const rootId = getBlockRootId(blockId) || blockId;
    const targetEntry = blocksRef.current.find((entry) => entry.id === rootId) || blocksRef.current.find((entry) => entry.id === blockId);
    if (!targetEntry) return;
    const targetEl = doc.querySelector(targetEntry.selector) as HTMLElement | null;
    if (!targetEl) return;
    pushHistorySnapshot(doc);
    splitRootIdsRef.current.delete(rootId);
    targetEl.remove();
    resetEditorPanelState();
    setSelectedId(null);
    commitDocumentMutation(doc);
  }, [commitDocumentMutation, getDoc, pushHistorySnapshot, resetEditorPanelState]);

  const splitSelectedRoot = useCallback((blockId: string) => {
    const rootId = getBlockRootId(blockId) || blockId;
    splitRootIdsRef.current.add(rootId);
    setSplitVersion((value) => value + 1);
    resetEditorPanelState();
    setSelectedId(null);
    window.setTimeout(() => {
      try { window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { force: true } })); } catch {}
    }, 10);
  }, [resetEditorPanelState]);

  useEffect(() => {
    if (!enabled) return;
    const onMoveRoot = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const rootId = String(detail.rootId || "");
      const delta = Number(detail.delta || 0);
      if (!rootId || !Number.isFinite(delta) || !delta) return;
      moveTopLevelRoot(rootId, delta);
    };

    const onInsertComponent = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const html = String(detail.html || "").trim();
      if (!html) return;
      const doc = getDoc();
      if (!doc) return;
      const tempDiv = doc.createElement("div");
      tempDiv.innerHTML = html;
      const node = tempDiv.firstElementChild as HTMLElement | null;
      if (!node) return;

      const targetRootId = String(detail.targetRootId || "");
      const targetEntry = targetRootId
        ? blocksRef.current.find((entry) => entry.id === targetRootId)
        : null;
      const targetEl = targetEntry ? (doc.querySelector(targetEntry.selector) as HTMLElement | null) : null;

      pushHistorySnapshot(doc);
      if (targetEl?.parentElement) {
        targetEl.parentElement.insertBefore(node, targetEl.nextSibling);
      } else {
        if (!doc.body) return;
        doc.body.appendChild(node);
      }

      commitDocumentMutation(doc);
    };

    window.addEventListener("bo:move-root", onMoveRoot as EventListener);
    window.addEventListener("bo:insert-component", onInsertComponent as EventListener);
    return () => {
      window.removeEventListener("bo:move-root", onMoveRoot as EventListener);
      window.removeEventListener("bo:insert-component", onInsertComponent as EventListener);
    };
  }, [commitDocumentMutation, enabled, getDoc, moveTopLevelRoot, pushHistorySnapshot]);

    
  // --- Drag & Drop: smart insert at cursor position ---
  const insertNewBlockAtPoint = useCallback((blockType: string, clientX: number, clientY: number) => {
    const doc = getDoc();
    const win = getWin();
    if (!doc || !win) return;

    // Find element at mouse position inside iframe viewport
    const hit = doc.elementFromPoint(clientX, clientY) as HTMLElement | null;

    // Prefer inserting relative to a block wrapper, if present
    const hitBlock = (hit ? hit.closest("[data-block-id]") : null) as HTMLElement | null;

    const makeNode = (): HTMLElement => {
      const t = String(blockType || "").toLowerCase();
      if (t === "section") {
        const el = doc.createElement("section");
        el.style.padding = "40px 0";
        el.innerHTML = `<div style="max-width:1100px;margin:0 auto;padding:0 24px;">
  <h2>New Section</h2>
  <p>Drop-in section. Edit me.</p>
</div>`;
        return el;
      }
      if (t === "heading") {
        const el = doc.createElement("h2");
        el.textContent = "New Heading";
        return el;
      }
      if (t === "paragraph") {
        const el = doc.createElement("p");
        el.textContent = "New text block…";
        return el;
      }
      if (t === "button") {
        const wrap = doc.createElement("div");
        wrap.className = "wp-block-button";
        const a = doc.createElement("a");
        a.className = "wp-block-button__link wp-element-button";
        a.href = "#";
        a.textContent = "Click me";
        a.style.display = "inline-block";
        a.style.padding = "12px 18px";
        a.style.borderRadius = "10px";
        a.style.textDecoration = "none";
        a.style.backgroundColor = "#3b82f6";
        a.style.color = "#ffffff";
        wrap.appendChild(a);
        return wrap;
      }
      if (t === "divider") {
        const hr = doc.createElement("hr");
        return hr;
      }
      if (t === "image") {
        const fig = doc.createElement("figure");
        fig.className = "wp-block-image size-large";
        const img = doc.createElement("img");
        img.setAttribute("src", "");
        img.setAttribute("alt", "PLACEHOLDER: replace image in WordPress");
        img.setAttribute("data-bo-placeholder", "1");
        img.style.maxWidth = "100%";
        img.style.height = "auto";
        fig.appendChild(img);
        const cap = doc.createElement("figcaption");
        cap.textContent = "Image placeholder (replace in WP later)";
        cap.style.opacity = "0.65";
        cap.style.fontSize = "12px";
        fig.appendChild(cap);
        return fig;
      }

      // fallback
      const el = doc.createElement("div");
      el.textContent = "New Block";
      el.style.padding = "12px";
      el.style.border = "1px dashed rgba(0,0,0,0.2)";
      return el;
    };

    const node = makeNode();
    pushHistorySnapshot(doc);

    // Decide insertion point (before/after) based on midpoint
    if (hitBlock && hitBlock.parentElement) {
      const r = hitBlock.getBoundingClientRect();
      const after = clientY > (r.top + r.height / 2);

      if (after) {
        // insert AFTER hitBlock
        if (hitBlock.nextSibling) hitBlock.parentElement.insertBefore(node, hitBlock.nextSibling);
        else hitBlock.parentElement.appendChild(node);
      } else {
        // insert BEFORE hitBlock
        hitBlock.parentElement.insertBefore(node, hitBlock);
      }
    } else {
      // No block hit -> append to body
      if (!doc.body) return;
      doc.body.appendChild(node);
    }

    commitDocumentMutation(doc);
  }, [commitDocumentMutation, getDoc, getWin, pushHistorySnapshot]);

  useEffect(() => {
    const doc = getDoc();
    if (!doc || !enabled) return;

    const onDragOver = (e: DragEvent) => {
      // Allow drop
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const dt = e.dataTransfer;
      if (!dt) return;

      const t =
        dt.getData("application/x-site-editor-block") ||
        dt.getData("text/plain") ||
        "";

      if (!t) return;

      insertNewBlockAtPoint(t, e.clientX, e.clientY);
    };

    doc.addEventListener("dragover", onDragOver);
    doc.addEventListener("drop", onDrop);

    return () => {
      doc.removeEventListener("dragover", onDragOver);
      doc.removeEventListener("drop", onDrop);
    };
  }, [enabled, getDoc, insertNewBlockAtPoint]);

const runLeftAiPrompt = useCallback(async (model: string, prompt: string) => {
      const estimateAutoModel = (requestedModel: string, html: string, promptText: string) => {
        if (requestedModel !== "auto") return requestedModel
        const lower = String(promptText || "").toLowerCase()
        const htmlSize = String(html || "").length

        const isPageTask =
          lower.includes("ganze seite") ||
          lower.includes("komplette seite") ||
          lower.includes("rewrite page") ||
          lower.includes("rewrite-page") ||
          lower.includes("landingpage") ||
          htmlSize > 35000

        const isStructural =
          lower.includes("section") ||
          lower.includes("sektion") ||
          lower.includes("layout") ||
          lower.includes("spalten") ||
          lower.includes("columns") ||
          lower.includes("hero") ||
          lower.includes("formular") ||
          lower.includes("form") ||
          lower.includes("navbar") ||
          lower.includes("footer") ||
          lower.includes("header") ||
          lower.includes("sidebar") ||
          lower.includes("grid") ||
          lower.includes("neben") ||
          lower.includes("links neben") ||
          lower.includes("rechts neben")

        const isSmallRewrite = htmlSize < 12000 && !isPageTask && !isStructural
        if (isPageTask || isStructural) return "claude-sonnet-4-6"
        if (isSmallRewrite) return "ollama:qwen2.5-coder:7b"
        return "gemini-2.5-flash"
      }

      const estimateOutputTokens = (resolvedModel: string, inputTokens: number) => {
        if (resolvedModel.startsWith("claude-")) return Math.max(450, Math.min(2400, Math.ceil(inputTokens * 0.18)))
        if (resolvedModel.startsWith("gemini-")) return Math.max(300, Math.min(1800, Math.ceil(inputTokens * 0.14)))
        if (resolvedModel.startsWith("groq:")) return Math.max(220, Math.min(1400, Math.ceil(inputTokens * 0.12)))
        return Math.max(160, Math.min(900, Math.ceil(inputTokens * 0.1)))
      }

      const doc = getDoc();
      if (!doc || !prompt?.trim()) return;

      try {
        pushHistorySnapshot(doc);
        let targetEl: HTMLElement | null = null;
        const sid = selectedIdRef.current;
        if (sid) {
          targetEl = doc.querySelector(`[data-block-id="${sid}"]`) as HTMLElement | null;
        }


        const localPrompt = String(prompt || "").trim();
        const makeLocalNodeFromText = (rest: string) => {
          const quoted =
            rest.match(/"([^"]+)"/)?.[1] ||
            rest.match(/„([^“]+)“/)?.[1] ||
            rest.match(/'([^']+)'/)?.[1] ||
            rest.match(/mit\s+(.+)$/i)?.[1] ||
            rest.match(/namens\s+(.+)$/i)?.[1] ||
            "Neuer Block";

          const cleanText = String(quoted || "Neuer Block").trim().replace(/^["'„]|["'“]$/g, "");
          const lower = rest.toLowerCase();
          let html = "";

          if (lower.includes("überschrift") || lower.includes("headline") || lower.includes("heading") || lower.includes("titel")) {
            html = `<h2 class="wp-block-heading">${cleanText}</h2>`;
          } else if (lower.includes("button")) {
            html = `<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">${cleanText}</a></div>`;
          } else if (lower.includes("absatz") || lower.includes("paragraph") || lower.includes("text")) {
            html = `<p>${cleanText}</p>`;
          } else if (lower.includes("bild") || lower.includes("image")) {
            html = `<figure class="wp-block-image size-large"><img src="https://placehold.co/1200x700" alt="${cleanText || "Neues Bild"}" />${cleanText ? `<figcaption>${cleanText}</figcaption>` : ""}</figure>`;
          } else if (lower.includes("divider") || lower.includes("trenner") || lower.includes("separator")) {
            html = `<hr class="wp-block-separator" />`;
          } else if (lower.includes("section") || lower.includes("sektion")) {
            html = `<section class="wp-block-group" style="padding:32px 24px"><h2 class="wp-block-heading">${cleanText}</h2><p>Neuer Abschnitt</p></section>`;
          } else if (lower.includes("liste") || lower.includes("list")) {
            html = `<ul><li>${cleanText}</li><li>Weiterer Punkt</li></ul>`;
          } else {
            html = `<p>${cleanText}</p>`;
          }

          const wrap = doc.createElement("div");
          wrap.innerHTML = html;
          return wrap.firstElementChild as HTMLElement | null;
        };

        const finishLocalAction = (preserveSelectionId?: string | null) => {
          commitDocumentMutation(doc, { preserveSelectionId: preserveSelectionId ?? null });
          setTimeout(() => {
            try { window.dispatchEvent(new CustomEvent("bo:left-ai-done")); } catch {}
          }, 120);
        };

        const relativeDeleteMatch = localPrompt.match(/(?:lösche|loesche|entferne)\s+(unter|vor|nach)\s+block\s+(\d+)\s+(.+)/i);
        if (relativeDeleteMatch) {
          const pos = String(relativeDeleteMatch[1] || "").toLowerCase();
          const rawId = String(relativeDeleteMatch[2] || "").trim();
          const rest = String(relativeDeleteMatch[3] || "").trim().toLowerCase();

          const target = doc.querySelector(`[data-block-id="block-${rawId}"]`) as HTMLElement | null;
          if (!target || !target.parentElement) {
            toast.error(`Block ${rawId} wurde nicht gefunden.`);
            return;
          }

          const candidate =
            pos === "vor"
              ? (target.previousElementSibling as HTMLElement | null)
              : (target.nextElementSibling as HTMLElement | null);

          if (!candidate) {
            toast.error(t("No matching neighbor block found."));
            return;
          }

          const tag = String(candidate.tagName || "").toLowerCase();
          const cls = String(candidate.className || "").toLowerCase();
          const txt = String(candidate.textContent || "").trim().toLowerCase();

          const wantsHeading = rest.includes("überschrift") || rest.includes("headline") || rest.includes("heading") || rest.includes("titel");
          const wantsButton = rest.includes("button");
          const wantsParagraph = rest.includes("absatz") || rest.includes("paragraph") || rest.includes("text");
          const wantsImage = rest.includes("bild") || rest.includes("image");
          const wantsDivider = rest.includes("divider") || rest.includes("trenner") || rest.includes("separator");
          const wantsSection = rest.includes("section") || rest.includes("sektion");
          const wantsList = rest.includes("liste") || rest.includes("list");

          let matchesType = false;
          if (wantsHeading) matchesType = /^h[1-6]$/.test(tag) || cls.includes("wp-block-heading");
          else if (wantsButton) matchesType = cls.includes("wp-block-button");
          else if (wantsParagraph) matchesType = tag === "p";
          else if (wantsImage) matchesType = tag === "figure" || cls.includes("wp-block-image") || !!candidate.querySelector("img");
          else if (wantsDivider) matchesType = tag === "hr" || cls.includes("wp-block-separator");
          else if (wantsSection) matchesType = tag === "section" || cls.includes("wp-block-group");
          else if (wantsList) matchesType = tag === "ul" || tag === "ol";
          else matchesType = true;

          const quoted =
            rest.match(/"([^"]+)"/)?.[1]?.toLowerCase() ||
            rest.match(/„([^“]+)“/)?.[1]?.toLowerCase() ||
            rest.match(/'([^']+)'/)?.[1]?.toLowerCase() ||
            "";

          const matchesText = !quoted || txt.includes(quoted);

          if (!matchesType || !matchesText) {
            toast.error(t("Neighbor block does not match delete instruction."));
            return;
          }

          pushHistorySnapshot(doc);
          candidate.remove();
          finishLocalAction();
          return;
        }

        const deleteMatch = localPrompt.match(/(?:lösche|loesche|entferne)\s+block\s+(\d+)/i);
        if (deleteMatch) {
          const rawId = String(deleteMatch[1] || "").trim();
          const target = doc.querySelector(`[data-block-id="block-${rawId}"]`) as HTMLElement | null;
          if (!target) {
            toast.error(`Block ${rawId} wurde nicht gefunden.`);
            return;
          }
          pushHistorySnapshot(doc);
          target.remove();
          finishLocalAction();
          return;
        }

        const moveMatch = localPrompt.match(/verschiebe\s+block\s+(\d+)\s+(unter|vor|nach)\s+block\s+(\d+)/i);
        if (moveMatch) {
          const sourceId = String(moveMatch[1] || "").trim();
          const pos = String(moveMatch[2] || "").toLowerCase();
          const targetId = String(moveMatch[3] || "").trim();

          const source = doc.querySelector(`[data-block-id="block-${sourceId}"]`) as HTMLElement | null;
          const target = doc.querySelector(`[data-block-id="block-${targetId}"]`) as HTMLElement | null;

          if (!source) {
            toast.error(`Quell-Block ${sourceId} wurde nicht gefunden.`);
            return;
          }
          if (!target || !target.parentElement) {
            toast.error(`Ziel-Block ${targetId} wurde nicht gefunden.`);
            return;
          }
          if (source === target) {
            toast.error(t("Source and target are identical."));
            return;
          }

          pushHistorySnapshot(doc);
          if (pos === "vor") {
            target.parentElement.insertBefore(source, target);
          } else {
            target.parentElement.insertBefore(source, target.nextSibling);
          }

          finishLocalAction();
          return;
        }

        const replaceMatch = localPrompt.match(/ersetze\s+block\s+(\d+)\s+mit\s+(.+)/i);
        if (replaceMatch) {
          const rawId = String(replaceMatch[1] || "").trim();
          const rest = String(replaceMatch[2] || "").trim();

          const target = doc.querySelector(`[data-block-id="block-${rawId}"]`) as HTMLElement | null;
          if (!target || !target.parentElement) {
            toast.error(`Block ${rawId} wurde nicht gefunden.`);
            return;
          }

          const newNode = makeLocalNodeFromText(rest);
          if (!newNode) {
            toast.error(t("Replacement block could not be created."));
            return;
          }

          pushHistorySnapshot(doc);
          target.parentElement.insertBefore(newNode, target);
          target.remove();
          finishLocalAction();
          return;
        }

        const localBesideMatch = localPrompt.match(/füge\s+(?:(links|rechts)\s+)?neben\s+block\s+(\d+)\s+(.+)/i);
        if (localBesideMatch) {
          const sideRaw = String(localBesideMatch[1] || "").toLowerCase();
          const side = sideRaw === "links" ? "left" : "right";
          const rawId = String(localBesideMatch[2] || "").trim();
          const rest = String(localBesideMatch[3] || "").trim();

          const target = doc.querySelector(`[data-block-id="block-${rawId}"]`) as HTMLElement | null;
          if (!target || !target.parentElement) {
            toast.error(`Block ${rawId} wurde nicht gefunden.`);
            return;
          }

          const quoted =
            rest.match(/"([^"]+)"/)?.[1] ||
            rest.match(/„([^“]+)“/)?.[1] ||
            rest.match(/'([^']+)'/)?.[1] ||
            rest.match(/mit\s+(.+)$/i)?.[1] ||
            rest.match(/namens\s+(.+)$/i)?.[1] ||
            "Neuer Block";

          const cleanText = String(quoted || "Neuer Block").trim().replace(/^["'„]|["'“]$/g, "");
          const lower = rest.toLowerCase();
          let html = "";

          if (lower.includes("überschrift") || lower.includes("headline") || lower.includes("heading") || lower.includes("titel")) {
            html = `<h2 class="wp-block-heading">${cleanText}</h2>`;
          } else if (lower.includes("button")) {
            html = `<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">${cleanText}</a></div>`;
          } else if (lower.includes("absatz") || lower.includes("paragraph") || lower.includes("text")) {
            html = `<p>${cleanText}</p>`;
          } else if (lower.includes("bild") || lower.includes("image")) {
            html = `<figure class="wp-block-image size-large" style="margin:0;height:100%;"><img src="https://placehold.co/1200x700" alt="${cleanText || "Neues Bild"}" style="width:100%;height:100%;object-fit:cover;display:block;" />${cleanText ? `<figcaption>${cleanText}</figcaption>` : ""}</figure>`;
          } else if (lower.includes("divider") || lower.includes("trenner") || lower.includes("separator")) {
            html = `<hr class="wp-block-separator" />`;
          } else if (lower.includes("section") || lower.includes("sektion")) {
            html = `<section class="wp-block-group" style="padding:32px 24px"><h2 class="wp-block-heading">${cleanText}</h2><p>Neuer Abschnitt</p></section>`;
          } else if (lower.includes("liste") || lower.includes("list")) {
            html = `<ul><li>${cleanText}</li><li>Weiterer Punkt</li></ul>`;
          } else {
            html = `<p>${cleanText}</p>`;
          }

          const wrap = doc.createElement("div");
          wrap.innerHTML = html;
          const newNode = wrap.firstElementChild as HTMLElement | null;
          if (!newNode) {
            toast.error(t("New block could not be created."));
            return;
          }

          pushHistorySnapshot(doc);
          const parent = target.parentElement as HTMLElement;
          const targetRect = target.getBoundingClientRect();
          const targetStyle = window.getComputedStyle(target);

          const existingCol = doc.createElement("div");
          existingCol.className = "wp-block-column";
          existingCol.style.cssText = "flex:1;min-width:0;display:flex;flex-direction:column;gap:1em;";

          const newCol = doc.createElement("div");
          newCol.className = "wp-block-column";
          newCol.style.cssText = "flex:1;min-width:0;display:flex;flex-direction:column;gap:1em;";

          if (lower.includes("bild") || lower.includes("image")) {
            const pct = Math.max(20, Math.min(80, Math.round((targetRect.width / Math.max(1, (iframeRef.current?.getBoundingClientRect().width || targetRect.width))) * 100)));
            newCol.style.cssText = `flex:0 0 ${pct}%;min-width:0;display:flex;flex-direction:column;gap:1em;`;
            existingCol.style.cssText = "flex:1;min-width:0;display:flex;flex-direction:column;gap:1em;";
          }

          const cols = doc.createElement("div");
          cols.className = "wp-block-columns is-layout-flex";
          cols.style.cssText = "display:flex;gap:2em;align-items:stretch;width:100%;";

          const parentChildren = Array.from(parent.children) as HTMLElement[];
          const overlapping = parentChildren.filter((el) => {
            const same = el === target;
            if (same) return true;
            const r = el.getBoundingClientRect();
            const verticalOverlap = r.top < targetRect.bottom - 10 && r.bottom > targetRect.top + 10;
            const isBlockish =
              el.hasAttribute("data-block-id") ||
              /wp-block|^H[1-6]$|^P$|^UL$|^OL$|^LI$|^FORM$|^DIV$|^SECTION$|^FIGURE$|^HR$/.test(el.tagName) ||
              el.className?.includes?.("wp-block");
            return verticalOverlap && isBlockish;
          });

          const first = overlapping[0] || target;
          parent.insertBefore(cols, first);

          overlapping.forEach((el) => existingCol.appendChild(el));
          newCol.appendChild(newNode);

          if (side === "left") {
            cols.appendChild(newCol);
            cols.appendChild(existingCol);
          } else {
            cols.appendChild(existingCol);
            cols.appendChild(newCol);
          }

          if (targetStyle.textAlign && targetStyle.textAlign !== "start") {
            existingCol.style.textAlign = targetStyle.textAlign;
          }

          finishLocalAction();
          return;
        }

        const insertMatch = localPrompt.match(/füge\s+(unter|vor|nach)\s+block\s+(\d+)\s+(.+)/i);
        if (insertMatch) {
          const pos = String(insertMatch[1] || "").toLowerCase();
          const rawId = String(insertMatch[2] || "").trim();
          const rest = String(insertMatch[3] || "").trim();

          const target = doc.querySelector(`[data-block-id="block-${rawId}"]`) as HTMLElement | null;
          if (!target || !target.parentElement) {
            toast.error(`Block ${rawId} wurde nicht gefunden.`);
            return;
          }

          const quoted =
            rest.match(/"([^"]+)"/)?.[1] ||
            rest.match(/„([^“]+)“/)?.[1] ||
            rest.match(/'([^']+)'/)?.[1] ||
            rest.match(/mit\s+(.+)$/i)?.[1] ||
            rest.match(/namens\s+(.+)$/i)?.[1] ||
            "Neuer Block";

          const cleanText = String(quoted || "Neuer Block").trim().replace(/^["'„]|["'“]$/g, "");
          const lower = rest.toLowerCase();
          let html = "";

          if (lower.includes("überschrift") || lower.includes("headline") || lower.includes("heading") || lower.includes("titel")) {
            html = `<h2 class="wp-block-heading">${cleanText}</h2>`;
          } else if (lower.includes("button")) {
            html = `<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">${cleanText}</a></div>`;
          } else if (lower.includes("absatz") || lower.includes("paragraph") || lower.includes("text")) {
            html = `<p>${cleanText}</p>`;
          } else if (lower.includes("bild") || lower.includes("image")) {
            html = `<figure class="wp-block-image size-large"><img src="https://placehold.co/1200x700" alt="${cleanText || "Neues Bild"}" /><figcaption>${cleanText || "Neues Bild"}</figcaption></figure>`;
          } else if (lower.includes("divider") || lower.includes("trenner") || lower.includes("separator")) {
            html = `<hr class="wp-block-separator" />`;
          } else if (lower.includes("section") || lower.includes("sektion")) {
            html = `<section class="wp-block-group" style="padding:32px 24px"><h2 class="wp-block-heading">${cleanText}</h2><p>Neuer Abschnitt</p></section>`;
          } else if (lower.includes("liste") || lower.includes("list")) {
            html = `<ul><li>${cleanText}</li><li>Weiterer Punkt</li></ul>`;
          } else {
            html = `<p>${cleanText}</p>`;
          }

          const wrap = doc.createElement("div");
          wrap.innerHTML = html;
          const newNode = wrap.firstElementChild as HTMLElement | null;
          if (!newNode) {
            toast.error(t("New block could not be created."));
            return;
          }

          pushHistorySnapshot(doc);
          if (pos === "vor") {
            target.parentElement.insertBefore(newNode, target);
          } else {
            target.parentElement.insertBefore(newNode, target.nextSibling);
          }

          finishLocalAction();
          return;
        }

        const looksLikeLocalDomCommand =
          /(?:^|\s)(füge|fuege|lösche|loesche|entferne|verschiebe|ersetze|dupliziere|kopiere|wrap|unwrap)\b/i.test(localPrompt) &&
          /\bblock\s+\d+\b/i.test(localPrompt);

        if (looksLikeLocalDomCommand) {
          toast.error(t("Local DOM command not clearly recognized. No AI call executed."));
          try { window.dispatchEvent(new CustomEvent("bo:left-ai-done")); } catch {}
          return;
        }

        const htmlToSend = targetEl ? targetEl.outerHTML : serializeIframeHtml(doc);
        const resolvedModel = estimateAutoModel(model, htmlToSend, prompt);
        const estInputTokens = Math.max(120, Math.ceil((htmlToSend.length + prompt.length + 1200) / 4));
        const estOutputTokens = estimateOutputTokens(resolvedModel, estInputTokens);
        let approvalGranted = false;

        if (!resolvedModel.startsWith("ollama:") && getRequireApproval()) {
          const approvalId = `approve_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          const approved = await new Promise<boolean>((resolve) => {
            const handler = (ev: any) => {
              if (String(ev?.detail?.id || "") !== approvalId) return
              window.removeEventListener("bo:ai-approval-response", handler as any)
              resolve(!!ev?.detail?.approved)
            }
            window.addEventListener("bo:ai-approval-response", handler as any)
            window.dispatchEvent(new CustomEvent("bo:ai-approval-request", {
              detail: {
                id: approvalId,
                model: resolvedModel,
                scope: targetEl ? "block" : "page",
                estInputTokens,
                estOutputTokens,
                prompt: String(prompt || "").slice(0, 220)
              }
            }))
          })

          if (!approved) {
            try { window.dispatchEvent(new CustomEvent("bo:left-ai-done")); } catch {}
            return
          }
          approvalGranted = true;
        }


        // Streaming fetch
        const streamResp = await fetchWithAuth(ENDPOINTS.rewriteStream, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            html: htmlToSend,
            instruction: prompt,
            systemHint: "Return only valid HTML.",
            model: resolvedModel,
            approved: approvalGranted ? 1 : 0,
          }),
        });

        const ct = streamResp.headers.get("content-type") || ""
        if (!ct.includes("text/event-stream")) {
          const data = await streamResp.json()
          if (data?.needsApproval) {
            toast.warning(`Approval nötig: ${data.model} (~$${data.estCost})`)
            return
          }
          if (!data?.ok || !data?.html) { toast.error(t("AI Error: ") + (data?.error || "kein HTML")); return }
          if (targetEl && targetEl.parentElement) {
            pushHistorySnapshot(doc)
            const wrap = doc.createElement("div")
            wrap.innerHTML = data.html
            const newNode = wrap.firstElementChild as HTMLElement | null
            if (newNode) { targetEl.parentElement.insertBefore(newNode, targetEl); targetEl.remove() }
            commitDocumentMutation(doc)
          } else { try { onHtmlChange?.(data.html) } catch {} }
          return
        }

        const reader = streamResp.body!.getReader()
        const decoder = new TextDecoder()
        let streamedHtml = ""
        let liveEl: HTMLElement | null = null
        if (targetEl) {
          liveEl = doc.createElement("div")
          liveEl.setAttribute("data-bo-streaming", "1")
          liveEl.style.cssText = "outline: 2px solid rgba(99,102,241,0.6); outline-offset: 2px; opacity: 0.7;"
          targetEl.parentElement?.insertBefore(liveEl, targetEl)
        }
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue
            try {
              const evt = JSON.parse(line.slice(6))
              if (evt.type === "token") { streamedHtml += evt.token; if (liveEl) liveEl.innerHTML = streamedHtml }
              if (evt.type === "usage") { window.dispatchEvent(new CustomEvent("bo:ai-usage", { detail: { usage: evt.usage, cost_eur: evt.cost_eur || 0 } })) }
              if (evt.type === "error") { toast.error("Stream Fehler: " + evt.error); liveEl?.remove(); return }
              if (evt.type === "done") {
                streamedHtml = evt.html || streamedHtml
                window.dispatchEvent(new CustomEvent("bo:diff-ready", { detail: { oldHtml: htmlToSend, newHtml: streamedHtml, blockId: targetEl?.getAttribute("data-block-id") } }))
                liveEl?.remove()
                if (targetEl && targetEl.parentElement) {
                  pushHistorySnapshot(doc)
                  const wrap = doc.createElement("div")
                  wrap.innerHTML = streamedHtml
                  const newNode = wrap.firstElementChild as HTMLElement | null
                  if (newNode) { targetEl.parentElement.insertBefore(newNode, targetEl); targetEl.remove() }
                  commitDocumentMutation(doc)
                } else { try { onHtmlChange?.(streamedHtml) } catch {} }
              }
            } catch {}
          }
        }
      } catch (e: any) {
        console.error("Left AI Prompt failed:", e);
        toast.error("KI Prompt Fehler: " + (e?.message || e));
      } finally {
        try { window.dispatchEvent(new CustomEvent("bo:left-ai-done")); } catch {}
      }
    }, [commitDocumentMutation, getDoc, onHtmlChange]);
    
const aiRescan = useCallback(async (mode: "block" | "page") => {
      let doc = getDoc();
      if (!doc || !doc.body) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        doc = getDoc();
      }
      if (!doc || !doc.body) {
        console.warn("Local rescan: doc not ready");
        return;
      }
      if (mode === "block" && !selectedIdRef.current) {
        toast.error("Bitte zuerst einen Block anklicken, dann den Struktur-Scan starten.");
        return;
      }

      setAiLoading(true);
      onStatus?.("blocked");
      try {
        if (mode === "block" && selectedIdRef.current) {
          const expanded = expandIntoSubBlocks(selectedIdRef.current);
          if (!expanded) scanFreePrecise(true);
        } else {
          scanFreePrecise(true);
        }
      } catch (e) {
        console.error("Local rescan failed:", e);
        scanFreePrecise(true);
      } finally {
        setAiLoading(false);
        onStatus?.("ok");
      }
    }, [expandIntoSubBlocks, getDoc, scanFreePrecise, onStatus]);

  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent).detail?.mode as "block" | "page";
      const force = !!(e as CustomEvent).detail?.force;
      if (!force && selectedIdRef.current?.includes(SUB_BLOCK_TOKEN)) return;
      if (mode) aiRescan(mode);
      else scanFreePrecise(force);
    };
    window.addEventListener("blockoverlay:rescan", handler);
    return () => window.removeEventListener("blockoverlay:rescan", handler);
  }, [aiRescan, scanFreePrecise]);

  useEffect(() => {
    const handler = (e: any) => {
      const model = String(e?.detail?.model || "claude-sonnet-4-6")
      const prompt = String(e?.detail?.prompt || "")
      if (!prompt.trim()) return
      runLeftAiPrompt(model, prompt)
    }
    window.addEventListener("bo:left-ai-run", handler as any)
    return () => window.removeEventListener("bo:left-ai-run", handler as any)
  }, [runLeftAiPrompt]);

  useEffect(() => {
    const handler = () => undoLastChange()
    window.addEventListener("bo:undo-last-change", handler as any)
    return () => window.removeEventListener("bo:undo-last-change", handler as any)
  }, [undoLastChange]);



  useEffect(() => {
    if (!enabled) { setBlocks([]); setHoverId(null); setSelectedId(null); resetEditorPanelState(); return; }
    const iframe = getIframe();
    if (!iframe) return;
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;

    const onScroll = () => {
      const d = getDoc();
      if (d) {
        renderBoxesInIframe(
          d,
          blocksRef.current.filter((entry) => matchesBlockFilter(entry, blockFilter)),
          hoverIdRef.current,
          selectedIdRef.current,
          (id) => onClickLabelRef.current(id)
        );
      }
    };

    if (doc && doc.readyState === "complete") {
      scanFreePrecise();
      win?.addEventListener("scroll", onScroll, { passive: true });
    }
    const onLoad = () => {
      try {
        const srcKey = (iframeRef?.current?.getAttribute("src") || "") + "|edit";
        if (__autoScrollDoneForKey !== srcKey) {
          __autoScrollDoneForKey = srcKey;
          const w = iframeRef?.current?.contentWindow;
          if (w) __autoScrollOnce(w, { stepPx: 900, delayMs: 35, maxSteps: 260 });
        }
      } catch (e) { console.warn("auto-scroll skipped:", e); }
      scanFreePrecise();
      win?.addEventListener("scroll", onScroll, { passive: true });
    };
    iframe.addEventListener("load", onLoad);
    

  

return () => { iframe.removeEventListener("load", onLoad); win?.removeEventListener("scroll", onScroll); };
  }, [enabled, getIframe, iframeRef, scanFreePrecise, getDoc, blockFilter, resetEditorPanelState]);

  // Overlay nur noch für Scroll-Weiterleitung – kein Click/Hover mehr nötig
  const onOverlayWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const win = getWin();
    if (!win) return;
    e.preventDefault();
    e.stopPropagation();
    try { win.scrollBy({ top: e.deltaY, left: e.deltaX, behavior: "auto" as ScrollBehavior }); }
    catch { win.scrollBy(0, e.deltaY); }
  }, [enabled, getWin]);

  

  const deleteSelectedBlock = () => {
    if (!selectedId) return
    deleteBlockTree(selectedId)
  }


const applyEdit = useCallback(() => {
    const doc = getDoc();
    if (!doc || !selectedId) return;
    
    // Save history before applying changes
    pushHistorySnapshot(doc);
    
    const chosen = blocksRef.current.find(b => b.id === selectedId);
    if (!chosen) return;
    const el = doc.querySelector(chosen.selector) as HTMLElement | null;
    if (!el) return;
    const applyStyleValue = (target: HTMLElement, property: string, value: string) => {
      const trimmed = String(value || "").trim();
      if (trimmed) target.style.setProperty(property, trimmed);
      else target.style.removeProperty(property);
    };

    if (panelType === "button") {
      const btnNode = findButtonNode(el);
      if (btnNode) {
        const spanNode = btnNode.querySelector("span") as HTMLElement | null;
        if (spanNode) spanNode.textContent = editValue;
        else btnNode.childNodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE) n.textContent = editValue; });
        if ("href" in btnNode) {
          const nextHref = (editLink || "").trim();
          if (nextHref) (btnNode as HTMLAnchorElement).setAttribute("href", nextHref);
          else (btnNode as HTMLAnchorElement).removeAttribute("href");
        }
      }
    } else if (panelType === "heading-list") {
      const heading = ["H1","H2","H3","H4"].includes(el.tagName)
        ? el : el.querySelector("h1,h2,h3,h4") as HTMLElement | null;
      if (heading) heading.textContent = editHeading;

      const listEl = ["UL","OL"].includes(el.tagName)
        ? el : el.querySelector("ul,ol") as HTMLElement | null;
      if (listEl) {
        const existingItems = Array.from(listEl.querySelectorAll("li"));
        const bullets = (editBullets || []).filter(b => b.trim());
        bullets.forEach((text, i) => {
          if (existingItems[i]) existingItems[i].textContent = text;
          else {
            const li = doc.createElement("li");
            li.textContent = text;
            if (existingItems[0]) li.className = existingItems[0].className;
            listEl.appendChild(li);
          }
        });
        existingItems.slice(bullets.length).forEach(li => li.remove());
      }
    } else if (panelType === "image") {
      const img = findImageNode(el);
      if (img) {
        const v = (editImgSrc || "").trim();
        if (v) {
          img.src = v;
          img.setAttribute("data-bo-local-src", "1");
          img.removeAttribute("data-bo-placeholder");
        }
        const nextAlt = (editImgAlt || "").trim();
        if (nextAlt) img.setAttribute("alt", nextAlt);
        else img.removeAttribute("alt");
        const linkedImage = findImageLinkNode(el, img);
        if (linkedImage) {
          const nextHref = (editLink || "").trim();
          if (nextHref) linkedImage.setAttribute("href", nextHref);
          else linkedImage.removeAttribute("href");
        }
        const figure = findImageFigure(el, img);
        const nextCaption = (editImgCaption || "").trim();
        let caption = figure?.querySelector("figcaption") as HTMLElement | null;
        if (figure) {
          if (nextCaption) {
            if (!caption) {
              caption = doc.createElement("figcaption");
              figure.appendChild(caption);
            }
            caption.textContent = nextCaption;
          } else if (caption) {
            caption.remove();
          }
        }
        applyStyleValue(img, "width", editImgWidth);
        applyStyleValue(img, "height", editImgHeight);
        applyStyleValue(img, "object-fit", editImgFit);
        applyStyleValue(img, "object-position", editImgPosition);
      }
    } else if (panelType === "nav-links") {
      const anchors = Array.from(el.querySelectorAll("a[href], a")) as HTMLAnchorElement[];
      const items = (editNavLinks || [])
        .map(x => ({
          text: String(x?.text || "").trim(),
          href: String(x?.href || "").trim()
        }))
        .filter(x => x.text || x.href);

      if (anchors.length > 0) {
        items.forEach((item, i) => {
          let a = anchors[i] || null;

          if (!a) {
            const last = anchors[anchors.length - 1];
            if (last && last.parentElement) {
              const clone = last.cloneNode(true) as HTMLAnchorElement;
              clone.textContent = "";
              clone.setAttribute("href", "#");
              last.parentElement.appendChild(clone);
              anchors.push(clone);
              a = clone;
            }
          }

          if (!a) return;
          a.textContent = item.text || "Link";
          a.setAttribute("href", item.href || "#");
        });

        if (anchors.length > items.length) {
          anchors.slice(items.length).forEach((a) => a.remove());
        }
      }
    } else if (panelType === "form-fields") {
      const items = (editFormFields || [])
        .map((item) => ({
          label: String(item?.label || "").trim(),
          name: String(item?.name || "").trim(),
          placeholder: String(item?.placeholder || "").trim(),
          type: String(item?.type || "text").trim() || "text",
        }))
        .filter((item) => item.label || item.name || item.placeholder);

      let records = getEditableFormFieldRecords(el);
      if (records.length) {
        while (records.length > items.length && records.length > 0) {
          const record = records.pop();
          const target = record?.wrapper || record?.node;
          target?.remove();
        }

        while (records.length < items.length && records.length > 0) {
          const base = records[records.length - 1];
          const source = (base.wrapper || base.node).cloneNode(true) as HTMLElement;
          (base.wrapper || base.node).parentElement?.insertBefore(source, (base.wrapper || base.node).nextSibling);
          records = getEditableFormFieldRecords(el);
        }

        records = getEditableFormFieldRecords(el);
        records.slice(0, items.length).forEach((record, index) => {
          const item = items[index];
          const field = record.node as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          const nextName = item.name;
          const nextId = sanitizeFieldId(nextName || field.getAttribute("id") || `field-${index + 1}`);

          if (field.tagName.toLowerCase() === "input") {
            field.setAttribute("type", item.type || "text");
          }
          if (item.placeholder) field.setAttribute("placeholder", item.placeholder);
          else field.removeAttribute("placeholder");

          if (nextName) field.setAttribute("name", nextName);
          else field.removeAttribute("name");

          if (nextId) {
            field.setAttribute("id", nextId);
            if (record.labelEl?.getAttribute("for")) record.labelEl.setAttribute("for", nextId);
          }

          if (item.label) {
            setFormLabelText(record.labelEl, field, item.label);
            if (!record.labelEl) field.setAttribute("aria-label", item.label);
          }
        });
      }
    } else {
      const text = (editValue || "").trim();
      const target = findPrimaryTextTarget(el) || el;
      target.textContent = text;
    }

    const styleTarget = (findButtonNode(el) as HTMLElement | null) || (findImageNode(el) as unknown as HTMLElement | null) || el;
    applyStyleValue(styleTarget, "background-color", editBg);
    applyStyleValue(styleTarget, "color", editColor);
    applyStyleValue(styleTarget, "border-color", editBorderColor);
    applyStyleValue(styleTarget, "font-family", editFontFamily);
    applyStyleValue(styleTarget, "font-size", editFontSize);
    applyStyleValue(styleTarget, "font-weight", editFontWeight);
    applyStyleValue(styleTarget, "line-height", editLineHeight);
    applyStyleValue(el, "padding", editPadding);
    applyStyleValue(el, "margin", editMargin);

    commitDocumentMutation(doc, { preserveSelectionId: selectedId });
  }, [getDoc, selectedId, editValue, editLink, editBg, editColor, editFontSize,
      panelType, editHeading, editBullets, editImgSrc, editImgWidth, editImgHeight, editImgFit, editImgPosition,
      editImgAlt, editImgCaption,
      editNavLinks, editFormFields, editBorderColor, editFontFamily, editFontWeight, editLineHeight,
      editPadding, editMargin, commitDocumentMutation, pushHistorySnapshot]);

  const applyRawHtmlEdit = useCallback(() => {
    const doc = getDoc();
    if (!doc || !selectedId) return;
    const chosen = blocksRef.current.find((entry) => entry.id === selectedId);
    if (!chosen) return;
    const el = doc.querySelector(chosen.selector) as HTMLElement | null;
    if (!el || !el.parentElement) return;

    const wrapper = doc.createElement("div");
    wrapper.innerHTML = rawHtmlValue.trim();
    const nextNode = wrapper.firstElementChild as HTMLElement | null;
    if (!nextNode) {
      toast.error("Raw HTML must contain one root element.")
      return;
    }

    pushHistorySnapshot(doc);
    el.parentElement.insertBefore(nextNode, el);
    el.remove();
    commitDocumentMutation(doc);
    setShowRawHtml(false);
  }, [commitDocumentMutation, getDoc, pushHistorySnapshot, rawHtmlValue, selectedId]);

  const generateImageFromPrompt = useCallback(async () => {
    if (!imagePrompt.trim()) {
      toast.error("Enter an image prompt first.");
      return;
    }
    setImageGenerating(true);
    try {
      const response = await fetchWithAuth("/api/google/imagen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt.trim(), count: 1, quality: "standard" }),
      });
      const data = await response.json();
      const image = data?.images?.[0];
      if (!data?.ok || !image?.base64) {
        throw new Error(data?.error || "Image generation failed");
      }
      setEditImgSrc(`data:${image.mimeType || "image/png"};base64,${image.base64}`);
      toast.success("Image generated");
    } catch (error: any) {
      toast.error(`Image generation failed: ${error?.message || error}`);
    } finally {
      setImageGenerating(false);
    }
  }, [imagePrompt]);

  const aiLayoutAnalyze = async () => {
    const doc = getDoc();
    if (!doc || !selectedId) return;
    const chosen = blocksRef.current.find(b => b.id === selectedId);
    if (!chosen) return;
    const el = doc.querySelector(chosen.selector) as HTMLElement | null;
    if (!el) return;
    const win = doc.defaultView;
    if (!win) return;

    const elRect = el.getBoundingClientRect();
    const elTop = elRect.top + win.scrollY;
    const elBottom = elTop + elRect.height;
    const chosenParent = el.parentElement;

    const sameLevel = blocksRef.current.filter(b => {
      const other = doc.querySelector(b.selector) as HTMLElement | null;
      if (!other) return false;
      if (other === el) return true;
      if ((b.parentId || null) !== (chosen.parentId || null)) return false;
      if ((b.depth || 0) !== (chosen.depth || 0)) return false;
      if (!chosenParent || other.parentElement !== chosenParent) return false;
      if (other.contains(el) || el.contains(other)) return false;
      const r = other.getBoundingClientRect();
      const rTop = r.top + win.scrollY;
      const rBottom = rTop + r.height;
      return rTop < elBottom - 10 && rBottom > elTop + 10;
    });

    if (sameLevel.length < 2) {
      toast.error("Keine anderen Blocks auf gleicher Ebene gefunden.");
      return;
    }

    const blocksHtml = sameLevel.map(b => {
      const e = doc.querySelector(b.selector) as HTMLElement | null;
      return e ? e.outerHTML : "";
    }).filter(Boolean).join("\n");

    try {
      console.log("AI Layout: sending", sameLevel.length, "blocks");
      const res = await fetchWithAuth(ENDPOINTS.rewrite, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: blocksHtml,
          instruction: "Diese HTML-Blocks befinden sich auf der gleichen vertikalen Ebene einer Website. Fasse sie in eine einzige wp-block-columns Struktur zusammen: <div class=\"wp-block-columns\" style=\"display:flex;gap:2em;align-items:stretch;width:100%;\">. Jeder Block kommt in eine <div class=\"wp-block-column\" style=\"flex:1;min-width:0;\">. Gib NUR das fertige HTML zurueck, keine Erklaerung."
        })
      });
      const data = await res.json();
      console.log("AI Layout response:", data, "html length:", data?.html?.length, "keys:", Object.keys(data));
      if (data.usage || data.cost_eur != null) window.dispatchEvent(new CustomEvent("bo:ai-usage", { detail: { usage: data.usage || null, cost_eur: Number(data.cost_eur || 0), model: String(data.model || "unknown") } }));
      if (!data.ok || !data.html) { toast.error("AI Layout fehlgeschlagen: " + (data.error || "kein HTML")); return; }

      console.log("sameLevel selectors:", sameLevel.map(b => b.selector + " -> " + !!doc.querySelector(b.selector)));
      const firstEl = doc.querySelector(sameLevel[0].selector) as HTMLElement | null;
      console.log("firstEl:", firstEl, "parent:", firstEl?.parentElement?.tagName);
      if (!firstEl || !firstEl.parentElement) { toast.error("Kein Element gefunden fuer: " + sameLevel[0].selector); return; }

      const wrap = doc.createElement("div");
      wrap.innerHTML = data.html;
      const newNode = wrap.firstElementChild as HTMLElement | null;
      if (!newNode) return;

      pushHistorySnapshot(doc);
      firstEl.parentElement.insertBefore(newNode, firstEl);
      sameLevel.forEach(b => {
        const e = doc.querySelector(b.selector) as HTMLElement | null;
        if (e && e !== newNode) e.remove();
      });

      commitDocumentMutation(doc);
    } catch(err) {
      console.error("AI Layout:", err);
      toast.error("AI Layout Fehler: " + err);
    }
  };

  // BO_DRAGGRID_BEGIN
  useEffect(() => {
    if (!enabled) return;

    const iframe = iframeRef?.current;
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!iframe || !doc || !win) return;

    const templates: Record<string,string> = {
      heading: `<h2 data-bo-new="1" style="margin:16px 0;font-size:28px;font-weight:800;">New Heading</h2>`,
      text: `<p data-bo-new="1" style="margin:12px 0;font-size:16px;line-height:1.5;">New paragraph…</p>`,
      button: `<div data-bo-new="1" class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#" style="background:#3b82f6;color:#fff;padding:12px 18px;border-radius:10px;display:inline-block;font-weight:700;text-decoration:none;">Button</a></div>`,
      image: `<figure data-bo-new="1" class="wp-block-image"><img data-bo-placeholder="1" alt="PLACEHOLDER: replace image in WordPress" src="" style="max-width:100%;height:auto;border:1px dashed rgba(148,163,184,0.7);padding:14px;border-radius:12px;" /></figure>`,
      divider: `<hr data-bo-new="1" style="border:none;border-top:1px solid rgba(148,163,184,0.35);margin:18px 0;" />`,
    };

    if (!doc.body) return;

    let grid = doc.getElementById("__bo_drag_grid") as HTMLElement | null;
    if (!grid) {
      grid = doc.createElement("div");
      grid.id = "__bo_drag_grid";
      grid.style.position = "fixed";
      grid.style.left = "0";
      grid.style.top = "0";
      grid.style.right = "0";
      grid.style.bottom = "0";
      grid.style.zIndex = "2147483647";
      grid.style.pointerEvents = "none";
      grid.style.display = "none";
      grid.style.backgroundImage = "linear-gradient(rgba(59,130,246,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.10) 1px, transparent 1px)";
      grid.style.backgroundSize = "48px 48px, 48px 48px";
      grid.style.backdropFilter = "blur(0px)";
      doc.body.appendChild(grid);
    }

    let line = doc.getElementById("__bo_drag_line") as HTMLElement | null;
    if (!line) {
      line = doc.createElement("div");
      line.id = "__bo_drag_line";
      line.style.position = "fixed";
      line.style.left = "0";
      line.style.right = "0";
      line.style.height = "2px";
      line.style.zIndex = "2147483647";
      line.style.pointerEvents = "none";
      line.style.display = "none";
      line.style.background = "rgba(59,130,246,0.95)";
      line.style.boxShadow = "0 0 10px rgba(59,130,246,0.75)";
      doc.body.appendChild(line);
    }
    const mapToIframe = (clientX:number, clientY:number) => {
      const r = iframe.getBoundingClientRect();
      const x = clientX - r.left;
      const y = clientY - r.top;
      return { r, x, y };
    };

    const pickSnapTarget = (clientY:number) => {
      const { r, y } = mapToIframe(0, clientY);
      const xmid = (r.width / 2);
      const el = doc.elementFromPoint(xmid, y) as HTMLElement | null;
      const target = (el?.closest?.("[data-block-id]") as HTMLElement | null);
      if (!target) return null;
      const tr = target.getBoundingClientRect();
      const before = (y - tr.top) < (tr.height / 2);
      const lineY = before ? tr.top : tr.bottom;
      const id = target.getAttribute("data-block-id") || "";
      if (!id) return null;
      return { id, before, lineY };
    };

    const isInIframeRect = (clientX:number, clientY:number) => {
      const r = iframe.getBoundingClientRect();
      return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
    };

    const show = () => {
      grid!.style.display = "block";
      line!.style.display = "block";
    };
    const hide = () => {
      grid!.style.display = "none";
      line!.style.display = "none";
      (win as any).__boDrop = null;
    };

    const onWinDragOver = (e: DragEvent) => {
      const type = (e.dataTransfer?.getData("text/plain") || "").trim();
      if (!type) return;

      if (!isInIframeRect(e.clientX, e.clientY)) { hide(); return; }

      e.preventDefault();
      show();

      const t = pickSnapTarget(e.clientY);
      if (!t) { (win as any).__boDrop = null; line!.style.display = "none"; return; }

      line!.style.display = "block";
      line!.style.top = `${t.lineY}px`;
      (win as any).__boDrop = { id: t.id, before: t.before, type };
    };

    const onWinDrop = (e: DragEvent) => {
      const type = (e.dataTransfer?.getData("text/plain") || "").trim();
      if (!type) return;

      if (!isInIframeRect(e.clientX, e.clientY)) { hide(); return; }

      e.preventDefault();

      const html = templates[type];
      if (!html) { hide(); return; }

      const wrap = doc.createElement("div");
      wrap.innerHTML = html;
      const node = wrap.firstElementChild as HTMLElement | null;
      if (!node) { hide(); return; }

      const dt = (win as any).__boDrop;
      const target = dt?.id ? (doc.querySelector(`[data-block-id="${dt.id}"]`) as HTMLElement | null) : null;

      if (target) {
        if (dt.before) target.insertAdjacentElement("beforebegin", node);
        else target.insertAdjacentElement("afterend", node);
      } else if (doc.body) {
        doc.body.appendChild(node);
      }

      hide();
      commitDocumentMutation(doc);
    };

    const onWinDragEnd = () => hide();

    window.addEventListener("dragover", onWinDragOver as any);
    window.addEventListener("drop", onWinDrop as any);
    window.addEventListener("dragend", onWinDragEnd as any);

    return () => {
      window.removeEventListener("dragover", onWinDragOver as any);
      window.removeEventListener("drop", onWinDrop as any);
      window.removeEventListener("dragend", onWinDragEnd as any);
      try { hide(); } catch {}
    };
  }, [commitDocumentMutation, enabled, iframeRef, onHtmlChange, scanFreePrecise]);
  // BO_DRAGGRID_END


  if (!enabled) return null;

  const selectedEntry = selectedId ? blocks.find((entry) => entry.id === selectedId) || null : null;
  const selectedDisplayLabel = selectedEntry ? getBlockDisplayLabel(selectedEntry, blocks) : selectedId || "";
  const selectedRootId = getBlockRootId(selectedId);
  const selectedRootEntry = selectedRootId ? blocks.find((entry) => entry.id === selectedRootId) || null : null;

  

  

return (
    <>
      

      {drawRect && drawRect.width > 5 && drawRect.height > 5 && (
        <div style={{
          position: "fixed",
          left: drawRect.left, top: drawRect.top,
          width: drawRect.width, height: drawRect.height,
          border: "2px dashed rgba(34,197,94,0.9)",
          background: "rgba(34,197,94,0.08)",
          zIndex: 999999, pointerEvents: "none", borderRadius: 4,
        }} />
      )}

      {boPickArmed && boGridRect && (
        <div
          style={{
            position: "fixed",
            left: boGridRect.left,
            top: boGridRect.top,
            width: boGridRect.width,
            height: boGridRect.height,
            zIndex: 999999,
            pointerEvents: "none",
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.16) 0, rgba(255,255,255,0.16) 1px, transparent 1px, transparent 44px), repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0, rgba(255,255,255,0.16) 1px, transparent 1px, transparent 44px)",
            outline: "2px dashed rgba(34,197,94,0.85)",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.22) inset",
          }}
        >
          <div style={{ position:"absolute", left:12, top:10, padding:"6px 10px", borderRadius:10, background:"rgba(0,0,0,0.6)", color:"white", fontSize:12, fontWeight:900 }}>
            PLACE MODE • {boPickType || "block"} • aufziehen um Größe zu bestimmen • ESC = abbrechen
          </div>
        </div>
      )}
{/* BO_DRAGGRID_UI_V1 */}
      {isDraggingBlock && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 58, // below toolbar
            right: 0,
            bottom: 0,
            zIndex: 180,
            pointerEvents: "none",
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            backgroundPosition: "0 0",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 12,
              top: 12,
              padding: "6px 10px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.55)",
              color: "white",
              fontSize: 12,
              fontWeight: 800,
              border: "1px solid rgba(148,163,184,0.25)",
            }}
          >
            Drop to add block
          </div>
        </div>
      )}

      {/* Nur für Scroll-Events, kein pointer-events auf Inhalt */}
      <div data-bo-place-overlay="1" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 200, pointerEvents: boPickArmed ? "auto" : "none", cursor: boPickArmed ? "crosshair" : "default" }}
        onWheel={onOverlayWheel} />

      {/* AI Cost Confirmation Modal */}
      {showCostModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowCostModal(false)}>
          <div style={{
            background: "rgba(15,20,35,0.98)", border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 16, padding: 28, minWidth: 320, maxWidth: 400,
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "white", marginBottom: 8 }}>✦ KI-Anfrage starten?</div>
            <div style={{ fontSize: 13, color: "rgba(148,163,184,0.8)", marginBottom: 20, lineHeight: 1.6 }}>
              Diese Anfrage verwendet Credits aus deinem Konto.
            </div>
            <div style={{
              background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: 10, padding: "12px 16px", marginBottom: 20,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 12, color: "rgba(148,163,184,0.7)" }}>Geschätzte Kosten</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "rgba(99,102,241,0.9)" }}>~€0.01 – 0.05</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowCostModal(false)} style={{
                flex: 1, height: 40, borderRadius: 8, border: "1px solid rgba(148,163,184,0.2)",
                background: "transparent", color: "rgba(148,163,184,0.6)", fontSize: 13, cursor: "pointer",
              }}>Abbrechen</button>
              <button onClick={() => {
                setShowCostModal(false);
                if (pendingAiAction) { pendingAiAction(); setPendingAiAction(null); }
              }} style={{
                flex: 2, height: 40, borderRadius: 8, border: "none",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>✦ Jetzt starten</button>
            </div>
          </div>
        </div>
      )}
      {selectedId && (
        <div style={{
          position: "fixed", right: 14, bottom: 14, width: 380, zIndex: 500,
          background: "rgba(15,23,42,0.96)", border: "1px solid rgba(148,163,184,0.25)",
          borderRadius: 14, boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
          padding: 14, color: "white", fontFamily: "system-ui, sans-serif",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>
              {panelType === "group"
                ? "▥ Gruppe"
                : ""}
              {panelType === "button"
                ? "◉ Button"
                : panelType === "heading-list"
                  ? "≡ Heading + Liste"
                  : panelType === "nav-links"
                    ? "☰ Navigation"
                    : panelType === "form-fields"
                      ? "⌘ Formular"
                      : panelType === "image"
                        ? "▣ Bild"
                        : panelType === "group"
                          ? ""
                          : "✐ Text"} · {selectedDisplayLabel}
            </div>
            <button onClick={() => { setSelectedId(null); resetEditorPanelState(); }} style={{
              height: 28, padding: "0 10px", borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(0,0,0,0.2)", color: "white", cursor: "pointer", fontWeight: 800,
            }}>✕</button>
          </div>

          {panelType === "group" && selectedRootEntry && (<>
            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700 }}>MOTHERBLOCK PREVIEW</div>
            <div style={{
              marginTop: 6,
              width: "100%",
              height: 156,
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.22)",
              overflow: "hidden",
              background: "rgba(0,0,0,0.22)",
            }}>
              <iframe
                title={`preview-${selectedRootEntry.id}`}
                srcDoc={groupPreviewHtml}
                style={{ width: "100%", height: "100%", border: "none", background: "white" }}
                sandbox="allow-same-origin"
              />
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "rgba(148,163,184,0.78)", lineHeight: 1.4 }}>
              Expand to edit child blocks, or manage the whole motherblock here.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              <button onClick={() => moveTopLevelRoot(selectedRootEntry.id, -1)} style={{
                height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.22)",
                background: "rgba(255,255,255,0.04)", color: "white", cursor: "pointer", fontWeight: 800, fontSize: 12,
              }}>↑ Move up</button>
              <button onClick={() => moveTopLevelRoot(selectedRootEntry.id, 1)} style={{
                height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.22)",
                background: "rgba(255,255,255,0.04)", color: "white", cursor: "pointer", fontWeight: 800, fontSize: 12,
              }}>↓ Move down</button>
              <button onClick={() => splitSelectedRoot(selectedRootEntry.id)} style={{
                height: 34, borderRadius: 10, border: "1px solid rgba(245,158,11,0.28)",
                background: "rgba(245,158,11,0.12)", color: "white", cursor: "pointer", fontWeight: 800, fontSize: 12,
              }}>Split group</button>
              <button onClick={() => deleteBlockTree(selectedRootEntry.id)} style={{
                height: 34, borderRadius: 10, border: "1px solid rgba(239,68,68,0.32)",
                background: "rgba(239,68,68,0.14)", color: "white", cursor: "pointer", fontWeight: 800, fontSize: 12,
              }}>Delete group</button>
            </div>
          </>)}

          {/* Heading + List Panel */}
          {panelType === "heading-list" && (<>
            <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700, display:"block" }}>ÜBERSCHRIFT</label>
            <input value={editHeading} onChange={e => setEditHeading(e.target.value)} style={{
              marginTop: 4, width: "100%", height: 36, borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.25)", background: "rgba(0,0,0,0.25)",
              color: "white", padding: "0 10px", outline: "none", fontSize: 13, boxSizing: "border-box",
            }} />
            <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700, display:"block", marginTop: 10 }}>BULLET POINTS</label>
            {editBullets.map((bullet, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                <span style={{ color: "rgba(148,163,184,0.6)", fontSize: 13, flexShrink: 0 }}>•</span>
                <input value={bullet} onChange={e => {
                  const next = [...editBullets]; next[i] = e.target.value; setEditBullets(next);
                }} style={{
                  flex: 1, height: 32, borderRadius: 8, border: "1px solid rgba(148,163,184,0.2)",
                  background: "rgba(0,0,0,0.2)", color: "white", padding: "0 8px", outline: "none", fontSize: 12,
                }} />
                <button onClick={() => setEditBullets(editBullets.filter((_, j) => j !== i))}
                  style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: "rgba(239,68,68,0.3)", color: "white", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✕</button>
              </div>
            ))}
            <button onClick={() => setEditBullets([...editBullets, ""])} style={{
              marginTop: 8, width: "100%", height: 30, borderRadius: 8,
              border: "1px dashed rgba(148,163,184,0.3)", background: "transparent",
              color: "rgba(148,163,184,0.7)", cursor: "pointer", fontSize: 12,
            }}>+ Bullet Point hinzufügen</button>
          </>)}

          {/* Text / Generic Panel */}
          {(panelType === "text" || panelType === "generic") && (<>
            <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700 }}>TEXT</label>
            <textarea value={editValue} onChange={e => setEditValue(e.target.value)} style={{
              marginTop: 4, width: "100%", height: 120, resize: "vertical",
              borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)", background: "rgba(0,0,0,0.25)",
              color: "white", padding: 8, outline: "none", fontSize: 13, lineHeight: 1.35, boxSizing: "border-box",
            }} />
          </>)}

          {/* Button Panel */}
          
            {/* Nav Links Panel */}
            {panelType === "nav-links" && (<>
              <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700 }}>NAV LINKS</label>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 8 }}>
                {editNavLinks.map((it, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={it.text} onChange={e => {
                      const v = e.target.value;
                      setEditNavLinks(prev => prev.map((x,i) => i===idx ? { ...x, text: v } : x));
                    }} placeholder="Text" style={{
                      flex: 1, height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                      background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 13,
                    }} />
                    <input value={it.href} onChange={e => {
                      const v = e.target.value;
                      setEditNavLinks(prev => prev.map((x,i) => i===idx ? { ...x, href: v } : x));
                    }} placeholder="https://..." style={{
                      flex: 1.2, height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                      background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 13,
                    }} />
                    <button onClick={() => setEditNavLinks(prev => prev.filter((_,i) => i!==idx))} style={{
                      height: 34, padding: "0 10px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.45)",
                      background: "rgba(239,68,68,0.12)", color: "white", cursor: "pointer", fontWeight: 900,
                    }}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setEditNavLinks(prev => [...prev, { text: "", href: "" }])} style={{
                marginTop: 10, width: "100%", height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(0,0,0,0.18)", color: "rgba(148,163,184,0.9)", cursor: "pointer", fontSize: 12, fontWeight: 800,
              }}>+ Link hinzufügen</button>
            </>)}

            {/* Form Fields Panel */}
            {panelType === "form-fields" && (<>
              <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700 }}>FORM FIELDS</label>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 8 }}>
                {editFormFields.map((it, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                    <input value={it.label} onChange={e => {
                      const v = e.target.value;
                      setEditFormFields(prev => prev.map((x,i) => i===idx ? { ...x, label: v } : x));
                    }} placeholder="Label" style={{
                      height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                      background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 13,
                    }} />
                    <input value={it.name} onChange={e => {
                      const v = e.target.value;
                      setEditFormFields(prev => prev.map((x,i) => i===idx ? { ...x, name: v } : x));
                    }} placeholder="name/id" style={{
                      height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                      background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 13,
                    }} />
                    <input value={it.placeholder} onChange={e => {
                      const v = e.target.value;
                      setEditFormFields(prev => prev.map((x,i) => i===idx ? { ...x, placeholder: v } : x));
                    }} placeholder="placeholder" style={{
                      height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                      background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 13,
                    }} />
                    <button onClick={() => setEditFormFields(prev => prev.filter((_,i) => i!==idx))} style={{
                      height: 34, padding: "0 10px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.45)",
                      background: "rgba(239,68,68,0.12)", color: "white", cursor: "pointer", fontWeight: 900,
                    }}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setEditFormFields(prev => [...prev, { label: "", name: "", placeholder: "", type: "text" }])} style={{
                marginTop: 10, width: "100%", height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(0,0,0,0.18)", color: "rgba(148,163,184,0.9)", cursor: "pointer", fontSize: 12, fontWeight: 800,
              }}>+ Feld hinzufügen</button>
            </>)}

            {/* Image Panel */}
            {panelType === "image" && (<>
              <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700 }}>BILD</label>
              <div style={{ marginTop: 6, width: "100%", height: 140, borderRadius: 12, border: "1px solid rgba(148,163,184,0.25)", overflow: "hidden", background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {editImgSrc ? (
                  <img src={editImgSrc} alt="Preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                ) : (
                  <div style={{ fontSize: 12, color: "rgba(148,163,184,0.7)", fontWeight: 700 }}>Kein Bild gefunden</div>
                )}
              </div>
              <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700, display: "block", marginTop: 10 }}>BILD QUELLE</label>
              <input value={editImgSrc} onChange={e => setEditImgSrc(e.target.value)} placeholder="https://... (oder Upload)" style={{
                marginTop: 4, width: "100%", height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 13, boxSizing: "border-box",
              }} />
              <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700, display: "block", marginTop: 10 }}>ALT TEXT</label>
              <input value={editImgAlt} onChange={e => setEditImgAlt(e.target.value)} placeholder="Describe the image for accessibility and SEO" style={{
                marginTop: 4, width: "100%", height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 13, boxSizing: "border-box",
              }} />
              <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700, display: "block", marginTop: 10 }}>CAPTION</label>
              <input value={editImgCaption} onChange={e => setEditImgCaption(e.target.value)} placeholder="Optional figure caption" style={{
                marginTop: 4, width: "100%", height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 13, boxSizing: "border-box",
              }} />
              <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700, display: "block", marginTop: 10 }}>LINK URL</label>
              <input
                value={editLink}
                onChange={e => setEditLink(e.target.value)}
                placeholder="https://... oder /seite"
                style={{
                  marginTop: 4, width: "100%", height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 13, boxSizing: "border-box",
                }}
              />
              <input type="file" accept="image/*" onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = URL.createObjectURL(f);
                setEditImgSrc(url);
              }} style={{ marginTop: 8, width: "100%", color: "white" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
                <input value={editImgWidth} onChange={e => setEditImgWidth(e.target.value)} placeholder="Width" style={{
                  height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 12,
                }} />
                <input value={editImgHeight} onChange={e => setEditImgHeight(e.target.value)} placeholder="Height" style={{
                  height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 12,
                }} />
                <select value={editImgFit} onChange={e => setEditImgFit(e.target.value)} style={{
                  height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 12,
                }}>
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="fill">Fill</option>
                  <option value="scale-down">Scale down</option>
                </select>
              </div>
              <select value={editImgPosition} onChange={e => setEditImgPosition(e.target.value)} style={{
                marginTop: 8, width: "100%", height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 12,
              }}>
                <option value="center center">Crop focus: Center</option>
                <option value="center top">Crop focus: Top</option>
                <option value="center bottom">Crop focus: Bottom</option>
                <option value="left center">Crop focus: Left</option>
                <option value="right center">Crop focus: Right</option>
                <option value="left top">Crop focus: Top left</option>
                <option value="right top">Crop focus: Top right</option>
                <option value="left bottom">Crop focus: Bottom left</option>
                <option value="right bottom">Crop focus: Bottom right</option>
              </select>
              <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700, display: "block", marginTop: 10 }}>AI IMAGE PROMPT</label>
              <textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="Generate a replacement image..." style={{
                marginTop: 4, width: "100%", height: 72, resize: "vertical",
                borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)", background: "rgba(0,0,0,0.25)",
                color: "white", padding: 8, outline: "none", fontSize: 12, boxSizing: "border-box",
              }} />
              <button onClick={() => void generateImageFromPrompt()} disabled={imageGenerating} style={{
                marginTop: 8, width: "100%", height: 34, borderRadius: 10,
                border: "1px solid rgba(34,197,94,0.32)", background: "rgba(34,197,94,0.14)",
                color: "white", cursor: imageGenerating ? "wait" : "pointer", fontSize: 12, fontWeight: 800,
              }}>{imageGenerating ? "Generating..." : "Generate image"}</button>
              <div style={{ marginTop: 8, fontSize: 11, color: "rgba(148,163,184,0.7)", lineHeight: 1.25 }}>
                Upload ist nur für Preview/Editor. Beim Export wird daraus ein Platzhalter (Bild später in WordPress Media Library ersetzen).
              </div>
            </>)}

{panelType === "button" && (<>
            <label htmlFor="button-text" style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700 }}>BUTTON TEXT</label>
            <textarea id="button-text" value={editValue} onChange={e => setEditValue(e.target.value)} style={{
              marginTop: 4, width: "100%", height: 60, resize: "vertical",
              borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)", background: "rgba(0,0,0,0.25)",
              color: "white", padding: "8px", outline: "none", fontSize: 13, boxSizing: "border-box",
            }} aria-label="Button text" />
            <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700, display: "block", marginTop: 10 }}>LINK URL</label>
            <input
              value={editLink}
              onChange={e => setEditLink(e.target.value)}
              placeholder="https://... oder /seite"
              style={{
                marginTop: 4, width: "100%", height: 34, borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.25)", background: "rgba(0,0,0,0.25)",
                color: "white", padding: "0 10px", outline: "none", fontSize: 13, boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700, display: "block" }}>HINTERGRUND</label>
                <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                  <input type="color" value={editBg.startsWith("#") ? editBg : "#3b82f6"} onChange={e => setEditBg(e.target.value)}
                    style={{ width: 34, height: 34, borderRadius: 8, border: "none", cursor: "pointer" }} />
                  <input value={editBg} onChange={e => setEditBg(e.target.value)} style={{
                    flex: 1, height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(0,0,0,0.25)", color: "white", padding: "0 8px", outline: "none", fontSize: 12,
                  }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700, display: "block" }}>TEXTFARBE</label>
                <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                  <input type="color" value={editColor.startsWith("#") ? editColor : "#ffffff"} onChange={e => setEditColor(e.target.value)}
                    style={{ width: 34, height: 34, borderRadius: 8, border: "none", cursor: "pointer" }} />
                  <input value={editColor} onChange={e => setEditColor(e.target.value)} style={{
                    flex: 1, height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(0,0,0,0.25)", color: "white", padding: "0 8px", outline: "none", fontSize: 12,
                  }} />
                </div>
              </div>
            </div>
            <label style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 700, display: "block", marginTop: 10 }}>SCHRIFTGRÖSSE</label>
            <input value={editFontSize} onChange={e => setEditFontSize(e.target.value)} placeholder="16px" style={{
              marginTop: 4, width: "100%", height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 13, boxSizing: "border-box",
            }} />
          </>)}

          {panelType !== "group" && (
            <div style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid rgba(148,163,184,0.16)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              <div style={{ fontSize: 11, color: "rgba(148,163,184,0.82)", fontWeight: 800 }}>STYLE CONTROLS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {[
                  { label: "Text", value: editColor, set: setEditColor, fallback: "#ffffff" },
                  { label: "Background", value: editBg, set: setEditBg, fallback: "#3b82f6" },
                  { label: "Border", value: editBorderColor, set: setEditBorderColor, fallback: "#94a3b8" },
                ].map((item) => (
                  <div key={item.label}>
                    <label style={{ fontSize: 10, color: "rgba(148,163,184,0.72)", fontWeight: 700, display: "block" }}>{item.label}</label>
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <input type="color" value={item.value.startsWith("#") ? item.value : item.fallback} onChange={e => item.set(e.target.value)}
                        style={{ width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer" }} />
                      <input value={item.value} onChange={e => item.set(e.target.value)} style={{
                        flex: 1, height: 32, borderRadius: 8, border: "1px solid rgba(148,163,184,0.22)",
                        background: "rgba(0,0,0,0.22)", color: "white", padding: "0 8px", outline: "none", fontSize: 11,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                <input value={editFontFamily} onChange={e => setEditFontFamily(e.target.value)} placeholder="Font family" style={{
                  height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 12,
                }} />
                <input value={editFontSize} onChange={e => setEditFontSize(e.target.value)} placeholder="Font size" style={{
                  height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 12,
                }} />
                <input value={editFontWeight} onChange={e => setEditFontWeight(e.target.value)} placeholder="Font weight" style={{
                  height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 12,
                }} />
                <input value={editLineHeight} onChange={e => setEditLineHeight(e.target.value)} placeholder="Line height" style={{
                  height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 12,
                }} />
                <input value={editPadding} onChange={e => setEditPadding(e.target.value)} placeholder="Padding" style={{
                  height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 12,
                }} />
                <input value={editMargin} onChange={e => setEditMargin(e.target.value)} placeholder="Margin" style={{
                  height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(0,0,0,0.25)", color: "white", padding: "0 10px", outline: "none", fontSize: 12,
                }} />
              </div>
              <button onClick={() => setShowRawHtml((value) => !value)} style={{
                height: 32, borderRadius: 10, border: "1px solid rgba(148,163,184,0.22)",
                background: "rgba(255,255,255,0.04)", color: "white", cursor: "pointer", fontWeight: 800, fontSize: 11,
              }}>{showRawHtml ? "Hide raw HTML" : "Edit raw HTML"}</button>
              {showRawHtml && (
                <>
                  <textarea value={rawHtmlValue} onChange={e => setRawHtmlValue(e.target.value)} style={{
                    width: "100%", minHeight: 140, resize: "vertical",
                    borderRadius: 10, border: "1px solid rgba(148,163,184,0.24)", background: "rgba(0,0,0,0.28)",
                    color: "white", padding: 10, outline: "none", fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, monospace", boxSizing: "border-box",
                  }} />
                  <button onClick={applyRawHtmlEdit} style={{
                    height: 32, borderRadius: 10, border: "1px solid rgba(59,130,246,0.32)",
                    background: "rgba(59,130,246,0.14)", color: "white", cursor: "pointer", fontWeight: 800, fontSize: 11,
                  }}>Apply raw HTML</button>
                </>
              )}
            </div>
          )}

          {panelType !== "group" && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={aiLayoutAnalyze} title="AI analysiert Blocks auf gleicher Ebene und erstellt Columns" style={{
              height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(168,85,247,0.4)",
              background: "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(139,92,246,0.2))",
              color: "white", cursor: "pointer", fontWeight: 700, fontSize: 11, marginRight: 4,
            }}>⬡ Layout</button>

            <button onClick={applyEdit} style={{
              flex: 1, height: 36, borderRadius: 12, border: "1px solid rgba(59,130,246,0.55)",
              background: "rgba(59,130,246,0.25)", color: "white", cursor: "pointer", fontWeight: 900, fontSize: 13,
            }}>✓ Apply</button>
<button
onClick={deleteSelectedBlock}
style={{
padding:"8px 10px",
background:"#ef4444",
color:"white",
border:"none",
borderRadius:"8px",
cursor:"pointer",
marginLeft:"6px"
}}
>
Delete
</button>

            <button onClick={() => aiRescan("block")} disabled={aiLoading} style={{
              height: 36, padding: "0 12px", borderRadius: 12, border: "1px solid rgba(168,85,247,0.55)",
              background: "rgba(168,85,247,0.2)", color: "white", cursor: aiLoading ? "wait" : "pointer", fontWeight: 900, fontSize: 12,
            }}>⬡ Block</button>
	            <button onClick={() => scanFreePrecise(true)} style={{
              height: 36, padding: "0 12px", borderRadius: 12, border: "1px solid rgba(245,158,11,0.45)",
              background: "rgba(245,158,11,0.15)", color: "white", cursor: "pointer", fontWeight: 900, fontSize: 13,
            }}>↺</button>
          </div>
          )}
        </div>
      )}
    </>
  );
}
