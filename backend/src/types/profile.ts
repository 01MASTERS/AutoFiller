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
  isOther: z.boolean().optional(),
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
      .enum(['text', 'textarea', 'dropdown', 'combobox', 'radio', 'checkbox', 'date', 'file'])
      .optional(),
    options: z.array(fieldOptionSchema).optional(),
    selectionMode: z.enum(['single', 'multiple']).optional(),
    required: z.boolean().optional(),
    platform: z
      .enum(['google-forms', 'greenhouse', 'lever', 'workday', 'smartrecruiters', 'generic'])
      .optional(),
    platformFieldType: z
      .enum(['personal', 'experience', 'custom_question', 'demographic', 'resume_upload', 'social_link', 'other'])
      .optional(),
    section: z.string().optional(),
    frameId: z.number().optional(),
  })
  .passthrough();

export const autofillRequestSchema = z.object({
  fields: z.array(fieldMetadataSchema).min(1, 'At least one field must be provided'),
  provider: z.enum(['ollama', 'gemini']).optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  profileId: z.string().optional(),
});

export const switchProfileRequestSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
});

export const createProfileRequestSchema = z.object({
  id: z
    .string()
    .min(1, 'Profile ID is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Profile ID must only contain letters, numbers, dashes, and underscores'),
  profile: userProfileSchema,
});

export type UserProfileValidated = z.infer<typeof userProfileSchema>;
export type AutofillRequestValidated = z.infer<typeof autofillRequestSchema>;
export type SwitchProfileRequestValidated = z.infer<typeof switchProfileRequestSchema>;
export type CreateProfileRequestValidated = z.infer<typeof createProfileRequestSchema>;

