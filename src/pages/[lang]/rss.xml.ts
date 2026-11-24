import rss from "@astrojs/rss";
import { getPosts, postUrl } from "../../lib/posts";
import { languages, profile, type Lang } from "../../lib/site";
import type { APIContext } from "astro";
export function getStaticPaths() {
  return languages.map((lang) => ({ params: { lang } }));
}
export async function GET(context: APIContext) {
  const lang = context.params.lang as Lang;
  return rss({
    title: `${profile.name[lang]} · ${lang === "zh" ? "随记" : "Blogs, quietly."}`,
    description: profile.bio[lang],
    site: context.site!,
    items: (await getPosts(lang)).map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.date,
      link: postUrl(p),
    })),
    customData: `<language>${lang === "zh" ? "zh-CN" : "en"}</language>`,
  });
}
