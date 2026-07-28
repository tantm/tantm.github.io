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
    icon: 'data',
    description: {
      en: 'Data platforms, lakehouse, pipelines, streaming & governance.',
      vi: 'Data platform, lakehouse, pipeline, streaming & governance.',
    },
  },
  {
    name: 'AI',
    slug: 'ai',
    icon: 'ai',
    description: {
      en: 'GenAI, agentic systems, RAG, MLOps & evaluation.',
      vi: 'GenAI, hệ thống agentic, RAG, MLOps & evaluation.',
    },
  },
  {
    name: 'Architecture',
    slug: 'architecture',
    icon: 'architecture',
    description: {
      en: 'System design patterns and trade-offs from real delivery.',
      vi: 'Pattern thiết kế hệ thống và trade-off từ dự án thật.',
    },
  },
  {
    name: 'Developer',
    slug: 'developer',
    icon: 'developer',
    description: {
      en: 'Tooling, workflows and productivity — including AI-assisted development.',
      vi: 'Tooling, workflow và năng suất — gồm cả lập trình với AI.',
    },
  },
  {
    name: 'Cloud',
    slug: 'cloud',
    icon: 'cloud',
    description: {
      en: 'AWS and cloud engineering — services, IaC, security and cost.',
      vi: 'AWS và cloud engineering — services, IaC, security và cost.',
    },
  },
  {
    name: 'DevOps',
    slug: 'devops',
    icon: 'devops',
    description: {
      en: 'Containers, Kubernetes, Terraform, CI/CD — shipping and running software reliably.',
      vi: 'Container, Kubernetes, Terraform, CI/CD — ship và vận hành phần mềm tin cậy.',
    },
  },
];

export const CATEGORIES = CATEGORY_META.map((c) => c.name);

// Series — các chuỗi bài dạng khoá học có lộ trình (bài 1→n).
// Bài viết gắn vào series qua frontmatter `series: <slug>` + `part: <n>`.
export interface SeriesMeta {
  slug: string;
  name: { en: string; vi: string };
  icon: string;
  category: string;
  plannedParts: number;
  description: { en: string; vi: string };
  /* Title dự kiến từng phần (1-based) — phần chưa publish hiện "coming soon" trên trang series */
  parts: { en: string; vi: string }[];
}

