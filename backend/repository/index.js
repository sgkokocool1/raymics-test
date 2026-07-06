import { memoryRepo } from './memory.js';
import { dbRepo } from './db.js';

/* 通过 DATA_BACKEND 环境变量选择数据源：
 *   memory (默认) —— 内存 mock，零依赖
 *   db            —— PostgreSQL(+可选 Elasticsearch)
 */
export async function getRepository() {
  const backend = (process.env.DATA_BACKEND || 'memory').toLowerCase();
  if (backend === 'db' || backend === 'postgres') {
    try {
      await dbRepo.init();
      return dbRepo;
    } catch (e) {
      console.error('[repository] 数据库连接失败，回退到内存数据源：', e.message);
      return memoryRepo;
    }
  }
  return memoryRepo;
}
