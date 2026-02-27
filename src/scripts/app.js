/**
 * LockedIn — Client-side interactivity
 *
 * Handles theme toggling, navigation, filtering,
 * hero detail modals, player search, stats table,
 * and leaderboard for Deadlock.
 */

// ── Globals from page data ──
const dataEl = document.getElementById('app-data');
const DATA = dataEl ? JSON.parse(dataEl.dataset.payload || '{}') : {};
const API = 'https://api.deadlock-api.com';
const ASSETS_API = 'https://assets.deadlock-api.com';

const state = {
  tierLoaded: false,
  metaLoaded: false,
  lbLoaded: false,
  lbRegion: 'Europe',
};

// ── Utilities ──
const norm = (t) => (t || '').toString().toLowerCase().trim();
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ── Theme ──
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('li-theme', t);
  const b = document.getElementById('themeToggle');
  if (b) b.textContent = t === 'dark' ? 'Light Mode' : 'Dark Mode';
}

function initTheme() {
  const s = localStorage.getItem('li-theme');
  if (s) { setTheme(s); return; }
  setTheme(window.matchMedia?.('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
}

// ── Navigation ──
function setActiveNav(id) {
  document.querySelectorAll('.nav-link').forEach((b) =>
    b.classList.toggle('active', b.dataset.section === id)
  );
}

function showSection(id) {
  document.querySelectorAll('section.content').forEach((s) => {
    s.style.display = 'none';
  });
  const el = document.getElementById(id);
  if (el) {
    el.style.display = '';
    setActiveNav(id);
  }
  if (id === 'heroes' && !state.tierLoaded) {
    state.tierLoaded = true;
    buildTierList();
  }
  if (id === 'stats' && !state.metaLoaded) {
    state.metaLoaded = true;
    fetchHeroStats();
  }
  if (id === 'leaderboard' && !state.lbLoaded) {
    state.lbLoaded = true;
    fetchLeaderboard(state.lbRegion);
  }
}

// ── Hero Search (Heroes page) ──
function filterHeroes(query) {
  const q = norm(query);
  document.querySelectorAll('.hero-card').forEach((c) => {
    const name = c.dataset.heroName || '';
    const type = c.dataset.heroType || '';
    c.style.display = (!q || name.includes(q) || type.includes(q)) ? '' : 'none';
  });
}

// ── Hero Type Filter ──
function filterByType(type) {
  document.querySelectorAll('.type-filter').forEach((b) =>
    b.classList.toggle('active', b.dataset.type === type)
  );
  document.querySelectorAll('.hero-column').forEach((col) => {
    if (type === 'all') {
      col.style.display = '';
    } else {
      col.style.display = col.dataset.heroType === type ? '' : 'none';
    }
  });
}

// ── Tier List ──
async function buildTierList() {
  const body = document.getElementById('tierListBody');
  if (!body) return;

  try {
    const r = await fetch(API + '/v1/analytics/hero-stats?min_badge_level=0');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data || !data.length) {
      body.innerHTML = '<div class="tier-list-loading">No tier data available.</div>';
      return;
    }

    // Compute win rates
    const enriched = data.map((s) => {
      const hero = findHero(s.hero_id);
      const m = s.matches || 1;
      return {
        hero,
        hero_id: s.hero_id,
        win_rate: (s.wins / m) * 100,
        matches: m,
      };
    }).filter((s) => s.hero);

    // Group by tier
    const tiers = { S: [], A: [], B: [], C: [], D: [] };
    enriched.forEach((s) => {
      const t = getTier(s.win_rate);
      tiers[t.l].push(s);
    });

    // Sort within each tier by win rate desc
    Object.values(tiers).forEach((arr) => arr.sort((a, b) => b.win_rate - a.win_rate));

    const tierMeta = [
      { key: 'S', label: 'S', cls: 'tier-s', desc: 'Overpowered' },
      { key: 'A', label: 'A', cls: 'tier-a', desc: 'Strong' },
      { key: 'B', label: 'B', cls: 'tier-b', desc: 'Balanced' },
      { key: 'C', label: 'C', cls: 'tier-c', desc: 'Weak' },
      { key: 'D', label: 'D', cls: 'tier-d', desc: 'Underperforming' },
    ];

    let html = '';
    tierMeta.forEach((tm) => {
      const heroes = tiers[tm.key];
      html += '<div class="tier-row">';
      html += '<div class="tier-row-label ' + tm.cls + '"><span class="tier-row-letter">' + tm.label + '</span><span class="tier-row-desc">' + tm.desc + '</span></div>';
      html += '<div class="tier-row-heroes">';
      if (heroes.length === 0) {
        html += '<span class="tier-empty">No heroes</span>';
      } else {
        heroes.forEach((s) => {
          const img = s.hero.images?.icon_hero_card_webp || s.hero.images?.icon_hero_card || s.hero.images?.icon_image_small_webp || '';
          const name = s.hero.name;
          const type = s.hero.hero_type || '';
          const typeColor = 'var(--' + type + ', var(--muted))';
          html += '<button class="tier-hero" data-hero-id="' + s.hero_id + '" title="' + esc(name) + ' — ' + s.win_rate.toFixed(1) + '% WR">';
          html += '<img src="' + img + '" alt="' + esc(name) + '" loading="lazy"/>';
          html += '<span class="tier-hero-name">' + esc(name) + '</span>';
          html += '<span class="tier-hero-wr" style="color:' + (s.win_rate >= 50 ? 'var(--accent)' : typeColor) + '">' + s.win_rate.toFixed(1) + '%</span>';
          html += '</button>';
        });
      }
      html += '</div></div>';
    });

    body.innerHTML = html;

    // Bind click handlers on tier hero buttons
    body.querySelectorAll('.tier-hero').forEach((btn) => {
      btn.addEventListener('click', () => { if (btn.dataset.heroId) showHeroDetails(btn.dataset.heroId); });
    });

  } catch (e) {
    body.innerHTML = '<div class="tier-list-loading">Error loading tier data. Try refreshing.</div>';
  }
}

// ── Hero Detail Modal ──
function findHero(id) {
  return DATA.heroes?.find((h) => String(h.id) === String(id));
}

function showHeroDetails(heroId) {
  const hero = findHero(heroId);
  if (!hero) return;

  const modal = document.getElementById('heroModal');
  document.getElementById('modalHeroName').textContent = '';
  const det = document.getElementById('modalHeroDetails');
  det.innerHTML = '';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  const typeColor = 'var(--' + (hero.hero_type || 'brand') + ')';
  let h = '';

  // Header
  const portrait = hero.images?.icon_hero_card_webp || hero.images?.icon_hero_card || '';
  h += '<div class="hd-header">';
  h += '<img class="hd-portrait" src="' + portrait + '" alt="' + esc(hero.name) + '" />';
  h += '<div class="hd-info">';
  h += '<h2 class="hd-name">' + esc(hero.name) + '</h2>';
  h += '<span class="hd-type-pill ' + (hero.hero_type || '') + '">' + esc(hero.hero_type || 'Unknown') + '</span>';
  // description can be a string or {lore, role, playstyle}
  const desc = hero.description;
  if (desc) {
    if (typeof desc === 'object') {
      if (desc.role) h += '<p class="hd-desc"><strong>' + esc(desc.role) + '</strong></p>';
      if (desc.playstyle) h += '<p class="hd-desc">' + esc(desc.playstyle) + '</p>';
    } else {
      h += '<p class="hd-desc">' + esc(desc) + '</p>';
    }
  }

  // Tags
  if (hero.tags && hero.tags.length) {
    h += '<div class="hd-tags">';
    hero.tags.forEach((tag) => { h += '<span class="hd-tag">' + esc(tag) + '</span>'; });
    h += '</div>';
  }
  h += '</div></div>';

  // Complexity
  if (hero.complexity) {
    h += '<div class="hd-stats-section"><div class="hd-stats-bar"><h4>Complexity</h4></div>';
    h += '<div style="display:flex;gap:4px;margin-bottom:1rem">';
    for (let i = 1; i <= 4; i++) {
      const filled = i <= hero.complexity;
      h += '<span style="width:24px;height:8px;border-radius:4px;background:' + (filled ? typeColor : 'var(--surface-strong)') + '"></span>';
    }
    h += '</div></div>';
  }

  // BASE STATS — 3-column layout (Weapon · Vitality · Spirit)
  const sv = (v) => (v != null && typeof v === 'object' && 'value' in v) ? v.value : v;
  if (hero.starting_stats) {
    const ss = hero.starting_stats;
    const lu = hero.standard_level_up_upgrades || {};
    const pl = (v) => (v && v !== 0) ? '<span class="bs-per-level">+' + v + '</span>' : '';
    const bsr = (label, val, extra) => '<div class="bs-row"><span class="bs-label">' + esc(label) + '</span><span class="bs-value">' + val + (extra || '') + '</span></div>';
    const bsrP = (label, id) => '<div class="bs-row"><span class="bs-label">' + esc(label) + '</span><span class="bs-value" data-bs="' + id + '">—</span></div>';
    const wsd = hero.shop_stat_display?.weapon_stats_display;
    const attrLabels = { EWeaponAttribute_RapidFire:'Rapid Fire', EWeaponAttribute_MediumRange:'Medium Range', EWeaponAttribute_LongRange:'Long Range', EWeaponAttribute_ShortRange:'Short Range', EWeaponAttribute_SemiAutomatic:'Semi-Auto', EWeaponAttribute_FullAutomatic:'Full Auto', EWeaponAttribute_BurstFire:'Burst Fire', EWeaponAttribute_HeavyHitter:'Heavy Hitter', EWeaponAttribute_Projectile:'Projectile' };

    h += '<div class="hd-basestats"><h4>Base Stats</h4>';
    h += '<div class="bs-columns">';

    // ── Weapon column ──
    h += '<div class="bs-column"><div class="bs-col-head weapon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><path d="M20.2 20.2l-2.8-2.8M3.8 3.8l2.8 2.8M6.6 17.4l-2.8 2.8M17.4 6.6l2.8-2.8"/></svg>Weapon Stats</div>';
    if (wsd && wsd.weapon_attributes && wsd.weapon_attributes.length) {
      h += '<div class="bs-tags">';
      wsd.weapon_attributes.forEach((a) => { h += '<span class="bs-tag">' + esc(attrLabels[a] || a.replace(/EWeaponAttribute_/g,'').replace(/_/g,' ')) + '</span>'; });
      h += '</div>';
    }
    h += '<div class="bs-list">';
    h += bsrP('DPS', 'weapon-dps');
    h += bsrP('Bullet Damage', 'weapon-bdmg');
    h += bsrP('Ammo', 'weapon-ammo');
    h += bsrP('Bullets/sec', 'weapon-bps');
    h += bsrP('Reload Time', 'weapon-reload');
    const meleePL = lu.MODIFIER_VALUE_BASE_MELEE_DAMAGE_FROM_LEVEL;
    h += bsr('Light Melee', sv(ss.light_melee_damage), pl(meleePL));
    h += bsr('Heavy Melee', sv(ss.heavy_melee_damage), pl(meleePL));
    h += '</div>';
    if (wsd && (wsd.weapon_image_webp || wsd.weapon_image)) {
      h += '<div class="bs-weapon-img"><img src="' + (wsd.weapon_image_webp || wsd.weapon_image) + '" alt="Weapon" loading="lazy"/></div>';
    }
    h += '</div>';

    // ── Vitality column ──
    h += '<div class="bs-column"><div class="bs-col-head vitality"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>Vitality Stats</div>';
    h += '<div class="bs-list">';
    h += bsr('Health', sv(ss.max_health), pl(lu.MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL));
    h += bsr('Health Regen', sv(ss.base_health_regen ?? ss.health_regen));
    const bulletRes = sv(ss.bullet_armor_damage_reduction ?? ss.bullet_armor) || 0;
    h += bsr('Bullet Resist', bulletRes + '%', pl(lu.MODIFIER_VALUE_BULLET_ARMOR_DAMAGE_RESIST));
    const spiritRes = sv(ss.tech_armor_damage_reduction ?? ss.spirit_armor) || 0;
    h += bsr('Spirit Resist', spiritRes + '%', pl(lu.MODIFIER_VALUE_TECH_ARMOR_DAMAGE_RESIST));
    h += bsr('Move Speed', sv(ss.max_move_speed ?? ss.move_speed) + 'm/s');
    if (sv(ss.sprint_speed)) h += bsr('Sprint Speed', sv(ss.sprint_speed) + 'm/s');
    h += bsr('Stamina', sv(ss.stamina));
    const stRegen = sv(ss.stamina_regen_per_second);
    if (stRegen && stRegen > 0) h += bsr('Stamina Cooldown', (1 / stRegen).toFixed(1) + 's');
    h += '</div></div>';

    // ── Spirit column ──
    h += '<div class="bs-column"><div class="bs-col-head spirit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Spirit Stats</div>';
    h += '<div class="bs-list">';
    h += bsr('Spirit Power', '0', pl(lu.MODIFIER_VALUE_TECH_POWER));
    h += '</div></div>';

    h += '</div></div>';
  }

  // Abilities — placeholder, filled asynchronously
  if (hero.items && typeof hero.items === 'object') {
    const sigKeys = Object.keys(hero.items).filter((k) => k.startsWith('signature'));
    if (sigKeys.length) {
      h += '<div class="hd-abilities-section"><h4>Abilities</h4>';
      h += '<div id="abilities-container">';
      // Show skeleton placeholders while loading
      sigKeys.sort().forEach(() => {
        h += '<div class="ability-box ability-skeleton"><div class="ability-header"><div class="skeleton-circle"></div><div class="skeleton-lines"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div></div>';
      });
      h += '</div></div>';
    }
  }

  det.innerHTML = h;

  // Fetch and render rich ability details
  if (hero.items && typeof hero.items === 'object') {
    const sigKeys = Object.keys(hero.items).filter((k) => k.startsWith('signature')).sort();
    if (sigKeys.length) fetchAbilityDetails(hero, sigKeys);
  }
}

let _itemsCache = null;
async function fetchAbilityDetails(hero, sigKeys) {
  const container = document.getElementById('abilities-container');
  if (!container) return;

  try {
    // Cache the full items list — reuse for all heroes
    if (!_itemsCache) {
      const resp = await fetch('https://assets.deadlock-api.com/v2/items');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      _itemsCache = await resp.json();
    }
    const allItems = _itemsCache;

    // Build class_name → item lookup
    const itemMap = {};
    (Array.isArray(allItems) ? allItems : []).forEach((it) => { itemMap[it.class_name] = it; });

    let html = '';
    sigKeys.forEach((key, idx) => {
      const className = hero.items[key];
      const item = itemMap[className];
      if (!item) {
        // Fallback: just show prettified name
        const dn = prettyAbilityName(className);
        html += '<div class="ability-box"><div class="ability-header"><span class="ability-name">' + esc(dn) + '</span></div></div>';
        return;
      }

      const name = item.name || prettyAbilityName(className);
      const img = item.image_webp || item.image || '';
      const cd = item.properties?.AbilityCooldown?.value;
      const dur = item.properties?.AbilityDuration?.value;
      const range = item.properties?.AbilityCastRange?.value;
      const rawDesc = item.description;
      let desc = '';
      if (rawDesc && typeof rawDesc === 'object') {
        // Prefer tooltip_details for cleaner text, fallback to desc/quip
        const td = item.tooltip_details;
        if (td && td.info_sections && td.info_sections.length && td.info_sections[0].loc_string) {
          desc = td.info_sections[0].loc_string;
        } else {
          desc = rawDesc.desc || rawDesc.quip || '';
        }
      } else if (typeof rawDesc === 'string') {
        desc = rawDesc;
      }
      const isUlt = item.ability_type === 'ultimate';
      const upgrades = item.upgrades || [];

      html += '<div class="ability-box' + (isUlt ? ' ability-ultimate' : '') + '">';

      // Header row: icon + name/slot + stat badges
      html += '<div class="ability-header">';
      html += '<div class="ability-header-left">';
      if (img) html += '<img class="ability-image" src="' + img + '" alt="' + esc(name) + '" loading="lazy"/>';
      html += '<div class="ability-title-group">';
      html += '<span class="ability-name">' + esc(name) + '</span>';
      html += '<span class="ability-slot' + (isUlt ? ' ult' : '') + '">' + (isUlt ? 'Ultimate' : 'Ability ' + (idx + 1)) + '</span>';
      html += '</div></div>';

      // Stat badges
      html += '<div class="ability-stats">';
      if (cd && cd !== '0' && cd !== 0) {
        html += '<span class="ability-stat cd" title="Cooldown"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + cd + 's</span>';
      }
      if (dur && dur !== '0' && dur !== 0) {
        html += '<span class="ability-stat dur" title="Duration"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v4l2 2"/></svg>' + dur + 's</span>';
      }
      if (range && range !== '0' && range !== 0 && range !== '0m') {
        html += '<span class="ability-stat rng" title="Cast Range"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' + range + '</span>';
      }
      html += '</div></div>';

      // Description body
      if (desc) {
        let clean = desc;
        // Strip inline SVG icons (128x128 game damage-type icons)
        clean = clean.replace(/<svg[^>]*>[\s\S]*?<\/svg>\s*/gi, '');
        // Clean up game binding references like {g:citadel_binding:'Crouch'}
        clean = clean.replace(/\{g:citadel_binding:'([^']*)'\}/g, '[$1]');
        // Strip inline-attribute-label spans but keep their text
        clean = clean.replace(/<span class="inline-attribute-label[^"]*"[^>]*>/gi, '');
        // Remove leftover {s:sign} tokens
        clean = clean.replace(/\{s:sign\}/gi, '+');
        // Collapse excessive whitespace/newlines
        clean = clean.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (clean) {
          html += '<div class="ability-details"><div class="ability-desc">' + clean + '</div></div>';
        }
      }

      // Upgrade tiers
      if (upgrades.length) {
        html += '<div class="ability-upgrades">';
        upgrades.forEach((tier, ti) => {
          if (!tier.property_upgrades || !tier.property_upgrades.length) return;
          const tierLabel = (ti + 1);
          const bonuses = tier.property_upgrades.map((pu) => {
            const pName = prettyAbilityName(pu.name || '');
            const val = pu.bonus;
            const sign = (typeof val === 'number' && val > 0) ? '+' : (typeof val === 'string' && !val.startsWith('-') && !val.startsWith('+')) ? '+' : '';
            return sign + val + ' ' + pName;
          }).join(', ');
          html += '<div class="ability-tier"><span class="tier-badge">T' + tierLabel + '</span><span class="tier-text">' + esc(bonuses) + '</span></div>';
        });
        html += '</div>';
      }

      html += '</div>';
    });

    container.innerHTML = html;

    // ── Populate weapon stats from items cache ──
    const weaponCN = hero.items?.weapon_primary;
    if (weaponCN && itemMap[weaponCN]) {
      const wi = itemMap[weaponCN].weapon_info;
      if (wi) {
        const setBS = (id, val) => { const el = document.querySelector('[data-bs="' + id + '"]'); if (el) el.innerHTML = val; };
        const lu = hero.standard_level_up_upgrades || {};
        const pl = (v) => (v && v !== 0) ? '<span class="bs-per-level">+' + v + '</span>' : '';
        if (wi.damage_per_second != null) setBS('weapon-dps', wi.damage_per_second.toFixed(1));
        const bdmg = wi.bullet_damage ?? wi.damage_per_shot;
        if (bdmg != null) setBS('weapon-bdmg', (+bdmg).toFixed(1) + pl(lu.MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL));
        if (wi.clip_size != null) setBS('weapon-ammo', wi.clip_size);
        if (wi.bullets_per_second != null) setBS('weapon-bps', wi.bullets_per_second.toFixed(2));
        if (wi.reload_duration != null) setBS('weapon-reload', wi.reload_duration.toFixed(2) + 's');
      }
    }
  } catch (e) {
    console.warn('Failed to fetch ability details:', e);
    // Fallback: show just names
    let html = '';
    sigKeys.forEach((key) => {
      const dn = prettyAbilityName(hero.items[key]);
      html += '<div class="ability-box"><div class="ability-header"><span class="ability-name">' + esc(dn) + '</span></div></div>';
    });
    container.innerHTML = html;
  }
}

function prettyAbilityName(raw) {
  return String(raw || '').replace(/^(ability_|citadel_ability_)/i, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function closeModal() {
  const m = document.getElementById('heroModal');
  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');
}

// ── Player Search ──
function openPlayerModal(prefill) {
  const m = document.getElementById('playerModal');
  if (!m) return;
  m.classList.remove('hidden');
  const pi = document.getElementById('playerInput');
  if (pi && prefill) { pi.value = prefill; searchPlayer(); }
  else if (pi && !prefill) { pi.focus(); }
}

function closePlayerModal() {
  const m = document.getElementById('playerModal');
  if (!m) return;
  m.classList.add('hidden');
  const rd = document.getElementById('playerSearchResults');
  const pd = document.getElementById('playerProfile');
  if (rd) rd.innerHTML = '';
  if (pd) { pd.innerHTML = ''; pd.classList.add('hidden'); }
}

function overviewSearch() {
  const inp = document.getElementById('ovSearch');
  if (!inp) return;
  const v = inp.value.trim();
  if (!v) return;
  openPlayerModal(v);
}

async function searchPlayer() {
  const pi = document.getElementById('playerInput');
  const rd = document.getElementById('playerSearchResults');
  const pd = document.getElementById('playerProfile');
  if (!pi || !rd) return;
  const raw = pi.value.trim();
  if (!raw) { rd.innerHTML = '<div class="status">Enter a Steam username.</div>'; return; }
  rd.innerHTML = '<div class="status" style="animation:pulse 1.5s infinite">Searching...</div>';
  rd.classList.remove('hidden');
  if (pd) pd.classList.add('hidden');

  try {
    const r = await fetch(API + '/v1/players/steam-search?username=' + encodeURIComponent(raw));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data || !data.length) {
      rd.innerHTML = '<div class="status">No players found for "' + esc(raw) + '".</div>';
      return;
    }
    rd.innerHTML =
      '<div class="search-results-header"><h3>' + data.length + ' player' + (data.length !== 1 ? 's' : '') + ' found</h3></div>' +
      '<div class="player-results-grid">' +
      data.slice(0, 20).map((p) => {
        return '<div class="player-result-card" data-pid="' + esc(p.account_id || p.steam_id) + '">' +
          '<img class="player-result-avatar" src="' + (p.avatar_url || p.avatar || '') + '" alt="" loading="lazy" onerror="this.style.display=\'none\'" />' +
          '<div class="player-result-info"><h4>' + esc(p.persona_name || p.name || 'Unknown') + '</h4>' +
          '<p>' + esc(p.account_id || p.steam_id || '') + '</p></div></div>';
      }).join('') + '</div>';

    rd.querySelectorAll('.player-result-card').forEach((c) =>
      c.addEventListener('click', () => loadProfile(c.dataset.pid))
    );
  } catch (e) {
    rd.innerHTML = '<div class="status">Search error. Please try again.</div>';
  }
}

async function loadProfile(pid) {
  const rd = document.getElementById('playerSearchResults');
  const pd = document.getElementById('playerProfile');
  if (!pd) return;
  pd.classList.remove('hidden');
  pd.innerHTML = '<div class="status" style="animation:pulse 1.5s infinite">Loading profile...</div>';
  if (rd) rd.classList.add('hidden');

  try {
    const [r1, r2] = await Promise.allSettled([
      fetch(API + '/v1/players/' + encodeURIComponent(pid) + '/match-history?limit=20'),
      fetch(API + '/v1/players/' + encodeURIComponent(pid) + '/mmr-history'),
    ]);

    const matches = r1.status === 'fulfilled' && r1.value.ok ? await r1.value.json() : null;
    const mmr = r2.status === 'fulfilled' && r2.value.ok ? await r2.value.json() : null;

    let h = '<button type="button" class="btn btn-ghost btn-sm back-to-search" id="backBtn">\u2190 Back to results</button>';

    h += '<div class="player-profile-header">';
    h += '<div class="player-profile-info"><h3>Player ' + esc(pid) + '</h3>';
    if (mmr && mmr.length) {
      const latest = mmr[mmr.length - 1];
      if (latest.badge_level != null) {
        h += '<p>Current Badge Level: <strong>' + latest.badge_level + '</strong></p>';
      }
    }
    h += '</div></div>';

    // Match history
    if (matches && matches.length) {
      let wins = 0, losses = 0;
      matches.forEach((m) => { if (m.match_result === 'Win' || m.player_team_won) wins++; else losses++; });
      const wr = matches.length > 0 ? (wins / matches.length) * 100 : 0;

      h += '<h4 class="sub-title">Recent Matches (' + matches.length + ')</h4>';
      h += '<div class="donut-container">' + buildDonut(wr) +
        '<div class="donut-stats-side">' +
        '<div class="ds-row"><span class="ds-label">Matches</span><span class="ds-value">' + matches.length + '</span></div>' +
        '<div class="ds-row"><span class="ds-label">Wins</span><span class="ds-value" style="color:var(--accent)">' + wins + '</span></div>' +
        '<div class="ds-row"><span class="ds-label">Losses</span><span class="ds-value" style="color:var(--brawler)">' + losses + '</span></div>' +
        '</div></div>';

      // Hero usage from recent matches
      const heroMap = {};
      matches.forEach((m) => {
        const hid = m.hero_id;
        if (!hid) return;
        if (!heroMap[hid]) heroMap[hid] = { count: 0, wins: 0 };
        heroMap[hid].count++;
        if (m.match_result === 'Win' || m.player_team_won) heroMap[hid].wins++;
      });

      const heroEntries = Object.entries(heroMap).sort((a, b) => b[1].count - a[1].count).slice(0, 8);
      if (heroEntries.length) {
        const maxC = heroEntries[0][1].count;
        h += '<h4 class="sub-title">Most Played Heroes</h4><div class="hero-time-list">';
        heroEntries.forEach(([hid, st]) => {
          const hd = findHero(hid);
          const img = hd?.images?.icon_image_small_webp || hd?.images?.icon_image_small || '';
          const dn = hd?.name || 'Hero #' + hid;
          const bw = maxC > 0 ? (st.count / maxC) * 100 : 0;
          const heroWr = st.count > 0 ? (st.wins / st.count) * 100 : 0;
          const wc = heroWr >= 50 ? 'var(--accent)' : 'var(--brawler)';
          h += '<div class="hero-time-row">' +
            (img ? '<img src="' + img + '" alt="" loading="lazy"/>' : '<div></div>') +
            '<div><span class="htb-name">' + esc(dn) + '</span><div class="htb-bar"><div class="htb-bar-fill" style="width:' + bw.toFixed(1) + '%"></div></div></div>' +
            '<span class="hero-time-stats"><span style="color:' + wc + '">' + heroWr.toFixed(0) + '%</span> \u00b7 ' + st.count + ' games</span></div>';
        });
        h += '</div>';
      }
    } else {
      h += '<div class="status">No match history available or profile is private.</div>';
    }

    pd.innerHTML = h;
    document.getElementById('backBtn')?.addEventListener('click', backToSearch);
  } catch (e) {
    pd.innerHTML = '<button type="button" class="btn btn-ghost btn-sm back-to-search" id="backBtn">\u2190 Back</button><div class="status">Error loading profile.</div>';
    document.getElementById('backBtn')?.addEventListener('click', backToSearch);
  }
}

function backToSearch() {
  const rd = document.getElementById('playerSearchResults');
  const pd = document.getElementById('playerProfile');
  if (rd) rd.classList.remove('hidden');
  if (pd) pd.classList.add('hidden');
}

function buildDonut(wr) {
  const c = 251.2, d = (wr / 100) * c, col = wr >= 50 ? 'var(--accent)' : 'var(--brawler)';
  return '<div class="donut-chart"><svg viewBox="0 0 90 90"><circle class="donut-ring" cx="45" cy="45" r="40"/>' +
    '<circle class="donut-segment" cx="45" cy="45" r="40" stroke="' + col + '" stroke-dasharray="' + d.toFixed(1) + ' ' + c + '"/></svg>' +
    '<div class="donut-label"><span class="donut-value" style="color:' + col + '">' + wr.toFixed(1) + '%</span>' +
    '<span class="donut-desc">Win Rate</span></div></div>';
}

// ── Stats / Meta Table ──
let metaSortCol = 'winrate';
let metaSortDir = 'desc';
let metaData = null;

function getTier(wr) {
  if (wr >= 55) return { l: 'S', c: 'tier-s' };
  if (wr >= 52) return { l: 'A', c: 'tier-a' };
  if (wr >= 49) return { l: 'B', c: 'tier-b' };
  if (wr >= 46) return { l: 'C', c: 'tier-c' };
  return { l: 'D', c: 'tier-d' };
}

async function fetchHeroStats() {
  const statusEl = document.getElementById('metaStatus');
  const tbody = document.getElementById('metaBody');
  if (!tbody) return;
  if (statusEl) statusEl.textContent = 'Loading hero stats...';
  tbody.innerHTML = '<tr><td colspan="8"><div class="meta-empty" style="animation:pulse 1.5s infinite"><p>Loading...</p></div></td></tr>';

  const minBadge = document.getElementById('metaMinBadge')?.value || '0';
  const heroType = document.getElementById('metaHeroType')?.value || '';

  let url = API + '/v1/analytics/hero-stats?min_badge_level=' + minBadge;

  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="meta-empty"><p>No stats available.</p></div></td></tr>';
      if (statusEl) statusEl.textContent = 'No data found';
      return;
    }

    // Compute total matches across all heroes for pick rate
    const totalMatchesAll = data.reduce((sum, s) => sum + (s.matches || 0), 0);

    // Map hero IDs to hero data, compute rates, and filter by type
    let enriched = data.map((s) => {
      const hero = findHero(s.hero_id);
      const m = s.matches || 1;
      return {
        ...s,
        hero,
        hero_type: hero?.hero_type || '',
        win_rate: s.wins / m,
        pick_rate: totalMatchesAll > 0 ? m / totalMatchesAll : 0,
        avg_kills: (s.total_kills || 0) / m,
        avg_deaths: (s.total_deaths || 0) / m,
        avg_assists: (s.total_assists || 0) / m,
      };
    });

    if (heroType) {
      enriched = enriched.filter((s) => s.hero_type === heroType);
    }

    metaData = enriched;
    metaSortCol = 'winrate';
    metaSortDir = 'desc';
    sortAndRenderMeta();
    if (statusEl) statusEl.textContent = 'Showing ' + enriched.length + ' heroes';
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="meta-empty"><p>Error loading stats. Try again.</p></div></td></tr>';
    if (statusEl) statusEl.textContent = 'Error loading stats';
  }
}

