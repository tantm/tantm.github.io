// i18n toàn site: EN (mặc định, không prefix) + VI (prefix /vi)
export type Lang = 'en' | 'vi';

export const LANGS: Lang[] = ['en', 'vi'];

/** /blog → /vi/blog (vi) | /blog (en) */
export function localePath(lang: Lang, path: string): string {
  if (lang === 'en') return path;
  return path === '/' ? '/vi/' : `/vi${path}`;
}

/** Đường dẫn tương ứng ở ngôn ngữ còn lại (cho switcher EN↔VI) */
export function switchPath(lang: Lang, pathname: string): string {
  if (lang === 'en') return pathname === '/' ? '/vi/' : `/vi${pathname}`;
  const stripped = pathname.replace(/^\/vi\/?/, '/');
  return stripped === '' ? '/' : stripped;
}

const ui = {
  en: {
    'nav.blog': 'Blog',
    'nav.categories': 'Categories',
    'nav.profile': 'Profile',
    'nav.search': 'Search',
    'footer.tagline': 'practical, experience-driven, always anonymized.',
    'footer.topics': 'Topics',
    'footer.links': 'Links',
    'footer.about': 'About me',
    'footer.rss': 'RSS feed',
    'footer.rights': 'All opinions are my own.',
    'footer.built': 'Built with',
    'footer.hosted': 'Hosted on GitHub Pages',
    'home.role': 'Data & AI Platform Lead',
    'home.desc':
      'I build data platforms and AI systems for a living, and write down what survives contact with production — data engineering, GenAI/agents, architecture and developer tooling. Practical notes, always anonymized.',
    'home.readBlog': 'Read the blog',
    'home.aboutMe': 'About me',
    'home.topics': 'Topics',
    'home.allCategories': 'All categories →',
    'home.latest': 'Latest posts',
    'home.allPosts': 'All posts →',
    'blog.title': 'Blog',
    'blog.desc': 'All posts — data engineering, AI, architecture and developer notes.',
    'blog.counting': 'and counting. Filter by topic or',
    'blog.search': 'search',
    'blog.all': 'All',
    'blog.langAll': 'EN + VI',
    'blog.langEn': 'English',
    'blog.langVi': 'Tiếng Việt',
    'blog.featured': 'Latest post',
    'pag.newer': '← Newer',
    'pag.older': 'Older →',
    'pag.page': 'Page',
    'cats.title': 'Categories',
    'cats.desc': 'Browse posts by topic — Data, AI, Architecture, Developer.',
    'cats.sub': 'Everything on this site, grouped by topic.',
    'cat.allCategories': 'all categories',
    'tag.allPosts': 'all posts',
    'n.post': 'post',
    'n.posts': 'posts',
    'post.minRead': 'min read',
    'post.updated': 'updated',
    'post.onThisPage': 'On this page',
    'post.older': '← Older',
    'post.newer': 'Newer →',
    'post.related': 'Related posts',
    'post.authorBlurb': 'building data platforms & AI systems, writing down what works.',
    'post.moreAbout': 'More about me →',
    'search.title': 'Search',
    'search.desc': 'Full-text search across all posts.',
    'search.sub': 'Search every post on this site.',
    'search.fallback':
      'Search index is only available on the built site (<code>make build && make preview</code>).',
  },
  vi: {
    'nav.blog': 'Blog',
    'nav.categories': 'Chủ đề',
    'nav.profile': 'Hồ sơ',
    'nav.search': 'Tìm kiếm',
    'footer.tagline': 'thực chiến, đúc kết từ kinh nghiệm, luôn ẩn danh.',
    'footer.topics': 'Chủ đề',
    'footer.links': 'Liên kết',
    'footer.about': 'Về mình',
    'footer.rss': 'RSS feed',
    'footer.rights': 'Mọi quan điểm là của cá nhân mình.',
    'footer.built': 'Xây bằng',
    'footer.hosted': 'Host trên GitHub Pages',
    'home.role': 'Data & AI Platform Lead',
    'home.desc':
      'Mình xây data platform và hệ thống AI, rồi ghi lại những gì trụ được khi va chạm production — data engineering, GenAI/agents, kiến trúc và developer tooling. Ghi chú thực chiến, luôn ẩn danh.',
    'home.readBlog': 'Đọc blog',
    'home.aboutMe': 'Về mình',
    'home.topics': 'Chủ đề',
    'home.allCategories': 'Tất cả chủ đề →',
    'home.latest': 'Bài mới nhất',
    'home.allPosts': 'Tất cả bài viết →',
    'blog.title': 'Blog',
    'blog.desc': 'Tất cả bài viết — data engineering, AI, kiến trúc và ghi chú developer.',
    'blog.counting': 'bài và đang tăng. Lọc theo chủ đề hoặc',
    'blog.search': 'tìm kiếm',
    'blog.all': 'Tất cả',
    'blog.langAll': 'EN + VI',
    'blog.langEn': 'English',
    'blog.langVi': 'Tiếng Việt',
    'blog.featured': 'Bài mới nhất',
    'pag.newer': '← Mới hơn',
    'pag.older': 'Cũ hơn →',
    'pag.page': 'Trang',
    'cats.title': 'Chủ đề',
    'cats.desc': 'Duyệt bài viết theo chủ đề — Data, AI, Architecture, Developer.',
    'cats.sub': 'Toàn bộ nội dung trên site, nhóm theo chủ đề.',
    'cat.allCategories': 'tất cả chủ đề',
    'tag.allPosts': 'tất cả bài viết',
    'n.post': 'bài viết',
    'n.posts': 'bài viết',
    'post.minRead': 'phút đọc',
    'post.updated': 'cập nhật',
    'post.onThisPage': 'Trong bài này',
    'post.older': '← Bài cũ hơn',
    'post.newer': 'Bài mới hơn →',
    'post.related': 'Bài liên quan',
    'post.authorBlurb': 'xây data platform & hệ thống AI, ghi lại những gì hiệu quả.',
    'post.moreAbout': 'Thêm về mình →',
    'search.title': 'Tìm kiếm',
    'search.desc': 'Tìm kiếm toàn văn trên mọi bài viết.',
    'search.sub': 'Tìm trong tất cả bài viết của site.',
    'search.fallback':
      'Chỉ tìm được trên bản build (<code>make build && make preview</code>).',
  },
} as const;

export type UiKey = keyof (typeof ui)['en'];

export function useT(lang: Lang) {
  return (key: UiKey): string => ui[lang][key];
}

/** "3 posts" / "3 bài viết" */
export function postCount(lang: Lang, n: number): string {
  if (lang === 'vi') return `${n} bài viết`;
  return `${n} post${n !== 1 ? 's' : ''}`;
}
