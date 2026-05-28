/**
 * 本地数据库迁移：执行 migrations/*.sql 中尚未应用的脚本
 *
 * 用法：
 *   pnpm migrate:local              # 执行所有待执行迁移
 *   pnpm migrate:local -- --status  # 查看已执行 / 待执行
 *   pnpm migrate:local -- --file 2026-05-20-product-management.sql  # 仅执行指定文件
 *
 * 安全：默认仅允许 DB_HOST 为 localhost / 127.0.0.1；连远程需设 ALLOW_REMOTE_MIGRATE=true
 * 线上：请勿使用本脚本，在数据库客户端手动执行 migrations/*.sql
 */

import { createConnection } from 'mysql2/promise';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { loadEnv } from './load-env';

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');
const TRACKING_TABLE = '_schema_migrations';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function parseArgs() {
  const args = process.argv.slice(2);
  let statusOnly = false;
  let file: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--status') statusOnly = true;
    if (args[i] === '--file' && args[i + 1]) {
      file = args[i + 1];
      i++;
    }
  }
  return { statusOnly, file };
}

function listSqlFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function ensureTrackingTable(
  conn: Awaited<ReturnType<typeof createConnection>>,
) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`${TRACKING_TABLE}\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`filename\` varchar(255) NOT NULL,
      \`applied_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`UQ_schema_migrations_filename\` (\`filename\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function getApplied(
  conn: Awaited<ReturnType<typeof createConnection>>,
): Promise<Set<string>> {
  const [rows] = await conn.query<{ filename: string }[]>(
    `SELECT filename FROM \`${TRACKING_TABLE}\` ORDER BY filename`,
  );
  return new Set(rows.map((r) => r.filename));
}

function assertLocalOnly(host: string) {
  if (LOCAL_HOSTS.has(host)) return;
  if (process.env.ALLOW_REMOTE_MIGRATE === 'true') {
    console.warn(
      `[migrate] 警告：正在对非本地主机执行迁移: ${host}（ALLOW_REMOTE_MIGRATE=true）`,
    );
    return;
  }
  console.error(
    `[migrate] 拒绝执行：DB_HOST=${host} 不是本地地址。\n` +
      `  本地请使用 localhost / 127.0.0.1；线上请在数据库客户端手动执行 SQL。\n` +
      `  若确需在远程执行本脚本，请设置 ALLOW_REMOTE_MIGRATE=true（不推荐）。`,
  );
  process.exit(1);
}

async function applyFile(
  conn: Awaited<ReturnType<typeof createConnection>>,
  filename: string,
) {
  const path = join(MIGRATIONS_DIR, filename);
  const sql = readFileSync(path, 'utf-8');
  console.log(`[migrate] 执行: ${filename}`);

  await conn.beginTransaction();
  try {
    await conn.query({ sql, multipleStatements: true });
    await conn.query(
      `INSERT INTO \`${TRACKING_TABLE}\` (filename) VALUES (?)`,
      [filename],
    );
    await conn.commit();
    console.log(`[migrate] 完成: ${filename}`);
  } catch (err) {
    await conn.rollback();
    throw err;
  }
}

async function main() {
  loadEnv();
  const { statusOnly, file: singleFile } = parseArgs();

  const host = process.env.DB_HOST ?? 'localhost';
  const port = parseInt(process.env.DB_PORT ?? '3306', 10);
  const user = process.env.DB_USERNAME ?? 'root';
  const password = process.env.DB_PASSWORD ?? '';
  const database = process.env.DB_DATABASE ?? 'nest_db';

  assertLocalOnly(host);

  const allFiles = listSqlFiles();
  if (allFiles.length === 0) {
    console.log('[migrate] migrations/ 下没有 .sql 文件');
    return;
  }

  const conn = await createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });

  try {
    await ensureTrackingTable(conn);
    const applied = await getApplied(conn);
    const pending = allFiles.filter((f) => !applied.has(f));

    console.log(`[migrate] 数据库: ${user}@${host}:${port}/${database}`);
    console.log(`[migrate] 已执行: ${applied.size}，待执行: ${pending.length}`);

    if (statusOnly) {
      console.log('\n--- 已执行 ---');
      for (const f of [...applied].sort()) console.log(`  ✓ ${f}`);
      console.log('\n--- 待执行 ---');
      for (const f of pending) console.log(`  · ${f}`);
      return;
    }

    const toRun = singleFile
      ? (() => {
          if (!allFiles.includes(singleFile)) {
            throw new Error(`未找到迁移文件: ${singleFile}`);
          }
          if (applied.has(singleFile)) {
            console.log(`[migrate] 已执行过，跳过: ${singleFile}`);
            return [];
          }
          return [singleFile];
        })()
      : pending;

    if (toRun.length === 0) {
      console.log('[migrate] 没有待执行的迁移');
      return;
    }

    for (const filename of toRun) {
      await applyFile(conn, filename);
    }

    console.log(`[migrate] 全部完成，共执行 ${toRun.length} 个文件`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[migrate] 失败:', err instanceof Error ? err.message : err);
  process.exit(1);
});
