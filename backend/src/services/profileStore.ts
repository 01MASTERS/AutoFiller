import fs from 'fs';
import path from 'path';
import { UserProfile } from '@autofiller/shared';
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
    'Work Authorization': 'US Citizen',
    'Preferred Salary': '$140,000',
  },
};

export class ProfileStore {
  private static getProfilePath(): string {
    return process.env.PROFILE_PATH || path.resolve(process.cwd(), 'profile.json');
  }

  public static getProfile(): UserProfile {
    const profilePath = this.getProfilePath();

    if (!fs.existsSync(profilePath)) {
      this.saveProfile(SAMPLE_PROFILE);
      return SAMPLE_PROFILE;
    }

    try {
      const rawData = fs.readFileSync(profilePath, 'utf-8');
      const json = JSON.parse(rawData);
      const validated = userProfileSchema.parse(json);
      return validated as UserProfile;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON format in profile file at ${profilePath}`);
      }
      throw error;
    }
  }

  public static saveProfile(profile: UserProfile): void {
    const profilePath = this.getProfilePath();
    const validated = userProfileSchema.parse(profile);
    fs.writeFileSync(profilePath, JSON.stringify(validated, null, 2), 'utf-8');
  }
}
