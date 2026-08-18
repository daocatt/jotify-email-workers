# Jotify Email Router - 第三方 Webhook 接收端开发文档

本文档面向第三方开发者，详细阐述如何接收、验证和处理由 **Jotify Email Router** 转发推送的入站邮件 Webhook 数据。

---

## 1. 概述与推送流程

当外部发件人向您配置在 Jotify 的域名（如 `support@yourdomain.com`）发送邮件时：

1. **邮件接入**：Cloudflare Email Routing 接收邮件并触发 Worker。
2. **规则匹配与解析**：系统根据配置的用户名正则表达式和子域名匹配目标 Webhook，提取发件人、收件人、主题、正文，并将附件自动上传转存至 Cloudflare R2。
3. **HTTP POST 推送**：构造 JSON 数据并计算 HMAC 签名，向第三方 Webhook URL 发起 POST 请求。
4. **状态与重试**：接收端需在 **15 秒** 内返回 `2xx`；若失败则进入分级指数退避队列自动重试，全部重试耗尽后写入死信记录库。

---

## 2. 请求规范与 Headers

* **HTTP Method**: `POST`
* **Content-Type**: `application/json; charset=utf-8`
* **请求超时时间**: `15 秒`（接收端须在此时间内响应）

### HTTP Headers 说明

| Header 字段 | 必选/可选 | 示例值 | 说明 |
| :--- | :--- | :--- | :--- |
| `Content-Type` | 必选 | `application/json` | 数据以 JSON 格式传输 |
| `X-Jotify-Delivery-Id` | 必选 | `jotify/webhook/12/f47ac10b-58cc-4372-a567-0e02b2c3d479` | 全局唯一投递 ID，接收端用于**幂等去重** |
| `X-Jotify-Signature` | 推荐 | `a3f890b34e2c...` (64位 Hex) | 使用 `WEBHOOK_SIGNING_SECRET` 对 Raw Body 进行 HMAC-SHA256 计算得出的签名 |
| `Authorization` | 按需 | `Bearer your_token` | 当 Webhook 鉴权方式配置为 `Bearer Token` 时携带 |
| 自定义 Header | 按需 | `X-Api-Key: secret` | 当 Webhook 鉴权配置为 `Custom Header` 时携带 |

---

## 3. 推送数据结构 (Payload Schema)

### JSON 示例

