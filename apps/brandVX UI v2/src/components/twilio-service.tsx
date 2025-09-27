import { toast } from 'sonner@2.0.3'

// Twilio configuration interface
interface TwilioConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
}

// Mock client data structure
interface Client {
  id: string
  firstName: string
  lastName: string
  phone: string
  email?: string
  lastService?: string
  lastVisit?: string
}

// Message sending result
interface SendResult {
  success: boolean
  messageId?: string
  error?: string
  client: Client
}

// Get Twilio configuration from localStorage or environment
const getTwilioConfig = (): TwilioConfig | null => {
  try {
    // In a real app, this would come from secure storage or environment variables
    const config = localStorage.getItem('twilio_config')
    if (config) {
      return JSON.parse(config)
    }
    
    // Fallback to environment variables (for development)
    const accountSid = process.env.TWILIO_ACCOUNT_SID || 'YOUR_TWILIO_ACCOUNT_SID'
    const authToken = process.env.TWILIO_AUTH_TOKEN || 'YOUR_TWILIO_AUTH_TOKEN'
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER || 'YOUR_TWILIO_PHONE_NUMBER'
    
    if (accountSid && authToken && phoneNumber && 
        !accountSid.startsWith('YOUR_') && 
        !authToken.startsWith('YOUR_') && 
        !phoneNumber.startsWith('YOUR_')) {
      return { accountSid, authToken, phoneNumber }
    }
    
    return null
  } catch (error) {
    console.error('Error getting Twilio config:', error)
    return null
  }
}

// Get mock clients for the selected segment
const getClientsForSegment = (segmentId: string): Client[] => {
  // Mock client data - in a real app, this would come from your database
  const mockClients: Record<string, Client[]> = {
    'fresh-leads': [
      { id: '1', firstName: 'Emma', lastName: 'Johnson', phone: '+1234567890', email: 'emma.j@email.com' },
      { id: '2', firstName: 'Michael', lastName: 'Chen', phone: '+1234567891', email: 'michael.c@email.com' },
      { id: '3', firstName: 'Sofia', lastName: 'Rodriguez', phone: '+1234567892', email: 'sofia.r@email.com' }
    ],
    'post-service': [
      { id: '4', firstName: 'Ashley', lastName: 'Miller', phone: '+1234567893', lastService: 'Facial', lastVisit: '2024-01-20' },
      { id: '5', firstName: 'Jessica', lastName: 'Brown', phone: '+1234567894', lastService: 'Highlights', lastVisit: '2024-01-19' },
    ],
    'new-clients': [
      { id: '6', firstName: 'Rachel', lastName: 'Davis', phone: '+1234567895', lastService: 'Manicure', lastVisit: '2024-01-15' },
      { id: '7', firstName: 'Amanda', lastName: 'Wilson', phone: '+1234567896', lastService: 'Cut & Style', lastVisit: '2024-01-10' }
    ],
    'no-show': [
      { id: '8', firstName: 'Megan', lastName: 'Taylor', phone: '+1234567897' },
      { id: '9', firstName: 'Sarah', lastName: 'Anderson', phone: '+1234567898' }
    ],
    'win-back': [
      { id: '10', firstName: 'Lisa', lastName: 'Martinez', phone: '+1234567899', lastVisit: '2023-11-15' },
      { id: '11', firstName: 'Jennifer', lastName: 'Garcia', phone: '+1234567900', lastVisit: '2023-10-20' }
    ],
    'rebooking-reminders': [
      { id: '12', firstName: 'Nicole', lastName: 'Thomas', phone: '+1234567901', lastService: 'Color Touch-up', lastVisit: '2023-12-15' },
      { id: '13', firstName: 'Samantha', lastName: 'Jackson', phone: '+1234567902', lastService: 'Facial', lastVisit: '2023-12-20' }
    ],
    'loyal-clients': [
      { id: '14', firstName: 'Victoria', lastName: 'White', phone: '+1234567903', lastService: 'Full Service', lastVisit: '2024-01-18' },
      { id: '15', firstName: 'Stephanie', lastName: 'Harris', phone: '+1234567904', lastService: 'Spa Package', lastVisit: '2024-01-16' }
    ],
    'salon-anniversary': [
      { id: '16', firstName: 'Michelle', lastName: 'Clark', phone: '+1234567905', lastVisit: '2023-01-20' },
      { id: '17', firstName: 'Kimberly', lastName: 'Lewis', phone: '+1234567906', lastVisit: '2023-01-15' }
    ],
    'birthday': [
      { id: '18', firstName: 'Rebecca', lastName: 'Robinson', phone: '+1234567907' },
      { id: '19', firstName: 'Amy', lastName: 'Walker', phone: '+1234567908' }
    ]
  }
  
  return mockClients[segmentId] || []
}

