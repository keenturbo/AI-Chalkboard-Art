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
  // 注意：需要在 R2 设置中开启 "Public Access" 或绑定自定义域名
  // 假设 R2 绑定的域名是 r2.yourdomain.com
  // 如果没有绑定域名，可以使用 worker 代理访问，这里假设已配置好公共域名
  const R2_PUBLIC_DOMAIN = 'https://pic.turbo.netlib.re'; // 替换为你实际的 R2 域名
  return `${R2_PUBLIC_DOMAIN}/${key}`;
}