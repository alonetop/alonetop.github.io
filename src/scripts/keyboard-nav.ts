export {};

type Dir = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

const SELECTOR =
  'a[href], button:not(:disabled), input:not([type="hidden"]):not(:disabled)';

let activeEl: HTMLElement | null = null;

function isTextInput(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

function isVisibleFocusable(el: HTMLElement): boolean {
  if (el.hidden || el.classList.contains("skip-link")) return false;
  if (el.closest("[hidden], dialog:not([open]), .intro-screen")) return false;
  const hero = el.closest<HTMLElement>("[data-hero]");
  if (hero && hero.style.pointerEvents === "none") return false;
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none") {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getFocusables(): HTMLElement[] {
  const openDialog = document.querySelector<HTMLDialogElement>("dialog[open]");
  const scope: ParentNode = openDialog || document;
  return Array.from(scope.querySelectorAll<HTMLElement>(SELECTOR)).filter(
    isVisibleFocusable,
  );
}

function clearFocusMark(): void {
  if (activeEl) {
    activeEl.removeAttribute("data-kbd-focus");
    activeEl = null;
  }
}

function setFocusMark(el: HTMLElement): void {
  if (activeEl && activeEl !== el) {
    activeEl.removeAttribute("data-kbd-focus");
  }
  activeEl = el;
  document.documentElement.classList.add("kbd-nav");
  el.setAttribute("data-kbd-focus", "");
  el.focus({ preventScroll: true });

  // Scroll non-fixed elements smoothly into comfortable view below the fixed top bar.
  if (!el.closest(".site-header")) {
    const rect = el.getBoundingClientRect();
    const headerH =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 56;
    const marginTop = headerH + 24;
    const marginBottom = 36;
    if (rect.top < marginTop || rect.bottom > window.innerHeight - marginBottom) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

function toDocBox(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const sx = window.scrollX;
  const sy = window.scrollY;
  return {
    el,
    left: r.left + sx,
    right: r.right + sx,
    top: r.top + sy,
    bottom: r.bottom + sy,
    cx: r.left + r.width / 2 + sx,
    cy: r.top + r.height / 2 + sy,
    vTop: r.top,
    vBottom: r.bottom,
  };
}

function findNext(current: HTMLElement, dir: Dir, items: HTMLElement[]): HTMLElement | null {
  const cur = toDocBox(current);
  let best: { el: HTMLElement; score: number; vTop: number; vBottom: number } | null = null;

  for (const el of items) {
    if (el === current) continue;
    const c = toDocBox(el);
    const dx = c.cx - cur.cx;
    const dy = c.cy - cur.cy;

    let primary = 0;
    let secondary = 0;

    if (dir === "ArrowRight") {
      if (dx <= 4) continue;
      // Prefer elements on roughly the same horizontal band.
      primary = dx;
      secondary = Math.abs(dy) * 3.4;
    } else if (dir === "ArrowLeft") {
      if (dx >= -4) continue;
      primary = -dx;
      secondary = Math.abs(dy) * 3.4;
    } else if (dir === "ArrowDown") {
      if (dy <= 4) continue;
      primary = dy;
      secondary = Math.abs(dx) * 1.35;
    } else {
      if (dy >= -4) continue;
      primary = -dy;
      secondary = Math.abs(dx) * 1.35;
    }

    const score = primary + secondary;
    if (!best || score < best.score) {
      best = { el, score, vTop: c.vTop, vBottom: c.vBottom };
    }
  }

  return best ? best.el : null;
}

function pickInitial(items: HTMLElement[]): HTMLElement | null {
  if (!items.length) return null;
  const headerH =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 56;
  // Prefer the first visible interactive element in main content inside the current viewport.
  const inView = items.find((el) => {
    if (el.closest(".site-header")) return false;
    const r = el.getBoundingClientRect();
    return r.top >= headerH && r.bottom <= window.innerHeight;
  });
  return inView || items[0];
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  // Let search dialog keep its own input & ArrowUp/ArrowDown result list behavior.
  const openDialog = document.querySelector<HTMLDialogElement>("dialog[open]");
  if (openDialog) return;

  const focused = document.activeElement as HTMLElement | null;

  // Esc exits text input or clears spatial keyboard focus.
  if (event.key === "Escape") {
    if (isTextInput(focused)) {
      focused?.blur();
      clearFocusMark();
    } else if (activeEl) {
      activeEl.blur();
      clearFocusMark();
      document.documentElement.classList.remove("kbd-nav");
    }
    return;
  }

  // While typing inside an input (e.g. hero shell prompt), leave arrows & Enter to the input.
  if (isTextInput(focused)) return;

  if (
    event.key === "ArrowUp" ||
    event.key === "ArrowDown" ||
    event.key === "ArrowLeft" ||
    event.key === "ArrowRight"
  ) {
    const items = getFocusables();
    if (!items.length) return;

    const current =
      (activeEl && activeEl.isConnected && items.includes(activeEl) ? activeEl : null) ||
      (focused && items.includes(focused) ? focused : null);

    if (!current) {
      const first = pickInitial(items);
      if (first) {
        event.preventDefault();
        setFocusMark(first);
      }
      return;
    }

    const next = findNext(current, event.key, items);

    // Smart scroll fallback: in long prose where no button is near in the viewport, scroll smoothly instead of jumping screens away.
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const step = Math.round(window.innerHeight * 0.42);
      if (!next) {
        event.preventDefault();
        window.scrollBy({ top: event.key === "ArrowDown" ? step : -step, behavior: "smooth" });
        return;
      }
      const nr = next.getBoundingClientRect();
      const tooFarDown = event.key === "ArrowDown" && nr.top > window.innerHeight * 1.35;
      const tooFarUp = event.key === "ArrowUp" && nr.bottom < -window.innerHeight * 0.35;
      if (tooFarDown || tooFarUp) {
        event.preventDefault();
        window.scrollBy({ top: event.key === "ArrowDown" ? step : -step, behavior: "smooth" });
        return;
      }
    }

    if (next) {
      event.preventDefault();
      setFocusMark(next);
    }
    return;
  }

  if (event.key === "Enter" && activeEl && activeEl.isConnected) {
    // Native browser Enter already activates focused <a> and <button>; only handle non-focused fallback.
    if (document.activeElement !== activeEl) {
      event.preventDefault();
      activeEl.click();
    }
  }
}

const KEY = "__spatialKbdNavBound";
if (!(window as unknown as Record<string, boolean>)[KEY]) {
  (window as unknown as Record<string, boolean>)[KEY] = true;

  document.addEventListener("keydown", handleKeyDown);

  document.addEventListener(
    "pointerdown",
    () => {
      clearFocusMark();
      document.documentElement.classList.remove("kbd-nav");
    },
    { passive: true },
  );

  document.addEventListener("astro:before-swap", () => {
    clearFocusMark();
  });
}
