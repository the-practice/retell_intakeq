# Retell AI API Documentation Summary

Based on comprehensive scraping of https://docs.retellai.com/api-references/

## Base URL & Authentication

- **Base URL**: `https://api.retellai.com/v2/`
- **Authentication**: Bearer token in Authorization header
- **Format**: `Authorization: Bearer YOUR_RETELL_API_KEY`

## Core API Endpoints

### Call Management

#### Create Phone Call
- **Endpoint**: `POST /v2/create-phone-call`
- **Purpose**: Create a new outbound phone call
- **Required Parameters**:
  - `from_number`: Phone number to call from
  - `to_number`: Phone number to call
  - `agent_id`: ID of the agent to use for the call

**Example Request**:
```javascript
const phoneCallResponse = await client.call.createPhoneCall({
  from_number: '+14157774444',
  to_number: '+12137774445',
});
```

#### Get Call Details
- **Endpoint**: `GET /v2/get-call/{call_id}`
- **Purpose**: Retrieve details of a specific call
- **Parameters**: `call_id` (path parameter)

#### List Calls
- **Endpoint**: `GET /v2/list-calls`
- **Purpose**: Retrieve all calls with pagination
- **Optional Parameters**: Filtering and pagination options

#### Create Web Call
- **Endpoint**: `POST /v2/create-web-call`
- **Purpose**: Create a web-based call (browser-to-agent)
- **Returns**: Access token for frontend client

#### Delete Call
- **Endpoint**: `DELETE /v2/delete-call/{call_id}`
- **Purpose**: Delete a specific call record

### Agent Management

#### Create Agent
- **Endpoint**: `POST /v2/create-agent`
- **Purpose**: Create a new AI agent
- **Required Parameters**:
  - `response_engine`: LLM configuration
  - `voice_id`: Voice to use for the agent

**Example Request**:
```javascript
const agentResponse = await client.agent.create({
  response_engine: { 
    llm_id: 'llm_234sdertfsdsfsdf', 
    type: 'retell-llm' 
  },
  voice_id: '11labs-Adrian',
});
```

#### List Agents
- **Endpoint**: `GET /v2/list-agents`
- **Purpose**: Retrieve all agents

#### Delete Agent
- **Endpoint**: `DELETE /v2/delete-agent/{agent_id}`
- **Purpose**: Delete a specific agent

#### Get Agent Versions
- **Endpoint**: `GET /v2/get-agent-versions/{agent_id}`
- **Purpose**: Retrieve version history of an agent

### LLM Management

#### Create Retell LLM
- **Endpoint**: `POST /v2/create-retell-llm`
- **Purpose**: Create a custom LLM configuration

#### List Retell LLMs
- **Endpoint**: `GET /v2/list-retell-llms`
- **Purpose**: Retrieve all LLM configurations

#### Get Retell LLM
- **Endpoint**: `GET /v2/get-retell-llm/{llm_id}`
- **Purpose**: Retrieve specific LLM configuration

### Phone Number Management

#### Create Phone Number
- **Endpoint**: `POST /v2/create-phone-number`
- **Purpose**: Purchase a new phone number

#### Import Phone Number
- **Endpoint**: `POST /v2/import-phone-number`
- **Purpose**: Import an existing phone number

#### List Phone Numbers
- **Endpoint**: `GET /v2/list-phone-numbers`
- **Purpose**: Retrieve all phone numbers

#### Get Phone Number
- **Endpoint**: `GET /v2/get-phone-number/{phone_number_id}`
- **Purpose**: Retrieve specific phone number details

#### Delete Phone Number
- **Endpoint**: `DELETE /v2/delete-phone-number/{phone_number_id}`
- **Purpose**: Release a phone number

### Knowledge Base Management

#### Create Knowledge Base
- **Endpoint**: `POST /v2/create-knowledge-base`
- **Purpose**: Create a new knowledge base for agents

#### List Knowledge Bases
- **Endpoint**: `GET /v2/list-knowledge-bases`
- **Purpose**: Retrieve all knowledge bases

#### Get Knowledge Base
- **Endpoint**: `GET /v2/get-knowledge-base/{knowledge_base_id}`
- **Purpose**: Retrieve specific knowledge base

#### Delete Knowledge Base
- **Endpoint**: `DELETE /v2/delete-knowledge-base/{knowledge_base_id}`
- **Purpose**: Delete a knowledge base

#### Delete Knowledge Base Source
- **Endpoint**: `DELETE /v2/delete-knowledge-base-source/{source_id}`
- **Purpose**: Remove a source from knowledge base

### Chat & Messaging

#### Create Chat
- **Endpoint**: `POST /v2/create-chat`
- **Purpose**: Create a chat session

#### List Chats
- **Endpoint**: `GET /v2/list-chat`
- **Purpose**: Retrieve chat sessions

#### Get Chat
- **Endpoint**: `GET /v2/get-chat/{chat_id}`
- **Purpose**: Retrieve specific chat session

#### Create Chat Completion
- **Endpoint**: `POST /v2/create-chat-completion`
- **Purpose**: Generate chat completions

### Batch Operations

#### Create Batch Call
- **Endpoint**: `POST /v2/create-batch-call`
- **Purpose**: Create multiple calls in batch

