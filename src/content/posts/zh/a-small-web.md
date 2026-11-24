---
title: "小而美的网页，也是一种选择"
description: "用静态页面、原生交互和一点耐心，做一个能够长久陪伴自己的站点。"
date: "2026-08-16"
lang: "zh"
tags: ["技术", "设计"]
translationKey: "a-small-web"
featured: false
demo: true
draft: false
---

## 从真正需要的东西开始

一个个人网站需要多少技术？答案取决于你想用它做什么。如果只是发布文章、展示作品和介绍自己，静态页面往往就已经足够。

静态并不等于缺少表达。浏览器本身提供了丰富的排版、动画与交互能力。把这些基础能力用好，比不断叠加工具更值得花时间。

## 内容先抵达

理想情况下，读者打开页面就能看到文字，不需要等一整个应用准备就绪。标题、段落、导航应该存在于最初返回的 HTML 中。

增强功能再在需要时加载。例如搜索只在打开搜索框时加载索引，背景在不进入视野时暂停绘制。这些选择共同组成一个更轻盈的体验。

### 一个小小的例子

原生的 `IntersectionObserver` 就可以帮助我们知道一个元素是否进入视野：

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

这里的重点不是这几行代码，而是一个习惯：先理解浏览器已经能做什么，再决定还需要引入什么。

## 为将来的自己省一点力气

网站最终需要长期维护。依赖越多，更新与排错的成本通常也越高。把内容留在普通的 Markdown 文件中，把个人信息集中在一个配置文件里，就能减少许多重复劳动。

### 做到足够，也做到可靠

检查一次手机上的换行，修好一个失效链接，给按钮补上清楚的名称。这些小事不如新技术耀眼，却能真实地改善体验。

## 留下继续生长的余地

小而美不是拒绝复杂，而是在复杂到来之前，不提前背上它。先让网站成为一个愿意常常回来的地方，然后随着真正的需要一起生长。
