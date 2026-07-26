/**
 * OpenAI JSON generation for arena agent turns (shared by orchestrator, workers, HTTP agents).
 */

import OpenAI from 'openai';

function getArenaModel(): string {
  return (process.env.OPENAI_ARENA_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6').trim();
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing.');
  return new OpenAI({ apiKey });
}

export async function generateArenaTurnJson(system: string, user: string): Promise<string> {
  const openai = getClient();
  const model = getArenaModel();
  const isGpt56Family = /^gpt-5\.6/i.test(model) || /^gpt-5(?!\.\d)/i.test(model);

  if (isGpt56Family && typeof (openai as any).responses?.create === 'function') {
    try {
      const response = await (openai as any).responses.create({
        model,
        reasoning: { effort: 'low' },
        input: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        text: { format: { type: 'json_object' } },
        max_output_tokens: 800,
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
    ...(isGpt56Family ? {} : { temperature: 0.95 }),
    max_tokens: 800,
  } as any);

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Agent returned empty response.');
  return content;
}
