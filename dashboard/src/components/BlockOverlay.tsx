import React, { useCallback, useEffect, useRef, 
useState } from "react";
import { toast } from "./Toast";
import { getRequireApproval } from "../approval-settings";

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

type BlockEntry = { id: string; label: string; selector: string; isButton: boolean; docTop: number; };

type Props = {
  canvasMode?: boolean;

  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  enabled: boolean;
  onStatus?: (s: "idle" | "blocked" | "ok") => void;
  onHtmlChange?: (html: string) => void;
};

// Universal Block Discovery - Works on ANY website regardless of broken JS
function discoverUniversalBlocks(doc: Document): Map<string, string> {
  const discoveries = new Map<string, string>();
  
  // Find ALL clickable elements (no dependency on JS working)
  const clickables = doc.querySelectorAll('a, button, [onclick], [role="button"], [data-toggle], .dropdown-toggle, .accordion-header, input[type="button"], input[type="submit"]');
  
  clickables.forEach((el) => {
    const element = el as HTMLElement;
    const selector = generateSelector(element);
    
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
        const dropdown = doc.querySelector(dropdownId);
        if (dropdown) {
          const items = dropdown.querySelectorAll('a, li, button');
          if (items.length > 0) {
            const itemTexts = Array.from(items).slice(0, 5).map(item => 
              (item.textContent || '').trim()
            ).filter(text => text).join(', ');
            description += ` containing: ${itemTexts}`;
          }
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
  });
  
  return discoveries;
}

// Generate unique selector for element
function generateSelector(el: Element): string {
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
}

// Enhanced block detection with universal discovery
function pickLabel(el: Element, discoveries?: Map<string, string>): string {
  const tag = el.tagName.toLowerCase();
  const cls = (el.getAttribute("class") || "").trim();
  
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
  if (el.tagName.toLowerCase() === "a") return el as HTMLAnchorElement;
  if (el.tagName.toLowerCase() === "button") return el as HTMLButtonElement;
  return el.querySelector("a.wp-block-button__link, a[href], button") as HTMLAnchorElement | HTMLButtonElement | null;
}

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return rgb.startsWith("#") ? rgb : "#3b82f6";
  return "#" + [m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, "0")).join("");
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

  for (const b of blocks) {
    const target = doc.querySelector(b.selector) as HTMLElement | null;
    if (!target) continue;
    const rect = target.getBoundingClientRect();
    const docLeft = rect.left + win.scrollX;
    const docTop = rect.top + win.scrollY;
    const docBottom = docTop + rect.height;
    if (rect.width < 1 || rect.height < 1) continue;

    // NUR sichtbare Blocks anzeigen (im aktuellen Viewport)
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
    const labelText = `${b.id} · ${b.label}`;
    const estimatedWidth = labelText.length * 7 + 20;
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
export default function BlockOverlay({ iframeRef, enabled, canvasMode, onStatus, onHtmlChange }: Props) {

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
      toast.error("Keine Rückgängig-History vorhanden.");
      return;
    }
    arr.pop();
    const prev = arr[arr.length - 1];
    try { onHtmlChange?.(prev); } catch {}
    setTimeout(() => {
      try { window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { mode: "page" } })); } catch {}
    }, 120);
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
    if (!enabled) return
    boApplyCanvasMode(!!canvasMode)
    try { onHtmlChange?.(serializeIframeHtml(iframeRef.current?.contentDocument || document)) } catch {}
  }, [enabled, canvasMode])


  useEffect(() => {
    if (!enabled) return

    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!iframe || !doc) return

    const stopInteractive = (e: Event) => {
      const t = e.target as HTMLElement | null
      if (!t) return

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
        if (!firstBlock || !firstBlock.parentElement) { doc.body.appendChild(node); }
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
          } else { doc.body.appendChild(node); }
        } else { doc.body.appendChild(node); }
      }

      try { onHtmlChange?.(serializeIframeHtml(doc)); } catch {}
      setTimeout(() => {
        try { window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { mode: "page" } })); } catch {}
      }, 100);
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
  }, [boPickArmed, boPickType]);


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
        doc.body.appendChild(node)
      } else {
        const r = target.getBoundingClientRect()
        const before = e.clientY < r.top + r.height / 2
        if (before) target.parentNode?.insertBefore(node, target)
        else target.parentNode?.insertBefore(node, target.nextSibling)
      }

      try { onHtmlChange?.(doc.documentElement.outerHTML) } catch {}
      try { (window as any).dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { mode: "page" } })) } catch {}
    }

    doc.addEventListener("dragover", onDragOver)
    doc.addEventListener("drop", onDrop)

    return () => {
      doc.removeEventListener("dragover", onDragOver)
      doc.removeEventListener("drop", onDrop)
    }
  }, [iframeRef, onHtmlChange])


  const [blocks, setBlocks] = useState<BlockEntry[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const [editFontSize, setEditFontSize] = useState("16px");
  const [editImgSrc, setEditImgSrc] = useState("");
  const [isButtonSelected, setIsButtonSelected] = useState(false);
  // Heading + List Panel
  const [panelType, setPanelType] = useState<"text"|"button"|"heading-list"|"nav-links"|"form-fields"|"generic"|"image">("generic");
  const [editHeading, setEditHeading] = useState("");
  const [editBullets, setEditBullets] = useState<string[]>([]);
  
  type NavLinkItem = { text: string; href: string };
  type FormFieldItem = { label: string; name: string; placeholder: string; type: string };

  const [editNavLinks, setEditNavLinks] = useState<NavLinkItem[]>([]);
  const [editFormFields, setEditFormFields] = useState<FormFieldItem[]>([]);
const [aiLoading, setAiLoading] = useState(false);

  const blocksRef = useRef<BlockEntry[]>([]);
  const hoverIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const onClickLabelRef = useRef<(id: string) => void>(() => {});
  blocksRef.current = blocks;
  hoverIdRef.current = hoverId;
  selectedIdRef.current = selectedId;

  const getIframe = useCallback(() => iframeRef.current, [iframeRef]);
  const getDoc = useCallback(() => getIframe()?.contentDocument ?? null, [getIframe]);
  const getWin = useCallback(() => getIframe()?.contentWindow ?? null, [getIframe]);

  const selectBlock = useCallback((id: string) => {
    const doc = getDoc();
    if (!doc) return;
    const b = blocksRef.current.find(x => x.id === id);
    if (!b) return;
    setSelectedId(id);
    const el = doc.querySelector(b.selector) as HTMLElement | null;
    if (!el) return;

    const btnNode = findButtonNode(el);
        const imgNode = (el.tagName === "IMG" ? el : (el.querySelector("img") as HTMLElement | null)) as HTMLImageElement | null;
const isBtn = b.isButton || !!btnNode;

    // Heading + Liste erkennen
    const heading = el.querySelector("h1,h2,h3,h4") as HTMLElement | null;
    const list = el.querySelector("ul,ol") as HTMLElement | null;
    const hasHeadingAndList = heading && list;
    const isHeadingEl = ["H1","H2","H3","H4"].includes(el.tagName);
    const isListEl = ["UL","OL"].includes(el.tagName);


    // --- NAV + FORM detection (single block, edit inner items) ---
    const linkNodes = Array.from(el.querySelectorAll("a[href]")) as HTMLAnchorElement[];
    const uniqLinks: HTMLAnchorElement[] = [];
    for (const a of linkNodes) {
      const href = (a.getAttribute("href") || "").trim();
      const text = (a.textContent || "").trim();
      // ignore empty/anchorless
      if (!href && !text) continue;
      // avoid duplicates by same node reference
      if (!uniqLinks.includes(a)) uniqLinks.push(a);
    }

    const inputNodes = Array.from(el.querySelectorAll("input, textarea, select")) as HTMLElement[];
    const isFormLike = el.tagName === "FORM" || inputNodes.length >= 2;

    // NAV-like: nav element OR lots of links close together
    const isNavLike = el.tagName === "NAV" || (uniqLinks.length >= 2 && !!el.closest("header, nav, footer"));

    if (isNavLike && uniqLinks.length >= 2) {
      setPanelType("nav-links");
      setIsButtonSelected(false);

      const items = uniqLinks.slice(0, 30).map(a => ({
        text: (a.textContent || "").trim(),
        href: (a.getAttribute("href") || (a as any).href || "").toString(),
      }));
      setEditNavLinks(items.length ? items : [{ text: "", href: "" }]);

      setEditValue("");
      setEditLink("");
      setEditHeading("");
      setEditBullets([]);
      setEditFormFields([]);
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
        const name = (node.getAttribute("name") || node.getAttribute("id") || "").trim();
        const placeholder = (node.getAttribute("placeholder") || "").trim();

        // try to find a label
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

      setEditValue("");
      setEditLink("");
      setEditHeading("");
      setEditBullets([]);
      setEditNavLinks([]);
      return;
    }

    if (isBtn && btnNode) {
      setPanelType("button");
      setIsButtonSelected(true);
      const textNode = (btnNode.querySelector("span") as HTMLElement | null) || btnNode;
      setEditValue((textNode.textContent || "").trim());
      setEditLink((btnNode as HTMLAnchorElement).href || "");
      const computed = el.ownerDocument?.defaultView?.getComputedStyle(btnNode);
      setEditBg(rgbToHex(computed?.backgroundColor || "#3b82f6"));
      setEditColor(rgbToHex(computed?.color || "#ffffff"));
      setEditFontSize(computed?.fontSize || "16px");
    } else if (hasHeadingAndList || isListEl) {
      setPanelType("heading-list");
      setIsButtonSelected(false);
      // Überschrift
      const h = isListEl ? null : (heading || (isHeadingEl ? el : null));
      setEditHeading((h?.textContent || "").trim());
      // Bullet Points
      const listEl = isListEl ? el : list;
      const items = Array.from(listEl?.querySelectorAll("li") || []).map(li => (li.textContent || "").trim());
      setEditBullets(items.length ? items : [""]);
      setEditValue("");
    } else if (imgNode) {
      setPanelType("image");
      setIsButtonSelected(false);
      setEditImgSrc((imgNode.getAttribute("src") || "").trim());
      setEditValue("");
      setEditLink("");
      setEditHeading("");
      setEditBullets([]);
    } else {
      setPanelType(isHeadingEl ? "text" : "generic");
      setIsButtonSelected(false);
      setEditValue((el.innerText || "").trim().slice(0, 2000));
      setEditLink("");
      setEditHeading("");
      setEditBullets([]);
    }
  }, [getDoc]);

  onClickLabelRef.current = selectBlock;

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
        doc.body.appendChild(newEl);
      }

      // notify editor
      try {
        if (onHtmlChange) {
          // prefer existing serializer if present
          try {
            // @ts-ignore
            const htmlOut = typeof serializeIframeHtml === "function" ? serializeIframeHtml(doc) : doc.documentElement.outerHTML;
            onHtmlChange(htmlOut);
          } catch (serializeError) {
            console.warn("Serialize error in onDrop:", serializeError);
            onHtmlChange(doc.documentElement.outerHTML);
          }
        }
      } catch (dropError) {
        console.error("Error in onDrop handler:", dropError);
        toast.error("Failed to add element");
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
  }, [enabled, getDoc, onHtmlChange]);


  // Boxes neu zeichnen
  useEffect(() => {
    const doc = getDoc();
    if (!doc || !enabled) return;
    renderBoxesInIframe(doc, blocks, hoverId, selectedId, (id) => onClickLabelRef.current(id));
  }, [blocks, hoverId, selectedId, enabled, getDoc]);

  useEffect(() => {
    if (!enabled) {
      const doc = getDoc();
      if (doc) doc.querySelectorAll(".__bo-box, .__bo-label-outside, #__block-overlay-css").forEach(el => el.remove());
    }
  }, [enabled, getDoc]);

  const assignIds = useCallback((els: Element[], win: Window) => {
    // Run universal discovery before assigning IDs
    const doc = win.document;
    const discoveries = discoverUniversalBlocks(doc);
    
    const withRects = els.map(el => ({ el, top: el.getBoundingClientRect().top + win.scrollY }));
    withRects.sort((a, b) => a.top - b.top);
    let idx = 0;
    return withRects.map(({ el, top }) => {
      idx += 1;
      const id = `block-${idx}`;
      (el as HTMLElement).setAttribute("data-block-id", id);
      const label = pickLabel(el, discoveries);
      return { id, el, docTop: top, label, selector: generateSelector(el), isButton: isButtonElement(el) };
    });
  }, []);

  const scanFreePrecise = useCallback(() => {
    const doc = getDoc();
    const win = getWin();
    if (!doc || !win) return;
    onStatus?.("blocked");

    // Run universal discovery first
    const discoveries = discoverUniversalBlocks(doc);

    const selectors = [
      // Gutenberg / WP Blocks (broad)
      ".wp-block",
      ".wp-block-group, .wp-block-columns, .wp-block-column",
      ".wp-block-image, .wp-block-cover, .wp-block-media-text, .wp-block-gallery, figure, img, picture",
      ".wp-block-video, .wp-block-embed",
      ".wp-block-heading, h1, h2, h3, [role='heading']",
      ".wp-block-paragraph, p",
      ".wp-block-list, ul, ol, li",
      "a.wp-block-button__link, .wp-block-button, button, [role='button'], a[href]",
      "header, nav, main, footer, section, article, aside",
      "form, .jetpack-contact-form-container, input, textarea, select",
    ].join(",");

    const all = Array.from(doc.querySelectorAll(selectors))
      .filter(el => !el.classList.contains("__bo-box") && !el.classList.contains("__bo-label-outside"));

    type C = { el: Element; r: DOMRect };
    const candidates: C[] = [];
    for (const el of all) {
      const h = el as HTMLElement;
      const style = window.getComputedStyle(h);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
      const r = h.getBoundingClientRect();
      if (!Number.isFinite(r.left) || !Number.isFinite(r.top)) continue;

      const label = pickLabel(el);
      // dynamic minimums by type (to catch headings/buttons/text)
      let minW = 60, minH = 20;
      if (label === "button") { minW = 40; minH = 10; }
      else if (label === "heading") { minW = 40; minH = 16; }
      else if (label === "text" || label === "list") { minW = 80; minH = 18; }
      else if (label.includes("image") || label.includes("cover") || label.includes("gallery") || label === "video" || label === "embed") {
        // allow small logos/icons
        minW = 16; minH = 16;
      }

      // avoid double-label: if a link is basically just an image/logo, let the image win
      if (label === "link") {
        const hasImg = !!h.querySelector("img,picture");
        const txt = (h.textContent || "").replace(/\s+/g, "").trim();
        if (hasImg && txt.length === 0) continue;
      }

      if (r.width < minW || r.height < minH) continue;
      candidates.push({ el, r });
    }
    // Duplikate entfernen: wenn Element bereits durch Vorfahren abgedeckt ist → überspringen
    // "Stärkster" Typ gewinnt: kleineres Element mit spezifischerer Klasse bevorzugen
    const deduped: C[] = [];
    for (const c of candidates) {
      // Prüfe ob schon ein anderes Element mit exakt gleicher Position drin ist
      const hasDuplicate = deduped.some(k =>
        Math.abs(c.r.left - k.r.left) < 3 && Math.abs(c.r.top - k.r.top) < 3 &&
        Math.abs(c.r.width - k.r.width) < 3 && Math.abs(c.r.height - k.r.height) < 3
      );
      if (hasDuplicate) continue;

      // Prüfe ob dieses Element ein Kind eines bereits vorhandenen Elements ist
      // UND das Kind eine spezifischere Klasse hat (dann Kind bevorzugen, Elternteil ersetzen)
      const parentIdx = deduped.findIndex(k => k.el.contains(c.el));
      if (parentIdx >= 0) {
        const parent = deduped[parentIdx];
        const cLabel = pickLabel(c.el, discoveries);
        const pLabel = pickLabel(parent.el, discoveries);
        // Spezifischere Typen bevorzugen
        const specific = ["image","button","heading","nav","form","video","gallery","cover","dropdown","modal","accordion","tab"];
        const cSpecific = specific.includes(cLabel);
        const pSpecific = specific.includes(pLabel);
        if (cSpecific && !pSpecific) {
          // Kind ist spezifischer → Elternteil ersetzen
          deduped[parentIdx] = c;
        }
        // Sonst: Kind ignorieren, Elternteil behalten
        continue;
      }
      deduped.push(c);
    }
    const candidates2 = deduped;

    candidates2.sort((a, b) => (a.r.width * a.r.height) - (b.r.width * b.r.height));

    const kept: C[] = [];
    for (const c of candidates2) {
      let skip = false;
      for (const k of kept) {
        if (Math.abs(c.r.left - k.r.left) < 2 && Math.abs(c.r.top - k.r.top) < 2 &&
          Math.abs(c.r.width - k.r.width) < 2 && Math.abs(c.r.height - k.r.height) < 2) { skip = true; break; }
      }
      if (!skip) kept.push(c);
      if (kept.length >= 80) break;
    }

    type R = { left: number; top: number; width: number; height: number };
    const toR = (r: DOMRect): R => ({ left: r.left, top: r.top, width: r.width, height: r.height });
    const contains = (o: R, i: R) => i.left >= o.left && i.top >= o.top && i.left + i.width <= o.left + o.width && i.top + i.height <= o.top + o.height;

    const final: C[] = [];
    for (const k of kept) {
      let cc = 0;
      for (const o of kept) { if (o !== k && contains(toR(k.r), toR(o.r))) cc++; if (cc >= 3) break; }
      if (cc >= 3 && (k.r.width * k.r.height) > 0.75 * (win.innerWidth * win.innerHeight)) continue;
      final.push(k);
    }

      const hasWp = final.some(x => (x.el as HTMLElement).className?.includes?.("wp-block"));
      const final2: C[] = [];
      if (hasWp) {
        for (const k of final) {
          const isWp = (k.el as HTMLElement).className?.includes?.("wp-block");
          if (isWp) { final2.push(k); continue; }
          let cWp = false;
          for (const w of final) {
            if (!(w.el as HTMLElement).className?.includes?.("wp-block")) continue;
            if (contains(toR(k.r), toR(w.r)) && (w.r.width * w.r.height) > 5000) { cWp = true; break; }
          }
          if (!cWp) final2.push(k);
        }
      } else {
        final2.push(...final);
      }

    const withIds = assignIds(final2.map(x => x.el), win);
    const next: BlockEntry[] = withIds.map(({ id, el, docTop }) => ({
      id, label: pickLabel(el), selector: `[data-block-id="${id}"]`,
      isButton: isButtonElement(el), docTop,
    }));
    setBlocks(next);
    setHoverId(null);
    setSelectedId(null);
    setEditValue("");
    onStatus?.("ok");
  }, [assignIds, getDoc, getWin, onStatus]);

    
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
      doc.body.appendChild(node);
    }

    // Persist + re-scan blocks
    try { onHtmlChange?.(serializeIframeHtml(doc)); } catch {}
    try { scanFreePrecise(); } catch {}
  }, [getDoc, getWin, onHtmlChange, scanFreePrecise]);

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

        const finishLocalAction = () => {
          try { onHtmlChange?.(serializeIframeHtml(doc)); } catch {}
          setTimeout(() => {
            try { window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { mode: "page" } })); } catch {}
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
            toast.error("Kein passender Nachbarblock gefunden.");
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
            toast.error("Nachbarblock passt nicht zur Lösch-Anweisung.");
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
            toast.error("Quelle und Ziel sind identisch.");
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
            toast.error("Ersatz-Block konnte nicht erzeugt werden.");
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
            toast.error("Neuer Block konnte nicht erzeugt werden.");
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

          try { onHtmlChange?.(serializeIframeHtml(doc)); } catch {}
          setTimeout(() => {
            try { window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { mode: "page" } })); } catch {}
            try { window.dispatchEvent(new CustomEvent("bo:left-ai-done")); } catch {}
          }, 120);
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
            toast.error("Neuer Block konnte nicht erzeugt werden.");
            return;
          }

          pushHistorySnapshot(doc);
          if (pos === "vor") {
            target.parentElement.insertBefore(newNode, target);
          } else {
            target.parentElement.insertBefore(newNode, target.nextSibling);
          }

          try { onHtmlChange?.(serializeIframeHtml(doc)); } catch {}
          setTimeout(() => {
            try { window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { mode: "page" } })); } catch {}
            try { window.dispatchEvent(new CustomEvent("bo:left-ai-done")); } catch {}
          }, 120);
          return;
        }

        const looksLikeLocalDomCommand =
          /(?:^|\s)(füge|fuege|lösche|loesche|entferne|verschiebe|ersetze|dupliziere|kopiere|wrap|unwrap)\b/i.test(localPrompt) &&
          /\bblock\s+\d+\b/i.test(localPrompt);

        if (looksLikeLocalDomCommand) {
          toast.error("Lokaler DOM-Befehl wurde nicht eindeutig erkannt. Kein KI-Call wurde ausgeführt.");
          try { window.dispatchEvent(new CustomEvent("bo:left-ai-done")); } catch {}
          return;
        }

        const htmlToSend = targetEl ? targetEl.outerHTML : serializeIframeHtml(doc);
        const resolvedModel = estimateAutoModel(model, htmlToSend, prompt);
        const estInputTokens = Math.max(120, Math.ceil((htmlToSend.length + prompt.length + 1200) / 4));
        const estOutputTokens = estimateOutputTokens(resolvedModel, estInputTokens);

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
        }


        // Streaming fetch
        const streamResp = await fetch("/api/ai/rewrite-block-stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            html: htmlToSend,
            instruction: prompt,
            systemHint: "Return only valid HTML.",
            model: resolvedModel
          }),
        });

        const ct = streamResp.headers.get("content-type") || ""
        if (!ct.includes("text/event-stream")) {
          const data = await streamResp.json()
          if (data?.needsApproval) {
            toast.warning(`Approval nötig: ${data.model} (~$${data.estCost})`)
            return
          }
          if (!data?.ok || !data?.html) { toast.error("KI Fehler: " + (data?.error || "kein HTML")); return }
          if (targetEl && targetEl.parentElement) {
            const wrap = doc.createElement("div")
            wrap.innerHTML = data.html
            const newNode = wrap.firstElementChild as HTMLElement | null
            if (newNode) { targetEl.parentElement.insertBefore(newNode, targetEl); targetEl.remove() }
          } else { try { onHtmlChange?.(data.html) } catch {} }
          try { onHtmlChange?.(serializeIframeHtml(doc)) } catch {}
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
              if (evt.type === "usage") { window.dispatchEvent(new CustomEvent("bo:ai-usage", { detail: { usage: evt.usage } })) }
              if (evt.type === "error") { toast.error("Stream Fehler: " + evt.error); liveEl?.remove(); return }
              if (evt.type === "done") {
                streamedHtml = evt.html || streamedHtml
                window.dispatchEvent(new CustomEvent("bo:diff-ready", { detail: { oldHtml: htmlToSend, newHtml: streamedHtml, blockId: targetEl?.getAttribute("data-block-id") } }))
                liveEl?.remove()
                if (targetEl && targetEl.parentElement) {
                  const wrap = doc.createElement("div")
                  wrap.innerHTML = streamedHtml
                  const newNode = wrap.firstElementChild as HTMLElement | null
                  if (newNode) { targetEl.parentElement.insertBefore(newNode, targetEl); targetEl.remove() }
                } else { try { onHtmlChange?.(streamedHtml) } catch {} }
                try { onHtmlChange?.(serializeIframeHtml(doc)) } catch {}
                setTimeout(() => { try { window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { mode: "page" } })) } catch {} }, 250)
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
    }, [getDoc, onHtmlChange]);
    
