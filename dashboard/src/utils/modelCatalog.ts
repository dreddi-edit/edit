export const MODEL_CATEGORIES = [
  { id: 'creative', name: 'Creative & Writing' },
  { id: 'coding', name: 'Coding & Logic' },
  { id: 'fast', name: 'Fast & Efficient' }
];

export type ModelCategoryId = 'creative' | 'coding' | 'fast';

export const MODELS = [
  { id: 'claude-3-opus-20240229', name: 'Claude 4.6 Opus', provider: 'anthropic', tier: 'enterprise', category: 'coding' },
  { id: 'claude-3-5-sonnet-20240620', name: 'Claude 4.6 Sonnet', provider: 'anthropic', tier: 'pro', category: 'coding' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 4.5 Haiku', provider: 'anthropic', tier: 'starter', category: 'fast' },
  { id: 'gemini-3-1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'gemini', tier: 'enterprise', category: 'creative' },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', provider: 'gemini', tier: 'pro', category: 'fast' },
  { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 Versatile', provider: 'groq', tier: 'basis', category: 'fast' }
];

export const getCategoryModels = (categoryId: ModelCategoryId) => {
  return MODELS.filter(m => m.category === categoryId);
};
