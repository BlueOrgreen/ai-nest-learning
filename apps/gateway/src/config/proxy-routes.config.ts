export interface ProxyRoute {
  /** 网关路径前缀，如 /api/users */
  prefix: string;
  /** 下游服务根地址，如 http://localhost:3001 */
  target: string;
  /** 转发时从路径中去掉的前缀，如 /api → 下游收到 /users/... */
  stripPrefix: string;
}

const userServiceTarget =
  process.env.USER_SERVICE_URL ?? 'http://localhost:3001';
const orderServiceTarget =
  process.env.ORDER_SERVICE_URL ?? 'http://localhost:3002';

export const PROXY_ROUTES: ProxyRoute[] = [
  {
    prefix: '/api/users',
    target: userServiceTarget,
    stripPrefix: '/api',
  },
  {
    prefix: '/api/orders',
    target: orderServiceTarget,
    stripPrefix: '/api',
  },
  {
    prefix: '/api/products',
    target: orderServiceTarget,
    stripPrefix: '/api',
  },
  {
    prefix: '/health/user',
    target: userServiceTarget,
    stripPrefix: '/health/user',
  },
  {
    prefix: '/health/order',
    target: orderServiceTarget,
    stripPrefix: '/health/order',
  },
];

export const PROXY_ROUTES_TOKEN = 'PROXY_ROUTES';
