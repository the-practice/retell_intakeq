# Deployment Guide for Matt Voice Agent

This guide provides step-by-step instructions for deploying the HIPAA-compliant voice agent "Matt" for The Practice psychiatric wellness clinic.

## 🚀 Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ or CentOS 8+
- **RAM**: Minimum 4GB, Recommended 8GB+
- **CPU**: Minimum 2 cores, Recommended 4+ cores
- **Storage**: Minimum 50GB SSD
- **Network**: Stable internet connection with static IP

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git
- SSL certificates
- Domain name (optional but recommended)

## 📋 Pre-Deployment Checklist

### 1. API Credentials
- [ ] Retell AI API key
- [ ] IntakeQ API credentials
- [ ] Availity API credentials
- [ ] Redis password
- [ ] JWT secret (32+ characters)
- [ ] Encryption key (32 characters)

### 2. SSL Certificates
- [ ] SSL certificate (.pem)
- [ ] SSL private key (.pem)
- [ ] Certificate chain (if applicable)

### 3. Environment Configuration
- [ ] Production environment variables
- [ ] Provider schedules configured
- [ ] Insurance providers configured
- [ ] Appointment types configured

## 🔧 Installation Steps

### Step 1: Clone Repository
```bash
git clone https://github.com/your-org/retell_intakeq.git
cd retell_intakeq
```

### Step 2: Configure Environment
```bash
# Copy environment template
cp env.example .env.production

# Edit production environment
nano .env.production
```

### Step 3: Set Up SSL Certificates
```bash
# Create SSL directory
mkdir -p ssl

# Copy your SSL certificates
cp your-cert.pem ssl/cert.pem
cp your-key.pem ssl/key.pem

# Set proper permissions
chmod 600 ssl/key.pem
chmod 644 ssl/cert.pem
```

### Step 4: Configure Provider Schedules
Edit the `PROVIDER_SCHEDULES` environment variable in `.env.production`:

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

### Step 5: Deploy with Docker Compose
```bash
# Deploy production stack
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 6: Verify Deployment
```bash
# Check health endpoint
curl -k https://localhost/health

# Check service logs
docker-compose -f docker-compose.prod.yml logs voice-agent

# Check Redis connection
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

## 🔒 Security Configuration

### 1. Firewall Setup
```bash
# Allow only necessary ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw deny 3000/tcp   # Block direct access to app
ufw deny 6379/tcp   # Block direct access to Redis
ufw deny 9090/tcp   # Block direct access to Prometheus
ufw deny 3001/tcp   # Block direct access to Grafana

# Enable firewall
ufw enable
```

### 2. SSL/TLS Configuration
- Use TLS 1.2+ only
- Enable HSTS headers
- Configure proper cipher suites
- Set up certificate auto-renewal

### 3. Access Control
```bash
# Create monitoring user
htpasswd -c /etc/nginx/.htpasswd monitoring

# Restrict access to monitoring endpoints
# Add to nginx configuration
location /grafana {
    auth_basic "Monitoring";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://grafana:3000;
}
```

## 📊 Monitoring Setup

### 1. Prometheus Configuration
- Access: `https://your-domain.com:9090`
- Default credentials: admin/admin
- Configure alerting rules
- Set up notification channels

### 2. Grafana Configuration
- Access: `https://your-domain.com:3001`
- Default credentials: admin/your-password
- Import dashboards
- Configure data sources

### 3. Log Management
```bash
# Set up log rotation
sudo cp logrotate.conf /etc/logrotate.d/voice-agent

# Configure log shipping (optional)
# Set up ELK stack or similar
```

## 🔄 Maintenance

### Daily Tasks
- [ ] Check service health
- [ ] Review error logs
- [ ] Monitor resource usage
- [ ] Verify backup status

### Weekly Tasks
- [ ] Update dependencies
- [ ] Review security logs
- [ ] Test disaster recovery
- [ ] Performance analysis

### Monthly Tasks
- [ ] Security audit
- [ ] Capacity planning
- [ ] Documentation updates
- [ ] Staff training

## 🚨 Troubleshooting

### Common Issues

#### 1. Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs voice-agent

# Check environment variables
docker-compose -f docker-compose.prod.yml config

# Restart service
docker-compose -f docker-compose.prod.yml restart voice-agent
```

#### 2. Redis Connection Issues
```bash
# Check Redis status
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping

# Check Redis logs
docker-compose -f docker-compose.prod.yml logs redis

# Restart Redis
docker-compose -f docker-compose.prod.yml restart redis
```

#### 3. SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in ssl/cert.pem -text -noout

# Test SSL configuration
openssl s_client -connect your-domain.com:443

# Renew certificate (if using Let's Encrypt)
certbot renew
```

#### 4. Performance Issues
```bash
# Check resource usage
docker stats

# Check cache hit rates
docker-compose -f docker-compose.prod.yml exec redis redis-cli info stats

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale voice-agent=3
```

### Log Analysis
```bash
# View application logs
tail -f logs/combined.log

# View error logs
tail -f logs/error.log

# View audit logs
tail -f logs/audit.log

# Search for specific errors
grep "ERROR" logs/combined.log
```

## 🔄 Updates and Upgrades

### 1. Application Updates
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Verify update
curl -k https://localhost/health
```

### 2. Database Migrations
```bash
# Backup current data
docker-compose -f docker-compose.prod.yml exec redis redis-cli BGSAVE

# Run migrations (if any)
docker-compose -f docker-compose.prod.yml exec voice-agent npm run migrate

# Verify migration
docker-compose -f docker-compose.prod.yml exec voice-agent npm run migrate:status
```

### 3. Configuration Updates
```bash
# Update environment variables
nano .env.production

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Verify configuration
curl -k https://localhost/health
```

## 📞 Support

### Emergency Contacts
- **Technical Support**: tech@thepractice.com
- **On-Call Engineer**: +1-XXX-XXX-XXXX
- **Practice Manager**: manager@thepractice.com

### Escalation Procedures
1. **Level 1**: Check logs and restart services
2. **Level 2**: Contact technical support
3. **Level 3**: Escalate to on-call engineer
4. **Level 4**: Contact practice manager

### Documentation
- [System Architecture](README.md#architecture)
- [API Reference](README.md#api-reference)
- [Security Guide](README.md#security--compliance)
- [Troubleshooting Guide](README.md#troubleshooting)

## ✅ Post-Deployment Checklist

### Functional Testing
- [ ] Health endpoint responds
- [ ] Client verification works
- [ ] Insurance verification works
- [ ] Appointment scheduling works
- [ ] Webhook endpoints respond
- [ ] Cache system functions
- [ ] Audit logging works

### Security Testing
- [ ] SSL certificates valid
- [ ] Firewall rules active
- [ ] Access controls working
- [ ] Data encryption active
- [ ] Audit logs generated
- [ ] Rate limiting active

### Performance Testing
- [ ] Response times < 1ms (cached)
- [ ] Response times < 5s (uncached)
- [ ] Memory usage < 80%
- [ ] CPU usage < 80%
- [ ] Disk usage < 80%
- [ ] Network latency < 100ms

### Monitoring Setup
- [ ] Prometheus collecting metrics
- [ ] Grafana dashboards configured
- [ ] Alerting rules active
- [ ] Log rotation working
- [ ] Backup system active
- [ ] Disaster recovery tested

---

**Deployment completed successfully! 🎉**

The Matt voice agent is now ready to serve The Practice psychiatric wellness clinic with HIPAA-compliant appointment scheduling.
