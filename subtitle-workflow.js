import { WorkflowEntrypoint } from "cloudflare:workers";

function subtitleKey(videoKey){
  if(!/\.mp4$/i.test(videoKey))throw new Error("Expected an MP4 R2 key");
  return `subtitles/${videoKey.replace(/\.mp4$/i,".en.vtt")}`;
}
function statusOf(captions,language){
  const list=Array.isArray(captions)?captions:[captions].filter(Boolean);
  return list.find(x=>x&&x.language===language)||null;
}
async function hmacHex(secret,text){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sig),b=>b.toString(16).padStart(2,"0")).join("");
}
async function signedSourceUrl(env,videoPath){
  if(!env.AUTO_SUBTITLE_SIGNING_KEY)throw new Error("AUTO_SUBTITLE_SIGNING_KEY secret is missing");
  const base=String(env.VIDEO_WORKER_ORIGIN||"").replace(/\/$/,"");
  if(!/^https:\/\//.test(base))throw new Error("VIDEO_WORKER_ORIGIN must be an https URL");
  const exp=Math.floor(Date.now()/1000)+1800;
  const sig=await hmacHex(env.AUTO_SUBTITLE_SIGNING_KEY,`${videoPath}|${exp}`);
  return `${base}${videoPath}?autosub_exp=${exp}&autosub_sig=${sig}`;
}
async function fetchVtt(env,streamId,language){
  if(!env.CF_ACCOUNT_ID||!env.CF_STREAM_API_TOKEN)throw new Error("CF_ACCOUNT_ID / CF_STREAM_API_TOKEN is missing");
  const url=`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/${streamId}/captions/${encodeURIComponent(language)}/vtt`;
  const r=await fetch(url,{headers:{Authorization:`Bearer ${env.CF_STREAM_API_TOKEN}`}});
  const text=await r.text();
  if(!r.ok)throw new Error(`Could not fetch generated VTT (${r.status}): ${text.slice(0,180)}`);
  if(text.trim().startsWith("WEBVTT"))return text;
  try{const data=JSON.parse(text);if(typeof data.result==="string"&&data.result.trim().startsWith("WEBVTT"))return data.result}catch{}
  throw new Error("Cloudflare returned an unexpected caption response");
}

export class AutoSubtitleWorkflow extends WorkflowEntrypoint {
  async run(event,step){
    const key=String(event.payload?.key||""),videoPath=String(event.payload?.videoPath||""),language=String(event.payload?.language||"en");
    if(!/\.mp4$/i.test(key)||!videoPath.startsWith("/video/"))throw new Error("Invalid auto subtitle job");
    const outKey=subtitleKey(key);
    const existing=await step.do("check existing subtitles",()=>this.env.VIDEOS.head(outKey));
    if(existing)return {success:true,key,outKey,alreadyExisted:true};

    const sourceUrl=await step.do("create temporary signed source URL",()=>signedSourceUrl(this.env,videoPath));
    let streamId=null;
    try{
      streamId=await step.do("copy R2 video into temporary Stream job",async()=>{
        const video=await this.env.STREAM.upload(sourceUrl,{meta:{source:"miraculoushub-auto-subtitles",r2Key:key},requireSignedURLs:true});
        if(!video?.uid)throw new Error("Stream did not return a video id");
        return video.uid;
      });

      let ready=false;
      for(let i=0;i<80;i++){
        const details=await step.do(`check temporary video ${i+1}`,()=>this.env.STREAM.video(streamId).details());
        if(details?.readyToStream){ready=true;break}
        if(details?.status?.state==="error")throw new Error(details.status.errorReasonText||"Temporary Stream encoding failed");
        await step.sleep(`wait for temporary video ${i+1}`,"15 seconds");
      }
      if(!ready)throw new Error("Temporary Stream copy did not become ready in time");

      await step.do("start English AI captions",()=>this.env.STREAM.video(streamId).captions.generate(language));
      let captionReady=false;
      for(let i=0;i<120;i++){
        const captions=await step.do(`check captions ${i+1}`,()=>this.env.STREAM.video(streamId).captions.list(language));
        const cap=statusOf(captions,language);
        if(cap?.status==="ready"){captionReady=true;break}
        if(cap?.status==="error")throw new Error("Cloudflare Stream auto captions failed");
        await step.sleep(`wait for captions ${i+1}`,"15 seconds");
      }
      if(!captionReady)throw new Error("Auto captions did not become ready in time");

      const vtt=await step.do("download generated WebVTT",()=>fetchVtt(this.env,streamId,language));
      await step.do("save WebVTT beside R2 media",()=>this.env.VIDEOS.put(outKey,vtt,{httpMetadata:{contentType:"text/vtt; charset=utf-8"},customMetadata:{generated:"cloudflare-stream-ai",language}}));
      await step.do("delete temporary Stream video",()=>this.env.STREAM.video(streamId).delete());
      return {success:true,key,outKey};
    }catch(error){
      if(streamId){try{await step.do("clean up failed temporary Stream video",()=>this.env.STREAM.video(streamId).delete())}catch{}}
      throw error;
    }
  }
}

export default {
  async fetch(request){
    return Response.json({ok:true,service:"MiraculousHub auto subtitles",note:"Jobs are started by the uploader workflow binding."});
  }
};
