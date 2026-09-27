import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { VerifyController } from './nest/verify.controller';

// Split hosting mode, API half: serves access checks (and your app routes)
// but no WebSocket traffic. Pair with sync-main.ts (or the compose file).
@Module({ controllers: [VerifyController] })
class ApiModule {}

async function bootstrap() {
  const portRaw = process.env.PORT ?? '3100';
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0 || port >= 65536) {
    throw new Error(`[collab] invalid PORT: ${JSON.stringify(portRaw)}`);
  }
  const app = await NestFactory.create(ApiModule);
  app.enableShutdownHooks();
  await app.listen(port);
  console.log(`[collab] verify API on http://localhost:${port}/collab/verify`);
}

void bootstrap();
