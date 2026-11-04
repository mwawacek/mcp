/**
 * Asking the user mid-call: a tool returns the SDK's `inputRequired()` result, the client answers the elicitation,
 * and the tool runs again with the answer. The same method serves both eras (the SDK fulfils it server-side for 2025
 * clients), through the module's enhancers.
 */
import { Injectable, Module, type INestApplication } from '@nestjs/common';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { acceptedContent, inputRequired } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { McpModule, Tool, type McpContext } from '../lib/index.js';
import { createApp, urlOf } from './support/adapters.js';
import { eras, text } from './support/clients.js';

const Confirmation = z.object({ confirm: z.boolean() });

@Injectable()
class CancellationTools {
  calls = 0;

  @Tool({ name: 'cancel-order', description: 'Cancel an order, once the user confirms', inputSchema: z.object({ orderId: z.string() }) })
  cancel({ orderId }: { orderId: string }, ctx: McpContext) {
    this.calls++;
    const answer = acceptedContent(ctx.server.mcpReq.inputResponses, 'confirm', Confirmation);
    if (answer === undefined) {
      return inputRequired({
        inputRequests: {
          confirm: inputRequired.elicit({ message: `Cancel order ${orderId}?`, requestedSchema: Confirmation }),
        },
      });
    }
    return answer.confirm ? `Order ${orderId} cancelled` : `Order ${orderId} kept`;
  }
}

@Module({ imports: [McpModule.forRoot({ name: 'store', version: '1.0.0' })], providers: [CancellationTools] })
class StoreModule {}

describe.each(eras)('input required, %s client', (era) => {
  let app: INestApplication;
  let client: Client;
  const asked: string[] = [];

  beforeAll(async () => {
    app = await createApp('express', StoreModule);
    client = new Client(
      { name: 'e2e', version: '1.0.0' },
      {
        capabilities: { elicitation: { form: {} } },
        ...(era === 'modern' && { versionNegotiation: { mode: { pin: '2026-07-28' } } }),
      },
    );
    client.setRequestHandler('elicitation/create', async (request) => {
      asked.push(request.params.message);
      return { action: 'accept', content: { confirm: true } };
    });
    await client.connect(new StreamableHTTPClientTransport(await urlOf(app)));
  });

  afterAll(async () => {
    await client?.close();
    await app?.close();
  });

  if (era === 'modern') {
    it('asks the user, then runs the tool again with the answer', async () => {
      const result = await client.callTool({ name: 'cancel-order', arguments: { orderId: 'ord_1' } });
      expect(text(result)).toBe('Order ord_1 cancelled');
      expect(asked).toEqual(['Cancel order ord_1?']);
      expect(app.get(CancellationTools).calls).toBe(2);
    });
  } else {
    // A 2025 client is asked through a server-to-client request, which needs a session: stateless HTTP serving has
    // none (stdio does, see stdio.e2e.spec.ts). The tool's call fails as a tool error instead.
    it('answers with a tool error, since stateless serving cannot ask a 2025 client', async () => {
      const result = await client.callTool({ name: 'cancel-order', arguments: { orderId: 'ord_1' } });
      expect(result.isError).toBe(true);
      expect(text(result)).toContain('per-request legacy serving cannot receive server-to-client requests');
      expect(asked).toEqual([]);
    });
  }
});
