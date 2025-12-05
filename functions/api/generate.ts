import { Env, GenerateRequest } from '../types';
import { buildPromptWithEnv } from '../lib/prompts';
import { KeyManager } from '../lib/key-manager';
import { GeminiModel } from '../lib/gemini'; 
import { GeminiAdvanced } from '../lib/gemini-advanced';
import { ImageGenerator } from '../lib/image-generator';
import { saveImageToR2 } from '../lib/storage';
import { Trace } from '../lib/types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const startTime = Date.now();
  const trace: Trace = [];

  try {
    // 1. 解析请求
    const body = await request.json() as GenerateRequest;
    if (!body.character_name) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Character name is required',
        trace: [],
        duration: Date.now() - startTime
      }), { status: 400 });
    }

    console.log('🚀 开始生成图片:', { character: body.character_name, style: body.style });

    // 2. 加载管理员配置
    let adminConfig = null;
    try {
      const configResponse = await fetch(`${new URL(request.url).origin}/api/admin-config`);
      if (configResponse.ok) {
        adminConfig = await configResponse.json();
        console.log('✅ 加载管理员配置成功:', { 
          apiCount: adminConfig.api_configs?.length || 0,
          promptCount: adminConfig.prompts?.length || 0 
        });
      }
    } catch (error) {
      console.error('⚠️ 加载管理员配置失败，使用默认配置:', error);
    }

    // 3. 构建提示词（支持自定义提示词）
    const promptStartTime = Date.now();
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
        console.log('📝 使用第一个自定义提示词:', matchedPrompt.name);
      }
      
      if (matchedPrompt) {
        // 如果自定义提示词是完整内容（包含实际描述文字），使用完整内容
        if (matchedPrompt.prompt && matchedPrompt.prompt.length > 20) {
          prompt = matchedPrompt.prompt.replace(/\$\{name\}/g, body.character_name);
          console.log('📝 使用自定义完整提示词:', matchedPrompt.key, '长度:', prompt.length);
        } else {
          // 简单提示词，使用原有逻辑
          prompt = await buildPromptWithEnv(body.character_name, matchedPrompt.key, env);
          console.log('📝 使用自定义简单提示词:', matchedPrompt.key);
        }
      }
    }
    
    // 如果没有自定义提示词，使用内置提示词
    if (!prompt) {
      prompt = await buildPromptWithEnv(body.character_name, usedStyle, env);
      console.log('📝 使用内置提示词:', usedStyle);
    }

    const promptDuration = Date.now() - promptStartTime;
    trace.push({
      api: "Prompt Builder",
      status: "success",
      duration: promptDuration,
      details: { length: prompt.length, style: usedStyle }
    });

    console.log('📝 最终提示词长度:', prompt.length, '前100字符:', prompt.substring(0, 100));

    // 4. 使用新的图片生成器（支持trace和多API）
    const generator = new ImageGenerator(env);
    
    // 获取要排除的失败密钥（从请求头或环境变量获取）
    const excludeKeys: string[] = [];
    // 这里可以根据需要从request中获取需要排除的密钥

    console.log('🎨 智能图片生成器启动...');
    
    const generateResult = await generator.generateImageWithFallback(prompt, {
      excludeKeys,
      trace,
      signal: undefined
    });

    if (!generateResult.success) {
      const totalDuration = Date.now() - startTime;
      console.error('❌ 所有API都失败了:', generateResult.error);
      
      return new Response(JSON.stringify({ 
        success: false,
        error: '所有API服务都失败了，请检查API配置',
        details: generateResult.error,
        trace: generateResult.trace || trace,
        duration: totalDuration,
        debug: generateResult.debug
      }), { status: 500 });
    }

    // 5. 保存图片到 R2
    const saveStartTime = Date.now();
    const safeFilename = body.character_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const imageUrl = await saveImageToR2(env, generateResult.imageBuffer!, safeFilename);
    
    const saveDuration = Date.now() - saveStartTime;
    trace.push({
      api: "R2 Storage",
      status: "success", 
      duration: saveDuration,
      details: { filename: safeFilename, url: imageUrl }
    });

    // 6. 计算总体性能
    const totalDuration = Date.now() - startTime;
    
    console.log('🎉 图片生成完成!', {
      apiUrl: imageUrl,
      apiUsed: generateResult.provider,
      totalDuration,
      attemptCount: generateResult.trace?.length || 1
    });

    // 7. 返回结果（包含详细的trace信息）
    return new Response(JSON.stringify({ 
      success: true, 
      image_url: imageUrl,
      prompt_used: prompt,
      api_used: generateResult.provider,
      style: usedStyle,
      prompt_length: prompt.length,
      trace: generateResult.trace || trace,
      duration: totalDuration,
      attempts: (generateResult.trace || trace).length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    const totalDuration = Date.now() - startTime;
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
      duration: totalDuration
    }), { status: 500 });
  }
};