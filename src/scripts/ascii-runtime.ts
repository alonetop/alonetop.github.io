import {
  canvas as canvasPieces,
  isPiece,
  load,
  mount,
  type Piece,
  type PieceName,
} from "ascii.rest";
import type { BannerOptions } from "ascii.rest/banner";
import { extendPiece } from "../lib/extend-piece";

const INK_KEY = "journal-ascii-ink";
const SCENE_KEY = "journal-ascii-scene";
const MOTION_KEY = "journal-ascii-motion";

const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");

interface MountedInstance {
  persistent: boolean;
  remount: () => void;
  rebindExternalControls?: () => void;
  stop: () => void;
}

const mountedInstances = new Set<MountedInstance>();
const boundElements = new WeakSet<HTMLElement>();
const pieceCache = new Map<PieceName, Promise<Piece>>();

function fetchPiece(name: PieceName): Promise<Piece> {
  let cached = pieceCache.get(name);
  if (!cached) {
    cached = load[name]();
    pieceCache.set(name, cached);
  }
  return cached;
}

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Optional persistence. */
  }
}

const getMotionOverride = () => readStore(MOTION_KEY) === "play";

function fitPreToBox(stage: HTMLElement): void {
  const pre = stage.querySelector<HTMLPreElement>("pre.ascii-stage");
  if (!pre) return;
  const boxW = stage.clientWidth;
  const boxH = stage.clientHeight;
  if (!boxW || !boxH) return;
  const preW = pre.scrollWidth;
  const preH = pre.scrollHeight;
  if (!preW || !preH) return;
  if (preW > boxW + 1 || preH > boxH + 1) {
    const scale = Math.min(boxW / preW, boxH / preH) * 0.96;
    pre.style.position = "absolute";
    pre.style.left = "50%";
    pre.style.top = "50%";
    pre.style.transformOrigin = "center center";
    pre.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(4)})`;
  } else if (pre.style.transform || pre.style.position) {
    pre.style.position = "";
    pre.style.left = "";
    pre.style.top = "";
    pre.style.transform = "";
    pre.style.transformOrigin = "";
  }
}

function syncMotionButtons(): void {
  const override = getMotionOverride();
  document
    .querySelectorAll<HTMLButtonElement>("[data-motion-toggle]")
    .forEach((btn) => {
      btn.hidden = !reducedQuery.matches;
      btn.textContent = override
        ? btn.dataset.still || "[hold still]"
        : btn.dataset.play || "[play anyway]";
      btn.setAttribute("aria-pressed", String(override));
    });
}

function setupAsciiWell(container: HTMLElement): void {
  if (boundElements.has(container)) return;
  const stage = container.querySelector<HTMLElement>("[data-ascii-stage]");
  if (!stage) return;

  const initialPiece = container.dataset.asciiPiece || "";
  if (!isPiece(initialPiece)) return;

  boundElements.add(container);

  const isBackdrop = container.id === "site-backdrop";
  const cover = container.dataset.asciiCover === "true";
  const extendRows = Number(container.dataset.asciiExtend) || 0;
  const scenesAttr = container.dataset.asciiScenes;
  const availableScenes = scenesAttr
    ? scenesAttr.split(",").filter((s): s is PieceName => isPiece(s))
    : [];

  let currentPiece: PieceName = initialPiece;
  const savedScene = readStore(SCENE_KEY);
  if (
    availableScenes.length > 1 &&
    savedScene &&
    availableScenes.includes(savedScene as PieceName)
  ) {
    currentPiece = savedScene as PieceName;
  }

  const metaEl = container.querySelector<HTMLElement>("[data-ascii-meta]");
  const sceneButtons = Array.from(
    container.querySelectorAll<HTMLButtonElement>("[data-ascii-scene-pick]"),
  );

  let mono = container.dataset.asciiMono === "true";
  const savedInk = readStore(INK_KEY);
  if (isBackdrop || container.querySelector("[data-ascii-mono-toggle]")) {
    if (savedInk === "mono") mono = true;
    else if (savedInk === "colour") mono = false;
  }

  const rawFps = Number(container.dataset.asciiFps);
  const baseOptions: Record<string, unknown> = (() => {
    try {
      return container.dataset.asciiOptions
        ? JSON.parse(container.dataset.asciiOptions)
        : {};
    } catch {
      return {};
    }
  })();

  let stopCurrent: (() => void) | null = null;
  let active = false;
  let version = 0;
  let ratio =
    (Number(container.style.getPropertyValue("--cols")) || 64) /
    ((Number(container.style.getPropertyValue("--rows")) || 20) *
      (Number(container.style.getPropertyValue("--cell")) || 2));

  let sceneRatio =
    (Number(container.style.getPropertyValue("--cols")) || 64) /
    ((Number(container.style.getPropertyValue("--scene-rows")) ||
      Number(container.style.getPropertyValue("--rows")) ||
      20) *
      (Number(container.style.getPropertyValue("--cell")) || 2));

  function fitCover(): void {
    if (!cover) return;
    const W = container.clientWidth;
    const H = container.clientHeight;
    if (!W || !H) return;
    // Landscape: fit width so the whole panorama shows (ground-coloured bands above/below).
    // Portrait / narrow: cover and crop, otherwise the scene becomes too small.
    // `ratio` includes any generated sky/floor rows; `sceneRatio` is the original scene only.
    const coverW = W / H >= 1.2 ? Math.max(W, H * ratio) : Math.max(W, H * sceneRatio);
    const maxW = W < 720 ? 1100 : 1700;
    const layoutW = Math.min(coverW, maxW);
    const scale = coverW / layoutW;
    stage!.style.width = `${layoutW}px`;
    stage!.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  let ro: ResizeObserver | null = null;
  if (cover) {
    ro = new ResizeObserver(fitCover);
    ro.observe(container);
    fitCover();
  } else {
    ro = new ResizeObserver(() => fitPreToBox(stage!));
    ro.observe(stage);
    fitPreToBox(stage);
  }

  function getMonoButtons(): HTMLButtonElement[] {
    return [
      ...container.querySelectorAll<HTMLButtonElement>("[data-ascii-mono-toggle]"),
      ...(container.id
        ? Array.from(
            document.querySelectorAll<HTMLButtonElement>(
              `[data-ascii-mono-for="${container.id}"]`,
            ),
          )
        : []),
    ];
  }

  function syncButtons(): void {
    for (const btn of getMonoButtons()) {
      btn.textContent = mono ? "[mono]" : "[colour]";
      btn.setAttribute("aria-pressed", String(mono));
    }
    for (const btn of sceneButtons) {
      btn.setAttribute(
        "aria-pressed",
        String(btn.dataset.asciiScenePick === currentPiece),
      );
    }
  }

  function syncBackdropMode(): void {
    container.dataset.asciiMono = String(mono);
    syncButtons();
  }

  function bindExternalMonoButtons(): void {
    for (const btn of getMonoButtons()) {
      if (btn.dataset.asciiMonoBound === "true") continue;
      btn.dataset.asciiMonoBound = "true";
      btn.addEventListener("click", () => {
        mono = !mono;
        writeStore(INK_KEY, mono ? "mono" : "colour");
        if (isBackdrop && active) {
          syncBackdropMode();
        } else {
          void renderNow();
        }
      });
    }
    syncButtons();
  }

  function updateChrome(pieceMod: Piece): void {
    const isColoured = canvasPieces.has(currentPiece);
    const cols = pieceMod.meta.cols ?? 64;
    const rows = pieceMod.meta.rows ?? 20;
    const cell = pieceMod.meta.cell ?? 2;
    ratio = cols / (rows * cell);
    sceneRatio = cols / ((rows - extendRows * 2) * cell);

    container.classList.toggle("is-scene", isColoured && (isBackdrop || !mono));
    container.dataset.asciiPiece = currentPiece;
    container.dataset.asciiMono = String(mono);
    container.style.setProperty("--cols", String(cols));
    container.style.setProperty("--rows", String(rows));
    container.style.setProperty("--cell", String(cell));
    if (pieceMod.meta.ground) {
      container.style.setProperty("--ground", pieceMod.meta.ground);
    } else {
      container.style.removeProperty("--ground");
    }

    if (metaEl && availableScenes.length > 1) {
      metaEl.textContent = `${pieceMod.meta.name} · ${cols}×${rows}`;
    }
    syncButtons();
    fitCover();
  }

  async function renderNow(): Promise<void> {
    const ticket = ++version;
    let pieceMod: Piece;
    try {
      pieceMod = await fetchPiece(currentPiece);
      if (extendRows > 0) pieceMod = extendPiece(pieceMod, extendRows);
    } catch {
      return;
    }
    if (ticket !== version || !container.isConnected) return;

    updateChrome(pieceMod);

    const isColoured = canvasPieces.has(currentPiece);
    const useCanvas = isColoured && (isBackdrop || !mono);
    const target = document.createElement(useCanvas ? "canvas" : "pre");
    target.className = useCanvas ? "ascii-canvas" : "ascii-stage";
    target.setAttribute("aria-hidden", "true");

    stopCurrent?.();
    stopCurrent = null;
    stage!.replaceChildren(target);

    const pieceFps =
      Number.isFinite(rawFps) && rawFps > 0 ? rawFps : (pieceMod.meta.fps ?? 15);
    const cappedFps = isColoured ? Math.min(pieceFps, 16) : Math.min(pieceFps, 18);

    stopCurrent = mount(target, pieceMod, {
      ...baseOptions,
      fps: cappedFps,
      motion: getMotionOverride(),
    });
    if (!cover && !useCanvas) {
      fitPreToBox(stage!);
      requestAnimationFrame(() => fitPreToBox(stage!));
    }
    active = true;
  }

  let io: IntersectionObserver | null = null;

  const instance: MountedInstance = {
    persistent: isBackdrop,
    remount: () => {
      if (active) void renderNow();
    },
    rebindExternalControls: bindExternalMonoButtons,
    stop: () => {
      io?.disconnect();
      ro?.disconnect();
      stopCurrent?.();
      stopCurrent = null;
      active = false;
    },
  };
  mountedInstances.add(instance);

  bindExternalMonoButtons();

  for (const btn of sceneButtons) {
    btn.addEventListener("click", () => {
      const next = btn.dataset.asciiScenePick;
      if (!next || !isPiece(next) || next === currentPiece) return;
      currentPiece = next;
      writeStore(SCENE_KEY, next);
      void renderNow();
    });
  }

  if (cover) {
    void renderNow();
    return;
  }
  io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io?.disconnect();
        void renderNow();
      }
    },
    { rootMargin: "220px 0px" },
  );
  io.observe(container);
}

function setupAsciiBanner(container: HTMLElement): void {
  if (boundElements.has(container)) return;
  const stage = container.querySelector<HTMLElement>("[data-ascii-banner-stage]");
  const text = container.dataset.asciiBannerText;
  if (!stage || !text) return;

  boundElements.add(container);

  const options: BannerOptions = (() => {
    try {
      return container.dataset.asciiBannerOptions
        ? JSON.parse(container.dataset.asciiBannerOptions)
        : {};
    } catch {
      return {};
    }
  })();

  let stopCurrent: (() => void) | null = null;
  let active = false;
  let io: IntersectionObserver | null = null;
  const ro = new ResizeObserver(() => fitPreToBox(stage!));
  ro.observe(stage);
  fitPreToBox(stage);

  async function renderBanner(): Promise<void> {
    const { banner } = await import("ascii.rest/banner");
    if (!container.isConnected) return;
    const piece = banner(text!, options);
    const pre = document.createElement("pre");
    pre.className = "ascii-stage";
    pre.setAttribute("aria-hidden", "true");
    stopCurrent?.();
    stage!.replaceChildren(pre);
    stopCurrent = mount(pre, piece, { motion: getMotionOverride() });
    fitPreToBox(stage!);
    requestAnimationFrame(() => fitPreToBox(stage!));
    active = true;
  }

  mountedInstances.add({
    persistent: false,
    remount: () => {
      if (active) void renderBanner();
    },
    stop: () => {
      io?.disconnect();
      ro.disconnect();
      stopCurrent?.();
      stopCurrent = null;
      active = false;
    },
  });

  io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io?.disconnect();
        void renderBanner();
      }
    },
    { rootMargin: "220px 0px" },
  );
  io.observe(container);
}

function mountPage(): void {
  document
    .querySelectorAll<HTMLElement>("[data-ascii-root]")
    .forEach(setupAsciiWell);
  document
    .querySelectorAll<HTMLElement>("[data-ascii-banner-text]")
    .forEach(setupAsciiBanner);

  // Re-attach header [mono] button to the persisted #site-backdrop after soft navigation.
  mountedInstances.forEach((inst) => inst.rebindExternalControls?.());

  if (document.querySelector("ascii-art[piece]")) {
    void import("ascii.rest/element");
  }

  syncMotionButtons();
  document
    .querySelectorAll<HTMLButtonElement>("[data-motion-toggle]")
    .forEach((btn) => {
      if (btn.dataset.motionBound === "true") return;
      btn.dataset.motionBound = "true";
      btn.addEventListener("click", () => {
        writeStore(MOTION_KEY, getMotionOverride() ? "still" : "play");
        syncMotionButtons();
        mountedInstances.forEach((inst) => inst.remount());
      });
    });
}

function cleanupNonPersistent(): void {
  for (const inst of Array.from(mountedInstances)) {
    if (!inst.persistent) {
      inst.stop();
      mountedInstances.delete(inst);
    }
  }
}

document.addEventListener("astro:before-swap", cleanupNonPersistent);
document.addEventListener("astro:page-load", mountPage);

reducedQuery.addEventListener("change", () => {
  syncMotionButtons();
  mountedInstances.forEach((inst) => inst.remount());
});

window.addEventListener("pagehide", () => {
  mountedInstances.forEach((inst) => inst.stop());
});
