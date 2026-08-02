import * as jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-ws-secret-key';

function signToken(payload: Record<string, unknown>, options?: jwt.SignOptions): string {
  return jwt.sign(payload, JWT_SECRET, options);
}

interface MockSocket {
  handshake: {
    auth: Record<string, unknown>;
    headers: Record<string, string>;
  };
  data: Record<string, unknown>;
}

function createMockSocket(overrides: Partial<{ token: string; headerAuth: string; auth: Record<string, unknown> }> = {}): MockSocket {
  const socket: MockSocket = {
    handshake: {
      auth: overrides.auth ?? (overrides.token !== undefined ? { token: overrides.token } : {}),
      headers: overrides.headerAuth !== undefined ? { authorization: `Bearer ${overrides.headerAuth}` } : {},
    },
    data: {},
  };
  return socket;
}

describe('WebSocket Authentication Middleware', () => {
  let middleware: (socket: MockSocket, next: (err?: Error) => void) => void;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    // Import fresh to pick up env
    jest.resetModules();
    const mod = require('../src/common/ws-auth.middleware');
    middleware = mod.createWsAuthMiddleware();
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  // Test 1: Valid JWT socket authentication succeeds
  it('should accept valid JWT from auth.token and attach user to socket.data', (done) => {
    const token = signToken({ sub: 'user-1', orgId: 'org-1', role: 'Owner' });
    const socket = createMockSocket({ token });

    middleware(socket, (err) => {
      expect(err).toBeUndefined();
      expect(socket.data.user).toEqual({
        userId: 'user-1',
        orgId: 'org-1',
        role: 'Owner',
      });
      done();
    });
  });

  // Test 2: Missing JWT is rejected
  it('should reject connection with no token', (done) => {
    const socket = createMockSocket({});

    middleware(socket, (err) => {
      expect(err).toBeDefined();
      expect(err!.message).toBe('Authentication required');
      done();
    });
  });

  // Test 3: Invalid JWT is rejected
  it('should reject connection with malformed JWT', (done) => {
    const socket = createMockSocket({ token: 'not.a.valid.jwt' });

    middleware(socket, (err) => {
      expect(err).toBeDefined();
      expect(err!.message).toBe('Invalid or expired token');
      done();
    });
  });

  // Test 4: Expired JWT is rejected
  it('should reject connection with expired JWT', (done) => {
    const token = signToken(
      { sub: 'user-1', orgId: 'org-1', role: 'Owner' },
      { expiresIn: '-1h' },
    );
    const socket = createMockSocket({ token });

    middleware(socket, (err) => {
      expect(err).toBeDefined();
      expect(err!.message).toBe('Invalid or expired token');
      done();
    });
  });

  // Test 5: Accepts token from Authorization header
  it('should accept valid JWT from Authorization header', (done) => {
    const token = signToken({ sub: 'user-2', orgId: 'org-2', role: 'Admin' });
    const socket = createMockSocket({ headerAuth: token });

    middleware(socket, (err) => {
      expect(err).toBeUndefined();
      expect(socket.data.user).toEqual({
        userId: 'user-2',
        orgId: 'org-2',
        role: 'Admin',
      });
      done();
    });
  });

  // Test 6: Rejects token with missing claims
  it('should reject token with missing required claims', (done) => {
    const token = signToken({ sub: 'user-1' }); // missing orgId and role
    const socket = createMockSocket({ token });

    middleware(socket, (err) => {
      expect(err).toBeDefined();
      expect(err!.message).toBe('Invalid token payload');
      done();
    });
  });

  // Test 7: Auth token takes precedence over header
  it('should prefer auth.token over Authorization header', (done) => {
    const tokenAuth = signToken({ sub: 'user-a', orgId: 'org-a', role: 'Owner' });
    const tokenHeader = signToken({ sub: 'user-b', orgId: 'org-b', role: 'Admin' });
    const socket = createMockSocket({ token: tokenAuth, headerAuth: tokenHeader });

    middleware(socket, (err) => {
      expect(err).toBeUndefined();
      expect(socket.data.user).toEqual({
        userId: 'user-a',
        orgId: 'org-a',
        role: 'Owner',
      });
      done();
    });
  });

  // Test 8: Empty auth object is rejected
  it('should reject when auth object exists but token is empty string', (done) => {
    const socket = createMockSocket({ auth: { token: '' } });

    middleware(socket, (err) => {
      expect(err).toBeDefined();
      expect(err!.message).toBe('Authentication required');
      done();
    });
  });
});

