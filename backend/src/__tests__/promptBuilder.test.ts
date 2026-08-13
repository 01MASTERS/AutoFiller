import { describe, it, expect } from 'vitest';
import { buildFieldMappingPrompt } from '../services/llm/promptBuilder.js';
import { FieldMetadata, UserProfile } from '@autofiller/shared';

describe('promptBuilder', () => {
  it('includes field metadata and user profile in the prompt', () => {
    const fields: FieldMetadata[] = [
      { id: 'entry.123', label: 'Full Name', required: true },
      { id: 'entry.456', label: 'Email Address' }
    ];

    const profile: UserProfile = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '555-0199'
    };

    const prompt = buildFieldMappingPrompt(fields, profile);

    expect(prompt.systemPrompt).toContain('auto-filler assistant');
    expect(prompt.userPrompt).toContain('entry.123');
    expect(prompt.userPrompt).toContain('Full Name');
    expect(prompt.userPrompt).toContain('Jane Doe');
    expect(prompt.userPrompt).toContain('jane@example.com');
    expect(prompt.combinedPrompt).toContain(prompt.systemPrompt);
    expect(prompt.combinedPrompt).toContain(prompt.userPrompt);
  });
});
