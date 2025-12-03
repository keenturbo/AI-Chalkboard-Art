import { Env } from '../types';

// 配置接口定义
interface AdminConfig {
    gallery_images: string[];
    api_configs: Array<{
        name: string;
        url: string;
        key: string;
        model: string;
        enabled: boolean;
    }>;
    prompts: Array<{
        name: string;
        key: string;     // 键值（blackboard、cloud等）
        prompt: string;  // 完整提示词内容
    }>;
    admin_credentials: {
        username: string;
        password: string;
    };
}

// 默认配置 - 修复：移除空的API密钥
const DEFAULT_CONFIG: AdminConfig = {
    gallery_images: [
        'https://pic.icon.pp.ua/generated/IMG_4837.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4839.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4840.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4841.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4848.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4849.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4853.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4855.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4856.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4857.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4860.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4863.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4865.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4867.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4869.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4870.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4871.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4872.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4874.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4875.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4876.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4877.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4879.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4880.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4881.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4882.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4883.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4884.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4885.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4886.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4887.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4889.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4890.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4891.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4892.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4893.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4894.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4895.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4896.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4899.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4900.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4901.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4902.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4905.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4906.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4907.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4908.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4909.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4910.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4911.jpeg',
        'https://pic.icon.pp.ua/generated/IMG_4912.jpeg'
    ],
    // 关键修复：移除空key的API配置，让系统直接使用环境变量
    api_configs: [],  // 改为空数组，系统会直接使用环境变量
    
    prompts: [
        {
            name: '🏫 黑板粉笔画',
            key: 'blackboard',
            prompt: '黑板粉笔画'
        },
        {
            name: '☁️ 现实主义云彩',
            key: 'cloud',
            prompt: '现实主义云彩'
        },
        {
            name: '✏️ 课本铅笔画',
            key: 'textbook',
            prompt: '课本铅笔画'
        }
    ],
    admin_credentials: {
        username: 'admin',
        password: 'admin'
    }
};

