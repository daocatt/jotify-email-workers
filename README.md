# Jotify Email Workers V2

这是一个基于 **Cloudflare Workers** 部署的全栈邮件转发与 API Webhook 投递面板。它作为一个独立的中间件，帮助用户自定义管理域名下的邮件路由规则。

## 💡 主要功能

1. **多租户控制面板：**
   * 管理员/超级管理员审核注册。
   * 用户可自主登录并管理自己的收信规则。
   * 采用 Better Auth 进行安全的身份验证。

2. **邮件路由转发 (Email Forwarding)：**
   * 支持添加自定义收信域名。
   * 支持通过**正则表达式**匹配收件用户名，并将邮件直接转发到指定的目标邮箱。
   * *示例：* 匹配 `u.*@yourdomain.com` 转发到 `target@gmail.com`。

3. **API 接口集成 (Webhook Rules)：**
   * 支持配置多个 Webhook 回调地址（支持 Bearer Token 或自定义 Header 认证）。
   * 支持通过**正则表达式**匹配收件用户名，解析出邮件的 `Subject`（主题）和 `Text`（纯文本），并以 JSON 格式发送 Post 请求。
   * *示例：* 匹配 `jot_.*@yourdomain.com` 投递到你自建的 Jotify 系统 API。

## 🛠️ 快速配置与部署

1. **准备环境文件：**
   将 `.dev.vars.example` 复制为 `.dev.vars`，并修改其中的 `BETTER_AUTH_SECRET`、`RESEND_API_KEY` 和默认管理员凭据（`SUPERADMIN_EMAIL` 与 `SUPERADMIN_PASSWORD`，默认管理员邮箱为 `jotify@zwq.me`）。

2. **数据库初始化：**
   ```bash
   npx drizzle-kit generate
   npx wrangler d1 migrations apply DB --local
   # 线上部署
   npx wrangler d1 migrations apply DB --remote
   ```

3. **编译并部署：**
   ```bash
   npm run build
   npm run deploy
   ```

4. **Cloudflare 域名解析与 Email Routing：**
   在 Cloudflare 控制台中将目标域名的 Email Routing 开启 **Catch-all** 规则，并将其直接路由到你部署的 `jotify-email-workers`。
