import React, { useState } from 'react';
import {
  Server, ShieldCheck, ArrowLeft, Copy, Check, Terminal,
  Code2, RefreshCw, AlertTriangle, FileText, CheckCircle2,
  ExternalLink, Layers, Database, Lock, Globe, Mail, ChevronRight
} from 'lucide-react';
import { DbUser } from './types';

interface DocsProps {
  user: DbUser | null;
  onBack: () => void;
}

export default function Docs({ user, onBack }: DocsProps) {
  const [activeLang, setActiveLang] = useState<'nodejs' | 'python' | 'go' | 'php'>('nodejs');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const samplePayload = {
    to: "support@yourdomain.com",
    from: "client@example.com",
    subject: "关于服务咨询与报价单附件",
    text: "您好，随信附上我们最新的项目需求和报价单，请查阅附件并尽快与我联系。谢谢！",
    html: "<div dir=\"ltr\"><p>您好，随信附上我们最新的项目需求和报价单，请查阅附件并尽快与我联系。</p><p>谢谢！</p></div>",
    rawSize: 45892,
    attachments: [
      {
        filename: "quotation_2026.pdf",
        mimeType: "application/pdf",
        size: 32768,
        url: "https://assets.yourdomain.com/202608/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/quotation_2026.pdf"
      }
    ],
    delivery_id: "jotify/webhook/12/f47ac10b-58cc-4372-a567-0e02b2c3d479"
  };

  const samplePayloadJson = JSON.stringify(samplePayload, null, 2);

  const codeSnippets = {
    nodejs: `// Node.js (Express / TypeScript) Webhook 接收端示例
import express from 'express';
import crypto from 'crypto';

const app = express();
// 注意：必须获取 Raw Body 用于精确计算 HMAC 签名
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

const WEBHOOK_SIGNING_SECRET = process.env.WEBHOOK_SIGNING_SECRET || 'your_webhook_signing_secret';

// 校验 Jotify 签名
function verifyJotifySignature(rawBody: string, signatureHeader?: string): boolean {
  if (!signatureHeader || !WEBHOOK_SIGNING_SECRET) return true; // 如果服务端未开启签名可跳过
  const expectedSig = crypto
    .createHmac('sha256', WEBHOOK_SIGNING_SECRET)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signatureHeader));
}

app.post('/webhook/jotify-email', (req: any, res) => {
  const signature = req.headers['x-jotify-signature'];
  const deliveryId = req.headers['x-jotify-delivery-id'] || req.body.delivery_id;

  // 1. 验证签名
  if (signature && !verifyJotifySignature(req.rawBody, signature)) {
    console.warn('[Webhook] 签名验证失败, Delivery ID:', deliveryId);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. 幂等性去重检查（建议使用 Redis 或数据库检查 deliveryId）
  /*
  const isDuplicate = await redis.set(\`webhook:dedup:\${deliveryId}\`, '1', 'EX', 86400, 'NX');
  if (!isDuplicate) {
    console.log('[Webhook] 重复投递，已直接确认:', deliveryId);
    return res.status(200).json({ ok: true, deduplicated: true });
  }
  */

  const { to, from, subject, text, html, attachments } = req.body;
  console.log(\`[Webhook] 收到来自 \${from} 发往 \${to} 的邮件: "\${subject}"\`);
  console.log('纯文本长度:', text?.length || 0, '富文本 HTML 长度:', html?.length || 0);
  console.log('附件数量:', attachments?.length || 0);

  // 3. 建议耗时处理异步执行，先在 15s 内响应 200 OK
  // queue.add({ to, from, subject, text, html, attachments });

  return res.status(200).json({ ok: true, delivery_id: deliveryId });
});

app.listen(3000, () => console.log('Webhook 服务运行在端口 3000'));`,

    python: `# Python (FastAPI) Webhook 接收端示例
import hmac
import hashlib
import os
from fastapi import FastAPI, Request, HTTPException, Header
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional

app = FastAPI(title="Jotify Email Webhook Receiver")
SIGNING_SECRET = os.getenv("WEBHOOK_SIGNING_SECRET", "your_webhook_signing_secret")

class Attachment(BaseModel):
    filename: str
    mimeType: str
    size: int
    url: str

class EmailWebhookPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    to: str
    from_email: str = Field(default="", alias="from")
    subject: str
    text: str
    html: Optional[str] = None
    rawSize: int
    attachments: List[Attachment] = []
    delivery_id: str

@app.post("/webhook/jotify-email")
async def receive_email_webhook(
    request: Request,
    x_jotify_signature: Optional[str] = Header(None),
    x_jotify_delivery_id: Optional[str] = Header(None)
):
    raw_body = await request.body()

    # 1. 验证 HMAC-SHA256 签名
    if x_jotify_signature and SIGNING_SECRET:
        expected_sig = hmac.new(
            SIGNING_SECRET.encode('utf-8'),
            raw_body,
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected_sig, x_jotify_signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()
    delivery_id = x_jotify_delivery_id or payload.get("delivery_id")
    
    # 2. 业务逻辑处理（建议对 delivery_id 进行幂等去重）
    print(f"收到邮件: {payload.get('from')} -> {payload.get('to')}, 主题: {payload.get('subject')}")
    print(f"纯文本: {len(payload.get('text', ''))} 字符, 富文本 HTML: {len(payload.get('html') or '')} 字符")
    print(f"附件数: {len(payload.get('attachments', []))}")

    # 3. 必须在 15 秒内返回 2xx 状态码
    return {"status": "success", "delivery_id": delivery_id}`,

    go: `// Go (net/http) Webhook 接收端示例
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type Attachment struct {
	Filename string \`json:"filename"\`
	MimeType string \`json:"mimeType"\`
	Size     int    \`json:"size"\`
	URL      string \`json:"url"\`
}

type EmailPayload struct {
	To          string       \`json:"to"\`
	From        string       \`json:"from"\`
	Subject     string       \`json:"subject"\`
	Text        string       \`json:"text"\`
	HTML        *string      \`json:"html"\`
	RawSize     int          \`json:"rawSize"\`
	Attachments []Attachment \`json:"attachments"\`
	DeliveryID  string       \`json:"delivery_id"\`
}

func verifySignature(rawBody []byte, signature, secret string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(rawBody)
	expectedSig := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expectedSig), []byte(signature))
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Cannot read body", http.StatusBadRequest)
		return
	}

	signingSecret := os.Getenv("WEBHOOK_SIGNING_SECRET")
	signature := r.Header.Get("X-Jotify-Signature")
	if signature != "" && signingSecret != "" {
		if !verifySignature(body, signature, signingSecret) {
			http.Error(w, "Invalid signature", http.StatusUnauthorized)
			return
		}
	}

	var payload EmailPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	fmt.Printf("[Webhook] 收到邮件: %s -> %s, 主题: %s\\n", payload.From, payload.To, payload.Subject)

	// 返回 200 响应
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf(\`{"status":"ok","delivery_id":"%s"}\`, payload.DeliveryID)))
}

func main() {
	http.HandleFunc("/webhook/jotify-email", webhookHandler)
	fmt.Println("Server running on :8080")
	http.ListenAndServe(":8080", nil)
}`,

    php: `<?php
// PHP Webhook 接收端示例
$signingSecret = getenv('WEBHOOK_SIGNING_SECRET') ?: 'your_webhook_signing_secret';

// 1. 获取原始请求体
$rawBody = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_JOTIFY_SIGNATURE'] ?? '';
$deliveryId = $_SERVER['HTTP_X_JOTIFY_DELIVERY_ID'] ?? '';

// 2. 校验 HMAC-SHA256 签名
if (!empty($signature) && !empty($signingSecret)) {
    $expectedSig = hash_hmac('sha256', $rawBody, $signingSecret);
    if (!hash_equals($expectedSig, $signature)) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid signature']);
        exit;
    }
}

// 3. 解析 JSON 数据
$data = json_decode($rawBody, true);
if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

// 4. 获取邮件字段
$to = $data['to'] ?? '';
$from = $data['from'] ?? '';
$subject = $data['subject'] ?? '';
$text = $data['text'] ?? '';
$html = $data['html'] ?? null;
$attachments = $data['attachments'] ?? [];
$deliveryId = $data['delivery_id'] ?? $deliveryId;

// 业务处理逻辑（例如写入数据库或通知其他系统）
error_log("收到邮件推送: {$from} -> {$to}, 主题: {$subject}, 纯文本字数: " . strlen($text));

// 5. 返回 200 OK 确认接收
http_response_code(200);
header('Content-Type: application/json');
echo json_encode(['status' => 'success', 'delivery_id' => $deliveryId]);
?>`
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col selection:bg-black selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 h-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {user ? '返回控制台' : '返回登录'}
            </button>
            <div className="h-4 w-px bg-gray-200 mx-1 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-black" />
              <span className="font-bold text-sm font-mono tracking-tight text-black">Jotify Webhook API Docs</span>
            </div>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-100">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              v1.0 REST Webhook
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#quickstart"
              className="text-xs font-medium text-gray-600 hover:text-black hidden sm:inline-block transition-colors"
            >
              快速接入
            </a>
            <a
              href="#payload-schema"
              className="text-xs font-medium text-gray-600 hover:text-black hidden sm:inline-block transition-colors"
            >
              数据结构
            </a>
            <a
              href="#signature-verification"
              className="text-xs font-medium text-gray-600 hover:text-black hidden sm:inline-block transition-colors"
            >
              签名验证
            </a>
            <button
              onClick={onBack}
              className="px-3 py-1.5 bg-black hover:bg-gray-800 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              {user ? '进入控制台 →' : '登录控制台 →'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row gap-10">
        
        {/* Left Table of Contents / Sidebar */}
        <aside className="lg:w-64 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div>
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-3">
                文档目录
              </h4>
              <nav className="space-y-1 text-xs font-medium">
                <a
                  href="#overview"
                  className="flex items-center gap-2 px-3 py-2 rounded text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
                >
                  <Server className="h-3.5 w-3.5 text-gray-500" />
                  1. 概述与推送流程
                </a>
                <a
                  href="#request-spec"
                  className="flex items-center gap-2 px-3 py-2 rounded text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
                >
                  <Terminal className="h-3.5 w-3.5 text-gray-500" />
                  2. Webhook 请求规范
                </a>
                <a
                  href="#payload-schema"
                  className="flex items-center gap-2 px-3 py-2 rounded text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 text-gray-500" />
                  3. 推送数据结构与字段
                </a>
                <a
                  href="#signature-verification"
                  className="flex items-center gap-2 px-3 py-2 rounded text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-gray-500" />
                  4. HMAC 签名校验机制
                </a>
                <a
                  href="#response-requirements"
                  className="flex items-center gap-2 px-3 py-2 rounded text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-gray-500" />
                  5. 响应要求与状态码
                </a>
                <a
                  href="#retry-mechanism"
                  className="flex items-center gap-2 px-3 py-2 rounded text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
                  6. 重试策略与死信队列
                </a>
                <a
                  href="#code-examples"
                  className="flex items-center gap-2 px-3 py-2 rounded text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
                >
                  <Code2 className="h-3.5 w-3.5 text-gray-500" />
                  7. 常用语言接入代码
                </a>
                <a
                  href="#troubleshooting"
                  className="flex items-center gap-2 px-3 py-2 rounded text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-gray-500" />
                  8. 常见问题排查
                </a>
              </nav>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-100 rounded text-xs space-y-2">
              <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-600" />
                安全提示
              </div>
              <p className="text-gray-500 text-[11px] leading-relaxed">
                生产环境中请务必使用 HTTPS 接收端，并开启 HMAC 签名校验与 Token 鉴权以防伪造请求。
              </p>
            </div>
          </div>
        </aside>

        {/* Right Main Content */}
        <main className="flex-1 min-w-0 space-y-12">
          
          {/* Header Introduction */}
          <div className="space-y-4 border-b border-gray-100 pb-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-black text-white text-[11px] font-mono">
              <Mail className="h-3 w-3" />
              Jotify Email Router &middot; Webhook Integration
            </div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 font-serif">
              第三方邮件转发 Webhook 接入指南
            </h1>
            <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
              Jotify Email Router 支持将指定域名、前缀规则匹配到的入站邮件，在毫秒级实时解析后，以结构化 JSON 的形式通过 HTTP POST 方式推送到第三方系统的 Webhook 接口。本篇文档详细说明接口调用机制、推送数据结构、安全签名验证、重试策略及代码实现。
            </p>
          </div>

          {/* Section 1: Overview & Architecture */}
          <section id="overview" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded bg-black text-white font-mono text-xs font-bold">1</span>
              <h2 className="text-lg font-bold text-gray-900 font-serif">概述与推送流程</h2>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              当外部发件人发送邮件到您配置在 Jotify 的域名（如 <code>support@yourdomain.com</code>）时，系统的处理与推送生命周期如下：
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 bg-gray-50 border border-gray-150 rounded space-y-1.5">
                <div className="text-[10px] font-bold text-gray-400 font-mono">STEP 01</div>
                <div className="font-semibold text-xs text-gray-900">邮件接收与路由</div>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Cloudflare Email Routing 捕获原始邮件，Jotify 进行域名鉴权与防重放过滤。
                </p>
              </div>
              <div className="p-3.5 bg-gray-50 border border-gray-150 rounded space-y-1.5">
                <div className="text-[10px] font-bold text-gray-400 font-mono">STEP 02</div>
                <div className="font-semibold text-xs text-gray-900">正则匹配与解析</div>
                <p className="text-[11px] text-gray-500 leading-normal">
                  匹配用户配置的 API 集成规则，提取发件人、收件人、主题、正文并处理附件。
                </p>
              </div>
              <div className="p-3.5 bg-gray-50 border border-gray-150 rounded space-y-1.5">
                <div className="text-[10px] font-bold text-gray-400 font-mono">STEP 03</div>
                <div className="font-semibold text-xs text-gray-900">签名与 HTTP 投递</div>
                <p className="text-[11px] text-gray-500 leading-normal">
                  构造 JSON Payload，附带 HMAC 签名与自定义鉴权头，向目标 URL 发起 POST 请求。
                </p>
              </div>
              <div className="p-3.5 bg-gray-50 border border-gray-150 rounded space-y-1.5">
                <div className="text-[10px] font-bold text-gray-400 font-mono">STEP 04</div>
                <div className="font-semibold text-xs text-gray-900">状态确认与队列重试</div>
                <p className="text-[11px] text-gray-500 leading-normal">
                  接收端返回 2xx 则标记成功；异常或超时则自动进入退避重试队列并写入死信记录。
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Request Specifications */}
          <section id="request-spec" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded bg-black text-white font-mono text-xs font-bold">2</span>
              <h2 className="text-lg font-bold text-gray-900 font-serif">Webhook 请求规范与 Headers</h2>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Jotify 每次推送均使用标准 HTTP POST 请求，超时时间为 <strong>15 秒</strong>。推送时会携带以下 HTTP Headers：
            </p>

            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                <thead className="bg-gray-100 font-semibold text-gray-800 font-mono text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5">Header 字段</th>
                    <th className="px-4 py-2.5">是否必有</th>
                    <th className="px-4 py-2.5">示例值</th>
                    <th className="px-4 py-2.5">作用与说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white font-mono text-[11px] text-gray-600">
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800">Content-Type</td>
                    <td className="px-4 py-2.5 text-emerald-600 font-sans">必有</td>
                    <td className="px-4 py-2.5 text-gray-700">application/json</td>
                    <td className="px-4 py-2.5 font-sans text-gray-600">标准 JSON 格式编码</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800">X-Jotify-Delivery-Id</td>
                    <td className="px-4 py-2.5 text-emerald-600 font-sans">必有</td>
                    <td className="px-4 py-2.5 text-gray-700">jotify/webhook/12/f47a...</td>
                    <td className="px-4 py-2.5 font-sans text-gray-600">
                      投递唯一标识 UUID，格式为 <code>jotify/webhook/&#123;webhookId&#125;/&#123;uuid&#125;</code>，用于接收端去重。
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800">X-Jotify-Signature</td>
                    <td className="px-4 py-2.5 text-amber-600 font-sans">可选（推荐）</td>
                    <td className="px-4 py-2.5 text-gray-700">a3f890b34e... (64位 Hex)</td>
                    <td className="px-4 py-2.5 font-sans text-gray-600">
                      当配置了 <code>WEBHOOK_SIGNING_SECRET</code> 时生成。基于 Raw Body 计算的 HMAC-SHA256 签名。
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800">Authorization</td>
                    <td className="px-4 py-2.5 text-gray-500 font-sans">按需</td>
                    <td className="px-4 py-2.5 text-gray-700">Bearer secret_token_xyz</td>
                    <td className="px-4 py-2.5 font-sans text-gray-600">
                      当 Webhook 配置的鉴权类型为 <code>Bearer Token</code> 时自动携带。
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800">自定义 Header</td>
                    <td className="px-4 py-2.5 text-gray-500 font-sans">按需</td>
                    <td className="px-4 py-2.5 text-gray-700">X-Api-Key: my_secret_key</td>
                    <td className="px-4 py-2.5 font-sans text-gray-600">
                      当配置了 <code>Custom Header</code> 格式（如 <code>Key: Value</code>）时携带。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: Payload Schema */}
          <section id="payload-schema" className="space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded bg-black text-white font-mono text-xs font-bold">3</span>
                <h2 className="text-lg font-bold text-gray-900 font-serif">推送数据结构 (Payload Data Structure)</h2>
              </div>
              <button
                onClick={() => copyToClipboard(samplePayloadJson, 'sample-json')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
              >
                {copiedId === 'sample-json' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-green-700 font-medium">已复制 JSON</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-gray-500" />
                    <span>复制示例 Payload</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              HTTP 请求体采用 UTF-8 编码的 JSON 对象。完整示例与字段说明如下：
            </p>

            {/* JSON Code Box */}
            <div className="rounded border border-gray-200 overflow-hidden bg-gray-950 text-gray-100">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 text-[11px] font-mono text-gray-400">
                <span>HTTP POST Body (application/json)</span>
                <span>JSON Payload</span>
              </div>
              <pre className="p-4 text-xs font-mono overflow-x-auto text-emerald-400 leading-relaxed">
                <code>{samplePayloadJson}</code>
              </pre>
            </div>

            {/* Field Specifications Table */}
            <div className="border border-gray-200 rounded overflow-hidden mt-4">
              <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                <thead className="bg-gray-100 font-semibold text-gray-800 font-mono text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5">字段名</th>
                    <th className="px-4 py-2.5">类型</th>
                    <th className="px-4 py-2.5">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white font-mono text-[11px] text-gray-600">
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800">to</td>
                    <td className="px-4 py-2.5 text-blue-600">string</td>
                    <td className="px-4 py-2.5 font-sans text-gray-700">
                      收件人电子邮箱完整地址（例如：<code>support@yourdomain.com</code>）。
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800">from</td>
                    <td className="px-4 py-2.5 text-blue-600">string</td>
                    <td className="px-4 py-2.5 font-sans text-gray-700">
                      发件人电子邮箱完整地址（例如：<code>client@example.com</code>）。
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800">subject</td>
                    <td className="px-4 py-2.5 text-blue-600">string</td>
                    <td className="px-4 py-2.5 font-sans text-gray-700">
                      邮件主题。如果原始邮件无主题，则为空字符串 <code>""</code>。
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800">text</td>
                    <td className="px-4 py-2.5 text-blue-600">string</td>
                    <td className="px-4 py-2.5 font-sans text-gray-700">
                      邮件纯文本正文。如果原邮件为 HTML 格式，系统会自动剥离 <code>&lt;style&gt;</code>、<code>&lt;script&gt;</code> 以及 HTML 标签后返回纯文本。
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800">html</td>
                    <td className="px-4 py-2.5 text-blue-600">string | null</td>
                    <td className="px-4 py-2.5 font-sans text-gray-700">
                      邮件原始未经清洗的富文本 HTML 正文（保留完整标签与排版）。如果原邮件为纯文本邮件或无 HTML，则为 <code>null</code>。
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800">rawSize</td>
                    <td className="px-4 py-2.5 text-purple-600">number</td>
                    <td className="px-4 py-2.5 font-sans text-gray-700">
                      原始邮件内容的总大小（单位：字节 Byte）。
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800">attachments</td>
                    <td className="px-4 py-2.5 text-amber-600">array&lt;object&gt;</td>
                    <td className="px-4 py-2.5 font-sans text-gray-700">
                      附件列表。如未配置 R2 存储或邮件无附件，该数组为空 <code>[]</code>。每个附件对象包含：
                      <ul className="list-disc list-inside mt-1.5 space-y-1 text-gray-600 font-mono text-[11px]">
                        <li><code>filename</code> (string): 附件原始文件名</li>
                        <li><code>mimeType</code> (string): 文件 MIME 类型（如 <code>application/pdf</code>、<code>image/png</code>）</li>
                        <li><code>size</code> (number): 附件大小（字节）</li>
                        <li><code>url</code> (string): 安全下载直链（带签名，默认 60 天有效）</li>
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800">delivery_id</td>
                    <td className="px-4 py-2.5 text-blue-600">string</td>
                    <td className="px-4 py-2.5 font-sans text-gray-700">
                      全局唯一投递标识（格式：<code>jotify/webhook/&#123;id&#125;/&#123;uuid&#125;</code>），接收端<strong>必须</strong>使用此字段作为去重 Key 以保障幂等性。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4: Signature Verification */}
          <section id="signature-verification" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded bg-black text-white font-mono text-xs font-bold">4</span>
              <h2 className="text-lg font-bold text-gray-900 font-serif">HMAC 签名校验机制 (Security Signature)</h2>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              为了防止伪造请求，Jotify 服务端在发送 Webhook 前，会使用配置的 <code>WEBHOOK_SIGNING_SECRET</code> 与请求的完整原始 Payload 字符串进行 <strong>HMAC-SHA256</strong> 签名计算，并将十六进制结果放入 Header <code>X-Jotify-Signature</code> 中。
            </p>

            <div className="p-4 bg-gray-50 border border-gray-150 rounded space-y-3 text-xs">
              <div className="font-semibold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                签名校验算法公式
              </div>
              <div className="bg-white p-3 border border-gray-200 rounded font-mono text-[11px] text-gray-800 overflow-x-auto">
                signature = HMAC_SHA256(secret_key, raw_request_body_utf8).to_hex_lowercase()
              </div>
              <ul className="list-disc list-inside space-y-1 text-gray-600 text-[11px]">
                <li><strong>关键要求：</strong>计算 HMAC 时必须使用<strong>原始未经反序列化/格式化的 Raw JSON Body 字符串</strong>，任何空格或换行差异都会导致签名校验失败。</li>
                <li><strong>防时序攻击：</strong>比对签名字符串时，建议使用恒定时间比较函数（例如 Node.js 的 <code>crypto.timingSafeEqual</code> 或 Python 的 <code>hmac.compare_digest</code>）。</li>
              </ul>
            </div>
          </section>

          {/* Section 5: Response Requirements */}
          <section id="response-requirements" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded bg-black text-white font-mono text-xs font-bold">5</span>
              <h2 className="text-lg font-bold text-gray-900 font-serif">响应要求与状态码规范</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-green-50/50 border border-green-200 rounded space-y-2">
                <div className="font-bold text-green-900 flex items-center gap-1.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  成功的响应 (Success)
                </div>
                <p className="text-green-800 leading-relaxed text-[11px]">
                  第三方 Webhook 接收服务必须在 <strong>15 秒</strong> 内返回 HTTP <strong>2xx</strong> 状态码（如 <code>200 OK</code>、<code>202 Accepted</code> 或 <code>204 No Content</code>）。
                </p>
                <div className="bg-white/80 p-2.5 rounded border border-green-200 font-mono text-[11px] text-green-900">
                  HTTP/1.1 200 OK<br/>
                  Content-Type: application/json<br/><br/>
                  &#123; "ok": true &#125;
                </div>
              </div>

              <div className="p-4 bg-red-50/50 border border-red-200 rounded space-y-2">
                <div className="font-bold text-red-900 flex items-center gap-1.5 text-sm">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  失败与重试触发 (Failure)
                </div>
                <p className="text-red-800 leading-relaxed text-[11px]">
                  如果接收端返回 <strong>4xx / 5xx</strong> 状态码、网络连接超时（超过 15 秒）或 DNS 解析失败，Jotify 将判定本次投递失败并触发重试。
                </p>
                <div className="bg-white/80 p-2.5 rounded border border-red-200 font-mono text-[11px] text-red-900">
                  • HTTP 500 / 502 / 503 / 504<br/>
                  • HTTP 429 Too Many Requests<br/>
                  • Connection Timeout &gt; 15s
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded p-4 text-xs text-amber-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                最佳实践建议：先应答、后异步处理
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                如果您的接收端需要执行耗时任务（例如调用 AI 大模型分析邮件、处理大附件、调用复杂后端业务），强烈建议在接收到 Webhook 后<strong>立即返回 200 OK</strong>，并将邮件数据放入您自己的后台消息队列（如 Redis / RabbitMQ / BullMQ）中异步处理，避免因超过 15 秒而导致 Jotify 判定超时并重复重试。
              </p>
            </div>
          </section>

          {/* Section 6: Retry & DLQ */}
          <section id="retry-mechanism" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded bg-black text-white font-mono text-xs font-bold">6</span>
              <h2 className="text-lg font-bold text-gray-900 font-serif">重试策略与死信队列 (Retry & DLQ Pipeline)</h2>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Jotify 具备工业级的高可用重试机制，结合了「内存即时重试」与「Cloudflare Queues 分级指数退避重试」：
            </p>

            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                <thead className="bg-gray-100 font-semibold text-gray-800 font-mono text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5">重试阶段</th>
                    <th className="px-4 py-2.5">重试频次 / 间隔</th>
                    <th className="px-4 py-2.5">最大尝试次数</th>
                    <th className="px-4 py-2.5">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white font-mono text-[11px] text-gray-600">
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800 font-sans">阶段 1: 内存即时重试</td>
                    <td className="px-4 py-2.5 text-gray-700 font-sans">1秒、2秒指数递增</td>
                    <td className="px-4 py-2.5 text-gray-800">2 次</td>
                    <td className="px-4 py-2.5 font-sans text-gray-600">在 Worker 运行时内即时完成，应对瞬时网络抖动。</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800 font-sans">阶段 2: 队列短期退避</td>
                    <td className="px-4 py-2.5 text-gray-700 font-sans">每 5 分钟 (300 秒)</td>
                    <td className="px-4 py-2.5 text-gray-800">第 1 ~ 9 次队列重试</td>
                    <td className="px-4 py-2.5 font-sans text-gray-600">写入 Cloudflare Queue 异步调度。</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800 font-sans">阶段 3: 队列中期退避</td>
                    <td className="px-4 py-2.5 text-gray-700 font-sans">每 60 分钟 (3600 秒)</td>
                    <td className="px-4 py-2.5 text-gray-800">第 10 ~ 14 次队列重试</td>
                    <td className="px-4 py-2.5 font-sans text-gray-600">应对接收服务较长时间的维护与宕机。</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-800 font-sans">阶段 4: 队列长期退避</td>
                    <td className="px-4 py-2.5 text-gray-700 font-sans">每 3 小时 (10800 秒)</td>
                    <td className="px-4 py-2.5 text-gray-800">第 15 ~ 17 次队列重试</td>
                    <td className="px-4 py-2.5 font-sans text-gray-600">全流程总重试跨度约 15 小时（9×5m + 5×60m + 3×180m ≈ 14.75 小时）。</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-red-700 font-sans">阶段 5: 死信队列与持久化</td>
                    <td className="px-4 py-2.5 text-gray-700 font-sans">-</td>
                    <td className="px-4 py-2.5 text-gray-800">耗尽后入库</td>
                    <td className="px-4 py-2.5 font-sans text-gray-600">
                      若全部重试均失败，消息进入 DLQ 并归档至 <strong>投递失败记录</strong> 页面，支持用户在控制台手动点击「重新投递」。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 7: Ready-to-use Code Examples */}
          <section id="code-examples" className="space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded bg-black text-white font-mono text-xs font-bold">7</span>
                <h2 className="text-lg font-bold text-gray-900 font-serif">常用语言接收端代码示例</h2>
              </div>
              <button
                onClick={() => copyToClipboard(codeSnippets[activeLang], `code-${activeLang}`)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
              >
                {copiedId === `code-${activeLang}` ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-green-700 font-medium">已复制代码</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-gray-500" />
                    <span>复制代码</span>
                  </>
                )}
              </button>
            </div>

            {/* Language Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200">
              <button
                onClick={() => setActiveLang('nodejs')}
                className={`px-3 py-2 text-xs font-mono font-semibold border-b-2 cursor-pointer transition-colors ${
                  activeLang === 'nodejs'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-black'
                }`}
              >
                Node.js / Express
              </button>
              <button
                onClick={() => setActiveLang('python')}
                className={`px-3 py-2 text-xs font-mono font-semibold border-b-2 cursor-pointer transition-colors ${
                  activeLang === 'python'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-black'
                }`}
              >
                Python (FastAPI)
              </button>
              <button
                onClick={() => setActiveLang('go')}
                className={`px-3 py-2 text-xs font-mono font-semibold border-b-2 cursor-pointer transition-colors ${
                  activeLang === 'go'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-black'
                }`}
              >
                Go (net/http)
              </button>
              <button
                onClick={() => setActiveLang('php')}
                className={`px-3 py-2 text-xs font-mono font-semibold border-b-2 cursor-pointer transition-colors ${
                  activeLang === 'php'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-black'
                }`}
              >
                PHP
              </button>
            </div>

            {/* Code Box */}
            <div className="rounded border border-gray-200 overflow-hidden bg-gray-950 text-gray-100">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 text-[11px] font-mono text-gray-400">
                <span>{activeLang.toUpperCase()} Webhook Server Handler</span>
                <span>Example Implementation</span>
              </div>
              <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed text-gray-200">
                <code>{codeSnippets[activeLang]}</code>
              </pre>
            </div>
          </section>

          {/* Section 8: FAQ & Troubleshooting */}
          <section id="troubleshooting" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded bg-black text-white font-mono text-xs font-bold">8</span>
              <h2 className="text-lg font-bold text-gray-900 font-serif">常见问题与排查 (FAQ)</h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 border border-gray-200 rounded space-y-1.5 bg-white">
                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                  Q: 为什么我收到的 Webhook 签名（Signature）总是校验失败？
                </div>
                <p className="text-gray-600 pl-5 leading-relaxed text-[11px]">
                  A: 常见原因是在反序列化 JSON 之后再用 <code>JSON.stringify()</code> 重新序列化计算哈希。由于字段顺序或空格的细微差异，重新序列化的字符串无法匹配原始 Payload。请务必使用服务端接收到的 <strong>Raw Body (原始请求 Buffer 或字符串)</strong> 进行 HMAC 校验。
                </p>
              </div>

              <div className="p-4 border border-gray-200 rounded space-y-1.5 bg-white">
                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                  Q: 邮件中的附件是如何传输的？
                </div>
                <p className="text-gray-600 pl-5 leading-relaxed text-[11px]">
                  A: Jotify 会将邮件中的附件自动上传至 Cloudflare R2 存储桶，并在 <code>attachments</code> 数组中返回安全下载 URL（<code>url</code>）。第三方服务直接通过 HTTP GET 下载附件链接即可，无需处理复杂的 Base64 编解码或承受大文件请求体内存溢出的风险。
                </p>
              </div>

              <div className="p-4 border border-gray-200 rounded space-y-1.5 bg-white">
                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                  Q: 如何避免因网络重试导致我的业务系统重复处理同一封邮件？
                </div>
                <p className="text-gray-600 pl-5 leading-relaxed text-[11px]">
                  A: 请求体中的 <code>delivery_id</code> 或请求头中的 <code>X-Jotify-Delivery-Id</code> 是全局唯一的。建议在您的接收逻辑中，先将 <code>delivery_id</code> 存入 Redis 设置 24 小时过期，若 key 已存在则直接返回 <code>200 OK</code> 跳过后续业务处理。
                </p>
              </div>

              <div className="p-4 border border-gray-200 rounded space-y-1.5 bg-white">
                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                  Q: 我的 Webhook 返回了 200，但为什么控制台显示投递失败？
                </div>
                <p className="text-gray-600 pl-5 leading-relaxed text-[11px]">
                  A: Jotify 请求超时时间为 15 秒。如果您的接口在 15 秒之后才返回 200，Jotify 已在 15 秒触发超时熔断并记录失败。请优化接收端响应速度或将耗时任务放入异步队列。
                </p>
              </div>
            </div>
          </section>

          {/* Bottom Card */}
          <div className="border border-gray-200 bg-gray-50 rounded-lg p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-gray-900 font-serif">准备好接入了吗？</h3>
              <p className="text-xs text-gray-500 mt-1">
                立即登录 Jotify 控制台，创建您的 Webhook 接口与规则，开始接收邮件流。
              </p>
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-black hover:bg-gray-800 text-white rounded text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              {user ? '前往控制台管理 Webhook →' : '立即登录系统 →'}
            </button>
          </div>

        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-6 text-center text-xs text-gray-400 select-none mt-12">
        Jotify Project &copy; {new Date().getFullYear()} &middot; Minimalist Email Routing & Webhook Ingestion Center.
      </footer>
    </div>
  );
}
