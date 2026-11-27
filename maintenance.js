// Shared scheduled maintenance notice for pages that do not load common.js.
(function scheduledMaintenance(){
  if (document.getElementById("mh-maintenance-notice")) return;
  const start = new Date("2026-11-27T22:00:00+00:00").getTime();
  const end = new Date("2026-11-27T22:30:00+00:00").getTime();
  const style = document.createElement("style");
  style.textContent = `
    #mh-maintenance-notice{position:fixed;z-index:99990;top:auto;bottom:12px;left:50%;transform:translateX(-50%);width:min(680px,calc(100% - 24px));padding:13px 18px;border:1px solid rgba(140,170,255,.28);border-radius:15px;background:rgba(12,18,34,.96);color:#f5f7ff;box-shadow:0 12px 40px #0008;font:500 13px/1.5 system-ui,sans-serif;text-align:center;backdrop-filter:blur(16px);pointer-events:none}
    #mh-maintenance-notice strong{display:block;font-size:14px;letter-spacing:.04em}
    #mh-maintenance-notice span{color:#c1cbe2}
    #mh-maintenance-screen{position:fixed;inset:0;z-index:1000000;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 35%,#182b52 0%,#090e1b 55%,#05070c 100%);color:#f7f8ff;text-align:center;font-family:system-ui,sans-serif}
    #mh-maintenance-screen[hidden],#mh-maintenance-notice[hidden]{display:none}
    #mh-maintenance-screen .mh-maintenance-card{max-width:560px}
    #mh-maintenance-screen .mh-maintenance-mark{margin:0 auto 22px;width:54px;height:54px;display:grid;place-items:center;border:1px solid #7189c9;border-radius:17px;font-size:25px;font-weight:800;color:#dbe5ff}
    #mh-maintenance-screen h1{margin:0 0 12px;font-size:clamp(30px,6vw,48px);letter-spacing:-.04em}
    #mh-maintenance-screen p{color:#c0c9dc;line-height:1.7}
    #mh-maintenance-screen small{display:block;margin-top:24px;color:#91a1c2;letter-spacing:.12em;text-transform:uppercase}
  `;
  document.head.appendChild(style);
  const notice=document.createElement("div");
  notice.id="mh-maintenance-notice";
  notice.setAttribute("role","status");
  notice.innerHTML='<strong>SCHEDULED MAINTENANCE · TONIGHT</strong><span>MiraculousHub will be temporarily unavailable from 10:00 PM to 10:30 PM (UK time). <b id="mh-maintenance-countdown">Starting at 10:00 PM</b></span>';
  const screen=document.createElement("div");
  screen.id="mh-maintenance-screen";
  screen.hidden=true;
  screen.innerHTML='<div class="mh-maintenance-card"><div class="mh-maintenance-mark">M</div><h1>We’ll be right back.</h1><p>MiraculousHub is undergoing scheduled maintenance. We expect to be back at <strong>10:30 PM UK time</strong>.</p><small>Thank you for your patience · MiraculousHub</small></div>';
  document.body.append(notice,screen);
  function refresh(){
    const now=Date.now();
    if(now>=start && now<end){
      notice.hidden=true; screen.hidden=false; document.documentElement.style.overflow="hidden";
    }else if(now>=end){
      notice.hidden=true; screen.hidden=true; document.documentElement.style.overflow="";
    }else{
      notice.hidden=false; screen.hidden=true;
      const remaining=Math.max(0,start-now);
      const hours=Math.floor(remaining/3600000);
      const minutes=Math.floor((remaining%3600000)/60000);
      const seconds=Math.floor((remaining%60000)/1000);
      const clock=hours?hours+"h "+minutes+"m":minutes+"m "+seconds+"s";
      const label=document.getElementById("mh-maintenance-countdown");
      if(label) label.textContent="Starts in "+clock;
    }
  }
  refresh();
  window.setInterval(refresh,1000);
})();
