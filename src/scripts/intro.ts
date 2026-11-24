export {};
declare global {
  interface Window {
    __journalIntro?: {
      started: number;
      full: boolean;
      timer: number;
      done: boolean;
      finish(mode?: string): void;
    };
  }
}

const root = document.documentElement;
const boot = window.__journalIntro;
const CELLS = 24;
const DURATION_MS = 450;
const LEAVE_MS = 180;
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function paintBar(
  fillEl: HTMLElement | null,
  restEl: HTMLElement | null,
  pctEl: HTMLElement | null,
  statusEl: HTMLElement | null,
  ratio: number,
): void {
  const clamped = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(clamped * CELLS);
  if (fillEl) fillEl.textContent = "█".repeat(filled);
  if (restEl) restEl.textContent = "░".repeat(CELLS - filled);
  if (pctEl) pctEl.textContent = `${String(Math.round(clamped * 100)).padStart(3, " ")}%`;
  if (statusEl && clamped >= 1) {
    statusEl.textContent = statusEl.dataset.ready || "ready.";
  }
}

async function enter(): Promise<void> {
  if (!boot || boot.done) {
    const screen = document.getElementById("intro-screen");
    if (screen) screen.hidden = true;
    return;
  }

  const fillEl = document.getElementById("intro-bar-fill");
  const restEl = document.getElementById("intro-bar-rest");
  const pctEl = document.getElementById("intro-pct");
  const statusEl = document.getElementById("intro-status");

  try {
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        if (boot.done) {
          resolve();
          return;
        }
        const elapsed = now - start;
        const linear = Math.min(1, elapsed / DURATION_MS);
        // Smooth ease-out cubic progression over ~450ms.
        const eased = 1 - Math.pow(1 - linear, 3);
        paintBar(fillEl, restEl, pctEl, statusEl, eased);
        if (linear >= 1) {
          resolve();
        } else {
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    });

    if (boot.done) return;
    paintBar(fillEl, restEl, pctEl, statusEl, 1);
    root.dataset.intro = "leaving";
    await wait(LEAVE_MS);
    if (!boot.done) boot.finish("ready");
  } catch {
    boot.finish("off");
  }
}

void enter();
