import { AIModelAdapter, Env } from '../types';

export class GeminiModel implements AIModelAdapter {
  private apiKey: string;
  private baseUrl: string;
  private modelName: string;

  private static readonly DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
  private static readonly DEFAULT_MODEL = 'gemini-3-pro-image-preview'; 

  constructor(apiKey: string, modelName?: string, baseUrl?: string) {
    if (!apiKey) throw new Error('Gemini API Key is missing');
    this.apiKey = apiKey;
    this.modelName = modelName || GeminiModel.DEFAULT_MODEL;
    this.baseUrl = baseUrl || GeminiModel.DEFAULT_BASE_URL;
  }

  async generateImage(prompt: string): Promise<ArrayBuffer> {
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, '');
    // 统一使用 generateContent 接口（Chat接口）
    // 图像生成只是 Chat 的一个 modality
    const url = `${cleanBaseUrl}/${this.modelName}:generateContent?key=${this.apiKey}`;

    // 构造 Chat 格式请求
    // 移除硬编码风格描述，让提示词本身决定绘画风格
    const payload = {
      contents: [{
        parts: [{
          text: `${prompt}`
        }]
      }],
      generationConfig: {
        // 关键设置：要求模型输出图片（如果支持）
        responseModalities: ["IMAGE"] 
      }
    };

    console.log(`[Gemini] Sending to ${this.modelName}...`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error('[Gemini] API Error:', response.status, txt);
      throw new Error(`Gemini API Failed: ${response.status} - ${txt}`);
    }

    const data = await response.json() as any;
    
    // 解析 Gemini 的 Inline Data
    // 结构: candidates[0].content.parts[0].inlineData.data
    try {
      const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (part && part.inlineData && part.inlineData.data) {
        return this.base64ToArrayBuffer(part.inlineData.data);
      }
      
      // 如果没有图片数据，检查是否有文本回复（可能是模型拒绝生成图像）
      const textPart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text);
      if (textPart && textPart.text) {
        console.warn('[Gemini] Model returned text instead of image:', textPart.text);
        throw new Error('Model returned text instead of image. It may have refused to generate the image.');
      }
      
      throw new Error('No image data found in Gemini response');
    } catch (e) {
      console.error('Gemini Response Dump:', JSON.stringify(data).slice(0, 200));
      throw e;
    }
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