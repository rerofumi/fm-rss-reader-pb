export type Genre = {
  id: string
  name: string
  createdAt?: string
  updatedAt?: string
}

export type Feed = {
  id: string
  url: string
  title?: string
  createdAt?: string
}

export type Article = {
  title: string
  link: string
  published?: string // ISO8601
  contentSnippet?: string // <= 400 chars server policy
  description?: string // <= 100 chars server policy
  feed?: { title?: string; url?: string }
}

export type LlmQueryType = 'summarize' | 'translate' | 'ask'

export type LlmQueryRequest = {
  type: LlmQueryType
  payload: Record<string, unknown>
  model?: string
  options?: { maxTokens?: number; temperature?: number; topP?: number }
}

export type LlmQueryResponse = {
  result: string | Record<string, unknown>
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  model?: string
}

export type McpToken = {
  id: string
  name?: string
  scopes?: string[]
  expiresAt?: string
  lastUsedAt?: string
  createdAt?: string
}

export type Toast = {
  id: string
  type: 'success' | 'warning' | 'error'
  message: string
}

export type User = {
  id: string
  email?: string
}