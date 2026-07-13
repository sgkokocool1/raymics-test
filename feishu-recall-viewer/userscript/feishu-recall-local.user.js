// ==UserScript==
// @name         飞书撤回消息本地归档（非入侵）
// @namespace    https://github.com/sgkokocool1/raymics-test
// @version      1.0.0
// @description  仅归档你浏览器里已经看到的飞书/Lark 网页消息；撤回后可本地查看原文。不破解客户端、不读本地加密库、不请求额外企业权限。
// @author       local
// @match        https://*.feishu.cn/*
// @match        https://*.feishu.net/*
// @match        https://*.larksuite.com/*
// @match        https://*.larkoffice.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const DB_NAME = 'feishu_recall_local_v1';
  const STORE = 'messages';
  const RECALL_HINTS = [
    '消息已撤回',
    '此消息已撤回',
    '撤回了一条消息',
    'Message recalled',
    'This message was recalled',
    'recalled a message',
  ];

  /** ---------- IndexedDB ---------- */
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('by_time', 'updatedAt');
          os.createIndex('by_recalled', 'recalled');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function putMsg(msg) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(msg);
      tx.oncomplete = () => resolve(msg);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getMsg(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function listRecalled(limit = 200) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).index('by_time').openCursor(null, 'prev');
      const out = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || out.length >= limit) return resolve(out);
        if (cursor.value.recalled && cursor.value.text) out.push(cursor.value);
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }

  /** ---------- 工具 ---------- */
  function isRecallText(t) {
    const s = (t || '').replace(/\s+/g, ' ').trim();
    if (!s) return false;
    return RECALL_HINTS.some((h) => s === h || s.includes(h));
  }

  function cleanText(t) {
    return (t || '').replace(/\u200b/g, '').replace(/\s+\n/g, '\n').trim();
  }

  function fingerprint(text, el) {
    // 飞书 DOM 常无稳定 id；没有则用内容+大致位置做弱指纹
    const domId =
      el.getAttribute('data-message-id') ||
      el.getAttribute('data-msg-id') ||
      el.getAttribute('data-id') ||
      el.id ||
      '';
    if (domId) return 'dom:' + domId;
    const path = [];
    let n = el;
    for (let i = 0; i < 5 && n; i++) {
      path.push((n.className && String(n.className).slice(0, 40)) || n.tagName);
      n = n.parentElement;
    }
    return 'fp:' + btoa(unescape(encodeURIComponent(path.join('>') + '|' + text.slice(0, 80)))).slice(0, 48);
  }

  function findBubbleRoot(node) {
    if (!node || node.nodeType !== 1) return null;
    // 向上找一块「像消息气泡」的容器：有一定文本、不太大
    let el = node;
    for (let i = 0; i < 8 && el && el !== document.body; i++) {
      const t = cleanText(el.innerText || '');
      if (t.length >= 1 && t.length < 4000) {
        const rect = el.getBoundingClientRect?.();
        if (rect && rect.height > 8 && rect.height < 1200 && rect.width > 40) {
          // 排除侧边栏/输入框
          const cls = String(el.className || '');
          if (!/sidebar|nav|input|editor|toolbar|menu/i.test(cls)) return el;
        }
      }
      el = el.parentElement;
    }
    return null;
  }

  /** ---------- 归档 / 还原 ---------- */
  async function archiveBubble(el) {
    const text = cleanText(el.innerText || '');
    if (!text || text.length < 1) return;
    if (isRecallText(text)) {
      await handleRecallBubble(el, text);
      return;
    }
    // 跳过过短的系统提示
    if (text.length < 2) return;

    const id = fingerprint(text, el);
    const prev = await getMsg(id);
    const msg = {
      id,
      text,
      recalled: false,
      recallText: '',
      url: location.href,
      updatedAt: Date.now(),
      createdAt: prev?.createdAt || Date.now(),
    };
    // 同一指纹内容变化时，保留旧文本作为历史（若新文本不是撤回）
    if (prev?.text && prev.text !== text && !isRecallText(text)) {
      msg.prevText = prev.text;
    }
    await putMsg(msg);
    el.dataset.frArchived = '1';
    el.dataset.frId = id;
  }

  async function handleRecallBubble(el, recallUiText) {
    let id = el.dataset.frId;
    let saved = id ? await getMsg(id) : null;

    // 若没有绑定 id，尝试用附近已归档节点 / 弱匹配
    if (!saved) {
      const nearby = el.closest('[data-fr-id]') || el.querySelector('[data-fr-id]');
      if (nearby?.dataset?.frId) {
        id = nearby.dataset.frId;
        saved = await getMsg(id);
      }
    }

    if (!saved || !saved.text || isRecallText(saved.text)) {
      // 没见过原文：无法还原（这是本地方案的天然边界）
      markCannotRestore(el);
      return;
    }

    saved.recalled = true;
    saved.recallText = recallUiText;
    saved.updatedAt = Date.now();
    await putMsg(saved);
    renderRestored(el, saved);
  }

  function markCannotRestore(el) {
    if (el.dataset.frMarked) return;
    el.dataset.frMarked = '1';
    const tip = document.createElement('div');
    tip.className = 'fr-local-tip';
    tip.textContent = '本地归档：撤回前未在本机看到过原文，无法还原';
    el.appendChild(tip);
  }

  function renderRestored(el, saved) {
    if (el.dataset.frRestored === saved.id) return;
    el.dataset.frRestored = saved.id;
    let box = el.querySelector('.fr-local-restored');
    if (!box) {
      box = document.createElement('div');
      box.className = 'fr-local-restored';
      el.appendChild(box);
    }
    box.innerHTML = '';
    const label = document.createElement('div');
    label.className = 'fr-local-label';
    label.textContent = '本地归档 · 撤回前原文';
    const body = document.createElement('div');
    body.className = 'fr-local-body';
    body.textContent = saved.text;
    box.appendChild(label);
    box.appendChild(body);
  }

  /** ---------- 扫描 DOM ---------- */
  function scan(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    const seen = new Set();
    let n = root.nodeType === 1 ? root : walker.nextNode();
    while (n) {
      const text = cleanText(n.innerText || '');
      if (text && (isRecallText(text) || (text.length >= 2 && text.length < 2000))) {
        const bubble = findBubbleRoot(n);
        if (bubble && !seen.has(bubble)) {
          seen.add(bubble);
          archiveBubble(bubble).catch(() => {});
        }
      }
      n = walker.nextNode();
      // 限制单次扫描量，避免卡顿
      if (seen.size > 80) break;
    }
  }

  const obs = new MutationObserver((mutations) => {
    let need = false;
    for (const m of mutations) {
      if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) need = true;
      if (m.type === 'characterData') need = true;
      if (need) break;
    }
    if (need) scheduleScan();
  });

  let scanTimer = null;
  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scan(document.body);
      refreshPanelCount();
    }, 400);
  }

  /** ---------- 面板 UI ---------- */
  function injectStyle() {
    if (document.getElementById('fr-local-style')) return;
    const style = document.createElement('style');
    style.id = 'fr-local-style';
    style.textContent = `
      .fr-local-fab {
        position: fixed; right: 20px; bottom: 24px; z-index: 2147483646;
        background: linear-gradient(135deg, #3370ff, #00d6b9); color: #fff;
        border: none; border-radius: 999px; padding: 10px 14px; cursor: pointer;
        font-size: 13px; font-weight: 700; box-shadow: 0 8px 24px rgba(0,0,0,.25);
      }
      .fr-local-panel {
        position: fixed; right: 20px; bottom: 70px; width: min(420px, calc(100vw - 24px));
        max-height: min(70vh, 640px); overflow: auto; z-index: 2147483646;
        background: #1a2332; color: #e8eef7; border: 1px solid #2f3f56; border-radius: 14px;
        box-shadow: 0 16px 40px rgba(0,0,0,.35); display: none; font-family: inherit;
      }
      .fr-local-panel.open { display: block; }
      .fr-local-panel header {
        position: sticky; top: 0; background: #243044; padding: 12px 14px;
        border-bottom: 1px solid #2f3f56; display: flex; justify-content: space-between; align-items: center;
      }
      .fr-local-panel header b { font-size: 14px; }
      .fr-local-panel header span { color: #8b9cb3; font-size: 12px; }
      .fr-local-item { padding: 12px 14px; border-bottom: 1px solid #2f3f56; }
      .fr-local-item .meta { color: #8b9cb3; font-size: 11px; margin-bottom: 6px; }
      .fr-local-item .txt { white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.5; }
      .fr-local-empty { padding: 28px 16px; text-align: center; color: #8b9cb3; font-size: 13px; }
      .fr-local-restored {
        margin-top: 8px; padding: 10px 12px; border-radius: 10px;
        background: rgba(51,112,255,.12); border: 1px solid rgba(51,112,255,.35);
      }
      .fr-local-label { font-size: 11px; color: #7aa2ff; margin-bottom: 6px; font-weight: 700; }
      .fr-local-body { white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.5; color: #e8eef7; }
      .fr-local-tip { margin-top: 6px; font-size: 11px; color: #f5a623; }
      .fr-local-note {
        padding: 10px 14px; font-size: 11px; color: #8b9cb3; line-height: 1.5;
        border-top: 1px dashed #2f3f56;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function injectPanel() {
    if (document.getElementById('fr-local-fab')) return;
    injectStyle();
    const fab = document.createElement('button');
    fab.id = 'fr-local-fab';
    fab.className = 'fr-local-fab';
    fab.textContent = '撤回归档';
    const panel = document.createElement('div');
    panel.id = 'fr-local-panel';
    panel.className = 'fr-local-panel';
    panel.innerHTML = `
      <header>
        <b>本地撤回归档</b>
        <span id="fr-local-count">0</span>
      </header>
      <div id="fr-local-list" class="fr-local-empty">暂无已归档的撤回消息</div>
      <div class="fr-local-note">
        仅保存本浏览器中你已经看过的消息；脚本启动前的历史、未打开过的会话无法还原。
        数据只存在本机 IndexedDB，不上传服务器。
      </div>
    `;
    fab.onclick = async () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) await renderPanel();
    };
    document.documentElement.appendChild(fab);
    document.documentElement.appendChild(panel);
  }

  async function renderPanel() {
    const list = document.getElementById('fr-local-list');
    const items = await listRecalled(100);
    const count = document.getElementById('fr-local-count');
    if (count) count.textContent = String(items.length);
    if (!items.length) {
      list.className = 'fr-local-empty';
      list.textContent = '暂无已归档的撤回消息。先在会话里正常看消息，对方撤回后会出现在这里。';
      return;
    }
    list.className = '';
    list.innerHTML = items.map((m) => `
      <div class="fr-local-item">
        <div class="meta">${new Date(m.updatedAt).toLocaleString('zh-CN', { hour12: false })}</div>
        <div class="txt"></div>
      </div>
    `).join('');
    [...list.querySelectorAll('.fr-local-item .txt')].forEach((el, i) => {
      el.textContent = items[i].text;
    });
  }

  async function refreshPanelCount() {
    const count = document.getElementById('fr-local-count');
    if (!count) return;
    const items = await listRecalled(500);
    count.textContent = String(items.length);
  }

  /** ---------- 启动 ---------- */
  function start() {
    injectPanel();
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    scheduleScan();
    setInterval(scheduleScan, 5000);
    console.info('[feishu-recall-local] 已启动：仅归档本机已见消息，不入侵客户端');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
