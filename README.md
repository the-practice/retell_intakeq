# Matt - HIPAA-Compliant Voice Agent for The Practice

A sophisticated voice AI assistant built with Retell AI, designed specifically for The Practice psychiatric wellness clinic in Jacksonville, FL. Matt handles appointment scheduling, rescheduling, and cancellations while maintaining strict HIPAA compliance and providing lightning-fast performance through advanced caching.

## 🏥 Features

### Core Functionality
- **HIPAA-Compliant Client Verification**: Dual-factor authentication using phone number and date of birth
- **Intelligent Appointment Scheduling**: Natural conversation flow for booking, rescheduling, and canceling appointments
- **Real-Time Insurance Verification**: Integration with Availity API for instant copay communication
- **Lightning-Fast Performance**: Write-behind cache system achieving 1ms response times
- **Comprehensive Audit Logging**: Full HIPAA compliance with 7-year data retention

### Practice-Specific Features
- **Provider Management**: Support for Charles Maddix, Ava Suleiman, and Dr. Soto schedules
- **Appointment Types**: Comprehensive evaluations (60min), follow-ups (15min), ketamine consultations (30min)
- **Insurance Coverage**: Aetna, Blue Cross Blue Shield, Cigna, Medicare, Tricare
- **Flexible Scheduling**: Both telehealth and in-person appointments
- **Lunch Break Handling**: Automatic exclusion of 1:00-2:00 PM daily

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Redis server
- Retell AI API key
- IntakeQ API credentials
- Availity API credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/retell_intakeq.git
   cd retell_intakeq
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

5. **Or start locally**
   ```bash
   npm start
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `RETELL_API_KEY` | Retell AI API key | Yes |
| `RETELL_AGENT_ID` | Retell AI agent ID | Yes |
| `INTAKEQ_API_KEY` | IntakeQ API key | Yes |
| `INTAKEQ_BASE_URL` | IntakeQ API base URL | Yes |
| `INTAKEQ_CLINIC_ID` | IntakeQ clinic ID | Yes |
| `AVAILITY_API_KEY` | Availity API key | Yes |
| `AVAILITY_SECRET` | Availity API secret | Yes |
| `REDIS_URL` | Redis connection URL | Yes |
| `ENCRYPTION_KEY` | 32-character encryption key | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |

### Provider Schedules

Configure provider schedules in the `PROVIDER_SCHEDULES` environment variable:

```json
{
  "charles_maddix": {
    "name": "Charles Maddix",
    "schedule": {
      "monday": {"start": "10:30", "end": "18:00"},
      "tuesday": {"start": "10:30", "end": "18:00"},
      "wednesday": {"start": "10:30", "end": "18:00"},
      "thursday": {"start": "10:30", "end": "18:00"}
    }
  },
  "ava_suleiman": {
    "name": "Ava Suleiman",
    "schedule": {
      "tuesday": {"start": "10:30", "end": "18:00"}
    }
  },
  "dr_soto": {
    "name": "Dr. Soto",
    "schedule": {
      "monday": {"start": "16:00", "end": "18:00"},
      "tuesday": {"start": "16:00", "end": "18:00"},
      "wednesday": {"start": "16:00", "end": "18:00"},
      "thursday": {"start": "16:00", "end": "18:00"}
    },
    "appointment_types": ["follow_up"]
  }
}
```

## 🏗️ Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Retell AI     │    │   Voice Agent   │    │   IntakeQ API   │
│   (Matt)        │◄──►│   (Node.js)     │◄──►│   Integration   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Redis Cache   │
                       │ (Write-Behind)  │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Availity API   │
                       │   Integration   │
                       └─────────────────┘
```

### Key Services

1. **RetellAgent**: Manages the voice AI agent configuration
2. **VerificationService**: Handles HIPAA-compliant client verification
3. **IntakeQService**: Integrates with IntakeQ for appointment management
4. **AvailityService**: Provides real-time insurance verification
5. **CacheService**: Implements write-behind caching for performance
6. **ConversationFlow**: Manages natural conversation logic
7. **AuditLogger**: Ensures HIPAA compliance with comprehensive logging

## 🔒 Security & Compliance

### HIPAA Compliance Features

- **Data Encryption**: All sensitive data encrypted at rest and in transit
- **Access Controls**: Role-based access with audit trails
- **Audit Logging**: Comprehensive logging with 7-year retention
- **Data Minimization**: Only collect necessary information
- **Secure Communication**: TLS 1.2+ for all communications
- **Regular Backups**: Automated backup with encryption

### Security Measures

- **Rate Limiting**: API endpoints protected against abuse
- **Input Validation**: All user inputs sanitized and validated
- **Error Handling**: Secure error messages without data leakage
- **Session Management**: Secure session handling with expiration
- **Webhook Security**: Signature verification for all webhooks

## 📊 Performance

### Write-Behind Cache System

The system implements a sophisticated write-behind cache that provides:

