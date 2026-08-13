import { z } from 'zod';

export const userProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().optional(),
  education: z
    .array(
      z.object({
        degree: z.string(),
        school: z.string(),
        year: z.string().optional(),
      }),
    )
    .optional(),
  experience: z
    .array(
      z.object({
        title: z.string(),
        company: z.string(),
        duration: z.string().optional(),
      }),
    )
    .optional(),
  skills: z.array(z.string()).optional(),
  links: z.record(z.string()).optional(),
  custom: z.record(z.string()).optional(),
});

export const fieldMetadataSchema = z.object({
  id: z.string(),
  label: z.string(),
  placeholder: z.string().optional(),
  ariaLabel: z.string().optional(),
  type: z.string().optional(),
  required: z.boolean().optional(),
});

export const autofillRequestSchema = z.object({
  fields: z.array(fieldMetadataSchema).min(1, 'At least one field must be provided'),
  provider: z.enum(['ollama', 'gemini']).optional(),
  model: z.string().optional(),
});

export type UserProfileValidated = z.infer<typeof userProfileSchema>;
export type AutofillRequestValidated = z.infer<typeof autofillRequestSchema>;
