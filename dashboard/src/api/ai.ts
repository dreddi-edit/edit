export async function aiRewrite(html:string,instruction:string){

  const r = await fetch("/api/ai/rewrite-block",{
    method:"POST",
    headers:{ "content-type":"application/json" },
    body:JSON.stringify({ html, instruction })
  })

  const j = await r.json()

  if(!j.ok) throw new Error(j.error || "AI failed")

  return j.html as string
}
