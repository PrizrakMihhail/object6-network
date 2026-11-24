import { requestData } from '../shared/supabase-api.js';

async function requestScores(options) {
  const response = await requestData('object6_scores', {
    ...options,
    timeout: 7000
  });
  if (!response.ok) throw new Error(`Score API HTTP ${response.status}`);
  return response;
}

export async function topScores(game) {
  const response = await requestScores({
    query: {
      game: `eq.${game}`,
      select: 'player_name,score',
      order: 'score.desc,created_at.asc,id.asc',
      limit: 5
    }
  });
  return response.json();
}

export function saveScore(game, score, name) {
  return requestScores({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ game, player_name: name, score })
  });
}
