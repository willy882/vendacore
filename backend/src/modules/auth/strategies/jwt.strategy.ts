import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../database/prisma.service';

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  businessId: string;
  roleId: string;
  tokenVersion?: number;
}

// Caché en memoria: evita consultar la BD en cada request (TTL 60s)
const userCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  static invalidateCache(userId: string) {
    userCache.delete(userId);
  }

  async validate(payload: JwtPayload) {
    const cached = userCache.get(payload.sub);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    const { passwordHash: _, twoFactorSecret: __, ...safeUser } = user;
    userCache.set(payload.sub, { data: safeUser, expiresAt: Date.now() + CACHE_TTL_MS });
    return safeUser;
  }
}
