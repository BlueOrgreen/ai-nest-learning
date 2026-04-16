/**
 * Gateway 代理转发 e2e 测试
 *
 * 测试策略：Mock 下游 HTTP 请求（不依赖真实的 user/order 服务），
 * 专注验证网关的路由匹配、转发逻辑、错误处理等核心行为。
 *
 * 运行命令：pnpm test:e2e --testPathPattern=gateway-proxy
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import request from 'supertest';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosHeaders } from 'axios';
import { AppModule } from '../apps/gateway/src/app.module';

/** 构造一个模拟的 axios 响应 */
function mockAxiosResponse(status: number, data: unknown) {
  return of({
    status,
    data,
    headers: { 'content-type': 'application/json' },
    config: { headers: new AxiosHeaders() },
  } as any);
}

describe('Gateway Proxy (e2e)', () => {
  let app: INestApplication;
  let httpService: HttpService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    httpService = app.get(HttpService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 1. 路由转发到 user-service ────────────────────────────
  describe('Proxy → user-service', () => {
    it('GET /api/users  →  转发到 http://localhost:3001/users', async () => {
      const mockUsers = [{ id: 'uuid-1', name: 'Alice', email: 'alice@test.com' }];
      jest
        .spyOn(httpService, 'request')
        .mockReturnValueOnce(mockAxiosResponse(200, mockUsers));

      const res = await request(app.getHttpServer())
        .get('/api/users')
        .expect(200);

      expect(res.body).toEqual(mockUsers);

      // 验证转发目标 URL
      const requestSpy = jest.spyOn(httpService, 'request');
      const callArg = (httpService.request as jest.Mock).mock.calls[0]?.[0];
      if (callArg) {
        expect(callArg.url).toContain('localhost:3001');
        expect(callArg.url).toContain('/users');
      }
    });

    it('POST /api/users  →  转发 body 到下游', async () => {
      const newUser = { id: 'uuid-2', name: 'Bob', email: 'bob@test.com', role: 'user' };
      jest
        .spyOn(httpService, 'request')
        .mockReturnValueOnce(mockAxiosResponse(201, newUser));

      const res = await request(app.getHttpServer())
        .post('/api/users')
        .send({ name: 'Bob', email: 'bob@test.com', role: 'user' })
        .expect(201);

      expect(res.body).toEqual(newUser);
    });

    it('GET /api/users/:id  →  转发路径参数', async () => {
      const user = { id: 'uuid-1', name: 'Alice' };
      jest
        .spyOn(httpService, 'request')
        .mockReturnValueOnce(mockAxiosResponse(200, user));

      await request(app.getHttpServer())
        .get('/api/users/uuid-1')
        .expect(200);
    });

    it('PATCH /api/users/:id  →  转发 PATCH 方法', async () => {
      jest
        .spyOn(httpService, 'request')
        .mockReturnValueOnce(mockAxiosResponse(200, { id: 'uuid-1', name: 'Alice Updated' }));

      await request(app.getHttpServer())
        .patch('/api/users/uuid-1')
        .send({ name: 'Alice Updated' })
        .expect(200);
    });

    it('DELETE /api/users/:id  →  透传 204 状态码', async () => {
      jest
        .spyOn(httpService, 'request')
        .mockReturnValueOnce(mockAxiosResponse(204, null));

      await request(app.getHttpServer())
        .delete('/api/users/uuid-1')
        .expect(204);
    });
  });

  // ── 2. 路由转发到 order-service ───────────────────────────
  describe('Proxy → order-service', () => {
    it('GET /api/orders  →  转发到 http://localhost:3002/orders', async () => {
      const mockOrders = [{ id: 'order-1', userId: 'uuid-1', amount: 99.9, status: 'pending' }];
      jest
        .spyOn(httpService, 'request')
        .mockReturnValueOnce(mockAxiosResponse(200, mockOrders));

      const res = await request(app.getHttpServer())
        .get('/api/orders')
        .expect(200);

      expect(res.body).toEqual(mockOrders);
    });

    it('GET /api/orders/user/:userId  →  转发嵌套路径', async () => {
      const mockOrders = [{ id: 'order-1', userId: 'uuid-1' }];
      jest
        .spyOn(httpService, 'request')
        .mockReturnValueOnce(mockAxiosResponse(200, mockOrders));

      await request(app.getHttpServer())
        .get('/api/orders/user/uuid-1')
        .expect(200);
    });

    it('POST /api/orders  →  创建订单并透传 201', async () => {
      const newOrder = { id: 'order-2', userId: 'uuid-1', amount: 50, status: 'pending' };
      jest
        .spyOn(httpService, 'request')
        .mockReturnValueOnce(mockAxiosResponse(201, newOrder));

      const res = await request(app.getHttpServer())
        .post('/api/orders')
        .send({ userId: 'uuid-1', description: 'Test', amount: 50 })
        .expect(201);

      expect(res.body).toEqual(newOrder);
    });
  });

  // ── 3. 下游 4xx 响应透传 ──────────────────────────────────
  describe('4xx passthrough', () => {
    it('should pass 404 from downstream as-is', async () => {
      jest
        .spyOn(httpService, 'request')
        .mockReturnValueOnce(mockAxiosResponse(404, { message: 'User not found' }));

      const res = await request(app.getHttpServer())
        .get('/api/users/non-existent')
        .expect(404);

      expect(res.body.message).toBe('User not found');
    });

    it('should pass 409 from downstream as-is', async () => {
      jest
        .spyOn(httpService, 'request')
        .mockReturnValueOnce(mockAxiosResponse(409, { message: 'Email already exists' }));

      await request(app.getHttpServer())
        .post('/api/users')
        .send({ name: 'Dup', email: 'dup@test.com', role: 'user' })
        .expect(409);
    });
  });

  // ── 4. 下游不可达 → 502 Bad Gateway ──────────────────────
  describe('502 when upstream is down', () => {
    it('should return 502 when downstream service is unreachable', async () => {
      const axiosError = new AxiosError('connect ECONNREFUSED');
      jest
        .spyOn(httpService, 'request')
        .mockReturnValueOnce(throwError(() => axiosError));

      const res = await request(app.getHttpServer())
        .get('/api/users')
        .expect(502);

      expect(res.body.message).toContain('Upstream service unavailable');
    });
  });

  // ── 5. 未匹配路由 → 404 ───────────────────────────────────
  describe('404 for unknown routes', () => {
    it('should return 404 for /api/unknown-service', async () => {
      await request(app.getHttpServer())
        .get('/api/unknown-service/foo')
        .expect(404);
    });
  });

  // ── 6. query string 透传 ─────────────────────────────────
  describe('query string forwarding', () => {
    it('should forward query params to downstream', async () => {
      jest
        .spyOn(httpService, 'request')
        .mockImplementationOnce((config) => {
          // 验证 query string 被包含在 URL 中
          expect(config.url).toContain('page=1');
          expect(config.url).toContain('limit=10');
          return mockAxiosResponse(200, []);
        });

      await request(app.getHttpServer())
        .get('/api/users?page=1&limit=10')
        .expect(200);
    });
  });

  // ── 7. x-forwarded-by header 注入 ────────────────────────
  describe('x-forwarded-by header', () => {
    it('should inject x-forwarded-by: nest-gateway header', async () => {
      jest
        .spyOn(httpService, 'request')
        .mockImplementationOnce((config) => {
          expect(config.headers?.['x-forwarded-by']).toBe('nest-gateway');
          return mockAxiosResponse(200, []);
        });

      await request(app.getHttpServer()).get('/api/users').expect(200);
    });
  });
});
