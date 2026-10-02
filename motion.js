(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Use one consistent cross-page glide everywhere. This keeps the original
  // look but avoids browsers taking a different View Transition path on
  // GitHub Pages vs local file previews.
  const storedDirection = sessionStorage.getItem("mh-glide-direction") || "forward";
  sessionStorage.removeItem("mh-glide-direction");
  root.dataset.glide = storedDirection;

  if (!reduceMotion) {
    root.classList.add("mh-fallback-enter");
    requestAnimationFrame(() => {
      setTimeout(() => root.classList.remove("mh-fallback-enter"), 520);
    });
  }

  // Pointer-reactive highlight stays only on the showcase glass.
  // Scrolling cards no longer update CSS variables every pointer frame.
  const glassSelector = ".topbar";
  let pointerRaf = 0;
  let pointerEvent = null;

  addEventListener("pointermove", e => {
    if (e.pointerType === "touch") return;

    // Never run the decorative page-wide pointer lighting over the video
    // player or while anything is fullscreen. Those CSS-variable updates
    // force unnecessary page repaints and can make fullscreen playback jank.
    if (document.fullscreenElement || document.webkitFullscreenElement || e.target?.closest?.(".player")) return;

    pointerEvent = e;
    if (pointerRaf) return;

    pointerRaf = requestAnimationFrame(() => {
      pointerRaf = 0;
      const p = pointerEvent;
      if (!p) return;

      root.style.setProperty("--pointer-x", `${p.clientX}px`);
      root.style.setProperty("--pointer-y", `${p.clientY}px`);

      const glass = p.target?.closest?.(glassSelector);
      if (glass) {
        const r = glass.getBoundingClientRect();
        if (r.width && r.height) {
          glass.style.setProperty("--glass-x", `${((p.clientX - r.left) / r.width) * 100}%`);
          glass.style.setProperty("--glass-y", `${((p.clientY - r.top) / r.height) * 100}%`);
        }
      }
    });
  }, { passive: true });

  // Glass nav active-pill glider. transform keeps it on the compositor.
  const nav = document.querySelector(".nav");
  let navGlider = null;
  let activeNav = null;

  function moveNavGlider(link, smooth = true) {
    if (!link || !navGlider || !nav) return;
    const nr = nav.getBoundingClientRect();
    const lr = link.getBoundingClientRect();

    if (!smooth) navGlider.style.transition = "none";
    navGlider.style.transform = `translate3d(${lr.left - nr.left}px,0,0)`;
    navGlider.style.width = `${lr.width}px`;

    if (!smooth) {
      navGlider.getBoundingClientRect();
      navGlider.style.removeProperty("transition");
    }
  }

  if (nav) {
    navGlider = document.createElement("span");
    navGlider.className = "nav-glider";
    nav.prepend(navGlider);

    activeNav = nav.querySelector("a.active") || nav.querySelector("a");
    requestAnimationFrame(() => moveNavGlider(activeNav, false));

    nav.querySelectorAll("a").forEach(link => {
      link.addEventListener("pointerenter", e => {
        if (e.pointerType !== "touch") moveNavGlider(link);
      });
      link.addEventListener("pointerleave", () => moveNavGlider(nav.querySelector("a.active") || activeNav));
    });
  }



  // Mobile hamburger navigation drawer.
  const mobileMenuToggle = document.querySelector("#mobileMenuToggle");
  const mobileDrawer = document.querySelector("#mobileDrawer");
  const mobileDrawerClose = document.querySelector("#mobileDrawerClose");
  const mobileNavBackdrop = document.querySelector("#mobileNavBackdrop");

  function setMobileMenu(open) {
    if (!mobileDrawer || !mobileMenuToggle) return;
    document.body.classList.toggle("mobile-nav-open", open);
    mobileMenuToggle.setAttribute("aria-expanded", String(open));
    mobileMenuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    mobileDrawer.setAttribute("aria-hidden", String(!open));
    mobileNavBackdrop?.setAttribute("aria-hidden", String(!open));
    if (open) {
      setTimeout(() => mobileDrawer.querySelector("a.active, a")?.focus({ preventScroll: true }), 120);
    } else {
      mobileMenuToggle.focus({ preventScroll: true });
    }
  }

  mobileMenuToggle?.addEventListener("click", () => {
    setMobileMenu(!document.body.classList.contains("mobile-nav-open"));
  });
  mobileDrawerClose?.addEventListener("click", () => setMobileMenu(false));
  mobileNavBackdrop?.addEventListener("click", () => setMobileMenu(false));
  mobileDrawer?.querySelectorAll("a[href]").forEach(link => {
    link.addEventListener("click", () => setMobileMenu(false));
  });
  addEventListener("keydown", e => {
    if (e.key === "Escape" && document.body.classList.contains("mobile-nav-open")) {
      setMobileMenu(false);
    }
  });
  addEventListener("resize", () => {
    if (innerWidth > 840 && document.body.classList.contains("mobile-nav-open")) {
      setMobileMenu(false);
    }
  }, { passive: true });


  // Floating header scroll state, throttled to one frame.
  const topbar = document.querySelector(".topbar");
  let scrollTicking = false;
  const updateTopbar = () => {
    topbar?.classList.toggle("scrolled", scrollY > 24);
    scrollTicking = false;
  };
  updateTopbar();

  addEventListener("scroll", () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(updateTopbar);
  }, { passive: true });

  // Reliable page glide for all same-site links.
  document.addEventListener("click", e => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    if (a.target === "_blank" || a.hasAttribute("download")) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    let target;
    try { target = new URL(a.href, location.href); } catch { return; }

    if (target.origin !== location.origin) return;
    if (a.getAttribute("href") === "#" || target.href === location.href) return;
    if (target.pathname === location.pathname && target.search === location.search && target.hash) return;
    if (reduceMotion) return;

    e.preventDefault();

    const currentName = location.pathname.split("/").pop() || "index.html";
    const nextName = target.pathname.split("/").pop() || "index.html";
    const direction =
      currentName.includes("episodes") && nextName.includes("index") ? "back" :
      currentName.includes("watch") && nextName.includes("episodes") ? "back" :
      "forward";

    root.dataset.glide = direction;
    sessionStorage.setItem("mh-glide-direction", direction);

    // Let the glass pill visibly glide to the chosen tab before navigation.
    if (nav && navGlider && a.closest(".nav")) {
      moveNavGlider(a, true);
    }

    root.classList.add("mh-fallback-leave");
    setTimeout(() => location.assign(target.href), 220);
  });

  // Covers browser back/forward cache restores.
  addEventListener("pageshow", () => {
    root.classList.remove("mh-fallback-leave");
  });

  const realignNav = () => {
    const active = nav?.querySelector("a.active") || activeNav;
    if (active) moveNavGlider(active, false);
  };

  addEventListener("resize", realignNav, { passive: true });
  addEventListener("orientationchange", () => setTimeout(realignNav, 150));
})();
