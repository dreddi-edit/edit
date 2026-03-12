import { AI_PRICING } from "./config";

export const calculateCost = (model: string, inputTokens: number, outputTokens: number) => {
  const pricing = AI_PRICING[model] || AI_PRICING["claude-sonnet-4-6"];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
};

export const processAIResponse = (response: any) => {
  // Logic for cleaning and parsing AI code blocks
  if (!response) return null;
  return response.choices?.[0]?.message?.content || "";
};