// 辅助函数：隐藏密码用于日志输出
function hidePassword(password: string): string {
    if (!password) return '';
    if (password.length <= 2) return '**';
    return password[0] + '*'.repeat(password.length - 2) + password[password.length - 1];
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { env } = context;
        
        // 从KV存储获取配置，如果不存在则使用默认配置
        let config: AdminConfig = DEFAULT_CONFIG;
        
        try {
            console.log('开始读取KV配置...');
            const stored = await env.ADMIN_KV.get('admin_config');
            if (stored) {
                config = JSON.parse(stored);
                console.log('✅ 成功读取KV配置，当前管理员:', 
                    config.admin_credentials.username, 
                    '密码:', hidePassword(config.admin_credentials.password)
                );
            } else {
                console.log('⚠️ KV中没有存储配置，使用默认配置');
            }
        } catch (error) {
            console.error('❌ 读取配置失败，使用默认配置:', error);
        }
        
        return new Response(JSON.stringify(config), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });
        
    } catch (error) {
        console.error('❌ 获取配置失败:', error);
        return new Response(JSON.stringify({ error: '获取配置失败' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { request, env } = context;
        const body = await request.json();
        
        console.log('📥 收到POST请求:', { 
            hasUsername: !!body.username, 
            username: body.username || 'MISSING',
            hasPassword: !!body.password,
            password: hidePassword(body.password || 'MISSING'),
            hasConfig: !!body.config 
        });
        
        // 验证权限
        if (!body.username || !body.password) {
            console.log('❌ 缺少用户名或密码');
            return new Response(JSON.stringify({ error: '需要用户名和密码' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 获取当前配置进行验证
        let config: AdminConfig = DEFAULT_CONFIG;
        try {
            console.log('🔍 验证管理员凭证，开始读取当前配置...');
            const stored = await env.ADMIN_KV.get('admin_config');
            if (stored) {
                config = JSON.parse(stored);
                console.log('✅ 读取到KV配置，存储用户:', config.admin_credentials.username, 
                    '存储密码:', hidePassword(config.admin_credentials.password)
                );
            } else {
                console.log('⚠️ 使用默认配置进行验证 - 用户:', DEFAULT_CONFIG.admin_credentials.username);
            }
        } catch (error) {
            console.error('❌ 读取配置失败:', error);
        }
        
        // 验证管理员凭证
        const storedUsername = config.admin_credentials.username;
        const storedPassword = config.admin_credentials.password;
        
        console.log('🔐 认证比对:', {
            提供用户名: body.username,
            存储用户名: storedUsername,
            用户名匹配: body.username === storedUsername,
            提供密码: hidePassword(body.password),
            存储密码: hidePassword(storedPassword),
            密码匹配: body.password === storedPassword
        });
        
        if (body.username !== storedUsername || body.password !== storedPassword) {
            console.log('❌ 认证失败 - 用户名或密码不匹配');
            return new Response(JSON.stringify({ 
                error: '用户名或密码错误',
                debug: {
                    providedUsername: body.username,
                    storedUsername: storedUsername,
                    passwordMatch: body.password === storedPassword
                }
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        console.log('✅ 认证成功！');
        
        // 更新配置
        if (body.config) {
            try {
                console.log('💾 开始保存配置到KV...');
                if (body.config.admin_credentials) {
                    console.log('📝 新配置的管理员:', body.config.admin_credentials.username, 
                        '新密码:', hidePassword(body.config.admin_credentials.password)
                    );
                }
                
                await env.ADMIN_KV.put('admin_config', JSON.stringify(body.config));
                console.log('✅ 配置保存成功！');
                
                return new Response(JSON.stringify({ success: true, message: '配置更新成功' }), {
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                    }
                });
            } catch (error) {
                console.error('❌ 保存配置失败:', error);
                return new Response(JSON.stringify({ error: '保存配置失败: ' + error.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        // 只返回配置（用于验证）
        return new Response(JSON.stringify(config), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });
        
    } catch (error) {
        console.error('❌ 保存配置失败:', error);
        return new Response(JSON.stringify({ error: '保存配置失败: ' + error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// 简化的PUT方法 - 支持修改密码和完整配置更新
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const { request, env } = context;
        const body = await request.json();
        
        console.log('🔄 收到PUT请求:', { 
            hasUsername: !!body.username,
            username: body.username || 'MISSING',
            hasPassword: !!body.password,
            password: hidePassword(body.password || 'MISSING'),
            hasConfig: !!body.config,
            action: body.action || 'unknown'
        });
        
        // 验证当前凭证
        if (!body.username || !body.password) {
            console.log('❌ 缺少当前用户名或密码');
            return new Response(JSON.stringify({ error: '需要当前用户名和密码' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 获取当前配置
        let config: AdminConfig = DEFAULT_CONFIG;
        try {
            const stored = await env.ADMIN_KV.get('admin_config');
            if (stored) {
                config = JSON.parse(stored);
            }
            console.log('📖 读取到当前配置，用户:', config.admin_credentials.username);
        } catch (error) {
            console.error('❌ 读取配置失败:', error);
        }
        
        // 验证当前凭证
        if (body.username !== config.admin_credentials.username || 
            body.password !== config.admin_credentials.password) {
            console.log('❌ 认证失败 - 当前用户名或密码错误');
            return new Response(JSON.stringify({ error: '当前用户名或密码错误' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 更新配置
        try {
            if (body.config) {
                // 完整配置更新
                config = { ...config, ...body.config };
                console.log('📝 完整配置更新');
            }
            
            await env.ADMIN_KV.put('admin_config', JSON.stringify(config));
            console.log('✅ 配置保存成功！');
            
            return new Response(JSON.stringify({ 
                success: true, 
                message: '配置更新成功',
                config: config
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                }
            });
        } catch (error) {
            console.error('❌ 配置更新失败:', error);
            return new Response(JSON.stringify({ error: '配置更新失败: ' + error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
    } catch (error) {
        console.error('❌ PUT请求处理失败:', error);
        return new Response(JSON.stringify({ error: '请求失败: ' + error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
};