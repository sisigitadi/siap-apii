import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, GoogleOAuthService],
})
export class AuthModule {}
