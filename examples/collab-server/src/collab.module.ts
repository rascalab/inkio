import { DynamicModule, Module } from '@nestjs/common';
import type { Server } from 'socket.io';
import { CollabGateway } from './collab.gateway';
import { CollabSyncEngine, type CollabEngineOptions } from './engine';

export const COLLAB_ENGINE_OPTIONS = 'INKIO_COLLAB_ENGINE_OPTIONS';

@Module({})
export class InkioCollabModule {
  static forRoot(options: CollabEngineOptions = {}): DynamicModule {
    // Fail fast on nonsense instead of arming immediate-fire timers.
    if (
      options.persistThrottleMs !== undefined &&
      (!Number.isFinite(options.persistThrottleMs) || options.persistThrottleMs < 0)
    ) {
      throw new Error(
        `[collab] invalid persistThrottleMs: ${String(options.persistThrottleMs)}`,
      );
    }
    return {
      module: InkioCollabModule,
      providers: [
        { provide: COLLAB_ENGINE_OPTIONS, useValue: options },
        {
          provide: CollabSyncEngine,
          useFactory: (opts: CollabEngineOptions) => new CollabSyncEngine(opts),
          inject: [COLLAB_ENGINE_OPTIONS],
        },
        CollabGateway,
      ],
      exports: [CollabSyncEngine],
    };
  }

  static attachToExistingServer(server: Server, options: CollabEngineOptions = {}): CollabSyncEngine {
    const engine = new CollabSyncEngine(options);
    engine.attach(server);
    return engine;
  }
}
