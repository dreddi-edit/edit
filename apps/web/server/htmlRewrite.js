export function rewrite(html,base){

  html = html.replace(/href="([^"]+)"/g,(m,p)=>{

    if(p.startsWith("http")) return m

    return `href="/asset?url=${base}${p}"`

  })

  html = html.replace(/src="([^"]+)"/g,(m,p)=>{

    if(p.startsWith("http")) return m

    return `src="/asset?url=${base}${p}"`

  })

  return html

}
