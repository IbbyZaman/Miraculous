// MiraculousHub custom Worker domains. Keep both Workers bound to the same R2 bucket.
window.MH_SITE_CONFIG={
  videoWorker:'https://video.miraculoushub.co.uk',
  uploaderWorker:'https://upload.miraculoushub.co.uk'
};

/*
 * TEMPORARY GLOBAL SERVICE INTERRUPTION
 * Remove this gate when MiraculousHub service is restored.
 */
(function () {
  if (location.hostname === "miraculous.to" || location.hostname.endsWith(".miraculous.to")) return;

  const css = document.createElement("style");
  css.textContent = `
    html.mh-service-gated, html.mh-service-gated body {
      min-height:100%; margin:0!important; background:#080711!important;
      overflow:hidden!important;
    }
    html.mh-service-gated body > *:not(#mh-service-interruption) {
      display:none!important;
    }
    #mh-service-interruption {
      position:fixed; inset:0; z-index:2147483647; display:grid;
      place-items:center; box-sizing:border-box; padding:24px;
      background:radial-gradient(ellipse at 50% 110%,rgba(157,35,166,.22),transparent 55%),#080711;
      color:#f7f5fb; font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    }
    #mh-service-interruption .mh-panel {
      box-sizing:border-box; width:min(100%,480px); padding:28px;
      border:1px solid #3b3a4a; border-radius:24px;
      background:linear-gradient(145deg,#191927,#11111c);
      box-shadow:0 24px 80px rgba(0,0,0,.38);
    }
    #mh-service-interruption .mh-pill {
      display:inline-flex; padding:6px 10px; border-radius:999px;
      background:#58203f; color:#ffb5d0; font-size:11px;
      font-weight:800; letter-spacing:.06em;
    }
    #mh-service-interruption h1 {
      margin:20px 0 10px; font-size:24px; line-height:1.2; letter-spacing:-.03em;
    }
    #mh-service-interruption p {
      margin:0; color:#c9c7d2; font-size:15px; line-height:1.55;
    }
    #mh-service-interruption a.mh-destination {
      display:block; margin-top:18px; padding:14px 18px; border-radius:14px;
      background:linear-gradient(100deg,#ff2d78,#b52be8); color:#fff;
      text-align:center; text-decoration:none; font-size:14px; font-weight:800;
    }
    #mh-service-interruption .mh-reference {
      margin-top:14px; color:#aaa7b4; font-size:12px;
    }
    @media(max-width:480px) {
      #mh-service-interruption .mh-panel {padding:24px;border-radius:20px}
      #mh-service-interruption h1 {font-size:22px}
    }
  `;
  document.documentElement.classList.add("mh-service-gated");
  (document.head || document.documentElement).appendChild(css);

  function showGate() {
    if (document.getElementById("mh-service-interruption")) return;
    const gate = document.createElement("main");
    gate.id = "mh-service-interruption";
    gate.setAttribute("role", "alert");
    gate.setAttribute("aria-live", "assertive");
    gate.innerHTML = `
      <section class="mh-panel">
        <span class="mh-pill">SERVICE INTERRUPTION</span>
        <h1>Today's episode update</h1>
        <p>We’re currently experiencing a system error, so MiraculousHub won’t be ready to provide today’s episode. Please watch it at <strong style="color:#ff83b7">miraculous.to</strong> instead.</p>
        <div class="mh-reference">Reference: MH-SYS-001</div>
        <a class="mh-destination" href="https://miraculous.to/">Continue to MiraculousHub</a>
      </section>`;
    document.body.appendChild(gate);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showGate, { once:true });
  } else {
    showGate();
  }
})();
