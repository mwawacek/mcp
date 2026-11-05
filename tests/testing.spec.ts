/**
 * `@nestjs/mcp/testing`: an SDK client connected in memory, through the same handler as the HTTP endpoint, with and
 * without an HTTP application around the module.
 */
import { Module, type INestApplication } from '@nestjs/common';
import { SdkHttpError } from '@modelcontextprotocol/client';
import { Test, type TestingModule } from '@nestjs/testing';
import { McpModule } from '../lib/index.js';
import { connectMcpClient } from '../lib/testing/index.js';
import { AuthAppModule } from './fixtures/auth/auth.module.js';
import { NotesAppModule } from './fixtures/notes/notes.module.js';
import { text } from './support/clients.js';

describe('connectMcpClient()', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [NotesAppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each(['modern', 'legacy'] as const)('connects a %s client in memory', async (era) => {
    const client = await connectMcpClient(app, { era, headers: { 'x-client': 'in-memory' } });
    try {
      expect(client.getProtocolEra()).toBe(era);
      expect(text(await client.callTool({ name: 'add', arguments: { text: 'Test it' } }))).toMatch(/^Saved note-\d+$/);
      const whoami = JSON.parse(text(await client.callTool({ name: 'whoami', arguments: {} }))!);
      expect(whoami).toMatchObject({ era, transport: 'http', hasRequest: true, hasRequestInfo: true, client: 'in-memory', requestHeader: 'in-memory' });
    } finally {
      await client.close();
    }
  });

  it('needs no HTTP server: a testing module is enough', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [NotesAppModule] }).compile();
    const client = await connectMcpClient(moduleRef);
    try {
      expect((await client.listPrompts()).prompts.map((prompt) => prompt.name)).toEqual(['summarize']);
    } finally {
      await client.close();
      await moduleRef.close();
    }
  });

  it('sends the token through the OAuth gate', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AuthAppModule] }).compile();
    try {
      const client = await connectMcpClient(moduleRef, { token: 'writer' });
      expect(JSON.parse(text(await client.callTool({ name: 'whoami', arguments: {} }))!)).toEqual({
        clientId: 'bob',
        scopes: ['notes:read', 'notes:write'],
      });
      await client.close();

      await expect(connectMcpClient(moduleRef)).rejects.toBeInstanceOf(SdkHttpError);
    } finally {
      await moduleRef.close();
    }
  });

  describe('with http.allowedHosts', () => {
    const compileWith = (allowedHosts: string[]) => {
      @Module({ imports: [McpModule.forRoot({ name: 'hosts', version: '1.0.0', http: { allowedHosts } })] })
      class HostsModule {}
      return Test.createTestingModule({ imports: [HostsModule] }).compile();
    };

    it('connects when they name the host of the in-memory endpoint', async () => {
      const moduleRef = await compileWith(['localhost']);
      try {
        const client = await connectMcpClient(moduleRef);
        await client.close();
      } finally {
        await moduleRef.close();
      }
    });

    it('is refused when they do not', async () => {
      const moduleRef = await compileWith(['example.com']);
      try {
        await expect(connectMcpClient(moduleRef)).rejects.toBeInstanceOf(SdkHttpError);
      } finally {
        await moduleRef.close();
      }
    });

    it('sends the Host header given in `headers` instead', async () => {
      const moduleRef = await compileWith(['example.com']);
      try {
        const client = await connectMcpClient(moduleRef, { headers: { host: 'example.com' } });
        await client.close();
      } finally {
        await moduleRef.close();
      }
    });
  });
});
