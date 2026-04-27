import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: '李四', description: '用户姓名' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'lisi@example.com', description: '邮箱' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: 'admin',
    enum: ['user', 'admin'],
    description: '用户角色',
  })
  @IsEnum(['user', 'admin'])
  @IsOptional()
  role?: 'user' | 'admin';
}
