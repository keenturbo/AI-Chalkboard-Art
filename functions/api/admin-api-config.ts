/**
 * 管理员API配置管理接口
 * 处理第三方API的增删改查和状态监控
 */
import { Env } from '../types';
import { APIManager } from '../lib/api-manager';
import { ImageGenerator } from '../lib/image-generator';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    // 验证管理员权限
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Admin-API-Config] Missing or invalid authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
    }

    const token = authHeader.slice(7);
    const isValid = await validateAdminToken(env, token);
    if (!isValid) {
      console.log('[Admin-API-Config] Invalid token:', token.slice(0, 10) + '...');
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), { status: 401 });
    }

    console.log('[Admin-API-Config] Token validated successfully for action:', action);
    const body = await request.json();

    switch (action) {
      case 'add':
        return await handleAddAPI(env, body);
      case 'update':
        return await handleUpdateAPI(env, body);
      case 'delete':
        return await handleDeleteAPI(env, body);
      case 'test':
        return await handleTestAPI(env, body);
      case 'toggle':
        return await handleToggleAPI(env, body);
      case 'reset':
        return await handleResetAPI(env, body);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
    }

  } catch (error) {
    console.error('[Admin-API-Config] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), { status: 500 });
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    // 验证管理员权限
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Admin-API-Config] Missing or invalid authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
    }

    const token = authHeader.slice(7);
    const isValid = await validateAdminToken(env, token);
    if (!isValid) {
      console.log('[Admin-API-Config] Invalid token:', token.slice(0, 10) + '...');
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), { status: 401 });
    }

    console.log('[Admin-API-Config] Token validated successfully for GET action:', action);

    switch (action) {
      case 'list':
        return await handleListAPIs(env);
      case 'status':
        return await handleGetStatus(env);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
    }

  } catch (error) {
    console.error('[Admin-API-Config] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), { status: 500 });
  }
};

/**
 * 验证管理员token - 与admin-config.ts中的逻辑保持一致
 */
async function validateAdminToken(env: Env, token: string): Promise<boolean> {
  try {
    // 从KV获取管理员配置
    const adminConfigStr = await env.ADMIN_KV.get('admin_config');
    if (!adminConfigStr) {
      console.log('[Admin-API-Config] No admin config found in KV');
      return false;
    }

    const adminConfig = JSON.parse(adminConfigStr);
    
    // 支持新旧两种格式的凭证存储
    let credentials = adminConfig.admin_credentials || adminConfig.credentials;
    
    if (!credentials || !credentials.username || !credentials.password) {
      console.log('[Admin-API-Config] No valid credentials found in config');
      return false;
    }

    // 验证token格式：base64编码的 username:password
    const expectedToken = btoa(`${credentials.username}:${credentials.password}`);
    const isValid = token === expectedToken;
    
    console.log(`[Admin-API-Config] Token validation: expected credentials=${credentials.username}:${credentials.password}, isValid=${isValid}`);
    
    return isValid;
  } catch (error) {
    console.error('[Admin-API-Config] Token validation error:', error);
    return false;
  }
}

/**
 * 添加API配置
 */
