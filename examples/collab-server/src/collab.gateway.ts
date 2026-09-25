import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import { CollabSyncEngine } from './engine';

@WebSocketGateway({ cors: { origin: '*' } })
export class CollabGateway implements OnGatewayInit {
  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly engine: CollabSyncEngine) {}

  afterInit(): void {
    this.engine.attach(this.server);
  }
}
