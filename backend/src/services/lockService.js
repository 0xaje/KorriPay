import { EventEmitter } from 'events';

class LockService extends EventEmitter {
  constructor() {
    super();
    this.redisClient = null;
    this.localLocks = new Map();
    this.initRedis();
  }

  async initRedis() {
    if (process.env.REDIS_URL) {
      try {
        const { default: Redis } = await import('ioredis');
        this.redisClient = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 1,
          connectTimeout: 2000
        });
        this.redisClient.on('error', (err) => {
          console.warn('[LockService] Redis connection error, using local fallback lock:', err.message);
          this.redisClient = null;
        });
      } catch (e) {
        console.warn('[LockService] ioredis module not found. Using in-memory fallback lock.');
      }
    }
  }

  /**
   * Acquire a lock for a key.
   */
  async acquire(key, ttl = 30000) {
    if (this.redisClient) {
      try {
        const token = Math.random().toString(36).substring(2);
        // Set NX PX: Set if not exists, expiration in PX milliseconds
        const acquired = await this.redisClient.set(key, token, 'NX', 'PX', ttl);
        if (acquired === 'OK') {
          return {
            release: async () => {
              const lua = `
                if redis.call("get", KEYS[1]) == ARGV[1] then
                  return redis.call("del", KEYS[1])
                else
                  return 0
                end
              `;
              await this.redisClient.eval(lua, 1, key, token);
            }
          };
        }
      } catch (err) {
        console.warn('[LockService] Redis lock failed, falling back to local lock:', err.message);
      }
    }

    // Local in-memory lock fallback
    while (this.localLocks.has(key)) {
      const expires = this.localLocks.get(key);
      if (Date.now() > expires) {
        this.localLocks.delete(key);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    this.localLocks.set(key, Date.now() + ttl);
    return {
      release: async () => {
        this.localLocks.delete(key);
      }
    };
  }
}

export const lockService = new LockService();
export default lockService;
