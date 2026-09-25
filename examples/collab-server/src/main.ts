import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { InkioCollabModule } from './collab.module';

@Module({
  imports: [
    InkioCollabModule.forRoot({
      persistThrottleMs: 2000,
      // Demo only: logs instead of persisting, so ALL DATA IS LOST on
      // restart. Wire a real store in onPersist for anything beyond smoke.
      onPersist: (docId, update) => {
        console.log(`[collab] persist doc=${docId} bytes=${update.length} (NOT persisted: demo hook)`);
      },
    }),
  ],
})
class AppModule {}

// DEVELOPMENT DEFAULTS ONLY: no `verify` is wired (anyone can read/write
// any doc) and CORS is wide open. Do not expose this example to the
// internet: pass a `verify` token check to forRoot and restrict CORS.
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const portRaw = process.env.PORT ?? '3123';
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0 || port >= 65536) {
    throw new Error(`[collab] invalid PORT: ${JSON.stringify(portRaw)}`);
  }
  await app.listen(port);
  console.log(`[collab] reference server listening on :${port}`);
}

void bootstrap();
