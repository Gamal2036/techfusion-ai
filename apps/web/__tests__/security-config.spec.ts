describe('Web Security Configuration', () => {
  const nextConfig = require('../next.config.js');

  describe('security headers configuration', () => {
    it('exports a valid Next.js config with headers', () => {
      expect(nextConfig).toBeDefined();
      expect(nextConfig.headers).toBeDefined();
      expect(typeof nextConfig.headers).toBe('function');
    });

    it('disables X-Powered-By header', () => {
      expect(nextConfig.poweredByHeader).toBe(false);
    });

    it('configures security headers for all routes', async () => {
      const headers = await nextConfig.headers();
      expect(Array.isArray(headers)).toBe(true);
      expect(headers.length).toBe(1);
      expect(headers[0].source).toBe('/(.*)');

      const headerList = headers[0].headers;
      const headerKeys = headerList.map((h: any) => h.key);

      expect(headerKeys).toContain('X-Content-Type-Options');
      expect(headerKeys).toContain('X-Frame-Options');
      expect(headerKeys).toContain('X-XSS-Protection');
      expect(headerKeys).toContain('Referrer-Policy');
      expect(headerKeys).toContain('Permissions-Policy');
      expect(headerKeys).toContain('Strict-Transport-Security');
      expect(headerKeys).toContain('Content-Security-Policy');
    });

    it('X-Frame-Options is DENY', async () => {
      const headers = await nextConfig.headers();
      const frameOptions = headers[0].headers.find((h: any) => h.key === 'X-Frame-Options');
      expect(frameOptions.value).toBe('DENY');
    });

    it('CSP includes frame-ancestors none', async () => {
      const headers = await nextConfig.headers();
      const csp = headers[0].headers.find((h: any) => h.key === 'Content-Security-Policy');
      expect(csp.value).toContain("frame-ancestors 'none'");
    });

    it('CSP includes default-src self', async () => {
      const headers = await nextConfig.headers();
      const csp = headers[0].headers.find((h: any) => h.key === 'Content-Security-Policy');
      expect(csp.value).toContain("default-src 'self'");
    });

    it('CSP connect-src allows the Railway API gateway and WebSocket origins', async () => {
      const headers = await nextConfig.headers();
      const csp = headers[0].headers.find((h: any) => h.key === 'Content-Security-Policy');
      const connectSrc = csp.value.split('; ').find((d: string) => d.startsWith('connect-src'));
      expect(connectSrc).toContain('https://techfusionapi-gateway-production.up.railway.app');
      expect(connectSrc).toContain('wss://techfusionapi-gateway-production.up.railway.app');
      expect(connectSrc).toContain("'self'");
      expect(connectSrc).toContain('ws:');
      expect(connectSrc).toContain('wss:');
    });

    it('HSTS includes includeSubDomains and preload', async () => {
      const headers = await nextConfig.headers();
      const hsts = headers[0].headers.find((h: any) => h.key === 'Strict-Transport-Security');
      expect(hsts.value).toContain('includeSubDomains');
      expect(hsts.value).toContain('preload');
    });
  });

  describe('connect-src environment-dependent origins', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
    const originalWsUrl = process.env.NEXT_PUBLIC_WS_URL;

    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_API_URL;
      delete process.env.NEXT_PUBLIC_WS_URL;
    });

    afterEach(() => {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
      if (originalApiUrl !== undefined) process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
      else delete process.env.NEXT_PUBLIC_API_URL;
      if (originalWsUrl !== undefined) process.env.NEXT_PUBLIC_WS_URL = originalWsUrl;
      else delete process.env.NEXT_PUBLIC_WS_URL;
      jest.resetModules();
    });

    function loadConfigWithEnv(env: string): any {
      (process.env as Record<string, string | undefined>).NODE_ENV = env;
      jest.resetModules();
      return require('../next.config.js');
    }

    async function getConnectSrc(cfg: any): Promise<string> {
      const headers = await cfg.headers();
      const csp = headers[0].headers.find((h: any) => h.key === 'Content-Security-Policy');
      return csp.value.split('; ').find((d: string) => d.startsWith('connect-src'));
    }

    it('development CSP includes http://localhost:3001', async () => {
      const cfg = loadConfigWithEnv('development');
      const connectSrc = await getConnectSrc(cfg);
      expect(connectSrc).toContain('http://localhost:3001');
    });

    it('development CSP includes ws://localhost:3001', async () => {
      const cfg = loadConfigWithEnv('development');
      const connectSrc = await getConnectSrc(cfg);
      expect(connectSrc).toContain('ws://localhost:3001');
    });

    it('production CSP does not include localhost origins', async () => {
      const cfg = loadConfigWithEnv('production');
      const connectSrc = await getConnectSrc(cfg);
      expect(connectSrc).not.toContain('localhost');
    });

    it('Railway HTTP origin is allowed in both environments', async () => {
      const devCfg = loadConfigWithEnv('development');
      const prodCfg = loadConfigWithEnv('production');
      const devSrc = await getConnectSrc(devCfg);
      const prodSrc = await getConnectSrc(prodCfg);
      expect(devSrc).toContain('https://techfusionapi-gateway-production.up.railway.app');
      expect(prodSrc).toContain('https://techfusionapi-gateway-production.up.railway.app');
    });

    it('Railway WSS origin is allowed in both environments', async () => {
      const devCfg = loadConfigWithEnv('development');
      const prodCfg = loadConfigWithEnv('production');
      const devSrc = await getConnectSrc(devCfg);
      const prodSrc = await getConnectSrc(prodCfg);
      expect(devSrc).toContain('wss://techfusionapi-gateway-production.up.railway.app');
      expect(prodSrc).toContain('wss://techfusionapi-gateway-production.up.railway.app');
    });

    it('no duplicate CSP sources are emitted in development', async () => {
      const cfg = loadConfigWithEnv('development');
      const connectSrc = await getConnectSrc(cfg);
      const entries = connectSrc.replace('connect-src ', '').split(' ');
      const unique = new Set(entries);
      expect(entries.length).toBe(unique.size);
    });

    it('no duplicate CSP sources are emitted in production', async () => {
      const cfg = loadConfigWithEnv('production');
      const connectSrc = await getConnectSrc(cfg);
      const entries = connectSrc.replace('connect-src ', '').split(' ');
      const unique = new Set(entries);
      expect(entries.length).toBe(unique.size);
    });
  });
});
