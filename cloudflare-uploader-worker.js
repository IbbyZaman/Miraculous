/* MiraculousHub R2 uploader Worker
   Bind your R2 bucket as VIDEOS and create a secret named UPLOAD_PASSWORD. */
const ALLOWED_ORIGINS=new Set(["https://miraculoushub.co.uk","https://www.miraculoushub.co.uk"]);
function allowed(request){const o=request.headers.get("Origin");return !!o&&ALLOWED_ORIGINS.has(o)}
function cors(request){const o=request.headers.get("Origin"),h={"Access-Control-Allow-Methods":"POST, PUT, OPTIONS","Access-Control-Allow-Headers":"Content-Type, X-Upload-Password","Access-Control-Expose-Headers":"ETag","Cache-Control":"no-store","Vary":"Origin"};if(o&&ALLOWED_ORIGINS.has(o))h["Access-Control-Allow-Origin"]=o;return h}
function json(request,data,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors(request),"Content-Type":"application/json; charset=utf-8"}})}
function validKey(key){return !!key&&!key.includes("..")&&(/^season-\d{1,2}\/s\d{2}e\d{2,3}\.mp4$/i.test(key)||/^specials\/[a-z0-9-]+\.mp4$/i.test(key)||/^anime\/[a-z0-9-]+\/e\d{2,3}\.mp4$/i.test(key)||/^anime\/attack-on-titan\/(sp0[12]|oad0[1-8])\.mp4$/i.test(key))}
function uploadedRoutes(key,origin="https://miraculoushub.co.uk"){
  if(!ALLOWED_ORIGINS.has(origin)) origin="https://miraculoushub.co.uk";
  let m,videoPath,watchPath;
  if((m=/^anime\/([a-z0-9-]+)\/(e|sp|oad)(\d{2,3})\.mp4$/i.exec(key))){
    videoPath=`/video/anime/${m[1]}/${m[2]}${m[3]}`;
    watchPath=`watch.html?anime=${m[1]}&episode=${Number(m[3])+(m[2]==="sp"?94:m[2]==="oad"?100:0)}`;
  }else if((m=/^season-\d+\/s(\d{2})e(\d{2,3})\.mp4$/i.exec(key))){
    videoPath=`/video/s${m[1]}e${m[2]}`;watchPath=`watch.html?season=${Number(m[1])}&episode=${Number(m[2])}`;
  }else{
    const slug=key.slice('specials/'.length,-4);
    videoPath=`/video/special/${slug}`;
    const number=["new-york","shanghai","awakening","paris","london","tokyo"].indexOf(slug)+1;
    watchPath=number?`watch.html?special=${number}`:null;
  }
  return {videoPath,downloadPath:videoPath.replace('/video/','/download/'),watchPath,
    watchUrl:watchPath?`${origin}/${watchPath}`:null};
}
export default{async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/"&&(request.method==="GET"||request.method==="HEAD"))return new Response(request.method==="HEAD"?null:"MiraculousHub uploader is online.\nOpen https://miraculoushub.co.uk/upload.html to upload episodes.\n",{headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store","Content-Security-Policy":"frame-ancestors 'self' https://miraculoushub.co.uk https://www.miraculoushub.co.uk","X-Content-Type-Options":"nosniff"}});
  if(request.method==="OPTIONS")return allowed(request)?new Response(null,{status:204,headers:cors(request)}):new Response("Forbidden",{status:403});
  if(!allowed(request))return new Response("Forbidden - MiraculousHub only.",{status:403,headers:cors(request)});
  if(request.method!=="POST"&&request.method!=="PUT")return json(request,{error:"Method Not Allowed"},405);
  if(!env.UPLOAD_PASSWORD||request.headers.get("X-Upload-Password")!==env.UPLOAD_PASSWORD)return json(request,{error:"Wrong upload password."},401);
  if(!env.VIDEOS)return json(request,{error:"R2 binding VIDEOS is missing."},500);
  if(url.pathname!=="/upload")return json(request,{error:"Not found."},404);
  const action=url.searchParams.get("action"),key=url.searchParams.get("key");if(!validKey(key))return json(request,{error:"Invalid R2 object key."},400);
  try{
    if(request.method==="POST"&&action==="create"){
      const upload=await env.VIDEOS.createMultipartUpload(key,{httpMetadata:{contentType:"video/mp4"}});
      return json(request,{success:true,key:upload.key,uploadId:upload.uploadId});
    }
    if(request.method==="PUT"&&action==="part"){
      const uploadId=url.searchParams.get("uploadId"),partNumber=Number(url.searchParams.get("partNumber"));
      if(!uploadId||!Number.isInteger(partNumber)||partNumber<1||!request.body)return json(request,{error:"Invalid upload part."},400);
      const upload=env.VIDEOS.resumeMultipartUpload(key,uploadId),part=await upload.uploadPart(partNumber,request.body);
      return json(request,{success:true,partNumber:part.partNumber,etag:part.etag});
    }
    if(request.method==="POST"&&action==="complete"){
      const uploadId=url.searchParams.get("uploadId");if(!uploadId)return json(request,{error:"Missing uploadId."},400);
      let body;try{body=await request.json()}catch{return json(request,{error:"Invalid completion data."},400)}
      if(!Array.isArray(body?.parts)||!body.parts.length)return json(request,{error:"No uploaded parts supplied."},400);
      const parts=[...body.parts].sort((a,b)=>a.partNumber-b.partNumber),upload=env.VIDEOS.resumeMultipartUpload(key,uploadId),obj=await upload.complete(parts);
      const routes=uploadedRoutes(obj.key,request.headers.get("Origin"));
      let subtitlesQueued=false,subtitleWorkflowId=null,subtitleError=null;
      // AUTO_SUBS is an optional cross-script Cloudflare Workflow binding.
      // Uploads still succeed if auto captions are not configured yet.
      if(env.AUTO_SUBS){
        try{
          const instance=await env.AUTO_SUBS.create({params:{key:obj.key,videoPath:routes.videoPath,language:"en"}});
          subtitlesQueued=true;subtitleWorkflowId=instance.id;
        }catch(e){console.error("Auto subtitle workflow could not start",e);subtitleError=e instanceof Error?e.message:String(e)}
      }
      return json(request,{success:true,message:"Upload complete!",key:obj.key,etag:obj.httpEtag,...routes,subtitlesQueued,subtitleWorkflowId,subtitleError});
    }
    if(request.method==="POST"&&action==="abort"){
      const uploadId=url.searchParams.get("uploadId");if(!uploadId)return json(request,{error:"Missing uploadId."},400);
      await env.VIDEOS.resumeMultipartUpload(key,uploadId).abort();return json(request,{success:true,message:"Upload cancelled."});
    }
    return json(request,{error:"Unknown upload action."},400);
  }catch(e){console.error(e);return json(request,{error:e instanceof Error?e.message:String(e)},500)}
}};
