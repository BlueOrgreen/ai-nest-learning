import { All, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { ProxyService } from './proxy.service';

@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  /** POST /api/orders —— 无需登录即可创建订单 */
  @Post('api/orders')
  @Public()
  async createOrder(@Req() req: Request, @Res() res: Response) {
    await this.proxyService.forward(req, res);
  }

  /**
   * 通配符路由：捕获所有其他 /api/* 请求，需要登录（JwtAuthGuard 全局生效）
   * 不加 @Roles() = 所有已登录用户均可访问
   * 写操作（POST/PATCH/DELETE）限制 admin 由各自路由方法单独标注
   */
  @All('api/*')
  async proxy(@Req() req: Request, @Res() res: Response) {
    await this.proxyService.forward(req, res);
  }
}
