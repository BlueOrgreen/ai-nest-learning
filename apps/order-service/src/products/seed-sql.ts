/**
 * SQL/TypeORM Seeder — 纯数据文件方式
 *
 * 运行方式：
 *   npm run seed:products:sql
 *
 * 直接建 DataSource，通过 repository.insert() 批量插入。
 * 与 seed.ts 的区别：这里的 seed 数据提取为纯数据常量，
 * 不执行业务逻辑（create/事务），仅批量 INSERT。
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { Product } from './entities/product.entity';

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

// 纯数据，与业务逻辑解耦
const SEED_PRODUCTS = [
  // 原有 10 条
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
  // 新增 30 条
  { name: '乌龙奶茶', price: 19.0, stock: 85 },
  { name: '茉莉奶绿', price: 17.0, stock: 110 },
  { name: '葡萄柚绿', price: 21.0, stock: 75 },
  { name: '百香果茶', price: 20.0, stock: 95 },
  { name: '燕麦奶咖', price: 26.0, stock: 45 },
  { name: '生椰拿铁', price: 27.0, stock: 50 },
  { name: '桂花乌龙', price: 18.0, stock: 80 },
  { name: '蜜桃乌龙', price: 19.0, stock: 70 },
  { name: '葡萄芋泥', price: 27.0, stock: 35 },
  { name: '蓝莓奶盖', price: 29.0, stock: 40 },
  { name: '柚子茶', price: 15.0, stock: 130 },
  { name: '洛神花茶', price: 13.0, stock: 100 },
  { name: '玫瑰花茶', price: 16.0, stock: 90 },
  { name: '红枣姜茶', price: 17.0, stock: 60 },
  { name: '桂圆红枣茶', price: 18.0, stock: 55 },
  { name: '芒果西米露', price: 24.0, stock: 45 },
  { name: '椰汁西米露', price: 22.0, stock: 50 },
  { name: '芋圆奶茶', price: 21.0, stock: 65 },
  { name: '烧仙草奶茶', price: 20.0, stock: 70 },
  { name: '布丁奶茶', price: 19.0, stock: 80 },
  { name: '焦糖玛奇朵', price: 30.0, stock: 35 },
  { name: '香草拿铁', price: 28.0, stock: 40 },
  { name: '摩卡咖啡', price: 29.0, stock: 38 },
  { name: '美式咖啡', price: 22.0, stock: 60 },
  { name: '卡布奇诺', price: 27.0, stock: 42 },
  { name: '柠檬绿茶', price: 15.0, stock: 100 },
  { name: '薄荷奶绿', price: 18.0, stock: 75 },
  { name: '可可拿铁', price: 26.0, stock: 48 },
  { name: '抹茶奶茶', price: 21.0, stock: 68 },
  { name: '榛果奶茶', price: 22.0, stock: 62 },
];

async function seed() {
  console.log('[Seed-SQL] 初始化数据库连接...');

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
  console.log('[Seed-SQL] 数据库连接已建立');

  const repo = dataSource.getRepository(Product);

  const countBefore = await repo.count();
  console.log(`[Seed-SQL] 当前商品表有 ${countBefore} 条数据`);

  if (countBefore > 0) {
    console.log(`[Seed-SQL] 表已有数据，插入前先清空（TRUNCATE）...`);
    await repo.query('TRUNCATE TABLE products');
    console.log(`[Seed-SQL] 已清空，重新插入 ${SEED_PRODUCTS.length} 条...`);
  } else {
    console.log(`[Seed-SQL] 开始批量插入 ${SEED_PRODUCTS.length} 条商品...`);
  }

  // 批量 insert（直接 INSERT，不走 create/save 实体创建流程）
  await repo.insert(SEED_PRODUCTS);

  // 验证
  const inserted = await repo.find();
  const countAfter = inserted.length;
  inserted.forEach((p) => console.log(`  ✓ ${p.name} (id=${p.id})`));
  console.log(
    `[Seed-SQL] 完成，插入前 ${countBefore} 条 → 插入后 ${countAfter} 条`,
  );

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('[Seed-SQL] 失败:', err);
  process.exit(1);
});
