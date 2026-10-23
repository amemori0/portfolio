import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://amemori-portfolio.pages.dev",
  trailingSlash: "always",
  build: { format: "directory" },
});
