/**
 * Gateway JWT 认证 & 角色鉴权 e2e 测试
 *
 * 测试策略：Mock user-service HTTP 调用，专注验证网关的认证鉴权逻辑。
 *
 * 运行命令：pnpm test:e2e:auth
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import request from 'supertest';
import { of } from 'rxjs';
import { AxiosHeaders } from 'axios';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../apps/gateway/src/app.module';
import { AuthService } from '../apps/gateway/src/auth/auth.service';
import { JWT_SECRET } from '../apps/gateway/src/auth/auth.constants';

/** 构造 axios 响应 */
function mockAxiosResponse(status: number, data: unknown) {
  return of({
    status,
    data,
    headers: { 'content-type': 'application/json' },
    config: { headers: new AxiosHeaders() },
  } as any);
}

/** 生成测试 JWT */
function makeToken(
  jwtService: JwtService,
  payload: { userId: string; email: string; role: string },
) {
  return jwtService.sign(
    { sub: payload.userId, email: payload.email, role: payload.role },
    { secret: JWT_SECRET },
  );
}

describe('Gateway Auth & JWT (e2e)', () => {
  let app: INestApplication;
  let httpService: HttpService;
  let authService: AuthService;
  let jwtService: JwtService;

  const mockUsers = [
    { id: 'user-uuid-1', name: 'Alice', email: 'alice@test.com', role: 'user' },
    { id: 'admin-uuid-1', name: 'Admin', email: 'admin@test.com', role: 'admin' },
  ];

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    httpService = moduleFixture.get<HttpService>(HttpService);
    authService = moduleFixture.get<AuthService>(AuthService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  // ─── 公开接口 ──────────────────────────────────────────────────────────────

  describe('Public routes', () => {
    it('GET / — health check 无需 token', () => {
      return request(app.getHttpServer()).get('/').expect(200);
    });
  });

  // ─── 登录接口 ──────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('邮箱存在时返回 access_token', async () => {
      // mock authService 的内部 findUserByEmail（通过 spyOn 私有方法）
      jest
        .spyOn(authService as any, 'findUserByEmail')
        .mockResolvedValueOnce(mockUsers[0]);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'alice@test.com', password: 'anything' })
        .expect(200);

      expect(res.body).toHaveProperty('access_token');
      expect(typeof res.body.access_token).toBe('string');
    });

    it('邮箱不存在时返回 401', async () => {
      jest
        .spyOn(authService as any, 'findUserByEmail')
        .mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'notexist@test.com', password: 'anything' })
        .expect(401);
    });

    it('缺少 email 字段时返回 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ password: 'abc' })
        .expect(400);
    });

    it('email 格式非法时返回 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'abc' })
        .expect(400);
    });
  });

  // ─── JWT 保护 ──────────────────────────────────────────────────────────────

  describe('JWT protection on proxy routes', () => {
    it('不带 Token 访问 /api/users 返回 401', async () => {
      await request(app.getHttpServer()).get('/api/users').expect(401);
    });

    it('带无效 Token 返回 401', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });

    it('带过期 Token 返回 401', async () => {
      const expiredToken = jwtService.sign(
        { sub: 'uid', email: 'x@x.com', role: 'user' },
        { secret: JWT_SECRET, expiresIn: '0s' },
      );
      // 等 1ms 让 token 过期
      await new Promise((r) => setTimeout(r, 10));

      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('带有效 Token 可以通过认证（下游被 mock）', async () => {
      const token = makeToken(jwtService, {
        userId: 'user-uuid-1',
        email: 'alice@test.com',
        role: 'user',
      });

      jest
        .spyOn(httpService, 'request')
        .mockReturnValueOnce(mockAxiosResponse(200, mockUsers));

      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── 角色鉴权（通过 x-user-role header 验证注入） ─────────────────────────

  describe('User identity injection to downstream', () => {
    it('网关透传 x-user-id / x-user-role 给下游', async () => {
      const token = makeToken(jwtService, {
        userId: 'user-uuid-1',
        email: 'alice@test.com',
        role: 'user',
      });

      let capturedHeaders: Record<string, string> = {};
      jest.spyOn(httpService, 'request').mockImplementationOnce((config) => {
        capturedHeaders = (config as any).headers ?? {};
        return mockAxiosResponse(200, []);
      });

      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(capturedHeaders['x-user-id']).toBe('user-uuid-1');
      expect(capturedHeaders['x-user-role']).toBe('user');
      expect(capturedHeaders['x-user-email']).toBe('alice@test.com');
      expect(capturedHeaders['x-forwarded-by']).toBe('nest-gateway');
    });
  });
});
