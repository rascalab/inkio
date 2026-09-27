import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { InkioCollabModule } from './nest/collab.module';

// DEVELOPMENT DEFAULTS ONLY: no `verify` is wired, so anyone can read and
// write any document. Pass a `verify` token check before exposing this.
@Module({
  imports: [InkioCollabModule.forRoot({ dataDir: process.env.DATA_DIR ?? './data' })],
})
class AppModule {}

async function bootstrap() {
  const portRaw = process.env.PORT ?? '3123';
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0 || port >= 65536) {
    throw new Error(`[collab] invalid PORT: ${JSON.stringify(portRaw)}`);
  }
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(port);
  console.log(`[collab] NestJS + Hocuspocus on ws://localhost:${port}/collab`);
}

void bootstrap();
