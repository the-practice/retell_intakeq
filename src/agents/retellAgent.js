const Retell = require('retell-sdk');
const winston = require('winston');

class RetellAgent {
  constructor() {
    this.client = new Retell({
      apiKey: process.env.RETELL_API_KEY
    });
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()]
    });
  }

  async createMattAgent() {
    try {
      const agentConfig = {
        agent_name: 'Matt - The Practice Voice Assistant',
        voice_id: '11labs-Adrian', // Professional, warm voice
        voice_temperature: 0.7,
        voice_speed: 1.0,
        volume: 0.8,
        responsiveness: 0.8,
        interruption_sensitivity: 0.7,
        enable_backchannel: true,
        backchannel_frequency: 0.3,
        backchannel_words: ['mm-hmm', 'I understand', 'okay', 'yes'],
        language: 'en-US',
        webhook_url: `${process.env.BASE_URL}/webhook/retell`,
        boosted_keywords: [
          'appointment', 'schedule', 'reschedule', 'cancel', 'insurance',
          'copay', 'deductible', 'provider', 'doctor', 'psychiatrist',
          'mental health', 'therapy', 'medication', 'follow-up'
        ],
        pronunciation_dictionary: [
          {
            word: 'IntakeQ',
            alphabet: 'ipa',
            phoneme: 'ɪnˈteɪk kjuː'
          },
          {
            word: 'Availity',
            alphabet: 'ipa', 
            phoneme: 'əˈveɪlɪti'
          },
          {
            word: 'Maddix',
            alphabet: 'ipa',
            phoneme: 'ˈmædɪks'
          },
          {
            word: 'Suleiman',
            alphabet: 'ipa',
            phoneme: 'suːˈleɪmən'
          }
        ],
        normalize_for_speech: true,
        end_call_after_silence_ms: 30000,
        max_call_duration_ms: 1800000, // 30 minutes max
        begin_message_delay_ms: 2000,
        ring_duration_ms: 25000,
        response_engine: {
          type: 'retell-llm',
          llm_id: await this.createCustomLLM()
        },
        post_call_analysis_data: [
          'call_summary',
          'appointment_scheduled',
          'insurance_verified',
          'client_satisfaction'
        ]
      };

      const agent = await this.client.agent.create(agentConfig);
      this.logger.info(`Matt agent created with ID: ${agent.agent_id}`);
      
      return agent;
    } catch (error) {
      this.logger.error('Error creating Matt agent:', error);
      throw error;
    }
  }

  async createCustomLLM() {
    try {
      const llmConfig = {
        llm_dynamic_variables: [
          {
            name: 'client_name',
            description: 'The verified client\'s name'
          },
          {
            name: 'client_phone',
            description: 'The verified client\'s phone number'
          },
          {
            name: 'client_dob',
            description: 'The verified client\'s date of birth'
          },
          {
            name: 'insurance_provider',
            description: 'The client\'s insurance provider'
          },
          {
            name: 'copay_amount',
            description: 'The client\'s copay amount'
          },
          {
            name: 'provider_availability',
            description: 'Available appointment slots'
          },
          {
            name: 'appointment_type',
            description: 'Type of appointment requested'
          }
        ],
        general_prompt: this.getSystemPrompt(),
        general_prompt_llm_dynamic_variables: [
          'client_name',
          'client_phone', 
          'client_dob',
          'insurance_provider',
          'copay_amount',
          'provider_availability',
          'appointment_type'
        ],
        general_prompt_llm_dynamic_variables_type: 'string'
      };

      const llm = await this.client.retellLLM.create(llmConfig);
      this.logger.info(`Custom LLM created with ID: ${llm.llm_id}`);
      
      return llm.llm_id;
    } catch (error) {
      this.logger.error('Error creating custom LLM:', error);
      throw error;
    }
  }

  getSystemPrompt() {
    return `You are Matt, the HIPAA-compliant voice assistant for The Practice psychiatric wellness clinic in Jacksonville, FL.

PRACTICE INFORMATION:
- Name: The Practice
- Address: 3547 Hendricks Ave, Jacksonville, FL 32207
- Phone: ${process.env.PRACTICE_PHONE}
- Email: ${process.env.PRACTICE_EMAIL}

PROVIDERS AND SCHEDULES:
- Charles Maddix: Monday-Thursday, 10:30 AM-6:00 PM
- Ava Suleiman: Tuesday only, 10:30 AM-6:00 PM  
- Dr. Soto: Monday-Thursday, 4:00 PM-6:00 PM (follow-ups only)
- Lunch break: Daily 1:00 PM-2:00 PM

APPOINTMENT TYPES:
- Comprehensive evaluations: 60 minutes
- Follow-ups: 15 minutes
- Ketamine consultations: 30 minutes
- Both telehealth and in-person available

INSURANCE ACCEPTED:
- Aetna, Blue Cross Blue Shield (Florida Blue), Cigna, Medicare, Tricare
- NO HMOs or Medicaid (offer self-pay alternative)

HIPAA COMPLIANCE REQUIREMENTS:
1. ALWAYS verify client identity using BOTH phone number AND date of birth
2. NEVER disclose client information without proper verification
3. If verification fails, politely explain you cannot access their information
4. All conversations are recorded for quality and compliance purposes

CONVERSATION FLOW:
1. Greet warmly and identify yourself as Matt from The Practice
2. Ask for verification: "For your security and HIPAA compliance, I need to verify your identity. Could you please provide your phone number and date of birth?"
3. Verify the information matches our records
4. If verified, proceed with appointment scheduling
5. If not verified, offer to transfer to front desk or schedule new patient intake

APPOINTMENT SCHEDULING:
- Check provider availability using the get_availability function
- Confirm appointment details (date, time, provider, type)
- Verify insurance and communicate copay amount
- Send confirmation details
- Offer to add to calendar or send text reminder

INSURANCE VERIFICATION:
- Use check_insurance function to verify coverage
- Communicate copay amounts clearly
- If insurance not accepted, explain self-pay options

TONE AND STYLE:
- Professional yet warm and empathetic
- Speak clearly and at a moderate pace
- Use active listening techniques
- Be patient with clients who may be anxious or confused
- Always maintain HIPAA compliance
- End calls with clear next steps and contact information

Remember: You are representing a psychiatric wellness clinic. Be sensitive to mental health concerns and maintain a supportive, non-judgmental tone throughout the conversation.`;
  }

  async updateAgent(agentId, updates) {
    try {
      const updatedAgent = await this.client.agent.update(agentId, updates);
      this.logger.info(`Agent ${agentId} updated successfully`);
      return updatedAgent;
    } catch (error) {
      this.logger.error(`Error updating agent ${agentId}:`, error);
      throw error;
    }
  }

  async deleteAgent(agentId) {
    try {
      await this.client.agent.delete(agentId);
      this.logger.info(`Agent ${agentId} deleted successfully`);
    } catch (error) {
      this.logger.error(`Error deleting agent ${agentId}:`, error);
      throw error;
    }
  }

  async getAgent(agentId) {
    try {
      const agent = await this.client.agent.get(agentId);
      return agent;
    } catch (error) {
      this.logger.error(`Error getting agent ${agentId}:`, error);
      throw error;
    }
  }

  async listAgents() {
    try {
      const agents = await this.client.agent.list();
      return agents;
    } catch (error) {
      this.logger.error('Error listing agents:', error);
      throw error;
    }
  }

  async createPhoneCall(fromNumber, toNumber, agentId) {
    try {
      const call = await this.client.call.createPhoneCall({
        from_number: fromNumber,
        to_number: toNumber,
        agent_id: agentId
      });
      
      this.logger.info(`Phone call created: ${call.call_id}`);
      return call;
    } catch (error) {
      this.logger.error('Error creating phone call:', error);
      throw error;
    }
  }

  async getCall(callId) {
    try {
      const call = await this.client.call.get(callId);
      return call;
    } catch (error) {
      this.logger.error(`Error getting call ${callId}:`, error);
      throw error;
    }
  }

  async listCalls(filters = {}) {
    try {
      const calls = await this.client.call.list(filters);
      return calls;
    } catch (error) {
      this.logger.error('Error listing calls:', error);
      throw error;
    }
  }

  async deleteCall(callId) {
    try {
      await this.client.call.delete(callId);
      this.logger.info(`Call ${callId} deleted successfully`);
    } catch (error) {
      this.logger.error(`Error deleting call ${callId}:`, error);
      throw error;
    }
  }
}

module.exports = RetellAgent;
