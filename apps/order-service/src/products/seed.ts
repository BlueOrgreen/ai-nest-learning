/**
 * Seed 脚本：插入商品初始数据
 *
 * 运行方式：
 *   npm run seed:products
 *
 * 直接加载 NestJS 应用上下文，调用 ProductsService 写入数据。
 * 不依赖应用启动（无 HTTP 服务），纯数据操作。
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Product } from './entities/product.entity';

// 简单读取 .env 文件（避免引入 dotenv 依赖）
function loadEnv() {
  for (const file of ['apps/order-service/.env', '.env']) {
    try {
      const content = readFileSync(file, 'utf-8');
      for (const line of content.split('\n')) {
        const [key, ...vals] = line.split('=');
        if (key && vals.length) {
          process.env[key.trim()] = vals.join('=').trim();
        }
      }
    } catch {}
  }
}

loadEnv();

const SEED_PRODUCTS = [
  { name: '珍珠奶茶', price: 18.0, stock: 100 },
  { name: '芝士奶盖绿茶', price: 22.0, stock: 80 },
  { name: '芋泥波波奶茶', price: 25.0, stock: 60 },
  { name: '杨枝甘露', price: 24.0, stock: 50 },
  { name: '柠檬蜂蜜水', price: 16.0, stock: 120 },
  { name: '茉莉花茶', price: 14.0, stock: 90 },
  { name: '椰果奶茶', price: 20.0, stock: 70 },
  { name: '芒果冰沙', price: 28.0, stock: 40 },
  { name: '红豆芋泥波波', price: 26.0, stock: 55 },
  { name: '抹茶拿铁', price: 23.0, stock: 65 },
];

async function seed() {
  console.log('[Seed] 初始化数据库连接...');

  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'nest_db',
    entities: [Product],
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
  });

  await dataSource.initialize();
  console.log('[Seed] 数据库连接已建立');

  const repo = dataSource.getRepository(Product);

  // 检查是否已有数据
  const count = await repo.count();
  if (count > 0) {
    console.log(`[Seed] 商品表已有 ${count} 条数据，跳过初始化`);
    await dataSource.destroy();
    return;
  }

  // 批量插入
  console.log(`[Seed] 开始插入 ${SEED_PRODUCTS.length} 条商品...`);
  const entities = SEED_PRODUCTS.map((p) => repo.create(p));
  const saved = await repo.save(entities);

  saved.forEach((p) => console.log(`  ✓ ${p.name} (id=${p.id})`));
  console.log(`[Seed] 完成，共插入 ${saved.length} 条`);

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('[Seed] 失败:', err);
  process.exit(1);
});
