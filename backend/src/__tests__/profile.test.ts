import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../index.js';
import { ProfileStore } from '../services/profileStore.js';
import { setLLMGateway } from '../routes/api.js';
import { LLMGateway } from '../services/llm/gateway.js';
import { UserProfile } from '@autofiller/shared';

describe('Profile Management & Switching API', () => {
  const mapFieldsMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    const mockGateway = {
      mapFields: mapFieldsMock,
    } as unknown as LLMGateway;
    setLLMGateway(mockGateway);
  });

  afterAll(() => {
    // Ensure active profile is reset to default
    try {
      ProfileStore.setActiveProfile('default');
    } catch {}

    // Cleanup any created temp profile
    const testProfilePath = path.join(ProfileStore.getProfilesDir(), 'test-temp-persona.json');
    if (fs.existsSync(testProfilePath)) {
      fs.unlinkSync(testProfilePath);
    }
  });

  describe('GET /profile (Legacy compatibility)', () => {
    it('returns 200 OK with valid active profile JSON', async () => {
      const response = await request(app).get('/profile');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('phone');
      expect(typeof response.body.name).toBe('string');
    });

    it('preserves alternate phone and custom properties if present in profile', async () => {
      const response = await request(app).get('/profile');
      expect(response.status).toBe(200);
      if ('alternate phone' in response.body) {
        expect(typeof response.body['alternate phone']).toBe('string');
      }
      if (response.body.custom) {
        expect(typeof response.body.custom).toBe('object');
      }
    });
  });

  describe('GET /profiles', () => {
    it('returns 200 OK with list of profiles and activeProfileId', async () => {
      const response = await request(app).get('/profiles');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(typeof response.body.activeProfileId).toBe('string');
      expect(Array.isArray(response.body.profiles)).toBe(true);
      expect(response.body.profiles.length).toBeGreaterThanOrEqual(1);

      // Verify profile summary structure
      const activeSummary = response.body.profiles.find((p: { isActive: boolean }) => p.isActive);
      expect(activeSummary).toBeDefined();
      expect(activeSummary.id).toBe(response.body.activeProfileId);
      expect(activeSummary).toHaveProperty('name');
      expect(activeSummary).toHaveProperty('filename');
    });
  });

  describe('GET /profiles/:id', () => {
    it('returns 200 OK with profile data for existing profile', async () => {
      const response = await request(app).get('/profiles/product-manager');
      expect(response.status).toBe(200);
      expect(typeof response.body.name).toBe('string');
      expect(response.body.name.length).toBeGreaterThan(0);
      expect(response.body.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(Array.isArray(response.body.experience)).toBe(true);
      expect(response.body.experience.length).toBeGreaterThan(0);
    });

    it('returns 404 for non-existent profile ID', async () => {
      const response = await request(app).get('/profiles/non-existent-profile-xyz');
      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /profiles/switch', () => {
    it('switches active profile and updates subsequent GET /profile', async () => {
      // Switch to product-manager
      const switchRes = await request(app)
        .post('/profiles/switch')
        .send({ profileId: 'product-manager' });

      expect(switchRes.status).toBe(200);
      expect(switchRes.body.status).toBe('success');
      expect(switchRes.body.activeProfileId).toBe('product-manager');
      expect(typeof switchRes.body.profile.name).toBe('string');
      expect(switchRes.body.profile.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

      // Check active profile via GET /profile
      const activeRes = await request(app).get('/profile');
      expect(activeRes.status).toBe(200);
      expect(typeof activeRes.body.name).toBe('string');
      expect(activeRes.body.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(activeRes.body.email).toBe(switchRes.body.profile.email);

      // Switch back to default
      const resetRes = await request(app)
        .post('/profiles/switch')
        .send({ profileId: 'default' });
      expect(resetRes.status).toBe(200);
      expect(resetRes.body.activeProfileId).toBe('default');
    });

    it('returns 404 when switching to non-existent profile', async () => {
      const response = await request(app)
        .post('/profiles/switch')
        .send({ profileId: 'unknown-id-123' });

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
    });

    it('returns 400 when request body is missing profileId', async () => {
      const response = await request(app)
        .post('/profiles/switch')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  describe('CRUD operations: POST, PUT, DELETE /profiles', () => {
    const sampleNewProfile: UserProfile = {
      name: 'Test Persona',
      email: 'test.persona@example.com',
      phone: '+1 555-987-6543',
      address: '789 Testing Blvd, Austin, TX',
      skills: ['Go', 'Kubernetes'],
      experience: [
        {
          title: 'DevOps Engineer',
          company: 'CloudCo',
          duration: '2021 - Present',
        },
      ],
      custom: {
        Headline: 'DevOps & Cloud Engineer',
      },
    };

    it('POST /profiles creates a new profile and prevents duplicates', async () => {
      // Create new profile
      const createRes = await request(app)
        .post('/profiles')
        .send({
          id: 'test-temp-persona',
          profile: sampleNewProfile,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.status).toBe('success');
      expect(createRes.body.profileId).toBe('test-temp-persona');

      // Verify file was created and is retrievable
      const getRes = await request(app).get('/profiles/test-temp-persona');
      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe('Test Persona');

      // Conflict: Attempt to create same profile ID again
      const duplicateRes = await request(app)
        .post('/profiles')
        .send({
          id: 'test-temp-persona',
          profile: sampleNewProfile,
        });
      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error).toContain('already exists');
    });

    it('POST /profiles rejects invalid profile ID characters', async () => {
      const res = await request(app)
        .post('/profiles')
        .send({
          id: 'bad id with spaces!',
          profile: sampleNewProfile,
        });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('PUT /profiles/:id updates existing profile data', async () => {
      const updatedProfile = {
        ...sampleNewProfile,
        name: 'Updated Test Persona',
        skills: ['Go', 'Kubernetes', 'Terraform'],
      };

      const putRes = await request(app)
        .put('/profiles/test-temp-persona')
        .send(updatedProfile);

      expect(putRes.status).toBe(200);
      expect(putRes.body.status).toBe('success');

      // Verify changes persisted
      const getRes = await request(app).get('/profiles/test-temp-persona');
      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe('Updated Test Persona');
      expect(getRes.body.skills).toContain('Terraform');
    });

    it('DELETE /profiles/:id rejects deleting the currently active profile', async () => {
      const activeId = ProfileStore.getActiveProfileId();
      const delRes = await request(app).delete(`/profiles/${activeId}`);
      expect(delRes.status).toBe(400);
      expect(delRes.body.error).toContain('active profile');
    });

    it('DELETE /profiles/:id deletes profile and subsequent requests return 404', async () => {
      const delRes = await request(app).delete('/profiles/test-temp-persona');
      expect(delRes.status).toBe(200);
      expect(delRes.body.status).toBe('success');

      const getRes = await request(app).get('/profiles/test-temp-persona');
      expect(getRes.status).toBe(404);
    });

    it('DELETE /profiles/:id returns 404 for non-existent profile', async () => {
      const delRes = await request(app).delete('/profiles/non-existent-12345');
      expect(delRes.status).toBe(404);
    });
  });

  describe('POST /autofill with profileId override', () => {
    it('uses specified profileId when provided in autofill request', async () => {
      mapFieldsMock.mockResolvedValue({
        'entry.123': 'Test Value',
      });

      const payload = {
        fields: [{ id: 'entry.123', label: 'Full Name' }],
        provider: 'ollama',
        profileId: 'data-scientist',
      };

      const response = await request(app).post('/autofill').send(payload);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(mapFieldsMock).toHaveBeenCalledWith(
        'ollama',
        payload.fields,
        expect.objectContaining({
          name: expect.any(String),
          email: expect.stringMatching(/@/),
        }),
        { apiKey: undefined, model: undefined },
      );
    });

    it('uses active profile when profileId is not specified', async () => {
      mapFieldsMock.mockResolvedValue({
        'entry.123': 'Jane Doe',
      });

      const payload = {
        fields: [{ id: 'entry.123', label: 'Full Name' }],
        provider: 'ollama',
      };

      const response = await request(app).post('/autofill').send(payload);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      const activeProfile = ProfileStore.getProfile();
      expect(mapFieldsMock).toHaveBeenCalledWith(
        'ollama',
        payload.fields,
        expect.objectContaining({
          name: activeProfile.name,
        }),
        { apiKey: undefined, model: undefined },
      );
    });

    it('rejects path traversal in profileId with 400 Bad Request', async () => {
      const payload = {
        fields: [{ id: 'entry.123', label: 'Full Name' }],
        profileId: '../package.json',
      };
      const response = await request(app).post('/autofill').send(payload);
      expect(response.status).toBe(400);
    });
  });

  describe('Security & Path Traversal Prevention', () => {
    it('rejects invalid profileId with directory traversal in GET /profiles/:id', async () => {
      const response = await request(app).get('/profiles/..%2f..%2fetc%2fpasswd');
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Profile ID must only contain letters, numbers, dashes, and underscores');
    });

    it('rejects invalid profileId in POST /profiles/switch', async () => {
      const response = await request(app)
        .post('/profiles/switch')
        .send({ profileId: '../../../secret' });
      expect(response.status).toBe(400);
    });

    it('rejects invalid profileId in DELETE /profiles/:id', async () => {
      const response = await request(app).delete('/profiles/..%2f..%2fpackage');
      expect(response.status).toBe(400);
    });
  });
});

