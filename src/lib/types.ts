export interface Hero {
  id: number;
  class_name: string;
  name: string;
  description: {
    lore?: string;
    playstyle?: string;
    role?: string;
  };
  player_selectable: boolean;
  disabled: boolean;
  in_development: boolean;
  tags: string[];
  gun_tag?: string;
  hero_type: 'brawler' | 'marksman' | 'mystic' | 'assassin';
  complexity: number;
  images: {
    icon_hero_card: string;
    icon_hero_card_webp: string;
    icon_image_small: string;
    icon_image_small_webp: string;
    minimap_image: string;
    minimap_image_webp: string;
    hero_card_critical?: string;
    hero_card_critical_webp?: string;
    hero_card_gloat?: string;
    hero_card_gloat_webp?: string;
    top_bar_vertical_image?: string;
    top_bar_vertical_image_webp?: string;
    background_image?: string;
    background_image_webp?: string;
    name_image?: string;
  };
  items: Record<string, string>;
  starting_stats?: Record<string, number>;
  weapon_stats_display?: {
    display_stats: string[];
    other_display_stats: string[];
    weapon_attributes: string[];
    weapon_image?: string;
    weapon_image_webp?: string;
  };
}

export interface Item {
  id: number;
  class_name: string;
  name: string;
  image?: string;
  image_webp?: string;
  hero?: number;
  heroes: number[];
  type: 'weapon' | 'ability';
  ability_type?: 'signature' | 'ultimate';
  properties: Record<string, unknown>;
  upgrades?: Array<{
    property_upgrades: Array<{
      name: string;
      bonus: string | number;
    }>;
  }>;
  description?: Record<string, string>;
  videos?: {
    webm?: string;
    mp4?: string;
  };
}

export interface HeroStats {
  hero_id: number;
  hero_name?: string;
  wins: number;
  losses: number;
  matches: number;
  win_rate: number;
  pick_rate?: number;
  kills: number;
  deaths: number;
  assists: number;
}

export interface LeaderboardEntry {
  account_id: number;
  region_mode: string;
  leaderboard_rank: number;
  badge_level: number;
}

export interface BuildInfo {
  generatedAt: string;
}

export interface LockedInData {
  heroes: Hero[];
  items: Item[];
  buildInfo: BuildInfo;
  baseUrl: string;
  assetsUrl: string;
}
