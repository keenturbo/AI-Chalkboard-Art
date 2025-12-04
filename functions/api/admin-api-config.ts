/**
 * API配置管理 - 支持第三方API的增删改查
 */
import { APIManager } from '../lib/api-manager';
import { GrokAPI } from '../lib/grok';

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

async function verifyToken(request: Request, env: any): Promise<{ valid: boolean; adminConfig?: any; error?: string }> {
  try {
    // 尝试多种Token获取方式
    const authHeader = request.headers.get('Authorization');
    let token = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // 尝试从cookie获取
      const cookieHeader = request.headers.get('Cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {});
        token = cookies.admin_token;
      }
    }

    if (!token) {
      return { valid: false, error: '缺少认证令牌' };
    }

    // 获取管理员配置
    const configData = await env.KV_AI_CHALKBOARD.get('admin_config');
    if (!configData) {
      return { valid: false, error: '管理员配置未找到' };
    }

    const adminConfig = JSON.parse(configData);
    const storedToken = adminConfig.credentials?.token;
    
    // 支持新旧两种字段格式
    const legacyToken = adminConfig.admin_credentials?.token;
    const activeToken = storedToken || legacyToken;
    
    if (!activeToken) {
      return { valid: false, error: '管理员令牌未配置' };
    }

    if (token !== activeToken) {
      return { valid: false, error: '认证令牌无效' };
    }

    return { valid: true, adminConfig };
  } catch (error) {
    console.error('[AdminAPIConfig] Token验证异常:', error);
    return { valid: false, error: '认证验证失败' };
  }
}

async function saveAdminConfig(env: any, config: any) {
  try {
    await env.KV_AI_CHALKBOARD.put('admin_config', JSON.stringify(config));
    console.log('[AdminAPIConfig] 管理员配置保存成功');
  } catch (error) {
    console.error('[AdminAPIConfig] 管理员配置保存失败:', error);
    throw error;
  }
}

