import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { InkioCollabModule } from './nest/collab.module';
import { createLocalVerify, listenOptions, originsFromEnv, requiredEnv } from './env';

async function bootstrap() {
  const { port, host } = listenOptions(3123);
  @Module({
    imports: [InkioCollabModule.forRoot({
      dataDir: requiredEnv('DATA_DIR'),
      verify: createLocalVerify(),
      allowedOrigins: originsFromEnv(),
    })],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  await app.listen(port, host);
  const url = (await app.getUrl()).replace(/^http/, 'ws');
  console.log(`[collab] NestJS + Hocuspocus listening on ${url}/collab`);
}

void bootstrap().catch((error) => {
  console.error(error instanceof Error ? error.message : '[collab] startup failed');
  process.exitCode = 1;
});
