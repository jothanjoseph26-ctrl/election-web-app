export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  error?: string;
}

class RateLimiter {
  private static instances = new Map<string, RateLimiter>();
  private requests: Array<{ timestamp: number }> = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  static getInstance(key: string, config: RateLimitConfig): RateLimiter {
    if (!this.instances.has(key)) {
      this.instances.set(key, new RateLimiter(config));
    }
    return this.instances.get(key)!;
  }

  checkLimit(): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Clean old requests
    this.requests = this.requests.filter(req => req.timestamp > windowStart);

    if (this.requests.length >= this.config.maxRequests) {
      const oldestRequest = Math.min(...this.requests.map(req => req.timestamp));
      const resetTime = new Date(oldestRequest + this.config.windowMs);

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        error: this.config.message || 'Too many requests, please try again later'
      };
    }

    this.requests.push({ timestamp: now });

    return {
      allowed: true,
      remaining: this.config.maxRequests - this.requests.length,
      resetTime: new Date(now + this.config.windowMs)
    };
  }

  reset(): void {
    this.requests = [];
  }
}

// Rate limit configurations for different actions
export const RATE_LIMITS = {
  // Authentication - stricter limits
  LOGIN: { windowMs: 15 * 60 * 1000, maxRequests: 5, message: 'Too many login attempts, please try again later' },
  SIGNUP: { windowMs: 60 * 60 * 1000, maxRequests: 3, message: 'Too many signup attempts, please try again later' },

  // General operations - moderate limits
  AGENT_IMPORT: { windowMs: 60 * 60 * 1000, maxRequests: 10, message: 'Too many import attempts' },
  BROADCAST: { windowMs: 60 * 1000, maxRequests: 20, message: 'Too many broadcasts, please slow down' },

  // Data operations - generous limits
  REPORTS: { windowMs: 60 * 1000, maxRequests: 100 },
  PAYMENTS: { windowMs: 60 * 1000, maxRequests: 50 },
  SEARCH: { windowMs: 60 * 1000, maxRequests: 200 }
} as const;

export class RateLimitService {
  static async checkRateLimit(
    userId: string, 
    action: keyof typeof RATE_LIMITS
  ): Promise<RateLimitResult> {
    const config = RATE_LIMITS[action];
    const limiter = RateLimiter.getInstance(`${userId}:${action}`, config);
    return limiter.checkLimit();
  }

  static async checkIpRateLimit(
    ipAddress: string, 
    action: keyof typeof RATE_LIMITS
  ): Promise<RateLimitResult> {
    const config = RATE_LIMITS[action];
    const limiter = RateLimiter.getInstance(`ip:${ipAddress}:${action}`, config);
    return limiter.checkLimit();
  }

  // Utility to get client IP for IP-based rate limiting
  static async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}