import { FieldMetadata, UserProfile } from '@autofiller/shared';

export interface FieldMappingPrompt {
  systemPrompt: string;
  userPrompt: string;
  combinedPrompt: string;
}

export function buildFieldMappingPrompt(
  fields: FieldMetadata[],
  profile: UserProfile,
): FieldMappingPrompt {
  const systemPrompt = [
    'You are an intelligent form field auto-filler assistant. Given a list of web form fields and a user profile, your job is to match form fields to the correct profile values.',
    '',
    'Rules:',
    '1. Return ONLY a valid JSON object mapping each matching field\'s "id" string to the exact string value from the profile.',
    '2. Primary Phone: For primary phone/mobile/contact fields (e.g. "Phone", "Phone Number", "Mobile Number", "Contact Number", "Primary Phone"), map to the primary phone number from the profile ("phone").',
    '3. Alternate Phone: For alternate/secondary/backup/emergency/WhatsApp phone fields (e.g. "Alternate Phone", "Alternate Phone Number", "Alternate Mobile", "Alternative Phone", "Secondary Phone", "Other Number", "WhatsApp Number", "Emergency Contact Number"), map to the alternate phone value from the profile ("alternate phone", "alternatePhone", "secondaryPhone", or secondary contact number in custom).',
    '4. Disambiguation: If a form contains both a primary phone field and an alternate phone field, do NOT map both to the same primary phone number if an alternate phone number is present in the profile. Map the primary phone field to the primary phone and the alternate phone field to the alternate phone.',
    '5. Custom Questions & Attributes: For custom questions, reasons (e.g., "reason for leaving", "notice period", "current location", "preferred location", "work authorization", etc.), or other profile attributes, inspect all profile properties (including top-level keys, "custom", "experience", "education", "links", etc.) and map the best matching value.',
    '6. Only map fields for which a corresponding value exists in the user profile. Do not invent facts outside the profile.',
    '7. If no matching value exists in the profile for a given field, do not include that field in the JSON output.',
  ].join('\n');

  const userPrompt = [
    'Form Fields:',
    JSON.stringify(fields, null, 2),
    '',
    'User Profile:',
    JSON.stringify(profile, null, 2),
    '',
    'Output format: JSON object with keys equal to field IDs and values equal to profile values. Example: {"entry.101": "Jane Doe", "entry.103": "+1 (555) 123-4567", "entry.105": "+1 (555) 987-6543"}',
  ].join('\n');

  const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

  return {
    systemPrompt,
    userPrompt,
    combinedPrompt,
  };
}
