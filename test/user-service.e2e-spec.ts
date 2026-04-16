/**
 * user-service e2e 测试
 * 直接测试 user-service（端口 3001），覆盖 CRUD 全流程
 *
 * 运行前提：MySQL nest_user_service 数据库已启动
 * 运行命令：pnpm test:e2e --testPathPattern=user-service
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../apps/user-service/src/app.module';

describe('UserService (e2e)', () => {
  let app: INestApplication;
  let createdUserId: string;

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

  // ── 1. 创建用户 ──────────────────────────────────────────
  describe('POST /users', () => {
    it('should create a user and return 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Alice', email: 'alice@e2e.com', role: 'user' })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Alice',
        email: 'alice@e2e.com',
        role: 'user',
      });
      expect(res.body.id).toBeDefined();
      createdUserId = res.body.id;
    });

    it('should return 400 when email is missing', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Bob' })
        .expect(400);
    });

    it('should return 400 when role is invalid', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Bob', email: 'bob@e2e.com', role: 'superuser' })
        .expect(400);
    });

    it('should return 409 when email already exists', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Alice2', email: 'alice@e2e.com', role: 'user' })
        .expect(409);
    });
  });

  // ── 2. 查询所有用户 ───────────────────────────────────────
  describe('GET /users', () => {
    it('should return an array of users', async () => {
      const res = await request(app.getHttpServer()).get('/users').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ── 3. 查询单个用户 ───────────────────────────────────────
  describe('GET /users/:id', () => {
    it('should return the user by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${createdUserId}`)
        .expect(200);
      expect(res.body.id).toBe(createdUserId);
      expect(res.body.name).toBe('Alice');
    });

    it('should return 404 for non-existent id', () => {
      return request(app.getHttpServer())
        .get('/users/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  // ── 4. 更新用户 ──────────────────────────────────────────
  describe('PATCH /users/:id', () => {
    it('should update user name and return updated data', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/${createdUserId}`)
        .send({ name: 'Alice Updated' })
        .expect(200);
      expect(res.body.name).toBe('Alice Updated');
    });

    it('should return 404 when updating non-existent user', () => {
      return request(app.getHttpServer())
        .patch('/users/00000000-0000-0000-0000-000000000000')
        .send({ name: 'Ghost' })
        .expect(404);
    });
  });

  // ── 5. 删除用户 ──────────────────────────────────────────
  describe('DELETE /users/:id', () => {
    it('should delete user and return 204', () => {
      return request(app.getHttpServer())
        .delete(`/users/${createdUserId}`)
        .expect(204);
    });

    it('should return 404 after deletion', () => {
      return request(app.getHttpServer())
        .get(`/users/${createdUserId}`)
        .expect(404);
    });
  });
});
