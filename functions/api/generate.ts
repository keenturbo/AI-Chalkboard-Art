import { Env, GenerateRequest } from '../types';
import { buildPromptWithEnv } from '../lib/prompts';
import { KeyManager } from '../lib/key-manager';
import { GeminiModel } from '../lib/gemini'; 
import { GeminiAdvanced } from '../lib/gemini-advanced';
import { saveImageToR2 } from '../lib/storage';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    // 1. 解析请求
    const body = await request.json() as GenerateRequest;
    if (!body.character_name) {
      return new Response(JSON.stringify({ error: 'Character name is required' }), { status: 400 });
    }

    // 2. 加载管理员配置
    let adminConfig;
    try {
      const configResponse = await fetch(`${new URL(request.url).origin}/api/admin-config`);
      if (configResponse.ok) {
        adminConfig = await configResponse.json();
      }
    } catch (error) {
      console.error('加载管理员配置失败，使用默认配置:', error);
    }

    // 3. 构建提示词（支持自定义提示词）
    const prompt = await buildPromptWithEnv(body.character_name, body.style, env);

    // 4. 选择API服务（支持多API配置）
    let imageBuffer;
    let usedApi = 'Google Gemini';
    
    if (adminConfig?.api_configs && adminConfig.api_configs.length > 0) {
      // 使用管理员配置的API服务
      const enabledApis = adminConfig.api_configs.filter(api => api.enabled && api.key);
      
      for (const apiConfig of enabledApis) {
        try {
          console.log(`尝试使用API服务: ${apiConfig.name}`);
          const aiModel = new GeminiAdvanced(apiConfig);
          imageBuffer = await aiModel.generateImage(prompt);
          usedApi = apiConfig.name;
          break; // 成功则跳出循环
        } catch (error) {
          console.error(`API服务 ${apiConfig.name} 失败，尝试下一个:`, error);
          continue; // 失败则尝试下一个API
        }
      }
      
      if (!imageBuffer) {
        throw new Error('所有API服务都失败了');
      }
    } else {
      // 默认使用Gemini（保持原有逻辑）
      const keyManager = new KeyManager(env.GEMINI_API_KEY);
      const selectedKey = keyManager.getNextKey();
      const modelName = env.AI_MODEL_NAME || 'gemini-3-pro-image-preview';
      const baseUrl = env.AI_MODEL_URL || 'https://generativelanguage.googleapis.com/v1beta/models';
      
      const aiModel = new GeminiModel(selectedKey, modelName, baseUrl);
      imageBuffer = await aiModel.generateImage(prompt);
    }

    // 5. 保存图片到 R2
    const safeFilename = body.character_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const imageUrl = await saveImageToR2(env, imageBuffer, safeFilename);

    // 6. 返回结果
    return new Response(JSON.stringify({ 
      success: true, 
      image_url: imageUrl,
      prompt_used: prompt,
      api_used: usedApi,
      style: body.style
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