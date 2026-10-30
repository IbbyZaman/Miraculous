(function(){
  const API="https://auth.miraculoushub.co.uk";
  let currentUser=null;

  function api(path,options={}){
    return fetch(API+path,{...options,credentials:"include",headers:{"Content-Type":"application/json",...(options.headers||{})}})
      .then(async response=>{
        const body=await response.json().catch(()=>({}));
        if(!response.ok){const error=new Error(body.error||"Request failed");error.code=body.code||"api/error";throw error;}
        return body;
      });
  }
  function emitAuth(user){
    currentUser=user||null;
    window.MH_USER=currentUser;
    window.dispatchEvent(new CustomEvent("mh-auth-changed",{detail:currentUser}));
  }
  async function refreshUser(){
    const result=await api("/me");
    emitAuth(result.user);
    return currentUser;
  }
  window.MH_AUTH={
    signIn:async(email,password)=>{const result=await api("/login",{method:"POST",body:JSON.stringify({email,password})});emitAuth(result.user);return result.user;},
    signUp:async(email,password)=>{const result=await api("/register",{method:"POST",body:JSON.stringify({email,password})});emitAuth(result.user);pollPlayback();return result.user;},
    google:async()=>{const error=new Error("Google sign-in is coming in a later update.");error.code="auth/operation-not-allowed";throw error;},
    signOut:async()=>{await api("/logout",{method:"POST"});emitAuth(null);},
    user:()=>currentUser
  };
  window.MH_AUTH_READY=new Promise(resolve=>{window.MH_FIREBASE_READY.then(async()=>resolve(await refreshUser())).catch(()=>resolve(null));});
  window.MH_FIREBASE_READY=api("/health").then(result=>{window.MH_FIREBASE_ERROR=null;window.dispatchEvent(new Event("mh-firebase-ready"));return result;}).catch(error=>{window.MH_FIREBASE_ERROR=error;window.dispatchEvent(new CustomEvent("mh-firebase-error",{detail:error}));throw error;});

  function item(path,method="GET",data){
    return api(path,{method,...(data===undefined?{}:{body:JSON.stringify(data)})});
  }
  const cloud={
    async getPlayback(key){return (await item("/v1/playback/"+encodeURIComponent(key))).item;},
    async savePlayback(key,data){await item("/v1/playback/"+encodeURIComponent(key),"PUT",data);return true;},
    async getFavourite(key){return (await item("/v1/favourites/"+encodeURIComponent(key))).favourite;},
    async setFavourite(key,episode){return (await item("/v1/favourites/"+encodeURIComponent(key),"PUT",episode)).favourite;},
    async markWatched(key,episode){await item("/v1/watched/"+encodeURIComponent(key),"PUT",episode);},
    async getWatched(key){return (await item("/v1/watched/"+encodeURIComponent(key))).watched;},
    async getAllPlayback(){return (await item("/v1/playback")).items||[];},
    subscribePlayback(callback){
      let active=true,last="";
      const load=async()=>{if(!active||!currentUser)return;try{const rows=await cloud.getAllPlayback();const signature=JSON.stringify(rows);if(signature!==last){last=signature;callback(rows);}}catch(error){callback(null,error);}};
      load();const timer=setInterval(load,10000);
      return ()=>{active=false;clearInterval(timer);};
    },
    async getAllWatched(){return (await item("/v1/watched")).items||[];},
    async getAllFavourites(){return (await item("/v1/favourites")).items||[];},
    async getNickname(){return (await item("/v1/profile")).nickname;},
    async setNickname(value){return (await item("/v1/profile","PUT",{nickname:value})).nickname;},
    async addComment(episodeKey,text){return item("/v1/comments","POST",{episodeKey,text});},
    async deleteComment(id){return item("/v1/comments/"+encodeURIComponent(id),"DELETE");},
    async addReport(report){return item("/v1/reports","POST",report);},
    subscribeComments(episodeKey,callback){
      let active=true,last="";
      const load=async()=>{if(!active)return;try{const rows=(await item("/v1/comments?episodeKey="+encodeURIComponent(episodeKey))).items||[];const signature=JSON.stringify(rows);if(signature!==last){last=signature;callback(rows);}}catch(error){callback(null,error);}};
      load();const timer=setInterval(load,8000);
      return ()=>{active=false;clearInterval(timer);};
    }
  };
  window.MH_CLOUD=cloud;
  window.MH_FIREBASE_ERROR=null;
  window.dispatchEvent(new Event("mh-firebase-ready"));
})();