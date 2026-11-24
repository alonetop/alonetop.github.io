import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
const site = process.env.SITE_URL || "https://example.com";
const base = process.env.BASE_PATH || "/";
export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "always",
  integrations: [sitemap({ filter: (page) => !page.endsWith("/404/") })],
  markdown: {
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" } },
  },
});
