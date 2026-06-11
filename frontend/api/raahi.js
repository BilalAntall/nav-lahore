import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { GoogleGenAI } from '@google/genai'

const geminiApiKey = envValue('GEMINI_API_KEY') || envValue('VITE_GEMINI_API_KEY')
const firebaseProjectId = envValue('FIREBASE_PROJECT_ID') || envValue('VITE_FIREBASE_PROJECT_ID')
const firebaseClientEmail = envValue('FIREBASE_CLIENT_EMAIL')
const firebasePrivateKey = normalizePrivateKey(envValue('FIREBASE_PRIVATE_KEY'))
const pineconeApiKey = envValue('PINECONE_API_KEY') || envValue('VITE_RAG_DB_KEY')
const pineconeHost = normalizeHost(
  envValue('PINECONE_INDEX_HOST') ||
    envValue('PINECONE_HOST') ||
    envValue('VITE_RAG_DB_URL'),
)
const pineconeNamespace = envValue('PINECONE_NAMESPACE') || '__default__'
const pineconeTextField = envValue('PINECONE_TEXT_FIELD') || 'chunk_text'
const geminiModel = envValue('GEMINI_MODEL') || 'gemini-2.5-flash'
const embeddingModel = envValue('GEMINI_EMBEDDING_MODEL') || 'gemini-embedding-2'
const raahiMessageLimit = 5
const raahiWindowHours = 24
const raahiWindowMs = raahiWindowHours * 60 * 60 * 1000

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { question, history = [] } = parseBody(request.body)
    if (!question || typeof question !== 'string') {
      return response.status(400).json({ error: 'Question is required.' })
    }

    if (!geminiApiKey) {
      return response.status(500).json({ error: 'RAAHI Bot is missing its Gemini API key.' })
    }

    const userId = await verifyRequestUser(request)
    const usage = await consumeRaahiMessage(userId)
    if (!usage.allowed) {
      return response.status(429).json({
        error: `RAAHI Bot message limit reached. Try again after ${formatResetTime(usage.resetAt)}.`,
        usage,
      })
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey })
    const snippets = await retrievePineconeContext({ ai, question })
    const prompt = buildPrompt({ question, history, snippets })
    const result = await generateRaahiAnswer({ ai, prompt })

    return response.status(200).json({
      answer: result.text || 'I could not form an answer right now. Please try again.',
      sources: snippets.map((snippet) => snippet.title).filter(Boolean),
      usage,
    })
  } catch (error) {
    const status = error.statusCode || 500
    return response.status(status).json({
      error: error.publicMessage || 'RAAHI Bot could not answer right now. Please try again in a moment.',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
    })
  }
}

async function verifyRequestUser(request) {
  const authHeader = request.headers.authorization || request.headers.Authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''

  if (!token) {
    throw publicError(401, 'Please sign in before using RAAHI Bot.')
  }

  try {
    const adminApp = getAdminApp()
    const decodedToken = await getAuth(adminApp).verifyIdToken(token)
    return decodedToken.uid
  } catch (error) {
    if (error.statusCode) throw error
    throw publicError(401, 'RAAHI Bot could not verify this session. Please sign out, sign in, and try again.')
  }
}

async function consumeRaahiMessage(userId) {
  const db = getFirestore(getAdminApp())
  const usageRef = db.collection('raahiUsage').doc(userId)
  const nowMs = Date.now()

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(usageRef)
    const usage = snapshot.data()?.usage ?? {}
    const savedWindowStart = timestampToMillis(usage.raahiBotWindowStartedAt)
    const windowExpired = !savedWindowStart || nowMs - savedWindowStart >= raahiWindowMs
    const windowStartMs = windowExpired ? nowMs : savedWindowStart
    const resetAtMs = windowStartMs + raahiWindowMs
    const currentCount = windowExpired ? 0 : Number(usage.raahiBotMessages ?? 0)

    if (currentCount >= raahiMessageLimit) {
      return usagePayload({
        allowed: false,
        count: currentCount,
        resetAtMs,
      })
    }

    const nextCount = currentCount + 1
    transaction.set(
      usageRef,
      {
        usage: {
          raahiBotLimit: raahiMessageLimit,
          raahiBotMessages: nextCount,
          raahiBotWindowResetAt: Timestamp.fromMillis(resetAtMs),
          raahiBotWindowStartedAt: Timestamp.fromMillis(windowStartMs),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    return usagePayload({
      allowed: true,
      count: nextCount,
      resetAtMs,
    })
  })
}

function getAdminApp() {
  const existingApp = getApps()[0]
  if (existingApp) return existingApp

  if (!firebaseProjectId) {
    throw publicError(500, 'RAAHI Bot usage guardrail is missing FIREBASE_PROJECT_ID.')
  }

  if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
    try {
      return initializeApp({
        credential: cert({
          projectId: firebaseProjectId,
          clientEmail: firebaseClientEmail,
          privateKey: firebasePrivateKey,
        }),
      })
    } catch {
      throw publicError(
        500,
        'RAAHI Bot Firebase Admin private key is not formatted correctly. Paste FIREBASE_PRIVATE_KEY from the service-account JSON exactly, with \\n preserved.',
      )
    }
  }

  throw publicError(
    500,
    'RAAHI Bot backend guardrail needs Firebase Admin service-account variables. Add FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.',
  )
}

