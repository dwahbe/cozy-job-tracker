import OpenAI from 'openai';
import type { StructuredJobData } from './fetchPage';

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

const openai = new OpenAI();

type FieldKey = keyof RawExtraction;

const FIELD_DESCRIPTIONS: Record<FieldKey, string> = {
  title: '- title: The job title/position name',
  company: '- company: The company/organization name',
  location: '- location: Where the job is located (city, state, remote, etc.)',
  employment_type: '- employment_type: Full-time, Part-time, Contract, etc.',
  due_date: `- due_date: Application deadline or closing date. IMPORTANT:
  - If a specific date is mentioned, format as YYYY-MM-DD
  - If the posting EXPLICITLY states "rolling basis", "rolling admissions", "no deadline", "open until filled", or similar phrases indicating there is no fixed deadline, set value to "rolling"
  - Only set to "rolling" if the text explicitly mentions this - do NOT assume rolling if no date is mentioned`,
  notes:
    '- notes: Concise supplementary details — prioritize: salary/compensation range, remote/hybrid/onsite policy if not already in location, visa sponsorship status. Keep to 2-3 short phrases max. Do NOT repeat the title, company, or location.',
};

const ALL_FIELDS: FieldKey[] = [
  'title',
  'company',
  'location',
  'employment_type',
  'due_date',
  'notes',
];

const EMPTY_FIELD: ExtractionField = { value: null, evidence: null };

function buildSystemPrompt(fields: FieldKey[]): string {
  const fieldDescs = fields.map((f) => FIELD_DESCRIPTIONS[f]).join('\n');
  const jsonTemplate = fields
    .map((f) => `  "${f}": { "value": "string or null", "evidence": "string or null" }`)
    .join(',\n');
  return `You are a job posting data extractor. Extract structured information from job posting text.

CRITICAL RULES:
1. Only extract information that is EXPLICITLY stated in the provided text
2. Do NOT infer, guess, or make up any information
3. For each field, provide the exact text evidence (a direct quote) from the source
4. If a field is not explicitly mentioned, set both value and evidence to null
5. Keep evidence quotes short but complete enough to prove the value

Extract these fields:
${fieldDescs}

Return ONLY valid JSON in this exact format:
{
${jsonTemplate}
}`;
}

function coveredFields(structured?: StructuredJobData): Set<FieldKey> {
  const covered = new Set<FieldKey>();
  if (!structured) return covered;
  if (structured.title) covered.add('title');
  if (structured.company) covered.add('company');
  if (structured.location) covered.add('location');
  if (structured.employmentType) covered.add('employment_type');
  if (structured.dueDate) covered.add('due_date');
  return covered;
}

function applyStructured(result: RawExtraction, structured?: StructuredJobData): RawExtraction {
  if (!structured) return result;
  if (structured.title) {
    result.title = { value: structured.title, evidence: `Title: ${structured.title}` };
  }
  if (structured.company) {
    result.company = { value: structured.company, evidence: `Company: ${structured.company}` };
  }
  if (structured.location) {
    result.location = {
      value: structured.location,
      evidence: `Location: ${structured.location}`,
    };
  }
  if (structured.employmentType) {
    result.employment_type = {
      value: structured.employmentType,
      evidence: `Employment Type: ${structured.employmentType}`,
    };
  }
  if (structured.dueDate) {
    result.due_date = {
      value: structured.dueDate,
      evidence: `Application Deadline: ${structured.dueDate}`,
    };
  }
  return result;
}

export async function extractJob(
  text: string,
  title: string | null,
  finalUrl: string,
  structured?: StructuredJobData
): Promise<RawExtraction> {
  const covered = coveredFields(structured);
  const fieldsNeeded = ALL_FIELDS.filter((f) => !covered.has(f));

  // When 4+ deterministic fields are already covered by JSON-LD, the body text
  // is largely redundant — JSON-LD's `Description:` block is already in the prefix.
  const richStructured = covered.size >= 4;
  const inputLimit = richStructured ? 4000 : 15000;

  const userPrompt = `Page title: ${title || 'Unknown'}
URL: ${finalUrl}

Job posting text:
${text.slice(0, inputLimit)}`;

  const systemPrompt = buildSystemPrompt(fieldsNeeded);

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from OpenAI');

      const llmResult = JSON.parse(content) as Partial<RawExtraction>;

      const merged: RawExtraction = {
        title: llmResult.title ?? EMPTY_FIELD,
        company: llmResult.company ?? EMPTY_FIELD,
        location: llmResult.location ?? EMPTY_FIELD,
        employment_type: llmResult.employment_type ?? EMPTY_FIELD,
        due_date: llmResult.due_date ?? EMPTY_FIELD,
        notes: llmResult.notes ?? EMPTY_FIELD,
      };

      return applyStructured(merged, structured);
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
