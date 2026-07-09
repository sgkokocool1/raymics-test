import crypto from 'crypto';

/** 飞书事件订阅 URL 校验：返回 challenge */
export function handleUrlVerification(body) {
  if (body?.type === 'url_verification' && body.challenge) {
    return { challenge: body.challenge };
  }
  return null;
}

/** 校验 Verification Token（未配置加密时） */
export function verifyToken(body, expectedToken) {
  if (!expectedToken) return true;
  const token = body?.token || body?.header?.token;
  return token === expectedToken;
}

/**
 * 解密飞书 Encrypt Key 加密事件体。
 * 算法：AES-256-CBC，key = SHA256(encrypt_key)，iv = ciphertext 前 16 字节。
 * 参考：https://open.feishu.cn/document/ukTMukTMukTM/uYDNxYjL2QTM24iN0EjN/event-subscription-configure-/encrypt-key-encryption-configuration-case
 */
export function decryptEvent(encrypt, encryptKey) {
  if (!encrypt) return null;
  if (!encryptKey) throw new Error('收到加密事件，但未配置 FEISHU_ENCRYPT_KEY');
  const key = crypto.createHash('sha256').update(encryptKey).digest();
  const buf = Buffer.from(encrypt, 'base64');
  const iv = buf.subarray(0, 16);
  const data = buf.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(data, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

/** 解析 content JSON 为可读文本 */
export function extractText(messageType, contentStr) {
  if (!contentStr) return '';
  let content;
  try {
    content = typeof contentStr === 'string' ? JSON.parse(contentStr) : contentStr;
  } catch {
    return String(contentStr);
  }
  switch (messageType) {
    case 'text':
      return content.text || '';
    case 'post':
      return flattenPost(content);
    case 'image':
      return `[图片] ${content.image_key || ''}`.trim();
    case 'file':
      return `[文件] ${content.file_name || content.file_key || ''}`.trim();
    case 'audio':
      return '[语音]';
    case 'media':
      return `[视频] ${content.file_name || ''}`.trim();
    case 'sticker':
      return '[表情]';
    case 'interactive':
      return '[卡片消息]';
    case 'share_chat':
      return `[分享群] ${content.chat_id || ''}`.trim();
    case 'share_user':
      return `[分享用户] ${content.user_id || ''}`.trim();
    default:
      return JSON.stringify(content);
  }
}

function flattenPost(post) {
  // post 结构：{ zh_cn: { title, content: [[{tag,text}]] } } 或直接 content
  const langs = post?.zh_cn || post?.en_us || post;
  if (!langs) return '[富文本]';
  const title = langs.title || '';
  const lines = (langs.content || []).map((row) =>
    (row || []).map((cell) => cell.text || cell.href || `[${cell.tag}]`).join('')).join('\n');
  return [title, lines].filter(Boolean).join('\n');
}

export const RECALL_TYPE_LABEL = {
  message_owner: '发送者撤回',
  group_owner: '群主撤回',
  group_manager: '群管理员撤回',
  enterprise_manager: '企业管理员撤回',
  unknown: '未知',
};
