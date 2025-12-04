/**
 * Grok API 调用器 - 支持 X.AI Grok 文生图 API
 */
export class GrokAPI {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(baseUrl: string, apiKey: string, model: string = 'grok-2-image') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除末尾的斜杠
    this.apiKey = apiKey.trim();
    this.model = model;
    
    console.log(`[GrokAPI] Initialized for model: ${model}, baseUrl: ${baseUrl}`);
  }

  /**
   * 使用 Grok API 生成图片
   * @param prompt 图片生成提示词
   * @returns 图片数据 (ArrayBuffer)
   */
  async generateImage(prompt: string): Promise<ArrayBuffer> {
    try {
      console.log(`[GrokAPI] Generating image with prompt length: ${prompt.length}`);
      
      // Grok API 调用 - 根据官方文档格式
      const response = await fetch(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Chalkboard-Art/1.0'
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          n: 1, // 生成1张图片
          size: '1024x1024', // 图片尺寸
          quality: 'standard', // 图片质量
          response_format: 'b64_json' // 返回base64格式
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
      console.log(`[GrokAPI] API response received, created: ${data.created}`);
      
      // 解析返回的base64图片数据
      if (data.data && data.data.length > 0) {
        const imageData = data.data[0];
        
        if (imageData.b64_json) {
          // 将base64转换为ArrayBuffer
          const base64Data = imageData.b64_json;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          console.log(`[GrokAPI] Successfully generated image (${bytes.length} bytes)`);
          return bytes.buffer;
        } else if (imageData.url) {
          // 如果返回的是URL，下载图片
          return await this.downloadImageFromUrl(imageData.url);
        } else {
          throw new Error('No image data in Grok API response');
        }
      } else {
        throw new Error('Empty response from Grok API');
      }
    } catch (error) {
      console.error('[GrokAPI] Error generating image:', error);
      throw error;
    }
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
      console.log(`[GrokAPI] Testing connection...`);
      
      // 使用一个简单的测试请求
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[GrokAPI] Connection test successful, available models:`, data.data?.length || 0);
        return true;
      } else {
        console.error(`[GrokAPI] Connection test failed: ${response.status}`);
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