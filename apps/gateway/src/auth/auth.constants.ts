/** JWT 签名密钥（学习阶段硬编码，生产应从环境变量读取） */
export const JWT_SECRET = process.env.JWT_SECRET ?? 'my-firstnest-secret-2026';

/** Token 有效期 */
export const JWT_EXPIRES_IN = '24h';
