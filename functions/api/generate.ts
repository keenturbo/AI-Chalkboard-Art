import { Env, GenerateRequest, TraceStep } from '../types';
import { buildPromptWithEnv } from '../lib/prompts';
import { KeyManager } from '../lib/key-manager';
import { GeminiModel } from '../lib/gemini'; 
import { GeminiAdvanced } from '../lib/gemini-advanced';
import { saveImageToR2 } from '../lib/storage';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const startTime = Date.now();
  const trace: TraceStep[] = [];

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

    // 4. 选择API服务并生成图片（添加Trace支持）
    let imageBuffer;
    let usedApi = 'Google Gemini';
    let allErrors = []; // 收集所有错误信息
    
    // 优先检查环境变量是否有Gemini API密钥
    const hasGeminiKey = env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0;
    console.log('环境变量Gemini API密钥状态:', !!env.GEMINI_API_KEY, '长度:', env.GEMINI_API_KEY?.length || 0);
    
    if (adminConfig?.api_configs && adminConfig.api_configs.length > 0) {
      // 使用管理员配置的API服务
      const enabledApis = adminConfig.api_configs.filter(api => api.enabled);
      console.log('可用的API服务数量:', enabledApis.length);
      console.log('API服务详情:', enabledApis.map(api => ({ 
        name: api.name, 
        hasKey: !!api.key, 
        keyLength: api.key?.length || 0,
        enabled: api.enabled 
      })));
      
      // 优先尝试有key的API
      const apisWithKey = enabledApis.filter(api => api.key && api.key.trim().length > 0);
      const apisWithoutKey = enabledApis.filter(api => !api.key || api.key.trim().length === 0);
      
      // 先尝试有key的配置
      for (const apiConfig of [...apisWithKey, ...apisWithoutKey]) {
        const apiStart = Date.now();
        try {
          console.log(`尝试使用API服务: ${apiConfig.name} (有Key: ${!!apiConfig.key})`);
          
          if (apiConfig.key && apiConfig.key.trim().length > 0) {
            // 有API密钥，使用GeminiAdvanced
            const aiModel = new GeminiAdvanced(apiConfig);
            imageBuffer = await aiModel.generateImage(prompt);
          } else {
            // 没有API密钥，尝试使用环境变量的Gemini
            if (!hasGeminiKey) {
              throw new Error('没有配置环境变量GEMINI_API_KEY');
            }
            const keyManager = new KeyManager(env.GEMINI_API_KEY);
            const selectedKey = keyManager.getNextKey();
            const modelName = apiConfig.model || env.AI_MODEL_NAME || 'gemini-3-pro-image-preview';
            const baseUrl = apiConfig.url || env.AI_MODEL_URL || 'https://generativelanguage.googleapis.com/v1beta/models';
            
            const aiModel = new GeminiModel(selectedKey, modelName, baseUrl);
            imageBuffer = await aiModel.generateImage(prompt);
          }
          
          usedApi = apiConfig.name;
          console.log(`🎉 API服务 ${apiConfig.name} 成功生成图片`);
          
          // 添加成功trace
          trace.push({
            api: apiConfig.name,
            status: 'success',
            duration: Date.now() - apiStart
          });
          
          break; // 成功则跳出循环
        } catch (error) {
          const errorMsg = `API服务 ${apiConfig.name} 失败: ${error.message}`;
          console.error(`❌ ${errorMsg}`);
          allErrors.push(errorMsg);
          
          // 添加失败trace
          trace.push({
            api: apiConfig.name,
            status: 'failed',
            duration: Date.now() - apiStart,
            error: error.message
          });
          
          continue; // 失败则尝试下一个API
        }
      }
      
      if (!imageBuffer && allErrors.length > 0) {
        console.log('⚠️ 所有自定义API都失败，错误信息:', allErrors);
      }
    }
    
    // 如果自定义API都失败或没有配置，使用默认Gemini（环境变量）
    if (!imageBuffer) {
      const apiStart = Date.now();
      try {
        console.log('使用默认Gemini服务（环境变量）');
        
        if (!hasGeminiKey) {
          throw new Error('环境变量GEMINI_API_KEY未配置或为空');
        }
        
        const keyManager = new KeyManager(env.GEMINI_API_KEY);
        const selectedKey = keyManager.getNextKey();
        const modelName = env.AI_MODEL_NAME || 'gemini-3-pro-image-preview';
        const baseUrl = env.AI_MODEL_URL || 'https://generativelanguage.googleapis.com/v1beta/models';
        
        console.log('Gemini配置:', { model: modelName, baseUrl, keyLength: selectedKey?.length || 0 });
        
        const aiModel = new GeminiModel(selectedKey, modelName, baseUrl);
        imageBuffer = await aiModel.generateImage(prompt);
        usedApi = 'Google Gemini (环境变量)';
        
        // 添加成功trace
        trace.push({
          api: 'Google Gemini (环境变量)',
          status: 'success',
          duration: Date.now() - apiStart
        });
        
      } catch (fallbackError) {
        console.error('❌ 默认Gemini也失败:', fallbackError);
        allErrors.push(`默认Gemini失败: ${fallbackError.message}`);
        
        // 添加失败trace
        trace.push({
          api: 'Google Gemini (环境变量)',
          status: 'failed',
          duration: Date.now() - apiStart,
          error: fallbackError.message
        });
      }
    }

    // 5. 检查是否成功生成图片
    if (!imageBuffer) {
      const errorMessage = allErrors.length > 0 
        ? `所有API服务都失败了:\n${allErrors.join('\n')}\n\n请检查:\n1. 环境变量GEMINI_API_KEY是否正确配置\n2. 管理员后台的API配置是否完整`
        : '图片生成失败，请重试';
      
      console.error('❌ 所有API都失败了，详细错误:', allErrors);
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: '所有API服务都失败了，请检查API配置',
        details: errorMessage,
        errors: allErrors,
        trace: trace,
        duration: Date.now() - startTime,
        attempts: trace.length,
        debug: {
          hasGeminiKey: hasGeminiKey,
          configuredApis: adminConfig?.api_configs?.length || 0,
          apiKeyLength: env.GEMINI_API_KEY?.length || 0,
          promptLength: prompt.length,
          suggestion: '请在Cloudflare Pages后台添加环境变量GEMINI_API_KEY，或在管理后台配置有效API密钥'
        }
      }), { status: 500 });
    }

    // 6. 保存图片到 R2
    const safeFilename = body.character_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const imageUrl = await saveImageToR2(env, imageBuffer, safeFilename);

    // 7. 返回结果（添加trace信息）
    const totalDuration = Date.now() - startTime;
    
    return new Response(JSON.stringify({ 
      success: true, 
      image_url: imageUrl,
      prompt_used: prompt,
      api_used: usedApi,
      style: usedStyle,
      prompt_length: prompt.length,
      trace: trace,
      duration: totalDuration,
      attempts: trace.length
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
      details: err.stack,
      trace: trace,
      duration: Date.now() - startTime,
      attempts: trace.length
    }), { status: 500 });
  }
};