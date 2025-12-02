import { AIModelAdapter, Env } from '../types';

export class GeminiModel implements AIModelAdapter {
  private apiKey: string;
  private baseUrl: string;
  private modelName: string;

  private static readonly DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
  private static readonly DEFAULT_MODEL = 'imagen-3.0-generate-001'; 

  constructor(apiKey: string, env?: Env) {
    if (!apiKey) throw new Error('Gemini API Key is missing');
    this.apiKey = apiKey;
    this.baseUrl = env?.AI_MODEL_URL || GeminiModel.DEFAULT_BASE_URL;
    this.modelName = env?.AI_MODEL_NAME || GeminiModel.DEFAULT_MODEL;
  }

  async generateImage(prompt: string): Promise<ArrayBuffer> {
    // 智能路由：根据模型名称决定调用方式
    if (this.modelName.toLowerCase().includes('gemini')) {
      return this.generateWithGemini(prompt);
    } else {
      return this.generateWithImagen(prompt);
    }
  }

  /**
   * 模式 A: Gemini 通用模型 (如 gemini-2.0-flash, gemini-1.5-pro)
   * 接口: :generateContent
   */
  private async generateWithGemini(prompt: string): Promise<ArrayBuffer> {
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, '');
    // 注意：Gemini 接口是 generateContent
    const url = `\({cleanBaseUrl}/\){this.modelName}:generateContent?key=${this.apiKey}`;

    // 构造 Chat 格式的请求
    const payload = {
      contents: [{
        parts: [{ text: `Generate a realistic blackboard chalk drawing of: ${prompt}` }]
      }],
      generationConfig: {
        // 关键：告诉模型我们想要图片 (部分模型支持)
        responseModalities: ["IMAGE"] 
      }
    };

    console.log(`[Gemini-Chat] Sending to ${this.modelName}...`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`Gemini Chat API Failed: \({response.status} - \){txt}`);
    }

    const data = await response.json() as any;
    
    // 解析 Gemini 的 Inline Data (图片)
    // 结构: candidates[0].content.parts[0].inlineData.data
    try {
      const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (part && part.inlineData && part.inlineData.data) {
        return this.base64ToArrayBuffer(part.inlineData.data);
      }
      throw new Error('No image data found in Gemini response');
    } catch (e) {
      console.error('Gemini Response Dump:', JSON.stringify(data).slice(0, 200));
      throw e;
    }
  }

  /**
   * 模式 B: Imagen 专用模型 (如 imagen-3.0-generate-001)
   * 接口: :predict
   */
  private async generateWithImagen(prompt: string): Promise<ArrayBuffer> {
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, '');
    const url = `\({cleanBaseUrl}/\){this.modelName}:predict?key=${this.apiKey}`;

    const payload = {
      instances: [{ prompt: prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "4:3", 
        outputOptions: { mimeType: "image/png" }
      }
    };

    console.log(`[Imagen] Sending to ${this.modelName}...`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`Imagen API Failed: \({response.status} - \){txt}`);
    }

    const data = await response.json() as any;
    
    // 解析 Imagen 的 bytesBase64Encoded
    if (data.predictions?.[0]?.bytesBase64Encoded) {
      return this.base64ToArrayBuffer(data.predictions[0].bytesBase64Encoded);
    }
    
    throw new Error('Invalid response format from Imagen API');
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}