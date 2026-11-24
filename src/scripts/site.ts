export {};

interface SearchData {
  url: string;
  meta: { title?: string };
  excerpt: string;
}
interface SearchModule {
  search: (
    query: string,
  ) => Promise<{ results: { data: () => Promise<SearchData> }[] }>;
}

let engine: Promise<SearchModule> | undefined;
let pageAbort: AbortController | null = null;
let pageCleanups: (() => void)[] = [];

function cleanupPage(): void {
  pageAbort?.abort();
  pageAbort = null;
  for (const fn of pageCleanups) fn();
  pageCleanups = [];
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

function bindPage(): void {
  cleanupPage();
  pageAbort = new AbortController();
  const { signal } = pageAbort;
  const root = document.documentElement;

  // Keep --header-h in sync with the fixed top bar, and retire one-shot CRT ignite once played.
  const siteHeader = document.querySelector<HTMLElement>(".site-header");
  if (siteHeader) {
    const syncHeader = () =>
      root.style.setProperty("--header-h", `${siteHeader.offsetHeight}px`);
    const ro = new ResizeObserver(syncHeader);
    ro.observe(siteHeader);
    pageCleanups.push(() => ro.disconnect());
    syncHeader();

    const lastNavLink = siteHeader.querySelector<HTMLElement>(".navigation a:last-child");
    lastNavLink?.addEventListener(
      "animationend",
      (ev) => {
        if ((ev as AnimationEvent).animationName === "nav-ignite") {
          siteHeader.dataset.ignited = "true";
        }
      },
      { signal },
    );
  }

  // Search dialog
  const dialog = document.querySelector<HTMLDialogElement>("#search-dialog");
  const input = document.querySelector<HTMLInputElement>("#search-input");
  const status = document.querySelector<HTMLElement>("#search-status");
  const results = document.querySelector<HTMLOListElement>("#search-results");
  let lastFocus: HTMLElement | null = null;

  const openSearch = () => {
    if (!dialog || !input || dialog.open) return;
    lastFocus = document.activeElement as HTMLElement;
    dialog.showModal();
    input.focus();
  };

  document
    .querySelectorAll(".search-open")
    .forEach((b) => b.addEventListener("click", openSearch, { signal }));
  document
    .querySelector(".search-close")
    ?.addEventListener("click", () => dialog?.close(), { signal });

  dialog?.addEventListener(
    "click",
    (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    },
    { signal },
  );

  dialog?.addEventListener("close", () => lastFocus?.focus(), { signal });

  document.addEventListener(
    "keydown",
    (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
        return;
      }
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !dialog?.open &&
        !isEditable(event.target)
      ) {
        event.preventDefault();
        openSearch();
        return;
      }
      if (!dialog?.open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.close();
        return;
      }
      const links = Array.from(
        results?.querySelectorAll<HTMLAnchorElement>("a") || [],
      );
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!links.length) return;
        event.preventDefault();
        const index = links.indexOf(document.activeElement as HTMLAnchorElement);
        const next =
          event.key === "ArrowDown"
            ? (index + 1) % links.length
            : index <= 0
              ? links.length - 1
              : index - 1;
        links[next].focus();
      }
      if (
        event.key === "Enter" &&
        document.activeElement === input &&
        links[0]
      ) {
        event.preventDefault();
        links[0].click();
      }
    },
    { signal },
  );

  let sequence = 0;
  let timer: ReturnType<typeof setTimeout>;
  pageCleanups.push(() => clearTimeout(timer));

  input?.addEventListener(
    "input",
    () => {
      clearTimeout(timer);
      const ticket = ++sequence;
      const query = input.value.trim();
      if (!results || !status || !dialog) return;
      results.replaceChildren();
      if (!query) {
        status.textContent = status.dataset.start || "";
        return;
      }
      status.textContent = `⠋ ${status.dataset.loading || ""}`;
      timer = setTimeout(async () => {
        try {
          const base = dialog.dataset.base!;
          engine ||= import(/* @vite-ignore */ `${base}pagefind.js`);
          const search = await (await engine!).search(query);
          const entries = await Promise.all(
            search.results.slice(0, 8).map((r) => r.data()),
          );
          if (ticket !== sequence) return;
          status.textContent = entries.length
            ? `[${String(entries.length).padStart(2, "0")}] ${document.body.dataset.lang === "zh" ? "篇相关文章" : "matches"}`
            : status.dataset.empty || "";
          for (const entry of entries) {
            const li = document.createElement("li");
            const link = document.createElement("a");
            link.href = entry.url;
            const heading = document.createElement("h3");
            heading.textContent = entry.meta.title || "";
            const excerpt = document.createElement("p");
            const parsed = new DOMParser().parseFromString(
              entry.excerpt,
              "text/html",
            );
            const safeAppend = (source: Node, target: Node) => {
              for (const child of source.childNodes) {
                if (child.nodeType === Node.TEXT_NODE)
                  target.appendChild(
                    document.createTextNode(child.textContent || ""),
                  );
                else if (child instanceof Element && child.tagName === "MARK") {
                  const mark = document.createElement("mark");
                  mark.textContent = child.textContent;
                  target.appendChild(mark);
                } else safeAppend(child, target);
              }
            };
            safeAppend(parsed.body, excerpt);
            link.append(heading, excerpt);
            li.append(link);
            results.append(li);
          }
        } catch {
          if (ticket === sequence)
            status.textContent = status.dataset.error || "";
          engine = undefined;
        }
      }, 180);
    },
    { signal },
  );

  // Code copy buttons
  const article = document.querySelector<HTMLElement>("#article-content");
  article?.querySelectorAll("pre").forEach((pre) => {
    if (
      pre.closest("[data-ascii-root], [data-ascii-banner-text], ascii-art") ||
      pre.querySelector(".copy-code")
    )
      return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-code mono";
    button.textContent = article.dataset.copy || "[copy]";
    button.addEventListener(
      "click",
      async () => {
        try {
          await navigator.clipboard.writeText(
            pre.querySelector("code")?.textContent || "",
          );
          button.textContent = article.dataset.copied || "[copied]";
        } catch {
          button.textContent = article.dataset.copyError || "[select manually]";
        }
        setTimeout(
          () => (button.textContent = article.dataset.copy || "[copy]"),
          2000,
        );
      },
      { signal },
    );
    pre.append(button);
  });

  // Reading progress bar & sticky TOC active tracking
  const progress = document.querySelector<HTMLElement>(".reading-progress");
  if (progress && article) {
    let pending = false;
    const update = () => {
      const top = article.getBoundingClientRect().top + window.scrollY;
      const length = Math.max(
        1,
        article.scrollHeight - window.innerHeight * 0.5,
      );
      progress.style.transform = `scaleX(${Math.min(1, Math.max(0, (window.scrollY - top + window.innerHeight * 0.25) / length))})`;
      pending = false;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!pending) {
          pending = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true, signal },
    );
    window.addEventListener("resize", update, { signal });
    update();

    const headings = article.querySelectorAll("h2,h3");
    const tocLinks = document.querySelectorAll<HTMLAnchorElement>(".toc a");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            tocLinks.forEach((link) =>
              link.classList.toggle(
                "active",
                decodeURIComponent(link.hash.slice(1)) === entry.target.id,
              ),
            );
          }
        }
      },
      { rootMargin: "0px 0px -65% 0px" },
    );
    headings.forEach((h) => observer.observe(h));
    pageCleanups.push(() => observer.disconnect());
  }
}

