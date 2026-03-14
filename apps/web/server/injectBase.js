export function injectBase(html, url) {

  const baseTag = `<base href="${url}">`

  if (html.includes("<head>")) {
    return html.replace("<head>", `<head>${baseTag}`)
  }

  return baseTag + html
}
