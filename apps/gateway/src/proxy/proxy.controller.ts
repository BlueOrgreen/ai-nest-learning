import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
@ApiTags('proxy（代理）')
@SkipTransform()
@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  /**
   * /api/orders 精确匹配 —— 无需登录
   * 处理：POST /api/orders（创建订单）等根路径请求
   */
  @ApiOperation({
    summary: '代理：订单服务（根路径）',
    description: '所有 /api/orders 请求透传至 Order Service (3002)。\n\n完整接口文档见 [http://localhost:3002/docs](http://localhost:3002/docs)',
  })
  @All('api/orders')
  @Public()
  async ordersRoot(@Req() req: Request, @Res() res: Response) {
    await this.proxyService.forward(req, res);
  }

  /**
   * /api/orders/:id 等子路径 —— 无需登录
   * Express 5 不支持裸 *，必须用 {*path} 或 *path（带参数名）
   */
  @ApiOperation({
    summary: '代理：订单服务（子路径）',
    description: '所有 /api/orders/* 请求透传至 Order Service (3002)。\n\n完整接口文档见 [http://localhost:3002/docs](http://localhost:3002/docs)',
  })
  @All('api/orders/{*path}')
  @Public()
  async ordersProxy(@Req() req: Request, @Res() res: Response) {
    await this.proxyService.forward(req, res);
  }

  /**
   * 兜底：所有其他 /api/* 请求 —— 需要登录（JwtAuthGuard 全局生效）
   * Express 5 通配符语法：{*path}
   */
  @ApiOperation({
    summary: '代理：其他服务（含用户服务，需 JWT）',
    description:
      '所有其他 /api/* 请求（如 /api/users/*）透传至对应下游服务，需携带 Bearer Token。\n\n' +
      '用户服务完整文档见 [http://localhost:3001/docs](http://localhost:3001/docs)',
  })
  @All('api/{*path}')
  async proxy(@Req() req: Request, @Res() res: Response) {
    await this.proxyService.forward(req, res);
  }
}
