import { SetMetadata } from '@nestjs/common';

export type UserRole = 'user' | 'admin';

export const ROLES_KEY = 'roles';

/**
 * 标注接口所需角色，例如 @Roles('admin')
 * 不加此装饰器 = 所有登录用户均可访问
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
