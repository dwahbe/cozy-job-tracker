import type { RawPersonExtraction } from './extractPerson';

export interface ValidatedPerson {
  name: string | null;
  role: string | null;
  company: string | null;
  location: string | null;
  isVerified: boolean;
}

function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Validates that extraction evidence exists in the source text
 * and that values are contained within their evidence.
 * Prevents hallucination — identical pattern to job extraction validation.
 */
export function validatePersonExtraction(
  extraction: RawPersonExtraction,
  sourceText: string,
  title?: string | null
): ValidatedPerson {
  const fullSource = title ? `${title}\n${sourceText}` : sourceText;
  const normalizedText = normalizeWhitespace(fullSource.toLowerCase());

  function validateField(field: { value: string | null; evidence: string | null }): string | null {
    if (field.value === null || field.evidence === null) return null;

    const normalizedEvidence = normalizeWhitespace(field.evidence.toLowerCase());
    if (!normalizedText.includes(normalizedEvidence)) return null;

    const lowerValue = field.value.toLowerCase();
    if (!normalizedEvidence.includes(lowerValue)) return null;

    return field.value;
  }

  const name = validateField(extraction.name);
  const role = validateField(extraction.role);
  const company = validateField(extraction.company);
  const location = validateField(extraction.location);

  return {
    name,
    role,
    company,
    location,
    isVerified: name !== null,
  };
}