// Personalize message for a specific client
const personalizeMessage = (template: string, client: Client, businessName: string = 'Your Beauty Studio'): string => {
  return template
    .replace(/\{firstName\}/g, client.firstName)
    .replace(/\{lastName\}/g, client.lastName)
    .replace(/\{businessName\}/g, businessName)
    .replace(/\{service\}/g, client.lastService || 'service')
    .replace(/\{bookingLink\}/g, 'https://yourbusiness.com/book')
    .replace(/\{reviewLink\}/g, 'https://g.page/yourbusiness/review')
    .replace(/\{careInstructions\}/g, 'Keep your skin hydrated and avoid direct sunlight for 24 hours.')
}

// Simulate sending SMS via Twilio
const sendSMSViaTwilio = async (to: string, message: string, config: TwilioConfig): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    // In a real implementation, you would use the Twilio SDK:
    // const client = twilio(config.accountSid, config.authToken)
    // const result = await client.messages.create({
    //   body: message,
    //   from: config.phoneNumber,
    //   to: to
    // })
    // return { success: true, messageId: result.sid }
    
    // For demo purposes, simulate API call with delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
    
    // Simulate occasional failures (10% failure rate)
    if (Math.random() < 0.1) {
      throw new Error('Network timeout - please try again')
    }
    
    // Generate mock message ID
    const messageId = `SM${Math.random().toString(36).substr(2, 9)}`
    
    return { success: true, messageId }
  } catch (error) {
    console.error('Twilio error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send message'
    }
  }
}

// Main function to send messages to a segment
export const sendMessagesToSegment = async (
  segmentId: string, 
  messageTemplate: string,
  businessName?: string
): Promise<{
  results: SendResult[]
  totalSent: number
  totalFailed: number
  errors: string[]
}> => {
  const config = getTwilioConfig()
  
  if (!config) {
    throw new Error('Twilio configuration not found. Please configure Twilio in Settings.')
  }
  
  const clients = getClientsForSegment(segmentId)
  if (clients.length === 0) {
    throw new Error('No clients found for this segment')
  }
  
  const results: SendResult[] = []
  const errors: string[] = []
  let totalSent = 0
  let totalFailed = 0
  
  // Send messages with a slight delay between each to avoid rate limiting
  for (const client of clients) {
    try {
      const personalizedMessage = personalizeMessage(messageTemplate, client, businessName)
      const result = await sendSMSViaTwilio(client.phone, personalizedMessage, config)
      
      if (result.success) {
        totalSent++
        results.push({
          success: true,
          messageId: result.messageId,
          client
        })
        
        toast.success(`Message sent to ${client.firstName}`, {
          description: `Delivered via SMS to ${client.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}`
        })
      } else {
        totalFailed++
        const errorMsg = `Failed to send to ${client.firstName}: ${result.error}`
        errors.push(errorMsg)
        results.push({
          success: false,
          error: result.error,
          client
        })
        
        toast.error(`Failed to send to ${client.firstName}`, {
          description: result.error
        })
      }
      
      // Small delay between messages to respect rate limits
      if (clients.indexOf(client) < clients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      totalFailed++
      const errorMsg = `Error sending to ${client.firstName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      errors.push(errorMsg)
      results.push({
        success: false,
        error: errorMsg,
        client
      })
    }
  }
  
  return {
    results,
    totalSent,
    totalFailed,
    errors
  }
}

// Check if Twilio is configured
export const isTwilioConfigured = (): boolean => {
  const config = getTwilioConfig()
  return config !== null
}

// Save Twilio configuration
export const saveTwilioConfig = (config: TwilioConfig): void => {
  try {
    localStorage.setItem('twilio_config', JSON.stringify(config))
    toast.success('Twilio configuration saved successfully')
  } catch (error) {
    console.error('Error saving Twilio config:', error)
    toast.error('Failed to save Twilio configuration')
  }
}

// Remove Twilio configuration
export const removeTwilioConfig = (): void => {
  try {
    localStorage.removeItem('twilio_config')
    toast.success('Twilio configuration removed')
  } catch (error) {
    console.error('Error removing Twilio config:', error)
    toast.error('Failed to remove Twilio configuration')
  }
}

// Get current Twilio configuration (for settings display)
export const getCurrentTwilioConfig = (): Partial<TwilioConfig> | null => {
  const config = getTwilioConfig()
  if (!config) return null
  
  // Return config with masked sensitive data for display purposes
  return {
    accountSid: config.accountSid.substring(0, 8) + '...',
    authToken: '***...',
    phoneNumber: config.phoneNumber
  }
}