export interface ProxyRoute {
  /** 网关路径前缀，如 /api/users */
  prefix: string;
  /** 下游服务根地址，如 http://localhost:3001 */
  target: string;
  /** 转发时从路径中去掉的前缀，如 /api → 下游收到 /users/... */
  stripPrefix: string;
}

export const PROXY_ROUTES: ProxyRoute[] = [
  {
    prefix: '/api/users',
    target: 'http://localhost:3001',
    stripPrefix: '/api',
  },
  {
    prefix: '/api/orders',
    target: 'http://localhost:3002',
    stripPrefix: '/api',
  },
];

export const PROXY_ROUTES_TOKEN = 'PROXY_ROUTES';
