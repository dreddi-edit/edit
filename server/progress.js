let clients = []

export function progressStream(req,res){

  res.writeHead(200,{
    "Content-Type":"text/event-stream",
    "Cache-Control":"no-cache",
    "Connection":"keep-alive"
  })

  clients.push(res)

  req.on("close",()=>{
    clients = clients.filter(c=>c!==res)
  })

}

export function sendProgress(step,msg){

  const data = JSON.stringify({step,msg})

  clients.forEach(c=>{
    c.write(`data: ${data}\n\n`)
  })

}