describe('Gateway Namespace Ownership', () => {
  // Test 9: /metrics namespace has a single owner (DevicesGateway)
  it('AlertsGateway should not be a WebSocketGateway (plain injectable)', () => {
    const mod = require('../src/alerts/alerts.gateway');
    const AlertsGateway = mod.AlertsGateway;

    const instance = new AlertsGateway();
    expect(instance.setServer).toBeDefined();
    expect(instance.broadcastAlert).toBeDefined();
    // AlertsGateway should NOT have handleConnection (not a gateway)
    expect(instance.handleConnection).toBeUndefined();
  });

  it('DevicesGateway should implement OnGatewayInit', () => {
    const mod = require('../src/devices/devices.gateway');
    const DevicesGateway = mod.DevicesGateway;
    const proto = DevicesGateway.prototype;
    expect(typeof proto.afterInit).toBe('function');
    expect(typeof proto.handleConnection).toBe('function');
    expect(typeof proto.handleDisconnect).toBe('function');
    expect(typeof proto.broadcastMetrics).toBe('function');
    expect(typeof proto.broadcastAlert).toBe('function');
  });

  // Test 10: /metrics namespace has single CORS config (no wildcard)
  it('DevicesGateway should use getWsCorsOrigins for CORS', () => {
    const gatewaySource = require('fs').readFileSync(
      require('path').join(__dirname, '../src/devices/devices.gateway.ts'),
      'utf8',
    );
    expect(gatewaySource).toContain('getWsCorsOrigins()');
    expect(gatewaySource).not.toContain("origin: '*'");
  });

  it('NetworkGateway should use getWsCorsOrigins for CORS', () => {
    const gatewaySource = require('fs').readFileSync(
      require('path').join(__dirname, '../src/network/network.gateway.ts'),
      'utf8',
    );
    expect(gatewaySource).toContain('getWsCorsOrigins()');
    expect(gatewaySource).not.toContain("origin: '*'");
  });

  it('RemoteSupportGateway should use getWsCorsOrigins for CORS', () => {
    const gatewaySource = require('fs').readFileSync(
      require('path').join(__dirname, '../src/remote-support/remote-support.gateway.ts'),
      'utf8',
    );
    expect(gatewaySource).toContain('getWsCorsOrigins()');
    expect(gatewaySource).not.toContain("origin: '*'");
  });
});

