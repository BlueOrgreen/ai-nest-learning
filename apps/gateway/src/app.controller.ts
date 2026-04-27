import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './auth/jwt-auth.guard';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({
    summary: '健康检查',
    description: '无需登录，确认网关服务正常运行。',
  })
  @ApiResponse({ status: 200, description: '返回字符串 "Hello World!"' })
  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }
}
