import config from './supabase-config.js';

async function request(params, options = {}) {
  if (!config) throw new Error('Supabase is not configured');
  const url = new URL('/rest/v1/object6_scores', config.url);
  url.search = new URLSearchParams(params);
  const response = await fetch(url, {
    ...options,
    headers: { apikey: config.publishableKey, ...options.headers },
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error(`Score API HTTP ${response.status}`);
  return response;
}

export async function topScores(game) {
  const response = await request({
    game: `eq.${game}`,
    select: 'player_name,score',
    order: 'score.desc,created_at.asc,id.asc',
    limit: 5
  });
  return response.json();
}

export function saveScore(game, score, name) {
  return request({}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ game, player_name: name, score })
  });
}
