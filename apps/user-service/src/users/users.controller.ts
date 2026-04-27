import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: '获取所有用户（按创建时间倒序）' })
  @ApiResponse({ status: 200, description: '用户列表' })
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @ApiOperation({ summary: '根据 UUID 获取单个用户' })
  @ApiParam({ name: 'id', example: 'uuid-user-xxx', description: '用户 UUID' })
  @ApiResponse({ status: 200, description: '用户信息' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @ApiOperation({ summary: '创建新用户' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: '创建成功，返回用户对象' })
  @ApiResponse({ status: 409, description: 'Email 已存在' })
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @ApiOperation({ summary: '部分更新用户信息' })
  @ApiParam({ name: 'id', example: 'uuid-user-xxx' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: '更新后的用户对象' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @ApiOperation({ summary: '删除用户' })
  @ApiParam({ name: 'id', example: 'uuid-user-xxx' })
  @ApiResponse({ status: 204, description: '删除成功，无响应体' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
