import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  handleUrlVerification, verifyToken, decryptEvent, extractText, RECALL_TYPE_LABEL,
} from './feishu.js';
import * as store from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);

const FEISHU_VERIFICATION_TOKEN = process.env.FEISHU_VERIFICATION_TOKEN || '';
const FEISHU_ENCRYPT_KEY = process.env.FEISHU_ENCRYPT_KEY || '';
const VIEWER_TOKEN = process.env.VIEWER_TOKEN || ''; // 可选：保护查看面板

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

function authViewer(req, res, next) {
  if (!VIEWER_TOKEN) return next();
  const token = req.headers['x-viewer-token'] || req.query.token;
  if (token !== VIEWER_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  return next();
}

/** 统一解析飞书事件体（支持加密） */
function parseEventBody(raw) {
  if (raw?.encrypt) {
    return decryptEvent(raw.encrypt, FEISHU_ENCRYPT_KEY);
  }
  return raw;
}

/** 飞书事件回调入口 */
app.post('/webhook/event', (req, res) => {
  try {
    // URL 校验可能是明文，也可能在 encrypt 内
    let body = req.body;
    if (body?.encrypt && !body?.type) {
      body = decryptEvent(body.encrypt, FEISHU_ENCRYPT_KEY);
    }

    const challenge = handleUrlVerification(body);
    if (challenge) return res.json(challenge);

    body = parseEventBody(req.body);
    if (!verifyToken(body, FEISHU_VERIFICATION_TOKEN)) {
      return res.status(401).json({ error: 'invalid verification token' });
    }

    const eventType = body?.header?.event_type || body?.event?.type || body?.type;
    if (eventType === 'im.message.receive_v1') {
      handleReceive(body);
    } else if (eventType === 'im.message.recalled_v1') {
      handleRecalled(body);
    } else {
      console.log('[event] ignore', eventType);
    }

    // 飞书要求尽快 200
    return res.json({ code: 0 });
  } catch (e) {
    console.error('[webhook]', e);
    return res.status(500).json({ error: String(e.message || e) });
  }
});

function handleReceive(body) {
  const ev = body.event || {};
  const message = ev.message || {};
  const sender = ev.sender || {};
  const messageId = message.message_id;
  if (!messageId) return;

  const contentText = extractText(message.message_type, message.content);
  const senderId = sender.sender_id?.open_id || sender.sender_id?.user_id || '';
  const mentionNames = (message.mentions || []).map((m) => m.name).filter(Boolean);

  store.upsertMessage({
    message_id: messageId,
    chat_id: message.chat_id || '',
    chat_type: message.chat_type || '',
    message_type: message.message_type || 'unknown',
    content_text: contentText,
    content_raw: message.content || null,
    sender_id: senderId,
    sender_name: mentionNames[0] || '', // 事件本身通常不带发送者姓名，可后续用通讯录 API 补全
    sender_type: sender.sender_type || '',
    create_time: message.create_time || body.header?.create_time || '',
    mentions: message.mentions || [],
    tenant_key: body.header?.tenant_key || sender.tenant_key || '',
    event_id: body.header?.event_id || '',
  });
  console.log(`[receive] ${messageId} ${message.message_type} ${contentText.slice(0, 80)}`);
}

function handleRecalled(body) {
  const ev = body.event || {};
  const messageId = ev.message_id;
  if (!messageId) return;
  const msg = store.markRecalled({
    message_id: messageId,
    chat_id: ev.chat_id || '',
    recall_time: ev.recall_time || body.header?.create_time || String(Date.now()),
    recall_type: ev.recall_type || 'unknown',
  });
  console.log(`[recalled] ${messageId} type=${ev.recall_type} text=${(msg.content_text || '').slice(0, 80)}`);
}

/** -------- 查看面板 API -------- */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'feishu-recall-viewer',
    feishuConfigured: Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET),
    verificationTokenSet: Boolean(FEISHU_VERIFICATION_TOKEN),
    encryptKeySet: Boolean(FEISHU_ENCRYPT_KEY),
  });
});

app.get('/api/stats', authViewer, (_req, res) => {
  res.json(store.stats());
});

app.get('/api/messages', authViewer, (req, res) => {
  const recalledOnly = req.query.recalledOnly !== 'false';
  const result = store.listMessages({
    recalledOnly,
    q: String(req.query.q || ''),
    chatId: String(req.query.chatId || ''),
    page: req.query.page,
    size: req.query.size,
  });
  result.items = result.items.map((m) => ({
    ...m,
    recall_type_label: RECALL_TYPE_LABEL[m.recall_type] || m.recall_type,
  }));
  res.json(result);
});

app.get('/api/messages/:id', authViewer, (req, res) => {
  const m = store.getMessage(req.params.id);
  if (!m) return res.status(404).json({ error: 'not found' });
  res.json({ ...m, recall_type_label: RECALL_TYPE_LABEL[m.recall_type] || m.recall_type });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[feishu-recall-viewer] http://localhost:${PORT}`);
  console.log(`[feishu-recall-viewer] webhook: POST /webhook/event`);
  if (!FEISHU_VERIFICATION_TOKEN) console.warn('[warn] 未设置 FEISHU_VERIFICATION_TOKEN，生产环境请配置');
});
