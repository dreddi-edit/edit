import { JSDOM } from "jsdom";

function textOf(el) {
  return (el.textContent || "").trim().replace(/\s+/g, " ");
}

function detectType(el) {
  if (el.querySelector("img") && el.querySelector("h1,h2,h3")) return "hero";
  if (el.querySelector("img") && el.querySelector("a")) return "product";
  if (el.querySelector("nav")) return "header";
  if (el.querySelector("footer")) return "footer";
  return "section";
}

function extractButtons(el) {
  const buttons = [];
  el.querySelectorAll("a").forEach(a => {
    const label = textOf(a);
    const link = a.getAttribute("href") || "";
    if (label) {
      buttons.push({ label, link });
    }
  });
  return buttons;
}

function extractImage(el) {
  const img = el.querySelector("img");
  if (!img) return null;
  return img.getAttribute("src");
}

function extractTitle(el) {
  const h = el.querySelector("h1,h2,h3");
  if (!h) return null;
  return textOf(h);
}

export function parseBlocks(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const candidates = [
    ...doc.querySelectorAll("section"),
    ...doc.querySelectorAll("article"),
    ...doc.querySelectorAll("main > div"),
    ...doc.querySelectorAll("body > div")
  ];

  const blocks = [];

  candidates.forEach(el => {
    const textLength = textOf(el).length;
    const imgCount = el.querySelectorAll("img").length;

    if (textLength < 20 && imgCount === 0) return;

    const block = {
      type: detectType(el),
      title: extractTitle(el),
      image: extractImage(el),
      buttons: extractButtons(el)
    };

    blocks.push(block);
  });

  return blocks;
}
