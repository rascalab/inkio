import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { InkioCollabModule } from './collab.module';

@Module({
  imports: [
    InkioCollabModule.forRoot({
      persistThrottleMs: 2000,
      onPersist: (docId, update) => {
        console.log(`[collab] persist doc=${docId} bytes=${update.length}`);
      },
    }),
  ],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = Number(process.env.PORT ?? 3123);
  await app.listen(port);
  console.log(`[collab] reference server listening on :${port}`);
}

void bootstrap();
