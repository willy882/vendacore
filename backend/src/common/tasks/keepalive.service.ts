import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class KeepaliveService {
  private readonly logger = new Logger(KeepaliveService.name);
  private interval: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {
    this.interval = setInterval(() => this.ping(), 4 * 60 * 1000);
  }

  private async ping() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      this.logger.warn('KeepaliveService: DB ping fallido');
    }
  }

  onModuleDestroy() {
    clearInterval(this.interval);
  }
}