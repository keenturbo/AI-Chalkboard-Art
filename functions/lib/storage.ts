import { Env } from '../types';

/**
 * 将图片二进制数据保存到 Cloudflare R2
 * 并返回可访问的 URL
 */
export async function saveImageToR2(
  env: Env, 
  imageData: ArrayBuffer, 
  filename: string
): Promise<string> {
  const key = `generated/${Date.now()}-${filename}.png`;
  
  // 写入 R2
  await env.R2_BUCKET.put(key, imageData, {
    httpMetadata: {
      contentType: 'image/png',
    },
  });

  // 返回公共访问链接
  // 优先使用环境变量中的域名，如果没有则使用默认的 R2.dev 子域名
  const domain = env.R2_PUBLIC_DOMAIN || 'https://pub-343c61f80e334876acc3e921f3714ad0.r2.dev';
  return `${domain}/${key}`;
}