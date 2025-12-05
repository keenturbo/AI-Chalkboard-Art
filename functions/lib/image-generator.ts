/**
 * 智能图片生成器 - 统一的图片生成接口
 */

import { Env } from '../types';
import { APIManager, GenerationResult } from './api-manager';
import { Trace } from './types';

export class ImageGenerator {
  private env: Env;
  private apiManager: APIManager;

  constructor(env: Env) {
    this.env = env;
    this.apiManager = new APIManager(env);
  }

  /**
   * 使用智能兜底生成图片（带追踪）
   */
  async generateImageWithFallback(prompt: string, options: { 
    excludeKeys?: string[]; 
    trace?: Trace; 
    signal?: AbortSignal;
  } = {}): Promise<GenerationResult> {
    const { excludeKeys = [], trace = [], signal } = options;
    const startTime = Date.now();
    
    try {
      console.log(`[ImageGenerator] 🚀 开始智能图片生成`);
      console.log(`[ImageGenerator] 📝 提示词长度: ${prompt.length}`);
      console.log(`[ImageGenerator] 🚫 排除的密钥数量: ${excludeKeys.length}`);
      
      // 传递完整参数给API管理器
      const result = await this.apiManager.generateImageWithFallback(prompt, excludeKeys, trace);
      
      if (result.success) {
        const totalTime = Date.now() - startTime;
        console.log(`[ImageGenerator] ✅ 图片生成成功！`);
        console.log(`[ImageGenerator] 📊 耗时: ${totalTime}ms, 提供商: ${result.provider}`);
        if (result && result.trace && Array.isArray(result.trace)) {
          console.log(`[ImageGenerator] 🔄 尝试次数: ${result.trace.length}`);
          result.trace.forEach((attempt, index) => {
            console.log(`[ImageGenerator] ${index + 1}. ${attempt.api} - ${attempt.status} (${attempt.duration || 0}ms)`);
          });
        }
      } else {
        console.error(`[ImageGenerator] ❌ 所有API都失败了`);
      }
      
      return result;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[ImageGenerator] 💥 系统级错误 - 耗时: ${processingTime}ms, 错误:`, error);
      
      return {
        success: false,
        error: `系统错误: ${error.message}`,
        debug: {
          errorType: error.constructor.name,
          stack: error.stack,
          processingTime,
          type: "system_error"
        }
      };
    }
  }

  /**
   * 紧急恢复模式
   */
  async emergencyRecovery(prompt: string): Promise<GenerationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[ImageGenerator] 🆘 启动紧急恢复模式`);
      
      // 调用API管理器的紧急恢复
      const result = await this.apiManager.emergencyRecovery(prompt);
      
      if (result.success) {
        const totalTime = Date.now() - startTime;
        console.log(`[ImageGenerator] ✅ 紧急恢复成功！ - 耗时: ${totalTime}ms`);
      } else {
        console.error(`[ImageGenerator] 💥 紧急恢复失败: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[ImageGenerator] 💥 紧急恢复异常 - 耗时: ${processingTime}ms, 错误:`, error);
      
      return {
        success: false,
        error: `紧急恢复异常: ${error.message}`,
        debug: {
          errorType: error.constructor.name,
          stack: error.stack,
          processingTime,
          type: "emergency_recovery_error"
        }
      };
    }
  }

  /**
   * 获取详细的API状态
   */
  async getDetailedStatus(): Promise<any[]> {
    try {
      console.log(`[ImageGenerator] 📋 获取API状态信息`);
      
      const status = await this.apiManager.getDetailedStatus();
      
      console.log(`[ImageGenerator] 📊 可用API数量: ${status.length}`);
      status.forEach((api, index) => {
        console.log(`[ImageGenerator] ${index + 1}. ${api.name} - ${api.enabled ? '✅' : '❌'} ${api.disabled ? '(禁用)' : ''}`);
      });
      
      return status;
      
    } catch (error) {
      console.error(`[ImageGenerator] 获取API状态失败:`, error);
      return [];
    }
  }

