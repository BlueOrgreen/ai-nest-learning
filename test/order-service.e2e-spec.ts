/**
 * order-service e2e 测试
 * 直接测试 order-service（端口 3002），覆盖订单 CRUD + 状态流转
 *
 * 运行前提：MySQL nest_order_service 数据库已启动
 * 运行命令：pnpm test:e2e --testPathPattern=order-service
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../apps/order-service/src/app.module';

describe('OrderService (e2e)', () => {
  let app: INestApplication;
  const testUserId = '00000000-0000-0000-0000-000000000001'; // 测试用伪 userId
  let createdOrderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 1. 创建订单 ──────────────────────────────────────────
  describe('POST /orders', () => {
    it('should create an order and return 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: testUserId,
          description: 'E2E Test Order',
          amount: 99.99,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        userId: testUserId,
        description: 'E2E Test Order',
        amount: 99.99,
        status: 'pending',
      });
      expect(res.body.id).toBeDefined();
      createdOrderId = res.body.id;
    });

    it('should return 400 when userId is missing', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({ description: 'Bad Order', amount: 10 })
        .expect(400);
    });

    it('should return 400 when amount is negative', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({ userId: testUserId, description: 'Bad Amount', amount: -1 })
        .expect(400);
    });
  });

  // ── 2. 查询所有订单 ───────────────────────────────────────
  describe('GET /orders', () => {
    it('should return an array of orders', async () => {
      const res = await request(app.getHttpServer()).get('/orders').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ── 3. 按用户查询订单 ─────────────────────────────────────
  describe('GET /orders/user/:userId', () => {
    it('should return orders for the given userId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/user/${testUserId}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.every((o: any) => o.userId === testUserId)).toBe(true);
    });

    it('should return empty array for userId with no orders', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/user/00000000-0000-0000-0000-999999999999')
        .expect(200);
      expect(res.body).toEqual([]);
    });
  });

  // ── 4. 查询单个订单 ───────────────────────────────────────
  describe('GET /orders/:id', () => {
    it('should return the order by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${createdOrderId}`)
        .expect(200);
      expect(res.body.id).toBe(createdOrderId);
    });

    it('should return 404 for non-existent id', () => {
      return request(app.getHttpServer())
        .get('/orders/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  // ── 5. 更新订单状态 ───────────────────────────────────────
  describe('PATCH /orders/:id', () => {
    it('should update order status to paid', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${createdOrderId}`)
        .send({ status: 'paid' })
        .expect(200);
      expect(res.body.status).toBe('paid');
    });

    it('should return 400 when status is invalid', () => {
      return request(app.getHttpServer())
        .patch(`/orders/${createdOrderId}`)
        .send({ status: 'unknown-status' })
        .expect(400);
    });

    it('should return 404 when updating non-existent order', () => {
      return request(app.getHttpServer())
        .patch('/orders/00000000-0000-0000-0000-000000000000')
        .send({ status: 'paid' })
        .expect(404);
    });
  });

  // ── 6. 删除订单 ──────────────────────────────────────────
  describe('DELETE /orders/:id', () => {
    it('should delete order and return 204', () => {
      return request(app.getHttpServer())
        .delete(`/orders/${createdOrderId}`)
        .expect(204);
    });

    it('should return 404 after deletion', () => {
      return request(app.getHttpServer())
        .get(`/orders/${createdOrderId}`)
        .expect(404);
    });
  });
});
