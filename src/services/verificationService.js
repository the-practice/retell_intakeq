const crypto = require('crypto');
const bcrypt = require('bcrypt');
const winston = require('winston');

class VerificationService {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()]
    });
    
    this.encryptionKey = process.env.ENCRYPTION_KEY;
    this.verificationAttempts = new Map();
    this.maxAttempts = 3;
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Verify client identity using phone number and date of birth
   * This is the primary HIPAA-compliant verification method
   */
  async verifyClient(phoneNumber, dateOfBirth) {
    try {
      // Validate input format
      if (!this.isValidPhoneNumber(phoneNumber)) {
        this.logger.warn(`Invalid phone number format: ${this.maskPhoneNumber(phoneNumber)}`);
        return {
          verified: false,
          error: 'Invalid phone number format',
          attemptsRemaining: this.getRemainingAttempts(phoneNumber)
        };
      }

      if (!this.isValidDateOfBirth(dateOfBirth)) {
        this.logger.warn(`Invalid date of birth format: ${this.maskDateOfBirth(dateOfBirth)}`);
        return {
          verified: false,
          error: 'Invalid date of birth format',
          attemptsRemaining: this.getRemainingAttempts(phoneNumber)
        };
      }

      // Check for lockout
      if (this.isLockedOut(phoneNumber)) {
        this.logger.warn(`Phone number locked out: ${this.maskPhoneNumber(phoneNumber)}`);
        return {
          verified: false,
          error: 'Too many failed attempts. Please try again later.',
          lockoutExpires: this.getLockoutExpiration(phoneNumber)
        };
      }

      // Normalize phone number for comparison
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      const normalizedDOB = this.normalizeDateOfBirth(dateOfBirth);

      // Hash the inputs for secure comparison
      const phoneHash = await this.hashSensitiveData(normalizedPhone);
      const dobHash = await this.hashSensitiveData(normalizedDOB);

      // Verify against stored client data
      const verificationResult = await this.performVerification(phoneHash, dobHash);

      if (verificationResult.verified) {
        // Reset failed attempts on successful verification
        this.clearFailedAttempts(phoneNumber);
        
        this.logger.info(`Client verified successfully: ${this.maskPhoneNumber(phoneNumber)}`);
        
        return {
          verified: true,
          clientId: verificationResult.clientId,
          clientName: verificationResult.clientName,
          insuranceInfo: verificationResult.insuranceInfo,
          lastAppointment: verificationResult.lastAppointment
        };
      } else {
        // Record failed attempt
        this.recordFailedAttempt(phoneNumber);
        
        this.logger.warn(`Client verification failed: ${this.maskPhoneNumber(phoneNumber)}`);
        
        return {
          verified: false,
          error: 'Phone number and date of birth do not match our records',
          attemptsRemaining: this.getRemainingAttempts(phoneNumber)
        };
      }

    } catch (error) {
      this.logger.error('Error in client verification:', error);
      return {
        verified: false,
        error: 'Verification service temporarily unavailable',
        attemptsRemaining: this.getRemainingAttempts(phoneNumber)
      };
    }
  }

  /**
   * Perform the actual verification against client database
   */
  async performVerification(phoneHash, dobHash) {
    try {
      // In a real implementation, this would query your secure client database
      // For now, we'll simulate with a mock database lookup
      
      // This is where you would integrate with your IntakeQ client database
      // or other secure client management system
      
      const mockClientDatabase = await this.getMockClientDatabase();
      
      for (const client of mockClientDatabase) {
        if (client.phoneHash === phoneHash && client.dobHash === dobHash) {
          return {
            verified: true,
            clientId: client.id,
            clientName: client.name,
            insuranceInfo: client.insurance,
            lastAppointment: client.lastAppointment
          };
        }
      }

      return { verified: false };
    } catch (error) {
      this.logger.error('Error performing verification:', error);
      throw error;
    }
  }

  /**
   * Get mock client database for demonstration
   * In production, this would be replaced with actual database queries
   */
  async getMockClientDatabase() {
    // This is a mock database for demonstration purposes
    // In production, this would query your actual client database
    return [
      {
        id: 'client_001',
        name: 'John Doe',
        phoneHash: await this.hashSensitiveData('+19041234567'),
        dobHash: await this.hashSensitiveData('1985-03-15'),
        insurance: {
          provider: 'Blue Cross Blue Shield',
          memberId: 'BC123456789',
          copay: 25
        },
        lastAppointment: '2024-01-15'
      },
      {
        id: 'client_002', 
        name: 'Jane Smith',
        phoneHash: await this.hashSensitiveData('+19047654321'),
        dobHash: await this.hashSensitiveData('1990-07-22'),
        insurance: {
          provider: 'Aetna',
          memberId: 'AET987654321',
          copay: 30
        },
        lastAppointment: '2024-01-10'
      }
    ];
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Check if it's a valid US phone number (10 or 11 digits)
    return digits.length === 10 || digits.length === 11;
  }

  /**
   * Validate date of birth format
   */
  isValidDateOfBirth(dateOfBirth) {
    // Accept various formats: MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD
    const dateRegex = /^(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})$/;
    return dateRegex.test(dateOfBirth);
  }

  /**
   * Normalize phone number to consistent format
   */
  normalizePhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let digits = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing
    if (digits.length === 10) {
      digits = '1' + digits;
    }
    
    return '+' + digits;
  }

  /**
   * Normalize date of birth to YYYY-MM-DD format
   */
  normalizeDateOfBirth(dateOfBirth) {
    // Handle various input formats
    let normalized = dateOfBirth.replace(/[/-]/g, '/');
    
    // If format is MM/DD/YYYY, convert to YYYY-MM-DD
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(normalized)) {
      const parts = normalized.split('/');
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      normalized = `${year}-${month}-${day}`;
    }
    
    return normalized;
  }

  /**
   * Hash sensitive data for secure storage and comparison
   */
  async hashSensitiveData(data) {
    const hash = await bcrypt.hash(data, 10);
    return hash;
  }

  /**
   * Encrypt sensitive data for secure transmission
   */
  encryptSensitiveData(data) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipherGCM(algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data
   */
  decryptSensitiveData(encryptedData, iv, authTag) {
    const algorithm = 'aes-256-gcm';
    const decipher = crypto.createDecipherGCM(algorithm, this.encryptionKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Record failed verification attempt
   */
  recordFailedAttempt(phoneNumber) {
    const key = this.normalizePhoneNumber(phoneNumber);
    const now = Date.now();
    
    if (!this.verificationAttempts.has(key)) {
      this.verificationAttempts.set(key, {
        attempts: 0,
        firstAttempt: now,
        lastAttempt: now
      });
    }
    
    const record = this.verificationAttempts.get(key);
    record.attempts++;
    record.lastAttempt = now;
    
    // Set lockout if max attempts reached
    if (record.attempts >= this.maxAttempts) {
      record.lockoutUntil = now + this.lockoutDuration;
      this.logger.warn(`Phone number locked out due to failed attempts: ${this.maskPhoneNumber(phoneNumber)}`);
    }
  }

  /**
   * Clear failed attempts after successful verification
   */
  clearFailedAttempts(phoneNumber) {
    const key = this.normalizePhoneNumber(phoneNumber);
    this.verificationAttempts.delete(key);
  }

  /**
   * Check if phone number is locked out
   */
  isLockedOut(phoneNumber) {
    const key = this.normalizePhoneNumber(phoneNumber);
    const record = this.verificationAttempts.get(key);
    
    if (!record || !record.lockoutUntil) {
      return false;
    }
    
    if (Date.now() > record.lockoutUntil) {
      // Lockout expired, clear the record
      this.verificationAttempts.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get remaining verification attempts
   */
  getRemainingAttempts(phoneNumber) {
    const key = this.normalizePhoneNumber(phoneNumber);
    const record = this.verificationAttempts.get(key);
    
    if (!record) {
      return this.maxAttempts;
    }
    
    return Math.max(0, this.maxAttempts - record.attempts);
  }

  /**
   * Get lockout expiration time
   */
  getLockoutExpiration(phoneNumber) {
    const key = this.normalizePhoneNumber(phoneNumber);
    const record = this.verificationAttempts.get(key);
    
    if (!record || !record.lockoutUntil) {
      return null;
    }
    
    return new Date(record.lockoutUntil).toISOString();
  }

  /**
   * Mask phone number for logging
   */
  maskPhoneNumber(phoneNumber) {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length >= 4) {
      return '*'.repeat(digits.length - 4) + digits.slice(-4);
    }
    return '*'.repeat(digits.length);
  }

  /**
   * Mask date of birth for logging
   */
  maskDateOfBirth(dateOfBirth) {
    return dateOfBirth.replace(/\d/g, '*');
  }

  /**
   * Audit log for verification attempts
   */
  async auditLog(phoneNumber, success, reason = null) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      phoneNumber: this.maskPhoneNumber(phoneNumber),
      success,
      reason,
      ipAddress: 'system', // Would be actual IP in production
      userAgent: 'voice-agent-matt'
    };
    
    this.logger.info('Verification audit log:', auditEntry);
    
    // In production, this would be stored in a secure audit database
    // for HIPAA compliance and security monitoring
  }
}

module.exports = VerificationService;