describe('Tenant Room Isolation', () => {
  // Test: Server derives orgId from JWT, ignores client query
  it('DevicesGateway.handleConnection uses socket.data.user.orgId, not query', () => {
    const mod = require('../src/devices/devices.gateway');
    const DevicesGateway = mod.DevicesGateway;

    const gateway = new DevicesGateway({ setServer: jest.fn() });
    gateway.orgRooms = new Map();

    const mockClient = {
      id: 'socket-1',
      data: { user: { userId: 'u1', orgId: 'org-trusted', role: 'Owner' } },
      handshake: { query: { orgId: 'org-fake' } },
      join: jest.fn(),
    };

    gateway.handleConnection(mockClient);

    expect(mockClient.join).toHaveBeenCalledWith('org:org-trusted');
    expect(gateway.orgRooms.has('org-trusted')).toBe(true);
    expect(gateway.orgRooms.has('org-fake')).toBe(false);
  });

  // Test: Client without auth is disconnected
  it('DevicesGateway.disconnects unauthenticated client', () => {
    const mod = require('../src/devices/devices.gateway');
    const DevicesGateway = mod.DevicesGateway;

    const gateway = new DevicesGateway({ setServer: jest.fn() });

    const mockClient = {
      id: 'socket-noauth',
      data: {},
      handshake: { query: {} },
      disconnect: jest.fn(),
    };

    gateway.handleConnection(mockClient);

    expect(mockClient.disconnect).toHaveBeenCalledWith(true);
  });

  // Test: NetworkGateway also uses server-derived orgId
  it('NetworkGateway.handleConnection uses socket.data.user.orgId, not query', () => {
    const mod = require('../src/network/network.gateway');
    const NetworkGateway = mod.NetworkGateway;

    const gateway = new NetworkGateway();
    gateway.orgRooms = new Map();

    const mockClient = {
      id: 'socket-2',
      data: { user: { userId: 'u2', orgId: 'org-network', role: 'Admin' } },
      handshake: { query: { orgId: 'org-fake' } },
      join: jest.fn(),
    };

    gateway.handleConnection(mockClient);

    expect(mockClient.join).toHaveBeenCalledWith('org:org-network');
    expect(gateway.orgRooms.has('org-network')).toBe(true);
  });

  // Test: RemoteSupportGateway uses verified orgId from JWT
  it('RemoteSupportGateway.handleConnection uses verified orgId for rooms', async () => {
    const mod = require('../src/remote-support/remote-support.gateway');
    const RemoteSupportGateway = mod.RemoteSupportGateway;

    const mockPrisma = {
      remoteSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sess-1', orgId: 'org-real' }),
      },
    };

    const gateway = new RemoteSupportGateway(mockPrisma);
    gateway.peers = new Map();
    gateway.sessionPeers = new Map();

    const mockClient = {
      id: 'socket-3',
      data: { user: { userId: 'u3', orgId: 'org-real', role: 'Owner' } },
      handshake: { query: { sessionId: 'sess-1', role: 'technician' } },
      join: jest.fn(),
    };

    await gateway.handleConnection(mockClient);

    expect(mockClient.join).toHaveBeenCalledWith('session:sess-1');
    expect(mockClient.join).toHaveBeenCalledWith('org:org-real');
    expect(gateway.peers.get('socket-3')!.orgId).toBe('org-real');
  });

  // Test: RemoteSupportGateway rejects missing role
  it('RemoteSupportGateway disconnects client with invalid role', async () => {
    const mod = require('../src/remote-support/remote-support.gateway');
    const RemoteSupportGateway = mod.RemoteSupportGateway;

    const mockPrisma = {
      remoteSession: {
        findFirst: jest.fn(),
      },
    };

    const gateway = new RemoteSupportGateway(mockPrisma);

    const mockClient = {
      id: 'socket-4',
      data: { user: { userId: 'u4', orgId: 'org-4', role: 'Owner' } },
      handshake: { query: { sessionId: 'sess-1' } },
      join: jest.fn(),
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(mockClient);

    expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    expect(mockPrisma.remoteSession.findFirst).not.toHaveBeenCalled();
  });
});

describe('WebSocket CORS Configuration', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('getWsCorsOrigins returns allowed origins from env', () => {
    process.env.WS_ALLOWED_ORIGINS = 'https://app.example.com,https://admin.example.com';
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const { getWsCorsOrigins } = require('../src/common/ws-cors');
    const origins = getWsCorsOrigins();
    expect(origins).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });

  it('getWsCorsOrigins returns localhost defaults in development', () => {
    delete process.env.WS_ALLOWED_ORIGINS;
    process.env.NODE_ENV = 'development';
    jest.resetModules();
    const { getWsCorsOrigins } = require('../src/common/ws-cors');
    const origins = getWsCorsOrigins();
    expect(origins).toContain('http://localhost:3000');
    expect(origins).not.toContain('*');
  });

  it('getWsCorsOrigins never returns wildcard in production', () => {
    delete process.env.WS_ALLOWED_ORIGINS;
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const { getWsCorsOrigins } = require('../src/common/ws-cors');
    const origins = getWsCorsOrigins();
    expect(origins).not.toContain('*');
    expect(origins).toContain('https://techfusion.ai');
  });

  it('getWsCorsOrigins handles comma-separated origins with whitespace', () => {
    process.env.WS_ALLOWED_ORIGINS = ' https://a.com , https://b.com ';
    jest.resetModules();
    const { getWsCorsOrigins } = require('../src/common/ws-cors');
    const origins = getWsCorsOrigins();
    expect(origins).toEqual(['https://a.com', 'https://b.com']);
  });
});

