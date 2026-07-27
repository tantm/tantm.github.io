import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) => z.object({
    // Ảnh cover hiển thị trên card (tuỳ chọn) — đường dẫn tương đối tới file trong images/
    cover: image().optional(),
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: z.string().default('Developer'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    lang: z.enum(['en', 'vi']).default('en'),
    translationKey: z.string().optional(),
    // Series (khoá học mini): slug trong SERIES_META + số thứ tự bài (1-based)
    series: z.string().optional(),
    part: z.number().int().positive().optional(),
  }),
});

export const collections = { blog };
