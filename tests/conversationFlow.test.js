const ConversationFlow = require('../src/flows/conversationFlow');

describe('ConversationFlow', () => {
  let conversationFlow;

  beforeEach(() => {
    conversationFlow = new ConversationFlow();
  });

  afterEach(() => {
    // Clean up conversation states
    conversationFlow.conversationStates.clear();
  });

  describe('initializeConversation', () => {
    it('should initialize conversation state for a new call', () => {
      const callId = 'call_001';
      const state = conversationFlow.initializeConversation(callId);
      
      expect(state).toBeDefined();
      expect(state.callId).toBe(callId);
      expect(state.step).toBe('greeting');
      expect(state.clientVerified).toBe(false);
      expect(state.conversationHistory).toEqual([]);
    });
  });

  describe('processMessage', () => {
    it('should handle greeting and detect intent', async () => {
      const callId = 'call_001';
      conversationFlow.initializeConversation(callId);
      
      const response = await conversationFlow.processMessage(callId, 'I want to schedule an appointment');
      
      expect(response).toBeDefined();
      expect(response.message).toContain('Matt from The Practice');
      expect(response.requiresVerification).toBe(true);
    });

    it('should handle verification step', async () => {
      const callId = 'call_001';
      conversationFlow.initializeConversation(callId);
      conversationFlow.updateConversationState(callId, { step: 'verification' });
      
      const response = await conversationFlow.processMessage(callId, 'My phone is 904-123-4567 and DOB is 03/15/1985');
      
      expect(response).toBeDefined();
      expect(response.message).toContain('Thank you');
    });

    it('should handle appointment type selection', async () => {
      const callId = 'call_001';
      conversationFlow.initializeConversation(callId);
      conversationFlow.updateConversationState(callId, { 
        step: 'appointment_type',
        clientVerified: true,
        clientInfo: { name: 'John Doe' }
      });
      
      const response = await conversationFlow.processMessage(callId, 'I need a comprehensive evaluation');
      
      expect(response).toBeDefined();
      expect(response.message).toContain('comprehensive evaluation');
    });
  });

  describe('detectIntent', () => {
    it('should detect schedule intent', () => {
      const intent = conversationFlow.detectIntent('I want to schedule an appointment');
      expect(intent).toBe('schedule');
    });

    it('should detect reschedule intent', () => {
      const intent = conversationFlow.detectIntent('I need to reschedule my appointment');
      expect(intent).toBe('reschedule');
    });

    it('should detect cancel intent', () => {
      const intent = conversationFlow.detectIntent('I want to cancel my appointment');
      expect(intent).toBe('cancel');
    });

    it('should return general for unclear intent', () => {
      const intent = conversationFlow.detectIntent('Hello, how are you?');
      expect(intent).toBe('general');
    });
  });

  describe('extractVerificationData', () => {
    it('should extract phone number and date of birth', () => {
      const message = 'My phone is 904-123-4567 and DOB is 03/15/1985';
      const data = conversationFlow.extractVerificationData(message);
      
      expect(data.phoneNumber).toBe('904-123-4567');
      expect(data.dateOfBirth).toBe('03/15/1985');
    });

    it('should handle various phone number formats', () => {
      const message = 'My phone is (904) 123-4567 and DOB is 03/15/1985';
      const data = conversationFlow.extractVerificationData(message);
      
      expect(data.phoneNumber).toBe('(904) 123-4567');
      expect(data.dateOfBirth).toBe('03/15/1985');
    });

    it('should return null for missing data', () => {
      const message = 'I want to schedule an appointment';
      const data = conversationFlow.extractVerificationData(message);
      
      expect(data.phoneNumber).toBeNull();
      expect(data.dateOfBirth).toBeNull();
    });
  });

  describe('detectAppointmentType', () => {
    it('should detect comprehensive evaluation', () => {
      const type = conversationFlow.detectAppointmentType('I need a comprehensive evaluation');
      expect(type).toBe('comprehensive_evaluation');
    });

    it('should detect follow-up', () => {
      const type = conversationFlow.detectAppointmentType('I need a follow-up appointment');
      expect(type).toBe('follow_up');
    });

    it('should detect ketamine consultation', () => {
      const type = conversationFlow.detectAppointmentType('I need a ketamine consultation');
      expect(type).toBe('ketamine_consultation');
    });

    it('should return null for unclear type', () => {
      const type = conversationFlow.detectAppointmentType('I need an appointment');
      expect(type).toBeNull();
    });
  });

  describe('getAvailableProviders', () => {
    it('should return providers for comprehensive evaluation', () => {
      const providers = conversationFlow.getAvailableProviders('comprehensive_evaluation');
      
      expect(providers).toBeDefined();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should return providers for follow-up', () => {
      const providers = conversationFlow.getAvailableProviders('follow_up');
      
      expect(providers).toBeDefined();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should include Dr. Soto for follow-ups only', () => {
      const providers = conversationFlow.getAvailableProviders('follow_up');
      const drSoto = providers.find(p => p.id === 'dr_soto');
      
      expect(drSoto).toBeDefined();
    });
  });

  describe('detectProviderSelection', () => {
    it('should detect provider by name', () => {
      const providers = conversationFlow.getAvailableProviders('comprehensive_evaluation');
      const selected = conversationFlow.detectProviderSelection('I want to see Charles Maddix', 'comprehensive_evaluation');
      
      expect(selected).toBeDefined();
      expect(selected.name).toBe('Charles Maddix');
    });

    it('should detect provider by ID', () => {
      const providers = conversationFlow.getAvailableProviders('comprehensive_evaluation');
      const selected = conversationFlow.detectProviderSelection('I want to see charles_maddix', 'comprehensive_evaluation');
      
      expect(selected).toBeDefined();
      expect(selected.id).toBe('charles_maddix');
    });

    it('should return null for unknown provider', () => {
      const selected = conversationFlow.detectProviderSelection('I want to see Dr. Unknown', 'comprehensive_evaluation');
      expect(selected).toBeNull();
    });
  });

  describe('getAvailableDates', () => {
    it('should return available dates for a provider', () => {
      const provider = { id: 'charles_maddix', schedule: { monday: { start: '10:30', end: '18:00' } } };
      const dates = conversationFlow.getAvailableDates(provider);
      
      expect(dates).toBeDefined();
      expect(Array.isArray(dates)).toBe(true);
      expect(dates.length).toBeGreaterThan(0);
    });
  });

  describe('detectDateSelection', () => {
    it('should detect date in MM/DD/YYYY format', () => {
      const date = conversationFlow.detectDateSelection('I want to schedule for 01/15/2024');
      expect(date).toBe('2024-01-15');
    });

    it('should detect date in YYYY-MM-DD format', () => {
      const date = conversationFlow.detectDateSelection('I want to schedule for 2024-01-15');
      expect(date).toBe('2024-01-15');
    });

    it('should return null for invalid date', () => {
      const date = conversationFlow.detectDateSelection('I want to schedule for invalid date');
      expect(date).toBeNull();
    });
  });

  describe('detectTimeSelection', () => {
    it('should detect time in HH:MM format', () => {
      const time = conversationFlow.detectTimeSelection('I want to schedule for 10:30');
      expect(time).toBe('10:30');
    });

    it('should detect time with AM/PM', () => {
      const time = conversationFlow.detectTimeSelection('I want to schedule for 10:30 AM');
      expect(time).toBe('10:30 AM');
    });

    it('should return null for invalid time', () => {
      const time = conversationFlow.detectTimeSelection('I want to schedule for invalid time');
      expect(time).toBeNull();
    });
  });

  describe('extractInsuranceInfo', () => {
    it('should extract insurance provider', () => {
      const info = conversationFlow.extractInsuranceInfo('I have Blue Cross Blue Shield insurance');
      expect(info.provider).toBe('blue cross blue shield');
    });

    it('should return null for unknown provider', () => {
      const info = conversationFlow.extractInsuranceInfo('I have unknown insurance');
      expect(info.provider).toBeNull();
    });
  });

  describe('isAcceptedInsurance', () => {
    it('should accept Blue Cross Blue Shield', () => {
      const accepted = conversationFlow.isAcceptedInsurance('Blue Cross Blue Shield');
      expect(accepted).toBe(true);
    });

    it('should accept Aetna', () => {
      const accepted = conversationFlow.isAcceptedInsurance('Aetna');
      expect(accepted).toBe(true);
    });

    it('should reject unknown insurance', () => {
      const accepted = conversationFlow.isAcceptedInsurance('Unknown Insurance');
      expect(accepted).toBe(false);
    });
  });

  describe('detectConfirmation', () => {
    it('should detect yes confirmation', () => {
      const confirmation = conversationFlow.detectConfirmation('Yes, that is correct');
      expect(confirmation).toBe('yes');
    });

    it('should detect no confirmation', () => {
      const confirmation = conversationFlow.detectConfirmation('No, that is not correct');
      expect(confirmation).toBe('no');
    });

    it('should return null for unclear confirmation', () => {
      const confirmation = conversationFlow.detectConfirmation('I am not sure');
      expect(confirmation).toBeNull();
    });
  });

  describe('updateConversationState', () => {
    it('should update conversation state', () => {
      const callId = 'call_001';
      conversationFlow.initializeConversation(callId);
      
      conversationFlow.updateConversationState(callId, { step: 'verification' });
      
      const state = conversationFlow.getConversationState(callId);
      expect(state.step).toBe('verification');
    });
  });

  describe('addToHistory', () => {
    it('should add message to conversation history', () => {
      const callId = 'call_001';
      conversationFlow.initializeConversation(callId);
      
      conversationFlow.addToHistory(callId, 'user', 'Hello');
      conversationFlow.addToHistory(callId, 'agent', 'Hi there!');
      
      const state = conversationFlow.getConversationState(callId);
      expect(state.conversationHistory.length).toBe(2);
      expect(state.conversationHistory[0].role).toBe('user');
      expect(state.conversationHistory[1].role).toBe('agent');
    });
  });

  describe('cleanupConversation', () => {
    it('should clean up conversation state', () => {
      const callId = 'call_001';
      conversationFlow.initializeConversation(callId);
      
      expect(conversationFlow.conversationStates.has(callId)).toBe(true);
      
      conversationFlow.cleanupConversation(callId);
      
      expect(conversationFlow.conversationStates.has(callId)).toBe(false);
    });
  });
});
