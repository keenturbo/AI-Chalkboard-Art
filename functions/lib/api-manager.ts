/**
 * API 配置管理器 - 支持多API提供商和自动切换
 * 支持：Gemini API、Grok API以及其他第三方API
 */
import { Env } from '../types';

// API提供商接口
export interface APIProvider {
  id: string;           // 唯一标识
  name: string;         // 显示名称 (如 "Gemini", "Grok")
  provider: string;     // 提供商类型 ("gemini", "grok", "custom")
  type: "env" | "config"; // 配置类型：环境变量或管理后台配置
  key: string;          // API密钥
  baseUrl?: string;     // API基础URL
  enabled: boolean;     // 是否启用
  priority: number;     // 优先级 (1-10，数字越小优先级越高)
  lastUsed?: number;    // 最后使用时间（时间戳）
  errorCount?: number;  // 连续失败次数
  model?: string;       // 模型名称
  rateLimit?: number;   // 速率限制（每小时请求数）
}

// API调用结果
export interface APIResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  provider?: string;
}

// 第三方API配置（存储格式）
export interface ThirdPartyAPIConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  priority: number;
  model?: string;
  rateLimit?: number;
}

export class APIManager {
  private env: Env;
  private providerStats: Map<string, { lastUsed: number; errorCount: number }>;

  constructor(env: Env) {
    this.env = env;
    this.providerStats = new Map();
  }

  /**
   * 获取所有可用的API提供商
   */
  async getAvailableProviders(): Promise<APIProvider[]> {
    const providers: APIProvider[] = [];

    // 1. 添加环境变量配置的Gemini API
    const geminiKey = this.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.trim().length > 0) {
      providers.push({
        id: 'gemini-env',
        name: 'Google Gemini',
        provider: 'gemini',
        type: 'env',
        key: geminiKey.trim(),
        baseUrl: this.env.AI_MODEL_URL || 'https://generativelanguage.googleapis.com/v1beta/models',
        enabled: true,
        priority: 1, // 最高优先级
        model: this.env.AI_MODEL_NAME || 'gemini-3-pro-image-preview'
      });
      console.log('[APIManager] Added Gemini from environment variables');
    }

    // 2. 添加从KV存储获取的第三方API配置
    try {
      const adminConfigStr = await this.env.ADMIN_KV.get('admin_config');
      if (adminConfigStr) {
        const adminConfig = JSON.parse(adminConfigStr);
        if (adminConfig.api_configs && Array.isArray(adminConfig.api_configs)) {
          adminConfig.api_configs.forEach((config: any, index: number) => {
            if (config.enabled && config.name && config.key && config.key.trim().length > 0) {
              const providerId = `${config.provider || 'custom'}-${config.name}-${index}`;
              providers.push({
                id: providerId,
                name: config.name,
                provider: config.provider || 'custom',
                type: 'config',
                key: config.key.trim(),
                baseUrl: config.url,
                enabled: true,
                priority: config.priority || 5,
                model: config.model,
                lastUsed: this.providerStats.get(providerId)?.lastUsed,
                errorCount: this.providerStats.get(providerId)?.errorCount || 0
              });
              console.log(`[APIManager] Added ${config.name} from admin config`);
            }
          });
        }
      }
    } catch (error) {
      console.error('[APIManager] Error loading admin config:', error);
    }

    // 3. 按优先级排序
    providers.sort((a, b) => {
      // 首先按优先级排序
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // 相同优先级按最后使用时间排序（越早使用越优先）
      const aLastUsed = a.lastUsed || 0;
      const bLastUsed = b.lastUsed || 0;
      if (aLastUsed !== bLastUsed) {
        return aLastUsed - bLastUsed;
      }
      // 最后按错误次数排序
      return (a.errorCount || 0) - (b.errorCount || 0);
    });

    console.log(`[APIManager] Found ${providers.length} available providers:`, 
      providers.map(p => ({ name: p.name, priority: p.priority, errors: p.errorCount })));

    return providers;
  }

  /**
   * 选择最佳API提供商（轮询和故障转移逻辑）
   * @param excludeKeys 要排除的API密钥列表
   */
  async selectBestProvider(excludeKeys: string[] = []): Promise<APIProvider | null> {
    const providers = await this.getAvailableProviders();
    
    // 过滤掉排除的密钥和失败的提供商
    const validProviders = providers.filter(provider => {
      // 排除指定的密钥
      if (excludeKeys.includes(provider.key)) {
        return false;
      }
      
      // 排除禁用的提供商
      if (!provider.enabled) {
        return false;
      }
      
      // 排除错误次数过多的提供商（3次失败暂时禁用）
      const errorCount = provider.errorCount || 0;
      if (errorCount >= 3) {
        console.log(`[APIManager] Provider ${provider.name} excluded due to ${errorCount} errors`);
        return false;
      }
      
      return true;
    });

    if (validProviders.length === 0) {
      console.warn('[APIManager] No valid providers available');
      return null;
    }

    // 选择最佳提供商（已经排序过，取第一个）
    const selectedProvider = validProviders[0];
    console.log(`[APIManager] Selected provider: ${selectedProvider.name} (priority: ${selectedProvider.priority})`);
    
    return selectedProvider;
  }

  /**
   * 更新提供商使用统计
   */
  updateProviderStats(providerId: string, success: boolean): void {
    const current = this.providerStats.get(providerId) || { lastUsed: 0, errorCount: 0 };
    
    if (success) {
      // 成功：重置错误计数，更新最后使用时间
      this.providerStats.set(providerId, {
        lastUsed: Date.now(),
        errorCount: 0
      });
      console.log(`[APIManager] Provider ${providerId} success, reset error count`);
    } else {
      // 失败：增加错误计数
      this.providerStats.set(providerId, {
        lastUsed: current.lastUsed,
        errorCount: current.errorCount + 1
      });
      console.log(`[APIManager] Provider ${providerId} failed, error count: ${current.errorCount + 1}`);
    }
  }

  /**
   * 获取所有提供商的状态
   */
  async getProviderStatuses(): Promise<any[]> {
    const providers = await this.getAvailableProviders();
    
    return providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      provider: provider.provider,
      type: provider.type,
      enabled: provider.enabled,
      priority: provider.priority,
      lastUsed: provider.lastUsed,
      errorCount: provider.errorCount || 0,
      status: this.getProviderStatus(provider)
    }));
  }

  /**
   * 获取单个提供商的状态
   */
  private getProviderStatus(provider: APIProvider): string {
    const errorCount = provider.errorCount || 0;
    if (errorCount >= 3) {
      return 'failed';
    }
    if (errorCount > 0) {
      return 'warning';
    }
    return 'healthy';
  }

  /**
   * 重置提供商错误计数（用于管理员手动重置）
   */
  resetProviderError(providerId: string): void {
    const current = this.providerStats.get(providerId) || { lastUsed: 0, errorCount: 0 };
    this.providerStats.set(providerId, {
      lastUsed: current.lastUsed,
      errorCount: 0
    });
    console.log(`[APIManager] Reset error count for provider: ${providerId}`);
  }

  /**
   * 清理过期的统计信息（30分钟后重置失败计数）
   */
  cleanupStats(): void {
    const now = Date.now();
    const resetThreshold = 30 * 60 * 1000; // 30分钟

    for (const [providerId, stats] of this.providerStats.entries()) {
      if (stats.errorCount > 0 && (now - stats.lastUsed) > resetThreshold) {
        this.providerStats.set(providerId, {
          lastUsed: stats.lastUsed,
          errorCount: 0
        });
        console.log(`[APIManager] Auto-reset error count for provider: ${providerId}`);
      }
    }
  }
}