import { JSDOM } from "jsdom"

export function parseSections(html){

  const dom = new JSDOM(html)
  const doc = dom.window.document

  const sections = []

  const nodes = [
    ...doc.querySelectorAll("section"),
    ...doc.querySelectorAll("header"),
    ...doc.querySelectorAll("footer"),
    ...doc.querySelectorAll("main > div"),
    ...doc.querySelectorAll("body > div")
  ]

  nodes.forEach((el, i) => {
    sections.push({
      id: i,
      tag: el.tagName.toLowerCase(),
      text: el.textContent.slice(0, 120).trim(),
      images: el.querySelectorAll("img").length,
      links: el.querySelectorAll("a").length,
      classes: el.getAttribute("class") || "",
      id_attr: el.getAttribute("id") || ""
    })
  })

  return sections
}
