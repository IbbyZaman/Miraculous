// Remove invite credentials before analytics can record the page URL.
// A copied invite contains only the guest key; the host key stays in sessionStorage.
(function(){
  const token=new URLSearchParams(location.hash.slice(1)).get('invite');
  if(token&&/^[a-f0-9]{64}$/.test(token)){
    window.MH_PARTY_INVITE=token;
    const url=new URL(location.href);url.hash='';
    history.replaceState(history.state,'',url);
  }
})();
