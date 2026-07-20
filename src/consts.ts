export const SITE_URL = 'https://tantm.github.io';
export const SITE_TITLE = 'Tan Thai';
export const SITE_TAGLINE = 'Notes on Data, AI & Software Engineering';
export const SITE_DESCRIPTION =
  'Personal blog of Thái Minh Tân — Data & AI Platform Lead. Notes and lessons on data engineering, AI/agentic systems, software architecture and modern tooling.';
export const AUTHOR = 'Thái Minh Tân';
export const AUTHOR_TITLE = 'Data & AI Platform Lead';
export const GITHUB_URL = 'https://github.com/tantm';
export const AVATAR = '/images/tan-thai.jpg';

// Category chính của blog — thêm chủ đề mới ở đây (trang /categories + topics tự cập nhật)
export interface CategoryMeta {
  name: string;
  slug: string;
  icon: string;
  description: { en: string; vi: string };
}

export const CATEGORY_META: CategoryMeta[] = [
  {
    name: 'Data',
    slug: 'data',
    icon: '🗄️',
    description: {
      en: 'Data platforms, lakehouse, pipelines, streaming & governance.',
      vi: 'Data platform, lakehouse, pipeline, streaming & governance.',
    },
  },
  {
    name: 'AI',
    slug: 'ai',
    icon: '🤖',
    description: {
      en: 'GenAI, agentic systems, RAG, MLOps & evaluation.',
      vi: 'GenAI, hệ thống agentic, RAG, MLOps & evaluation.',
    },
  },
  {
    name: 'Architecture',
    slug: 'architecture',
    icon: '📐',
    description: {
      en: 'System design patterns and trade-offs from real delivery.',
      vi: 'Pattern thiết kế hệ thống và trade-off từ dự án thật.',
    },
  },
  {
    name: 'Developer',
    slug: 'developer',
    icon: '⚡',
    description: {
      en: 'Tooling, workflows and productivity — including AI-assisted development.',
      vi: 'Tooling, workflow và năng suất — gồm cả lập trình với AI.',
    },
  },
];

export const CATEGORIES = CATEGORY_META.map((c) => c.name);

// AdSense: điền client id (vd 'ca-pub-xxxxxxxx') để bật quảng cáo; để rỗng = tắt
export const ADSENSE_CLIENT = '';