async function handleAddAPI(env: Env, body: any): Promise<Response> {
  const { name, provider, baseUrl, apiKey, model, priority = 5, enabled = true } = body;

  console.log(`[Admin-API-Config] Adding API: ${name}, provider: ${provider}`);

  if (!name || !provider || !apiKey) {
    return new Response(JSON.stringify({ 
      error: 'Missing required fields: name, provider, apiKey' 
    }), { status: 400 });
  }

  // 获取现有配置
  const adminConfigStr = await env.ADMIN_KV.get('admin_config');
  const adminConfig = adminConfigStr ? JSON.parse(adminConfigStr) : { api_configs: [], prompts: [] };

  // 检查是否已存在同名配置
  const existingIndex = adminConfig.api_configs && adminConfig.api_configs.findIndex((config: any) => config.name === name);
  if (existingIndex !== -1) {
    return new Response(JSON.stringify({ 
      error: `API configuration with name '${name}' already exists` 
    }), { status: 409 });
  }

  // 确保api_configs数组存在
  if (!adminConfig.api_configs) {
    adminConfig.api_configs = [];
  }

  // 添加新配置
  const newConfig = {
    name,
    provider: provider.toLowerCase(), // grok, gemini, custom
    url: baseUrl,
    key: apiKey,
    model: model || getDefaultModel(provider),
    priority: Math.max(1, Math.min(10, priority)), // 限制在1-10之间
    enabled,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  adminConfig.api_configs.push(newConfig);
  adminConfig.updated_at = new Date().toISOString();

  // 保存配置
  await env.ADMIN_KV.put('admin_config', JSON.stringify(adminConfig));

  console.log(`[Admin-API-Config] Added API configuration: ${name} (${provider})`);

  return new Response(JSON.stringify({ 
    success: true, 
    message: `API configuration '${name}' added successfully`,
    config: sanitizeConfig(newConfig)
  }));
}

/**
 * 更新API配置
 */
async function handleUpdateAPI(env: Env, body: any): Promise<Response> {
  const { name, ...updates } = body;

  if (!name) {
    return new Response(JSON.stringify({ 
      error: 'Missing required field: name' 
    }), { status: 400 });
  }

  const adminConfigStr = await env.ADMIN_KV.get('admin_config');
  if (!adminConfigStr) {
    return new Response(JSON.stringify({ error: 'No configuration found' }), { status: 404 });
  }

  const adminConfig = JSON.parse(adminConfigStr);
  
  if (!adminConfig.api_configs) {
    adminConfig.api_configs = [];
  }
  
  const configIndex = adminConfig.api_configs.findIndex((config: any) => config.name === name);

  if (configIndex === -1) {
    return new Response(JSON.stringify({ 
      error: `API configuration '${name}' not found` 
    }), { status: 404 });
  }

  // 更新配置
  const config = adminConfig.api_configs[configIndex];
  Object.assign(config, updates);
  config.updated_at = new Date().toISOString();

  // 确保priority在有效范围内
  if (config.priority !== undefined) {
    config.priority = Math.max(1, Math.min(10, config.priority));
  }

  adminConfig.updated_at = new Date().toISOString();
  await env.ADMIN_KV.put('admin_config', JSON.stringify(adminConfig));

  console.log(`[Admin-API-Config] Updated API configuration: ${name}`);

  return new Response(JSON.stringify({ 
    success: true, 
    message: `API configuration '${name}' updated successfully`,
    config: sanitizeConfig(config)
  }));
}

/**
 * 删除API配置
 */
async function handleDeleteAPI(env: Env, body: any): Promise<Response> {
  const { name } = body;

  if (!name) {
    return new Response(JSON.stringify({ 
      error: 'Missing required field: name' 
    }), { status: 400 });
  }

  const adminConfigStr = await env.ADMIN_KV.get('admin_config');
  if (!adminConfigStr) {
    return new Response(JSON.stringify({ error: 'No configuration found' }), { status: 404 });
  }

  const adminConfig = JSON.parse(adminConfigStr);
  
  if (!adminConfig.api_configs) {
    return new Response(JSON.stringify({ error: 'No API configurations found' }), { status: 404 });
  }
  
  const configIndex = adminConfig.api_configs.findIndex((config: any) => config.name === name);

  if (configIndex === -1) {
    return new Response(JSON.stringify({ 
      error: `API configuration '${name}' not found` 
    }), { status: 404 });
  }

  // 删除配置
  adminConfig.api_configs.splice(configIndex, 1);
  adminConfig.updated_at = new Date().toISOString();

  await env.ADMIN_KV.put('admin_config', JSON.stringify(adminConfig));

  console.log(`[Admin-API-Config] Deleted API configuration: ${name}`);

  return new Response(JSON.stringify({ 
    success: true, 
    message: `API configuration '${name}' deleted successfully`
  }));
}

/**
 * 测试API配置
 */
async function handleTestAPI(env: Env, body: any): Promise<Response> {
  const { name } = body;

  if (!name) {
    return new Response(JSON.stringify({ 
      error: 'Missing required field: name' 
    }), { status: 400 });
  }

  const imageGenerator = new ImageGenerator(env);
  const adminConfigStr = await env.ADMIN_KV.get('admin_config');
  
  if (!adminConfigStr) {
    return new Response(JSON.stringify({ error: 'No configuration found' }), { status: 404 });
  }

  const adminConfig = JSON.parse(adminConfigStr);
  
  if (!adminConfig.api_configs) {
    return new Response(JSON.stringify({ error: 'No API configurations found' }), { status: 404 });
  }
  
  const config = adminConfig.api_configs.find((c: any) => c.name === name);

  if (!config) {
    return new Response(JSON.stringify({ 
      error: `API configuration '${name}' not found` 
    }), { status: 404 });
  }

  // 构造provider ID进行测试
  const providerId = `${config.provider}-${config.name}`;
  
  try {
    const isWorking = await imageGenerator.testProvider(providerId);
    
    return new Response(JSON.stringify({ 
      success: true, 
      name,
      working: isWorking,
      message: isWorking ? 'API connection test successful' : 'API connection test failed'
    }));
  } catch (error) {
    console.error(`[Admin-API-Config] Test failed for ${name}:`, error);
    return new Response(JSON.stringify({ 
      success: false, 
      name,
      working: false,
      error: error.message
    }), { status: 500 });
  }
}

/**
 * 启用/禁用API配置
 */
async function handleToggleAPI(env: Env, body: any): Promise<Response> {
  const { name, enabled } = body;

  if (name === undefined || enabled === undefined) {
    return new Response(JSON.stringify({ 
      error: 'Missing required fields: name, enabled' 
    }), { status: 400 });
  }

  return await handleUpdateAPI(env, { name, enabled });
}

/**
 * 重置API错误计数
 */
async function handleResetAPI(env: Env, body: any): Promise<Response> {
  const { name } = body;

  if (!name) {
    return new Response(JSON.stringify({ 
      error: 'Missing required field: name' 
    }), { status: 400 });
  }

  const adminConfigStr = await env.ADMIN_KV.get('admin_config');
  
  if (!adminConfigStr) {
    return new Response(JSON.stringify({ error: 'No configuration found' }), { status: 404 });
  }

  const adminConfig = JSON.parse(adminConfigStr);
  
  if (!adminConfig.api_configs) {
    return new Response(JSON.stringify({ error: 'No API configurations found' }), { status: 404 });
  }
  
  const config = adminConfig.api_configs.find((c: any) => c.name === name);

  if (!config) {
    return new Response(JSON.stringify({ 
      error: `API configuration '${name}' not found` 
    }), { status: 404 });
  }

  const providerId = `${config.provider}-${config.name}`;
  const apiManager = new APIManager(env);
  apiManager.resetProviderError(providerId);

  return new Response(JSON.stringify({ 
    success: true, 
    message: `Error count reset for '${name}'`
  }));
}

/**
 * 获取API配置列表
 */
async function handleListAPIs(env: Env): Promise<Response> {
  const adminConfigStr = await env.ADMIN_KV.get('admin_config');
  const adminConfig = adminConfigStr ? JSON.parse(adminConfigStr) : { api_configs: [], prompts: [] };

  const configs = (adminConfig.api_configs || []).map(sanitizeConfig);

  return new Response(JSON.stringify({ 
    success: true, 
    configs,
    count: configs.length
  }));
}

/**
 * 获取API状态
 */
async function handleGetStatus(env: Env): Promise<Response> {
  const imageGenerator = new ImageGenerator(env);
  const statuses = await imageGenerator.getProviderStatuses();

  return new Response(JSON.stringify({ 
    success: true, 
    providers: statuses,
    total: statuses.length,
    healthy: statuses.filter(s => s.status === 'healthy').length,
    warning: statuses.filter(s => s.status === 'warning').length,
    failed: statuses.filter(s => s.status === 'failed').length
  }));
}

/**
 * 获取默认模型
 */
function getDefaultModel(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'grok':
      return 'grok-4.1-fast';  // 使用你正确的模型名
    case 'gemini':
      return 'gemini-3-pro-image-preview';
    default:
      return 'gemini-3-pro-image-preview';
  }
}

/**
 * 清理敏感信息用于返回
 */
function sanitizeConfig(config: any): any {
  const { key, ...sanitized } = config;
  return {
    ...sanitized,
    hasKey: !!key,
    keyLength: key?.length || 0,
    keyPreview: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : null
  };
}