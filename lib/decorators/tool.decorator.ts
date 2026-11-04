import type { ToolOptions } from '../interfaces/primitive-options.interface.js';
import { definePrimitive } from './define-primitive.util.js';

/**
 * Exposes the method as an MCP tool. It is called as `(input, context)`: `input` is the arguments, validated against
 * `inputSchema`, and `context` the `McpContext`. Guards, interceptors, pipes and exception filters run around it.
 *
 * It may return a `CallToolResult`, the SDK's `inputRequired()` result, a string (a text result), or any other value:
 * with an `outputSchema` it becomes the `structuredContent` (and a JSON text block), without one a JSON text block.
 * With an `outputSchema`, a returned `CallToolResult` needs `structuredContent` or `isError: true`; a value without
 * either is the tool's data, even when it has a `content` array.
 *
 * ```ts
 * @Tool({ description: 'Save a note', inputSchema: z.object({ text: z.string() }) })
 * add({ text }: { text: string }, ctx: McpContext) {
 *   return this.notes.add(text);
 * }
 * ```
 */
export function Tool(options: ToolOptions = {}): MethodDecorator {
  return definePrimitive({ kind: 'tool', options: { ...options } });
}
