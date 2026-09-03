import { z } from 'zod';

export const educationItemSchema = z
  .object({
    degree: z.string().optional(),
    school: z.string().optional(),
    year: z.string().optional(),
  })
  .passthrough();

export const experienceItemSchema = z
  .object({
    title: z.string().optional(),
    company: z.string().optional(),
    duration: z.string().optional(),
  })
  .passthrough();

export const userProfileSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(1, 'Phone is required'),
    alternatePhone: z.string().optional(),
    'alternate phone': z.string().optional(),
    address: z.string().optional(),
    education: z.array(educationItemSchema).optional(),
    experience: z.array(experienceItemSchema).optional(),
    skills: z.array(z.string()).optional(),
    links: z.record(z.string()).optional(),
    custom: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const fieldOptionSchema = z.object({
  label: z.string(),
  value: z.string().optional(),
  selected: z.boolean().optional(),
  disabled: z.boolean().optional(),
});

export const fieldMetadataSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    name: z.string().optional(),
    placeholder: z.string().optional(),
    ariaLabel: z.string().optional(),
    type: z.string().optional(),
    controlType: z
      .enum(['text', 'textarea', 'dropdown', 'combobox', 'radio', 'checkbox', 'date'])
      .optional(),
    options: z.array(fieldOptionSchema).optional(),
    selectionMode: z.enum(['single', 'multiple']).optional(),
    required: z.boolean().optional(),
  })
  .passthrough();

export const autofillRequestSchema = z.object({
  fields: z.array(fieldMetadataSchema).min(1, 'At least one field must be provided'),
  provider: z.enum(['ollama', 'gemini']).optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
});

export type UserProfileValidated = z.infer<typeof userProfileSchema>;
export type AutofillRequestValidated = z.infer<typeof autofillRequestSchema>;
