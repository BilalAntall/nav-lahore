import { useState } from 'react'
import { Bot, Send } from 'lucide-react'
import { useRaahiUsage } from '../hooks/useFirestoreData.js'

export default function RaahiBotPage({ user }) {
  const [messages, setMessages] = useState([
    {
      id: 'intro',
      role: 'bot',
      text: 'Salaam, I am RAAHI Bot. Ask me about Lahore transport routes, stations, timings, or how to reach a stop.',
    },
  ])
  const [prompt, setPrompt] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [limitNotice, setLimitNotice] = useState('')
  const {
    applyUsage,
    count: usageCount,
    limit: usageLimit,
    remaining,
    resetAt,
    status: usageStatus,
  } = useRaahiUsage(user)
  const hasReachedLimit = remaining <= 0

  async function handleSubmit(event) {
    event.preventDefault()
    if (!prompt.trim() || isSending) return
    if (hasReachedLimit) {
      setLimitNotice(`This account has reached the ${usageLimit} message limit for RAAHI Bot.`)
      return
    }

    const question = prompt.trim()
    setIsSending(true)

    if (!user?.getIdToken) {
      setLimitNotice('Please sign in before using RAAHI Bot.')
      setIsSending(false)
      return
    }

    const nextMessages = [...messages, { id: `${Date.now()}-user`, role: 'user', text: question }]
    setMessages(nextMessages)
    setPrompt('')
    setLimitNotice('')

    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/raahi', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          history: messages.map(({ role, text }) => ({ role, text })),
        }),
      })
      const payload = await response.json()
      applyUsage(payload.usage)

      setMessages([
        ...nextMessages,
        {
          id: `${Date.now()}-bot`,
          role: 'bot',
          text: payload.answer || payload.error || 'I could not answer that right now. Please try again.',
          sources: payload.sources || [],
        },
      ])
      if (!response.ok) {
        setLimitNotice(payload.error || 'RAAHI Bot could not answer right now.')
      }
    } catch {
      setMessages([
        ...nextMessages,
        {
          id: `${Date.now()}-bot`,
          role: 'bot',
          text: 'I am having trouble connecting right now. Please try again in a moment.',
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="page-stack">
      <section className="page-hero bot-hero">
        <div>
          <p className="eyebrow">RAAHI Bot</p>
          <h1 className="page-title">Ask for route help in plain language.</h1>
          <p className="page-subtitle">
            RAAHI can help with station choices, transport modes, destination planning, and practical next steps for your Lahore journey.
            Never think you are alone 'cause RAAHI Bot got your back!
          </p>
        </div>
      </section>

      <section className="bot-shell bot-shell-single">
        <div className="bot-chat-card">
          <div className="bot-chat-header">
            <Bot size={22} />
            <div>
              <h2>RAAHI Bot</h2>
              <p>{isSending ? 'Thinking through your route...' : usageStatusLine({ remaining, resetAt, usageLimit })}</p>
            </div>
            <span className={hasReachedLimit ? 'usage-pill usage-pill-empty' : 'usage-pill'}>
              {usageStatus === 'syncing' ? 'Checking limit' : `${usageCount}/${usageLimit} used`}
            </span>
          </div>

          <div className="chat-stream">
            {messages.map((message) => (
              <div className={message.role === 'user' ? 'chat-bubble chat-bubble-user' : 'chat-bubble'} key={message.id}>
                <div>{message.text}</div>
                {message.sources && message.sources.length > 0 && (
                  <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', opacity: 0.7, borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '0.4rem' }}>
                    <strong>RAG Sources:</strong> {message.sources.join(', ')}
                  </div>
                )}
              </div>
            ))}
            {isSending ? <div className="chat-bubble chat-bubble-loading">RAAHI is checking the route details...</div> : null}
          </div>

          {limitNotice ? <p className="bot-limit-notice" role="status">{limitNotice}</p> : null}
          <form className="chat-form" onSubmit={handleSubmit}>
            <input
              disabled={hasReachedLimit || isSending}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={hasReachedLimit ? 'RAAHI message limit reached for this account' : 'Example: How do I get from Anarkali to Ali Town?'}
            />
            <button disabled={isSending || hasReachedLimit} type="submit" aria-label="Send message">
              <Send size={18} />
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}

function usageStatusLine({ remaining, resetAt, usageLimit }) {
  if (remaining > 0) return `${remaining} of ${usageLimit} messages left in this 24-hour window.`
  if (!resetAt) return `This account has reached the ${usageLimit} message limit.`

  return `Limit reached. Resets ${new Date(resetAt).toLocaleString([], {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  })}.`
}
