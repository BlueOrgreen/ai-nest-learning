import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

interface UserServiceApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

interface UserSummary {
  id: string;
}

/**
 * 通过 user-service 校验用户是否存在（微服务：不跨库查 users 表）
 */
@Injectable()
export class UserLookupService {
  private readonly logger = new Logger(UserLookupService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>(
      'USER_SERVICE_URL',
      'http://localhost:3001',
    );
  }

  async assertUserExists(userId: string): Promise<void> {
    const url = `${this.baseUrl}/users/${userId}`;
    try {
      const { data } = await firstValueFrom(
        this.http.get<UserServiceApiResponse<UserSummary>>(url),
      );
      if (data.code !== 0 || !data.data?.id) {
        throw new BadRequestException(`用户 #${userId} 不存在`);
      }
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      const axiosErr = err as AxiosError<UserServiceApiResponse<null>>;
      if (axiosErr.response?.status === 404) {
        throw new BadRequestException(`用户 #${userId} 不存在`);
      }
      this.logger.warn(
        `校验用户失败 userId=${userId}: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        '无法连接用户服务校验操作人，请确认 user-service 已启动',
      );
    }
  }
}
