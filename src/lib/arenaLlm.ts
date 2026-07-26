/**
 * OpenAI JSON generation for arena agent turns (shared by orchestrator, workers, HTTP agents).
 */

import OpenAI from 'openai';

function getArenaModel(): string {
  return (process.env.OPENAI_ARENA_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4-pro').trim();
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing.');
  return new OpenAI({ apiKey });
}

/** GPT-5.x / o-series: use Responses API + reasoning. */
function usesResponsesReasoning(model: string): boolean {
  return /^gpt-5/i.test(model) || /^o[1-9]/i.test(model);
}

function getArenaReasoningEffort(): 'low' | 'medium' | 'high' | 'xhigh' {
  const v = (
    process.env.OPENAI_ARENA_REASONING_EFFORT ||
    process.env.OPENAI_REASONING_EFFORT ||
    'high'
  )
    .trim()
    .toLowerCase();
  if (v === 'low' || v === 'medium' || v === 'high' || v === 'xhigh') return v;
  return 'high';
}

export async function generateArenaTurnJson(system: string, user: string): Promise<string> {
  const openai = getClient();
  const model = getArenaModel();
  const reasoning = usesResponsesReasoning(model);

  if (reasoning && typeof (openai as any).responses?.create === 'function') {
    try {
      const response = await (openai as any).responses.create({
        model,
        reasoning: { effort: getArenaReasoningEffort() },
        input: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        text: { format: { type: 'json_object' } },
        max_output_tokens: 1800,
      });
      const text =
        response.output_text ||
        response.output
          ?.flatMap((item: any) => item?.content || [])
          ?.filter((c: any) => c?.type === 'output_text' || c?.text)
          ?.map((c: any) => c.text || c.output_text || '')
          ?.join('') ||
        '';
      if (text?.trim()) return text;
    } catch (err: any) {
      console.warn('Arena Responses API failed, chat fallback:', err?.message || err);
    }
  }

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    ...(reasoning
      ? { max_completion_tokens: 1800 }
      : { temperature: 0.92, max_tokens: 1800 }),
  } as any);

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Agent returned empty response.');
  return content;
}
