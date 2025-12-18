import OpenAI from 'openai';

export interface ExtractionField {
  value: string | null;
  evidence: string | null;
}

export interface RawExtraction {
  title: ExtractionField;
  company: ExtractionField;
  location: ExtractionField;
  employment_type: ExtractionField;
  due_date: ExtractionField;
  notes: ExtractionField;
}

const SYSTEM_PROMPT = `You are a job posting data extractor. Extract structured information from job posting text.

CRITICAL RULES:
1. Only extract information that is EXPLICITLY stated in the provided text
2. Do NOT infer, guess, or make up any information
3. For each field, provide the exact text evidence (a direct quote) from the source
4. If a field is not explicitly mentioned, set both value and evidence to null
5. Keep evidence quotes short but complete enough to prove the value

Extract these fields:
- title: The job title/position name
- company: The company/organization name
- location: Where the job is located (city, state, remote, etc.)
- employment_type: Full-time, Part-time, Contract, etc.
- due_date: Application deadline or closing date. IMPORTANT:
  - If a specific date is mentioned, format as YYYY-MM-DD
  - If the posting EXPLICITLY states "rolling basis", "rolling admissions", "no deadline", "open until filled", or similar phrases indicating there is no fixed deadline, set value to "rolling"
  - Only set to "rolling" if the text explicitly mentions this - do NOT assume rolling if no date is mentioned
- notes: Any other notable information (salary, benefits, requirements summary)

Return ONLY valid JSON in this exact format:
{
  "title": { "value": "string or null", "evidence": "string or null" },
  "company": { "value": "string or null", "evidence": "string or null" },
  "location": { "value": "string or null", "evidence": "string or null" },
  "employment_type": { "value": "string or null", "evidence": "string or null" },
  "due_date": { "value": "string or null or 'rolling'", "evidence": "string or null" },
  "notes": { "value": "string or null", "evidence": "string or null" }
}`;

export async function extractJob(
  text: string,
  title: string | null,
  finalUrl: string
): Promise<RawExtraction> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const userPrompt = `Page title: ${title || 'Unknown'}
URL: ${finalUrl}

Job posting text:
${text.slice(0, 15000)}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0,
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const parsed = JSON.parse(content) as RawExtraction;
  return parsed;
}
