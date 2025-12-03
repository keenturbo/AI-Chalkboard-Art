// 定义生成请求的结构
export interface GenerateRequest {
  character_name: string;
  style?: string; // 默认为 'blackboard'
}

// 定义生成结果的结构
export interface GenerateResult {
  image_url: string;
  prompt_used: string;
}

// 定义AI模型适配器接口 (所有新模型都要实现这个接口)
export interface AIModelAdapter {
  generateImage(prompt: string): Promise<ArrayBuffer>;
}

// 环境变量定义 (Cloudflare 后台配置)
export interface Env {
  GEMINI_API_KEY: string;
  R2_BUCKET: R2Bucket; // 绑定的 R2 存储桶
  AI_MODEL_NAME: string; // 必需：AI 模型名称 (如 gemini-3-pro-image-preview)
  AI_MODEL_URL?: string; // 可选：自定义模型端点，默认使用 Google 官方 URL
  R2_PUBLIC_DOMAIN?: string; // 可选：R2公共访问域名，支持自定义域名
  ADMIN_KV: KVNamespace; // 新增：管理配置存储
}

// KeyManager 支持
export interface ApiKeyManager {
  keys: string[];
  currentIndex: number;
  getNextKey(): string;
}

// 新增：API配置接口
export interface ApiConfig {
  name: string;
  url: string;
  key: string;
  model: string;
  enabled: boolean;
}

// 新增：提示词配置接口
export interface PromptConfig {
  name: string;
  prompt: string;
}

// 新增：管理员凭证接口
export interface AdminCredentials {
  username: string;
  password: string;
}

// 新增：完整配置接口
export interface AdminConfig {
  gallery_images: string[];
  api_configs: ApiConfig[];
  prompts: PromptConfig[];
  admin_credentials: AdminCredentials;
}