import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: '张三', description: '用户姓名' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'zhangsan@example.com', description: '邮箱（唯一索引）' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'user',
    enum: ['user', 'admin'],
    description: '用户角色，默认 user',
    default: 'user',
  })
  @IsEnum(['user', 'admin'])
  role: 'user' | 'admin' = 'user';
}
