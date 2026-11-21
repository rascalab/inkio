import 'reflect-metadata';
import { createLocalVerify, listenOptions, requiredEnv } from './env';
import { createVerifyApplication } from './nest/verify.controller';

async function bootstrap() {
  const { port, host } = listenOptions(3100);
  const app = await createVerifyApplication(createLocalVerify(), requiredEnv('COLLAB_VERIFY_KEY'));
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  await app.listen(port, host);
  console.log(`[collab] private verifier listening on ${await app.getUrl()}`);
}

void bootstrap().catch((error) => {
  console.error(error instanceof Error ? error.message : '[collab] verifier startup failed');
  process.exitCode = 1;
});
