import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as z from 'zod';
import { Prompt, Resource, ResourceTemplate, Tool, type McpContext } from '../../../lib/index.js';
import { NotesService } from './notes.service.js';

@Injectable()
export class NotesTools {
  constructor(private readonly notes: NotesService) {}

  @Tool({
    description: 'Save a note',
    inputSchema: z.object({ text: z.string().min(1).describe('What to remember') }),
    annotations: { idempotentHint: false },
  })
  add({ text }: { text: string }) {
    return `Saved ${this.notes.add(text)}`;
  }

  @Tool({ name: 'count-notes', description: 'Count the notes', outputSchema: z.object({ count: z.number() }) })
  count() {
    return { count: this.notes.size };
  }

  @Tool({ description: 'Fails on purpose', inputSchema: z.object({ kind: z.enum(['http', 'unknown']) }) })
  fail({ kind }: { kind: 'http' | 'unknown' }) {
    if (kind === 'http') {
      throw new BadRequestException('The note is too long');
    }
    throw new Error('connection refused: postgres://admin:hunter2@db');
  }

  @Tool({ description: 'Takes a while and reports progress' })
  async slow(_input: unknown, ctx: McpContext) {
    await ctx.reportProgress(1, 2, 'Half way');
    await ctx.reportProgress(2, 2);
    return 'done';
  }

  @Tool({ description: 'Describes the call' })
  whoami(input: unknown, ctx: McpContext) {
    return {
      input,
      kind: ctx.kind,
      name: ctx.name,
      era: ctx.era,
      transport: ctx.transport,
      hasRequest: ctx.request !== undefined,
      hasRequestInfo: ctx.requestInfo instanceof Request,
      client: ctx.requestInfo?.headers.get('x-client') ?? null,
      // What a guard reads from a Node-style request.
      requestHeader: (ctx.request as { headers?: Record<string, string> } | undefined)?.headers?.['x-client'] ?? null,
    };
  }

  @Resource({ uri: 'notes://index', description: 'Every note', mimeType: 'application/json' })
  index() {
    return this.notes.list();
  }

  @ResourceTemplate({ uriTemplate: 'notes://{id}', description: 'One note', mimeType: 'text/plain' })
  note({ id }: { id: string }, ctx: McpContext) {
    const note = this.notes.get(id);
    if (!note) {
      throw new NotFoundException(`No note ${id} at ${ctx.uri?.href}`);
    }
    return note;
  }

  @Prompt({
    description: 'Summarize the notes',
    argsSchema: z.object({ style: z.enum(['short', 'long']).describe('How long the summary is') }),
  })
  summarize({ style }: { style: 'short' | 'long' }) {
    return `Summarize my notes, ${style}.`;
  }
}
