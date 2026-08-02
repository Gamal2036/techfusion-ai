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

    it('HSTS includes includeSubDomains and preload', async () => {
      const headers = await nextConfig.headers();
      const hsts = headers[0].headers.find((h: any) => h.key === 'Strict-Transport-Security');
      expect(hsts.value).toContain('includeSubDomains');
      expect(hsts.value).toContain('preload');
    });
  });
});
