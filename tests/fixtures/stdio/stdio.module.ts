import {
  Injectable,
  Logger,
  Module,
  UseGuards,
  UseInterceptors,
  type CallHandler,
  type CanActivate,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { acceptedContent, inputRequired } from '@modelcontextprotocol/server';
import { map, type Observable } from 'rxjs';
import * as z from 'zod';
import { McpExecutionContext, McpModule, Prompt, Resource, Tool, type McpContext } from '../../../lib/index.js';

/** Over stdio the credentials come from the environment, as the spec has it: `MCP_ROLE`. */
@Injectable()
export class EnvironmentRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const mcp = McpExecutionContext.create(context);
    return mcp.getName() !== 'purge' || process.env.MCP_ROLE === 'admin';
  }
}

@Injectable()
export class SignatureInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value) => (typeof value === 'string' ? `${value} (via stdio)` : value)));
  }
}

@Injectable()
@UseGuards(EnvironmentRoleGuard)
@UseInterceptors(SignatureInterceptor)
export class LocalTools {
  private readonly logger = new Logger(LocalTools.name);

  @Tool({ description: 'Adds two numbers', inputSchema: z.object({ a: z.number(), b: z.number() }) })
  add({ a, b }: { a: number; b: number }) {
    // Nest's logger, which McpStdioLogger keeps off stdout.
    this.logger.log(`adding ${a} and ${b}`);
    return String(a + b);
  }

  @Tool({ description: 'Admins only' })
  purge() {
    return 'purged';
  }

  @Tool({ description: 'Describes the call' })
  whoami(_input: unknown, ctx: McpContext) {
    return { transport: ctx.transport, era: ctx.era, hasRequest: ctx.request !== undefined, authInfo: ctx.authInfo ?? null };
  }

  @Tool({ description: 'Asks for confirmation first', inputSchema: z.object({ path: z.string() }) })
  remove({ path }: { path: string }, ctx: McpContext) {
    const Confirmation = z.object({ confirm: z.boolean() });
    const answer = acceptedContent(ctx.server.mcpReq.inputResponses, 'confirm', Confirmation);
    if (answer === undefined) {
      return inputRequired({
        inputRequests: { confirm: inputRequired.elicit({ message: `Delete ${path}?`, requestedSchema: Confirmation }) },
      });
    }
    return answer.confirm ? `deleted ${path}` : `kept ${path}`;
  }

  @Resource({ uri: 'local://pid' })
  pid() {
    return String(process.pid);
  }

  @Prompt({ description: 'Greets', argsSchema: z.object({ name: z.string() }) })
  greet({ name }: { name: string }) {
    return `Say hello to ${name}.`;
  }
}

@Module({
  imports: [McpModule.forRoot({ name: 'local', version: '1.0.0', path: false })],
  providers: [LocalTools],
})
export class StdioAppModule {}