export const SERIES_META: SeriesMeta[] = [
  {
    slug: 'cs-foundations',
    name: {
      en: 'CS Foundations',
      vi: 'CS Foundations — 4 năm đại học CNTT chắt lọc',
    },
    icon: 'grad',
    category: 'Developer',
    plannedParts: 12,
    description: {
      en: 'A 4-year IT degree distilled: the computer science fundamentals you will keep using for the rest of your career.',
      vi: 'Chắt lọc 4 năm đại học CNTT: những nền tảng computer science bạn sẽ dùng suốt sự nghiệp.',
    },
    parts: [
      { en: 'The 4-Year IT Degree, Distilled into One Map', vi: '4 năm đại học CNTT chắt lọc trong một bản đồ' },
      { en: 'How Computers Actually Run Your Code', vi: 'Máy tính thực sự chạy code của bạn như thế nào' },
      { en: "Data Structures You'll Use for the Rest of Your Career", vi: 'Data structures dùng cả sự nghiệp' },
      { en: 'Big-O Is a Way of Thinking, Not an Interview Trick', vi: 'Big-O là tư duy, không phải mẹo phỏng vấn' },
      { en: 'The OS Concepts Behind Every Production Incident', vi: 'Kiến thức OS đứng sau mọi sự cố production' },
      { en: 'What Happens When You Hit Enter on a URL', vi: 'Chuyện gì xảy ra khi bạn gõ một URL' },
      { en: 'Databases: The 20% That Powers 80% of Your Work', vi: 'Database: 20% kiến thức gánh 80% công việc' },
      { en: 'Concurrency Without Tears', vi: 'Concurrency không nước mắt' },
      { en: 'Git, Testing, Code Review — the Real Job Skills', vi: 'Git, testing, code review — kỹ năng đi làm thật' },
      { en: 'Design Patterns & Abstractions: When to Use, When to Skip', vi: 'Design patterns & abstraction: khi nào dùng, khi nào bỏ' },
      { en: 'Security Basics Every Developer Ships With', vi: 'Security cơ bản mọi developer phải có' },
      { en: 'From School Project to Production System', vi: 'Từ đồ án đến hệ thống production' },
    ],
  },
  {
    slug: 'de-roadmap',
    name: {
      en: 'Data Engineer Roadmap',
      vi: 'Lộ trình Data Engineer',
    },
    icon: 'route',
    category: 'Data',
    plannedParts: 14,
    description: {
      en: 'From junior to senior in four stages: SQL & modeling, batch pipelines, streaming at scale, and senior craft.',
      vi: 'Từ junior đến senior qua 4 giai đoạn: SQL & modeling, batch pipeline, streaming ở quy mô lớn, và tư duy senior.',
    },
    parts: [
      { en: 'The Data Engineer Roadmap: Junior to Senior', vi: 'Lộ trình Data Engineer: từ Junior đến Senior' },
      { en: 'SQL for Data Engineers: Beyond SELECT', vi: 'SQL cho Data Engineer: vượt khỏi SELECT' },
      { en: 'Python for Data Engineers: the Working Toolkit', vi: 'Python cho Data Engineer: bộ đồ nghề thực chiến' },
      { en: 'Data Modeling: OLTP vs OLAP, Star Schema', vi: 'Data modeling: OLTP vs OLAP, star schema' },
      { en: 'Data Warehouse & the Medallion Architecture', vi: 'Data warehouse & kiến trúc medallion' },
      { en: 'ETL vs ELT: Building Reliable Batch Pipelines', vi: 'ETL vs ELT: xây batch pipeline đáng tin' },
      { en: "Apache Spark: When Pandas Isn't Enough", vi: 'Apache Spark: khi pandas không còn đủ' },
      { en: 'Orchestration with Airflow: DAGs Done Right', vi: 'Orchestration với Airflow: viết DAG tử tế' },
      { en: 'Data Lake & Lakehouse: Parquet, Iceberg, Delta', vi: 'Data lake & lakehouse: Parquet, Iceberg, Delta' },
      { en: 'Streaming Foundations with Kafka', vi: 'Nền tảng streaming với Kafka' },
      { en: 'Stream Processing: Flink & Friends', vi: 'Stream processing: Flink và bạn bè' },
      { en: 'Data Quality & Testing: Trust Your Pipelines', vi: 'Data quality & testing: tin được pipeline của mình' },
      { en: 'Governance, Catalog & Infra for Data Teams', vi: 'Governance, catalog & hạ tầng cho data team' },
      { en: 'Thinking Like a Senior Data Engineer', vi: 'Tư duy như một Senior Data Engineer' },
    ],
  },
  {
    slug: 'ai-roadmap',
    name: {
      en: 'AI Engineer Roadmap',
      vi: 'Lộ trình AI Engineer',
    },
    icon: 'compass',
    category: 'AI',
    plannedParts: 14,
    description: {
      en: 'From software engineer to production AI builder: just-enough theory, then LLM engineering — RAG, agents, evals, LLMOps.',
      vi: 'Từ software engineer đến người xây AI production: lý thuyết vừa đủ, rồi LLM engineering — RAG, agents, evals, LLMOps.',
    },
    parts: [
      { en: 'The AI Engineer Roadmap', vi: 'Lộ trình trở thành AI Engineer' },
      { en: 'The Minimum Math That Actually Matters', vi: 'Lượng toán tối thiểu thực sự cần' },
      { en: 'Python ML Stack: numpy → scikit-learn', vi: 'Python ML stack: numpy → scikit-learn' },
      { en: "ML Fundamentals: Learn, Evaluate, Don't Overfit", vi: 'ML fundamentals: học, đánh giá, đừng overfit' },
      { en: 'Deep Learning with PyTorch, Practically', vi: 'Deep learning với PyTorch, thực dụng' },
      { en: 'Transformers & Attention, Demystified', vi: 'Transformer & attention, giải ảo' },
      { en: 'How LLMs Work: Tokens, Context, Sampling', vi: 'LLM hoạt động thế nào: token, context, sampling' },
      { en: 'Prompt Engineering as an Engineering Discipline', vi: 'Prompt engineering như một kỷ luật kỹ thuật' },
      { en: 'RAG: Retrieval-Augmented Generation Done Right', vi: 'RAG: làm Retrieval-Augmented Generation tử tế' },
      { en: 'AI Agents: Tool Use, Planning, Orchestration', vi: 'AI Agents: tool use, planning, orchestration' },
      { en: "Fine-tuning & LoRA: When Prompting Isn't Enough", vi: 'Fine-tuning & LoRA: khi prompt không còn đủ' },
      { en: 'Evals & Observability for LLM Apps', vi: 'Evals & observability cho LLM apps' },
      { en: 'LLMOps: Serving, Cost & Latency', vi: 'LLMOps: serving, cost & latency' },
      { en: 'Senior AI Engineer: Architecture, Security, Responsibility', vi: 'Senior AI Engineer: kiến trúc, security, trách nhiệm' },
    ],
  },
  {
    slug: 'aws-zero-to-advanced',
    name: {
      en: 'AWS from Zero to Advanced',
      vi: 'AWS từ cơ bản đến nâng cao',
    },
    icon: 'cloud',
    category: 'Cloud',
    plannedParts: 16,
    description: {
      en: '200+ services, four tiers, one path: the twenty AWS services that matter, learned in the order that compounds.',
      vi: '200+ services, 4 tier, 1 lộ trình: 20 AWS services đáng học, theo thứ tự bồi đắp lẫn nhau.',
    },
    parts: [
      { en: 'The AWS Map: 200 Services, 20 That Matter', vi: 'Bản đồ AWS: 200 services, 20 cái đáng học' },
      { en: 'IAM: Identity Is the New Perimeter', vi: 'IAM: identity là vành đai bảo mật mới' },
      { en: 'EC2 Fundamentals: Your First Server', vi: 'EC2 căn bản: server đầu tiên của bạn' },
      { en: 'S3 Deep Dive: More Than File Storage', vi: 'S3 chuyên sâu: hơn cả chỗ chứa file' },
      { en: 'VPC Networking Without the Headache', vi: 'VPC networking không đau đầu' },
      { en: 'RDS, Aurora & DynamoDB: Picking a Database', vi: 'RDS, Aurora & DynamoDB: chọn database' },
      { en: 'Lambda & API Gateway: Serverless in Practice', vi: 'Lambda & API Gateway: serverless thực chiến' },
      { en: 'ECS, Fargate & ECR: Containers on AWS', vi: 'ECS, Fargate & ECR: chạy container trên AWS' },
      { en: 'SQS, SNS & EventBridge: Decoupling Systems', vi: 'SQS, SNS & EventBridge: tách rời hệ thống' },
      { en: 'CloudWatch & X-Ray: See Your System', vi: 'CloudWatch & X-Ray: nhìn thấy hệ thống của bạn' },
      { en: 'Infrastructure as Code: Terraform on AWS', vi: 'Infrastructure as Code: Terraform trên AWS' },
      { en: 'AWS Security Beyond IAM: KMS, Secrets, Guardrails', vi: 'AWS security vượt khỏi IAM: KMS, Secrets, guardrails' },
      { en: 'AWS for Data: Glue, Athena, Kinesis, Redshift', vi: 'AWS cho Data: Glue, Athena, Kinesis, Redshift' },
      { en: 'AWS for AI: Bedrock & SageMaker', vi: 'AWS cho AI: Bedrock & SageMaker' },
      { en: 'Well-Architected: Designing Real Systems', vi: 'Well-Architected: thiết kế hệ thống thật' },
      { en: 'AWS Cost Optimization & the Cert Path', vi: 'Tối ưu chi phí AWS & lộ trình cert' },
    ],
  },
  {
    slug: 'dp-architectures',
    name: {
      en: 'Data Platform Architectures',
      vi: 'Các kiến trúc Data Platform',
    },
    icon: 'architecture',
    category: 'Architecture',
    plannedParts: 14,
    description: {
      en: 'Warehouse, lakehouse, streaming, mesh, small data, multi-tenant — every major data platform architecture, and how to choose for your constraints.',
      vi: 'Warehouse, lakehouse, streaming, mesh, small data, multi-tenant — các trường phái kiến trúc data platform lớn, và cách chọn theo ràng buộc của bạn.',
    },
    parts: [
      { en: 'The Data Platform Architecture Map', vi: 'Bản đồ các kiến trúc Data Platform' },
      { en: 'The Classic Data Warehouse, Still Undefeated', vi: 'Data Warehouse cổ điển, vẫn chưa bị hạ bệ' },
      { en: 'Lake, Warehouse, Lakehouse: the Convergence', vi: 'Lake, Warehouse, Lakehouse: cuộc hội tụ' },
      { en: 'Lambda vs Kappa: Batch & Streaming Architectures', vi: 'Lambda vs Kappa: kiến trúc batch & streaming' },
      { en: 'Real-time Analytics: the OLAP Serving Layer', vi: 'Real-time analytics: tầng OLAP serving' },
      { en: 'Event-Driven Data: CDC & the Outbox', vi: 'Data hướng sự kiện: CDC & Outbox' },
      { en: 'Data Mesh: Promise, Price, Reality', vi: 'Data Mesh: lời hứa, cái giá, thực tế' },
      { en: 'The Small Data Architecture (Most Companies Are Small Data)', vi: 'Kiến trúc Small Data (đa số công ty là small data)' },
      { en: 'Multi-tenant Analytics: One Platform, Many Customers', vi: 'Analytics multi-tenant: một platform, nhiều khách hàng' },
      { en: 'Data Platforms in Regulated Industries', vi: 'Data platform trong ngành có kiểm soát' },
      { en: 'The AI-Ready Data Platform', vi: 'Data platform sẵn sàng cho AI' },
      { en: 'Architecting for Cost: FinOps Patterns', vi: 'Thiết kế theo chi phí: pattern FinOps' },
      { en: 'Migration Architectures: Legacy to Modern Without Falling', vi: 'Kiến trúc migration: từ legacy sang modern không ngã' },
      { en: 'Choosing Your Architecture: a Decision Framework', vi: 'Chọn kiến trúc: một decision framework' },
    ],
  },
  {
    slug: 'docker-k8s',
    name: {
      en: 'Docker & Kubernetes',
      vi: 'Docker & Kubernetes: từ container đến orchestration',
    },
    icon: 'devops',
    category: 'DevOps',
    plannedParts: 12,
    description: {
      en: 'Hands-on containers course: from the container mental model to Kubernetes, deploy patterns and production choices.',
      vi: 'Khoá thực hành container: từ mental model tới Kubernetes, pattern deploy và lựa chọn production.',
    },
    parts: [
      { en: 'Containers: Why, What, and the Road Ahead', vi: 'Container: vì sao, là gì, và lộ trình phía trước' },
      { en: 'A Container Is Just a Process', vi: 'Container chỉ là một process' },
      { en: "Building Images That Don't Embarrass You", vi: 'Build image không xấu hổ' },
      { en: 'Docker Compose: Your Local Environment as Code', vi: 'Docker Compose: môi trường local thành code' },
      { en: 'Registries, Tags & Container Best Practices', vi: 'Registry, tag & best practices' },
      { en: 'Why You Need an Orchestrator', vi: 'Vì sao cần một orchestrator' },
      { en: 'Kubernetes Core: Pod, Deployment, Service', vi: 'Kubernetes core: Pod, Deployment, Service' },
      { en: 'Config, Secrets & How Traffic Finds Your Pod', vi: 'Config, Secrets & traffic tìm Pod thế nào' },
      { en: 'State, Storage & Batch Jobs on K8s', vi: 'State, storage & batch job trên K8s' },
      { en: 'Deploy Patterns: Rolling, Blue-Green, Canary', vi: 'Pattern deploy: rolling, blue-green, canary' },
      { en: 'Managed Kubernetes & the ECS Question', vi: 'Managed Kubernetes & câu hỏi ECS' },
      { en: 'CI/CD, Security & Thinking in Containers', vi: 'CI/CD, security & tư duy container' },
    ],
  },
  {
    slug: 'terraform-iac',
    name: {
      en: 'Terraform & IaC in Practice',
      vi: 'Terraform & IaC thực chiến',
    },
    icon: 'stack',
    category: 'DevOps',
    plannedParts: 12,
    description: {
      en: 'A full Terraform course through the real life of a team: state, modules, environments, CI/CD, drift and policy.',
      vi: 'Khoá Terraform đầy đủ theo vòng đời thật của team: state, module, môi trường, CI/CD, drift và policy.',
    },
    parts: [
      { en: 'IaC & Terraform: The Mental Model', vi: 'IaC & Terraform: mental model' },
      { en: 'Your First Resources, Line by Line', vi: 'Những resource đầu tiên, từng dòng' },
      { en: "State: Terraform's Memory, Deep Dive", vi: 'State: bộ nhớ của Terraform, đào sâu' },
      { en: 'Reading Plans & Resource Lifecycle', vi: 'Đọc plan & vòng đời resource' },
      { en: 'Remote State & Working as a Team', vi: 'Remote state & làm việc theo team' },
      { en: 'Variables, Outputs & Multi-Environment', vi: 'Variables, outputs & đa môi trường' },
      { en: 'Modules: Abstraction Done Right', vi: 'Module: abstraction đúng cách' },
      { en: 'The PR Workflow: Plan as Review Artifact', vi: 'Workflow PR: plan là artifact review' },
      { en: 'CI/CD for Infrastructure', vi: 'CI/CD cho hạ tầng' },
      { en: 'Importing Legacy & Fighting Drift', vi: 'Import đồ cũ & chống drift' },
      { en: 'Testing, Policy & Guardrails for IaC', vi: 'Testing, policy & guardrails cho IaC' },
      { en: 'IaC Patterns, CDK/Pulumi & the Finale', vi: 'Pattern IaC, CDK/Pulumi & hồi kết' },
    ],
  },
];

export function getSeriesMeta(slug: string): SeriesMeta | undefined {
  return SERIES_META.find((s) => s.slug === slug);
}

// AdSense: điền client id (vd 'ca-pub-xxxxxxxx') để bật quảng cáo; để rỗng = tắt
export const ADSENSE_CLIENT = '';
