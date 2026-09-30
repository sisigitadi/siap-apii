import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';

// Augmentasi tipe Express agar `request.user` terikat klaim JWT kita.
declare module 'express' {
  interface Request {
    user?: AccessTokenClaims;
  }
}