describe('Cross-Organization Isolation', () => {
  // Test: Organization A events cannot reach Organization B
  it('DevicesGateway emits only to the verified org room', () => {
    const emittedTo: string[] = [];

    const mockServer = {
      to: jest.fn((room: string) => {
        emittedTo.push(room);
        return { emit: jest.fn() };
      }),
    };

    const mod = require('../src/devices/devices.gateway');
    const DevicesGateway = mod.DevicesGateway;

    const gateway = new DevicesGateway({ setServer: jest.fn() });
    (gateway as any).server = mockServer;

    gateway.broadcastMetrics('org-a', 'device-1', { cpu: 50 });
    gateway.broadcastAlert('org-a', { severity: 'critical' });

    expect(emittedTo).toEqual(['org:org-a', 'org:org-a']);
    expect(emittedTo.filter((r) => r === 'org:org-b')).toHaveLength(0);
  });

  it('NetworkGateway emits only to the verified org room', () => {
    const emittedTo: string[] = [];

    const mockServer = {
      to: jest.fn((room: string) => {
        emittedTo.push(room);
        return { emit: jest.fn() };
      }),
    };

    const mod = require('../src/network/network.gateway');
    const NetworkGateway = mod.NetworkGateway;

    const gateway = new NetworkGateway();
    (gateway as any).server = mockServer;

    gateway.broadcastTopology('org-a', { nodes: [] });
    gateway.broadcastDiagnostics('org-a', { latency: 10 });

    expect(emittedTo).toEqual(['org:org-a', 'org:org-a']);
    expect(emittedTo.filter((r) => r === 'org:org-b')).toHaveLength(0);
  });

  it('RemoteSupportGateway emits only to session and verified org rooms', () => {
    const emittedTo: string[] = [];

    const mockServer = {
      to: jest.fn((room: string) => {
        emittedTo.push(room);
        return { emit: jest.fn() };
      }),
    };

    const mod = require('../src/remote-support/remote-support.gateway');
    const RemoteSupportGateway = mod.RemoteSupportGateway;

    const mockPrisma = {
      remoteSession: {
        findFirst: jest.fn(),
      },
    };

    const gateway = new RemoteSupportGateway(mockPrisma);
    (gateway as any).server = mockServer;

    gateway.broadcastSessionUpdate('org-a', { id: 'sess-1', status: 'active' });

    expect(emittedTo).toEqual(['org:org-a']);
    expect(emittedTo.filter((r) => r === 'org:org-b')).toHaveLength(0);
  });
});

describe('AlertsGateway Shared Server', () => {
  it('should broadcast through the provided server reference', () => {
    const mockServer = {
      to: jest.fn((room: string) => ({
        emit: jest.fn(),
      })),
    };

    const mod = require('../src/alerts/alerts.gateway');
    const AlertsGateway = mod.AlertsGateway;

    const gateway = new AlertsGateway();
    gateway.setServer(mockServer as any);

    gateway.broadcastAlert('org-1', { severity: 'warning' });

    expect(mockServer.to).toHaveBeenCalledWith('org:org-1');
  });

  it('should not broadcast if server is not set', () => {
    const mod = require('../src/alerts/alerts.gateway');
    const AlertsGateway = mod.AlertsGateway;

    const gateway = new AlertsGateway();

    // Should not throw
    expect(() => gateway.broadcastAlert('org-1', { data: 1 })).not.toThrow();
  });
});