function sortAndRenderMeta() {
  if (!metaData) return;
  const sorted = metaData.slice().sort((a, b) => {
    let va, vb;
    if (metaSortCol === 'hero') {
      va = (a.hero?.name || '').toLowerCase();
      vb = (b.hero?.name || '').toLowerCase();
      return metaSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    if (metaSortCol === 'type') {
      va = a.hero_type; vb = b.hero_type;
      return metaSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    if (metaSortCol === 'winrate') { va = a.win_rate ?? a.winrate ?? 0; vb = b.win_rate ?? b.winrate ?? 0; }
    else if (metaSortCol === 'pickrate') { va = a.pick_rate ?? a.pickrate ?? 0; vb = b.pick_rate ?? b.pickrate ?? 0; }
    else if (metaSortCol === 'matches') { va = a.total_matches ?? a.matches ?? 0; vb = b.total_matches ?? b.matches ?? 0; }
    else if (metaSortCol === 'kills') { va = a.avg_kills ?? a.kills ?? 0; vb = b.avg_kills ?? b.kills ?? 0; }
    else if (metaSortCol === 'deaths') { va = a.avg_deaths ?? a.deaths ?? 0; vb = b.avg_deaths ?? b.deaths ?? 0; }
    else if (metaSortCol === 'assists') { va = a.avg_assists ?? a.assists ?? 0; vb = b.avg_assists ?? b.assists ?? 0; }
    else { va = 0; vb = 0; }
    return metaSortDir === 'asc' ? va - vb : vb - va;
  });

  renderMetaRows(sorted);
}

function renderMetaRows(stats) {
  const tbody = document.getElementById('metaBody');
  if (!tbody) return;

  // Update sort indicators
  document.querySelectorAll('#metaTable thead th.sortable').forEach((th) => {
    const col = th.dataset.sort;
    th.classList.toggle('sort-active', col === metaSortCol);
    const existing = th.querySelector('.sort-arrow');
    if (existing) existing.remove();
    if (col === metaSortCol) {
      const arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      arrow.textContent = metaSortDir === 'asc' ? ' \u25B2' : ' \u25BC';
      th.appendChild(arrow);
    }
  });

  const maxPick = Math.max(...stats.map((s) => s.pick_rate ?? s.pickrate ?? 0));

  let rows = '';
  stats.forEach((s) => {
    const hero = s.hero;
    const portrait = hero?.images?.icon_image_small_webp || hero?.images?.icon_image_small || '';
    const name = hero?.name || 'Hero #' + s.hero_id;
    const type = s.hero_type || 'unknown';
    const typeColor = 'var(--' + type + ', var(--muted))';

    const wr = s.win_rate ?? s.winrate ?? 0;
    const pr = s.pick_rate ?? s.pickrate ?? 0;
    const matches = s.total_matches ?? s.matches ?? 0;
    const kills = s.avg_kills ?? s.kills ?? 0;
    const deaths = s.avg_deaths ?? s.deaths ?? 0;
    const assists = s.avg_assists ?? s.assists ?? 0;

    const tier = getTier(wr * 100);
    const wrPct = (wr * 100).toFixed(1);
    const prPct = (pr * 100).toFixed(2);
    const prW = maxPick > 0 ? (pr / maxPick) * 100 : 0;
    const wc = wr >= 0.5 ? 'var(--accent)' : 'var(--brawler)';

    rows += '<tr>' +
      '<td><div class="meta-hero-cell">' +
        (portrait ? '<img class="meta-hero-portrait" src="' + portrait + '" alt="" loading="lazy"/>' : '') +
        '<span>' + esc(name) + '</span></div></td>' +
      '<td><span style="color:' + typeColor + ';font-weight:600;text-transform:capitalize;font-family:Chakra Petch,system-ui,sans-serif;font-size:.78rem">' + esc(type) + '</span></td>' +
      '<td><div class="stat-bar-wrapper"><div class="stat-bar"><div class="stat-bar-fill winrate" style="width:' + wrPct + '%;background:' + wc + '"></div></div><span class="stat-value-label">' + wrPct + '%</span></div></td>' +
      '<td><div class="stat-bar-wrapper"><div class="stat-bar"><div class="stat-bar-fill pickrate" style="width:' + prW.toFixed(1) + '%"></div></div><span class="stat-value-label">' + prPct + '%</span></div></td>' +
      '<td>' + matches.toLocaleString() + '</td>' +
      '<td>' + (typeof kills === 'number' ? kills.toFixed(1) : kills) + '</td>' +
      '<td>' + (typeof deaths === 'number' ? deaths.toFixed(1) : deaths) + '</td>' +
      '<td>' + (typeof assists === 'number' ? assists.toFixed(1) : assists) + '</td>' +
    '</tr>';
  });

  tbody.innerHTML = rows || '<tr><td colspan="8"><div class="meta-empty"><p>No data.</p></div></td></tr>';
}

// ── Leaderboard ──
async function fetchLeaderboard(region) {
  state.lbRegion = region;
  const statusEl = document.getElementById('lbStatus');
  const tbody = document.getElementById('lbBody');
  if (!tbody) return;
  if (statusEl) statusEl.textContent = 'Loading ' + region + ' leaderboard...';
  tbody.innerHTML = '<tr class="lb-placeholder"><td colspan="5"><div class="lb-empty"><div class="loading-dots"><span></span><span></span><span></span></div><p>Loading...</p></div></td></tr>';

  // Update active region button
  document.querySelectorAll('.region-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.region === region)
  );

  try {
    const r = await fetch(API + '/v1/leaderboard/' + encodeURIComponent(region));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const raw = await r.json();
    // API returns { entries: [...] }
    const data = Array.isArray(raw) ? raw : (raw.entries || []);
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="lb-empty"><p>No leaderboard data available.</p></div></td></tr>';
      if (statusEl) statusEl.textContent = 'No data for ' + region;
      return;
    }

    let rows = '';
    data.slice(0, 100).forEach((entry) => {
      const rank = entry.rank ?? '-';
      const rankN = typeof rank === 'number' ? rank : 0;
      const rankClass = rankN === 1 ? 'top-1' : rankN === 2 ? 'top-2' : rankN === 3 ? 'top-3' : '';
      const name = entry.account_name || 'Unknown';
      const badge = entry.badge_level ?? '-';
      const rankedRank = entry.ranked_rank != null ? entry.ranked_rank : '-';
      const rankedSub = entry.ranked_subrank != null ? entry.ranked_subrank : '';
      const rankDisplay = rankedRank !== '-' ? rankedRank + (rankedSub ? '.' + rankedSub : '') : '-';

      // Show top hero names
      let topHeroes = '-';
      if (entry.top_hero_ids && entry.top_hero_ids.length) {
        topHeroes = entry.top_hero_ids.slice(0, 3).map((hid) => {
          const hd = findHero(hid);
          return hd ? esc(hd.name) : 'Hero #' + hid;
        }).join(', ');
      }

      rows += '<tr>' +
        '<td class="lb-rank-cell ' + rankClass + '">' + rank + '</td>' +
        '<td class="lb-player-cell">' +
          '<span>' + esc(name) + '</span>' +
        '</td>' +
        '<td class="lb-badge-cell">' + badge + '</td>' +
        '<td>' + rankDisplay + '</td>' +
        '<td>' + topHeroes + '</td>' +
      '</tr>';
    });

    tbody.innerHTML = rows;
    if (statusEl) statusEl.textContent = 'Showing top ' + Math.min(data.length, 100) + ' players in ' + region;
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="lb-empty"><p>Error loading leaderboard.</p></div></td></tr>';
    if (statusEl) statusEl.textContent = 'Error loading leaderboard';
  }
}

// ── Event Binding ──
function bind() {
  // Navigation
  document.querySelectorAll('.nav-link').forEach((b) =>
    b.addEventListener('click', () => showSection(b.dataset.section))
  );

  // Hero search
  const hs = document.getElementById('heroSearch');
  if (hs) hs.addEventListener('input', (e) => filterHeroes(e.target.value));

  // Hero card clicks → open detail modal
  document.querySelectorAll('.hero-card').forEach((c) =>
    c.addEventListener('click', () => { if (c.dataset.heroId) showHeroDetails(c.dataset.heroId); })
  );

  // Featured hero clicks
  document.querySelectorAll('.featured-hero').forEach((c) =>
    c.addEventListener('click', () => { if (c.dataset.heroId) showHeroDetails(c.dataset.heroId); })
  );

  // Quick links & overview stat cards
  document.querySelectorAll('.ql-card, .ov-stat').forEach((c) =>
    c.addEventListener('click', () => { if (c.dataset.section) showSection(c.dataset.section); })
  );

  // Overview search
  const oi = document.getElementById('ovSearch');
  if (oi) oi.addEventListener('keydown', (e) => { if (e.key === 'Enter') overviewSearch(); });
  const ob = document.getElementById('ovSearchBtn');
  if (ob) ob.addEventListener('click', overviewSearch);

  // Player search modal
  const pi = document.getElementById('playerInput');
  if (pi) pi.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchPlayer(); });
  const pb = document.getElementById('playerSearchBtn');
  if (pb) pb.addEventListener('click', searchPlayer);

  // Modal close
  const cb = document.getElementById('closeModalBtn');
  if (cb) cb.addEventListener('click', closeModal);
  const modal = document.getElementById('heroModal');
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  const pmc = document.getElementById('playerModalClose');
  if (pmc) pmc.addEventListener('click', closePlayerModal);
  const pm = document.getElementById('playerModal');
  if (pm) pm.addEventListener('click', (e) => { if (e.target === pm) closePlayerModal(); });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closePlayerModal(); } });

  // Theme toggle
  const tt = document.getElementById('themeToggle');
  if (tt) tt.addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

  // Product switcher
  const psBtn = document.getElementById('productSwitcherBtn');
  const psDrop = document.getElementById('productSwitcherDropdown');
  if (psBtn && psDrop) {
    psBtn.addEventListener('click', (e) => { e.stopPropagation(); psDrop.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => { if (!psDrop.contains(e.target) && e.target !== psBtn) psDrop.classList.add('hidden'); });
  }

  // Header search bar
  const hsb = document.getElementById('headerSearchBtn');
  const hsi = document.getElementById('headerSearchInput');
  const hsd = document.getElementById('headerSearch');
  if (hsb) hsb.addEventListener('click', () => {
    if (!hsd.classList.contains('open')) { hsd.classList.add('open'); hsi.focus(); return; }
    const v = hsi ? hsi.value.trim() : '';
    if (v) openPlayerModal(v);
  });
  if (hsi) hsi.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const v = hsi.value.trim(); if (v) openPlayerModal(v); }
    if (e.key === 'Escape') { hsd.classList.remove('open'); hsi.value = ''; }
  });

  // Stats table
  const metaRefresh = document.getElementById('metaRefresh');
  if (metaRefresh) metaRefresh.addEventListener('click', fetchHeroStats);

  // Stats sort
  document.querySelectorAll('#metaTable thead th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (metaSortCol === col) metaSortDir = metaSortDir === 'desc' ? 'asc' : 'desc';
      else { metaSortCol = col; metaSortDir = 'desc'; }
      sortAndRenderMeta();
    });
  });

  // Stats filter changes
  ['metaRegion', 'metaMinBadge', 'metaHeroType'].forEach((fid) => {
    const el = document.getElementById(fid);
    if (el) el.addEventListener('change', () => { if (metaData) fetchHeroStats(); });
  });

  // Leaderboard region buttons
  document.querySelectorAll('.region-btn').forEach((b) =>
    b.addEventListener('click', () => fetchLeaderboard(b.dataset.region))
  );
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  initTheme();
  bind();
  showSection('overview');
});

window.LockedIn = { showHeroDetails, closeModal, searchPlayer, loadProfile, backToSearch, fetchHeroStats, overviewSearch, openPlayerModal, closePlayerModal, fetchLeaderboard };
