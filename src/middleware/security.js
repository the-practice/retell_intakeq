const crypto = require('crypto');
const winston = require('winston');

class SecurityMiddleware {
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
    this.auditLogs = [];
  }

  /**
   * Encrypt sensitive data in request/response
   */
  static encryptSensitiveData(req, res, next) {
    try {
      // Encrypt sensitive fields in request body
      if (req.body) {
        req.body = SecurityMiddleware.encryptSensitiveFields(req.body);
      }

      // Encrypt sensitive fields in response
      const originalSend = res.send;
      res.send = function(data) {
        if (data && typeof data === 'object') {
          data = SecurityMiddleware.encryptSensitiveFields(data);
        }
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Error in encryptSensitiveData middleware:', error);
      next();
    }
  }

  /**
   * Audit logging for HIPAA compliance
   */
  static auditLogging(req, res, next) {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    // Add request ID to request object
    req.requestId = requestId;
    
    // Log request
    const auditEntry = {
      requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      headers: SecurityMiddleware.sanitizeHeaders(req.headers),
      body: SecurityMiddleware.sanitizeBody(req.body)
    };

    console.log('Audit log entry:', auditEntry);

    // Log response
    const originalSend = res.send;
    res.send = function(data) {
      const responseTime = Date.now() - startTime;
      
      const responseAuditEntry = {
        requestId,
        timestamp: new Date().toISOString(),
        statusCode: res.statusCode,
        responseTime,
        responseSize: data ? data.length : 0
      };

      console.log('Response audit log entry:', responseAuditEntry);
      
      return originalSend.call(this, data);
    };

    next();
  }

  /**
   * Encrypt sensitive fields in data
   */
  static encryptSensitiveFields(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'phoneNumber', 'phone', 'dateOfBirth', 'dob', 'ssn', 'socialSecurityNumber',
      'memberId', 'insuranceId', 'patientId', 'clientId', 'email', 'address',
      'firstName', 'lastName', 'name', 'insurance', 'copay', 'deductible'
    ];

    const encrypted = { ...data };

    for (const field of sensitiveFields) {
      if (encrypted[field] && typeof encrypted[field] === 'string') {
        encrypted[field] = SecurityMiddleware.encrypt(encrypted[field]);
      }
    }

    // Recursively encrypt nested objects
    for (const key in encrypted) {
      if (encrypted[key] && typeof encrypted[key] === 'object') {
        encrypted[key] = SecurityMiddleware.encryptSensitiveFields(encrypted[key]);
      }
    }

    return encrypted;
  }

  /**
   * Encrypt a string
   */
  static encrypt(text) {
    try {
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, process.env.ENCRYPTION_KEY);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        algorithm
      };
    } catch (error) {
      console.error('Encryption error:', error);
      return text; // Return original text if encryption fails
    }
  }

  /**
   * Decrypt a string
   */
  static decrypt(encryptedData) {
    try {
      if (typeof encryptedData === 'string') {
        return encryptedData; // Already decrypted
      }

      const { encrypted, iv, algorithm } = encryptedData;
      const decipher = crypto.createDecipher(algorithm, process.env.ENCRYPTION_KEY);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedData; // Return original data if decryption fails
    }
  }

  /**
   * Sanitize headers for logging
   */
  static sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    
    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize request body for logging
   */
  static sanitizeBody(body) {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = [
      'phoneNumber', 'phone', 'dateOfBirth', 'dob', 'ssn', 'socialSecurityNumber',
      'memberId', 'insuranceId', 'patientId', 'clientId', 'email', 'address',
      'firstName', 'lastName', 'name', 'insurance', 'copay', 'deductible'
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Validate HIPAA compliance requirements
   */
  static validateHIPAACompliance(req, res, next) {
    // Check for required security headers
    const requiredHeaders = ['x-request-id', 'x-timestamp'];
    const missingHeaders = requiredHeaders.filter(header => !req.headers[header]);
    
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        error: 'Missing required security headers',
        missingHeaders
      });
    }

    // Check for secure connection
    if (process.env.NODE_ENV === 'production' && !req.secure) {
      return res.status(400).json({
        error: 'Secure connection required for HIPAA compliance'
      });
    }

    next();
  }

  /**
   * Rate limiting for API endpoints
   */
  static rateLimit(windowMs = 60000, maxRequests = 100) {
    const requests = new Map();
    
    return (req, res, next) => {
      const clientId = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean up old requests
      if (requests.has(clientId)) {
        const clientRequests = requests.get(clientId);
        const recentRequests = clientRequests.filter(timestamp => timestamp > windowStart);
        requests.set(clientId, recentRequests);
      } else {
        requests.set(clientId, []);
      }
      
      const clientRequests = requests.get(clientId);
      
      if (clientRequests.length >= maxRequests) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      
      clientRequests.push(now);
      next();
    };
  }

  /**
   * Validate request signature for webhooks
   */
  static validateWebhookSignature(secret) {
    return (req, res, next) => {
      const signature = req.headers['x-signature'] || req.headers['x-hub-signature'];
      
      if (!signature) {
        return res.status(401).json({ error: 'Missing signature' });
      }
      
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');
      
      if (signature !== `sha256=${expectedSignature}`) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
      
      next();
    };
  }

  /**
   * Log security events
   */
  static logSecurityEvent(event, details) {
    const securityLog = {
      timestamp: new Date().toISOString(),
      event,
      details,
      severity: this.getEventSeverity(event)
    };
    
    console.log('Security event:', securityLog);
    
    // In production, this would be sent to a security monitoring system
    // and stored in a secure audit database
  }

  /**
   * Get severity level for security events
   */
  static getEventSeverity(event) {
    const highSeverityEvents = [
      'unauthorized_access', 'data_breach', 'encryption_failure',
      'authentication_failure', 'rate_limit_exceeded'
    ];
    
    const mediumSeverityEvents = [
      'suspicious_activity', 'invalid_request', 'missing_headers'
    ];
    
    if (highSeverityEvents.includes(event)) {
      return 'high';
    } else if (mediumSeverityEvents.includes(event)) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Generate secure session token
   */
  static generateSessionToken(payload) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    return {
      token,
      expiresAt,
      payload: this.encrypt(JSON.stringify(payload))
    };
  }

  /**
   * Validate session token
   */
  static validateSessionToken(token, sessionData) {
    if (!sessionData || !sessionData.token || !sessionData.expiresAt) {
      return false;
    }
    
    if (token !== sessionData.token) {
      return false;
    }
    
    if (Date.now() > sessionData.expiresAt) {
      return false;
    }
    
    return true;
  }

  /**
   * Sanitize user input
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }
    
    // Remove potentially dangerous characters
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/[&]/g, '&amp;') // Escape ampersands
      .replace(/["]/g, '&quot;') // Escape quotes
      .replace(/[']/g, '&#x27;') // Escape single quotes
      .replace(/[\/]/g, '&#x2F;') // Escape forward slashes
      .trim();
  }

  /**
   * Validate phone number format
   */
  static validatePhoneNumber(phoneNumber) {
    const phoneRegex = /^(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Validate date of birth format
   */
  static validateDateOfBirth(dateOfBirth) {
    const dobRegex = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})$/;
    return dobRegex.test(dateOfBirth);
  }

  /**
   * Validate email format
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate secure random string
   */
  static generateSecureRandom(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data for storage
   */
  static hashSensitiveData(data, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex');
    }
    
    const hash = crypto.createHash('sha256');
    hash.update(data + salt);
    
    return {
      hash: hash.digest('hex'),
      salt
    };
  }

  /**
   * Verify hashed data
   */
  static verifyHashedData(data, hash, salt) {
    const computedHash = this.hashSensitiveData(data, salt);
    return computedHash.hash === hash;
  }
}

module.exports = SecurityMiddleware;