```json
{
  "to": "support@yourdomain.com",
  "from": "client@example.com",
  "subject": "关于服务咨询与报价单附件",
  "text": "您好，随信附上我们最新的项目需求和报价单，请查阅附件并尽快与我联系。谢谢！",
  "html": "<div dir=\"ltr\"><p>您好，随信附上我们最新的项目需求和报价单，请查阅附件并尽快与我联系。</p><p>谢谢！</p></div>",
  "rawSize": 45892,
  "attachments": [
    {
      "filename": "quotation_2026.pdf",
      "mimeType": "application/pdf",
      "size": 32768,
      "url": "https://assets.yourdomain.com/202608/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/quotation_2026.pdf"
    }
  ],
  "delivery_id": "jotify/webhook/12/f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

### 字段说明表

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `to` | `string` | 收件人完整邮箱地址（如 `support@yourdomain.com`） |
| `from` | `string` | 发件人完整邮箱地址（如 `client@example.com`） |
| `subject` | `string` | 邮件主题，若原邮件无主题则为空字符串 `""` |
| `text` | `string` | 邮件纯文本内容。若邮件为 HTML 格式，系统会自动剥离 HTML 标签后返回纯文本正文 |
| `html` | `string \| null` | 邮件原始富文本 HTML 内容（保留标签与排版），若原邮件无 HTML 则为 `null` |
| `rawSize` | `number` | 原始邮件总字节大小（单位：Byte） |
| `attachments` | `array<object>` | 附件列表。若未配置 R2 或无附件则为空数组 `[]`。每个对象包含：<br>• `filename` (string): 文件名<br>• `mimeType` (string): MIME 类型<br>• `size` (number): 字节大小<br>• `url` (string): 签名下载直链（默认 60 天有效） |
| `delivery_id` | `string` | 全局唯一投递 ID，格式 `jotify/webhook/{webhookId}/{uuid}`，建议作为去重键（Idempotency Key） |

---

## 4. HMAC 签名验证机制

服务端使用配置的 `WEBHOOK_SIGNING_SECRET` 与 UTF-8 编码的 Raw Body 进行 HMAC-SHA256 计算：

$$\text{Signature} = \text{HMAC-SHA256}(\text{Secret}, \text{Raw JSON Body})$$

> **⚠️ 注意事项**：
> 1. 计算 HMAC 时必须使用接收到的 **原始 Raw Body 字节流或字符串**，切勿在反序列化 JSON 之后重新 stringify 计算。
> 2. 比对签名时请使用恒定时间比较函数（如 `crypto.timingSafeEqual` 或 `hmac.compare_digest`），避免时序攻击。

---

## 5. 响应要求与最佳实践

1. **响应状态码**：必须返回 HTTP `2xx`（例如 `200 OK`、`202 Accepted`、`204 No Content`）。
2. **响应时间限制**：须在 **15 秒** 内完成响应，否则视为超时并触发重试。
3. **异步处理建议**：如需调用大模型分析、大文件处理或长业务链，建议在收到 Webhook 后**立刻返回 200 OK**，并将数据转入自身消息队列异步处理。
4. **幂等去重**：利用 `delivery_id` 在 Redis 或数据库中做去重（如 `SETNX webhook:dedup:{delivery_id} 1 EX 86400`），避免网络重试引发重复处理。

---

## 6. 重试策略与死信队列

Jotify 提供多层递进式重试机制：

* **内存即时重试**：失败后在 Worker 内即时重试 2 次（间隔 1s, 2s）。
* **队列短期退避**：第 1 ~ 9 次队列重试，每 5 分钟重试一次。
* **队列中期退避**：第 10 ~ 14 次队列重试，每 60 分钟重试一次。
* **队列长期退避**：第 15 ~ 17 次队列重试，每 3 小时重试一次。
* **死信队列持久化 (DLQ)**：全部约 20 次尝试（跨度超 24 小时）耗尽后，归档至数据库的「投递失败记录」表，支持管理员在后台手动点击重新投递。

---

## 7. 接收端示例代码

### Node.js (Express / TypeScript)

```typescript
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

const SIGNING_SECRET = process.env.WEBHOOK_SIGNING_SECRET || '';

function verifySignature(rawBody: string, signature?: string): boolean {
  if (!signature || !SIGNING_SECRET) return true;
  const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

app.post('/webhook/jotify-email', (req: any, res) => {
  const signature = req.headers['x-jotify-signature'];
  const deliveryId = req.headers['x-jotify-delivery-id'] || req.body.delivery_id;

  if (signature && !verifySignature(req.rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { to, from, subject, text, attachments } = req.body;
  console.log(`[Webhook] 收到邮件 ${from} -> ${to}, 主题: ${subject}`);

  return res.status(200).json({ ok: true, delivery_id: deliveryId });
});

app.listen(3000, () => console.log('Listening on port 3000'));
```

### Python (FastAPI)

```python
import hmac
import hashlib
import os
from fastapi import FastAPI, Request, HTTPException, Header
from typing import Optional

app = FastAPI()
SIGNING_SECRET = os.getenv("WEBHOOK_SIGNING_SECRET", "")

@app.post("/webhook/jotify-email")
async def handle_webhook(
    request: Request,
    x_jotify_signature: Optional[str] = Header(None),
    x_jotify_delivery_id: Optional[str] = Header(None)
):
    raw_body = await request.body()
    if x_jotify_signature and SIGNING_SECRET:
        expected = hmac.new(SIGNING_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, x_jotify_signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()
    print(f"收到邮件: {payload.get('from')} -> {payload.get('to')}, 主题: {payload.get('subject')}")
    return {"status": "success", "delivery_id": x_jotify_delivery_id or payload.get("delivery_id")}
```
