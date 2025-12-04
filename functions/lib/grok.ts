/**
 * Grok API 调用器
 * 支持自定义OpenAI兼容端点，如本地部署的Grok API
 */

export interface GrokConfig {
  baseUrl: string;      // 如: https://api.x.ai/v1 或 https://grok.dataspices.com/v1
  apiKey: string;
  model: string;        // 如: grok-2-image 或 grok-4.1-fast
}

export class GrokAPI {
  private config: GrokConfig;

  constructor(config: GrokConfig) {
    this.config = config;
  }

  /**
   * 生成图片 - 使用Chat Completions接口
   */
  async generateImage(prompt: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      console.log(`[GrokAPI] 开始生成图片 - URL: ${this.config.baseUrl}`);
      console.log(`[GrokAPI] 模型: ${this.config.model}, 提示词长度: ${prompt.length}`);
      
      // 构建Chat Completions请求
      const generationPrompt = `请生成一张图片：${prompt}。请直接返回图片链接，不要添加其他文字说明。`;
      
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的AI图片生成助手。当用户要求生成图片时，请生成相应的图片并返回图片链接。'
            },
            {
              role: 'user',
              content: generationPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
          stream: false
        })
      });

      console.log(`[GrokAPI] API响应状态: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GrokAPI] API错误响应:`, {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Grok API错误: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[GrokAPI] API响应数据:`, data);

      // 提取图片URL
      const imageUrl = this.extractImageUrl(data);
      
      if (!imageUrl) {
        console.error(`[GrokAPI] 响应中未找到图片URL:`, data);
        throw new Error('Grok API响应中未找到图片URL');
      }

      const processingTime = Date.now() - startTime;
      console.log(`[GrokAPI] ✅ 图片生成成功 - 耗时: ${processingTime}ms, URL: ${imageUrl}`);
      
      return imageUrl;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[GrokAPI] ❌ 图片生成失败 - 耗时: ${processingTime}ms, 错误:`, error.message);
      
      if (error.message.includes('403')) {
        throw new Error(`Grok API认证失败 (403): 请检查API密钥是否正确`);
      } else if (error.message.includes('429')) {
        throw new Error(`Grok API限额超限 (429): 请稍后重试`);
      } else if (error.message.includes('Invalid authorization')) {
        throw new Error(`Grok API授权无效: 请确认API密钥格式和端点URL`);
      } else {
        throw new Error(`Grok API调用失败: ${error.message}`);
      }
    }
  }

  /**
   * 提取图片URL - 支持多种响应格式
   */
  private extractImageUrl(data: any): string | null {
    try {
      // 方式1: 直接在choices[0].message.content中
      if (data.choices && data.choices[0]?.message?.content) {
        const content = data.choices[0].message.content;
        
        // 提取URL - 支持多种格式
        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
        const matches = content.match(urlRegex);
        
        if (matches && matches.length > 0) {
          console.log(`[GrokAPI] 从content中提取到URL: ${matches[0]}`);
          return matches[0];
        }
        
        // 如果没有找到URL，可能是base64图片
        if (content.includes('data:image')) {
          console.log(`[GrokAPI] 检测到base64图片数据`);
          return content;
        }
      }
      
      // 方式2: 专用图片格式 (某些API可能支持)
      if (data.image_url) {
        console.log(`[GrokAPI] 从image_url字段提取: ${data.image_url}`);
        return data.image_url;
      }
      
      if (data.data && data.data[0]?.url) {
        console.log(`[GrokAPI] 从data.url字段提取: ${data.data[0].url}`);
        return data.data[0].url;
      }
      
      // 方式3: 检查是否有其他可能的字段
      if (data.url) {
        console.log(`[GrokAPI] 从url字段提取: ${data.url}`);
        return data.url;
      }
      
      return null;
      
    } catch (error) {
      console.error(`[GrokAPI] 提取图片URL时出错:`, error);
      return null;
    }
  }

  /**
   * 测试API连接
   */
  async testConnection(): Promise<{ success: boolean; message: string; models?: string[] }> {
    try {
      console.log(`[GrokAPI] 测试连接 - URL: ${this.config.baseUrl}`);
      
      // 方法1: 尝试调用模型列表接口
      try {
        const modelsResponse = await fetch(`${this.config.baseUrl}/models`, {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          }
        });
        
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          const models = modelsData.data?.map(model => model.id) || [];
          console.log(`[GrokAPI] ✅ /models接口测试成功，可用模型: ${models.join(', ')}`);
          return { 
            success: true, 
            message: '连接成功 - 通过/models接口验证', 
            models 
          };
        }
      } catch (modelsError) {
        console.log(`[GrokAPI] /models接口测试失败，尝试chat/completions接口: ${modelsError.message}`);
      }
      
      // 方法2: 尝试调用chat/completions接口进行简单测试
      const testResponse = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: 'Hello, this is a test message. Please respond with "Connection successful".'
            }
          ],
          max_tokens: 50,
          stream: false
        })
      });

      if (testResponse.ok) {
        console.log(`[GrokAPI] ✅ /chat/completions接口测试成功`);
        return { 
          success: true, 
          message: `连接成功 - 通过chat/completions接口验证 (模型: ${this.config.model})` 
        };
      } else {
        const errorText = await testResponse.text();
        console.error(`[GrokAPI] 测试失败:`, {
          status: testResponse.status,
          body: errorText
        });
        
        if (testResponse.status === 403) {
          return { success: false, message: '认证失败 (403) - API密钥无效或权限不足' };
        } else if (testResponse.status === 401) {
          return { success: false, message: '授权失败 (401) - API密钥格式错误或缺失' };
        } else {
          return { success: false, message: `连接失败 (${testResponse.status}) - ${errorText}` };
        }
      }
      
    } catch (error) {
      console.error(`[GrokAPI] 连接测试异常:`, error);
      return { 
        success: false, 
        message: `连接异常 - ${error.message}` 
      };
    }
  }
}