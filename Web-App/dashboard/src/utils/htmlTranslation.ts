import { translateTexts } from "./googleApis";

export type WebsiteTranslationLanguage = {
  code: string;
  label: string;
};

export const TOP_TRANSLATION_LANGUAGES: WebsiteTranslationLanguage[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "ru", label: "Russian" },
  { code: "tr", label: "Turkish" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "bn", label: "Bengali" },
  { code: "ur", label: "Urdu" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "zh-TW", label: "Chinese (Traditional)" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "id", label: "Indonesian" },
  { code: "vi", label: "Vietnamese" },
  { code: "th", label: "Thai" },
  { code: "ms", label: "Malay" },
  { code: "fa", label: "Persian" },
  { code: "he", label: "Hebrew" },
  { code: "uk", label: "Ukrainian" },
  { code: "ro", label: "Romanian" },
  { code: "sv", label: "Swedish" },
  { code: "no", label: "Norwegian" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
  { code: "cs", label: "Czech" },
  { code: "hu", label: "Hungarian" },
  { code: "el", label: "Greek" },
  { code: "bg", label: "Bulgarian" },
  { code: "sr", label: "Serbian" },
  { code: "hr", label: "Croatian" },
  { code: "sk", label: "Slovak" },
  { code: "sl", label: "Slovenian" },
  { code: "lt", label: "Lithuanian" },
  { code: "lv", label: "Latvian" },
  { code: "et", label: "Estonian" },
  { code: "tl", label: "Tagalog" },
  { code: "sw", label: "Swahili" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" },
  { code: "pa", label: "Punjabi" },
  { code: "ml", label: "Malayalam" },
  { code: "kn", label: "Kannada" },
];

type TextBinding =
  | {
      id: string;
      kind: "text";
      node: Text;
      original: string;
      selector: string;
      textIndex: number;
    }
  | {
      id: string;
      kind: "attr";
      element: Element;
      attr: string;
      original: string;
      selector: string;
    };

export type WebsiteTranslationSegment = {
  id: string;
  kind: "text" | "attr";
  selector: string;
  attr?: string;
  textIndex?: number;
  sourceText: string;
  translatedText: string;
};

export type WebsiteTranslationResult = {
  html: string;
  detectedSourceLanguage: string;
  translatedCount: number;
  segments: WebsiteTranslationSegment[];
};

const SKIP_TAGS = new Set(["script", "style", "noscript", "svg", "code", "pre", "textarea"]);
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"];
const META_TRANSLATABLE_SELECTORS = [
  "meta[name='description']",
  "meta[property='og:title']",
  "meta[property='og:description']",
  "meta[name='twitter:title']",
  "meta[name='twitter:description']",
];
const MAX_BATCH_ITEMS = 24;
const MAX_BATCH_CHARS = 4200;

function looksLikeDocument(html: string) {
  return /<!doctype/i.test(html) || /<html[\s>]/i.test(html);
}

function isMeaningfulText(value: string) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return Boolean(normalized) && /[\p{L}]/u.test(normalized);
}

function preserveWhitespace(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] || "";
  const trailing = original.match(/\s*$/)?.[0] || "";
  return `${leading}${translated}${trailing}`;
}

function decodeHtmlEntities(doc: Document, value: string) {
  const textarea = doc.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function escapeSelectorPart(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return String(value).replace(/([^\w-])/g, "\\$1");
}

function buildElementSelector(element: Element | null) {
  if (!element) return "body";
  if (element.id) return `#${escapeSelectorPart(element.id)}`;
  const blockId = element.getAttribute("data-block-id");
  if (blockId) return `[data-block-id="${String(blockId).replace(/"/g, '\\"')}"]`;

  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current.tagName && current.tagName.toLowerCase() !== "html") {
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    if (!parent || tag === "body") {
      parts.unshift(tag);
      break;
    }
    const currentTagName = current.tagName;
    const siblings = (Array.from(parent.children) as Element[]).filter((child) => child.tagName === currentTagName);
    const index = siblings.indexOf(current) + 1;
    parts.unshift(`${tag}:nth-of-type(${Math.max(1, index)})`);
    current = parent;
  }
  return parts.join(" > ") || "body";
}

function getTextNodeIndex(node: Text) {
  const parent = node.parentElement;
  if (!parent) return 0;
  const siblings = Array.from(parent.childNodes).filter((child) => child.nodeType === Node.TEXT_NODE);
  return Math.max(0, siblings.indexOf(node));
}

function getDoctype(doc: Document) {
  if (!doc.doctype) return "";
  const publicId = doc.doctype.publicId ? ` PUBLIC "${doc.doctype.publicId}"` : "";
  const systemId = doc.doctype.systemId ? ` "${doc.doctype.systemId}"` : "";
  return `<!DOCTYPE ${doc.doctype.name}${publicId}${systemId}>`;
}

