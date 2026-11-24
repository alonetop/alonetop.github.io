import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    lang: z.enum(["zh", "en"]),
    tags: z.array(z.string()).default([]),
    translationKey: z.string(),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    demo: z.boolean().default(false),
  }),
});
export const collections = { posts };
