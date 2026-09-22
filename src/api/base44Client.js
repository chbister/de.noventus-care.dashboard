import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const url = new URL(window.location.href);
  url.searchParams.set('analytics-enable', 'false');
  window.history.replaceState({}, '', url);
}

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});
