import type { AuthInfo, ServerContext } from '@modelcontextprotocol/server';

/** What a call is for. A read through a resource template is a `resource` call. */
export type McpCallKind = 'tool' | 'resource' | 'prompt';

/**
 * The protocol era of the request: `modern` for revision 2026-07-28 (no `initialize`, a `_meta` envelope on every
 * request), `legacy` for 2024-10-07 through 2025-11-25.
 */
export type McpProtocolEra = 'legacy' | 'modern';

/**
 * The second argument of every MCP method, and `McpExecutionContext.getContext()` in guards, interceptors and
 * filters.
 */
export interface McpContext<TRequest = any> {
  readonly kind: McpCallKind;
  /** The tool or prompt name, or the resource's name. */
  readonly name: string;
  /** The URI being read, for resources. */
  readonly uri?: URL;
  /** `http` for Streamable HTTP (and the in-memory test client), `stdio` for stdio. */
  readonly transport: 'http' | 'stdio';
  readonly era: McpProtocolEra;
  /**
   * The verified access token, when the module's `auth` option is configured (HTTP only). `clientId`, `scopes`,
   * `expiresAt` and `extra` are what the token verifier returned.
   */
  readonly authInfo?: AuthInfo;
  /**
   * The HTTP platform's request object (Express, Fastify or the Node adapter's), as route handlers get it: headers,
   * `request.user` set by middleware, and so on. For the in-memory test client, a plain `{ method, url, headers }`
   * object; `undefined` over stdio.
   */
  readonly request?: TRequest;
  /** The web-standard `Request` the SDK served, over HTTP (and in-memory). */
  readonly requestInfo?: Request;
  /** The 2025-era session id; always `undefined` in this version, which serves every request statelessly. */
  readonly sessionId?: string;
  /** Aborted when the client cancels the request or goes away. Pass it on to your own I/O. */
  readonly signal: AbortSignal;
  /**
   * The SDK's own request context, for what has no shortcut here: `mcpReq.envelope` (the client's declared
   * capabilities and info, 2026-07-28), `mcpReq.inputResponses` (answers to an `inputRequired()` result),
   * `mcpReq.notify()`, `mcpReq._meta`.
   */
  readonly server: ServerContext;
  /**
   * Sends a progress notification for this request, if the client asked for progress (its request carries a
   * `progressToken`); does nothing otherwise. `progress` must grow from one call to the next.
   */
  reportProgress(progress: number, total?: number, message?: string): Promise<void>;
}
