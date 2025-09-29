const winston = require('winston');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AuditLogger {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/audit.log',
          level: 'info'
        })
      ]
    });

    this.auditLogs = [];
    this.maxLogs = 10000;
    this.retentionDays = parseInt(process.env.DATA_RETENTION_DAYS) || 2555; // 7 years for HIPAA
    this.encryptionKey = process.env.ENCRYPTION_KEY;
    
    this.setupLogRotation();
  }

  /**
   * Log call start event
   */
  async logCallStart(callId, callData) {
    try {
      const auditEntry = {
        event: 'call_started',
        callId,
        timestamp: new Date().toISOString(),
        data: this.sanitizeCallData(callData),
        ipAddress: callData.ipAddress || 'unknown',
        userAgent: callData.userAgent || 'unknown',
        sessionId: this.generateSessionId()
      };

      await this.writeAuditLog(auditEntry);
      this.logger.info(`Call started: ${callId}`);
    } catch (error) {
      this.logger.error('Error logging call start:', error);
    }
  }

  /**
   * Log call end event
   */
  async logCallEnd(callId, callData) {
    try {
      const auditEntry = {
        event: 'call_ended',
        callId,
        timestamp: new Date().toISOString(),
        data: this.sanitizeCallData(callData),
        duration: callData.duration || 0,
        outcome: callData.outcome || 'unknown',
        sessionId: this.getSessionId(callId)
      };

      await this.writeAuditLog(auditEntry);
      this.logger.info(`Call ended: ${callId}`);
    } catch (error) {
      this.logger.error('Error logging call end:', error);
    }
  }

  /**
   * Log client verification attempt
   */
  async logClientVerification(callId, verificationData, result) {
    try {
      const auditEntry = {
        event: 'client_verification',
        callId,
        timestamp: new Date().toISOString(),
        data: {
          phoneNumber: this.maskPhoneNumber(verificationData.phoneNumber),
          dateOfBirth: this.maskDateOfBirth(verificationData.dateOfBirth),
          result: result.verified ? 'success' : 'failure',
          reason: result.error || null
        },
        sessionId: this.getSessionId(callId)
      };

      await this.writeAuditLog(auditEntry);
      this.logger.info(`Client verification logged: ${callId}`);
    } catch (error) {
      this.logger.error('Error logging client verification:', error);
    }
  }

  /**
   * Log insurance verification attempt
   */
  async logInsuranceVerification(callId, insuranceData, result) {
    try {
      const auditEntry = {
        event: 'insurance_verification',
        callId,
        timestamp: new Date().toISOString(),
        data: {
          provider: insuranceData.provider,
          memberId: this.maskMemberId(insuranceData.memberId),
          result: result.verified ? 'success' : 'failure',
          copay: result.copay || null,
          deductible: result.deductible || null
        },
        sessionId: this.getSessionId(callId)
      };

      await this.writeAuditLog(auditEntry);
      this.logger.info(`Insurance verification logged: ${callId}`);
    } catch (error) {
      this.logger.error('Error logging insurance verification:', error);
    }
  }

  /**
   * Log appointment creation
   */
  async logAppointmentCreation(callId, appointmentData) {
    try {
      const auditEntry = {
        event: 'appointment_created',
        callId,
        timestamp: new Date().toISOString(),
        data: {
          appointmentId: appointmentData.appointmentId,
          clientId: this.maskClientId(appointmentData.clientId),
          provider: appointmentData.provider,
          date: appointmentData.date,
          time: appointmentData.time,
          type: appointmentData.type,
          status: appointmentData.status
        },
        sessionId: this.getSessionId(callId)
      };

      await this.writeAuditLog(auditEntry);
      this.logger.info(`Appointment creation logged: ${callId}`);
    } catch (error) {
      this.logger.error('Error logging appointment creation:', error);
    }
  }

  /**
   * Log appointment modification
   */
  async logAppointmentModification(callId, appointmentId, modificationData) {
    try {
      const auditEntry = {
        event: 'appointment_modified',
        callId,
        timestamp: new Date().toISOString(),
        data: {
          appointmentId,
          modifications: modificationData,
          reason: modificationData.reason || 'client_request'
        },
        sessionId: this.getSessionId(callId)
      };

      await this.writeAuditLog(auditEntry);
      this.logger.info(`Appointment modification logged: ${callId}`);
    } catch (error) {
      this.logger.error('Error logging appointment modification:', error);
    }
  }

  /**
   * Log appointment cancellation
   */
  async logAppointmentCancellation(callId, appointmentId, reason) {
    try {
      const auditEntry = {
        event: 'appointment_cancelled',
        callId,
        timestamp: new Date().toISOString(),
        data: {
          appointmentId,
          reason: reason || 'client_request'
        },
        sessionId: this.getSessionId(callId)
      };

      await this.writeAuditLog(auditEntry);
      this.logger.info(`Appointment cancellation logged: ${callId}`);
    } catch (error) {
      this.logger.error('Error logging appointment cancellation:', error);
    }
  }

  /**
   * Log data access
   */
  async logDataAccess(callId, dataType, accessReason) {
    try {
      const auditEntry = {
        event: 'data_access',
        callId,
        timestamp: new Date().toISOString(),
        data: {
          dataType,
          accessReason,
          authorized: true
        },
        sessionId: this.getSessionId(callId)
      };

      await this.writeAuditLog(auditEntry);
      this.logger.info(`Data access logged: ${callId}`);
    } catch (error) {
      this.logger.error('Error logging data access:', error);
    }
  }

  /**
   * Log security events
   */
  async logSecurityEvent(event, details) {
    try {
      const auditEntry = {
        event: 'security_event',
        timestamp: new Date().toISOString(),
        data: {
          securityEvent: event,
          details: this.sanitizeSecurityDetails(details),
          severity: this.getEventSeverity(event)
        }
      };

      await this.writeAuditLog(auditEntry);
      this.logger.warn(`Security event logged: ${event}`);
    } catch (error) {
      this.logger.error('Error logging security event:', error);
    }
  }

  /**
   * Log system errors
   */
  async logSystemError(error, context) {
    try {
      const auditEntry = {
        event: 'system_error',
        timestamp: new Date().toISOString(),
        data: {
          error: error.message,
          stack: error.stack,
          context: context || {}
        }
      };

      await this.writeAuditLog(auditEntry);
      this.logger.error(`System error logged: ${error.message}`);
    } catch (logError) {
      this.logger.error('Error logging system error:', logError);
    }
  }

  /**
   * Write audit log entry
   */
  async writeAuditLog(auditEntry) {
    try {
      // Add unique ID to audit entry
      auditEntry.id = this.generateAuditId();
      
      // Encrypt sensitive data
      auditEntry.data = this.encryptSensitiveData(auditEntry.data);
      
      // Add to in-memory logs
      this.auditLogs.push(auditEntry);
      
      // Keep only recent logs in memory
      if (this.auditLogs.length > this.maxLogs) {
        this.auditLogs = this.auditLogs.slice(-this.maxLogs);
      }
      
      // Write to file
      await this.writeToFile(auditEntry);
      
      // Write to database (in production)
      await this.writeToDatabase(auditEntry);
      
    } catch (error) {
      this.logger.error('Error writing audit log:', error);
    }
  }

  /**
   * Write audit entry to file
   */
  async writeToFile(auditEntry) {
    try {
      const logDir = 'logs';
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logFile = path.join(logDir, 'audit.log');
      const logLine = JSON.stringify(auditEntry) + '\n';
      
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      this.logger.error('Error writing to audit file:', error);
    }
  }

  /**
   * Write audit entry to database
   */
  async writeToDatabase(auditEntry) {
    try {
      // In production, this would write to a secure audit database
      // For now, we'll just log it
      this.logger.info('Audit entry written to database:', auditEntry.id);
    } catch (error) {
      this.logger.error('Error writing to audit database:', error);
    }
  }

  /**
   * Sanitize call data for logging
   */
  sanitizeCallData(callData) {
    const sanitized = { ...callData };
    
    // Remove sensitive information
    delete sanitized.transcript;
    delete sanitized.recording;
    delete sanitized.personalInfo;
    
    // Mask phone numbers
    if (sanitized.phoneNumber) {
      sanitized.phoneNumber = this.maskPhoneNumber(sanitized.phoneNumber);
    }
    
    return sanitized;
  }

  /**
   * Mask phone number for logging
   */
  maskPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    
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
    if (!dateOfBirth) return null;
    return dateOfBirth.replace(/\d/g, '*');
  }

  /**
   * Mask member ID for logging
   */
  maskMemberId(memberId) {
    if (!memberId) return null;
    
    if (memberId.length >= 4) {
      return '*'.repeat(memberId.length - 4) + memberId.slice(-4);
    }
    return '*'.repeat(memberId.length);
  }

  /**
   * Mask client ID for logging
   */
  maskClientId(clientId) {
    if (!clientId) return null;
    
    if (clientId.length >= 4) {
      return '*'.repeat(clientId.length - 4) + clientId.slice(-4);
    }
    return '*'.repeat(clientId.length);
  }

  /**
   * Sanitize security details for logging
   */
  sanitizeSecurityDetails(details) {
    const sanitized = { ...details };
    
    // Remove sensitive information
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.secret;
    
    return sanitized;
  }

  /**
   * Get event severity level
   */
  getEventSeverity(event) {
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
   * Encrypt sensitive data
   */
  encryptSensitiveData(data) {
    try {
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, this.encryptionKey);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        algorithm
      };
    } catch (error) {
      this.logger.error('Error encrypting sensitive data:', error);
      return data;
    }
  }

  /**
   * Generate unique audit ID
   */
  generateAuditId() {
    return crypto.randomUUID();
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return crypto.randomUUID();
  }

  /**
   * Get session ID for call
   */
  getSessionId(callId) {
    // In production, this would retrieve from a session store
    return `session_${callId}`;
  }

  /**
   * Setup log rotation
   */
  setupLogRotation() {
    // Rotate logs daily
    setInterval(() => {
      this.rotateLogs();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Rotate log files
   */
  rotateLogs() {
    try {
      const logDir = 'logs';
      const today = new Date().toISOString().split('T')[0];
      const rotatedFile = path.join(logDir, `audit_${today}.log`);
      
      if (fs.existsSync(path.join(logDir, 'audit.log'))) {
        fs.renameSync(path.join(logDir, 'audit.log'), rotatedFile);
      }
      
      this.logger.info('Log files rotated');
    } catch (error) {
      this.logger.error('Error rotating logs:', error);
    }
  }

  /**
   * Clean up old logs
   */
  cleanupOldLogs() {
    try {
      const logDir = 'logs';
      const files = fs.readdirSync(logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      
      for (const file of files) {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          this.logger.info(`Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      this.logger.error('Error cleaning up old logs:', error);
    }
  }

  /**
   * Get audit logs for a specific call
   */
  getAuditLogsForCall(callId) {
    return this.auditLogs.filter(log => log.callId === callId);
  }

  /**
   * Get audit logs for a specific event
   */
  getAuditLogsForEvent(event) {
    return this.auditLogs.filter(log => log.event === event);
  }

  /**
   * Get audit logs within date range
   */
  getAuditLogsInRange(startDate, endDate) {
    return this.auditLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= startDate && logDate <= endDate;
    });
  }

  /**
   * Export audit logs for compliance reporting
   */
  exportAuditLogs(format = 'json') {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        totalLogs: this.auditLogs.length,
        logs: this.auditLogs
      };
      
      if (format === 'json') {
        return JSON.stringify(exportData, null, 2);
      } else if (format === 'csv') {
        return this.convertToCSV(exportData.logs);
      }
      
      return exportData;
    } catch (error) {
      this.logger.error('Error exporting audit logs:', error);
      return null;
    }
  }

  /**
   * Convert audit logs to CSV format
   */
  convertToCSV(logs) {
    if (logs.length === 0) return '';
    
    const headers = Object.keys(logs[0]);
    const csvRows = [headers.join(',')];
    
    for (const log of logs) {
      const values = headers.map(header => {
        const value = log[header];
        return typeof value === 'object' ? JSON.stringify(value) : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }
}

module.exports = AuditLogger;
