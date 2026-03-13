import React from 'react';

import { useState } from "react"
import { toast } from "./Toast"
import { aiRewrite } from "../api/ai"
import { errMsg } from "../utils/errMsg"

export default function AIPrompt({html,onResult}:{html:string,onResult:(h:string)=>void}){

  const [prompt,setPrompt] = useState("")
  const [loading,setLoading] = useState(false)

  async function run(){

    if(!prompt.trim()) return

    setLoading(true)

    try{
      const out = await aiRewrite(html,prompt.trim())
      onResult(out)
      setPrompt("")
    }catch(e){
      toast.error(errMsg(e) || "AI Fehler")
    }

    setLoading(false)

  }

  return(

    <div style={{marginTop:16}}>

      <div style={{fontWeight:800,fontSize:12,marginBottom:6}}>
        AI Edit (Claude)
      </div>

      <textarea
        value={prompt}
        onChange={e=>setPrompt(e.target.value)}
        placeholder='z.B. "Mach diesen Block moderner, Bild links, Text rechts, CTA Button"'
        style={{
          width:"100%",
          minHeight:90,
          padding:10,
          border:"1px solid #ccc",
          borderRadius:10,
          fontSize:13
        }}
      />

      <button
        onClick={run}
        disabled={loading}
        style={{
          marginTop:8,
          width:"100%",
          padding:"10px 12px",
          background:"#6366f1",
          color:"#fff",
          border:"none",
          borderRadius:10,
          fontWeight:800
        }}
      >
        {loading ? "Claude thinking..." : "Run AI"}
      </button>

    </div>

  )

}