const aiRescan = useCallback(async (mode: "block" | "page") => {
      // Warte kurz falls iframe gerade neu lädt
      let doc = getDoc();
      let win = getWin();
      if (!doc || !win || !doc.body) {
        await new Promise(r => setTimeout(r, 800));
        doc = getDoc();
        win = getWin();
      }
      if (!doc || !win || !doc.body) {
        console.warn("AI Rescan: doc not ready");
        return;
      }
      if (mode === "block" && !selectedIdRef.current) {
        toast.error("Bitte zuerst einen Block anklicken, dann AI Block-Scan starten.");
        return;
      }
      setAiLoading(true);
      onStatus?.("blocked");
      try {
        const sid = selectedIdRef.current;
        let rootEl: HTMLElement | null = null;
        if (mode === "block" && sid) rootEl = doc.querySelector(`[data-block-id="${sid}"]`) as HTMLElement | null;
        const htmlToSend = rootEl ? rootEl.outerHTML : doc.body.innerHTML;

        const resp = await fetch("/api/ai/analyze-and-rebuild?ai=1", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ html: htmlToSend }),
        });
        const data = await resp.json();
        console.log("AI response:", data);

        if (data.usage) window.dispatchEvent(new CustomEvent("bo:ai-usage", { detail: { usage: data.usage } }));
        if (data.ok && data.blocks?.length) {
          const scope = rootEl || doc.body;

          const matched: Array<{el: HTMLElement, label: string, type: string}> = [];
          for (const b of data.blocks) {
            let el: HTMLElement | null = null;
            if (b.selector) {
              try { el = scope.querySelector(b.selector) as HTMLElement | null; } catch {}
              if (!el) { try { el = doc.querySelector(b.selector) as HTMLElement | null; } catch {} }
            }
            if (!el) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 20 || r.height < 10) continue;
            matched.push({ el, label: b.label || pickLabel(el), type: b.type || "" });
          }

          if (matched.length > 0) {
            scope.querySelectorAll("[data-block-id]").forEach(el => el.removeAttribute("data-block-id"));
            if (rootEl) rootEl.removeAttribute("data-block-id");

            matched.sort((a, b) => a.el.getBoundingClientRect().top - b.el.getBoundingClientRect().top);

            const newBlocks: BlockEntry[] = matched.map(({ el, label }, i) => {
              const id = `block-${i + 1}`;
              el.setAttribute("data-block-id", id);
              const r = el.getBoundingClientRect();
              return {
                id, label,
                selector: `[data-block-id="${id}"]`,
                isButton: isButtonElement(el),
                docTop: r.top + win.scrollY,
              };
            });

            if (mode === "block" && sid) {
              const prevBlocks = blocksRef.current;

              const othersEl: Array<{ el: HTMLElement; label: string }> = [];
              for (const pb of prevBlocks) {
                const pel = doc.querySelector(pb.selector) as HTMLElement | null;
                if (!pel) continue;
                if (rootEl && (pel === rootEl || rootEl.contains(pel))) continue;
                othersEl.push({ el: pel, label: pb.label });
              }

              const combinedEl: Array<{ el: HTMLElement; label: string }> = [
                ...othersEl,
                ...matched.map(m => ({ el: m.el, label: m.label })),
              ];

              combinedEl.sort((a, b) => a.el.getBoundingClientRect().top - b.el.getBoundingClientRect().top);

              const renumbered: BlockEntry[] = combinedEl.map((x, i) => {
                const newId = `block-${i + 1}`;
                x.el.setAttribute("data-block-id", newId);
                const r = x.el.getBoundingClientRect();
                return {
                  id: newId,
                  label: x.label || pickLabel(x.el),
                  selector: `[data-block-id="${newId}"]`,
                  isButton: isButtonElement(x.el),
                  docTop: r.top + win.scrollY,
                };
              });

              setBlocks(renumbered);
            } else {
              setBlocks(newBlocks);
            }

            setSelectedId(null);
            setEditValue("");
            console.log(`AI scan: ${newBlocks.length} new blocks, mode: ${mode}`);
          } else {
            console.warn("AI scan: no blocks matched DOM, falling back");
            scanFreePrecise();
          }
        } else {
          scanFreePrecise();
        }
      } catch (e) {
        console.error("AI Rescan failed:", e);
        scanFreePrecise();
      } finally {
        setAiLoading(false);
        onStatus?.("ok");
      }
    }, [getDoc, getWin, onHtmlChange, scanFreePrecise, onStatus]);

  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent).detail?.mode as "block" | "page";
      if (mode) aiRescan(mode);
      else scanFreePrecise();
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
    if (!enabled) { setBlocks([]); setHoverId(null); setSelectedId(null); setEditValue(""); return; }
    const iframe = getIframe();
    if (!iframe) return;
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;

    const onScroll = () => {
      const d = getDoc();
      if (d) renderBoxesInIframe(d, blocksRef.current, hoverIdRef.current, selectedIdRef.current, (id) => onClickLabelRef.current(id));
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
  }, [enabled, getIframe, iframeRef, scanFreePrecise, getDoc]);

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

  

  const deleteSelectedBlock = ()=>{
    const iframe = iframeRef.current
    if(!iframe) return

    const doc = iframe.contentDocument
    if(!doc) return

    const el = doc.querySelector('[data-block-id="'+selectedId+'"]')
    if(!el) return

    el.remove()

    try{
      onHtmlChange?.(doc.documentElement.outerHTML)
    }catch{}
  }


