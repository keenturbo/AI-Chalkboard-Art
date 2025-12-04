/**
 * Grok API 调用器 - 支持 OpenAI 兼容的 Chat Completions API
 * 通过对话模式生成图片
 */
export class GrokAPI {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(baseUrl: string, apiKey: string, model: string = 'grok-4.1-fast') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除末尾的斜杠
    this.apiKey = apiKey.trim();
    this.model = model;
    
    console.log(`[GrokAPI] Initialized for model: ${model}, baseUrl: ${baseUrl}`);
  }

  /**
   * 使用 Grok Chat Completions API 生成图片
   * @param prompt 图片生成提示词
   * @returns 图片数据 (ArrayBuffer)
   */
  async generateImage(prompt: string): Promise<ArrayBuffer> {
    try {
      console.log(`[GrokAPI] Generating image with prompt length: ${prompt.length}`);
      
      // 构造图片生成提示 - 让模型生成图片
      const imagePrompt = `Please generate an image: ${prompt}. Return the image directly without additional text.`;
      
      // 使用 OpenAI 兼容的 Chat Completions API
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Chalkboard-Art/1.0'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: imagePrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Grok API error: ${response.status}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage += ` - ${errorData.error?.message || errorData.message || 'Unknown error'}`;
        } catch {
          errorMessage += ` - ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`[GrokAPI] API response received:`, JSON.stringify(data, null, 2));
      
      // 解析Chat Completions响应
      if (data.choices && data.choices.length > 0) {
        const choice = data.choices[0];
        const content = choice.message?.content;
        
        if (content) {
          // 检查内容中是否包含图片URL
          const imageUrls = this.extractImageUrls(content);
          if (imageUrls.length > 0) {
            console.log(`[GrokAPI] Found image URLs: ${imageUrls.length}`);
            // 下载第一张图片
            return await this.downloadImageFromUrl(imageUrls[0]);
          }
          
          // 检查是否包含base64图片数据
          const base64Images = this.extractBase64Images(content);
          if (base64Images.length > 0) {
            console.log(`[GrokAPI] Found base64 images: ${base64Images.length}`);
            return this.base64ToArrayBuffer(base64Images[0]);
          }
          
          // 如果没有找到图片，可能是模型返回了文字描述
          console.warn(`[GrokAPI] No images found in response, content: `, content);
          throw new Error('Model response did not contain image data');
        }
      }
      
      throw new Error('Invalid response format from Grok API');
    } catch (error) {
      console.error('[GrokAPI] Error generating image:', error);
      throw error;
    }
  }

  /**
   * 从文本中提取图片URL
   */
  private extractImageUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/gi;
    const matches = text.match(urlRegex);
    return matches || [];
  }

  /**
   * 从文本中提取base64图片数据
   */
  private extractBase64Images(text: string): string[] {
    const matches = text.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/gi);
    return matches || [];
  }

  /**
   * 将base64转换为ArrayBuffer
   */
  private base64ToArrayBuffer(base64Data: string): ArrayBuffer {
    // 移除data:image/...;base64,前缀
    const base64 = base64Data.split(',')[1];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer;
  }

  /**
   * 从URL下载图片
   */
  private async downloadImageFromUrl(url: string): Promise<ArrayBuffer> {
    console.log(`[GrokAPI] Downloading image from URL: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    
    return await response.arrayBuffer();
  }

  /**
   * 测试 API 连接
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log(`[GrokAPI] Testing connection to ${this.baseUrl}/models`);
      
      // 使用标准的OpenAI兼容API测试端点
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[GrokAPI] Connection test successful, response:`, JSON.stringify(data, null, 2));
        return true;
      } else {
        const errorText = await response.text();
        console.error(`[GrokAPI] Connection test failed: ${response.status}`, errorText);
        return false;
      }
    } catch (error) {
      console.error(`[GrokAPI] Connection test error:`, error);
      return false;
    }
  }

  /**
   * 获取API信息
   */
  getApiInfo(): { provider: string; baseUrl: string; model: string } {
    return {
      provider: 'Grok',
      baseUrl: this.baseUrl,
      model: this.model
    };
  }
}