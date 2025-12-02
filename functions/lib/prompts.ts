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
    "A raw, documentary-style close-up photograph of a classroom. 
    The focal point is a large, slightly worn green blackboard with visible cloudy white eraser smudges and chalk residue on the surface. 
    Drawn on this textured surface is a masterpiece chalk art of ${name}. 
    The character is depicted in a dynamic pose, rendered with thick, dusty chalk strokes in vibrant colors (pink, yellow, blue). 
    To the right, vertical Chinese text '${name}' is written in hand-written chalk calligraphy. 
    The foreground is out of focus, featuring the worn edge of an old wooden podium with a battered box of colorful chalks and scattered broken pieces. 
    In the corner, a stack of worn paper textbooks sits on a desk. 
    The lighting is natural window light, highlighting the matte, dusty texture of the board. 
    Realistic, nostalgic, high texture, 8k resolution, photorealistic."
  `.trim();
}

// 新增：云彩画提示词模板（完整实现）
function buildCloudPrompt(name: string): string {
  // 基础分析：默认使用白色积云 + 广阔天空
  // 这里简化处理，因为 Gemini 模型足够智能，能自己分析角色
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