import { Env, PromptConfig } from '../types';

/**
 * 提示词管理器
 * 根据用户输入和选择的风格，构建最终发给 AI 的 Prompt
 */
export function buildPrompt(characterName: string, style: string = 'blackboard'): string {
  switch (style.toLowerCase()) {
    case 'cloud':
      return buildCloudPrompt(characterName);
    case 'textbook':
      return buildTextbookPrompt(characterName);
    case 'blackboard':
    default:
      return buildBlackboardPrompt(characterName);
  }
}

// 核心：黑板画提示词模板
function buildBlackboardPrompt(name: string): string {
  return `
    "A raw, documentary-style Medium Shot of a classroom. 
    The focal point is a large, slightly worn green blackboard with visible cloudy white eraser smudges and chalk residue on the surface. 
    Drawn on this textured surface is a striking chalk art of ${name}. 
    
    The character is depicted in a Dynamic Signature Pose.
    
    CRITICAL STYLE: 'Sketchy but Solid' chalk coverage.
    - The face and body are FULLY FILLED with color, but the texture is rough and scratchy.
    - Instead of smooth blending, use visible hatched lines and cross-hatching to fill the areas.
    - The edges are slightly messy and loose, showing the speed of the drawing.
    - Use vibrant colors mixed with white chalk, but maintain a dry, dusty, powdery look (not oily or shiny).

    To the right, vertical Chinese text '${name}' is written in hand-written chalk calligraphy. 
    The foreground is out of focus, featuring the worn edge of an old wooden podium with a battered box of colorful chalks and scattered broken pieces. 
    In the corner, a stack of worn paper textbooks sits on a desk. 
    The lighting is natural window light, highlighting the matte, dusty texture of the board. 
    Realistic, nostalgic, high texture, 8k resolution, photorealistic."
  `.trim();
}

// 新增：云彩画提示词模板（完整实现）
function buildCloudPrompt(name: string): string {
  return `
    "A breathtaking low-angle photograph of a vast sky. 
    A massive, natural white cumulus cloud formation dominates the frame. 
    Through the phenomenon of pareidolia, the clouds coincidentally resemble the silhouette and form of ${name}. 
    The clouds are fluffy, soft, and volumetric, blending naturally with the surrounding sky. 
    Sunlight backlights the clouds, creating a glowing rim light around the edges. 
    At the very bottom of the frame, a small, realistic landscape anchors the image. 
    High dynamic range, 24mm wide-angle lens, photorealistic nature photography."
  `.trim();
}

// 新增：课本铅笔画提示词模板（完整实现）
function buildTextbookPrompt(name: string): string {
  return `
    "A macro close-up of an open textbook page, focusing on a large printed function graph and geometric shapes. 
    There is very little text, mostly white space and mathematical lines. 
    Drawn directly over the diagram is a rough, sketchy pencil doodle of ${name}. 
    The sketch is messy, with loose, energetic strokes and scribble-style shading. 
    The character is sitting on a parabolic curve line. 
    The paper shows signs of wear, with visible dirty eraser smudges and gray graphite dust. 
    The lighting catches the metallic sheen of the pencil strokes. 
    In the blurred foreground, a mechanical pencil tip and a blue school uniform sleeve are visible. 
    Realistic, raw, unpolished, textbook sketch style."
  `.trim();
}

// 新增：获取默认提示词配置
export function getDefaultPrompts(): PromptConfig[] {
  return [
    {
      name: '黑板粉笔画',
      prompt: 'blackboard'
    },
    {
      name: '现实主义云彩',
      prompt: 'cloud'
    },
    {
      name: '课本铅笔画',
      prompt: 'textbook'
    }
  ];
}

// 新增：动态构建提示词（支持自定义提示词）
export function buildPromptWithConfig(characterName: string, style: string, customPrompts: PromptConfig[]): string {
  // 首先检查自定义提示词
  const customPrompt = customPrompts.find(p => p.prompt === style);
  if (customPrompt) {
    // 自定义提示词暂时使用黑板画模板，但可以进行扩展
    return buildBlackboardPrompt(characterName).replace('${name}', characterName);
  }
  
  // 回退到内置提示词
  return buildPrompt(characterName, style);
}

// 新增：更新提示词配置并重新生成prompts.ts文件
export async function updatePromptsConfig(env: Env, prompts: PromptConfig[]): Promise<void> {
  try {
    // 保存到KV存储
    await env.ADMIN_KV.put('prompts_config', JSON.stringify(prompts));
    
    // 注意：这里不能直接修改文件系统，需要在部署时或通过API重新生成prompts.ts
    // 实际使用时，建议直接从KV读取提示词配置，而不是修改静态文件
    console.log('提示词配置已更新:', prompts.map(p => p.name));
  } catch (error) {
    console.error('更新提示词配置失败:', error);
    throw error;
  }
}

// 新增：从KV加载提示词配置
export async function loadPromptsConfig(env: Env): Promise<PromptConfig[]> {
  try {
    const stored = await env.ADMIN_KV.get('prompts_config');
    if (stored) {
      return JSON.parse(stored);
    }
    return getDefaultPrompts();
  } catch (error) {
    console.error('加载提示词配置失败，使用默认配置:', error);
    return getDefaultPrompts();
  }
}