import OpenAI from 'openai';

export interface PersonExtractionField {
  value: string | null;
  evidence: string | null;
}

export interface RawPersonExtraction {
  name: PersonExtractionField;
  role: PersonExtractionField;
  company: PersonExtractionField;
  location: PersonExtractionField;
}

const openai = new OpenAI();

const SYSTEM_PROMPT = `You are a professional profile data extractor. Extract structured information from profile text (LinkedIn pages, email signatures, bios, etc.).

CRITICAL RULES:
1. Only extract information that is EXPLICITLY stated in the provided text
2. Do NOT infer, guess, or make up any information
3. For each field, provide the exact text evidence (a direct quote) from the source
4. If a field is not explicitly mentioned, set both value and evidence to null
5. Keep evidence quotes short but complete enough to prove the value

Extract these fields:
- name: The person's full name
- role: Their current job title or professional headline
- company: Their current company/organization
- location: Where they are based (city, state, country, etc.)

Return ONLY valid JSON in this exact format:
{
  "name": { "value": "string or null", "evidence": "string or null" },
  "role": { "value": "string or null", "evidence": "string or null" },
  "company": { "value": "string or null", "evidence": "string or null" },
  "location": { "value": "string or null", "evidence": "string or null" }
}`;

export async function extractPerson(
  text: string,
  title: string | null,
  sourceUrl?: string
): Promise<RawPersonExtraction> {
  const parts = [`Profile text:\n${text.slice(0, 15000)}`];
  if (title) parts.unshift(`Page title: ${title}`);
  if (sourceUrl) parts.unshift(`URL: ${sourceUrl}`);
  const userPrompt = parts.join('\n');

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 600,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from OpenAI');

      return JSON.parse(content) as RawPersonExtraction;
    } catch (error) {
      lastError = error;
      const isRetryable =
        error instanceof OpenAI.APIError && [429, 500, 503].includes(error.status);
      if (attempt === 0 && isRetryable) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}
