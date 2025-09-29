const CacheService = require('../src/services/cacheService');

describe('CacheService', () => {
  let cacheService;

  beforeEach(() => {
    cacheService = new CacheService();
  });

  afterEach(async () => {
    if (cacheService.connected) {
      await cacheService.close();
    }
  });

  describe('writeBehindSet', () => {
    it('should immediately cache data and queue for background write', async () => {
      const key = 'test:key';
      const value = { test: 'data' };
      const ttl = 3600;

      const result = await cacheService.writeBehindSet(key, value, ttl);
      
      expect(result).toBe(true);
      expect(cacheService.writeBehindQueue.length).toBeGreaterThan(0);
    });
  });

  describe('writeBehindUpdate', () => {
    it('should update cached data and queue for background write', async () => {
      const key = 'test:key';
      const initialValue = { test: 'initial' };
      const updates = { test: 'updated' };

      // Set initial value
      await cacheService.writeBehindSet(key, initialValue, 3600);
      
      const result = await cacheService.writeBehindUpdate(key, updates, 3600);
      
      expect(result).toBe(true);
      expect(cacheService.writeBehindQueue.length).toBeGreaterThan(0);
    });
  });

  describe('writeBehindDelete', () => {
    it('should delete cached data and queue for background write', async () => {
      const key = 'test:key';
      const value = { test: 'data' };

      // Set initial value
      await cacheService.writeBehindSet(key, value, 3600);
      
      const result = await cacheService.writeBehindDelete(key);
      
      expect(result).toBe(true);
      expect(cacheService.writeBehindQueue.length).toBeGreaterThan(0);
    });
  });

  describe('getAppointmentAvailability', () => {
    it('should return cached availability if available', async () => {
      const providerId = 'charles_maddix';
      const date = '2024-01-15';

      const availability = await cacheService.getAppointmentAvailability(providerId, date);
      
      expect(availability).toBeDefined();
      expect(availability.providerId).toBe(providerId);
      expect(availability.date).toBe(date);
      expect(availability.slots).toBeDefined();
    });
  });

  describe('cacheClientInfo', () => {
    it('should cache client information', async () => {
      const clientId = 'client_001';
      const clientInfo = { name: 'John Doe', phone: '+19041234567' };

      await cacheService.cacheClientInfo(clientId, clientInfo);
      
      const cached = await cacheService.getCachedClientInfo(clientId);
      expect(cached).toBeDefined();
    });
  });

  describe('cacheAppointment', () => {
    it('should cache appointment information', async () => {
      const appointmentId = 'apt_001';
      const appointmentData = { 
        id: appointmentId, 
        clientId: 'client_001', 
        provider: 'charles_maddix',
        date: '2024-01-15',
        time: '10:30'
      };

      await cacheService.cacheAppointment(appointmentId, appointmentData);
      
      const cached = await cacheService.getCachedAppointment(appointmentId);
      expect(cached).toBeDefined();
    });
  });

  describe('cacheInsuranceVerification', () => {
    it('should cache insurance verification results', async () => {
      const memberId = 'member_001';
      const verificationResult = { 
        verified: true, 
        provider: 'Blue Cross Blue Shield', 
        copay: 25 
      };

      await cacheService.cacheInsuranceVerification(memberId, verificationResult);
      
      const cached = await cacheService.getCachedInsuranceVerification(memberId);
      expect(cached).toBeDefined();
    });
  });

  describe('invalidateClientCache', () => {
    it('should remove client from cache', async () => {
      const clientId = 'client_001';
      const clientInfo = { name: 'John Doe' };

      // Cache client info
      await cacheService.cacheClientInfo(clientId, clientInfo);
      
      // Invalidate cache
      await cacheService.invalidateClientCache(clientId);
      
      const cached = await cacheService.getCachedClientInfo(clientId);
      expect(cached).toBeNull();
    });
  });

  describe('invalidateAppointmentCache', () => {
    it('should remove appointment from cache', async () => {
      const appointmentId = 'apt_001';
      const appointmentData = { id: appointmentId };

      // Cache appointment
      await cacheService.cacheAppointment(appointmentId, appointmentData);
      
      // Invalidate cache
      await cacheService.invalidateAppointmentCache(appointmentId);
      
      const cached = await cacheService.getCachedAppointment(appointmentId);
      expect(cached).toBeNull();
    });
  });

  describe('generateMockAvailability', () => {
    it('should generate mock availability data', () => {
      const providerId = 'charles_maddix';
      const date = '2024-01-15';

      const availability = cacheService.generateMockAvailability(providerId, date);
      
      expect(availability).toBeDefined();
      expect(availability.providerId).toBe(providerId);
      expect(availability.date).toBe(date);
      expect(availability.slots).toBeDefined();
      expect(Array.isArray(availability.slots)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const stats = await cacheService.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.connected).toBeDefined();
      expect(stats.queueLength).toBeDefined();
    });
  });

  describe('clearAll', () => {
    it('should clear all cache data', async () => {
      const result = await cacheService.clearAll();
      
      expect(result).toBeDefined();
    });
  });
});
