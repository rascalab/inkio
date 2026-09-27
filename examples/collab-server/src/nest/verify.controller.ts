import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import type { CollabAccess } from '../config';

export interface VerifyRequestBody {
  token?: unknown;
  docId?: unknown;
}

export interface VerifyResponseBody {
  access: CollabAccess;
}

function parseList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0),
  );
}

/**
 * Demo access check for the split hosting mode: the standalone sync process
 * POSTs `{ token, docId }` here and enforces the returned access. Production
 * rule belongs here (per-document ACL from your user service). Reads its
 * token lists from `EDITOR_TOKENS` / `VIEWER_TOKENS` (comma-separated).
 */
@Controller('collab')
export class VerifyController {
  private readonly editors = parseList(process.env.EDITOR_TOKENS ?? 'editor');
  private readonly viewers = parseList(process.env.VIEWER_TOKENS ?? 'viewer');

  constructor() {
    if (!process.env.EDITOR_TOKENS || !process.env.VIEWER_TOKENS) {
      console.warn(
        '[collab] DEVELOPMENT DEFAULTS ONLY: EDITOR_TOKENS/VIEWER_TOKENS are unset, ' +
          'so `editor` = write and `viewer` = read. Set real token lists before exposing this.',
      );
    }
  }

  @Get('health')
  health(): string {
    return 'ok';
  }

  @Post('verify')
  @HttpCode(200)
  verify(@Body() body: VerifyRequestBody): VerifyResponseBody {
    const token = typeof body?.token === 'string' ? body.token : '';
    const access: CollabAccess = this.editors.has(token)
      ? 'write'
      : this.viewers.has(token)
        ? 'read'
        : false;
    return { access };
  }
}
