import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'AutoFiller',
  version: '0.0.1',
  description: 'Auto-fill Google Forms using AI-powered field matching',
  permissions: ['activeTab', 'storage'],
  host_permissions: ['https://docs.google.com/forms/*'],
  action: {
    default_popup: 'src/popup/popup.html',
  },
});
