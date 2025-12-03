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

// 默认配置
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
    api_configs: [
        {
            name: 'Google Gemini',
            url: 'https://generativelanguage.googleapis.com/v1beta/models',
            key: '',
            model: 'gemini-3-pro-image-preview',
            enabled: true
        }
    ],
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { env } = context;
        
        // 从KV存储获取配置，如果不存在则使用默认配置
        let config: AdminConfig = DEFAULT_CONFIG;
        
        try {
            const stored = await env.ADMIN_KV.get('admin_config');
            if (stored) {
                config = JSON.parse(stored);
            }
        } catch (error) {
            console.error('读取配置失败，使用默认配置:', error);
        }
        
        return new Response(JSON.stringify(config), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
        
    } catch (error) {
        console.error('获取配置失败:', error);
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
        
        // 验证权限
        if (!body.username || !body.password) {
            return new Response(JSON.stringify({ error: '需要用户名和密码' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 获取当前配置进行验证
        let config: AdminConfig = DEFAULT_CONFIG;
        try {
            const stored = await env.ADMIN_KV.get('admin_config');
            if (stored) {
                config = JSON.parse(stored);
            }
        } catch (error) {
            console.error('读取配置失败:', error);
        }
        
        // 验证管理员凭证
        if (body.username !== config.admin_credentials.username || 
            body.password !== config.admin_credentials.password) {
            return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 更新配置
        if (body.config) {
            try {
                await env.ADMIN_KV.put('admin_config', JSON.stringify(body.config));
                return new Response(JSON.stringify({ success: true, message: '配置更新成功' }), {
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            } catch (error) {
                console.error('保存配置失败:', error);
                return new Response(JSON.stringify({ error: '保存配置失败' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        // 只返回配置（用于验证）
        return new Response(JSON.stringify(config), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
        
    } catch (error) {
        console.error('保存配置失败:', error);
        return new Response(JSON.stringify({ error: '保存配置失败' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// 新增：添加 PUT 方法支持
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const { request, env } = context;
        const body = await request.json();
        
        // 验证权限
        if (!body.username || !body.password) {
            return new Response(JSON.stringify({ error: '需要用户名和密码' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 获取当前配置进行验证
        let config: AdminConfig = DEFAULT_CONFIG;
        try {
            const stored = await env.ADMIN_KV.get('admin_config');
            if (stored) {
                config = JSON.parse(stored);
            }
        } catch (error) {
            console.error('读取配置失败:', error);
        }
        
        // 验证管理员凭证
        if (body.username !== config.admin_credentials.username || 
            body.password !== config.admin_credentials.password) {
            return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 更新配置
        if (body.config) {
            try {
                await env.ADMIN_KV.put('admin_config', JSON.stringify(body.config));
                return new Response(JSON.stringify({ success: true, message: '配置更新成功' }), {
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            } catch (error) {
                console.error('保存配置失败:', error);
                return new Response(JSON.stringify({ error: '保存配置失败' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        // 只返回配置（用于验证）
        return new Response(JSON.stringify(config), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
        
    } catch (error) {
        console.error('保存配置失败:', error);
        return new Response(JSON.stringify({ error: '保存配置失败' }), { 
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
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
};