import { getCollection, type CollectionEntry } from "astro:content";
import { localeUrl, type Lang } from "./site";
export type Post = CollectionEntry<"posts">;
export async function getPosts(lang?: Lang) {
  const posts = await getCollection(
    "posts",
    ({ data }) => !data.draft && (!lang || data.lang === lang),
  );
  return posts.sort(
    (a, b) =>
      b.data.date.valueOf() - a.data.date.valueOf() || a.id.localeCompare(b.id),
  );
}
export function slug(post: Post) {
  return post.id.split("/").slice(1).join("/");
}
export function postUrl(post: Post) {
  return localeUrl(post.data.lang, `posts/${slug(post)}/`);
}
export function tagUrl(lang: Lang, tag: string) {
  return localeUrl(lang, `tags/${encodeURIComponent(tag)}/`);
}
export function formatDate(date: Date, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
export function readingTime(post: Post) {
  const text = post.body || "";
  const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = text
    .replace(/[\u4e00-\u9fff]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(chinese / 350 + words / 220));
}
