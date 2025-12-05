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

// 新增：第三方API接口
export interface ThirdPartyAPI {
  id: string;
  name: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'grok' | 'other';
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  priority: number;
  lastUsed?: number;
  errorCount: number;
  errorHistory: Array<{
    timestamp: number;
    error: string;
    statusCode?: number;
  }>;
  disabled?: boolean;
  disabledUntil?: number;
  responseTime?: number;
}

// 新增：生成结果结构
export interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  imageBuffer?: ArrayBuffer;
  provider?: string;
  error?: string;
  debug?: any;
  duration?: number;
  attempts?: number;
  trace?: Trace;
}

// 新增：API状态追踪
export type Trace = Array<{
  api: string;
  provider: string;
  status: 'success' | 'failed' | 'timeout' | 'rate_limited';
  duration: number;
  error?: string;
  details?: any;
  statusCode?: number;
  timestamp?: number;
}>;

// 新增：提示词配置接口
export interface PromptConfig {
  key: string; // 唯一标识, 用于匹配
  name: string; // 显示名称
  prompt: string; // 完整提示词内容或简单类型
}

// 新增：管理员凭证接口
export interface AdminCredentials {
  username: string;
  password: string;
}

// 新增：完整配置接口
export interface AdminConfig {
  gallery_images: string[];
  api_configs: ApiConfig[]; // 保持向后兼容
  prompts: PromptConfig[];
  admin_credentials: AdminCredentials;
}

// 新增：API测试结果
export interface APITestResult {
  success: boolean;
  message: string;
  responseTime?: number;
  details?: any;
}

// 新增：系统健康状态
export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  apis: ThirdPartyAPI[];
  summary: {
    total: number;
    enabled: number;
    disabled: number;
    errors: number;
    rateLimit: number;
  };
}

// 新增：API错误类型
export interface APIError extends Error {
  statusCode?: number;
  provider?: string;
  apiName?: string;
  isRateLimit?: boolean;
  isTimeout?: boolean;
  retryAfter?: number;
}

// 新增：配置选项
export interface ConfigOptions {
  excludeKeys?: string[];
  trace?: Trace;
  signal?: AbortSignal;
  timeout?: number;
  retries?: number;
}