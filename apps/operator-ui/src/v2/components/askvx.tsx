// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import {
  Send,
  Bot,
  User,
  Sparkles,
  Calendar,
  Users,
  Package,
  MessageCircle,
  BarChart3,
  Target,
  Lightbulb,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { api } from '../../lib/api'
import { trackEvent } from '../../lib/analytics'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
  suggestions?: string[]
}

interface QuickStartPrompt {
  icon: typeof Calendar
  title: string
  prompt: string
}

const QUICK_START_PROMPTS: QuickStartPrompt[] = [
  {
    icon: Calendar,
    title: 'Schedule Management',
    prompt: 'How do I manage my appointment schedule and set up automated reminders?',
  },
  {
    icon: Users,
    title: 'Client Management',
    prompt: 'What are the best ways to track client information and service history?',
  },
  {
    icon: Package,
    title: 'Inventory Tracking',
    prompt: 'How can I track my product inventory and set up reorder alerts?',
  },
  {
    icon: MessageCircle,
    title: 'Client Communication',
    prompt: 'What are effective strategies for follow-up messages and upselling products?',
  },
  {
    icon: BarChart3,
    title: 'Business Analytics',
    prompt: 'How do I track my business performance and understand key metrics?',
  },
  {
    icon: Target,
    title: 'Marketing Strategies',
    prompt: 'What marketing automation features help grow my beauty business?',
  },
]

const DEFAULT_SUGGESTIONS = [
  'How do I set up automated reminders?',
  'What’s the best way to upsell products?',
  'Show me the inventory management features',
  'Help me understand my analytics',
  'How can I improve client retention?',
  'What marketing tools are available?',
]

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-message',
  role: 'assistant',
  content:
    "Hello! I'm your VX Assistant, here to help you master your beauty business platform and grow your success. I can help you with scheduling, client management, inventory tracking, marketing strategies, and much more!\n\nHow can I assist you today?",
  createdAt: new Date(),
  suggestions: [
    'Show me how to use the dashboard',
    'Help with client management',
    'Explain the inventory features',
    'Marketing tips for my business',
  ],
}

const buildSessionId = () => {
  const key = 'bvx_chat_session'
  const existing = typeof window !== 'undefined' ? localStorage.getItem(key) : null
  if (existing) return existing
  const sid = `s_${Math.random().toString(36).slice(2, 10)}`
  try {
    localStorage.setItem(key, sid)
  } catch {}
  return sid
}

const toChatMessage = (message: any): ChatMessage | null => {
  if (!message || (message.role !== 'user' && message.role !== 'assistant')) return null
  return {
    id: String(message.id || `${message.role}-${Date.now()}`),
    role: message.role,
    content: String(message.content || ''),
    createdAt: message.created_at ? new Date(message.created_at) : new Date(),
    suggestions: Array.isArray(message.suggestions)
      ? message.suggestions.map((s: unknown) => String(s)).slice(0, 4)
      : undefined,
  }
}

