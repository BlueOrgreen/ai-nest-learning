import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
   * Body: { email, password }
   * Response: { access_token: "eyJ..." }
   *
   * 🔒 单独收紧限流：登录是暴力破解的高危入口
   *    全局策略 100次/分钟，这里覆盖为 5次/分钟
   *    超过后返回 429，强制等待窗口重置（最多 60s）
   */
  @ApiOperation({
    summary: '用户登录',
    description: '返回 JWT access_token。\n限流：5次/分钟（防暴力破解），超过后返回 429。',
  })
  @ApiBody({ schema: { example: { email: 'admin@example.com', password: '123456' } } })
  @ApiResponse({ status: 200, description: '登录成功，返回 { access_token: "eyJ..." }' })
  @ApiResponse({ status: 401, description: '邮箱或密码错误' })
  @ApiResponse({ status: 429, description: '登录请求过于频繁（5次/分钟限制）' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Public()
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
