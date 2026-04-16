import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/entities/user.entity';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: '',
      database: 'nest_user_service',
      entities: [User],
      synchronize: true, // 学习环境自动同步表结构，生产环境请用 migration
    }),
    UsersModule,
  ],
})
export class AppModule {}
