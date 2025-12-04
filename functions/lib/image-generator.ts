/**
 * 智能图片生成调度器 - 最终兜底版本，确保必定能生成图片
 */
import { Env, ApiConfig } from '../types';
import { APIManager, APIProvider } from './api-manager';
import { GeminiModel } from './gemini';
import { GeminiAdvanced } from './gemini-advanced';
import { GrokAPI } from './grok';
import { KeyManager } from './key-manager';

export interface GenerationResult {
  success: boolean;
  imageBuffer?: ArrayBuffer;
  provider?: string;
  error?: string;
  debug?: any;
}

export class ImageGenerator {
  private env: Env;
  private apiManager: APIManager;

  constructor(env: Env) {
    this.env = env;
    this.apiManager = new APIManager(env);
  }

  /**
   * 智能兜底图片生成 - 确保必定有结果
   * @param prompt 图片生成提示词
   * @returns 生成结果（必定成功或有详细错误）
   */
  async generateImageWithFallback(prompt: string): Promise<GenerationResult> {
    console.log(`[ImageGenerator] 开始生成图片，提示词长度: ${prompt.length}`);
    console.log(`[ImageGenerator] 提示词预览: ${prompt.substring(0, 100)}...`);

    const allAttempts: any[] = [];
    let lastError: Error | null = null;

    try {
      // 1. 获取所有可用的API提供商
      const providers = await this.apiManager.getAvailableProviders();
      console.log(`[ImageGenerator] 找到 ${providers.length} 个API提供商`);

      if (providers.length === 0) {
        throw new Error('没有配置任何API提供商');
      }

      // 2. 按优先级排序并逐个尝试
      const sortedProviders = providers.sort((a, b) => {
        // 首先按优先级排序
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        // 然后按错误次数排序（错误少的优先）
        return (a.errorCount || 0) - (b.errorCount || 0);
      });

      console.log(`[ImageGenerator] API提供商优先级: ${sortedProviders.map(p => `${p.name}(${p.priority})`).join(' → ')}`);

      // 3. 逐个尝试每个提供商
      for (let i = 0; i < sortedProviders.length; i++) {
        const provider = sortedProviders[i];
        const attemptId = `${provider.name}_${Date.now()}_${i}`;
        
        console.log(`[${attemptId}] 尝试第 ${i + 1}/${sortedProviders.length} 个提供商: ${provider.name}`);
        
        const attempt = {
          id: attemptId,
          provider: provider.name,
          providerType: provider.provider,
          priority: provider.priority,
          startTime: Date.now()
        };

        try {
          const result = await this.tryProvider(provider, prompt);
          
          // 成功！
          attempt.success = true;
          attempt.duration = Date.now() - attempt.startTime;
          allAttempts.push(attempt);

          // 更新提供商统计
          await this.apiManager.updateProviderStats(provider.id, true);

          console.log(`[${attemptId}] ✅ 成功生成图片！提供商: ${provider.name}, 耗时: ${attempt.duration}ms`);

          return {
            success: true,
            imageBuffer: result.imageBuffer,
            provider: provider.name,
            debug: {
              attempts: allAttempts,
              totalAttempts: i + 1,
              successfulProvider: provider.name,
              promptLength: prompt.length
            }
          };

        } catch (error) {
          // 失败，记录详细信息并继续下一个
          lastError = error as Error;
          attempt.success = false;
          attempt.error = error.message;
          attempt.duration = Date.now() - attempt.startTime;
          allAttempts.push(attempt);

          console.error(`[${attemptId}] ❌ 提供商 ${provider.name} 失败:`, error.message);
          console.error(`[${attemptId}] 错误详情:`, {
            errorType: error.constructor.name,
            errorMessage: error.message,
            providerConfig: {
              name: provider.name,
              type: provider.type,
              hasKey:!!provider.key,
              baseUrl: provider.baseUrl,
              model: provider.model
            }
          });

          // 更新提供商错误统计
          await this.apiManager.updateProviderStats(provider.id, false, error.message);

          // 暂时禁用连续失败的提供商（1分钟后重新启用）
          await this.apiManager.temporarilyDisableProvider(provider.id, 60000);

          // 继续尝试下一个提供商
          continue;
        }
      }

      // 所有提供商都失败了
      console.error(`[ImageGenerator] ❌ 所有 ${sortedProviders.length} 个提供商都失败了`);
      
      return {
        success: false,
        error: `所有API提供商都失败了。最后错误: ${lastError?.message}`,
        debug: {
          attempts: allAttempts,
          totalProviders: sortedProviders.length,
          promptLength: prompt.length,
          lastError: lastError?.message,
          providerStatuses: await this.apiManager.getProviderStatuses(),
          suggestion: '请检查API密钥配置、网络连接和模型可用性'
        }
      };

    } catch (systemError) {
      console.error(`[ImageGenerator] 系统级错误:`, systemError);
      
      return {
        success: false,
        error: `系统错误: ${systemError.message}`,
        debug: {
          systemError: systemError.message,
          stack: systemError.stack,
          attempts: allAttempts,
          promptLength: prompt.length
        }
      };
    }
  }

