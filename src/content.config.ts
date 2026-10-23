import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const works = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/works" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      status: z.enum(["published", "in-progress"]),
      summary: z.string(),
      role: z.string(),
      tech: z.array(z.string()).min(1),
      order: z.number().int(),
      links: z
        .object({
          demo: z.url().optional(),
          repo: z.url().optional(),
        })
        .default({}),
      images: z.object({
        desktop: image(),
        mobile: image(),
      }),
    }),
});

export const collections = { works };