export async function onRequestGet(context: any) {
  const { request, env } = context;

  try {
    console.log('[AdminAPIConfig] 🌐 收到GET请求');
    
    // 验证管理员权限
    const authResult = await verifyToken(request, env);
    if (!authResult.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: authResult.error
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const adminConfig = authResult.adminConfig;
    const apiConfigs = adminConfig.api_configs || [];

    console.log(`[AdminAPIConfig] 📋 返回API配置列表 (${apiConfigs.length}个)`);

    return new Response(JSON.stringify({
      success: true,
      configs: apiConfigs,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error: any) {
    console.error('[AdminAPIConfig] ❌ GET请求失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '获取API配置失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    console.log('[AdminAPIConfig] 🌐 收到POST请求');
    
    // 验证管理员权限
    const authResult = await verifyToken(request, env);
    if (!authResult.valid) {
      console.log(`[AdminAPIConfig] 🔒 认证失败: ${authResult.error}`);
      return new Response(JSON.stringify({
        success: false,
        error: authResult.error
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const adminConfig = authResult.adminConfig;
    const body = await request.json();
    const { action, data } = body;

    console.log(`[AdminAPIConfig] 📝 操作类型: ${action}`);

    switch (action) {
      case 'add':
        return await handleAddAPI(env, adminConfig, data);
      
      case 'update':
        return await handleUpdateAPI(env, adminConfig, data);
      
      case 'delete':
        return await handleDeleteAPI(env, adminConfig, data);
      
      case 'test':
        return await handleTestAPI(data);
      
      case 'get-status':
        return await handleGetStatus(env);
      
      default:
        return new Response(JSON.stringify({
          success: false,
          error: '不支持的操作类型'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

  } catch (error: any) {
    console.error('[AdminAPIConfig] ❌ POST请求失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'API配置操作失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleAddAPI(env: any, adminConfig: any, data: any) {
  try {
    console.log(`[AdminAPIConfig] ➕ 添加API配置: ${data.name}`);

    // 验证必需字段
    const requiredFields = ['name', 'provider', 'baseUrl', 'apiKey', 'model'];
    for (const field of requiredFields) {
      if (!data[field] || data[field].trim() === '') {
        return new Response(JSON.stringify({
          success: false,
          error: `缺少必需字段: ${field}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // 检查名称是否已存在
    if (!adminConfig.api_configs) {
      adminConfig.api_configs = [];
    }

    const existingIndex = adminConfig.api_configs.findIndex(
      config => config.name === data.name
    );

    if (existingIndex !== -1) {
      return new Response(JSON.stringify({
        success: false,
        error: `API配置 "${data.name}" 已存在`
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 创建新配置
    const newConfig = {
      id: Date.now().toString(),
      name: data.name.trim(),
      provider: data.provider,
      base_url: data.baseUrl.trim(),
      api_key: data.apiKey.trim(),
      model: data.model.trim(),
      enabled: data.enabled !== false,
      priority: parseInt(data.priority) || 5,
      error_count: 0,
      last_used: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    adminConfig.api_configs.push(newConfig);

    // 保存配置
    await saveAdminConfig(env, adminConfig);

    console.log(`[AdminAPIConfig] ✅ API配置添加成功: ${data.name}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'API配置添加成功',
      config: newConfig
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error: any) {
    console.error('[AdminAPIConfig] ❌ 添加API配置失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '添加API配置失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleUpdateAPI(env: any, adminConfig: any, data: any) {
  try {
    console.log(`[AdminAPIConfig] ✏️ 更新API配置: ${data.name}`);

    if (!adminConfig.api_configs) {
      return new Response(JSON.stringify({
        success: false,
        error: '没有找到API配置列表'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const index = adminConfig.api_configs.findIndex(
      config => config.name === data.name
    );

    if (index === -1) {
      return new Response(JSON.stringify({
        success: false,
        error: `API配置 "${data.name}" 不存在`
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 更新配置
    const updatedConfig = {
      ...adminConfig.api_configs[index],
      ...data,
      updated_at: new Date().toISOString()
    };

    adminConfig.api_configs[index] = updatedConfig;

    // 保存配置
    await saveAdminConfig(env, adminConfig);

    console.log(`[AdminAPIConfig] ✅ API配置更新成功: ${data.name}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'API配置更新成功',
      config: updatedConfig
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error: any) {
    console.error('[AdminAPIConfig] ❌ 更新API配置失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '更新API配置失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleDeleteAPI(env: any, adminConfig: any, data: any) {
  try {
    console.log(`[AdminAPIConfig] 🗑️ 删除API配置: ${data.name}`);

    if (!adminConfig.api_configs) {
      return new Response(JSON.stringify({
        success: false,
        error: '没有找到API配置列表'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const index = adminConfig.api_configs.findIndex(
      config => config.name === data.name
    );

    if (index === -1) {
      return new Response(JSON.stringify({
        success: false,
        error: `API配置 "${data.name}" 不存在`
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 删除配置
    const deletedConfig = adminConfig.api_configs.splice(index, 1)[0];

    // 保存配置
    await saveAdminConfig(env, adminConfig);

    console.log(`[AdminAPIConfig] ✅ API配置删除成功: ${data.name}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'API配置删除成功',
      config: deletedConfig
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error: any) {
    console.error('[AdminAPIConfig] ❌ 删除API配置失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '删除API配置失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleTestAPI(data: any) {
  try {
    console.log(`[AdminAPIConfig] 🧪 测试API连接: ${data.provider}`);

    const { provider, baseUrl, apiKey, model } = data;

    if (!provider || !baseUrl || !apiKey || !model) {
      return new Response(JSON.stringify({
        success: false,
        error: 'API配置信息不完整'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    let testResult;

    if (provider === 'grok') {
      // 测试Grok API
      const grokAPI = new GrokAPI({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        model: model.trim()
      });

      testResult = await grokAPI.testConnection();
    } else {
      // 其他提供商的测试逻辑
      testResult = {
        success: false,
        message: `不支持的提供商: ${provider}`
      };
    }

    console.log(`[AdminAPIConfig] 🧪 API测试结果:`, testResult);

    return new Response(JSON.stringify({
      success: true,
      testResult: testResult
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error: any) {
    console.error('[AdminAPIConfig] ❌ API测试失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'API测试失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleGetStatus(env: any) {
  try {
    console.log(`[AdminAPIConfig] 📊 获取API状态信息`);

    const apiManager = new APIManager(env);
    const apiStatuses = await apiManager.getDetailedStatus();

    // 统计信息
    const stats = {
      total: apiStatuses.length,
      enabled: apiStatuses.filter(api => api.enabled && !api.disabled).length,
      disabled: apiStatuses.filter(api => api.disabled).length,
      errors: apiStatuses.filter(api => api.errorCount > 0).length
    };

    console.log(`[AdminAPIConfig] 📊 API统计: 总计${stats.total}, 启用${stats.enabled}, 禁用${stats.disabled}, 错误${stats.errors}`);

    return new Response(JSON.stringify({
      success: true,
      statuses: apiStatuses,
      stats: stats
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error: any) {
    console.error('[AdminAPIConfig] ❌ 获取API状态失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '获取API状态失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}