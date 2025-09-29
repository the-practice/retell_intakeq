const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const winston = require('winston');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');

// Load environment variables
dotenv.config();

// Import modules
const RetellAgent = require('./agents/retellAgent');
const IntakeQService = require('./services/intakeqService');
const AvailityService = require('./services/availityService');
const CacheService = require('./services/cacheService');
const VerificationService = require('./services/verificationService');
const ConversationFlow = require('./flows/conversationFlow');
const SecurityMiddleware = require('./middleware/security');
const AuditLogger = require('./utils/auditLogger');

class VoiceAgentApp {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    this.logger = this.setupLogger();
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupLogger() {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
      ]
    });
  }

  initializeServices() {
    try {
      this.cacheService = new CacheService();
      this.intakeqService = new IntakeQService();
      this.availityService = new AvailityService();
      this.verificationService = new VerificationService();
      this.conversationFlow = new ConversationFlow();
      this.retellAgent = new RetellAgent();
      this.auditLogger = new AuditLogger();
      
      this.logger.info('All services initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", "wss:", "https://api.retellai.com", "https://api.intakeq.com", "https://api.availity.com"]
        }
      }
    }));

    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' ? false : true,
      credentials: true
    }));

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // HIPAA compliance middleware
    this.app.use(SecurityMiddleware.encryptSensitiveData);
    this.app.use(SecurityMiddleware.auditLogging);
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        services: {
          cache: this.cacheService.isConnected(),
          intakeq: this.intakeqService.isConnected(),
          availity: this.availityService.isConnected()
        }
      });
    });

    // Retell AI webhook endpoints
    this.app.post('/webhook/retell', async (req, res) => {
      try {
        const { call_id, event_type, data } = req.body;
        this.logger.info(`Retell webhook received: ${event_type} for call ${call_id}`);
        
        await this.handleRetellWebhook(call_id, event_type, data);
        res.json({ success: true });
      } catch (error) {
        this.logger.error('Error handling Retell webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // IntakeQ webhook endpoints
    this.app.post('/webhook/intakeq', async (req, res) => {
      try {
        const { event, data } = req.body;
        this.logger.info(`IntakeQ webhook received: ${event}`);
        
        await this.handleIntakeQWebhook(event, data);
        res.json({ success: true });
      } catch (error) {
        this.logger.error('Error handling IntakeQ webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Custom function endpoints for Retell AI
    this.app.post('/functions/verify-client', async (req, res) => {
      try {
        const { call, args } = req.body;
        const result = await this.verificationService.verifyClient(args.phoneNumber, args.dateOfBirth);
        res.json(result);
      } catch (error) {
        this.logger.error('Error in verify-client function:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/functions/check-insurance', async (req, res) => {
      try {
        const { call, args } = req.body;
        const result = await this.availityService.verifyInsurance(args.insuranceInfo);
        res.json(result);
      } catch (error) {
        this.logger.error('Error in check-insurance function:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/functions/schedule-appointment', async (req, res) => {
      try {
        const { call, args } = req.body;
        const result = await this.scheduleAppointment(args);
        res.json(result);
      } catch (error) {
        this.logger.error('Error in schedule-appointment function:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/functions/get-availability', async (req, res) => {
      try {
        const { call, args } = req.body;
        const result = await this.getAvailability(args);
        res.json(result);
      } catch (error) {
        this.logger.error('Error in get-availability function:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      this.logger.info('WebSocket connection established');
      
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          await this.handleWebSocketMessage(ws, data);
        } catch (error) {
          this.logger.error('Error handling WebSocket message:', error);
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        this.logger.info('WebSocket connection closed');
      });
    });
  }

  async handleRetellWebhook(callId, eventType, data) {
    switch (eventType) {
      case 'call_started':
        await this.auditLogger.logCallStart(callId, data);
        break;
      case 'call_ended':
        await this.auditLogger.logCallEnd(callId, data);
        break;
      case 'transcript_updated':
        await this.cacheService.updateCallTranscript(callId, data.transcript);
        break;
      default:
        this.logger.info(`Unhandled Retell event: ${eventType}`);
    }
  }

  async handleIntakeQWebhook(event, data) {
    switch (event) {
      case 'appointment_created':
      case 'appointment_updated':
      case 'appointment_cancelled':
        await this.cacheService.invalidateAppointmentCache(data);
        break;
      case 'client_updated':
        await this.cacheService.invalidateClientCache(data.clientId);
        break;
      default:
        this.logger.info(`Unhandled IntakeQ event: ${event}`);
    }
  }

  async handleWebSocketMessage(ws, data) {
    const { type, payload } = data;
    
    switch (type) {
      case 'get_availability':
        const availability = await this.getAvailability(payload);
        ws.send(JSON.stringify({ type: 'availability', data: availability }));
        break;
      case 'schedule_appointment':
        const result = await this.scheduleAppointment(payload);
        ws.send(JSON.stringify({ type: 'appointment_result', data: result }));
        break;
      default:
        ws.send(JSON.stringify({ error: 'Unknown message type' }));
    }
  }

  async scheduleAppointment(args) {
    try {
      // Use write-behind cache for performance
      const cacheKey = `appointment:${args.clientId}:${args.dateTime}`;
      
      // Check cache first
      let appointment = await this.cacheService.get(cacheKey);
      
      if (!appointment) {
        // Create appointment in IntakeQ
        appointment = await this.intakeqService.createAppointment(args);
        
        // Cache the result
        await this.cacheService.set(cacheKey, appointment, 3600); // 1 hour TTL
      }
      
      return { success: true, appointment };
    } catch (error) {
      this.logger.error('Error scheduling appointment:', error);
      throw error;
    }
  }

  async getAvailability(args) {
    try {
      const cacheKey = `availability:${args.providerId}:${args.date}`;
      
      // Check cache first
      let availability = await this.cacheService.get(cacheKey);
      
      if (!availability) {
        // Get availability from IntakeQ
        availability = await this.intakeqService.getProviderAvailability(args);
        
        // Cache the result
        await this.cacheService.set(cacheKey, availability, 300); // 5 minutes TTL
      }
      
      return availability;
    } catch (error) {
      this.logger.error('Error getting availability:', error);
      throw error;
    }
  }

  async start() {
    try {
      const port = process.env.PORT || 3000;
      
      // Initialize cache connection
      await this.cacheService.connect();
      
      // Start server
      this.server.listen(port, () => {
        this.logger.info(`Voice Agent Matt server running on port ${port}`);
        this.logger.info('HIPAA-compliant voice agent ready for The Practice');
      });
      
    } catch (error) {
      this.logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the application
if (require.main === module) {
  const app = new VoiceAgentApp();
  app.start().catch(error => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

module.exports = VoiceAgentApp;
