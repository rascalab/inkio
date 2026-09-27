import {
  Inject,
  Injectable,
  Module,
  type BeforeApplicationShutdown,
  type DynamicModule,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Hocuspocus } from '@hocuspocus/server';
import { createCollabConfiguration, type InkioCollabOptions } from '../config';
import { attachHocuspocus, shutdownHocuspocus } from '../embed';

export const INKIO_HOCUSPOCUS = Symbol('INKIO_HOCUSPOCUS');
const MODULE_OPTIONS = Symbol('INKIO_COLLAB_OPTIONS');

export interface InkioCollabModuleOptions extends InkioCollabOptions {
  /** WebSocket path on the Nest HTTP server. Default `/collab`. */
  path?: string;
}

@Injectable()
class HocuspocusBridge implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private detach?: () => void;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(INKIO_HOCUSPOCUS) private readonly hocuspocus: Hocuspocus,
    @Inject(MODULE_OPTIONS) private readonly options: InkioCollabModuleOptions,
  ) {}

  onApplicationBootstrap(): void {
    const httpServer = this.adapterHost.httpAdapter.getHttpServer();
    this.detach = attachHocuspocus(httpServer, this.hocuspocus, { path: this.options.path });
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.detach?.();
    await shutdownHocuspocus(this.hocuspocus);
  }
}

/**
 * Embeds Hocuspocus in a NestJS app: same HTTP server and port, WebSocket
 * on `path`. Inject `INKIO_HOCUSPOCUS` to reach documents from services
 * (e.g. `openDirectConnection` for server-side edits). Call
 * `app.enableShutdownHooks()` so pending stores flush on SIGTERM.
 */
@Module({})
export class InkioCollabModule {
  static forRoot(options: InkioCollabModuleOptions): DynamicModule {
    return {
      module: InkioCollabModule,
      providers: [
        { provide: MODULE_OPTIONS, useValue: options },
        {
          provide: INKIO_HOCUSPOCUS,
          useFactory: () => new Hocuspocus(createCollabConfiguration(options)),
        },
        HocuspocusBridge,
      ],
      exports: [INKIO_HOCUSPOCUS],
    };
  }
}
