// Test setup file
const dotenv = require('dotenv');

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.AUDIT_LOG_ENABLED = 'false';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters';
process.env.JWT_SECRET = 'test-jwt-secret';

// Mock external services
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    hget: jest.fn(),
    hset: jest.fn(),
    hdel: jest.fn(),
    hgetall: jest.fn(),
    quit: jest.fn(),
    on: jest.fn()
  }))
}));

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }))
}));

jest.mock('retell-sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    agent: {
      create: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      delete: jest.fn(),
      update: jest.fn()
    },
    call: {
      createPhoneCall: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      delete: jest.fn()
    },
    retellLLM: {
      create: jest.fn()
    }
  }))
}));

// Global test utilities
global.createMockCall = (overrides = {}) => ({
  callId: 'call_001',
  agentId: 'agent_001',
  startTime: new Date().toISOString(),
  endTime: null,
  duration: 0,
  status: 'ongoing',
  transcript: '',
  ...overrides
});

global.createMockClient = (overrides = {}) => ({
  id: 'client_001',
  name: 'John Doe',
  phone: '+19041234567',
  dateOfBirth: '1985-03-15',
  email: 'john.doe@example.com',
  ...overrides
});

global.createMockAppointment = (overrides = {}) => ({
  id: 'apt_001',
  clientId: 'client_001',
  providerId: 'charles_maddix',
  date: '2024-01-15',
  time: '10:30',
  type: 'comprehensive_evaluation',
  status: 'scheduled',
  ...overrides
});

global.createMockInsurance = (overrides = {}) => ({
  provider: 'Blue Cross Blue Shield',
  memberId: 'BC123456789',
  copay: 25,
  deductible: 1000,
  verified: true,
  ...overrides
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
