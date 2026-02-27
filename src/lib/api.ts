import type { Hero, Item, LockedInData } from './types';

const DEFAULT_API_BASE_URL = 'https://api.deadlock-api.com';
const ASSETS_API_BASE_URL = 'https://assets.deadlock-api.com';

async function fetchWithRetry(url: string, retries = 2): Promise<unknown> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'LockedIn/1.0' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
}

export async function fetchAllData(
  baseUrl = DEFAULT_API_BASE_URL,
  assetsUrl = ASSETS_API_BASE_URL
): Promise<LockedInData> {
  const settled = await Promise.allSettled([
    fetchWithRetry(`${assetsUrl}/v2/heroes`),
    fetchWithRetry(`${assetsUrl}/v2/items`),
  ]);

  const heroesRaw = settled[0].status === 'fulfilled' ? settled[0].value : [];
  const itemsRaw = settled[1].status === 'fulfilled' ? settled[1].value : [];

  if (settled[0].status === 'rejected') {
    console.error('Failed to fetch heroes:', (settled[0] as PromiseRejectedResult).reason?.message);
  }
  if (settled[1].status === 'rejected') {
    console.error('Failed to fetch items:', (settled[1] as PromiseRejectedResult).reason?.message);
  }

  // Filter heroes: only player-selectable, non-disabled
  const allHeroes = Array.isArray(heroesRaw) ? (heroesRaw as Hero[]) : [];
  const heroes = allHeroes.filter((h) => h.player_selectable && !h.disabled);

  // Items come as a flat array of abilities/weapons. Filter to hero abilities only.
  const allItems = Array.isArray(itemsRaw) ? (itemsRaw as Item[]) : [];

  return {
    heroes,
    items: allItems,
    buildInfo: {
      generatedAt: new Date().toISOString(),
    },
    baseUrl,
    assetsUrl,
  };
}
