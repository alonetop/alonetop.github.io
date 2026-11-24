// Runs in <head> before first paint. Independent watchdog never depends on modules.
(() => {
  const root = document.documentElement;
  root.classList.add("js");
  root.dataset.theme = "dark";

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const navigation = performance.getEntriesByType("navigation")[0];
  let internal = false;
  try {
    const marker = JSON.parse(
      sessionStorage.getItem("journal-navigation") || "null",
    );
    sessionStorage.removeItem("journal-navigation");
    internal =
      marker?.to === location.pathname + location.search &&
      Date.now() - marker.at < 8000;
  } catch {
    /* A direct visit is the safe fallback. */
  }

  const full =
    !reduced.matches &&
    navigation?.type !== "back_forward" &&
    (navigation?.type === "reload" || !internal);

  root.dataset.intro = reduced.matches ? "off" : full ? "pending" : "ready";

  const boot = {
    started: performance.now(),
    full,
    timer: 0,
    done: !full,
    finish(mode = "ready") {
      clearTimeout(boot.timer);
      boot.done = true;
      root.dataset.intro = mode;
      const screen = document.getElementById("intro-screen");
      if (screen) screen.hidden = true;
      document.dispatchEvent(new CustomEvent("journal:entered"));
    },
  };
  window.__journalIntro = boot;
  if (full) {
    boot.timer = window.setTimeout(() => boot.finish("off"), 1800);
  }

  reduced.addEventListener("change", (event) => {
    if (event.matches) boot.finish("off");
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) boot.finish("off");
  });

  document.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    const anchor =
      event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (
      !anchor ||
      anchor.hasAttribute("download") ||
      (anchor.target && anchor.target !== "_self")
    )
      return;
    const target = new URL(anchor.href, location.href);
    if (
      target.origin !== location.origin ||
      /\.(xml|pdf|zip)$/i.test(target.pathname)
    )
      return;
    if (
      target.pathname === location.pathname &&
      target.search === location.search &&
      target.hash
    )
      return;
    try {
      sessionStorage.setItem(
        "journal-navigation",
        JSON.stringify({ to: target.pathname + target.search, at: Date.now() }),
      );
    } catch {
      /* Navigation stays native. */
    }
  });
})();
