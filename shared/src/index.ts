export interface HealthResponse {
  status: string;
  timestamp: string;
}

export type FieldControlType =
  | 'text'
  | 'textarea'
  | 'dropdown'
  | 'combobox'
  | 'radio'
  | 'checkbox'
  | 'date';

export type SelectionMode = 'single' | 'multiple';

export interface FieldOption {
  label: string;
  value?: string;
  selected?: boolean;
  disabled?: boolean;
}

export interface FieldMetadata {
  id: string;
  label: string;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
  type?: string;
  controlType?: FieldControlType;
  options?: FieldOption[];
  selectionMode?: SelectionMode;
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
  alternatePhone?: string;
  'alternate phone'?: string;
  address?: string;
  education?: Array<{
    degree?: string;
    school?: string;
    year?: string;
    [key: string]: unknown;
  }>;
  experience?: Array<{
    title?: string;
    company?: string;
    duration?: string;
    [key: string]: unknown;
  }>;
  skills?: string[];
  links?: Record<string, string>;
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FillResult {
  status: 'success' | 'partial' | 'error';
  filledCount: number;
  failedCount: number;
  filledFields: string[];
  failedFields: string[];
  failureReasons?: Record<string, string>;
  error?: string;
}

export interface ModelsResponse {
  status: 'success' | 'error';
  provider: 'ollama' | 'gemini';
  models: string[];
  error?: string;
}

export type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
export type LogSource =
  'EXTENSION_POPUP' | 'BACKGROUND' | 'CONTENT_SCRIPT' | 'BACKEND_API' | 'LLM_GATEWAY';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  tag: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface LogsResponse {
  status: 'success' | 'error';
  logs: LogEntry[];
  total: number;
  error?: string;
}
