if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    body: any;
    status: number;
    statusText: string;
    ok: boolean;
    headers: any;
    constructor(body?: any, init?: any) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.ok = this.status >= 200 && this.status < 300;
      this.headers = new Map(Object.entries(init?.headers || {}));
    }
    async json() {
      if (typeof this.body === 'string') return JSON.parse(this.body);
      return this.body;
    }
    async text() {
      if (typeof this.body === 'string') return this.body;
      return JSON.stringify(this.body);
    }
  } as any;
}
