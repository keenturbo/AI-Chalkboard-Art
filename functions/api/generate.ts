import { Env, GenerateRequest } from '../types';
import { buildPrompt } from '../lib/prompts';
import { GeminiModel } from '../lib/gemini'; 
import { saveImageToR2 } from '../lib/storage';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    // 1. 解析请求
    const body = await request.json() as GenerateRequest;
    if (!body.character_name) {
      return new Response(JSON.stringify({ error: 'Character name is required' }), { status: 400 });
    }

    // 2. 构建提示词
    const prompt = buildPrompt(body.character_name, body.style);

    // 3. 调用 AI 模型 (Gemini)
    // 实例化模型适配器
    const aiModel = new GeminiModel(env.GEMINI_API_KEY); 
    const imageBuffer = await aiModel.generateImage(prompt);

    // 4. 保存图片到 R2
    const safeFilename = body.character_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const imageUrl = await saveImageToR2(env, imageBuffer, safeFilename);

    // 5. 返回结果
    return new Response(JSON.stringify({ 
      success: true, 
      image_url: imageUrl,
      prompt_used: prompt 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Generation Error:', err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message || 'Internal Server Error' 
    }), { status: 500 });
  }
};