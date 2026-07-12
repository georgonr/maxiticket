import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Tenký Redis wrapper (ioredis). Best-effort: chyby spojenia sa nezhodia na aplikáciu –
 * get/incr vrátia bezpečné defaulty (null / 0), takže guest verify fail-uje ZATVORENE
 * (bez Redisu sa nedá zapísať verified stav → prístup sa neudelí).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    if (!url) {
      this.client = null;
      this.logger.warn('REDIS_URL nie je nastavený – Redis funkcie sú no-op.');
      return;
    }
    this.client = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    this.client.on('error', (e) => this.logger.warn(`Redis error: ${e.message}`));
  }

  async set(key: string, value: string, ttlSec?: number): Promise<void> {
    try {
      if (!this.client) return;
      if (ttlSec) await this.client.set(key, value, 'EX', ttlSec);
      else await this.client.set(key, value);
    } catch (e) {
      this.logger.warn(`Redis set(${key}) failed: ${(e as Error).message}`);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return this.client ? await this.client.get(key) : null;
    } catch (e) {
      this.logger.warn(`Redis get(${key}) failed: ${(e as Error).message}`);
      return null;
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return this.client ? await this.client.incr(key) : 0;
    } catch (e) {
      this.logger.warn(`Redis incr(${key}) failed: ${(e as Error).message}`);
      return 0;
    }
  }

  async expire(key: string, ttlSec: number): Promise<void> {
    try {
      if (this.client) await this.client.expire(key, ttlSec);
    } catch (e) {
      this.logger.warn(`Redis expire(${key}) failed: ${(e as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.client) await this.client.del(key);
    } catch (e) {
      this.logger.warn(`Redis del(${key}) failed: ${(e as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    this.client?.quit().catch(() => {});
  }
}
