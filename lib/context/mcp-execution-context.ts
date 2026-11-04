import type { ArgumentsHost, ExecutionContext, Type } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import type { AuthInfo } from '@modelcontextprotocol/server';
import type { McpCallKind, McpContext } from '../interfaces/mcp-context.interface.js';

/** `context.getType<McpContextType>() === 'mcp'` in an enhancer tells an MCP call from an HTTP request. */
export type McpContextType = 'mcp';

/**
 * The execution context of an MCP call, for guards, interceptors and exception filters, as `GqlExecutionContext` is
 * for GraphQL resolvers:
 *
 * ```ts
 * canActivate(context: ExecutionContext) {
 *   const mcp = McpExecutionContext.create(context);
 *   return mcp.getAuthInfo()?.scopes.includes('notes:write') ?? false;
 * }
 * ```
 *
 * The arguments of an MCP call are `[input, context]`: `getInput()` (also `switchToRpc().getData()`) and
 * `getContext()`.
 */
export class McpExecutionContext extends ExecutionContextHost {
  static create(context: ExecutionContext | ArgumentsHost): McpExecutionContext {
    const host = context as Partial<ExecutionContext> & ArgumentsHost;
    const mcp = new McpExecutionContext(
      context.getArgs(),
      host.getClass?.() as Type<unknown> | undefined,
      host.getHandler?.() as Function | undefined,
    );
    mcp.setType(context.getType());
    return mcp;
  }

  /** The validated arguments (tools, prompts) or the URI template variables (resource templates). */
  getInput<T = any>(): T {
    return this.getArgByIndex(0);
  }

  getContext<TRequest = any>(): McpContext<TRequest> {
    return this.getArgByIndex(1);
  }

  getKind(): McpCallKind | undefined {
    return this.getContext()?.kind;
  }

  /** The tool or prompt name, or the resource's name. */
  getName(): string | undefined {
    return this.getContext()?.name;
  }

  /** The HTTP platform's request (Express, Fastify, Node adapter; a plain object in memory); `undefined` over stdio. */
  getRequest<TRequest = any>(): TRequest | undefined {
    return this.getContext<TRequest>()?.request;
  }

  /** The verified access token, with the module's `auth` option. */
  getAuthInfo(): AuthInfo | undefined {
    return this.getContext()?.authInfo;
  }

  getSessionId(): string | undefined {
    return this.getContext()?.sessionId;
  }
}
