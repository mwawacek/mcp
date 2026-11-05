/**
 * `@nestjs/mcp/testing`: an MCP client connected to the application in memory.
 *
 * ```ts
 * const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
 * const app = await moduleRef.createNestApplication().init();
 * const client = await connectMcpClient(app);
 *
 * const result = await client.callTool({ name: 'add', arguments: { text: 'Buy milk' } });
 * await client.close();
 * ```
 */
import type { INestApplicationContext } from '@nestjs/common';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { McpHttpService } from '../http/mcp-http.service.js';

export interface ConnectMcpClientOptions {
  /**
   * The protocol era to connect with: `'modern'` (default) is revision 2026-07-28, `'legacy'` the 2025 `initialize`
   * handshake (the newest 2025 revision).
   */
  era?: 'modern' | 'legacy';
  /** An access token, sent as `Authorization: Bearer <token>` (with the module's `auth` option). */
  token?: string;
  /** Headers sent with every request. */
  headers?: Record<string, string>;
  /** The client's `clientInfo`. Default `{ name: 'nestjs-mcp-testing', version: '0.0.0' }`. */
  clientInfo?: { name: string; version: string };
}

/**
 * Connects an SDK `Client` to the application's MCP server through the same handler its HTTP endpoint uses (Host and
 * Origin checks, the OAuth gate, every primitive with its guards, interceptors, pipes and filters), with no socket.
 * HTTP-level middleware and guards of the endpoint's route do not run, and `McpContext.request` is a plain
 * `{ method, url, headers }` object (lowercase header names), as guards read a Node request. Close the client when
 * done.
 */
export async function connectMcpClient(
  app: INestApplicationContext,
  { era = 'modern', token, headers = {}, clientInfo = { name: 'nestjs-mcp-testing', version: '0.0.0' } }: ConnectMcpClientOptions = {},
): Promise<Client> {
  await app.init();
  const http = app.get(McpHttpService, { strict: false });

  const transport = new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), {
    fetch: (input, init) => {
      const request = new Request(input, init);
      // A socket would send it, and `http.allowedHosts` needs it.
      if (!request.headers.has('host')) {
        request.headers.set('host', new URL(request.url).host);
      }
      // No HTTP platform here: what guards and auth packages read from `McpContext.request`, Node-style.
      const { pathname, search } = new URL(request.url);
      const platformRequest = { method: request.method, url: pathname + search, headers: Object.fromEntries(request.headers) };
      return http.fetch(request, { platformRequest });
    },
    requestInit: { headers: { ...headers, ...(token && { authorization: `Bearer ${token}` }) } },
  });
  const client = new Client(clientInfo, {
    ...(era === 'modern' && { versionNegotiation: { mode: { pin: '2026-07-28' } } }),
  });
  await client.connect(transport);
  return client;
}
