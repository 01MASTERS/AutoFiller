export interface HealthResponse {
  status: string;
  timestamp: string;
}

export interface FieldMetadata {
  id: string;
  label: string;
  placeholder?: string;
  ariaLabel?: string;
  type?: string;
  required?: boolean;
}

export interface AutofillRequest {
  fields: FieldMetadata[];
  provider?: 'ollama' | 'gemini';
  model?: string;
}

export interface AutofillResponse {
  status: 'success' | 'error';
  mappings: Record<string, string>;
  error?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  address?: string;
  education?: Array<{
    degree: string;
    school: string;
    year?: string;
  }>;
  experience?: Array<{
    title: string;
    company: string;
    duration?: string;
  }>;
  skills?: string[];
  links?: Record<string, string>;
  custom?: Record<string, string>;
}
