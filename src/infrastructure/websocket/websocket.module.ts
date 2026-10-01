import { Global, Module } from '@nestjs/common';
import { EventsBusService } from './events-bus.service';
import { EventsGateway } from './events.gateway';

/**
 * Event bus real-time (DESIGN.md §7). Global agar `EventsBusService` bisa
 * disuntikkan ke modul manapun tanpa impor manual. `RedisModule` & `JwtModule`
 * juga global, jadi tidak perlu diimpor ulang di sini.
 */
@Global()
@Module({
  providers: [EventsBusService, EventsGateway],
  exports: [EventsBusService],
})
export class WebsocketModule {}