### Voice & Audio

#### Get Voice
- **Endpoint**: `GET /v2/get-voice/{voice_id}`
- **Purpose**: Retrieve voice configuration details

#### Get Concurrency
- **Endpoint**: `GET /v2/get-concurrency`
- **Purpose**: Get current concurrency limits and usage

## Response Data Structure

### Call Object
```json
{
  "call_type": "phone_call" | "web_call",
  "call_id": "string",
  "agent_id": "string",
  "agent_version": "number",
  "call_status": "registered" | "ongoing" | "ended" | "error",
  "from_number": "string",
  "to_number": "string",
  "direction": "inbound" | "outbound",
  "start_timestamp": "number",
  "end_timestamp": "number",
  "duration_ms": "number",
  "transcript": "string",
  "transcript_object": [
    {
      "role": "agent" | "user",
      "content": "string",
      "words": [
        {
          "word": "string",
          "start": "number",
          "end": "number"
        }
      ]
    }
  ],
  "transcript_with_tool_calls": "array",
  "recording_url": "string",
  "public_log_url": "string",
  "knowledge_base_retrieved_contents_url": "string",
  "latency": {
    "e2e": { "p50": "number", "p90": "number", ... },
    "llm": { "p50": "number", "p90": "number", ... },
    "tts": { "p50": "number", "p90": "number", ... }
  },
  "disconnection_reason": "string",
  "call_analysis": {
    "call_summary": "string",
    "in_voicemail": "boolean",
    "user_sentiment": "string",
    "call_successful": "boolean",
    "custom_analysis_data": "object"
  },
  "call_cost": {
    "product_costs": "array",
    "total_duration_seconds": "number",
    "combined_cost": "number"
  },
  "metadata": "object",
  "retell_llm_dynamic_variables": "object",
  "collected_dynamic_variables": "object"
}
```

### Agent Object
```json
{
  "agent_id": "string",
  "version": "number",
  "is_published": "boolean",
  "response_engine": {
    "type": "retell-llm" | "custom-llm",
    "llm_id": "string",
    "version": "number"
  },
  "agent_name": "string",
  "voice_id": "string",
  "voice_model": "string",
  "fallback_voice_ids": ["string"],
  "voice_temperature": "number",
  "voice_speed": "number",
  "volume": "number",
  "responsiveness": "number",
  "interruption_sensitivity": "number",
  "enable_backchannel": "boolean",
  "backchannel_frequency": "number",
  "backchannel_words": ["string"],
  "reminder_trigger_ms": "number",
  "reminder_max_count": "number",
  "ambient_sound": "string",
  "ambient_sound_volume": "number",
  "language": "string",
  "webhook_url": "string",
  "boosted_keywords": ["string"],
  "pronunciation_dictionary": [
    {
      "word": "string",
      "alphabet": "ipa",
      "phoneme": "string"
    }
  ],
  "normalize_for_speech": "boolean",
  "end_call_after_silence_ms": "number",
  "max_call_duration_ms": "number",
  "post_call_analysis_data": "array",
  "begin_message_delay_ms": "number",
  "ring_duration_ms": "number",
  "last_modification_timestamp": "number"
}
```

## WebSocket Integration

### LLM WebSocket Protocol
- **Endpoint**: `wss://your-server/{call_id}`
- **Purpose**: Real-time communication with custom LLMs
- **Events**:
  - Config event (optional)
  - Response events
  - Update events (transcript updates)
  - Ping/pong for connection maintenance

### Event Types:
- `update_only`: Transcript updates, no response required
- `response_required`: Agent needs response from your server
- `reminder_required`: Reminder trigger event

## Custom Functions

### Function Integration
- **HTTP Methods**: POST, GET, PUT, PATCH, DELETE
- **Security**: X-Retell-Signature header for verification
- **Timeout**: 2 minutes default, retries up to 2 times
- **Parameters**: JSON schema format for POST/PUT/PATCH

### Request Structure:
```json
{
  "call": "call_object",
  "args": "function_arguments"
}
```

## SDKs Available

### Node.js SDK
```bash
npm install retell-sdk
```

### Python SDK
```bash
pip install retell-sdk
```

### Basic Usage:
```javascript
import Retell from 'retell-sdk';

const client = new Retell({
  apiKey: 'YOUR_RETELL_API_KEY',
});
```

## Error Handling

- **4xx errors**: Client errors (bad request, unauthorized, etc.)
- **5xx errors**: Server errors
- **Rate limiting**: Implemented on API endpoints
- **Webhook verification**: Required for security

## Key Features

1. **Real-time voice conversations** with AI agents
2. **WebSocket integration** for custom LLMs
3. **Post-call analytics** and sentiment analysis
4. **Custom function calling** for external API integration
5. **Knowledge base integration** for context-aware responses
6. **Multi-language support** and voice customization
7. **Batch calling** for scale operations
8. **Web calling** for browser-based interactions
9. **Phone number management** and telephony integration
10. **Comprehensive call recording** and transcription

## Rate Limits & Pricing

- API rate limits vary by endpoint
- Usage-based pricing model
- Separate costs for TTS, LLM usage, and telephony
- Real-time cost tracking in call objects

This documentation covers the complete Retell AI API surface area for building voice AI applications.