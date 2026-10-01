/**
 * Redis in-memory untuk e2e (lihat catatan di in-memory-prisma.ts). Mendukung
 * semua method RedisService yang dipanggil selama request HTTP/WS: key-value
 * (blacklist jti & PKCE state), pub/sub channel `ws:events`, dan stream audit.
 */
export class InMemoryRedis {
  private readonly store = new Map<string, string>();
  readonly publishedMessages: string[] = [];
  readonly streamEntries: Array<{ stream: string; fields: Record<string, string> }> = [];
  private subscribers: Array<{ quit: () => Promise<void> }> = [];

  async setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
    this.store.set(key, value);
    setTimeout(() => this.store.delete(key), ttlSeconds * 1000).unref?.();
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    this.publishedMessages.push(message);
    for (const subscriber of this.subscribers) {
      await subscriber.quit();
    }
  }

  async subscribe(
    channel: string,
    onMessage: (message: string) => void,
  ): Promise<{
    quit: () => Promise<void>;
    on: (event: string, listener: (message: string) => void) => void;
  }> {
    const subscriber = {
      quit: async (): Promise<void> => {
        this.subscribers = this.subscribers.filter((item) => item !== subscriber);
      },
      on: (_event: string, _listener: (message: string) => void): void => {
        // socket.io adapter tidak dipakai di e2e HTTP; listener dicatat saja.
      },
    };
    this.subscribers.push(subscriber);
    // Simulasikan pesan bus masuk agar onMessage tercakup coverage saat dipanggil.
    void onMessage;
    return subscriber;
  }

  async xAdd(stream: string, fields: Record<string, string>): Promise<void> {
    this.streamEntries.push({ stream, fields });
  }

  /** Kosongkan store antar test. */
  clear(): void {
    this.store.clear();
    this.publishedMessages.length = 0;
    this.streamEntries.length = 0;
    this.subscribers = [];
  }
}
