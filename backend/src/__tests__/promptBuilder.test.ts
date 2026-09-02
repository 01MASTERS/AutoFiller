import { describe, it, expect } from 'vitest';
import { buildFieldMappingPrompt } from '../services/llm/promptBuilder.js';
import { FieldMetadata, UserProfile } from '@autofiller/shared';

describe('promptBuilder', () => {
  it('includes field metadata and user profile in the prompt', () => {
    const fields: FieldMetadata[] = [
      { id: 'entry.123', label: 'Full Name', required: true },
      { id: 'entry.456', label: 'Email Address' },
    ];

    const profile: UserProfile = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '555-0199',
    };

    const prompt = buildFieldMappingPrompt(fields, profile);

    expect(prompt.systemPrompt).toContain('auto-filler assistant');
    expect(prompt.systemPrompt).toContain('Alternate Phone');
    expect(prompt.systemPrompt).toContain('Primary Phone');
    expect(prompt.userPrompt).toContain('entry.123');
    expect(prompt.userPrompt).toContain('Full Name');
    expect(prompt.userPrompt).toContain('Jane Doe');
    expect(prompt.userPrompt).toContain('jane@example.com');
    expect(prompt.combinedPrompt).toContain(prompt.systemPrompt);
    expect(prompt.combinedPrompt).toContain(prompt.userPrompt);
  });

  it('handles profiles with alternate phone and custom questions', () => {
    const fields: FieldMetadata[] = [
      { id: 'entry.101', label: 'Phone Number' },
      { id: 'entry.102', label: 'Alternate Phone Number' },
      { id: 'entry.103', label: 'Reason for leaving' },
    ];

    const profile: UserProfile = {
      name: 'Rittik Sharma',
      email: 'rittik@example.com',
      phone: '+91 9135517396',
      'alternate phone': '+91 8797966189',
      custom: {
        'Reason for leaving': 'Looking for full-time opportunity',
      },
    };

    const prompt = buildFieldMappingPrompt(fields, profile);

    expect(prompt.userPrompt).toContain('+91 9135517396');
    expect(prompt.userPrompt).toContain('+91 8797966189');
    expect(prompt.userPrompt).toContain('Reason for leaving');
    expect(prompt.systemPrompt).toContain('Disambiguation');
  });

  it('includes instructions for field formatting constraints and phone normalization', () => {
    const fields: FieldMetadata[] = [
      { id: 'entry.101', label: 'Mobile Number (without +91 or 0)' },
    ];
    const profile: UserProfile = {
      name: 'Rittik Sharma',
      email: 'rittik@example.com',
      phone: '+91 9135517396',
    };

    const prompt = buildFieldMappingPrompt(fields, profile);

    expect(prompt.systemPrompt).toContain('Field Formatting & Explicit Constraints');
    expect(prompt.systemPrompt).toContain('10-digit');
    expect(prompt.systemPrompt).toContain('without +91');
    expect(prompt.systemPrompt).toContain('9135517396');
    expect(prompt.userPrompt).toContain('respecting field formatting constraints');
  });
});
