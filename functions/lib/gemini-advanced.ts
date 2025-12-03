import { AIModelAdapter, Env, ApiConfig } from '../types';

export class GeminiAdvanced implements AIModelAdapter {
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
    if (!config.key) {
      throw new Error(`${config.name} API Key is missing`);
    }
  }

  async generateImage(prompt: string): Promise<ArrayBuffer> {
    const cleanBaseUrl = this.config.url.replace(/\/+$/, '');
    const url = `${cleanBaseUrl}/${this.config.model}:generateContent?key=${this.config.key}`;

    const payload = {
      contents: [{
        parts: [{
          text: `${prompt}`
        }]
      }],
      generationConfig: {
        responseModalities: ["IMAGE"] 
      }
    };

    console.log(`[${this.config.name}] Sending to ${this.config.model}...`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error(`[${this.config.name}] API Error:`, response.status, txt);
      throw new Error(`${this.config.name} API Failed: ${response.status} - ${txt}`);
    }

    const data = await response.json() as any;
    
    try {
      const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (part && part.inlineData && part.inlineData.data) {
        return this.base64ToArrayBuffer(part.inlineData.data);
      }
      
      const textPart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text);
      if (textPart && textPart.text) {
        console.warn(`[${this.config.name}] Model returned text instead of image:`, textPart.text);
        throw new Error('Model returned text instead of image. It may have refused to generate the image.');
      }
      
      throw new Error(`No image data found in ${this.config.name} response`);
    } catch (e) {
      console.error(`${this.config.name} Response Dump:`, JSON.stringify(data).slice(0, 200));
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