const axios = require('axios');
const winston = require('winston');
const moment = require('moment');

class IntakeQService {
  constructor() {
    this.apiKey = process.env.INTAKEQ_API_KEY;
    this.baseURL = process.env.INTAKEQ_BASE_URL || 'https://api.intakeq.com/v1';
    this.clinicId = process.env.INTAKEQ_CLINIC_ID;
    
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
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    this.connected = false;
    this.testConnection();
  }

  async testConnection() {
    try {
      await this.client.get('/health');
      this.connected = true;
      this.logger.info('IntakeQ API connection established');
    } catch (error) {
      this.connected = false;
      this.logger.error('IntakeQ API connection failed:', error.message);
    }
  }

  isConnected() {
    return this.connected;
  }

  /**
   * Get client information by phone number and date of birth
   */
  async getClient(phoneNumber, dateOfBirth) {
    try {
      const response = await this.client.get('/clients', {
        params: {
          phone: phoneNumber,
          date_of_birth: dateOfBirth,
          clinic_id: this.clinicId
        }
      });

      if (response.data && response.data.length > 0) {
        return response.data[0];
      }

      return null;
    } catch (error) {
      this.logger.error('Error getting client from IntakeQ:', error);
      throw error;
    }
  }

  /**
   * Create a new client in IntakeQ
   */
  async createClient(clientData) {
    try {
      const response = await this.client.post('/clients', {
        clinic_id: this.clinicId,
        first_name: clientData.firstName,
        last_name: clientData.lastName,
        phone: clientData.phone,
        email: clientData.email,
        date_of_birth: clientData.dateOfBirth,
        address: clientData.address,
        insurance: clientData.insurance,
        emergency_contact: clientData.emergencyContact,
        notes: clientData.notes
      });

      this.logger.info(`New client created in IntakeQ: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error creating client in IntakeQ:', error);
      throw error;
    }
  }

  /**
   * Update client information
   */
  async updateClient(clientId, updateData) {
    try {
      const response = await this.client.put(`/clients/${clientId}`, updateData);
      this.logger.info(`Client updated in IntakeQ: ${clientId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error updating client in IntakeQ:', error);
      throw error;
    }
  }

  /**
   * Get provider availability for a specific date range
   */
  async getProviderAvailability(providerId, startDate, endDate) {
    try {
      const response = await this.client.get('/availability', {
        params: {
          provider_id: providerId,
          start_date: startDate,
          end_date: endDate,
          clinic_id: this.clinicId
        }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting provider availability:', error);
      throw error;
    }
  }

  /**
   * Get all available appointment slots for a provider
   */
  async getAvailableSlots(providerId, date, appointmentType = null) {
    try {
      const params = {
        provider_id: providerId,
        date: date,
        clinic_id: this.clinicId
      };

      if (appointmentType) {
        params.appointment_type = appointmentType;
      }

      const response = await this.client.get('/appointments/available-slots', {
        params
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting available slots:', error);
      throw error;
    }
  }

  /**
   * Create a new appointment
   */
  async createAppointment(appointmentData) {
    try {
      const appointmentPayload = {
        clinic_id: this.clinicId,
        client_id: appointmentData.clientId,
        provider_id: appointmentData.providerId,
        appointment_type: appointmentData.appointmentType,
        start_time: appointmentData.startTime,
        end_time: appointmentData.endTime,
        location: appointmentData.location || 'in-person',
        notes: appointmentData.notes,
        insurance_verified: appointmentData.insuranceVerified,
        copay_amount: appointmentData.copayAmount,
        status: 'scheduled'
      };

      const response = await this.client.post('/appointments', appointmentPayload);
      
      this.logger.info(`Appointment created in IntakeQ: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error creating appointment in IntakeQ:', error);
      throw error;
    }
  }

  /**
   * Update an existing appointment
   */
  async updateAppointment(appointmentId, updateData) {
    try {
      const response = await this.client.put(`/appointments/${appointmentId}`, updateData);
      this.logger.info(`Appointment updated in IntakeQ: ${appointmentId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error updating appointment in IntakeQ:', error);
      throw error;
    }
  }

  /**
   * Cancel an appointment
   */
  async cancelAppointment(appointmentId, reason = null) {
    try {
      const response = await this.client.put(`/appointments/${appointmentId}`, {
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString()
      });

      this.logger.info(`Appointment cancelled in IntakeQ: ${appointmentId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error cancelling appointment in IntakeQ:', error);
      throw error;
    }
  }

  /**
   * Reschedule an appointment
   */
  async rescheduleAppointment(appointmentId, newDateTime, newProviderId = null) {
    try {
      const updateData = {
        start_time: newDateTime,
        status: 'rescheduled'
      };

      if (newProviderId) {
        updateData.provider_id = newProviderId;
      }

      const response = await this.client.put(`/appointments/${appointmentId}`, updateData);
      
      this.logger.info(`Appointment rescheduled in IntakeQ: ${appointmentId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error rescheduling appointment in IntakeQ:', error);
      throw error;
    }
  }

  /**
   * Get client's appointment history
   */
  async getClientAppointments(clientId, limit = 10) {
    try {
      const response = await this.client.get(`/clients/${clientId}/appointments`, {
        params: {
          limit,
          clinic_id: this.clinicId
        }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting client appointments:', error);
      throw error;
    }
  }

  /**
   * Get upcoming appointments for a client
   */
  async getUpcomingAppointments(clientId) {
    try {
      const response = await this.client.get(`/clients/${clientId}/appointments/upcoming`, {
        params: {
          clinic_id: this.clinicId
        }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting upcoming appointments:', error);
      throw error;
    }
  }

  /**
   * Get provider information
   */
  async getProvider(providerId) {
    try {
      const response = await this.client.get(`/providers/${providerId}`, {
        params: {
          clinic_id: this.clinicId
        }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting provider:', error);
      throw error;
    }
  }

  /**
   * Get all providers for the clinic
   */
  async getProviders() {
    try {
      const response = await this.client.get('/providers', {
        params: {
          clinic_id: this.clinicId
        }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting providers:', error);
      throw error;
    }
  }

  /**
   * Get provider schedule for a specific date
   */
  async getProviderSchedule(providerId, date) {
    try {
      const response = await this.client.get(`/providers/${providerId}/schedule`, {
        params: {
          date: date,
          clinic_id: this.clinicId
        }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting provider schedule:', error);
      throw error;
    }
  }

  /**
   * Check if a time slot is available
   */
  async isTimeSlotAvailable(providerId, startTime, endTime) {
    try {
      const response = await this.client.get('/appointments/check-availability', {
        params: {
          provider_id: providerId,
          start_time: startTime,
          end_time: endTime,
          clinic_id: this.clinicId
        }
      });

      return response.data.available;
    } catch (error) {
      this.logger.error('Error checking time slot availability:', error);
      throw error;
    }
  }

  /**
   * Get appointment types available for a provider
   */
  async getProviderAppointmentTypes(providerId) {
    try {
      const response = await this.client.get(`/providers/${providerId}/appointment-types`, {
        params: {
          clinic_id: this.clinicId
        }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting provider appointment types:', error);
      throw error;
    }
  }

  /**
   * Send appointment confirmation
   */
  async sendAppointmentConfirmation(appointmentId, method = 'email') {
    try {
      const response = await this.client.post(`/appointments/${appointmentId}/send-confirmation`, {
        method: method,
        clinic_id: this.clinicId
      });

      this.logger.info(`Appointment confirmation sent: ${appointmentId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error sending appointment confirmation:', error);
      throw error;
    }
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(appointmentId, method = 'email') {
    try {
      const response = await this.client.post(`/appointments/${appointmentId}/send-reminder`, {
        method: method,
        clinic_id: this.clinicId
      });

      this.logger.info(`Appointment reminder sent: ${appointmentId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error sending appointment reminder:', error);
      throw error;
    }
  }

  /**
   * Get clinic settings
   */
  async getClinicSettings() {
    try {
      const response = await this.client.get(`/clinics/${this.clinicId}/settings`);
      return response.data;
    } catch (error) {
      this.logger.error('Error getting clinic settings:', error);
      throw error;
    }
  }

  /**
   * Update clinic settings
   */
  async updateClinicSettings(settings) {
    try {
      const response = await this.client.put(`/clinics/${this.clinicId}/settings`, settings);
      this.logger.info('Clinic settings updated');
      return response.data;
    } catch (error) {
      this.logger.error('Error updating clinic settings:', error);
      throw error;
    }
  }

  /**
   * Handle IntakeQ webhook events
   */
  async handleWebhook(event, data) {
    try {
      this.logger.info(`IntakeQ webhook received: ${event}`);

      switch (event) {
        case 'appointment.created':
          await this.handleAppointmentCreated(data);
          break;
        case 'appointment.updated':
          await this.handleAppointmentUpdated(data);
          break;
        case 'appointment.cancelled':
          await this.handleAppointmentCancelled(data);
          break;
        case 'client.updated':
          await this.handleClientUpdated(data);
          break;
        default:
          this.logger.info(`Unhandled IntakeQ webhook event: ${event}`);
      }
    } catch (error) {
      this.logger.error('Error handling IntakeQ webhook:', error);
      throw error;
    }
  }

  async handleAppointmentCreated(data) {
    this.logger.info(`Appointment created: ${data.appointment_id}`);
    // Invalidate relevant caches
    // Send notifications
    // Update external systems
  }

  async handleAppointmentUpdated(data) {
    this.logger.info(`Appointment updated: ${data.appointment_id}`);
    // Invalidate relevant caches
    // Send notifications
  }

  async handleAppointmentCancelled(data) {
    this.logger.info(`Appointment cancelled: ${data.appointment_id}`);
    // Invalidate relevant caches
    // Send notifications
  }

  async handleClientUpdated(data) {
    this.logger.info(`Client updated: ${data.client_id}`);
    // Invalidate client cache
    // Update related data
  }
}

module.exports = IntakeQService;
