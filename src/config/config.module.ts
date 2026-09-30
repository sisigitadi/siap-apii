import { Global, Module } from '@nestjs/common';
import { appConfigToken, loadAppConfig, type AppConfig } from './app.config';

/**
 * Konfigurasi terpusat & tervalidasi. Modul ini global agar tidak perlu
 * diimpat ulang di setiap modul (lihat DESIGN.md §2.1).
 *
 * `useFactory` (bukan `useValue`) sengaja: loadAppConfig() membaca process.env,
 * yang baru terisi setelah ConfigModule.forRoot() dari @nestjs/config dievaluasi
 * saat decorator @Module AppModule berjalan — yaitu sebelum provider di-instantiate.
 */
@Global()
@Module({
  providers: [{ provide: appConfigToken, useFactory: (): AppConfig => loadAppConfig() }],
  exports: [appConfigToken],
})
export class ConfigModule {}
