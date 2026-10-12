(async()=>{
 await window.MH_CATALOG_READY;
 const id=new URLSearchParams(location.search).get('id'),entry=(window.MH_TRAILERS||[]).find(t=>t.id===id);if(!entry)return;
 const key='trailer:'+id,$=id=>document.getElementById(id),list=$('trailerCommentsList'),form=$('trailerCommentForm'),status=$('trailerCommentsStatus');let stop=null,lastItems=[];
 const notice=t=>$('trailerNotice').textContent=t;
 const signedIn=()=>!!window.MH_USER&&!window.MH_USER.isAnonymous;
 function render(items){lastItems=items||[];list.replaceChildren();if(!lastItems.length){list.textContent='No comments yet. Be the first to comment.';return}
  for(const comment of lastItems.slice(-100)){
   const article=document.createElement('article');article.className='trailer-comment';const header=document.createElement('header'),name=document.createElement('strong'),time=document.createElement('small'),text=document.createElement('p');name.textContent=comment.authorNickname||'Miraculous Fan';time.textContent=comment.createdAt?.toDate?.()?.toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})||'Just now';text.textContent=comment.text;header.append(name,time);
   if(signedIn()&&comment.authorUid===window.MH_USER.uid){const button=document.createElement('button');button.textContent='Delete';button.onclick=async()=>{button.disabled=true;try{await window.MH_CLOUD.deleteComment(comment.id)}catch{notice('Could not delete comment.');button.disabled=false}};header.append(button)}
   article.append(header,text);list.append(article);
  }
 }
 function auth(){form.hidden=!signedIn();$('trailerCommentsLogin').hidden=signedIn();render(lastItems)}
 function start(){if(stop)stop();stop=null;if(!window.MH_CLOUD?.subscribeComments){status.textContent='Unavailable';return}status.textContent='Live';stop=window.MH_CLOUD.subscribeComments(key,(items,error)=>{if(error){status.textContent='Unavailable';notice('Comments could not be loaded.');return}status.textContent='Live';render(items)})}
 $('trailerCommentsSignIn').onclick=()=>window.mhOpenAuth?.();
 form.onsubmit=async event=>{event.preventDefault();const text=$('trailerCommentInput').value.trim();if(!text)return;if(!signedIn()){window.mhOpenAuth?.();return}const button=$('trailerCommentSend');button.disabled=true;try{const nickname=await window.mhEnsureNickname?.();if(!nickname)return;await window.MH_CLOUD.addComment(key,text);$('trailerCommentInput').value=''}catch{notice('Could not post comment. Please try again.')}finally{button.disabled=false}};
 window.addEventListener('mh-auth-changed',()=>{auth();start()});window.addEventListener('online',start);window.addEventListener('pagehide',()=>stop?.(),{once:true});auth();
 try{await window.MH_FIREBASE_READY;await window.MH_AUTH_READY;auth();start()}catch{status.textContent='Unavailable'}
})();
