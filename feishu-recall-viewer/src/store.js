import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'messages.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ messages: [] }, null, 2));
}

function read() {
  ensure();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function write(db) {
  ensure();
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export function upsertMessage(msg) {
  const db = read();
  const idx = db.messages.findIndex((m) => m.message_id === msg.message_id);
  if (idx >= 0) {
    db.messages[idx] = { ...db.messages[idx], ...msg, updated_at: Date.now() };
  } else {
    db.messages.unshift({ ...msg, recalled: false, created_at: Date.now(), updated_at: Date.now() });
  }
  write(db);
  return db.messages.find((m) => m.message_id === msg.message_id);
}

export function markRecalled({ message_id, chat_id, recall_time, recall_type }) {
  const db = read();
  let msg = db.messages.find((m) => m.message_id === message_id);
  if (!msg) {
    msg = {
      message_id,
      chat_id: chat_id || '',
      chat_type: '',
      message_type: 'unknown',
      content_text: '（撤回前未收到该消息原文，可能机器人尚未入群或权限不足）',
      content_raw: null,
      sender_id: '',
      sender_name: '',
      sender_type: '',
      create_time: '',
      recalled: true,
      recall_time: recall_time || String(Date.now()),
      recall_type: recall_type || 'unknown',
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    db.messages.unshift(msg);
  } else {
    msg.recalled = true;
    msg.recall_time = recall_time || String(Date.now());
    msg.recall_type = recall_type || 'unknown';
    if (chat_id) msg.chat_id = chat_id;
    msg.updated_at = Date.now();
  }
  write(db);
  return msg;
}

export function listMessages({ recalledOnly = true, q = '', chatId = '', page = 1, size = 50 } = {}) {
  const db = read();
  let list = db.messages.slice();
  if (recalledOnly) list = list.filter((m) => m.recalled);
  if (chatId) list = list.filter((m) => m.chat_id === chatId);
  if (q) {
    const s = q.toLowerCase();
    list = list.filter((m) =>
      [m.content_text, m.sender_name, m.sender_id, m.message_id, m.chat_id]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(s)));
  }
  list.sort((a, b) => Number(b.recall_time || b.create_time || 0) - Number(a.recall_time || a.create_time || 0));
  const total = list.length;
  const p = Math.max(1, Number(page) || 1);
  const s = Math.min(200, Math.max(1, Number(size) || 50));
  return { total, page: p, size: s, items: list.slice((p - 1) * s, p * s) };
}

export function getMessage(messageId) {
  return read().messages.find((m) => m.message_id === messageId) || null;
}

export function stats() {
  const db = read();
  const total = db.messages.length;
  const recalled = db.messages.filter((m) => m.recalled).length;
  const byType = {};
  for (const m of db.messages.filter((x) => x.recalled)) {
    byType[m.message_type || 'unknown'] = (byType[m.message_type || 'unknown'] || 0) + 1;
  }
  return { total, recalled, active: total - recalled, byType };
}

export function replaceAll(messages) {
  write({ messages });
}
