import { readFileSync } from 'fs';

/**
 * 按 Nest ConfigModule 顺序加载 .env（后加载的覆盖先加载的）
 */
export function loadEnv(): void {
  const files = ['.env', 'apps/order-service/.env'];
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    } catch {
      // 文件不存在则跳过
    }
  }
}
