# 🖼️AI Chalkboard Art Generator (AI 黑板画生成器)🖼️

一个基于`Cloudflare`全栈架构 (Pages + Functions + R2) 的 AI 绘画应用。
用户输入角色名称，AI 自动生成逼真的黑板粉笔画风格图像，并永久存储在云端。

[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/keenturbo/AI-Chalkboard-Art)

[Demo](https://anime.icon.pp.ua)

## ✨ 特性

- **零成本架构**：完全基于 Cloudflare 免费层 (Pages, Workers, R2)。
- **多层API智能兜底**：支持 Google Gemini-3-pro-image-preview、香蕉大模型、Grok API、第三方API，3层故障保护机制。
- **智能提示词优化**：内置黑板画专业提示词库 + GPT-4o 优化算法。
- **极速体验**：全球 CDN 加速，Serverless 后端毫秒级响应。
- **永久存储**：生成的画作自动保存至 Cloudflare R2 对象存储。
- **强大管理后台**：Token认证的配置管理，支持API配置和提示词管理。

---

## 🎯 新鲜事设定 (2025年更新)

### 🔄 智能API兜底系统
项目已升级为**多模型容错架构**，确保服务高可用性：

1. **第一优先级**: Google Gemini API (环境变量配置)
2. **第二优先级**: 第三方API池 (管理后台配置)
   - 香蕉大模型 (极速生图)
   - Grok API (智能模型)
   - 自定义API (开放接口)
3. **第三层保护**: 紧急恢复模式
4. **智能故障转移**: 单个API失败3次后自动禁用30分钟

### 🎨 AI提示词2.0引擎
- **黑板画专业提示词库**: 内置黑板画专用提示词
- **智能优化**: 自动优化用户输入，提升生成质量
- **多风格支持**: 传统黑板画、彩色粉笔画、艺术混搭风格

### 🔒 企业级管理后台
- **安全Token认证**: 12位随机Token，防暴力破解
- **实时健康监控**: API状态实时显示，自动故障检测
- **配置热更新**: 无需重启，配置立即生效
- **图片库管理**: 生成历史查看，批量管理功能

---

## 🛠️ 准备工作

在开始之前，请确保你拥有：

1. **GitHub 账号**：用于存放代码。
2. **Cloudflare 账号**：用于部署应用和存储图片。
3. **Google AI Studio 付费层级API Key**：[点击申请](https://aistudio.google.com/app/apikey)。
4. **第三方API密钥 (可选)**：香蕉大模型、Grok API等，用于多模型兜底。

---

## 🚀 一键部署 (推荐)

点击上方按钮 **[Deploy to Cloudflare Pages]**，即可自动部署。Cloudflare改版或失效。

部署完成后，只需在 Cloudflare 后台配置以下三项：

1. **环境变量**：在项目 Settings -> Environment variables 中设置：
   - `GEMINI_API_KEY`: 你的 Google API Key
   - `AI_MODEL_NAME`: `gemini-3-pro-image-preview`
   - `R2_PUBLIC_DOMAIN`: 你的 R2 公开域名
   - `ENV_SECRET_KEY`: 管理后台登录密钥 (建议设置)

2. **R2 存储桶绑定**：在 Settings -> Functions -> R2 Bucket Bindings 中：
   - Variable name: `R2_BUCKET`
   - 选择你的 R2 bucket

3. **KV 命名空间绑定**：在 Settings -> Functions -> KV namespace bindings 中：
   - Variable name: `ADMIN_KV`
   - 创建并选择KV命名空间

然后重试部署即可。

---

## 🚀 保姆级手动部署教程

### 第一步：Fork 仓库
点击右上角的 **Fork** 按钮，将本仓库复制到你自己的 GitHub 账号下。

### 第二步：配置 Cloudflare R2 (存储桶)
*这是最关键的一步，很多人在这里卡住，请仔细操作。*

1. 登录 Cloudflare Dashboard，左侧菜单选择 **R2**。
2. 点击 **Create bucket** (创建存储桶)。
   - **Bucket name**: 输入 `ai-chalkboard-art-images` (或你喜欢的名字)。
   - **Location区域**: 选 `Automatic自动` 即可，默认标准存储。
   - 点击 **Create Bucket创建存储桶**。
3. **开启公开访问** (必须做，否则前端图片无法显示)：
   - 进入刚才创建的 存储桶bucket。
   - 点击顶部的 **Settings (设置)** 标签页。
   - 向下滚动找到 **Public access (公开访问)公共开发 URL**。点击启用。
   - **方案 A (推荐)**: 点击 **Connect Custom Domain自定义域名**，绑定一个你自己的二级域名 (如 `pic.yourdomain.com`)。
   - **方案 B (简单)**: 点击 **R2.dev subdomain** 下的 "Allow Access"，获得一个 `pub-xxx.r2.dev` 的地址。
   - **记下这个域名**，稍后要用。

### 第三步：创建 KV 命名空间
*⚠️ 管理后台配置数据存储必需步骤*

1. **创建命名空间**：
   - 在 Cloudflare Dashboard 左侧菜单，点击 **Workers & Pages**。
   - 在左侧子菜单中点击 **KV**。
   - 点击 **Create namespace**（创建命名空间）。
   - **Namespace name**：填 `admin-config`（或其他你喜欢的名字）
   - 点击 **Add**。

2. **复制 KV ID**（备用，但主要是选择绑定）：
   - 创建成功后，进入该 KV 命名空间的 **Settings** 页面  
   - 页面 URL 中类似：`.../workers/kv/namespaces/abc123def456/settings`
   - **复制 `abc123def456`** 这就是 KV ID（备用）

### 第四步：创建 Cloudflare Pages 项目
*⚠️ 避坑预警：千万不要创建成 "Worker" 项目！*

1. 回到 Cloudflare Dashboard 主页，点击左侧 **Workers & Pages**。
2. 点击蓝色按钮 **Create application** (创建应用)。
3. **关键点**：点击底部的 **Pages** 标签页 (Cloudflare改版了，注意下面小字`Pages`)。
4. 点击 **Connect to Git**。
5. 选择你刚才 Fork 的 `AI-Chalkboard-Art` 仓库。（Cloudflare绑定你的GitHub账户）
6. **配置构建参数** (请严格照抄，不要自己发挥)：
   - **Project name**: 随意 (如 `ai-chalkboard-art`)。
   - **Production branch**: `main`。
   - **Framework preset**: `None` 。
   - **Build command (构建命令)**: **留空！什么都别填！** 
   - **Build output directory (构建输出目录)**: `public` (⚠️必须填这个)。

### 第五步：绑定 KV 命名空间
*管理后台要运行，必须先绑定 ADMIN_KV*

1. 项目创建完成后，进入 **Settings (设置)** -> **函数绑定**。
2. 找到 **KV namespace bindings**（KV 命名空间绑定）。
3. 点击 **Add binding**（添加绑定）：
   - **Variable name**: `ADMIN_KV`（**必须是这个！大小写敏感**）
   - **KV namespace**: 选择你在第三步创建的 `admin-config`
   - 点击 **Save**。

### 第六步：设置环境变量
在创建页面的下方，或者项目创建后的 **Settings -> Environment variables** 中添加：

| 变量名 | 示例值 | 说明 |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | `AIzaSyD...` | 你的 Google API Key |
| `AI_MODEL_NAME` | `gemini-3-pro-image-preview` | 推荐使用 Gemini图片模型 |
| `R2_PUBLIC_DOMAIN` | `https://pic.yourdomain.com` | **必须填**。第二步中获得的 R2 域名 (带 https) |
| `ENV_SECRET_KEY` | `admin123` | 管理后台密码 (建议设置复杂) |
| `AI_MODEL_URL` | (留空) | 除非你用第三方中转，否则**不要填**，直接删掉此行 |

### 第七步：绑定 R2 存储桶
*代码要访问 R2，必须先在后台"插上电"。*

1. 项目创建完成后，进入 **Settings (设置)** -> **函数绑定**。
2. 找到 **R2 Bucket Bindings** (R2 存储桶绑定)。
3. 点击 **Add binding** (添加绑定)。
4. **Variable name (变量名)**: 必须填 `R2_BUCKET` (大小写敏感，必须完全一致)。
5. **R2 Bucket**: 选择你在第二步创建的那个 bucket。
6. 点击 **Save**。

### 第八步：重新部署
因为刚才修改了绑定和环境变量，需要重新部署才能生效。

1. 进入 **Deployments (部署)** 标签页。
2. 点击最新一次部署右侧的 **...** -> **Retry deployment (重试部署)**。
3. 等待几秒钟，看到 "Success" 后，点击访问链接即可体验！

---

## 🔧 管理后台使用指南

### 点击右上角⚙️访问管理后台
1. 访问 `你的域名/admin`
2. 输入环境变量中设置的 `ENV_SECRET_KEY`默认admin@admin，强烈建议进入后修改用户名密码。
3. 即可进入管理控制台

### 多模型API配置
1. **添加第三方API**：
   - 在"API配置管理"页面添加新的API
   - 设置优先级（数字越小优先级越高）
   - 填写API密钥和端点

2. **监控API状态**：
   - 实时查看各个API的健康状态
   - 查看调用次数和失败次数
   - 手动启用/禁用API

3. **提示词管理**：
   - 编辑黑板画专用提示词
   - 开启智能优化
   - 自定义风格模板

---

## ☠️ 避坑指南 (常见错误)

1. **错误：页面显示空白**
   - **原因**：构建输出目录没填 `public`，或者填成了 `/`。
   - **解法**：去 Settings -> Builds 修改 Output directory 为 `public`。

2. **错误：Deploy Failed (Sh: wrangler not found)**
   - **原因**：你在构建命令里填了 `npm run deploy`。
   - **解法**：去 Settings -> Builds 把 Build command 清空。

3. **错误：图片生成了但显示裂图 (403 Forbidden)**
   - **原因**：R2 存储桶没有开启 Public Access，或者环境变量 `R2_PUBLIC_DOMAIN` 填错了。
   - **解法**：检查 R2 设置，确保域名能直接访问图片。

4. **错误：API 404 (Model not found)**
   - **原因**：模型名称填错了，或者用了旧版代码去调新版模型。
   - **解法**：确保 `AI_MODEL_NAME` 是 `gemini-3-pro-image-preview` 这种有效 ID，且代码已更新到最新版。

5. **错误：管理后台无法登录**
   - **原因**：`ENV_SECRET_KEY` 未设置或错误。
   - **解法**：在环境变量中正确设置密码，重新部署后生效。

6. **错误：管理后台无法打开 (405错误)**
   - **原因**：ADMIN_KV 没有绑定或 Variable name 填写错误。
   - **解法**：确保 KV namespace bindings 中 Variable name 是 `ADMIN_KV`（大小写敏感）。

7. **错误：API配置无法保存**
   - **原因**：KV 命名空间绑定缺失或配置错误。
   - **解法**：重新检查 KV namespace bindings，确保 `ADMIN_KV` 正确绑定。

8. **错误：所有API都失败**
   - **原因**：可能是网络问题或API密钥失效。
   - **解法**：检查管理后台API状态，更新密钥，等待30分钟自动恢复。

---

## 🛠️ 本地开发 (可选)

如果你想在本地修改代码：

1. 安装依赖：`npm install`
2. 登录 Cloudflare：`npx wrangler login`
3. 启动本地服务：`npm run dev`

注意：本地开发需要配置 `.dev.vars` 文件来模拟环境变量。

```env
# .dev.vars
GEMINI_API_KEY=your_key
R2_PUBLIC_DOMAIN=https://your-r2-domain.com
AI_MODEL_NAME=gemini-3-pro-image-preview
ENV_SECRET_KEY=admin123
```

---

## 🔍 技术架构详解

### 前端架构
```
public/
├── index.html          # 用户主界面
└── admin.html          # 管理后台
```

### 后端架构
```
functions/
├── api/                # API端点
│   ├── generate.ts     # 主要生成接口
│   ├── generate-new.ts # 智能兜底接口
│   ├── admin-config.ts # 管理配置
│   └── admin-api-config.ts # API管理
├── lib/                # 核心库
│   ├── api-manager.ts  # 多API管理器
│   ├── image-generator.ts # 图片生成器
│   ├── prompts.ts      # 提示词引擎
│   └── key-manager.ts  # 密钥管理
└── types.ts            # 类型定义
```

### 数据存储架构
- **R2 存储桶**: 存储生成的图片文件
- **KV 命名空间 (ADMIN_KV)**: 存储管理后台的配置数据
  - API配置信息 (apis key)
  - 提示词配置 (prompts key)
  - 用户配置数据

### 数据流
1. 用户输入 → 前端处理 → API调用 → 多层兜底 → 图片生成 → R2存储 → 返回结果
2. 管理后台 → 认证 → API配置 → 存储到ADMIN_KV → 实时更新

---

## 📞 支持

如果遇到问题：
1. 查看 [Issues](https://github.com/keenturbo/AI-Chalkboard-Art/issues)
2. 参考 [Wiki](https://github.com/keenturbo/AI-Chalkboard-Art/wiki) 文档
3. 提交新的 Issue 寻求帮助

---

## 📄 开源协议

本项目采用 MIT 协议，欢迎 Star 和 Fork！