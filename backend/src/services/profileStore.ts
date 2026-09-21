import fs from 'fs';
import path from 'path';
import { UserProfile, ProfileSummary } from '@autofiller/shared';
import { userProfileSchema } from '../types/profile.js';

const SAMPLE_PROFILE: UserProfile = {
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
  phone: '+1 (555) 123-4567',
  address: '123 Innovation Way, San Francisco, CA 94105',
  education: [
    {
      degree: 'B.S. Computer Science',
      school: 'Stanford University',
      year: '2022',
    },
  ],
  experience: [
    {
      title: 'Software Engineer',
      company: 'TechCorp',
      duration: '2022 - Present',
    },
  ],
  skills: ['TypeScript', 'Node.js', 'React', 'Express', 'Python'],
  links: {
    LinkedIn: 'https://linkedin.com/in/janedoe',
    GitHub: 'https://github.com/janedoe',
    Portfolio: 'https://janedoe.dev',
  },
  custom: {
    Headline: 'Fullstack Software Engineer',
    'Work Authorization': 'US Citizen',
    'Preferred Salary': '$140,000',
  },
};

export class ProfileStore {
  /**
   * Resolves the profiles directory.
   * Prioritizes PROFILES_DIR environment variable, followed by local directory candidates.
   */
  public static getProfilesDir(): string {
    if (process.env.PROFILES_DIR) {
      return path.resolve(process.env.PROFILES_DIR);
    }
    const candidates = [
      path.resolve(process.cwd(), 'profiles'),
      path.resolve(process.cwd(), 'backend', 'profiles'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return candidates[0];
  }

  /**
   * Legacy single-file path helper (maintained for backward compatibility and test overrides).
   */
  private static getLegacyProfilePath(): string {
    if (process.env.PROFILE_PATH) return process.env.PROFILE_PATH;
    const candidates = [
      path.resolve(process.cwd(), 'profile.json'),
      path.resolve(process.cwd(), 'backend', 'profile.json'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return candidates[0];
  }

  /**
   * Ensures the profiles directory and default persona files are initialized.
   * Automatically copies existing legacy profile.json to default.json to prevent data loss.
   */
  public static ensureInitialized(): void {
    const dir = this.getProfilesDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const defaultProfilePath = path.join(dir, 'default.json');
    if (!fs.existsSync(defaultProfilePath)) {
      const legacyPath = this.getLegacyProfilePath();
      if (fs.existsSync(legacyPath)) {
        try {
          const raw = fs.readFileSync(legacyPath, 'utf-8');
          fs.writeFileSync(defaultProfilePath, raw, 'utf-8');
        } catch {
          fs.writeFileSync(defaultProfilePath, JSON.stringify(SAMPLE_PROFILE, null, 2), 'utf-8');
        }
      } else {
        fs.writeFileSync(defaultProfilePath, JSON.stringify(SAMPLE_PROFILE, null, 2), 'utf-8');
      }
    }

    const activePointerPath = path.join(dir, '.active');
    if (!fs.existsSync(activePointerPath)) {
      fs.writeFileSync(activePointerPath, 'default', 'utf-8');
    }
  }

  /**
   * Returns the current active profile identifier.
   */
  public static getActiveProfileId(): string {
    this.ensureInitialized();
    const activePointerPath = path.join(this.getProfilesDir(), '.active');
    if (fs.existsSync(activePointerPath)) {
      const id = fs.readFileSync(activePointerPath, 'utf-8').trim();
      if (id && fs.existsSync(path.join(this.getProfilesDir(), `${id}.json`))) {
        return id;
      }
    }
    return 'default';
  }

  /**
   * Sets the active profile and returns the active profile data.
   */
  public static setActiveProfile(profileId: string): UserProfile {
    this.ensureInitialized();
    const filePath = path.join(this.getProfilesDir(), `${profileId}.json`);
    if (!fs.existsSync(filePath)) {
      const err = new Error(`Profile "${profileId}" not found`);
      (err as unknown as { statusCode: number }).statusCode = 404;
      throw err;
    }

    const activePointerPath = path.join(this.getProfilesDir(), '.active');
    fs.writeFileSync(activePointerPath, profileId, 'utf-8');

    const profile = this.getProfile(profileId);

    // Mirror to legacy profile.json for backwards compatibility
    try {
      const legacyPath = this.getLegacyProfilePath();
      fs.writeFileSync(legacyPath, JSON.stringify(profile, null, 2), 'utf-8');
    } catch {}

    return profile;
  }

  /**
   * Lists all available persona profiles.
   */
  public static listProfiles(): ProfileSummary[] {
    this.ensureInitialized();
    const dir = this.getProfilesDir();
    const activeId = this.getActiveProfileId();

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    const summaries: ProfileSummary[] = [];

    for (const file of files) {
      const id = file.replace(/\.json$/, '');
      const filePath = path.join(dir, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(raw);
        const name = typeof json.name === 'string' ? json.name : id;
        const headline =
          (json.custom && typeof json.custom.Headline === 'string' && json.custom.Headline) ||
          (Array.isArray(json.experience) && json.experience[0]?.title) ||
          undefined;

        summaries.push({
          id,
          name,
          headline,
          filename: file,
          isActive: id === activeId,
        });
      } catch {
        summaries.push({
          id,
          name: id,
          filename: file,
          isActive: id === activeId,
        });
      }
    }

    // Sort active profile first, then alphabetically
    return summaries.sort((a, b) => {
      if (a.isActive) return -1;
      if (b.isActive) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Fetches the specified profile or active profile if omitted.
   */
  public static getProfile(profileId?: string): UserProfile {
    // If PROFILE_PATH is explicitly passed in environment and no profileId is asked, respect legacy override
    if (process.env.PROFILE_PATH && !profileId) {
      const legacyPath = process.env.PROFILE_PATH;
      if (!fs.existsSync(legacyPath)) {
        this.saveProfile(SAMPLE_PROFILE);
        return SAMPLE_PROFILE;
      }
      const rawData = fs.readFileSync(legacyPath, 'utf-8');
      return userProfileSchema.parse(JSON.parse(rawData)) as UserProfile;
    }

    this.ensureInitialized();
    const targetId = profileId || this.getActiveProfileId();
    const filePath = path.join(this.getProfilesDir(), `${targetId}.json`);

    if (!fs.existsSync(filePath)) {
      const err = new Error(`Profile "${targetId}" not found`);
      (err as unknown as { statusCode: number }).statusCode = 404;
      throw err;
    }

    try {
      const rawData = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(rawData);
      const validated = userProfileSchema.parse(json);
      return validated as UserProfile;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON format in profile file at ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Saves updates to an existing profile or the active profile.
   */
  public static saveProfile(profile: UserProfile, profileId?: string): void {
    this.ensureInitialized();
    const targetId = profileId || this.getActiveProfileId();
    const validated = userProfileSchema.parse(profile);
    const filePath = path.join(this.getProfilesDir(), `${targetId}.json`);

    fs.writeFileSync(filePath, JSON.stringify(validated, null, 2), 'utf-8');

    // Keep legacy file updated if active profile modified
    if (targetId === this.getActiveProfileId()) {
      try {
        const legacyPath = this.getLegacyProfilePath();
        fs.writeFileSync(legacyPath, JSON.stringify(validated, null, 2), 'utf-8');
      } catch {}
    }
  }

  /**
   * Creates a brand new persona profile.
   */
  public static createProfile(profileId: string, profile: UserProfile): void {
    this.ensureInitialized();
    if (!/^[a-zA-Z0-9_-]+$/.test(profileId)) {
      const err = new Error('Profile ID must only contain letters, numbers, dashes, and underscores');
      (err as unknown as { statusCode: number }).statusCode = 400;
      throw err;
    }

    const filePath = path.join(this.getProfilesDir(), `${profileId}.json`);
    if (fs.existsSync(filePath)) {
      const err = new Error(`Profile "${profileId}" already exists`);
      (err as unknown as { statusCode: number }).statusCode = 409;
      throw err;
    }

    const validated = userProfileSchema.parse(profile);
    fs.writeFileSync(filePath, JSON.stringify(validated, null, 2), 'utf-8');
  }

  /**
   * Deletes a persona profile. Disallows deleting the active profile.
   */
  public static deleteProfile(profileId: string): boolean {
    this.ensureInitialized();
    if (profileId === this.getActiveProfileId()) {
      const err = new Error('Cannot delete the currently active profile. Switch to another profile first.');
      (err as unknown as { statusCode: number }).statusCode = 400;
      throw err;
    }

    const filePath = path.join(this.getProfilesDir(), `${profileId}.json`);
    if (!fs.existsSync(filePath)) {
      const err = new Error(`Profile "${profileId}" not found`);
      (err as unknown as { statusCode: number }).statusCode = 404;
      throw err;
    }

    fs.unlinkSync(filePath);
    return true;
  }
}