function envValue(name) {
  const value = process.env[name]
  if (!value) return ''
  return stripWrappingQuotes(value.trim())
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function normalizePrivateKey(value) {
  return value.replace(/\\n/g, '\n')
}

function publicError(statusCode, publicMessage) {
  const error = new Error(publicMessage)
  error.statusCode = statusCode
  error.publicMessage = publicMessage
  return error
}

function usagePayload({ allowed, count, resetAtMs }) {
  return {
    allowed,
    count,
    limit: raahiMessageLimit,
    remaining: Math.max(0, raahiMessageLimit - count),
    resetAt: new Date(resetAtMs).toISOString(),
    windowHours: raahiWindowHours,
  }
}

async function generateRaahiAnswer({ ai, prompt }) {
  try {
    return await ai.models.generateContent({
      model: geminiModel,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    })
  } catch (error) {
    const message = error?.message || ''
    if (isQuotaError(message)) {
      throw publicError(429, 'RAAHI Bot hit the Gemini API quota/rate limit. Please wait a bit or check your Gemini API usage limits.')
    }

    throw publicError(502, 'RAAHI Bot could not get a response from Gemini right now. Please try again in a moment.')
  }
}

function isQuotaError(message) {
  return /quota|rate limit|resource exhausted|429/i.test(message)
}

function timestampToMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value._seconds === 'number') return value._seconds * 1000
  if (typeof value.seconds === 'number') return value.seconds * 1000
  if (typeof value === 'string') return Date.parse(value) || 0
  if (typeof value === 'number') return value
  return 0
}

function formatResetTime(value) {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Karachi',
  })
}

function parseBody(body) {
  if (!body) return {}
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }
  return body
}

async function retrievePineconeContext({ ai, question }) {
  if (!pineconeApiKey || !pineconeHost) return []

  const textSearch = await searchPineconeByText(question)
  if (textSearch.length) return textSearch

  return searchPineconeByVector({ ai, question })
}

async function searchPineconeByText(question) {
  const pineconeResponse = await fetch(
    `https://${pineconeHost}/records/namespaces/${encodeURIComponent(pineconeNamespace)}/search`,
    {
      method: 'POST',
      headers: pineconeHeaders(),
      body: JSON.stringify({
        query: {
          inputs: { text: question },
          top_k: 6,
        },
        fields: [pineconeTextField, 'text', 'content', 'title', 'station', 'line', 'route'],
      }),
    },
  )

  if (!pineconeResponse.ok) return []
  const payload = await pineconeResponse.json()
  return (payload.result?.hits ?? []).map((hit) => normalizeHit(hit))
}

async function searchPineconeByVector({ ai, question }) {
  const embedding = await ai.models.embedContent({
    model: embeddingModel,
    contents: question,
    config: {
      outputDimensionality: 768
    }
  })
  const values = embedding.embeddings?.[0]?.values || embedding.embedding?.values
  if (!values?.length) return []

  const pineconeResponse = await fetch(`https://${pineconeHost}/query`, {
    method: 'POST',
    headers: pineconeHeaders(),
    body: JSON.stringify({
      vector: values,
      topK: 6,
      includeMetadata: true,
      namespace: pineconeNamespace,
    }),
  })

  if (!pineconeResponse.ok) return []
  const payload = await pineconeResponse.json()
  return (payload.matches ?? []).map((match) => normalizeHit(match))
}

function normalizeHit(hit) {
  const fields = hit.fields || hit.metadata || {}
  const text =
    fields[pineconeTextField] ||
    fields.chunk_text ||
    fields.text ||
    fields.content ||
    fields.description ||
    JSON.stringify(fields)

  return {
    id: hit._id || hit.id,
    score: hit._score || hit.score,
    title: fields.title || fields.station || fields.line || fields.route || hit._id || hit.id,
    text,
  }
}

function buildPrompt({ question, history, snippets }) {
  const recentHistory = history
    .slice(-6)
    .map((message) => `${message.role === 'user' ? 'Rider' : 'RAAHI'}: ${message.text}`)
    .join('\n')
  const context = snippets.length
    ? snippets.map((snippet, index) => `Source ${index + 1}: ${snippet.text}`).join('\n\n')
    : 'No direct context retrieved from the database. Use your own knowledge and the Google Search tool to answer.'

  return `
You are RAAHI Bot, a helpful Lahore public transport assistant for NavLahore.
Use the retrieved transport context first. If the context does not contain the answer, use your own general knowledge and the Google Search tool to find the best route or answer for the rider. Never refuse to answer by saying the context is missing.
Keep answers concise, practical, and rider-facing.
Do not mention internal tools, databases, embeddings, APIs, Pinecone, Gemini, or RAG.

Recent conversation:
${recentHistory || 'None'}

Transport context:
${context}

Rider question:
${question}
`
}

function pineconeHeaders() {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Api-Key': pineconeApiKey,
    'X-Pinecone-Api-Version': '2026-04',
  }
}

function normalizeHost(value) {
  if (!value) return ''
  return value.replace(/^https?:\/\//, '').replace(/\/$/, '')
}
