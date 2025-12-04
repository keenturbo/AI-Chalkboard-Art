/**
 * 新的图片生成API - 使用统一的多API管理器
 * 支持Gemini、Grok等多种API提供商的自动切换和轮询
 */
import { Env, GenerateRequest } from '../types';
import { buildPromptWithEnv } from '../lib/prompts';
import { ImageGenerator } from '../lib/image-generator';
import { saveImageToR2 } from '../lib/storage';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    // 1. 解析请求
    const body = await request.json() as GenerateRequest;
    if (!body.character_name) {
      return new Response(JSON.stringify({ error: 'Character name is required' }), { status: 400 });
    }

    console.log('[Generate-New] 开始生成图片:', { character: body.character_name, style: body.style });

    // 2. 加载管理员配置
    let adminConfig = null;
    try {
      const configResponse = await fetch(`${new URL(request.url).origin}/api/admin-config`);
      if (configResponse.ok) {
        adminConfig = await configResponse.json();
        console.log('[Generate-New] 加载管理员配置成功:', { 
          apiCount: adminConfig.api_configs?.length || 0,
          promptCount: adminConfig.prompts?.length || 0 
        });
      }
    } catch (error) {
      console.error('[Generate-New] 加载管理员配置失败，使用默认配置:', error);
    }

    // 3. 构建提示词（支持自定义提示词）
    let prompt = '';
    let usedStyle = body.style || 'blackboard'; // 默认使用黑板风格
    
    if (adminConfig?.prompts && adminConfig.prompts.length > 0) {
      // 使用自定义提示词逻辑（保持与原API一致）
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
        console.log('[Generate-New] 使用第一个自定义提示词:', matchedPrompt.name);
      }
      
      if (matchedPrompt) {
        if (matchedPrompt.prompt && matchedPrompt.prompt.length > 20) {
          prompt = matchedPrompt.prompt.replace(/\$\{name\}/g, body.character_name);
          console.log('[Generate-New] 使用自定义完整提示词:', matchedPrompt.key, '长度:', prompt.length);
        } else {
          prompt = await buildPromptWithEnv(body.character_name, matchedPrompt.key, env);
          console.log('[Generate-New] 使用自定义简单提示词:', matchedPrompt.key);
        }
      }
    }
    
    // 如果没有自定义提示词，使用内置提示词
    if (!prompt) {
      prompt = await buildPromptWithEnv(body.character_name, usedStyle, env);
      console.log('[Generate-New] 使用内置提示词:', usedStyle);
    }

    console.log('[Generate-New] 最终提示词长度:', prompt.length, '前100字符:', prompt.substring(0, 100));

    // 4. 使用新的图片生成器
    const imageGenerator = new ImageGenerator(env);
    
    let imageBuffer: ArrayBuffer;
    let usedProvider: string;
    let allErrors: string[] = [];

    try {
      const result = await imageGenerator.generateImage(prompt);
      imageBuffer = result.imageBuffer;
      usedProvider = result.provider;
      console.log(`[Generate-New] 🎉 成功使用 ${usedProvider} 生成图片`);
    } catch (error) {
      console.error('[Generate-New] ❌ 图片生成失败:', error);
      allErrors.push(error.message);
      
      // 获取API状态用于调试
      try {
        const providerStatuses = await imageGenerator.getProviderStatuses();
        console.log('[Generate-New] 当前API状态:', providerStatuses);
        
        const errorMessage = `所有API服务都失败了:\n${allErrors.join('\n')}\n\nAPI状态:\n${providerStatuses.map(p => `- ${p.name}: ${p.status} (错误: ${p.errorCount})`).join('\n')}\n\n建议:\n1. 检查环境变量GEMINI_API_KEY是否正确配置\n2. 在管理后台配置有效的第三方API\n3. 检查API密钥是否用尽或过期`;
        
        return new Response(JSON.stringify({ 
          success: false, 
          error: '所有API服务都失败了，请检查API配置',
          details: errorMessage,
          errors: allErrors,
          debug: {
            configuredProviders: providerStatuses.length,
            hasGeminiKey: !!(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0),
            promptLength: prompt.length,
            providerStatuses: providerStatuses,
            suggestion: '请在Cloudflare Pages后台添加环境变量GEMINI_API_KEY，或在管理后台配置有效API密钥'
          }
        }), { status: 500 });
      } catch (statusError) {
        console.error('[Generate-New] 获取API状态也失败:', statusError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: '所有API服务都失败了，且无法获取API状态',
          details: error.message
        }), { status: 500 });
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
      api_used: usedProvider,
      style: usedStyle,
      prompt_length: prompt.length,
      new_api: true // 标记使用了新的API系统
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[Generate-New] ✖️ Generation Error:', err);
    console.error('[Generate-New] Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message || 'Internal Server Error',
      details: err.stack,
      system: 'new-api'
    }), { status: 500 });
  }
};