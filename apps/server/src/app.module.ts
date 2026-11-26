// The server (openspec: plan-slopesque-v1, refactor-architecture): the core shared with the admin console, the rooms'
// hub (which brings the chat and the activities, each a module with its own gateway), the connection's gateway.
import { Module } from '@nestjs/common';
import { CoreModule } from './core.module.js';
import { AccountsController } from './accounts/accounts.controller.js';
import { AccountsGateway } from './accounts/accounts.gateway.js';
import { HealthController } from './health/health.controller.js';
import { HomeController } from './health/home.controller.js';
import { MediaController } from './media/media.controller.js';
import { ConnectionGateway } from './realtime/connection.gateway.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { HubModule } from './rooms/hub.module.js';

export { CoreModule };

@Module({
  imports: [CoreModule, RealtimeModule, HubModule],
  providers: [ConnectionGateway, AccountsGateway],
  controllers: [HomeController, HealthController, AccountsController, MediaController],
})
export class AppModule {}