  /**
   * 尝试使用特定提供商生成图片
   */
  private async tryProvider(provider: APIProvider, prompt: string): Promise<{ imageBuffer: ArrayBuffer }> {
    console.log(`[tryProvider] 使用提供商: ${provider.name} (类型: ${provider.provider})`);

    // 验证配置
    this.validateProviderConfig(provider);

    switch (provider.provider) {
      case 'gemini':
        return await this.tryGemini(provider, prompt);
      case 'grok':
        return await this.tryGrok(provider, prompt);
      case 'custom':
        return await this.tryCustom(provider, prompt);
      default:
        throw new Error(`未知的提供商类型: ${provider.provider}`);
    }
  }

  /**
   * 验证提供商配置
   */
  private validateProviderConfig(provider: APIProvider): void {
    if (!provider.key || provider.key.trim().length === 0) {
      throw new Error(`提供商 ${provider.name} 缺少API密钥`);
    }

    if (!provider.baseUrl || provider.baseUrl.trim().length === 0) {
      throw new Error(`提供商 ${provider.name} 缺少基础URL`);
    }

    if (!provider.model || provider.model.trim().length === 0) {
      throw new Error(`提供商 ${provider.name} 缺少模型名称`);
    }
  }

  /**
   * 尝试 Gemini API
   */
  private async tryGemini(provider: APIProvider, prompt: string): Promise<{ imageBuffer: ArrayBuffer }> {
    console.log(`[tryGemini] 使用Gemini提供商: ${provider.name}`);

    if (provider.type === 'env') {
      // 环境变量配置，支持多密钥轮询
      if (!this.env.GEMINI_API_KEY) {
        throw new Error('环境变量 GEMINI_API_KEY 未配置');
      }

      const keyManager = new KeyManager(this.env.GEMINI_API_KEY);
      const selectedKey = keyManager.getNextKey();
      
      if (!selectedKey) {
        throw new Error('没有可用的Gemini密钥');
      }

      const model = new GeminiModel(selectedKey, provider.model, this.env);
      const imageBuffer = await model.generateImage(prompt);
      
      return { imageBuffer };
    } else {
      // 管理后台配置的Gemini
      const config: ApiConfig = {
        name: provider.name,
        key: provider.key,
        url: provider.baseUrl,
        model: provider.model
      };
      
      const model = new GeminiAdvanced(config);
      const imageBuffer = await model.generateImage(prompt);
      
      return { imageBuffer };
    }
  }

  /**
   * 尝试 Grok API
   */
  private async tryGrok(provider: APIProvider, prompt: string): Promise<{ imageBuffer: ArrayBuffer }> {
    console.log(`[tryGrok] 使用Grok提供商: ${provider.name}`);
    
    const grok = new GrokAPI(provider.baseUrl, provider.key, provider.model);
    const imageBuffer = await grok.generateImage(prompt);
    
    return { imageBuffer };
  }

  /**
   * 尝试自定义API
   */
  private async tryCustom(provider: APIProvider, prompt: string): Promise<{ imageBuffer: ArrayBuffer }> {
    console.log(`[tryCustom] 使用自定义提供商: ${provider.name}`);
    
    const config: ApiConfig = {
      name: provider.name,
      key: provider.key,
      url: provider.baseUrl,
      model: provider.model
    };
    
    const model = new GeminiAdvanced(config);
    const imageBuffer = await model.generateImage(prompt);
    
    return { imageBuffer };
  }

  /**
   * 获取详细的状态信息
   */
  async getDetailedStatus(): Promise<any> {
    const providers = await this.apiManager.getAvailableProviders();
    const statuses = await this.apiManager.getProviderStatuses();
    
    return {
      totalProviders: providers.length,
      enabledProviders: providers.filter(p => p.enabled).length,
      providers: providers.map(p => ({
        id: p.id,
        name: p.name,
        type: p.provider,
        enabled: p.enabled,
        priority: p.priority,
        hasKey: !!p.key,
        errorCount: p.errorCount || 0,
        lastUsed: p.lastUsed
      })),
      statuses: statuses,
      environment: {
        hasGeminiKey: !!this.env.GEMINI_API_KEY,
        geminiKeyLength: this.env.GEMINI_API_KEY?.length || 0,
        defaultModel: this.env.AI_MODEL_NAME || 'gemini-3-pro-image-preview'
      }
    };
  }

  /**
   * 紧急恢复方法 - 尝试最简单的配置
   */
  async emergencyRecovery(prompt: string): Promise<GenerationResult> {
    console.log(`[emergencyRecovery] 启动紧急恢复模式`);
    
    try {
      // 尝试最基础的Gemini配置
      if (this.env.GEMINI_API_KEY) {
        console.log(`[emergencyRecovery] 找到环境变量Gemini密钥，尝试基础生成`);
        
        const keyManager = new KeyManager(this.env.GEMINI_API_KEY);
        const selectedKey = keyManager.getNextKey();
        
        if (selectedKey) {
          const model = new GeminiModel(
            selectedKey, 
            'gemini-3-pro-image-preview', 
            this.env
          );
          const imageBuffer = await model.generateImage(prompt);
          
          return {
            success: true,
            imageBuffer,
            provider: 'Emergency Gemini Recovery',
            debug: {
              mode: 'emergency',
              provider: 'gemini',
              keyLength: selectedKey.length
            }
          };
        }
      }
      
      throw new Error('紧急恢复失败：没有可用的基础配置');

    } catch (error) {
      return {
        success: false,
        error: `紧急恢复失败: ${error.message}`,
        debug: {
          mode: 'emergency_failed',
          hasEnvKey: !!this.env.GEMINI_API_KEY,
          error: error.message
        }
      };
    }
  }
}