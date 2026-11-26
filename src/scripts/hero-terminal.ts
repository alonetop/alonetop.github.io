import { navigate } from "astro:transitions/client";

interface HeroPostItem {
  title: string;
  url: string;
  date: string;
  tag: string;
  min: number;
}

const GLYPHS = "░▒▓█/\\|_-+*#=:;~";
const COMMANDS = [
  "help",
  "ls",
  "open",
  "read",
  "writing",
  "about",
  "whoami",
  "neofetch",
  "search",
  "mono",
  "colour",
  "clear",
  "reset",
  "home",
];
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

let heroCleanup: (() => void) | null = null;

function formatClock(d: Date): string {
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function initHeroTerminal(): void {
  heroCleanup?.();
  heroCleanup = null;

  const win = document.querySelector<HTMLElement>("[data-hero-terminal]");
  if (!win) return;

  const abort = new AbortController();
  const { signal } = abort;
  const isZh = win.dataset.lang === "zh";

  const posts: HeroPostItem[] = (() => {
    try {
      return JSON.parse(win.dataset.termPosts || "[]");
    } catch {
      return [];
    }
  })();

  const typeEls = Array.from(win.querySelectorAll<HTMLElement>("[data-term-type]"));
  const decodeEls = Array.from(win.querySelectorAll<HTMLElement>("[data-term-decode]"));
  const stepEls = Array.from(win.querySelectorAll<HTMLElement>("[data-term-step]"));

  const replayBtn = win.querySelector<HTMLButtonElement>("[data-term-replay]");
  const minBtn = win.querySelector<HTMLButtonElement>("[data-term-min]");
  const wideBtn = win.querySelector<HTMLButtonElement>("[data-term-wide]");
  const clockEl = win.querySelector<HTMLElement>("[data-term-clock]");
  const historyEl = win.querySelector<HTMLElement>("[data-term-history]");
  const formEl = win.querySelector<HTMLFormElement>("[data-term-form]");
  const inputEl = win.querySelector<HTMLInputElement>("[data-term-input]");
  const resetChip = win.querySelector<HTMLButtonElement>("[data-term-reset-chip]");

  function setInteractiveMode(interactive: boolean): void {
    win!.classList.toggle("is-interactive", interactive);
    if (resetChip) resetChip.hidden = !interactive;
  }

  const originalTypes = typeEls.map((el) => el.dataset.termType || el.textContent || "");
  const originalDecodes = decodeEls.map((el) => el.dataset.termDecode || el.textContent || "");

  let runId = 0;

  const sleep = (ms: number, id: number) =>
    new Promise<boolean>((resolve) => {
      window.setTimeout(() => resolve(id === runId), ms);
    });

  function showAllImmediately(): void {
    typeEls.forEach((el, i) => {
      el.textContent = originalTypes[i];
    });
    decodeEls.forEach((el, i) => {
      el.textContent = originalDecodes[i];
    });
    stepEls.forEach((el) => {
      el.classList.remove("is-hidden");
      el.classList.add("is-shown");
    });
    win!.dataset.termState = "done";
  }

  async function typeText(el: HTMLElement, text: string, totalMs: number, id: number): Promise<boolean> {
    el.textContent = "";
    const chars = Array.from(text);
    const perChar = Math.max(11, Math.floor(totalMs / Math.max(1, chars.length)));
    for (let i = 0; i < chars.length; i++) {
      if (id !== runId) return false;
      el.textContent = chars.slice(0, i + 1).join("");
      if (!(await sleep(perChar, id))) return false;
    }
    return true;
  }

  async function decodeText(el: HTMLElement, text: string, durationMs: number, id: number): Promise<boolean> {
    const chars = Array.from(text);
    const start = performance.now();
    return new Promise<boolean>((resolve) => {
      const tick = (now: number) => {
        if (id !== runId) {
          resolve(false);
          return;
        }
        const progress = Math.min(1, (now - start) / durationMs);
        const locked = Math.floor(progress * chars.length);
        let out = "";
        for (let i = 0; i < chars.length; i++) {
          if (i < locked || /\s/.test(chars[i])) {
            out += chars[i];
          } else if (i < locked + 4) {
            out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          } else {
            out += "░";
          }
        }
        el.textContent = out;
        if (progress >= 1) {
          el.textContent = text;
          resolve(true);
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
  }

  function revealStep(stepName: string): void {
    win!
      .querySelectorAll<HTMLElement>(`[data-term-step="${stepName}"]`)
      .forEach((el) => {
        el.classList.remove("is-hidden");
        el.classList.add("is-shown");
      });
  }

  async function playSequence(force = false): Promise<void> {
    const id = ++runId;
    if (reduced.matches && !force) {
      showAllImmediately();
      return;
    }

    if (win!.classList.contains("is-minimized")) {
      win!.classList.remove("is-minimized");
      if (minBtn) {
        minBtn.textContent = "[−]";
        minBtn.setAttribute("aria-pressed", "false");
      }
      syncBrandVisibility();
    }

    setInteractiveMode(false);
    historyEl?.replaceChildren();

    win!.dataset.termState = "playing";
    typeEls.forEach((el) => (el.textContent = ""));
    decodeEls.forEach((el) => (el.textContent = ""));
    stepEls.forEach((el) => {
      el.classList.remove("is-shown");
      el.classList.add("is-hidden");
    });

    revealStep("cmd1");
    if (typeEls[0] && !(await typeText(typeEls[0], originalTypes[0], 210, id))) return;
    if (!(await sleep(50, id))) return;

    revealStep("out1");
    if (!(await sleep(160, id))) return;

    revealStep("cmd2");
    if (typeEls[1] && !(await typeText(typeEls[1], originalTypes[1], 230, id))) return;
    if (!(await sleep(50, id))) return;

    revealStep("title");
    const perDecode = Math.max(120, Math.floor(380 / Math.max(1, decodeEls.length)));
    for (let i = 0; i < decodeEls.length; i++) {
      if (!(await decodeText(decodeEls[i], originalDecodes[i], perDecode, id))) return;
    }

    revealStep("body");
    win!.dataset.termState = "done";
  }

  // Interactive Shell Engine
  const cmdHistory: string[] = [];
  let historyIdx = -1;

  function appendEntry(cmd: string, nodes: Node[]): void {
    if (!historyEl) return;
    const block = document.createElement("div");
    block.className = "term-log-block";

    const echo = document.createElement("div");
    echo.className = "term-log-cmd";
    const p = document.createElement("span");
    p.className = "prompt";
    p.textContent = "$";
    const c = document.createElement("span");
    c.textContent = ` ${cmd}`;
    echo.append(p, c);

    const out = document.createElement("div");
    out.className = "term-log-out";
    out.append(...nodes);

    block.append(echo, out);
    historyEl.append(block);
    historyEl.scrollTop = historyEl.scrollHeight;
  }

  function textLine(text: string, cls = ""): HTMLElement {
    const div = document.createElement("div");
    if (cls) div.className = cls;
    div.textContent = text;
    return div;
  }

  function runCommand(raw: string): void {
    const trimmed = raw.trim();
    if (!trimmed) return;
    cmdHistory.push(trimmed);
    historyIdx = cmdHistory.length;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(" ");

    if (cmd === "reset" || cmd === "home") {
      setInteractiveMode(false);
      historyEl?.replaceChildren();
      showAllImmediately();
      return;
    }

    // Clear the initial welcome session on first command so interactive output has full room.
    setInteractiveMode(true);

    if (cmd === "clear" || cmd === "cls") {
      historyEl?.replaceChildren();
      return;
    }

    if (cmd === "help" || cmd === "?") {
      appendEntry(trimmed, [
        textLine(
          isZh
            ? "help           显示全部可用命令"
            : "help           show available commands",
        ),
        textLine(
          isZh
            ? "ls             列出全部文章与编号"
            : "ls             list all published blogs",
        ),
        textLine(
          isZh
            ? "open <编号>    无刷新打开对应文章（如 open 1）"
            : "open <n>       open note by index (e.g. open 1)",
        ),
        textLine(
          isZh
            ? "writing/about  进入归档页或关于页"
            : "writing/about  navigate to archive or about",
        ),
        textLine(
          isZh
            ? "search         打开全文搜索面板"
            : "search         open full-text search",
        ),
        textLine(
          isZh
            ? "mono / colour  切换复古绿单色与彩色森林背景"
            : "mono / colour  toggle retro-green mono or colour forest",
        ),
        textLine(
          isZh
            ? "clear / reset  清空日志 / 返回初始 neofetch 界面"
            : "clear / reset  clear log / restore welcome screen",
        ),
      ]);
      return;
    }

    if (cmd === "ls" || cmd === "ll") {
      const nodes: Node[] = posts.map((post, idx) => {
        const a = document.createElement("a");
        a.className = "term-ls-link";
        a.href = post.url;
        const i = document.createElement("span");
        i.className = "term-ls-idx";
        i.textContent = `[${idx + 1}]`;
        const d = document.createElement("span");
        d.className = "term-ls-date";
        d.textContent = post.date;
        const t = document.createElement("span");
        t.className = "term-ls-title";
        t.textContent = post.title;
        const ar = document.createElement("span");
        ar.className = "term-ls-arrow";
        ar.textContent = "↗";
        a.append(i, d, t, ar);
        return a;
      });
      appendEntry(trimmed, nodes.length ? nodes : [textLine("0 blogs.")]);
      return;
    }

    if (cmd === "open" || cmd === "read" || cmd === "cat") {
      const num = Number.parseInt(arg, 10);
      const target =
        Number.isFinite(num) && num >= 1 && num <= posts.length
          ? posts[num - 1]
          : posts.find(
              (p) =>
                arg &&
                (p.title.toLowerCase().includes(arg.toLowerCase()) ||
                  p.url.toLowerCase().includes(arg.toLowerCase())),
            );
      if (target) {
        appendEntry(trimmed, [
          textLine(
            isZh ? `正在打开 ${target.title}…` : `opening ${target.title}…`,
            "term-ok",
          ),
        ]);
        void navigate(target.url);
      } else {
        appendEntry(trimmed, [
          textLine(
            isZh
              ? `未找到目标「${arg || "空"}」，试试 open 1 ~ open ${posts.length}`
              : `not found: "${arg}". try open 1..${posts.length}`,
            "term-err",
          ),
        ]);
      }
      return;
    }

    if (cmd === "writing" || cmd === "archive") {
      appendEntry(trimmed, [textLine(isZh ? "前往 ~/writing/…" : "cd ~/writing/…", "term-ok")]);
      if (win!.dataset.writingUrl) void navigate(win!.dataset.writingUrl);
      return;
    }

    if (cmd === "about") {
      appendEntry(trimmed, [textLine(isZh ? "前往 ~/about/…" : "cd ~/about/…", "term-ok")]);
      if (win!.dataset.aboutUrl) void navigate(win!.dataset.aboutUrl);
      return;
    }

    if (cmd === "whoami") {
      appendEntry(trimmed, [
        textLine(`${win!.dataset.user || "user"} · ${win!.dataset.bio || ""}`),
      ]);
      return;
    }

    if (cmd === "neofetch") {
      appendEntry(trimmed, [
        textLine(
          `${win!.dataset.user || "user"}@blogs · ${posts.length} blogs · misty-forest`,
          "term-ok",
        ),
      ]);
      return;
    }

    if (cmd === "search" || cmd === "find") {
      appendEntry(trimmed, [textLine(isZh ? "已唤起全文搜索。" : "opening search dialog.", "term-ok")]);
      document.querySelector<HTMLButtonElement>(".search-open")?.click();
      return;
    }

    if (cmd === "mono" || cmd === "colour" || cmd === "color") {
      document.querySelector<HTMLButtonElement>('[data-ascii-mono-for="site-backdrop"]')?.click();
      appendEntry(trimmed, [
        textLine(
          isZh ? "已切换森林背景色彩模式。" : "toggled backdrop colour mode.",
          "term-ok",
        ),
      ]);
      return;
    }

    appendEntry(trimmed, [
      textLine(
        isZh
          ? `zsh: command not found: ${cmd}（输入 help 查看可用命令）`
          : `zsh: command not found: ${cmd} (type help)`,
        "term-err",
      ),
    ]);
  }

  formEl?.addEventListener(
    "submit",
    (e) => {
      e.preventDefault();
      if (!inputEl) return;
      const val = inputEl.value;
      inputEl.value = "";
      runCommand(val);
    },
    { signal },
  );

  inputEl?.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "ArrowUp") {
        if (!cmdHistory.length) return;
        e.preventDefault();
        historyIdx = Math.max(0, historyIdx - 1);
        inputEl.value = cmdHistory[historyIdx] || "";
      } else if (e.key === "ArrowDown") {
        if (!cmdHistory.length) return;
        e.preventDefault();
        historyIdx = Math.min(cmdHistory.length, historyIdx + 1);
        inputEl.value = cmdHistory[historyIdx] || "";
      } else if (e.key === "Tab") {
        const cur = inputEl.value.trim().toLowerCase();
        if (!cur) return;
        const match = COMMANDS.find((c) => c.startsWith(cur));
        if (match) {
          e.preventDefault();
          inputEl.value = match;
        }
      }
    },
    { signal },
  );

  win.querySelectorAll<HTMLButtonElement>("[data-term-cmd]").forEach((chip) => {
    chip.addEventListener(
      "click",
      () => {
        const cmd = chip.dataset.termCmd;
        if (cmd) runCommand(cmd);
        inputEl?.focus();
      },
      { signal },
    );
  });

  let heroDismissed = false;

  function syncBrandVisibility(): void {
    const show = heroDismissed || win!.classList.contains("is-minimized");
    document.body.dataset.brandVisible = show ? "true" : "false";
    const headerEl = document.querySelector<HTMLElement>(".site-header");
    if (headerEl) {
      if (show) headerEl.dataset.ignited = "true";
      headerEl.setAttribute("data-hero-open", show ? "false" : "true");
    }
  }

  // Window controls
  replayBtn?.addEventListener("click", () => void playSequence(true), { signal });

  minBtn?.addEventListener(
    "click",
    () => {
      const minimized = win.classList.toggle("is-minimized");
      minBtn.textContent = minimized ? "[+]" : "[−]";
      minBtn.setAttribute("aria-pressed", String(minimized));
      syncBrandVisibility();
    },
    { signal },
  );

  wideBtn?.addEventListener(
    "click",
    () => {
      const wide = win.classList.toggle("is-wide");
      wideBtn.textContent = wide ? "[❐]" : "[□]";
      wideBtn.setAttribute("aria-pressed", String(wide));
    },
    { signal },
  );

  // Live local clock
  let clockTimer = 0;
  if (clockEl) {
    const tickClock = () => {
      clockEl.textContent = formatClock(new Date());
    };
    const syncClock = () => {
      window.clearInterval(clockTimer);
      tickClock();
      if (!document.hidden) {
        clockTimer = window.setInterval(tickClock, 1000);
      }
    };
    document.addEventListener("visibilitychange", syncClock, { signal });
    syncClock();
  }

  // Sticky hero fade + gentle depth recession as content slides over it
  const heroSection = win.closest<HTMLElement>("[data-hero]");
  const heroOverlay = win.closest<HTMLElement>(".hero-overlay");
  let scrollRaf = 0;
  if (heroSection && heroOverlay) {
    const applyHeroVisual = (): void => {
      const heroH = Math.max(320, heroSection.offsetHeight || window.innerHeight);
      const p = Math.max(0, Math.min(1, window.scrollY / (heroH * 0.65)));
      if (p <= 0.001) {
        heroOverlay.style.opacity = "";
        heroOverlay.style.transform = "";
      } else {
        const smooth = p * p * (3 - 2 * p);
        const opacity = 1 - smooth;
        heroOverlay.style.opacity = opacity.toFixed(3);
        heroOverlay.style.transform = reduced.matches
          ? "none"
          : `translateY(${(-96 * smooth).toFixed(1)}px) scale(${(1 - 0.03 * smooth).toFixed(4)})`;
      }
      heroSection.style.pointerEvents = p > 0.72 ? "none" : "";
      heroDismissed = p >= 0.72;
    };
    const syncHeroFade = () => {
      scrollRaf = 0;
      applyHeroVisual();
      syncBrandVisibility();
    };
    const onScroll = () => {
      if (!scrollRaf) scrollRaf = requestAnimationFrame(syncHeroFade);
    };
    window.addEventListener("scroll", onScroll, { passive: true, signal });
    window.addEventListener("resize", onScroll, { passive: true, signal });
    applyHeroVisual();
    const headerEl = document.querySelector<HTMLElement>(".site-header");
    if (headerEl?.dataset.ignited === "true") {
      scrollRaf = requestAnimationFrame(syncHeroFade);
    } else {
      syncBrandVisibility();
    }
  }

  heroCleanup = () => {
    runId++;
    abort.abort();
    window.clearInterval(clockTimer);
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
  };

  const introState = document.documentElement.dataset.intro;
  if (introState === "pending" || introState === "leaving") {
    document.addEventListener(
      "journal:entered",
      () => void playSequence(false),
      { once: true, signal },
    );
  } else {
    void playSequence(false);
  }
}

const GLOBAL_KEY = "__heroTerminalBound";
if (!(window as unknown as Record<string, boolean>)[GLOBAL_KEY]) {
  (window as unknown as Record<string, boolean>)[GLOBAL_KEY] = true;
  document.addEventListener("astro:before-swap", () => {
    heroCleanup?.();
    heroCleanup = null;
  });
  document.addEventListener("astro:page-load", initHeroTerminal);
}
