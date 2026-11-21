import { timingSafeEqual } from 'node:crypto';
import { Body, Controller, Get, Headers, HttpCode, Inject, Module, Post, UnauthorizedException, UnsupportedMediaTypeException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { CollabAccess, CollabVerifyFn } from '../config';
import { isRoomId, isServiceKey, isToken, MAX_VERIFY_REQUEST_BYTES } from '../limits';

export interface VerifyRequestBody {
  token?: unknown;
  docId?: unknown;
}

export interface VerifyResponseBody {
  access: CollabAccess;
}

const VERIFY = Symbol('COLLAB_VERIFY');
const SERVICE_KEY = Symbol('COLLAB_VERIFY_SERVICE_KEY');
@Controller('collab')
class VerifyController {
  constructor(
    @Inject(VERIFY) private readonly lookupAccess: CollabVerifyFn,
    @Inject(SERVICE_KEY) private readonly key: Buffer,
  ) {}

  @Get('health')
  health(): string {
    return 'ok';
  }

  @Post('verify')
  @HttpCode(200)
  async verify(
    @Headers('authorization') authorization: string | undefined,
    @Headers('content-type') contentType: string | undefined,
    @Body() body: VerifyRequestBody | undefined,
  ): Promise<VerifyResponseBody> {
    const candidate = authorization?.startsWith('Bearer ') && authorization.slice(7);
    if (!isServiceKey(candidate) || candidate.length !== this.key.length ||
      !timingSafeEqual(Buffer.from(candidate), this.key)) throw new UnauthorizedException();
    if (contentType?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      throw new UnsupportedMediaTypeException();
    }
    if (!body || !isToken(body.token) || !isRoomId(body.docId)) return { access: false };
    const access = await this.lookupAccess(body.token, body.docId);
    return { access: access === 'write' || access === 'read' ? access : false };
  }
}

/** Private service for the split reference; never publish its port. */
export async function createVerifyApplication(verify: CollabVerifyFn, serviceKey: string): Promise<NestExpressApplication> {
  if (typeof verify !== 'function' || !isServiceKey(serviceKey)) {
    throw new Error('[collab] a scoped verifier and 32–128 URL-safe character service key are required');
  }
  @Module({
    controllers: [VerifyController],
    providers: [
      { provide: VERIFY, useValue: verify },
      { provide: SERVICE_KEY, useValue: Buffer.from(serviceKey) },
    ],
  })
  class VerifyModule {}

  const app = await NestFactory.create<NestExpressApplication>(VerifyModule, { bodyParser: false, logger: false });
  app.useBodyParser('json', { limit: MAX_VERIFY_REQUEST_BYTES, inflate: false });
  app.getHttpServer().requestTimeout = 5000;
  return app;
}
