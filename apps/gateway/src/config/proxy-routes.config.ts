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
  // ── 健康检查路由 ──────────────────────────────────────────────────────────
  // GET /health/user  → http://localhost:3001/health
  // GET /health/order → http://localhost:3002/health
  // stripPrefix 去掉 /health/user 或 /health/order 前缀后，下游收到 /health
  {
    prefix: '/health/user',
    target: 'http://localhost:3001',
    stripPrefix: '/health/user',
  },
  {
    prefix: '/health/order',
    target: 'http://localhost:3002',
    stripPrefix: '/health/order',
  },
];

export const PROXY_ROUTES_TOKEN = 'PROXY_ROUTES';
