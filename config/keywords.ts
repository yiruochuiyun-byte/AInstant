// Prefilter for general sources (HN, GitHub Trending, NVIDIA, ...). Cheap regex before paying for an LLM call.
export const AI_KEYWORDS =
  /\b(ai|a\.i\.|llms?|gpt[-\w.]*|claude|gemini|llama|mistral|qwen|deepseek|kimi|glm|grok|openai|anthropic|deepmind|hugging ?face|transformer|diffusion|agents?|agentic|rag|embedding|inference|fine[- ]?tun\w*|model|multimodal|text[- ]to[- ]\w+|speech[- ]to[- ]\w+|tts|asr|copilot|cursor|openrouter|voice|speech|open weights|neural|machine learning|ml|benchmark|token|prompt)\b|大模型|人工智能|智能体|模型/i;
