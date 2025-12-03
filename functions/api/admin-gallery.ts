import { Env } from '../types';

// 图片管理API端点
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
        let config;
        try {
            const stored = await env.ADMIN_KV.get('admin_config');
            if (stored) {
                config = JSON.parse(stored);
            } else {
                return new Response(JSON.stringify({ error: '配置不存在' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        } catch (error) {
            console.error('读取配置失败:', error);
            return new Response(JSON.stringify({ error: '读取配置失败' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 验证管理员凭证
        if (body.username !== config.admin_credentials.username || 
            body.password !== config.admin_credentials.password) {
            return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 更新图片池
        if (body.action === 'update_gallery' && body.images) {
            config.gallery_images = body.images;
            try {
                await env.ADMIN_KV.put('admin_config', JSON.stringify(config));
                return new Response(JSON.stringify({ 
                    success: true, 
                    message: '图片池更新成功',
                    count: body.images.length
                }), {
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            } catch (error) {
                console.error('保存图片池失败:', error);
                return new Response(JSON.stringify({ error: '保存图片池失败' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        return new Response(JSON.stringify({ error: '操作类型不支持' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('图片管理API错误:', error);
        return new Response(JSON.stringify({ error: '服务器错误' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
};