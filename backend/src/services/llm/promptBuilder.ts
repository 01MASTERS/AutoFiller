import { FieldMetadata, UserProfile } from '@autofiller/shared';

export interface FieldMappingPrompt {
  systemPrompt: string;
  userPrompt: string;
  combinedPrompt: string;
}

export function buildFieldMappingPrompt(
  fields: FieldMetadata[],
  profile: UserProfile
): FieldMappingPrompt {
  const systemPrompt =
    'You are an intelligent form field auto-filler assistant. Given a list of web form fields and a user profile, your job is to match form fields to the correct profile values. Return ONLY a valid JSON object mapping each field\'s id string to the exact string value from the profile. Do not invent facts outside the profile.';

  const userPrompt = [
    'Form Fields:',
    JSON.stringify(fields, null, 2),
    '',
    'User Profile:',
    JSON.stringify(profile, null, 2),
    '',
    'Output format: JSON object with keys equal to field IDs and values equal to profile values. Example: {"entry.123": "Jane Doe"}'
  ].join('\n');

  const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

  return {
    systemPrompt,
    userPrompt,
    combinedPrompt
  };
}