interface PendingHeaderSync {
  navCurrent: (string | null)[];
  langHref: string | null;
  nextHeroOpen: string;
}

let pendingHeaderSync: PendingHeaderSync | null = null;
let headerSyncRaf = 0;

// Carry active theme, completed intro state, and live header transitions across Astro swaps.
document.addEventListener("astro:before-swap", (event) => {
  const swapEvent = event as Event & { newDocument?: Document };
  if (headerSyncRaf) {
    cancelAnimationFrame(headerSyncRaf);
    headerSyncRaf = 0;
  }

  const currentHeader = document.querySelector<HTMLElement>(".site-header");
  if (currentHeader) currentHeader.dataset.ignited = "true";

  if (swapEvent.newDocument) {
    const next = swapEvent.newDocument.documentElement;
    next.dataset.theme = "dark";
    next.dataset.intro = "ready";
    next.classList.add("js");

    const nextHeader = swapEvent.newDocument.querySelector<HTMLElement>(".site-header");
    if (nextHeader) {
      nextHeader.dataset.ignited = "true";
      pendingHeaderSync = {
        navCurrent: Array.from(
          nextHeader.querySelectorAll<HTMLAnchorElement>(".navigation a"),
        ).map((a) => a.getAttribute("aria-current")),
        langHref:
          nextHeader
            .querySelector<HTMLAnchorElement>(".language-switch")
            ?.getAttribute("href") ?? null,
        nextHeroOpen: nextHeader.dataset.heroOpen || "false",
      };
    }
  }
  cleanupPage();
});

document.addEventListener("astro:after-swap", () => {
  const sync = pendingHeaderSync;
  pendingHeaderSync = null;
  const liveHeader = document.querySelector<HTMLElement>(".site-header");
  if (!sync || !liveHeader) return;

  // Commit pre-swap computed styles on the persisted header before flipping data-hero-open.
  void liveHeader.offsetWidth;

  headerSyncRaf = requestAnimationFrame(() => {
    headerSyncRaf = 0;
    const links = liveHeader.querySelectorAll<HTMLAnchorElement>(".navigation a");
    links.forEach((link, i) => {
      const cur = sync.navCurrent[i] ?? null;
      if (cur) link.setAttribute("aria-current", cur);
      else link.removeAttribute("aria-current");
    });
    const langSwitch = liveHeader.querySelector<HTMLAnchorElement>(".language-switch");
    if (langSwitch && sync.langHref) {
      langSwitch.setAttribute("href", sync.langHref);
    }
    // On Home, hero-terminal.ts syncs data-hero-open from real scrollY + minimized state.
    if (!document.querySelector("[data-hero]")) {
      liveHeader.dataset.heroOpen = sync.nextHeroOpen;
    }
  });
});

document.addEventListener("astro:page-load", bindPage);
