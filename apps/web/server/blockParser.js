import { JSDOM } from 'jsdom';

export function extractIntelligentContent(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  const noise = doc.querySelectorAll('script, style, noscript, iframe, .ads, #cookie-law');
  noise.forEach(n => n.remove());

  const blocks = [];
  const walk = (node) => {
    if (node.nodeType === 1) {
      const tag = node.tagName.toLowerCase();
      const hasText = node.textContent?.trim().length > 20;
      
      if (['h1', 'h2', 'h3', 'p', 'section', 'article'].includes(tag) && hasText) {
        blocks.push({
          tag,
          content: node.innerHTML,
          textOnly: node.textContent.trim(),
          id: node.getAttribute('data-block-id') || Math.random().toString(36).substr(2, 9)
        });
      }
      
      Array.from(node.children).forEach(walk);
    }
  };

  walk(doc.body);
  return blocks;
}

export function parseBlocks(html) {
  return extractIntelligentContent(html);
}
