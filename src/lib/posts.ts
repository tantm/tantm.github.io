import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft || import.meta.env.DEV);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function readingTime(body: string | undefined): number {
  const words = (body ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function getPostNeighbors(posts: Post[], current: Post) {
  const sameLang = posts.filter((p) => p.data.lang === current.data.lang);
  const i = sameLang.findIndex((p) => p.id === current.id);
  return {
    // posts sắp xếp mới → cũ: prev = bài cũ hơn, next = bài mới hơn
    older: i >= 0 && i < sameLang.length - 1 ? sameLang[i + 1] : null,
    newer: i > 0 ? sameLang[i - 1] : null,
  };
}

export function getTranslation(posts: Post[], current: Post): Post | null {
  const key = current.data.translationKey;
  if (!key) return null;
  return (
    posts.find((p) => p.data.translationKey === key && p.data.lang !== current.data.lang) ?? null
  );
}

export function getRelatedPosts(posts: Post[], current: Post, limit = 3): Post[] {
  const tagSet = new Set(current.data.tags);
  return posts
    .filter((p) => p.id !== current.id && p.data.lang === current.data.lang)
    .map((p) => {
      const shared = p.data.tags.filter((t) => tagSet.has(t)).length;
      const sameCat = p.data.category === current.data.category ? 1 : 0;
      return { post: p, score: shared * 2 + sameCat };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ post }) => post);
}

export function slugifyTag(tag: string): string {
  return tag
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
