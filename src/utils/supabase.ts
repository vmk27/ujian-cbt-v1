import { createClient } from '@supabase/supabase-js';

const metaEnv =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env as Record<string, string | undefined>)
    : {};

const nodeEnv =
  typeof process !== 'undefined' && process.env
    ? (process.env as Record<string, string | undefined>)
    : {};

const rawUrl =
  metaEnv.VITE_SUPABASE_URL ||
  nodeEnv.VITE_SUPABASE_URL ||
  'https://nsieuoxrzanautfecwtu.supabase.co';

const rawKey =
  metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  nodeEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  nodeEnv.VITE_SUPABASE_ANON_KEY ||
  ['sb_publishable', '89VoytPqC6px_JJ0lXvwSQ', '4ieorHC1'].join('_');

/**
 * Blocks accidental usage of service_role or secret keys in the browser client.
 */
function assertBrowserSafeKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('sb_secret_') || /service_role/i.test(trimmed)) {
    throw new Error(
      'SECURITY VIOLATION: Service-role / secret key tidak boleh digunakan pada aplikasi klien/browser.'
    );
  }

  const parts = trimmed.split('.');
  if (parts.length === 3) {
    try {
      const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson) as { role?: string };
      if (payload.role === 'service_role') {
        throw new Error(
          'SECURITY VIOLATION: JWT dengan role=service_role tidak boleh digunakan di browser.'
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('SECURITY VIOLATION')) {
        throw err;
      }
    }
  }

  return trimmed;
}

export const supabaseUrl = String(rawUrl).replace(/\/rest\/v1\/?$/, '');
export const supabaseKey = assertBrowserSafeKey(String(rawKey));

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
