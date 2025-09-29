const winston = require('winston');
const moment = require('moment');

class ConversationFlow {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()]
    });

    this.conversationStates = new Map();
    this.providerSchedules = JSON.parse(process.env.PROVIDER_SCHEDULES || '{}');
    this.appointmentTypes = JSON.parse(process.env.APPOINTMENT_TYPES || '{}');
    this.lunchBreakStart = process.env.LUNCH_BREAK_START || '13:00';
    this.lunchBreakEnd = process.env.LUNCH_BREAK_END || '14:00';
  }

  /**
   * Initialize conversation state for a new call
   */
  initializeConversation(callId) {
    const state = {
      callId,
      step: 'greeting',
      clientVerified: false,
      clientInfo: null,
      insuranceVerified: false,
      insuranceInfo: null,
      appointmentType: null,
      preferredProvider: null,
      preferredDate: null,
      preferredTime: null,
      availableSlots: [],
      selectedSlot: null,
      conversationHistory: [],
      startTime: new Date(),
      lastActivity: new Date()
    };

    this.conversationStates.set(callId, state);
    this.logger.info(`Conversation initialized for call: ${callId}`);
    return state;
  }

  /**
   * Get conversation state for a call
   */
  getConversationState(callId) {
    return this.conversationStates.get(callId);
  }

  /**
   * Update conversation state
   */
  updateConversationState(callId, updates) {
    const state = this.conversationStates.get(callId);
    if (state) {
      Object.assign(state, updates);
      state.lastActivity = new Date();
      this.conversationStates.set(callId, state);
    }
  }

  /**
   * Add to conversation history
   */
  addToHistory(callId, role, content) {
    const state = this.conversationStates.get(callId);
    if (state) {
      state.conversationHistory.push({
        role,
        content,
        timestamp: new Date().toISOString()
      });
      this.conversationStates.set(callId, state);
    }
  }

  /**
   * Process incoming message and determine next response
   */
  async processMessage(callId, userMessage) {
    try {
      const state = this.getConversationState(callId);
      if (!state) {
        this.logger.error(`No conversation state found for call: ${callId}`);
        return this.getErrorResponse();
      }

      // Add user message to history
      this.addToHistory(callId, 'user', userMessage);

      // Process based on current step
      let response;
      switch (state.step) {
        case 'greeting':
          response = await this.handleGreeting(callId, userMessage);
          break;
        case 'verification':
          response = await this.handleVerification(callId, userMessage);
          break;
        case 'appointment_type':
          response = await this.handleAppointmentType(callId, userMessage);
          break;
        case 'provider_selection':
          response = await this.handleProviderSelection(callId, userMessage);
          break;
        case 'date_selection':
          response = await this.handleDateSelection(callId, userMessage);
          break;
        case 'time_selection':
          response = await this.handleTimeSelection(callId, userMessage);
          break;
        case 'insurance_verification':
          response = await this.handleInsuranceVerification(callId, userMessage);
          break;
        case 'confirmation':
          response = await this.handleConfirmation(callId, userMessage);
          break;
        case 'rescheduling':
          response = await this.handleRescheduling(callId, userMessage);
          break;
        case 'cancellation':
          response = await this.handleCancellation(callId, userMessage);
          break;
        default:
          response = await this.handleGeneralInquiry(callId, userMessage);
      }

      // Add agent response to history
      this.addToHistory(callId, 'agent', response.message);

      return response;
    } catch (error) {
      this.logger.error(`Error processing message for call ${callId}:`, error);
      return this.getErrorResponse();
    }
  }

  /**
   * Handle greeting and initial contact
   */
  async handleGreeting(callId, userMessage) {
    
    // Check if user is asking to schedule, reschedule, or cancel
    const intent = this.detectIntent(userMessage);
    
    if (intent === 'schedule') {
      this.updateConversationState(callId, { step: 'verification' });
      return {
        message: "Hello! I'm Matt from The Practice psychiatric wellness clinic. I'd be happy to help you schedule an appointment. For your security and HIPAA compliance, I need to verify your identity. Could you please provide your phone number and date of birth?",
        nextStep: 'verification',
        requiresVerification: true
      };
    } else if (intent === 'reschedule') {
      this.updateConversationState(callId, { step: 'verification' });
      return {
        message: "Hello! I'm Matt from The Practice. I can help you reschedule your appointment. For your security, I need to verify your identity first. Could you please provide your phone number and date of birth?",
        nextStep: 'verification',
        requiresVerification: true
      };
    } else if (intent === 'cancel') {
      this.updateConversationState(callId, { step: 'verification' });
      return {
        message: "Hello! I'm Matt from The Practice. I can help you cancel your appointment. For your security, I need to verify your identity first. Could you please provide your phone number and date of birth?",
        nextStep: 'verification',
        requiresVerification: true
      };
    } else {
      return {
        message: "Hello! I'm Matt from The Practice psychiatric wellness clinic. How can I help you today? I can assist with scheduling, rescheduling, or canceling appointments.",
        nextStep: 'greeting',
        options: ['Schedule appointment', 'Reschedule appointment', 'Cancel appointment']
      };
    }
  }

  /**
   * Handle client verification
   */
  async handleVerification(callId, userMessage) {
    
    // Extract phone number and date of birth from user message
    const verificationData = this.extractVerificationData(userMessage);
    
    if (!verificationData.phoneNumber || !verificationData.dateOfBirth) {
      return {
        message: "I need both your phone number and date of birth to verify your identity. Please provide both pieces of information.",
        nextStep: 'verification',
        requiresVerification: true
      };
    }

    // This would call the verification service
    // For now, we'll simulate verification
    const verificationResult = await this.simulateVerification(verificationData);
    
    if (verificationResult.verified) {
      this.updateConversationState(callId, {
        clientVerified: true,
        clientInfo: verificationResult.clientInfo,
        step: 'appointment_type'
      });
      
      return {
        message: `Thank you, ${verificationResult.clientInfo.name}. I've verified your identity. What type of appointment would you like to schedule?`,
        nextStep: 'appointment_type',
        clientInfo: verificationResult.clientInfo,
        options: ['Comprehensive evaluation (60 minutes)', 'Follow-up (15 minutes)', 'Ketamine consultation (30 minutes)']
      };
    } else {
      return {
        message: "I'm sorry, but I couldn't verify your identity with the information provided. For your security, I cannot access your information. Would you like me to transfer you to our front desk?",
        nextStep: 'verification_failed',
        requiresTransfer: true
      };
    }
  }

  /**
   * Handle appointment type selection
   */
  async handleAppointmentType(callId, userMessage) {
    const appointmentType = this.detectAppointmentType(userMessage);
    
    if (!appointmentType) {
      return {
        message: "I didn't catch that. What type of appointment would you like? You can choose from: Comprehensive evaluation (60 minutes), Follow-up (15 minutes), or Ketamine consultation (30 minutes).",
        nextStep: 'appointment_type',
        options: ['Comprehensive evaluation', 'Follow-up', 'Ketamine consultation']
      };
    }

    this.updateConversationState(callId, {
      appointmentType,
      step: 'provider_selection'
    });

    const availableProviders = this.getAvailableProviders(appointmentType);
    
    return {
      message: `Great! You've selected a ${appointmentType}. Which provider would you prefer?`,
      nextStep: 'provider_selection',
      appointmentType,
      providers: availableProviders,
      options: availableProviders.map(p => p.name)
    };
  }

  /**
   * Handle provider selection
   */
  async handleProviderSelection(callId, userMessage) {
    const state = this.getConversationState(callId);
    const selectedProvider = this.detectProviderSelection(userMessage, state.appointmentType);
    
    if (!selectedProvider) {
      const availableProviders = this.getAvailableProviders(state.appointmentType);
      return {
        message: "I didn't catch that. Which provider would you prefer?",
        nextStep: 'provider_selection',
        providers: availableProviders,
        options: availableProviders.map(p => p.name)
      };
    }

    this.updateConversationState(callId, {
      preferredProvider: selectedProvider,
      step: 'date_selection'
    });

    const availableDates = this.getAvailableDates(selectedProvider);
    
    return {
      message: `Perfect! You've selected ${selectedProvider.name}. What date would work best for you?`,
      nextStep: 'date_selection',
      provider: selectedProvider,
      availableDates,
      options: availableDates.slice(0, 5) // Show next 5 available dates
    };
  }

  /**
   * Handle date selection
   */
  async handleDateSelection(callId, userMessage) {
    const state = this.getConversationState(callId);
    const selectedDate = this.detectDateSelection(userMessage);
    
    if (!selectedDate) {
      const availableDates = this.getAvailableDates(state.preferredProvider);
      return {
        message: "I didn't catch that date. What date would work best for you?",
        nextStep: 'date_selection',
        availableDates,
        options: availableDates.slice(0, 5)
      };
    }

    this.updateConversationState(callId, {
      preferredDate: selectedDate,
      step: 'time_selection'
    });

    const availableTimes = await this.getAvailableTimes(state.preferredProvider, selectedDate, state.appointmentType);
    
    return {
      message: `Great! You've selected ${selectedDate}. What time would work best for you?`,
      nextStep: 'time_selection',
      date: selectedDate,
      availableTimes,
      options: availableTimes.slice(0, 5) // Show next 5 available times
    };
  }

  /**
   * Handle time selection
   */
  async handleTimeSelection(callId, userMessage) {
    const state = this.getConversationState(callId);
    const selectedTime = this.detectTimeSelection(userMessage);
    
    if (!selectedTime) {
      const availableTimes = await this.getAvailableTimes(state.preferredProvider, state.preferredDate, state.appointmentType);
      return {
        message: "I didn't catch that time. What time would work best for you?",
        nextStep: 'time_selection',
        availableTimes,
        options: availableTimes.slice(0, 5)
      };
    }

    // Check if the selected time is available
    const isAvailable = await this.checkTimeAvailability(state.preferredProvider, state.preferredDate, selectedTime);
    
    if (!isAvailable) {
      const availableTimes = await this.getAvailableTimes(state.preferredProvider, state.preferredDate, state.appointmentType);
      return {
        message: "I'm sorry, that time slot is no longer available. Here are the available times:",
        nextStep: 'time_selection',
        availableTimes,
        options: availableTimes.slice(0, 5)
      };
    }

    this.updateConversationState(callId, {
      preferredTime: selectedTime,
      step: 'insurance_verification'
    });

    return {
      message: `Perfect! You've selected ${selectedTime} on ${state.preferredDate}. Now I need to verify your insurance information. What insurance provider do you have?`,
      nextStep: 'insurance_verification',
      selectedSlot: {
        provider: state.preferredProvider,
        date: state.preferredDate,
        time: selectedTime,
        type: state.appointmentType
      }
    };
  }

  /**
   * Handle insurance verification
   */
  async handleInsuranceVerification(callId, userMessage) {
    const state = this.getConversationState(callId);
    const insuranceInfo = this.extractInsuranceInfo(userMessage);
    
    if (!insuranceInfo.provider) {
      return {
        message: "What insurance provider do you have? We accept Aetna, Blue Cross Blue Shield, Cigna, Medicare, and Tricare.",
        nextStep: 'insurance_verification',
        options: ['Aetna', 'Blue Cross Blue Shield', 'Cigna', 'Medicare', 'Tricare']
      };
    }

    // Check if insurance is accepted
    if (!this.isAcceptedInsurance(insuranceInfo.provider)) {
      return {
        message: `I'm sorry, but we don't accept ${insuranceInfo.provider}. We accept Aetna, Blue Cross Blue Shield, Cigna, Medicare, and Tricare. Would you like to proceed with self-pay?`,
        nextStep: 'insurance_verification',
        selfPayOption: true,
        options: ['Yes, self-pay', 'No, let me check my insurance']
      };
    }

    // This would call the Availity service for verification
    const verificationResult = await this.simulateInsuranceVerification(insuranceInfo);
    
    if (verificationResult.verified) {
      this.updateConversationState(callId, {
        insuranceVerified: true,
        insuranceInfo: verificationResult,
        step: 'confirmation'
      });
      
      return {
        message: `Great! I've verified your ${insuranceInfo.provider} insurance. Your copay will be $${verificationResult.copay}. Let me confirm your appointment details: ${state.appointmentType} with ${state.preferredProvider.name} on ${state.preferredDate} at ${state.preferredTime}. Is this correct?`,
        nextStep: 'confirmation',
        insuranceInfo: verificationResult,
        appointmentDetails: {
          type: state.appointmentType,
          provider: state.preferredProvider.name,
          date: state.preferredDate,
          time: state.preferredTime,
          copay: verificationResult.copay
        }
      };
    } else {
      return {
        message: `I'm having trouble verifying your ${insuranceInfo.provider} insurance. Would you like to proceed with self-pay, or would you prefer to call back later?`,
        nextStep: 'insurance_verification',
        selfPayOption: true,
        options: ['Self-pay', 'Call back later']
      };
    }
  }

  /**
   * Handle appointment confirmation
   */
  async handleConfirmation(callId, userMessage) {
    const state = this.getConversationState(callId);
    const confirmation = this.detectConfirmation(userMessage);
    
    if (confirmation === 'yes') {
      // Create the appointment
      const appointmentResult = await this.createAppointment(state);
      
      if (appointmentResult.success) {
        this.updateConversationState(callId, { step: 'completed' });
        return {
          message: `Perfect! Your appointment has been scheduled. You'll receive a confirmation email and text message. Is there anything else I can help you with?`,
          nextStep: 'completed',
          appointmentId: appointmentResult.appointmentId,
          confirmationSent: true
        };
      } else {
        return {
          message: "I'm sorry, there was an issue scheduling your appointment. Let me try again or would you prefer to speak with our front desk?",
          nextStep: 'confirmation',
          error: appointmentResult.error
        };
      }
    } else if (confirmation === 'no') {
      return {
        message: "No problem! Let me know what you'd like to change about your appointment.",
        nextStep: 'modification',
        options: ['Change provider', 'Change date', 'Change time', 'Change appointment type']
      };
    } else {
      return {
        message: "I didn't catch that. Is the appointment information correct?",
        nextStep: 'confirmation',
        options: ['Yes', 'No']
      };
    }
  }

  /**
   * Detect user intent from message
   */
  detectIntent(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('schedule') || lowerMessage.includes('book') || lowerMessage.includes('appointment')) {
      return 'schedule';
    } else if (lowerMessage.includes('reschedule') || lowerMessage.includes('change')) {
      return 'reschedule';
    } else if (lowerMessage.includes('cancel')) {
      return 'cancel';
    }
    
    return 'general';
  }

  /**
   * Extract verification data from user message
   */
  extractVerificationData(message) {
    const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
    const dobRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/;
    
    const phoneMatch = message.match(phoneRegex);
    const dobMatch = message.match(dobRegex);
    
    return {
      phoneNumber: phoneMatch ? phoneMatch[0] : null,
      dateOfBirth: dobMatch ? dobMatch[0] : null
    };
  }

  /**
   * Simulate client verification
   */
  async simulateVerification(verificationData) {
    // This would call the actual verification service
    // For now, we'll simulate with mock data
    return {
      verified: true,
      clientInfo: {
        id: 'client_001',
        name: 'John Doe',
        phone: verificationData.phoneNumber,
        dateOfBirth: verificationData.dateOfBirth
      }
    };
  }

  /**
   * Detect appointment type from user message
   */
  detectAppointmentType(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('comprehensive') || lowerMessage.includes('evaluation')) {
      return 'comprehensive_evaluation';
    } else if (lowerMessage.includes('follow') || lowerMessage.includes('follow-up')) {
      return 'follow_up';
    } else if (lowerMessage.includes('ketamine')) {
      return 'ketamine_consultation';
    }
    
    return null;
  }

  /**
   * Get available providers for appointment type
   */
  getAvailableProviders(appointmentType) {
    const providers = [];
    
    // Charles Maddix - available for all appointment types
    providers.push({
      id: 'charles_maddix',
      name: 'Charles Maddix',
      schedule: this.providerSchedules.charles_maddix.schedule
    });
    
    // Ava Suleiman - available for all appointment types
    providers.push({
      id: 'ava_suleiman',
      name: 'Ava Suleiman',
      schedule: this.providerSchedules.ava_suleiman.schedule
    });
    
    // Dr. Soto - only for follow-ups
    if (appointmentType === 'follow_up') {
      providers.push({
        id: 'dr_soto',
        name: 'Dr. Soto',
        schedule: this.providerSchedules.dr_soto.schedule
      });
    }
    
    return providers;
  }

  /**
   * Detect provider selection from user message
   */
  detectProviderSelection(message, appointmentType) {
    const lowerMessage = message.toLowerCase();
    const providers = this.getAvailableProviders(appointmentType);
    
    for (const provider of providers) {
      if (lowerMessage.includes(provider.name.toLowerCase()) || 
          lowerMessage.includes(provider.id.toLowerCase())) {
        return provider;
      }
    }
    
    return null;
  }

  /**
   * Get available dates for a provider
   */
  getAvailableDates(provider) {
    const dates = [];
    const today = moment();
    
    // Generate next 30 days of available dates
    for (let i = 1; i <= 30; i++) {
      const date = today.clone().add(i, 'days');
      const dayOfWeek = date.format('dddd').toLowerCase();
      
      // Check if provider is available on this day
      if (provider.schedule[dayOfWeek]) {
        dates.push(date.format('YYYY-MM-DD'));
      }
    }
    
    return dates;
  }

  /**
   * Detect date selection from user message
   */
  detectDateSelection(message) {
    // This would use a more sophisticated date parsing library
    // For now, we'll do basic pattern matching
    const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/;
    const match = message.match(dateRegex);
    
    if (match) {
      return moment(match[0]).format('YYYY-MM-DD');
    }
    
    return null;
  }

  /**
   * Get available times for a provider on a specific date
   */
  async getAvailableTimes(provider, date) {
    const times = [];
    const dayOfWeek = moment(date).format('dddd').toLowerCase();
    const schedule = provider.schedule[dayOfWeek];
    
    if (!schedule) {
      return times;
    }
    
    const startHour = parseInt(schedule.start.split(':')[0]);
    const endHour = parseInt(schedule.end.split(':')[0]);
    const lunchStart = parseInt(this.lunchBreakStart.split(':')[0]);
    const lunchEnd = parseInt(this.lunchBreakEnd.split(':')[0]);
    
    for (let hour = startHour; hour < endHour; hour++) {
      // Skip lunch break
      if (hour >= lunchStart && hour < lunchEnd) {
        continue;
      }
      
      // Generate 15-minute slots
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push(timeString);
      }
    }
    
    return times;
  }

  /**
   * Detect time selection from user message
   */
  detectTimeSelection(message) {
    const timeRegex = /(\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))/i;
    const match = message.match(timeRegex);
    
    if (match) {
      return match[0];
    }
    
    return null;
  }

  /**
   * Check if a time slot is available
   */
  async checkTimeAvailability() {
    // This would check against the actual availability
    // For now, we'll simulate availability
    return Math.random() > 0.3; // 70% availability
  }

  /**
   * Extract insurance information from user message
   */
  extractInsuranceInfo(message) {
    const lowerMessage = message.toLowerCase();
    const acceptedProviders = ['aetna', 'blue cross blue shield', 'cigna', 'medicare', 'tricare'];
    
    for (const provider of acceptedProviders) {
      if (lowerMessage.includes(provider)) {
        return { provider };
      }
    }
    
    return { provider: null };
  }

  /**
   * Check if insurance provider is accepted
   */
  isAcceptedInsurance(provider) {
    const acceptedProviders = ['aetna', 'blue cross blue shield', 'cigna', 'medicare', 'tricare'];
    return acceptedProviders.some(accepted => 
      provider.toLowerCase().includes(accepted)
    );
  }

  /**
   * Simulate insurance verification
   */
  async simulateInsuranceVerification(insuranceInfo) {
    // This would call the actual Availity service
    return {
      verified: true,
      provider: insuranceInfo.provider,
      copay: 25,
      deductible: 1000,
      deductibleMet: false
    };
  }

  /**
   * Detect confirmation from user message
   */
  detectConfirmation(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('yes') || lowerMessage.includes('correct') || lowerMessage.includes('right')) {
      return 'yes';
    } else if (lowerMessage.includes('no') || lowerMessage.includes('incorrect') || lowerMessage.includes('wrong')) {
      return 'no';
    }
    
    return null;
  }

  /**
   * Create appointment
   */
  async createAppointment() {
    // This would call the actual IntakeQ service
    // For now, we'll simulate appointment creation
    return {
      success: true,
      appointmentId: 'apt_' + Date.now(),
      message: 'Appointment created successfully'
    };
  }

  /**
   * Handle general inquiries
   */
  async handleGeneralInquiry() {
    return {
      message: "I'm here to help with appointment scheduling. Would you like to schedule, reschedule, or cancel an appointment?",
      nextStep: 'greeting',
      options: ['Schedule appointment', 'Reschedule appointment', 'Cancel appointment']
    };
  }

  /**
   * Get error response
   */
  getErrorResponse() {
    return {
      message: "I'm sorry, I'm having trouble processing your request. Let me transfer you to our front desk for assistance.",
      nextStep: 'error',
      requiresTransfer: true
    };
  }

  /**
   * Clean up conversation state
   */
  cleanupConversation(callId) {
    this.conversationStates.delete(callId);
    this.logger.info(`Conversation state cleaned up for call: ${callId}`);
  }
}

module.exports = ConversationFlow;
