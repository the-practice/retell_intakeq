const axios = require('axios');
const winston = require('winston');
const crypto = require('crypto');

class AvailityService {
  constructor() {
    this.apiKey = process.env.AVAILITY_API_KEY;
    this.secret = process.env.AVAILITY_SECRET;
    this.baseURL = process.env.AVAILITY_BASE_URL || 'https://api.availity.com/v1';
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()]
    });

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    this.connected = false;
    this.acceptedInsuranceProviders = JSON.parse(process.env.ACCEPTED_INSURANCE || '[]');
    this.testConnection();
  }

  async testConnection() {
    try {
      // Test connection with a simple API call
      await this.authenticate();
      this.connected = true;
      this.logger.info('Availity API connection established');
    } catch (error) {
      this.connected = false;
      this.logger.error('Availity API connection failed:', error.message);
    }
  }

  isConnected() {
    return this.connected;
  }

  /**
   * Authenticate with Availity API
   */
  async authenticate() {
    try {
      const response = await this.client.post('/auth/token', {
        client_id: this.apiKey,
        client_secret: this.secret,
        grant_type: 'client_credentials'
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      // Update client headers with token
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
      
      return this.accessToken;
    } catch (error) {
      this.logger.error('Error authenticating with Availity:', error);
      throw error;
    }
  }

  /**
   * Check if token is expired and refresh if needed
   */
  async ensureAuthenticated() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
  }

  /**
   * Verify insurance coverage for a patient
   */
  async verifyInsurance(insuranceInfo) {
    try {
      await this.ensureAuthenticated();

      const {
        memberId,
        dateOfBirth,
        firstName,
        lastName,
        insuranceProvider,
        groupNumber = null
      } = insuranceInfo;

      // Check if insurance provider is accepted
      if (!this.isAcceptedInsurance(insuranceProvider)) {
        return {
          verified: false,
          error: 'Insurance provider not accepted',
          acceptedProviders: this.acceptedInsuranceProviders,
          selfPayOption: true
        };
      }

      const response = await this.client.post('/eligibility/verify', {
        member_id: memberId,
        date_of_birth: dateOfBirth,
        first_name: firstName,
        last_name: lastName,
        insurance_provider: insuranceProvider,
        group_number: groupNumber,
        verification_date: new Date().toISOString()
      });

      const eligibilityData = response.data;

      return {
        verified: eligibilityData.active,
        memberId: eligibilityData.member_id,
        insuranceProvider: eligibilityData.insurance_provider,
        coverageStatus: eligibilityData.status,
        effectiveDate: eligibilityData.effective_date,
        terminationDate: eligibilityData.termination_date,
        copay: eligibilityData.copay_amount,
        deductible: eligibilityData.deductible_amount,
        deductibleMet: eligibilityData.deductible_met,
        outOfPocketMax: eligibilityData.out_of_pocket_max,
        outOfPocketMet: eligibilityData.out_of_pocket_met,
        benefits: eligibilityData.benefits,
        limitations: eligibilityData.limitations,
        priorAuthorizationRequired: eligibilityData.prior_auth_required,
        networkStatus: eligibilityData.network_status,
        selfPayOption: !eligibilityData.active
      };

    } catch (error) {
      this.logger.error('Error verifying insurance:', error);
      
      // Return error response that allows for self-pay option
      return {
        verified: false,
        error: 'Insurance verification temporarily unavailable',
        selfPayOption: true,
        acceptedProviders: this.acceptedInsuranceProviders
      };
    }
  }

  /**
   * Get detailed benefits information
   */
  async getBenefits(insuranceInfo) {
    try {
      await this.ensureAuthenticated();

      const response = await this.client.post('/benefits/detailed', {
        member_id: insuranceInfo.memberId,
        date_of_birth: insuranceInfo.dateOfBirth,
        insurance_provider: insuranceInfo.insuranceProvider,
        service_type: 'mental_health',
        provider_npi: process.env.PRACTICE_NPI // Your practice NPI
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting benefits:', error);
      throw error;
    }
  }

  /**
   * Check if prior authorization is required
   */
  async checkPriorAuthorization(insuranceInfo, procedureCode) {
    try {
      await this.ensureAuthenticated();

      const response = await this.client.post('/authorization/check', {
        member_id: insuranceInfo.memberId,
        insurance_provider: insuranceInfo.insuranceProvider,
        procedure_code: procedureCode,
        provider_npi: process.env.PRACTICE_NPI,
        service_date: new Date().toISOString()
      });

      return {
        required: response.data.required,
        status: response.data.status,
        referenceNumber: response.data.reference_number,
        expirationDate: response.data.expiration_date
      };
    } catch (error) {
      this.logger.error('Error checking prior authorization:', error);
      throw error;
    }
  }

  /**
   * Submit prior authorization request
   */
  async submitPriorAuthorization(authRequest) {
    try {
      await this.ensureAuthenticated();

      const response = await this.client.post('/authorization/submit', {
        member_id: authRequest.memberId,
        insurance_provider: authRequest.insuranceProvider,
        procedure_code: authRequest.procedureCode,
        provider_npi: process.env.PRACTICE_NPI,
        diagnosis_codes: authRequest.diagnosisCodes,
        clinical_notes: authRequest.clinicalNotes,
        requested_units: authRequest.requestedUnits,
        service_date: authRequest.serviceDate
      });

      return {
        submitted: true,
        referenceNumber: response.data.reference_number,
        status: response.data.status,
        estimatedResponseTime: response.data.estimated_response_time
      };
    } catch (error) {
      this.logger.error('Error submitting prior authorization:', error);
      throw error;
    }
  }

  /**
   * Get claim status
   */
  async getClaimStatus(claimId) {
    try {
      await this.ensureAuthenticated();

      const response = await this.client.get(`/claims/${claimId}/status`);
      return response.data;
    } catch (error) {
      this.logger.error('Error getting claim status:', error);
      throw error;
    }
  }

  /**
   * Submit a claim
   */
  async submitClaim(claimData) {
    try {
      await this.ensureAuthenticated();

      const response = await this.client.post('/claims/submit', {
        member_id: claimData.memberId,
        insurance_provider: claimData.insuranceProvider,
        provider_npi: process.env.PRACTICE_NPI,
        service_date: claimData.serviceDate,
        procedure_codes: claimData.procedureCodes,
        diagnosis_codes: claimData.diagnosisCodes,
        billed_amount: claimData.billedAmount,
        copay_amount: claimData.copayAmount,
        prior_auth_number: claimData.priorAuthNumber
      });

      return {
        submitted: true,
        claimId: response.data.claim_id,
        status: response.data.status,
        estimatedProcessingTime: response.data.estimated_processing_time
      };
    } catch (error) {
      this.logger.error('Error submitting claim:', error);
      throw error;
    }
  }

  /**
   * Get provider directory information
   */
  async getProviderDirectory(insuranceProvider, specialty = 'psychiatry') {
    try {
      await this.ensureAuthenticated();

      const response = await this.client.get('/providers/directory', {
        params: {
          insurance_provider: insuranceProvider,
          specialty: specialty,
          location: 'Jacksonville, FL',
          radius: 25
        }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting provider directory:', error);
      throw error;
    }
  }

  /**
   * Check if insurance provider is accepted
   */
  isAcceptedInsurance(provider) {
    return this.acceptedInsuranceProviders.some(accepted => 
      provider.toLowerCase().includes(accepted.toLowerCase())
    );
  }

  /**
   * Get accepted insurance providers
   */
  getAcceptedInsuranceProviders() {
    return this.acceptedInsuranceProviders;
  }

  /**
   * Calculate estimated patient responsibility
   */
  async calculatePatientResponsibility(insuranceInfo, serviceCost) {
    try {
      const eligibility = await this.verifyInsurance(insuranceInfo);
      
      if (!eligibility.verified) {
        return {
          totalCost: serviceCost,
          insuranceCoverage: 0,
          patientResponsibility: serviceCost,
          copay: 0,
          deductible: 0,
          outOfPocket: 0
        };
      }

      const copay = eligibility.copay || 0;
      const deductibleRemaining = Math.max(0, (eligibility.deductible || 0) - (eligibility.deductibleMet || 0));
      const outOfPocketRemaining = Math.max(0, (eligibility.outOfPocketMax || 0) - (eligibility.outOfPocketMet || 0));

      let patientResponsibility = 0;

      // If deductible not met, patient pays full cost up to deductible
      if (deductibleRemaining > 0) {
        patientResponsibility = Math.min(serviceCost, deductibleRemaining);
      } else {
        // If deductible met, patient pays copay
        patientResponsibility = copay;
      }

      // If out-of-pocket max reached, patient pays nothing
      if (outOfPocketRemaining === 0) {
        patientResponsibility = 0;
      }

      return {
        totalCost: serviceCost,
        insuranceCoverage: serviceCost - patientResponsibility,
        patientResponsibility: patientResponsibility,
        copay: copay,
        deductible: eligibility.deductible,
        deductibleMet: eligibility.deductibleMet,
        outOfPocketMax: eligibility.outOfPocketMax,
        outOfPocketMet: eligibility.outOfPocketMet,
        networkStatus: eligibility.networkStatus
      };
    } catch (error) {
      this.logger.error('Error calculating patient responsibility:', error);
      throw error;
    }
  }

  /**
   * Get insurance card image (if available)
   */
  async getInsuranceCardImage(memberId, insuranceProvider) {
    try {
      await this.ensureAuthenticated();

      const response = await this.client.get(`/cards/${memberId}`, {
        params: {
          insurance_provider: insuranceProvider
        }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting insurance card:', error);
      throw error;
    }
  }

  /**
   * Validate insurance card information
   */
  async validateInsuranceCard(cardData) {
    try {
      await this.ensureAuthenticated();

      const response = await this.client.post('/cards/validate', {
        member_id: cardData.memberId,
        group_number: cardData.groupNumber,
        insurance_provider: cardData.insuranceProvider,
        card_image: cardData.cardImage // Base64 encoded image
      });

      return {
        valid: response.data.valid,
        confidence: response.data.confidence,
        extractedData: response.data.extracted_data,
        errors: response.data.errors
      };
    } catch (error) {
      this.logger.error('Error validating insurance card:', error);
      throw error;
    }
  }

  /**
   * Get real-time eligibility status
   */
  async getRealTimeEligibility(insuranceInfo) {
    try {
      await this.ensureAuthenticated();

      const response = await this.client.post('/eligibility/realtime', {
        member_id: insuranceInfo.memberId,
        date_of_birth: insuranceInfo.dateOfBirth,
        insurance_provider: insuranceInfo.insuranceProvider,
        service_date: new Date().toISOString()
      });

      return {
        active: response.data.active,
        status: response.data.status,
        effectiveDate: response.data.effective_date,
        terminationDate: response.data.termination_date,
        copay: response.data.copay,
        deductible: response.data.deductible,
        networkStatus: response.data.network_status,
        benefits: response.data.benefits
      };
    } catch (error) {
      this.logger.error('Error getting real-time eligibility:', error);
      throw error;
    }
  }

  /**
   * Handle Availity webhook events
   */
  async handleWebhook(event, data) {
    try {
      this.logger.info(`Availity webhook received: ${event}`);

      switch (event) {
        case 'eligibility.updated':
          await this.handleEligibilityUpdated(data);
          break;
        case 'authorization.approved':
          await this.handleAuthorizationApproved(data);
          break;
        case 'authorization.denied':
          await this.handleAuthorizationDenied(data);
          break;
        case 'claim.processed':
          await this.handleClaimProcessed(data);
          break;
        default:
          this.logger.info(`Unhandled Availity webhook event: ${event}`);
      }
    } catch (error) {
      this.logger.error('Error handling Availity webhook:', error);
      throw error;
    }
  }

  async handleEligibilityUpdated(data) {
    this.logger.info(`Eligibility updated for member: ${data.member_id}`);
    // Update local cache
    // Notify relevant systems
  }

  async handleAuthorizationApproved(data) {
    this.logger.info(`Authorization approved: ${data.reference_number}`);
    // Update appointment status
    // Send notifications
  }

  async handleAuthorizationDenied(data) {
    this.logger.info(`Authorization denied: ${data.reference_number}`);
    // Update appointment status
    // Send notifications
    // Offer alternative options
  }

  async handleClaimProcessed(data) {
    this.logger.info(`Claim processed: ${data.claim_id}`);
    // Update billing records
    // Send notifications
  }
}

module.exports = AvailityService;
