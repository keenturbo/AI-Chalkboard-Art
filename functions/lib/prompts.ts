import { Env } from '../types';

// 提示词配置接口
interface PromptConfig {
    name: string;
    key: string;     // 键值（blackboard、cloud等）
    prompt: string;  // 完整提示词内容
}

/**
 * 动态构建提示词（支持自定义提示词）
 * 从 KV 存储获取当前配置，支持完整提示词内容
 */
export async function buildPromptWithEnv(characterName: string, style: string, env: Env): Promise<string> {
  try {
    // 从 KV 获取提示词配置
    const stored = await env.ADMIN_KV.get('admin_config');
    if (!stored) {
      // 回退到默认内置提示词
      return buildDefaultPrompt(characterName, style);
    }
    
    const config = JSON.parse(stored);
    const prompts = config.prompts || [];
    
    // 查找匹配的自定义提示词
    const customPrompt = prompts.find(p => p.key === style || p.name === style);
    if (customPrompt && customPrompt.prompt) {
      // 有完整自定义提示词，直接使用并替换变量
      return customPrompt.prompt.replace(/\$\{name\}/g, characterName);
    }
    
    // 回退到内置提示词
    return buildDefaultPrompt(characterName, style);
    
  } catch (error) {
    console.error('读取提示词配置失败，使用默认配置:', error);
    return buildDefaultPrompt(characterName, style);
  }
}

/**
 * 默认内置提示词构建
 */
function buildDefaultPrompt(characterName: string, style: string): string {
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

// 云彩画提示词模板
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

// 课本铅笔画提示词模板
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

// 保留向后兼容的旧接口
export function buildPrompt(characterName: string, style: string = 'blackboard'): string {
  return buildDefaultPrompt(characterName, style);
}

// 获取默认提示词配置（用于初始化）
export function getDefaultPrompts(): PromptConfig[] {
  return [
    {
      name: '黑板粉笔画',
      key: 'blackboard',
      prompt: ''  // 将使用内置模板
    },
    {
      name: '现实主义云彩',
      key: 'cloud',
      prompt: ''  // 将使用内置模板
    },
    {
      name: '课本铅笔画',
      key: 'textbook',
      prompt: ''  // 将使用内置模板
    }
  ];
}