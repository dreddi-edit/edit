import fetch from "node-fetch"

export async function asset(req,res){

  try{

    const url = req.query.url

    if(!url){
      res.status(400).send("missing url")
      return
    }

    const r = await fetch(url,{
      headers:{ "User-Agent":"Mozilla/5.0" }
    })

    res.setHeader("content-type",r.headers.get("content-type") || "application/octet-stream")

    const buffer = await r.arrayBuffer()

    res.send(Buffer.from(buffer))

  }catch(err){

    res.status(500).send(String(err))

  }

}
