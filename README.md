# 🖼️AI Chalkboard Art Generator (AI 黑板画生成器)

一个基于 Cloudflare 全栈架构 (Pages + Functions + R2) 的 AI 绘画应用。
用户输入角色名称，AI 自动生成逼真的黑板粉笔画风格图像，并永久存储在云端。

[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/keenturbo/AI-Chalkboard-Art)

[Demo](https://anime.icon.pp.ua)

## ✨ 特性

- **零成本架构**：完全基于 Cloudflare 免费层 (Pages, Workers, R2)。
- **多模型支持**：支持 Google Gemini-3-pro-image-preview, 香蕉大模型, Imagen 3, 或任何兼容 Gemini 协议的模型。
- **极速体验**：全球 CDN 加速，Serverless 后端毫秒级响应。
- **永久存储**：生成的画作自动保存至 Cloudflare R2 对象存储。

---

## 🛠️ 准备工作

在开始之前，请确保你拥有：

1.  **GitHub 账号**：用于存放代码。
2.  **Cloudflare 账号**：用于部署应用和存储图片。
3.  **Google AI Studio API Key**：[点击申请](https://aistudio.google.com/app/apikey)。

---

## 🚀 一键部署 (推荐)

点击上方按钮 **[Deploy to Cloudflare Pages]**，即可自动部署。

部署完成后，只需在 Cloudflare 后台配置以下两项：

1.  **环境变量**：在项目 Settings -> Environment variables 中设置：
    *   `GEMINI_API_KEY`: 你的 Google API Key
    *   `AI_MODEL_NAME`: `gemini-3-pro-image-preview`
    *   `R2_PUBLIC_DOMAIN`: 你的 R2 公开域名
    
2.  **R2 存储桶绑定**：在 Settings -> Functions -> R2 Bucket Bindings 中：
    *   Variable name: `R2_BUCKET`
    *   选择你的 R2 bucket

然后重试部署即可。

---

## 🚀 保姆级手动部署教程

### 第一步：Fork 仓库
点击右上角的 **Fork** 按钮，将本仓库复制到你自己的 GitHub 账号下。

### 第二步：配置 Cloudflare R2 (存储桶)
*这是最关键的一步，很多人在这里卡住，请仔细操作。*

1.  登录 Cloudflare Dashboard，左侧菜单选择 **R2**。
2.  点击 **Create bucket** (创建存储桶)。
    *   **Bucket name**: 输入 `ai-chalkboard-art-images` (或你喜欢的名字)。
    *   **Location区域**: 选 `Automatic自动` 即可，默认标准存储。
    *   点击 **Create Bucket创建存储桶**。
3.  **开启公开访问** (必须做，否则前端图片无法显示)：
    *   进入刚才创建的 存储桶bucket。
    *   点击顶部的 **Settings (设置)** 标签页。
    *   向下滚动找到 **Public access (公开访问)公共开发 URL**。点击启用。
    *   **方案 A (推荐)**: 点击 **Connect Custom Domain自定义域名**，绑定一个你自己的二级域名 (如 `pic.yourdomain.com`)。
    *   **方案 B (简单)**: 点击 **R2.dev subdomain** 下的 "Allow Access"，获得一个 `pub-xxx.r2.dev` 的地址。
    *   **记下这个域名**，稍后要用。

### 第三步：创建 Cloudflare Pages 项目
*⚠️ 避坑预警：千万不要创建成 "Worker" 项目！*

1.  回到 Cloudflare Dashboard 主页，点击左侧 **Workers & Pages**。
2.  点击蓝色按钮 **Create application** (创建应用)。
3.  **关键点**：点击底部的 **Pages** 标签页 (Cloudflare改版了，注意下面小字`Pages`)。
4.  点击 **Connect to Git**。
5.  选择你刚才 Fork 的 `AI-Chalkboard-Art` 仓库。（Cloudflare绑定你的GitHub账户）
6.  **配置构建参数** (请严格照抄，不要自己发挥)：
    *   **Project name**: 随意 (如 `ai-chalkboard-art`)。
    *   **Production branch**: `main`。
    *   **Framework preset**: `None` 。
    *   **Build command (构建命令)**: **留空！什么都别填！** 
    *   **Build output directory (构建输出目录)**: `public` (⚠️必须填这个)。

### 第四步：设置环境变量
在创建页面的下方，或者项目创建后的 **Settings -> Environment variables** 中添加：

| 变量名 | 示例值 | 说明 |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | `AIzaSyD...` | 你的 Google API Key |
| `AI_MODEL_NAME` | `gemini-3-pro-image-preview` | 推荐使用 Gemini香蕉图片模型 |
| `R2_PUBLIC_DOMAIN` | `https://pic.yourdomain.com` | **必须填**。第二步中获得的 R2 域名 (带 https) |
| `AI_MODEL_URL` | (留空) | 除非你用第三方中转，否则**不要填**，直接删掉此行 |

### 第五步：绑定 R2 存储桶
*代码要访问 R2，必须先在后台"插上电"。*

1.  项目创建完成后，进入 **Settings (设置)** -> **绑定Pages Functions (函数)**。
2.  找到 **R2 Bucket Bindings** (R2 存储桶绑定)。
3.  点击 **Add binding** (添加绑定)。
4.  **Variable name (变量名)**: 必须填 `R2_BUCKET` (大小写敏感，必须完全一致)。
5.  **R2 Bucket**: 选择你在第二步创建的那个 bucket。
6.  点击 **Save**。

### 第六步：重新部署
因为刚才修改了绑定和环境变量，需要重新部署才能生效。

1.  进入 **Deployments (部署)** 标签页。
2.  点击最新一次部署右侧的 **...** -> **Retry deployment (重试部署)**。
3.  等待几秒钟，看到 "Success" 后，点击访问链接即可体验！

---

## ☠️ 避坑指南 (常见错误)

1.  **错误：页面显示空白**
    *   **原因**：构建输出目录没填 `public`，或者填成了 `/`。
    *   **解法**：去 Settings -> Builds 修改 Output directory 为 `public`。

2.  **错误：Deploy Failed (Sh: wrangler not found)**
    *   **原因**：你在构建命令里填了 `npm run deploy`。
    *   **解法**：去 Settings -> Builds 把 Build command 清空。

3.  **错误：图片生成了但显示裂图 (403 Forbidden)**
    *   **原因**：R2 存储桶没有开启 Public Access，或者环境变量 `R2_PUBLIC_DOMAIN` 填错了。
    *   **解法**：检查 R2 设置，确保域名能直接访问图片。

4.  **错误：API 404 (Model not found)**
    *   **原因**：模型名称填错了，或者用了旧版代码去调新版模型。
    *   **解法**：确保 `AI_MODEL_NAME` 是 `gemini-3-pro-image-preview` 这种有效 ID，且代码已更新到最新版。

---

## 🛠️ 本地开发 (可选)

如果你想在本地修改代码：

1.  安装依赖：`npm install`
2.  登录 Cloudflare：`npx wrangler login`
3.  启动本地服务：`npm run dev`

注意：本地开发需要配置 `.dev.vars` 文件来模拟环境变量。

```env
# .dev.vars
GEMINI_API_KEY=your_key
R2_PUBLIC_DOMAIN=https://your-r2-domain.com
AI_MODEL_NAME=gemini-3-pro-image-preview
```