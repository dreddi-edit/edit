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
  | { kind: "text"; node: Text; original: string }
  | { kind: "attr"; element: Element; attr: string; original: string };

type WebsiteTranslationResult = {
  html: string;
  detectedSourceLanguage: string;
  translatedCount: number;
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

function getDoctype(doc: Document) {
  if (!doc.doctype) return "";
  const publicId = doc.doctype.publicId ? ` PUBLIC "${doc.doctype.publicId}"` : "";
  const systemId = doc.doctype.systemId ? ` "${doc.doctype.systemId}"` : "";
  return `<!DOCTYPE ${doc.doctype.name}${publicId}${systemId}>`;
}

function collectTranslatableBindings(doc: Document) {
  const bindings: TextBinding[] = [];
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
    bindings.push({
      kind: "text",
      node: current as Text,
      original: (current as Text).nodeValue || "",
    });
    current = walker.nextNode();
  }

  Array.from(doc.querySelectorAll("*")).forEach((element) => {
    if (element.closest("[data-no-translate='true']")) return;
    TRANSLATABLE_ATTRIBUTES.forEach((attr) => {
      const value = element.getAttribute(attr) || "";
      if (isMeaningfulText(value)) {
        bindings.push({ kind: "attr", element, attr, original: value });
      }
    });

    if (element instanceof HTMLInputElement) {
      const type = (element.getAttribute("type") || "").toLowerCase();
      const value = element.getAttribute("value") || "";
      if (["button", "submit", "reset"].includes(type) && isMeaningfulText(value)) {
        bindings.push({ kind: "attr", element, attr: "value", original: value });
      }
    }
  });

  META_TRANSLATABLE_SELECTORS.forEach((selector) => {
    doc.querySelectorAll(selector).forEach((element) => {
      const value = element.getAttribute("content") || "";
      if (isMeaningfulText(value)) {
        bindings.push({ kind: "attr", element, attr: "content", original: value });
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
    return { html: source, detectedSourceLanguage: "", translatedCount: 0 };
  }

  let detectedSourceLanguage = "";
  let batch: TextBinding[] = [];
  let batchChars = 0;
  let translatedCount = 0;

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
      } else {
        entry.element.setAttribute(entry.attr, translated);
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
  };
}
