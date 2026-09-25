import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import { INKIO_COLLAB_NAMESPACE } from '@inkio/collab/protocol';
import { CollabSyncEngine } from './engine';

// The namespace lives on the decorator so the gateway and the engine share
// one room root. DEV ONLY: cors '*' plus no verify — see main.ts.
@WebSocketGateway({ namespace: INKIO_COLLAB_NAMESPACE, cors: { origin: '*' } })
export class CollabGateway implements OnGatewayInit {
  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly engine: CollabSyncEngine) {}

  afterInit(): void {
    this.engine.attach(this.server);
  }
}
