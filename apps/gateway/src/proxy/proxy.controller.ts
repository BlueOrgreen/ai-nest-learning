import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SkipTransform } from '../decorators/skip-transform.decorator';
import { Public } from '../auth/jwt-auth.guard';
import { ProxyService } from './proxy.service';

/**
 * ProxyController
 *
 * 所有路由均使用 @Res() 直接操控响应流（透传下游服务的响应），
 * @SkipTransform() 声明跳过 TransformInterceptor 的响应包装。
 */
@SkipTransform()
@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  /**
   * /api/orders 精确匹配 —— 无需登录
   * 处理：POST /api/orders（创建订单）等根路径请求
   */
  @All('api/orders')
  @Public()
  async ordersRoot(@Req() req: Request, @Res() res: Response) {
    await this.proxyService.forward(req, res);
  }

  /**
   * /api/orders/:id 等子路径 —— 无需登录
   * Express 5 不支持裸 *，必须用 {*path} 或 *path（带参数名）
   */
  @All('api/orders/{*path}')
  @Public()
  async ordersProxy(@Req() req: Request, @Res() res: Response) {
    await this.proxyService.forward(req, res);
  }

  /**
   * 兜底：所有其他 /api/* 请求 —— 需要登录（JwtAuthGuard 全局生效）
   * Express 5 通配符语法：{*path}
   */
  @All('api/{*path}')
  async proxy(@Req() req: Request, @Res() res: Response) {
    await this.proxyService.forward(req, res);
  }
}
