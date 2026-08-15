import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import express, { RequestHandler } from 'express';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';

const SIGNUP_PASSWORD = 'Str0ngSecretPassw0rd!';

/**
 * Regression tests for the "stream is not readable" 500 on POST /auth/signup.
 *
 * Root cause: NestJS auto-registers its own JSON body parser during app.init()
 * (body-parser@1.x from @nestjs/platform-express's express@4), while main.ts
 * also registers express.json() explicitly (express@5 -> body-parser@2.x).
 * NestJS normally avoids double parsing by deduping on the middleware handle
 * name ("jsonParser"), but that dedupe is defeated when middleware handles are
 * wrapped: OpenTelemetry's express instrumentation renames wrapped handles to
 * "patched". Both parsers then run for the same request; the first consumes
 * the stream, and the second (body-parser@1.x, which lacks body-parser 2.x's
 * onFinished short-circuit) re-reads the already-consumed stream, so raw-body
 * throws "stream is not readable".
 *
 * These tests reproduce that condition and verify the fix (bodyParser: false)
 * keeps a single explicit body-parsing path.
 */

/**
 * Wraps a parser middleware with a differently-named handle, mirroring how
 * OpenTelemetry's express instrumentation wraps middleware (renaming the
 * handle from "jsonParser"/"urlencodedParser" to "patched"). This defeats
 * NestJS's isMiddlewareApplied() dedupe.
 */
function wrap(parser: RequestHandler): RequestHandler {
  const wrapped: RequestHandler = (req, res, next) => parser(req, res, next);
  return wrapped;
}

describe('Request body stream handling', () => {
  describe('failure mechanism (express@5 parser + NestJS body-parser@1 parser)', () => {
    it('the second JSON parser on an already-consumed stream throws "stream is not readable"', async () => {
      // NestJS's platform-express uses express@4 (body-parser@1.x); the
      // gateway's direct dependency is express@5 (body-parser@2.x). Reproduce
      // that exact parser mix on one stream.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('path');
      const platformExpressRoot = path.dirname(
        require.resolve('@nestjs/platform-express/package.json'),
      );
      const express4Path = require.resolve('express', {
        paths: [platformExpressRoot],
      });
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const express4 = require(express4Path);

      const expressApp = express();
      expressApp.use(express.json({ limit: '10mb' }));
      expressApp.use(express4.json({ limit: '10mb' }));
      expressApp.post('/test', (req, res) => res.json({ body: req.body }));

      const server = expressApp.listen(0);
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const port = (server.address() as { port: number }).port;

      const res = await request(`http://127.0.0.1:${port}`)
        .post('/test')
        .send({ email: 'mechanism@test.com', password: SIGNUP_PASSWORD });

      expect(res.status).toBe(500);
      expect(res.text).toContain('stream is not readable');

      await new Promise<void>((resolve) => server.close(() => resolve()));
    });
  });

  describe('pre-fix scenario (wrapped explicit parser + Nest auto parser)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(QueueService)
        .useClass(MockQueueService)
        .compile();

      prisma = moduleFixture.get<PrismaService>(PrismaService);

      // bodyParser defaults to true: NestJS will register its own
      // body-parser.json/urlencoded during init(), in addition to the
      // wrapped explicit parsers below (mirroring main.ts + OTEL).
      const appInstance = moduleFixture.createNestApplication();
      appInstance.use(wrap(express.json({ limit: '10mb' })));
      appInstance.use(wrap(express.urlencoded({ extended: true, limit: '10mb' })));
      app = appInstance;
      await app.init();
    });

    beforeEach(async () => {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);
    });

    afterAll(async () => {
      if (app) await app.close();
    });

    it('POST /auth/signup fails with 500 instead of parsing the JSON body', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'pre-fix@test.com',
          password: SIGNUP_PASSWORD,
          displayName: 'Pre Fix',
          orgName: 'Pre Fix Org',
        });

      expect(res.status).toBe(500);
      expect(`${res.text ?? ''}${JSON.stringify(res.body)}`).toContain(
        'stream is not readable',
      );
    });

    it('registers duplicate JSON body parsers', () => {
      const stack = (app.getHttpAdapter().getInstance() as express.Express)._router.stack;
      const parserLayers = stack.map((layer: any) => layer?.handle?.name)
        .filter((name: string | undefined) =>
          name === 'jsonParser' || name === 'urlencodedParser' || name === 'wrapped');
      expect(parserLayers).toEqual(
        expect.arrayContaining(['wrapped', 'jsonParser']),
      );
    });
  });

  describe('fixed scenario (bodyParser: false + explicit parsers only)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(QueueService)
        .useClass(MockQueueService)
        .compile();

      prisma = moduleFixture.get<PrismaService>(PrismaService);

      // Fix: disable NestJS's automatic body parser so main.ts's explicit
      // express.json()/express.urlencoded() remain the single parsing path.
      const appInstance = moduleFixture.createNestApplication({ bodyParser: false });
      appInstance.use(wrap(express.json({ limit: '10mb' })));
      appInstance.use(wrap(express.urlencoded({ extended: true, limit: '10mb' })));
      app = appInstance;
      await app.init();
    });

    beforeEach(async () => {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);
    });

    afterAll(async () => {
      if (app) await app.close();
    });

    it('POST /auth/signup with a normal JSON body reaches the service layer', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'fixed-scenario@test.com',
          password: SIGNUP_PASSWORD,
          displayName: 'Fixed Scenario',
          orgName: 'Fixed Scenario Org',
        });

      // 201 proves the request body was parsed and the signup handler/service
      // ran — no "stream is not readable".
      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('fixed-scenario@test.com');
      expect(res.body.user.role).toBe('Owner');
      expect(res.body.accessToken).toBeDefined();
    });

    it('registers only the explicit wrapped parsers (no duplicate Nest parser)', () => {
      const stack = (app.getHttpAdapter().getInstance() as express.Express)._router.stack;
      const parserLayers = stack.map((layer: any) => layer?.handle?.name)
        .filter((name: string | undefined) =>
          name === 'jsonParser' || name === 'urlencodedParser' || name === 'wrapped');
      expect(parserLayers).toEqual(['wrapped', 'wrapped']);
    });

    it('never logs the plaintext signup password', async () => {
      const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      let captured = '';
      try {
        const res = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            email: 'no-log-password@test.com',
            password: SIGNUP_PASSWORD,
            displayName: 'No Log Password',
            orgName: 'No Log Org',
          });
        expect(res.status).toBe(201);
        captured = [
          ...stdout.mock.calls.map((call) => String(call[0])),
          ...stderr.mock.calls.map((call) => String(call[0])),
        ].join('\n');
      } finally {
        stdout.mockRestore();
        stderr.mockRestore();
      }

      expect(captured).not.toContain(SIGNUP_PASSWORD);
      expect(captured).not.toContain('authorization');
    });
  });
});
