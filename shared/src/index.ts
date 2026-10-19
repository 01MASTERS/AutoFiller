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
  | 'date'
  | 'file';

export type FormPlatform = 'google-forms' | 'greenhouse' | 'lever' | 'workday' | 'smartrecruiters' | 'generic';

export type SelectionMode = 'single' | 'multiple';

export interface FieldOption {
  label: string;
  value?: string;
  selected?: boolean;
  disabled?: boolean;
  isOther?: boolean;
}

export type PlatformFieldType =
  | 'personal'
  | 'experience'
  | 'custom_question'
  | 'demographic'
  | 'resume_upload'
  | 'social_link'
  | 'source'
  | 'other';

export type OptionSource = 'static' | 'dynamic' | 'cascading';

export interface DynamicOptionState {
  isAsync?: boolean;
  requiresInputToSearch?: boolean;
  endpointUrl?: string;
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
  platform?: FormPlatform;
  platformFieldType?: PlatformFieldType;
  section?: string;
  frameId?: number;
  optionSource?: OptionSource;
  parentFieldId?: string;
  optionsLoaded?: boolean;
  dynamicState?: DynamicOptionState;
}

export interface AutofillRequest {
  fields: FieldMetadata[];
  provider?: 'ollama' | 'gemini';
  model?: string;
  profileId?: string;
}

export interface ProfileSummary {
  id: string;
  name: string;
  headline?: string;
  filename: string;
  isActive: boolean;
}

export interface ProfilesListResponse {
  status: 'success' | 'error';
  activeProfileId: string;
  profiles: ProfileSummary[];
  error?: string;
}

export interface SwitchProfileRequest {
  profileId: string;
}

export interface SwitchProfileResponse {
  status: 'success' | 'error';
  activeProfileId: string;
  message?: string;
  profile?: UserProfile;
  error?: string;
}

export type FieldMappingValue = string | string[] | boolean;

export interface AutofillResponse {
  status: 'success' | 'error';
  mappings: Record<string, FieldMappingValue>;
  error?: string;
  durationMs?: number;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  'alternate phone'?: string;
  alternatephone?: string;
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
  skippedCount: number;
  filledFields: string[];
  failedFields: string[];
  skippedFields: string[];
  failureReasons?: Record<string, string>;
  skippedReasons?: Record<string, string>;
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

export * from './fixtures/mockForms.js';
