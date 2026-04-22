import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './jwt-auth.guard';

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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
