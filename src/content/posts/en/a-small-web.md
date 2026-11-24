---
title: "The case for a smaller web"
description: "Static pages, native interactions, and a little patience: building a website that can stay with you."
date: "2026-08-16"
lang: "en"
tags: ["Technology", "Design"]
translationKey: "a-small-web"
featured: false
demo: true
draft: false
---

## Start with what is needed

How much technology does a personal website need? That depends on what it is for. If the task is publishing essays, sharing projects, and introducing yourself, static pages can go a long way.

Static does not mean inexpressive. Browsers already offer rich tools for typography, animation, and interaction. Learning to use those foundations is often a better investment than adding another layer.

## Let the content arrive first

A reader should be able to see the writing as soon as a page arrives. Headings, paragraphs, and navigation belong in the initial HTML, without waiting for an entire application to start.

Enhancements can load when needed. Search can fetch its index when someone opens it. A background can stop drawing when it leaves the viewport. Together, these small choices make a lighter experience.

### A small example

The native `IntersectionObserver` can tell us when an element enters the viewport:

```js
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    entry.target.classList.toggle("in-view", entry.isIntersecting);
  }
});

for (const element of document.querySelectorAll(".note")) {
  observer.observe(element);
}
```

The point is not the few lines of code. It is the habit behind them: understand what the browser already does before deciding what else to bring in.

## Leave less work for your future self

A website needs to be maintained over time. More dependencies usually mean more updates and more opportunities for confusion. Plain Markdown files and a single profile configuration remove a surprising amount of repeated effort.

### Enough, and dependable

Check the line breaks on a phone. Fix a broken link. Give a button a clear name. These tasks may be less exciting than a new tool, but they improve the experience in ways people actually feel.

## Keep room for growth

A smaller web is not a refusal of complexity. It is a choice not to carry complexity before it is needed. Make a place you enjoy returning to, then let it grow alongside real needs.
