// The player's account over the WebSocket (openspec: player-account): his profile, his rooms, another device's code
// (« Reprendre un compte »), a new code (the other devices, on the old one, are disconnected).
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { IntentRunner } from '../realtime/intent-runner.js';
import { RoomRegistry } from '../rooms/room-registry.js';
import type { SocketData } from '../rooms/room-rt.js';
import { AccountsService } from './accounts.service.js';

@WebSocketGateway()
export class AccountsGateway {
  constructor(private readonly intents: IntentRunner, private readonly accounts: AccountsService, private readonly rooms: RoomRegistry) {}

  @SubscribeMessage('profile:update')
  profile(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('profile:update', b, async v => {
      const a = await this.accounts.updateProfile(this.intents.me(s).id, v);
      (s.data as SocketData).account = a;
      await this.rooms.profileChanged(a.id);
      return this.accounts.view(a);
    });
  }

  @SubscribeMessage('rooms:save')
  saveRooms(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('rooms:save', b, async v => { await this.accounts.saveRooms(this.intents.me(s).id, v.rooms); return null; });
  }

  @SubscribeMessage('account:find')
  find(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('account:find', b, v => this.accounts.find(v.code, (s.data as SocketData).ip, v.resume));
  }

  @SubscribeMessage('account:renew')
  renew(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('account:renew', b, async v => {
      await this.accounts.renew(this.intents.me(s).id, v.code);
      this.rooms.kickAccount(this.intents.me(s).id, s.id);   // the other devices used the old code
      return null;
    });
  }
}