function collectTranslatableBindings(doc: Document) {
  const bindings: TextBinding[] = [];
  let bindingCounter = 0;
  const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName.toLowerCase())) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-no-translate='true']")) return NodeFilter.FILTER_REJECT;
      return isMeaningfulText(node.nodeValue || "")
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    const parent = node.parentElement;
    if (!parent) {
      current = walker.nextNode();
      continue;
    }
    bindings.push({
      id: `seg-${++bindingCounter}`,
      kind: "text",
      node,
      original: node.nodeValue || "",
      selector: buildElementSelector(parent),
      textIndex: getTextNodeIndex(node),
    });
    current = walker.nextNode();
  }

  Array.from(doc.querySelectorAll("*")).forEach((element) => {
    if (element.closest("[data-no-translate='true']")) return;
    TRANSLATABLE_ATTRIBUTES.forEach((attr) => {
      const value = element.getAttribute(attr) || "";
      if (isMeaningfulText(value)) {
        bindings.push({
          id: `seg-${++bindingCounter}`,
          kind: "attr",
          element,
          attr,
          original: value,
          selector: buildElementSelector(element),
        });
      }
    });

    if (element instanceof HTMLInputElement) {
      const type = (element.getAttribute("type") || "").toLowerCase();
      const value = element.getAttribute("value") || "";
      if (["button", "submit", "reset"].includes(type) && isMeaningfulText(value)) {
        bindings.push({
          id: `seg-${++bindingCounter}`,
          kind: "attr",
          element,
          attr: "value",
          original: value,
          selector: buildElementSelector(element),
        });
      }
    }
  });

  META_TRANSLATABLE_SELECTORS.forEach((selector) => {
    doc.querySelectorAll(selector).forEach((element) => {
      const value = element.getAttribute("content") || "";
      if (isMeaningfulText(value)) {
        bindings.push({
          id: `seg-${++bindingCounter}`,
          kind: "attr",
          element,
          attr: "content",
          original: value,
          selector: buildElementSelector(element),
        });
      }
    });
  });

  return bindings;
}

export async function translateWebsiteHtml(
  html: string,
  targetLanguage: string
): Promise<WebsiteTranslationResult> {
  const source = String(html || "");
  if (!source.trim()) throw new Error("Load a site before running translation.");

  const parser = new DOMParser();
  const inputIsDocument = looksLikeDocument(source);
  const doc = parser.parseFromString(
    inputIsDocument ? source : `<!doctype html><html><body>${source}</body></html>`,
    "text/html"
  );

  const bindings = collectTranslatableBindings(doc);
  if (bindings.length === 0) {
    return { html: source, detectedSourceLanguage: "", translatedCount: 0, segments: [] };
  }

  let detectedSourceLanguage = "";
  let batch: TextBinding[] = [];
  let batchChars = 0;
  let translatedCount = 0;
  const segments: WebsiteTranslationSegment[] = [];

  const flushBatch = async () => {
    if (batch.length === 0) return;
    const originals = batch.map((entry) => entry.original.replace(/\s+/g, " ").trim());
    const translations = await translateTexts(originals, targetLanguage);
    batch.forEach((entry, index) => {
      const translation = translations[index];
      const translated = decodeHtmlEntities(doc, translation?.translatedText || entry.original);
      if (!detectedSourceLanguage && translation?.detectedSourceLanguage) {
        detectedSourceLanguage = translation.detectedSourceLanguage;
      }
      if (entry.kind === "text") {
        entry.node.nodeValue = preserveWhitespace(entry.original, translated);
        segments.push({
          id: entry.id,
          kind: "text",
          selector: entry.selector,
          textIndex: entry.textIndex,
          sourceText: entry.original.replace(/\s+/g, " ").trim(),
          translatedText: translated.replace(/\s+/g, " ").trim(),
        });
      } else {
        entry.element.setAttribute(entry.attr, translated);
        segments.push({
          id: entry.id,
          kind: "attr",
          selector: entry.selector,
          attr: entry.attr,
          sourceText: entry.original.replace(/\s+/g, " ").trim(),
          translatedText: translated.replace(/\s+/g, " ").trim(),
        });
      }
    });
    translatedCount += batch.length;
    batch = [];
    batchChars = 0;
  };

  for (const binding of bindings) {
    const normalized = binding.original.replace(/\s+/g, " ").trim();
    if (
      batch.length >= MAX_BATCH_ITEMS ||
      batchChars + normalized.length > MAX_BATCH_CHARS
    ) {
      await flushBatch();
    }
    batch.push(binding);
    batchChars += normalized.length;
  }

  await flushBatch();

  doc.documentElement.setAttribute("lang", targetLanguage);
  const doctype = getDoctype(doc);
  const serialized = inputIsDocument
    ? `${doctype ? `${doctype}\n` : ""}${doc.documentElement.outerHTML}`
    : doc.body.innerHTML;

  return {
    html: serialized,
    detectedSourceLanguage,
    translatedCount,
    segments,
  };
}
