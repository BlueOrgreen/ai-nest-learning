import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';
import { LoginDto } from './dto/login.dto';

interface UserRecord {
  id: string;
  email: string;
  role: string;
  name: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** user-service 地址，与 proxy-routes 保持一致 */
  private readonly userServiceUrl =
    process.env.USER_SERVICE_URL ?? 'http://localhost:3001';

  constructor(
    private readonly httpService: HttpService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ access_token: string }> {
    // 1. 从 user-service 查询 email 是否存在
    const user = await this.findUserByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 学习阶段：user 实体无 password 字段，只要 email 存在即通过
    // 生产环境：需对比 bcrypt.compare(dto.password, user.passwordHash)

    // 2. 签发 JWT
    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload);

    this.logger.log(`[AUTH] Login success: ${user.email} (${user.role})`);
    return { access_token };
  }

  private async findUserByEmail(email: string): Promise<UserRecord | null> {
    try {
      // 调用 user-service：GET /users?email=xxx（需要 user-service 支持此查询）
      // 备选方案：GET /users 全量拉取后在内存过滤（学习阶段可接受）
      const resp = await firstValueFrom(
        this.httpService.get<UserRecord[]>(`${this.userServiceUrl}/users`),
      );
      const users = resp.data ?? [];
      return users.find((u) => u.email === email) ?? null;
    } catch (err) {
      this.logger.error(`[AUTH] Failed to fetch users from user-service: ${(err as Error).message}`);
      throw new UnauthorizedException('认证服务暂时不可用');
    }
  }
}
