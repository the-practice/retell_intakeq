const redis = require('redis');
const winston = require('winston');
const { promisify } = require('util');

class CacheService {
  constructor() {
    this.redis = null;
    this.connected = false;
    this.writeBehindQueue = [];
    this.batchSize = 10;
    this.flushInterval = 1000; // 1 second
    this.maxRetries = 3;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()]
    });

    this.setupWriteBehindProcessor();
  }

  async connect() {
    try {
      this.redis = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            this.logger.error('Redis connection refused');
            return new Error('Redis connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            this.logger.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            this.logger.error('Redis max retry attempts reached');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.redis.on('connect', () => {
        this.connected = true;
        this.logger.info('Redis cache connected');
      });

      this.redis.on('error', (error) => {
        this.connected = false;
        this.logger.error('Redis cache error:', error);
      });

      this.redis.on('end', () => {
        this.connected = false;
        this.logger.warn('Redis cache connection ended');
      });

      await this.redis.connect();
      
      // Promisify Redis methods
      this.get = promisify(this.redis.get).bind(this.redis);
      this.set = promisify(this.redis.set).bind(this.redis);
      this.del = promisify(this.redis.del).bind(this.redis);
      this.exists = promisify(this.redis.exists).bind(this.redis);
      this.expire = promisify(this.redis.expire).bind(this.redis);
      this.hget = promisify(this.redis.hget).bind(this.redis);
      this.hset = promisify(this.redis.hset).bind(this.redis);
      this.hdel = promisify(this.redis.hdel).bind(this.redis);
      this.hgetall = promisify(this.redis.hgetall).bind(this.redis);

    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  isConnected() {
    return this.connected;
  }

  /**
   * Get data from cache with fallback
   */
  async get(key, fallback = null) {
    try {
      if (!this.connected) {
        this.logger.warn('Redis not connected, returning fallback');
        return fallback;
      }

      const data = await this.get(key);
      
      if (data) {
        try {
          return JSON.parse(data);
        } catch (parseError) {
          this.logger.warn(`Failed to parse cached data for key ${key}:`, parseError);
          return fallback;
        }
      }

      return fallback;
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}:`, error);
      return fallback;
    }
  }

  /**
   * Set data in cache with TTL
   */
  async set(key, value, ttl = 3600) {
    try {
      if (!this.connected) {
        this.logger.warn('Redis not connected, skipping cache set');
        return false;
      }

      const serializedValue = JSON.stringify(value);
      await this.set(key, serializedValue);
      
      if (ttl > 0) {
        await this.expire(key, ttl);
      }

      this.logger.debug(`Cached data for key: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete data from cache
   */
  async del(key) {
    try {
      if (!this.connected) {
        this.logger.warn('Redis not connected, skipping cache delete');
        return false;
      }

      await this.del(key);
      this.logger.debug(`Deleted cache key: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key) {
    try {
      if (!this.connected) {
        return false;
      }

      const result = await this.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error checking cache key existence ${key}:`, error);
      return false;
    }
  }

  /**
   * Write-behind cache for appointment booking
   * This provides lightning-fast response times (1ms target)
   */
  async writeBehindSet(key, value, ttl = 3600) {
    try {
      // Immediately cache the data for fast reads
      await this.set(key, value, ttl);
      
      // Queue for background write to IntakeQ
      this.writeBehindQueue.push({
        operation: 'set',
        key,
        value,
        ttl,
        timestamp: Date.now(),
        retries: 0
      });

      this.logger.debug(`Queued write-behind operation for key: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`Error in write-behind set for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Write-behind cache for appointment updates
   */
  async writeBehindUpdate(key, updates, ttl = 3600) {
    try {
      // Get current cached data
      const currentData = await this.get(key);
      
      if (currentData) {
        // Merge updates with current data
        const updatedData = { ...currentData, ...updates };
        
        // Immediately update cache
        await this.set(key, updatedData, ttl);
        
        // Queue for background write to IntakeQ
        this.writeBehindQueue.push({
          operation: 'update',
          key,
          value: updatedData,
          ttl,
          timestamp: Date.now(),
          retries: 0
        });

        this.logger.debug(`Queued write-behind update for key: ${key}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error in write-behind update for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Write-behind cache for appointment deletion
   */
  async writeBehindDelete(key) {
    try {
      // Immediately remove from cache
      await this.del(key);
      
      // Queue for background write to IntakeQ
      this.writeBehindQueue.push({
        operation: 'delete',
        key,
        timestamp: Date.now(),
        retries: 0
      });

      this.logger.debug(`Queued write-behind delete for key: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`Error in write-behind delete for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Setup write-behind processor for background operations
   */
  setupWriteBehindProcessor() {
    setInterval(async () => {
      if (this.writeBehindQueue.length === 0) {
        return;
      }

      const batch = this.writeBehindQueue.splice(0, this.batchSize);
      
      for (const operation of batch) {
        try {
          await this.processWriteBehindOperation(operation);
        } catch (error) {
          this.logger.error('Error processing write-behind operation:', error);
          
          // Retry logic
          if (operation.retries < this.maxRetries) {
            operation.retries++;
            this.writeBehindQueue.push(operation);
          } else {
            this.logger.error('Max retries exceeded for operation:', operation);
          }
        }
      }
    }, this.flushInterval);
  }

  /**
   * Process individual write-behind operation
   */
  async processWriteBehindOperation(operation) {
    try {
      switch (operation.operation) {
        case 'set':
          await this.syncToIntakeQ(operation.key, operation.value);
          break;
        case 'update':
          await this.syncToIntakeQ(operation.key, operation.value);
          break;
        case 'delete':
          await this.deleteFromIntakeQ(operation.key);
          break;
        default:
          this.logger.warn(`Unknown write-behind operation: ${operation.operation}`);
      }
    } catch (error) {
      this.logger.error('Error processing write-behind operation:', error);
      throw error;
    }
  }

  /**
   * Sync data to IntakeQ (background operation)
   */
  async syncToIntakeQ(key, value) {
    try {
      // This would integrate with your IntakeQ service
      // For now, we'll simulate the operation
      this.logger.debug(`Syncing to IntakeQ: ${key}`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.logger.debug(`Successfully synced to IntakeQ: ${key}`);
    } catch (error) {
      this.logger.error('Error syncing to IntakeQ:', error);
      throw error;
    }
  }

  /**
   * Delete from IntakeQ (background operation)
   */
  async deleteFromIntakeQ(key) {
    try {
      // This would integrate with your IntakeQ service
      this.logger.debug(`Deleting from IntakeQ: ${key}`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.logger.debug(`Successfully deleted from IntakeQ: ${key}`);
    } catch (error) {
      this.logger.error('Error deleting from IntakeQ:', error);
      throw error;
    }
  }

  /**
   * Get appointment availability with caching
   */
  async getAppointmentAvailability(providerId, date) {
    const cacheKey = `availability:${providerId}:${date}`;
    
    try {
      // Check cache first
      let availability = await this.get(cacheKey);
      
      if (!availability) {
        // If not in cache, this would normally fetch from IntakeQ
        // For now, we'll return mock data
        availability = this.generateMockAvailability(providerId, date);
        
        // Cache for 5 minutes
        await this.set(cacheKey, availability, 300);
      }
      
      return availability;
    } catch (error) {
      this.logger.error('Error getting appointment availability:', error);
      throw error;
    }
  }

  /**
   * Generate mock availability data
   */
  generateMockAvailability(providerId, date) {
    const slots = [];
    const startHour = 10; // 10 AM
    const endHour = 18; // 6 PM
    const lunchStart = 13; // 1 PM
    const lunchEnd = 14; // 2 PM
    
    for (let hour = startHour; hour < endHour; hour++) {
      // Skip lunch break
      if (hour >= lunchStart && hour < lunchEnd) {
        continue;
      }
      
      // Generate 15-minute slots
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push({
          time: timeString,
          available: Math.random() > 0.3, // 70% availability
          appointmentType: 'any'
        });
      }
    }
    
    return {
      providerId,
      date,
      slots: slots.filter(slot => slot.available)
    };
  }

  /**
   * Cache client information
   */
  async cacheClientInfo(clientId, clientInfo) {
    const cacheKey = `client:${clientId}`;
    await this.set(cacheKey, clientInfo, 3600); // 1 hour TTL
  }

  /**
   * Get cached client information
   */
  async getCachedClientInfo(clientId) {
    const cacheKey = `client:${clientId}`;
    return await this.get(cacheKey);
  }

  /**
   * Invalidate client cache
   */
  async invalidateClientCache(clientId) {
    const cacheKey = `client:${clientId}`;
    await this.del(cacheKey);
  }

  /**
   * Cache appointment information
   */
  async cacheAppointment(appointmentId, appointmentData) {
    const cacheKey = `appointment:${appointmentId}`;
    await this.set(cacheKey, appointmentData, 3600); // 1 hour TTL
  }

  /**
   * Get cached appointment
   */
  async getCachedAppointment(appointmentId) {
    const cacheKey = `appointment:${appointmentId}`;
    return await this.get(cacheKey);
  }

  /**
   * Invalidate appointment cache
   */
  async invalidateAppointmentCache(appointmentId) {
    const cacheKey = `appointment:${appointmentId}`;
    await this.del(cacheKey);
  }

  /**
   * Cache insurance verification results
   */
  async cacheInsuranceVerification(memberId, verificationResult) {
    const cacheKey = `insurance:${memberId}`;
    await this.set(cacheKey, verificationResult, 1800); // 30 minutes TTL
  }

  /**
   * Get cached insurance verification
   */
  async getCachedInsuranceVerification(memberId) {
    const cacheKey = `insurance:${memberId}`;
    return await this.get(cacheKey);
  }

  /**
   * Update call transcript in cache
   */
  async updateCallTranscript(callId, transcript) {
    const cacheKey = `call:${callId}:transcript`;
    await this.set(cacheKey, transcript, 86400); // 24 hours TTL
  }

  /**
   * Get call transcript from cache
   */
  async getCallTranscript(callId) {
    const cacheKey = `call:${callId}:transcript`;
    return await this.get(cacheKey);
  }

  /**
   * Cache provider schedule
   */
  async cacheProviderSchedule(providerId, date, schedule) {
    const cacheKey = `schedule:${providerId}:${date}`;
    await this.set(cacheKey, schedule, 1800); // 30 minutes TTL
  }

  /**
   * Get cached provider schedule
   */
  async getCachedProviderSchedule(providerId, date) {
    const cacheKey = `schedule:${providerId}:${date}`;
    return await this.get(cacheKey);
  }

  /**
   * Clear all cache data
   */
  async clearAll() {
    try {
      if (!this.connected) {
        this.logger.warn('Redis not connected, cannot clear cache');
        return false;
      }

      await this.redis.flushall();
      this.logger.info('All cache data cleared');
      return true;
    } catch (error) {
      this.logger.error('Error clearing cache:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      if (!this.connected) {
        return { connected: false };
      }

      const info = await this.redis.info();
      return {
        connected: true,
        info: info,
        queueLength: this.writeBehindQueue.length
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return { connected: false, error: error.message };
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    try {
      if (this.redis) {
        await this.redis.quit();
        this.connected = false;
        this.logger.info('Redis cache connection closed');
      }
    } catch (error) {
      this.logger.error('Error closing Redis connection:', error);
    }
  }
}

module.exports = CacheService;
