import { Module } from '@nestjs/common';
import { CoreModule } from './core.module.js';
import { HealthController } from './health/health.controller.js';
import { RoomHub } from './rooms/room-hub.service.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { ActivitiesModule } from './activities/activities.module.js';
import { ConnectionGateway } from './realtime/connection.gateway.js';
import { Gateway } from './realtime/gateway.js';
import { AccountsController } from './accounts/accounts.controller.js';
import { MediaController } from './media/media.controller.js';
import { HomeController } from './health/home.controller.js';
import { GifService } from './external/gif.service.js';
import { PreviewService } from './external/preview.service.js';

export { CoreModule };

@Module({
  imports: [CoreModule, RoomsModule, RealtimeModule, ActivitiesModule],
  providers: [RoomHub, ConnectionGateway, Gateway, GifService, PreviewService],
  controllers: [HomeController, HealthController, AccountsController, MediaController],
})
export class AppModule {}
