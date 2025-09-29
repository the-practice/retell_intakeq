const VerificationService = require('../src/services/verificationService');

describe('VerificationService', () => {
  let verificationService;

  beforeEach(() => {
    verificationService = new VerificationService();
  });

  describe('verifyClient', () => {
    it('should verify client with valid phone and DOB', async () => {
      const result = await verificationService.verifyClient('+19041234567', '1985-03-15');
      
      expect(result.verified).toBe(true);
      expect(result.clientInfo).toBeDefined();
      expect(result.clientInfo.name).toBe('John Doe');
    });

    it('should reject invalid phone number format', async () => {
      const result = await verificationService.verifyClient('123', '1985-03-15');
      
      expect(result.verified).toBe(false);
      expect(result.error).toBe('Invalid phone number format');
    });

    it('should reject invalid date of birth format', async () => {
      const result = await verificationService.verifyClient('+19041234567', 'invalid-date');
      
      expect(result.verified).toBe(false);
      expect(result.error).toBe('Invalid date of birth format');
    });

    it('should handle lockout after multiple failed attempts', async () => {
      // Simulate multiple failed attempts
      for (let i = 0; i < 3; i++) {
        await verificationService.verifyClient('+19041234567', 'wrong-dob');
      }
      
      const result = await verificationService.verifyClient('+19041234567', 'wrong-dob');
      
      expect(result.verified).toBe(false);
      expect(result.error).toContain('Too many failed attempts');
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should validate correct phone number formats', () => {
      expect(verificationService.isValidPhoneNumber('+19041234567')).toBe(true);
      expect(verificationService.isValidPhoneNumber('9041234567')).toBe(true);
      expect(verificationService.isValidPhoneNumber('(904) 123-4567')).toBe(true);
    });

    it('should reject invalid phone number formats', () => {
      expect(verificationService.isValidPhoneNumber('123')).toBe(false);
      expect(verificationService.isValidPhoneNumber('abc-def-ghij')).toBe(false);
      expect(verificationService.isValidPhoneNumber('')).toBe(false);
    });
  });

  describe('isValidDateOfBirth', () => {
    it('should validate correct date formats', () => {
      expect(verificationService.isValidDateOfBirth('03/15/1985')).toBe(true);
      expect(verificationService.isValidDateOfBirth('03-15-1985')).toBe(true);
      expect(verificationService.isValidDateOfBirth('1985-03-15')).toBe(true);
    });

    it('should reject invalid date formats', () => {
      expect(verificationService.isValidDateOfBirth('invalid-date')).toBe(false);
      expect(verificationService.isValidDateOfBirth('13/45/1985')).toBe(false);
      expect(verificationService.isValidDateOfBirth('')).toBe(false);
    });
  });

  describe('normalizePhoneNumber', () => {
    it('should normalize phone numbers to consistent format', () => {
      expect(verificationService.normalizePhoneNumber('9041234567')).toBe('+19041234567');
      expect(verificationService.normalizePhoneNumber('+19041234567')).toBe('+19041234567');
      expect(verificationService.normalizePhoneNumber('(904) 123-4567')).toBe('+19041234567');
    });
  });

  describe('normalizeDateOfBirth', () => {
    it('should normalize dates to YYYY-MM-DD format', () => {
      expect(verificationService.normalizeDateOfBirth('03/15/1985')).toBe('1985-03-15');
      expect(verificationService.normalizeDateOfBirth('03-15-1985')).toBe('1985-03-15');
      expect(verificationService.normalizeDateOfBirth('1985-03-15')).toBe('1985-03-15');
    });
  });

  describe('maskPhoneNumber', () => {
    it('should mask phone numbers for logging', () => {
      expect(verificationService.maskPhoneNumber('+19041234567')).toBe('*******4567');
      expect(verificationService.maskPhoneNumber('9041234567')).toBe('******4567');
    });
  });

  describe('maskDateOfBirth', () => {
    it('should mask dates of birth for logging', () => {
      expect(verificationService.maskDateOfBirth('03/15/1985')).toBe('**/**/****');
      expect(verificationService.maskDateOfBirth('1985-03-15')).toBe('****-**-**');
    });
  });
});