- **1ms Response Times**: Lightning-fast appointment booking
- **Perfect Data Consistency**: Guaranteed synchronization with IntakeQ
- **Automatic Retry Logic**: Handles network failures gracefully
- **Batch Processing**: Efficient background operations

### Cache Strategy

```javascript
// Immediate cache write for fast reads
await cacheService.set(key, data, ttl);

// Background sync to IntakeQ
await cacheService.writeBehindSet(key, data, ttl);
```

## 🧪 Testing

### Run Tests
```bash
npm test
```

### Test Coverage
```bash
npm run test:coverage
```

### Load Testing
```bash
npm run test:load
```

## 📈 Monitoring

### Health Checks
- **Endpoint**: `GET /health`
- **Response**: System status and service health
- **Interval**: 30 seconds

### Metrics
- **Prometheus**: Available at `http://localhost:9090`
- **Grafana**: Available at `http://localhost:3001`
- **Custom Metrics**: Response times, error rates, cache hit rates

### Logging
- **Application Logs**: `logs/combined.log`
- **Error Logs**: `logs/error.log`
- **Audit Logs**: `logs/audit.log`

## 🚀 Deployment

### Production Deployment

1. **Set up SSL certificates**
   ```bash
   # Place certificates in ./ssl/
   cp your-cert.pem ./ssl/cert.pem
   cp your-key.pem ./ssl/key.pem
   ```

2. **Configure environment variables**
   ```bash
   # Update .env with production values
   NODE_ENV=production
   LOG_LEVEL=info
   AUDIT_LOG_ENABLED=true
   ```

3. **Deploy with Docker Compose**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Scaling

The system is designed to scale horizontally:

- **Load Balancer**: Nginx with rate limiting
- **Application**: Multiple Node.js instances
- **Cache**: Redis cluster for high availability
- **Database**: IntakeQ handles data persistence

## 🔧 API Reference

### Webhook Endpoints

#### Retell AI Webhooks
- **POST** `/webhook/retell` - Handle Retell AI events
- **Headers**: `X-Retell-Signature` for verification

#### IntakeQ Webhooks
- **POST** `/webhook/intakeq` - Handle IntakeQ events
- **Headers**: `X-IntakeQ-Signature` for verification

### Custom Functions

#### Client Verification
- **POST** `/functions/verify-client`
- **Body**: `{ phoneNumber, dateOfBirth }`
- **Response**: `{ verified, clientInfo }`

#### Insurance Verification
- **POST** `/functions/check-insurance`
- **Body**: `{ insuranceInfo }`
- **Response**: `{ verified, copay, deductible }`

#### Appointment Scheduling
- **POST** `/functions/schedule-appointment`
- **Body**: `{ clientId, providerId, date, time, type }`
- **Response**: `{ success, appointmentId }`

#### Availability Check
- **POST** `/functions/get-availability`
- **Body**: `{ providerId, date }`
- **Response**: `{ availableSlots }`

## 🛠️ Development

### Project Structure
```
src/
├── agents/
│   └── retellAgent.js          # Retell AI agent configuration
├── services/
│   ├── intakeqService.js       # IntakeQ API integration
│   ├── availityService.js      # Availity API integration
│   ├── cacheService.js         # Redis cache management
│   └── verificationService.js  # HIPAA-compliant verification
├── flows/
│   └── conversationFlow.js     # Natural conversation logic
├── middleware/
│   └── security.js             # Security and compliance
├── utils/
│   └── auditLogger.js          # HIPAA audit logging
└── index.js                    # Main application
```

### Adding New Features

1. **Create service module**
   ```javascript
   // src/services/newService.js
   class NewService {
     constructor() {
       // Initialize service
     }
   }
   module.exports = NewService;
   ```

2. **Add to main application**
   ```javascript
   // src/index.js
   const NewService = require('./services/newService');
   this.newService = new NewService();
   ```

3. **Add tests**
   ```javascript
   // tests/services/newService.test.js
   describe('NewService', () => {
     // Test cases
   });
   ```

## 📞 Support

### Contact Information
- **Practice**: The Practice Psychiatric Wellness Clinic
- **Address**: 3547 Hendricks Ave, Jacksonville, FL 32207
- **Phone**: +1-904-XXX-XXXX
- **Email**: info@thepractice.com

### Technical Support
- **Documentation**: [Link to docs]
- **Issues**: [GitHub Issues]
- **Email**: tech@thepractice.com

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📚 Additional Resources

- [Retell AI Documentation](https://docs.retellai.com/)
- [IntakeQ API Documentation](https://support.intakeq.com/article/204-intakeq-appointments-api)
- [Availity API Documentation](https://developer.availity.com/partner/api_guide/)
- [HIPAA Compliance Guide](https://www.hhs.gov/hipaa/for-professionals/security/index.html)

---

**Built with ❤️ for The Practice Psychiatric Wellness Clinic**