const applyEdit = useCallback(() => {
    const doc = getDoc();
    if (!doc || !selectedId) return;
    
    // Save history before applying changes
    pushHistorySnapshot(doc);
    
    const chosen = blocks.find(b => b.id === selectedId);
    if (!chosen) return;
    const el = doc.querySelector(chosen.selector) as HTMLElement | null;
    if (!el) return;

    if (panelType === "button") {
      const btnNode = findButtonNode(el);
      if (btnNode) {
        const spanNode = btnNode.querySelector("span") as HTMLElement | null;
        if (spanNode) spanNode.textContent = editValue;
        else btnNode.childNodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE) n.textContent = editValue; });
        if (editLink) (btnNode as HTMLAnchorElement).href = editLink;
        (btnNode as HTMLElement).style.backgroundColor = editBg;
        (btnNode as HTMLElement).style.color = editColor;
        if (editFontSize) (btnNode as HTMLElement).style.fontSize = editFontSize;
      }
    } else if (panelType === "heading-list") {
      const heading = ["H1","H2","H3","H4"].includes(el.tagName)
        ? el : el.querySelector("h1,h2,h3,h4") as HTMLElement | null;
      if (heading && editHeading) heading.textContent = editHeading;

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
      const img = (el.tagName === "IMG" ? el : (el.querySelector("img") as HTMLImageElement | null)) as HTMLImageElement | null;
      if (img) {
        const v = (editImgSrc || "").trim();
        if (v) {
          img.src = v;
          img.setAttribute("data-bo-local-src", "1");
        }
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
    } else {
      const text = (editValue || "").trim();
      const tag = el.tagName.toLowerCase();
      const cls = el.getAttribute("class") || "";
      const isButtonLike = cls.includes("wp-block-button") || cls.includes("wp-block-button__link") ||
        tag === "a" || tag === "button" || el.getAttribute("role") === "button";
      if (isButtonLike) {
        const inner = el.querySelector("span") as HTMLElement | null;
        if (inner) inner.textContent = text; else el.textContent = text;
      } else {
        const leaf = el.querySelector("h1,h2,h3,p,span,li") as HTMLElement | null;
        if (leaf) leaf.textContent = text; else el.textContent = text;
      }
    }

    try { onHtmlChange?.(serializeIframeHtml(doc)); } catch (e) { console.warn("serialize error:", e); }
  }, [getDoc, selectedId, blocks, editValue, editLink, editBg, editColor, editFontSize,
      panelType, editHeading, editBullets, editImgSrc, editNavLinks, isButtonSelected, onHtmlChange, pushHistorySnapshot]);

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

    const sameLevel = blocksRef.current.filter(b => {
      const other = doc.querySelector(b.selector) as HTMLElement | null;
      if (!other) return false;
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
      const res = await fetch("/api/ai/rewrite-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: blocksHtml,
          instruction: "Diese HTML-Blocks befinden sich auf der gleichen vertikalen Ebene einer Website. Fasse sie in eine einzige wp-block-columns Struktur zusammen: <div class=\"wp-block-columns\" style=\"display:flex;gap:2em;align-items:stretch;width:100%;\">. Jeder Block kommt in eine <div class=\"wp-block-column\" style=\"flex:1;min-width:0;\">. Gib NUR das fertige HTML zurueck, keine Erklaerung."
        })
      });
      const data = await res.json();
      console.log("AI Layout response:", data, "html length:", data?.html?.length, "keys:", Object.keys(data));
      if (data.usage) window.dispatchEvent(new CustomEvent("bo:ai-usage", { detail: { usage: data.usage } }));
      if (!data.ok || !data.html) { toast.error("AI Layout fehlgeschlagen: " + (data.error || "kein HTML")); return; }

      console.log("sameLevel selectors:", sameLevel.map(b => b.selector + " -> " + !!doc.querySelector(b.selector)));
      const firstEl = doc.querySelector(sameLevel[0].selector) as HTMLElement | null;
      console.log("firstEl:", firstEl, "parent:", firstEl?.parentElement?.tagName);
      if (!firstEl || !firstEl.parentElement) { toast.error("Kein Element gefunden fuer: " + sameLevel[0].selector); return; }

      const wrap = doc.createElement("div");
      wrap.innerHTML = data.html;
      const newNode = wrap.firstElementChild as HTMLElement | null;
      if (!newNode) return;

      firstEl.parentElement.insertBefore(newNode, firstEl);
      sameLevel.forEach(b => {
        const e = doc.querySelector(b.selector) as HTMLElement | null;
        if (e && e !== newNode) e.remove();
      });

      try { onHtmlChange?.(serializeIframeHtml(doc)); } catch {}
      setTimeout(() => {
        try {
          window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { mode: "page" } }));
        } catch {}
      }, 500);
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
      } else {
        doc.body.appendChild(node);
      }

      hide();
      try { onHtmlChange?.(doc.documentElement.outerHTML); } catch {}
      try { scanFreePrecise(); } catch {}
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
  }, [enabled, iframeRef, onHtmlChange, scanFreePrecise]);
  // BO_DRAGGRID_END


  if (!enabled) return null;

  

  

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

      {selectedId && (
        <div style={{
          position: "fixed", right: 14, bottom: 14, width: 380, zIndex: 500,
          background: "rgba(15,23,42,0.96)", border: "1px solid rgba(148,163,184,0.25)",
          borderRadius: 14, boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
          padding: 14, color: "white", fontFamily: "system-ui, sans-serif",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>
              {panelType === "button" ? "🔘 Button" : panelType === "heading-list" ? "📋 Heading + Liste" : "✏️ Text"} · {selectedId}
            </div>
            <button onClick={() => { setSelectedId(null); setEditValue(""); }} style={{
              height: 28, padding: "0 10px", borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(0,0,0,0.2)", color: "white", cursor: "pointer", fontWeight: 800,
            }}>✕</button>
          </div>

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
              <input type="file" accept="image/*" onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = URL.createObjectURL(f);
                setEditImgSrc(url);
              }} style={{ marginTop: 8, width: "100%", color: "white" }} />
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

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={aiLayoutAnalyze} title="AI analysiert Blocks auf gleicher Ebene und erstellt Columns" style={{
              height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(168,85,247,0.4)",
              background: "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(139,92,246,0.2))",
              color: "white", cursor: "pointer", fontWeight: 700, fontSize: 11, marginRight: 4,
            }}>🤖 Layout</button>

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
            }}>🤖 Block</button>
            <button onClick={scanFreePrecise} style={{
              height: 36, padding: "0 12px", borderRadius: 12, border: "1px solid rgba(245,158,11,0.45)",
              background: "rgba(245,158,11,0.15)", color: "white", cursor: "pointer", fontWeight: 900, fontSize: 13,
            }}>↺</button>
          </div>
        </div>
      )}
    </>
  );
}
