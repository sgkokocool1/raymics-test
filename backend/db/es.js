import { Client } from '@elastic/elasticsearch';

export const ES_INDEX = 'episodes';

let client = null;
let available = null; // 缓存可用性探测结果

export function getClient() {
  if (!client && process.env.ELASTICSEARCH_URL) {
    client = new Client({ node: process.env.ELASTICSEARCH_URL });
  }
  return client;
}

/* 探测 ES 是否可用；不可用时后端自动回退到 PostgreSQL 检索 */
export async function esAvailable() {
  if (available !== null) return available;
  const c = getClient();
  if (!c) { available = false; return false; }
  try {
    await c.ping({}, { requestTimeout: 2000 });
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export function resetAvailability() { available = null; }
