import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService } from '../circuit-breaker.service';
import { CircuitBreakerOpenError } from '../interfaces/circuit-breaker.interface';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CircuitBreakerService],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('execute', () => {
    it('should execute successful operation', async () => {
      const target = 'http://localhost:3001';
      const result = await service.execute(target, () => Promise.resolve('success'));
      expect(result).toBe('success');
    });

    it('should throw CircuitBreakerOpenError after consecutive failures', async () => {
      const target = 'http://localhost:9999'; // 不存在服务
      
      // 模拟多次失败
      for (let i = 0; i < 5; i++) {
        await expect(
          service.execute(target, () => Promise.reject(new Error('模拟失败')))
        ).rejects.toThrow(Error);
      }

      // 熔断器应已打开
      await expect(
        service.execute(target, () => Promise.resolve('成功'))
      ).rejects.toThrow(CircuitBreakerOpenError);
    });

    it('should return circuit breaker status', async () => {
      const target = 'http://localhost:3001';
      await service.execute(target, () => Promise.resolve('test'));
      
      const status = service.getStatus(target);
      expect(status).toBeDefined();
      expect(status?.state).toBe('closed');
      expect(status?.requestCount).toBeGreaterThanOrEqual(1);
    });
  });
});