export function AskVX() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sessionId] = useState(buildSessionId)
  const [draftingFollowups, setDraftingFollowups] = useState(false)

  const messagesRef = useRef<ChatMessage[]>(messages)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const streamTimerRef = useRef<number | null>(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [messages, isTyping])

  useEffect(() => {
    return () => {
      if (streamTimerRef.current) {
        window.clearInterval(streamTimerRef.current)
        streamTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoadingHistory(true)
        const query = `/ai/chat/history?session_id=${encodeURIComponent(sessionId)}&limit=50`
        const history = await api.get(query)
        const historyMessages: ChatMessage[] = Array.isArray(history?.messages)
          ? history.messages
              .map(toChatMessage)
              .filter((msg): msg is ChatMessage => Boolean(msg))
          : []
        if (!cancelled) {
          if (historyMessages.length) {
            setMessages(historyMessages)
          } else {
            setMessages([WELCOME_MESSAGE])
          }
        }
      } catch {
        if (!cancelled) {
          setMessages([WELCOME_MESSAGE])
        }
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const canSend = inputValue.trim().length > 0 && !isTyping && !isStreaming

  const lastAssistantSuggestions = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((msg) => msg.role === 'assistant')
    if (lastAssistant?.suggestions?.length) return lastAssistant.suggestions
    return DEFAULT_SUGGESTIONS.slice(0, 3)
  }, [messages])

  const sendPrompt = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim()
      if (!trimmed || isTyping || isStreaming) return

      setErrorMessage(null)
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setInputValue('')
      setIsTyping(true)
      try {
        trackEvent('ask.prompt_submitted', { source: 'v2', length: trimmed.length })
      } catch {}

      try {
        const payloadMessages = messagesRef.current
          .concat(userMessage)
          .map(({ role, content }) => ({ role, content }))

        const response = await api.post(
          '/ai/chat/raw',
          {
            session_id: sessionId,
            messages: payloadMessages,
          },
          { timeoutMs: 120000 },
        )

        const assistantContent = String(response?.text || '').trim()
        const assistantSuggestions: string[] | undefined = Array.isArray(response?.suggestions)
          ? response.suggestions.map((s: unknown) => String(s)).filter(Boolean).slice(0, 4)
          : undefined

        const finalText = assistantContent || 'I’m here to help with anything on the platform—try asking about scheduling, clients, or analytics.'
        const assistantId = `assistant-${Date.now()}`
        const placeholder: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: new Date(),
          suggestions: undefined,
        }
        setMessages((prev) => [...prev, placeholder])
        setIsStreaming(true)

        const totalLength = finalText.length
        const step = Math.max(2, Math.floor(totalLength / 200) || 2)
        let index = 0

        if (streamTimerRef.current) {
          window.clearInterval(streamTimerRef.current)
          streamTimerRef.current = null
        }

        streamTimerRef.current = window.setInterval(() => {
          index = Math.min(totalLength, index + step)
          const chunk = finalText.slice(0, index)
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: chunk,
                    suggestions: index >= totalLength ? assistantSuggestions : msg.suggestions,
                  }
                : msg,
            ),
          )

          if (index >= totalLength) {
            if (streamTimerRef.current) {
              window.clearInterval(streamTimerRef.current)
              streamTimerRef.current = null
            }
            setIsStreaming(false)
            setIsTyping(false)
            try {
              trackEvent('ask.response_stream_complete', {
                source: 'v2',
                chars: finalText.length,
              })
            } catch {}
          }
        }, 20)
      } catch (error) {
        if (streamTimerRef.current) {
          window.clearInterval(streamTimerRef.current)
          streamTimerRef.current = null
        }
        setIsStreaming(false)
        const detail = error instanceof Error ? error.message : String(error)
        setErrorMessage(detail)
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-error-${Date.now()}`,
            role: 'assistant',
            content: `I ran into an issue fulfilling that request. ${detail}`,
            createdAt: new Date(),
          },
        ])
        setIsTyping(false)
      }
    },
    [isTyping, isStreaming, sessionId],
  )

  const handleQuickPrompt = (prompt: string) => {
    setInputValue(prompt)
    void sendPrompt(prompt)
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion)
    void sendPrompt(suggestion)
  }

  const handleSubmit = () => {
    void sendPrompt(inputValue)
  }

  const handleDraftFollowups = useCallback(async () => {
    if (draftingFollowups) return
    setDraftingFollowups(true)
    try {
      const tenantId = await getTenant()
      trackEvent('ask.followups.draft', { source: 'v2' })
      const response = await api.post(
        '/followups/draft_batch',
        {
          tenant_id: tenantId,
          scope: 'reengage_30d',
          template_id: 'reengage_30d',
        },
        { timeoutMs: 45000 },
      )
      const status = String(response?.status || 'queued')
      const message =
        status === 'ready'
          ? 'Drafted follow-up messages are ready in your To-Do list.'
          : 'Drafting follow-up messages now. You’ll see a notification as soon as they’re ready.'
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-followup-${Date.now()}`,
          role: 'assistant',
          content: message,
          createdAt: new Date(),
          suggestions: ['Open notifications', 'Show follow-ups'],
        },
      ])
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-followup-error-${Date.now()}`,
          role: 'assistant',
          content: `I couldn’t start that follow-up batch. ${detail}`,
          createdAt: new Date(),
        },
      ])
    } finally {
      setDraftingFollowups(false)
    }
  }, [draftingFollowups])

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-3xl font-bold tracking-tight text-black flex items-center space-x-3"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          <div className="p-2 bg-primary/10 rounded-full">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <span>AskVX Assistant</span>
        </h1>
        <p className="text-muted-foreground mt-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Your intelligent business companion for mastering the VX platform and growing your beauty business
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <Lightbulb className="h-5 w-5 text-primary" />
            <span>Quick Start</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {QUICK_START_PROMPTS.map((item) => {
              const IconComponent = item.icon
              return (
                <Button
                  key={item.prompt}
                  variant="outline"
                  className="justify-start text-left h-auto p-3 hover:bg-primary/5 hover:border-primary/30"
                  onClick={() => handleQuickPrompt(item.prompt)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-1 bg-primary/10 rounded">
                      <IconComponent className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">{item.title}</div>
                    </div>
                  </div>
                </Button>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="default"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleDraftFollowups}
              disabled={draftingFollowups}
            >
              {draftingFollowups ? (
                <span className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Queuing follow-ups…
                </span>
              ) : (
                <span className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Draft follow-up messages
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="h-[700px] flex flex-col overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>VX Assistant Chat</CardTitle>
              <p className="text-sm text-muted-foreground">Ask anything about your beauty business platform</p>
            </div>
            <Badge className="ml-auto bg-green-100 text-green-700 border-green-200">Online</Badge>
          </div>
        </CardHeader>

        <Separator />

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div ref={scrollContainerRef} className="p-4 space-y-4">
              {loadingHistory ? (
                <div className="text-sm text-muted-foreground">Loading your recent conversations…</div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                      <div className="flex items-start space-x-2">
                        {message.role === 'assistant' && (
                          <div className="p-2 bg-primary/10 rounded-full flex-shrink-0">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div
                          className={`rounded-lg p-4 ${
                            message.role === 'user' ? 'bg-primary text-primary-foreground ml-2' : 'bg-muted'
                          }`}
                        >
                          <div className="whitespace-pre-wrap text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            {message.content}
                          </div>
                          <div className="text-xs opacity-70 mt-2">
                            {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        {message.role === 'user' && (
                          <div className="p-2 bg-accent/10 rounded-full flex-shrink-0">
                            <User className="h-4 w-4 text-accent" />
                          </div>
                        )}
                      </div>

                      {message.role === 'assistant' && message.suggestions?.length ? (
                        <div className="mt-3 ml-12 space-y-2">
                          <p className="text-xs text-muted-foreground">Suggested follow-ups:</p>
                          <div className="flex flex-wrap gap-2">
                            {message.suggestions.map((suggestion) => (
                              <Button
                                key={suggestion}
                                variant="outline"
                                size="sm"
                                className="text-xs h-auto py-1 px-2 border-primary/30 text-primary hover:bg-primary hover:text-white"
                                onClick={() => handleSuggestionClick(suggestion)}
                              >
                                {suggestion}
                                <ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
                          style={{ animationDelay: '0.1s' }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
                          style={{ animationDelay: '0.2s' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        <div className="p-4 flex-shrink-0 space-y-3">
          {errorMessage ? (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2 py-1">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex space-x-2">
            <Input
              placeholder="Ask me anything about your beauty business platform..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              className="flex-1"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
              disabled={isTyping}
            />
            <Button onClick={handleSubmit} disabled={!canSend} className="bg-primary text-white hover:bg-primary/90">
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Press Enter to send • This assistant provides guidance for using the VX platform
          </p>

          <div className="flex flex-wrap gap-2 justify-center">
            {lastAssistantSuggestions.map((suggestion) => (
              <Button key={suggestion} variant="ghost" size="sm" onClick={() => handleSuggestionClick(suggestion)}>
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
