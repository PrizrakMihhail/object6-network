import config from './supabase-config.js';

export function requestData(path, { query, timeout, ...options }) {
  if (!config) throw new Error('service_unavailable');

  const url = new URL(`/rest/v1/${path}`, config.url);
  if (query) url.search = new URLSearchParams(query);
  return fetch(url, {
    ...options,
    headers: { apikey: config.publishableKey, ...options.headers },
    signal: AbortSignal.timeout(timeout)
  });
}

export const hasSupabaseConfig = Boolean(config);
