import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * DatabaseModule
 *
 * 共享数据库连接模块，封装 TypeORM 连接配置和连接池参数。
 * 使用 autoLoadEntities: true，各服务通过 TypeOrmModule.forFeature([Entity])
 * 注册自己的 entity，无需在此集中声明。
 *
 * 依赖：各服务 AppModule 需先以 isGlobal: true 注册 ConfigModule，
 *       使 ConfigService 在全局可被注入。
 *
 * 使用方式：
 *   @Module({ imports: [DatabaseModule] })
 *   export class AppModule {}
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host:     config.get<string>('DB_HOST', 'localhost'),
        port:     config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USERNAME', 'root'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_DATABASE', 'nest_db'),

        // 关键：不在此写死 entities，forFeature 注册时自动收集
        autoLoadEntities: true,

        // 生产环境必须为 false，改用 migration 管理表结构变更
        synchronize: config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',

        // 连接池配置（mysql2 驱动通过 extra 字段传入）
        extra: {
          connectionLimit: config.get<number>('DB_POOL_SIZE', 10),
          connectTimeout:  config.get<number>('DB_CONNECT_TIMEOUT', 10000),
        },
      }),
    }),
  ],
  // TypeOrmModule.forRootAsync 的 DataSource 会自动注册为全局 token，无需手动 exports
})
export class DatabaseModule {}
