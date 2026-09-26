
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const supportsCrossDoc = CSS.supports?.("view-transition-name: root") && "startViewTransition" in document;

  // Gentle entry fallback for browsers without cross-document View Transitions.
  if (!reduceMotion && !supportsCrossDoc) {
    root.classList.add("mh-fallback-enter");
    requestAnimationFrame(() => {
      setTimeout(() => root.classList.remove("mh-fallback-enter"), 520);
    });
  }

  // Pointer-reactive liquid highlight.
  let raf = 0;
  addEventListener("pointermove", e => {
    if (e.pointerType === "touch") return;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      root.style.setProperty("--pointer-x", `${e.clientX}px`);
      root.style.setProperty("--pointer-y", `${e.clientY}px`);
    });
  }, {passive:true});

  document.querySelectorAll(".hero,.card,.continue-card,.upcoming,.live-player-card,.watch-meta,.library-shell,.episodes-toolbar").forEach(el => {
    el.addEventListener("pointermove", e => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--glass-x", `${((e.clientX-r.left)/r.width)*100}%`);
      el.style.setProperty("--glass-y", `${((e.clientY-r.top)/r.height)*100}%`);
    }, {passive:true});
  });

  // Glass nav active-pill glider.
  const nav = document.querySelector(".nav");
  let navGlider = null;
  if (nav) {
    navGlider = document.createElement("span");
    navGlider.className = "nav-glider";
    nav.prepend(navGlider);

    const moveNavGlider = link => {
      if (!link || !navGlider) return;
      const nr = nav.getBoundingClientRect();
      const lr = link.getBoundingClientRect();
      navGlider.style.left = `${lr.left - nr.left}px`;
      navGlider.style.width = `${lr.width}px`;
    };

    const active = nav.querySelector("a.active") || nav.querySelector("a");
    requestAnimationFrame(() => moveNavGlider(active));
    addEventListener("resize", () => moveNavGlider(nav.querySelector("a.active") || active), {passive:true});

    nav.querySelectorAll("a").forEach(link => {
      link.addEventListener("pointerenter", () => moveNavGlider(link));
      link.addEventListener("pointerleave", () => moveNavGlider(nav.querySelector("a.active") || active));
    });
  }

  // Slightly densify the floating header after scrolling.
  const topbar = document.querySelector(".topbar");
  const updateTopbar = () => topbar?.classList.toggle("scrolled", scrollY > 24);
  updateTopbar();
  addEventListener("scroll", updateTopbar, {passive:true});

  // Page glide fallback. Cross-document View Transition capable browsers
  // use CSS @view-transition automatically.
  document.addEventListener("click", e => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    if (a.target === "_blank" || a.hasAttribute("download")) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    let target;
    try { target = new URL(a.href, location.href); } catch { return; }
    if (target.origin !== location.origin) return;
    if (target.pathname === location.pathname && target.search === location.search && target.hash) return;
    if (a.getAttribute("href") === "#" || target.href === location.href) return;

    // Let browsers with native cross-document transitions handle it.
    if (supportsCrossDoc || reduceMotion) return;

    e.preventDefault();

    const currentName = location.pathname.split("/").pop() || "index.html";
    const nextName = target.pathname.split("/").pop() || "index.html";
    const direction =
      currentName.includes("episodes") && nextName.includes("index") ? "back" :
      currentName.includes("watch") && nextName.includes("episodes") ? "back" :
      "forward";

    root.dataset.glide = direction;
    root.classList.add("mh-fallback-leave");

    // Make the nav pill visibly glide to the selected tab first.
    if (nav && navGlider && a.closest(".nav")) {
      const nr = nav.getBoundingClientRect();
      const lr = a.getBoundingClientRect();
      navGlider.style.left = `${lr.left - nr.left}px`;
      navGlider.style.width = `${lr.width}px`;
    }

    setTimeout(() => { location.href = target.href; }, 220);
  });

  // Keep bottom-nav pill aligned after mobile browser UI / orientation changes.
  addEventListener("orientationchange", () => {
    setTimeout(() => {
      const active = nav?.querySelector("a.active");
      if (!active || !navGlider) return;
      const nr = nav.getBoundingClientRect();
      const lr = active.getBoundingClientRect();
      navGlider.style.left = `${lr.left - nr.left}px`;
      navGlider.style.width = `${lr.width}px`;
    }, 180);
  });
})();
