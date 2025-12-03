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

    console.log('开始生成图片:', { character: body.character_name, style: body.style });

    // 2. 加载管理员配置
    let adminConfig = null;
    try {
      const configResponse = await fetch(`${new URL(request.url).origin}/api/admin-config`);
      if (configResponse.ok) {
        adminConfig = await configResponse.json();
        console.log('加载管理员配置成功:', { 
          apiCount: adminConfig.api_configs?.length || 0,
          promptCount: adminConfig.prompts?.length || 0 
        });
      }
    } catch (error) {
      console.error('加载管理员配置失败，使用默认配置:', error);
    }

    // 3. 构建提示词（支持自定义提示词）
    let prompt = '';
    let usedStyle = body.style || 'blackboard'; // 默认使用黑板风格
    
    if (adminConfig?.prompts && adminConfig.prompts.length > 0) {
      // 使用自定义提示词
      let matchedPrompt = null;
      
      // 优先按key匹配
      matchedPrompt = adminConfig.prompts.find(p => p.key === usedStyle);
      
      // 如果key没匹配到，尝试按name匹配
      if (!matchedPrompt) {
        matchedPrompt = adminConfig.prompts.find(p => p.name === usedStyle);
      }
      
      // 如果还是没匹配到，使用第一个自定义提示词
      if (!matchedPrompt && adminConfig.prompts.length > 0) {
        matchedPrompt = adminConfig.prompts[0];
        console.log('使用第一个自定义提示词:', matchedPrompt.name);
      }
      
      if (matchedPrompt) {
        // 如果自定义提示词是完整内容（包含实际描述文字），使用完整内容
        if (matchedPrompt.prompt && matchedPrompt.prompt.length > 20) {
          prompt = matchedPrompt.prompt.replace(/\$\{name\}/g, body.character_name);
          console.log('使用自定义完整提示词:', matchedPrompt.key, '长度:', prompt.length);
        } else {
          // 简单提示词，使用原有逻辑
          prompt = await buildPromptWithEnv(body.character_name, matchedPrompt.key, env);
          console.log('使用自定义简单提示词:', matchedPrompt.key);
        }
      }
    }
    
    // 如果没有自定义提示词，使用内置提示词
    if (!prompt) {
      prompt = await buildPromptWithEnv(body.character_name, usedStyle, env);
      console.log('使用内置提示词:', usedStyle);
    }

    console.log('最终提示词长度:', prompt.length, '前100字符:', prompt.substring(0, 100));

    // 4. 选择API服务（修复API密钥检查逻辑）
    let imageBuffer;
    let usedApi = 'Google Gemini';
    
    if (adminConfig?.api_configs && adminConfig.api_configs.length > 0) {
      // 使用管理员配置的API服务 - 修复：不强制要求key字段
      const enabledApis = adminConfig.api_configs.filter(api => api.enabled);
      console.log('可用的API服务数量:', enabledApis.length);
      console.log('API服务详情:', enabledApis.map(api => ({ name: api.name, hasKey: !!api.key, enabled: api.enabled })));
      
      // 优先尝试有key的API
      const apisWithKey = enabledApis.filter(api => api.key);
      const apisWithoutKey = enabledApis.filter(api => !api.key);
      
      // 先尝试有key的配置
      for (const apiConfig of [...apisWithKey, ...apisWithoutKey]) {
        try {
          console.log(`尝试使用API服务: \({apiConfig.name} (有Key: \){!!apiConfig.key})`);
          
          if (apiConfig.key) {
            // 有API密钥，使用GeminiAdvanced
            const aiModel = new GeminiAdvanced(apiConfig);
            imageBuffer = await aiModel.generateImage(prompt);
          } else {
            // 没有API密钥，使用环境变量的Gemini
            const keyManager = new KeyManager(env.GEMINI_API_KEY);
            const selectedKey = keyManager.getNextKey();
            const modelName = apiConfig.model || env.AI_MODEL_NAME || 'gemini-3-pro-image-preview';
            const baseUrl = apiConfig.url || env.AI_MODEL_URL || 'https://generativelanguage.googleapis.com/v1beta/models';
            
            const aiModel = new GeminiModel(selectedKey, modelName, baseUrl);
            imageBuffer = await aiModel.generateImage(prompt);
          }
          
          usedApi = apiConfig.name;
          console.log(`🎉 API服务 ${apiConfig.name} 成功生成图片`);
          break; // 成功则跳出循环
        } catch (error) {
          console.error(`❌ API服务 ${apiConfig.name} 失败:`, error.message);
          continue; // 失败则尝试下一个API
        }
      }
      
      if (!imageBuffer) {
        console.log('⚠️ 所有自定义API都失败，尝试默认Gemini');
      }
    }
    
    // 如果自定义API都失败或没有配置，使用默认Gemini
    if (!imageBuffer) {
      try {
        console.log('使用默认Gemini服务');
        const keyManager = new KeyManager(env.GEMINI_API_KEY);
        const selectedKey = keyManager.getNextKey();
        const modelName = env.AI_MODEL_NAME || 'gemini-3-pro-image-preview';
        const baseUrl = env.AI_MODEL_URL || 'https://generativelanguage.googleapis.com/v1beta/models';
        
        console.log('Gemini配置:', { model: modelName, baseUrl });
        
        const aiModel = new GeminiModel(selectedKey, modelName, baseUrl);
        imageBuffer = await aiModel.generateImage(prompt);
        usedApi = 'Google Gemini (默认)';
      } catch (fallbackError) {
        console.error('❌ 默认Gemini也失败:', fallbackError);
        throw new Error('所有API服务都失败了，请检查API配置');
      }
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
      style: usedStyle,
      prompt_length: prompt.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('❌ Generation Error:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message || 'Internal Server Error',
      details: err.stack
    }), { status: 500 });
  }
};