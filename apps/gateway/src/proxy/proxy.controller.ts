import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  /**
   * 通配符路由：捕获所有 /api/* 路径，支持 GET/POST/PATCH/DELETE 等所有方法
   */
  @All('api/*')
  async proxy(@Req() req: Request, @Res() res: Response) {
    await this.proxyService.forward(req, res);
  }
}
