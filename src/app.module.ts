import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { ConfigModule } from '@/config/config.module';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { RedisModule } from '@/infrastructure/redis/redis.module';
import { JwtModule } from '@/infrastructure/jwt/jwt.module';
import { AuditModule } from '@/infrastructure/audit/audit.module';
import { DivisionGuard } from '@/common/guards/division.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { LettersModule } from '@/modules/letters/letters.module';
import { FinanceModule } from '@/modules/finance/finance.module';
import { DivisionsModule } from '@/modules/divisions/divisions.module';
import { UploaderModule } from '@/modules/uploader/uploader.module';

/**
 * Urutan APP_GUARD menentukan urutan eksekusi: JwtAuthGuard (isi request.user)
 * → RolesGuard → DivisionGuard (butuh request.user; menulis audit saat menolak).
 */
@Module({
  imports: [
    // Memuat .env ke process.env (produksi: Vercel sudah menyuntikkan env).
    NestConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ConfigModule,
    PrismaModule,
    RedisModule,
    JwtModule,
    AuditModule,
    AuthModule,
    UsersModule,
    LettersModule,
    FinanceModule,
    DivisionsModule,
    UploaderModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: DivisionGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
