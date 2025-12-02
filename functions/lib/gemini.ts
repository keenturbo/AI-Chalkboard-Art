import { AIModelAdapter } from '../types';

export class GeminiModel implements AIModelAdapter {
  private apiKey: string;
  // 保持 Google 官方 API 地址
  private static readonly BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
  // 修改为用户指定的模型 ID
  private static readonly MODEL_NAME = 'gemini-3-pro-image-preview'; 

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Gemini API Key is missing');
    }
    this.apiKey = apiKey;
  }

  async generateImage(prompt: string): Promise<ArrayBuffer> {
    // 这里的 URL 结构保持: /models/[model_id]:predict
    const url = `\({GeminiModel.BASE_URL}/\){GeminiModel.MODEL_NAME}:predict?key=${this.apiKey}`;

    const payload = {
      instances: [
        {
          prompt: prompt
        }
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: "4:3", 
        outputOptions: {
          mimeType: "image/png"
        }
      }
    };

    try {
      console.log(`[Gemini] Sending request to ${GeminiModel.MODEL_NAME}...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Gemini] API Error:', response.status, errorText);
        throw new Error(`Gemini API Failed: \({response.status} - \){errorText}`);
      }

      const data = await response.json() as any;

      if (!data.predictions || !data.predictions[0] || !data.predictions[0].bytesBase64Encoded) {
        console.error('[Gemini] Unexpected response structure:', JSON.stringify(data).slice(0, 200));
        throw new Error('Invalid response format from Gemini API');
      }

      const base64String = data.predictions[0].bytesBase64Encoded;
      return this.base64ToArrayBuffer(base64String);

    } catch (error: any) {
      console.error('[Gemini] Generation failed:', error);
      throw error;
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