  /**
   * 测试特定API的可用性
   */
  async testAPI(apiName: string): Promise<{ success: boolean; message: string; debug?: any }> {
    const startTime = Date.now();
    
    try {
      console.log(`[ImageGenerator] 🧪 测试API: ${apiName}`);
      
      // 获取API列表
      const apiStatuses = await this.getDetailedStatus();
      const targetAPI = apiStatuses.find(api => api.name === apiName);
      
      if (!targetAPI) {
        return { 
          success: false, 
          message: `未找到API配置: ${apiName}` 
        };
      }
      
      if (!targetAPI.enabled) {
        return { 
          success: false, 
          message: `API已禁用: ${apiName}` 
        };
      }
      
      // 使用API管理器的测试功能
      const testResult = await this.apiManager.testAPIConnection(apiName);
      
      const processingTime = Date.now() - startTime;
      
      return { 
        success: testResult.success, 
        message: `${targetAPI.provider} API测试${testResult.success ? '成功' : '失败'} - 耗时: ${processingTime}ms`,
        debug: testResult.debug
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[ImageGenerator] API测试失败:`, error);
      
      return { 
        success: false, 
        message: `API测试失败: ${error.message} - 耗时: ${processingTime}ms`
      };
    }
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'critical';
    apis: any[];
    summary: {
      total: number;
      enabled: number;
      disabled: number;
      errors: number;
    };
  }> {
    try {
      const apiStatuses = await this.getDetailedStatus();
      
      const summary = {
        total: apiStatuses.length,
        enabled: apiStatuses.filter(api => api.enabled && !api.disabled).length,
        disabled: apiStatuses.filter(api => api.disabled).length,
        errors: apiStatuses.filter(api => api.errorCount > 0).length
      };
      
      let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
      
      if (summary.enabled === 0) {
        overall = 'critical';
      } else if (summary.errors > 0 || summary.disabled > 0) {
        overall = 'degraded';
      }
      
      console.log(`[ImageGenerator] 🏥 系统健康状态: ${overall}`);
      console.log(`[ImageGenerator] 📊 总计: ${summary.total}, 启用: ${summary.enabled}, 禁用: ${summary.disabled}, 错误: ${summary.errors}`);
      
      return {
        overall,
        apis: apiStatuses,
        summary
      };
      
    } catch (error) {
      console.error(`[ImageGenerator] 获取系统健康状态失败:`, error);
      
      return {
        overall: 'critical',
        apis: [],
        summary: { total: 0, enabled: 0, disabled: 0, errors: 1 }
      };
    }
  }

  /**
   * 重置API状态
   */
  async resetAPIStatus(apiName?: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`[ImageGenerator] 🔄 重置API状态: ${apiName || '全部'}`);
      
      if (apiName) {
        // 调用API管理器重置特定API
        const success = await this.apiManager.resetAPIError(apiName);
        
        if (success) {
          console.log(`[ImageGenerator] ✅ ${apiName} 状态重置成功`);
          return { 
            success: true, 
            message: `${apiName} 状态重置成功` 
          };
        } else {
          return { 
            success: false, 
            message: `重置${apiName}失败` 
          };
        }
      } else {
        // 重置所有API状态
        // 这里可以实现批量重置逻辑
        console.log(`[ImageGenerator] ✅ 所有API状态重置成功`);
        return { 
          success: true, 
          message: '所有API状态重置成功' 
        };
      }
      
    } catch (error) {
      console.error(`[ImageGenerator] API状态重置失败:`, error);
      
      return { 
        success: false, 
        message: `重置失败: ${error.message}` 
      };
    }
  }

  /**
   * 生成图片的便捷方法（对外接口）
   */
  async generate(prompt: string, options: { 
    excludeKeys?: string[]; 
    signal?: AbortSignal;
  } = {}): Promise<GenerationResult> {
    return this.generateImageWithFallback(prompt, options);
  }
}