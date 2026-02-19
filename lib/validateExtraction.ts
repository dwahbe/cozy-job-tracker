import type { RawExtraction } from './extractJob';

export interface ValidatedJob {
  title: string | null;
  company: string | null;
  location: string | null;
  employment_type: string | null;
  due_date: string | null;
  notes: string | null;
  isVerified: boolean;
  fetchedAt: string;
  finalUrl: string;
}

function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Validates that extraction evidence exists in the source text
 * and that values are contained within their evidence.
 * This prevents hallucination by the model.
 */
export function validateExtraction(
  extraction: RawExtraction,
  sourceText: string,
  fetchedAt: string,
  finalUrl: string
): ValidatedJob {
  const normalizedText = normalizeWhitespace(sourceText.toLowerCase());

  function validateField(
    field: { value: string | null; evidence: string | null },
    skipValueCheck = false
  ): string | null {
    if (field.value === null) {
      return null;
    }

    if (field.evidence === null) {
      return null;
    }

    const normalizedEvidence = normalizeWhitespace(field.evidence.toLowerCase());
    if (!normalizedText.includes(normalizedEvidence)) {
      return null;
    }

    if (!skipValueCheck) {
      const lowerValue = field.value.toLowerCase();
      if (!normalizedEvidence.includes(lowerValue)) {
        return null;
      }
    }

    return field.value;
  }

  const validatedTitle = validateField(extraction.title);
  const validatedCompany = validateField(extraction.company);
  const validatedLocation = validateField(extraction.location);
  const validatedEmploymentType = validateField(extraction.employment_type);
  const validatedDueDate = validateField(extraction.due_date, true); // Skip value check - date formatting varies
  const validatedNotes = validateField(extraction.notes, true);

  // isVerified is true if at least title AND company have verified evidence
  const isVerified = validatedTitle !== null && validatedCompany !== null;

  return {
    title: validatedTitle,
    company: validatedCompany,
    location: validatedLocation,
    employment_type: validatedEmploymentType,
    due_date: validatedDueDate,
    notes: validatedNotes,
    isVerified,
    fetchedAt,
    finalUrl,
  };
}
