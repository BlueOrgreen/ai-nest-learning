import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { PROXY_ROUTES, PROXY_ROUTES_TOKEN } from '../config/proxy-routes.config';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  controllers: [ProxyController],
  providers: [
    ProxyService,
    {
      provide: PROXY_ROUTES_TOKEN,
      useValue: PROXY_ROUTES,
    },
  ],
})
export class ProxyModule {}
