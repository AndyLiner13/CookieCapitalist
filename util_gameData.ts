// #region 📋 README
// Shared game data types, constants, and utility functions for Cookie Clicker.
// This file contains no Component - it's a pure utility module.
// #endregion

import { NetworkEvent, LocalEvent, SerializableState } from "horizon/core";

// #region 🏷️ Type Definitions
// Serializable game state for persistence
export interface GameState {
  cookies: number;
  totalCookiesEarned: number;
  cookiesPerClick: number;
  upgrades: { [upgradeId: string]: number };
  lastSaveTime: number;
}

// Upgrade configuration (static data)
export interface UpgradeConfig {
  id: string;
  image: string;
  name: string;
  baseCost: number;
  cookiesPerSecond: number;
  rateDisplay: string;
}

// UI display data for an upgrade card
export interface UpgradeDisplayData {
  image: string;
  name: string;
  buyLabel: string;
  price: string;
  rate: string;
  buyCommand: () => void;
}

// Page types for navigation
export type PageType = "home" | "shop" | "stats";

// Network event payload types (these use index signatures for SerializableState compatibility)
export type GameEventPayload = {
  [key: string]: SerializableState;
  type: "cookie_clicked" | "buy_upgrade" | "request_state";
};

export type UIEventPayload = {
  [key: string]: SerializableState;
  type: "state_update" | "purchase_result";
};
// #endregion

// #region 🔌 Network Events
// Events sent from UI (client) to Game Manager (server)
export const GameEvents = {
  toServer: new NetworkEvent<GameEventPayload>("game_to_server"),
};

// Events sent from Game Manager (server) to UI (client)
export const UIEvents = {
  toClient: new NetworkEvent<UIEventPayload>("game_to_client"),
};

// Local events (client-side only, for communication between local scripts)
export const LocalUIEvents = {
  // Fired when player clicks in focused interaction mode - triggers cookie click
  cookieClicked: new LocalEvent("local_cookie_clicked"),
  // Fired when navigating pages - shows/hides cookie collider
  setCookieVisible: new LocalEvent<{ visible: boolean }>("local_set_cookie_visible"),
  // Fired when navigating pages - change page in CoreGame
  changePage: new LocalEvent<{ page: PageType }>("local_change_page"),
};
// #endregion

// #region ⚙️ Game Constants
// All upgrade types in the game
export const UPGRADE_CONFIGS: UpgradeConfig[] = [
  { id: "clicker", image: "Images/ClickerImage.png", name: "+1 Cookie Clicker", baseCost: 15, cookiesPerSecond: 0.1, rateDisplay: "0.1/s" },
  { id: "grandma", image: "Images/GrandmaImage.png", name: "Grandma", baseCost: 100, cookiesPerSecond: 1, rateDisplay: "1/s" },
  { id: "farm", image: "Images/FarmImage.png", name: "Cookie Farm", baseCost: 1100, cookiesPerSecond: 8, rateDisplay: "8/s" },
  { id: "factory", image: "Images/FactoryImage.png", name: "Cookie Factory", baseCost: 12000, cookiesPerSecond: 47, rateDisplay: "47/s" },
  { id: "lab", image: "Images/LabImage.png", name: "Cookie Laboratory", baseCost: 130000, cookiesPerSecond: 260, rateDisplay: "260/s" },
  { id: "fab", image: "Images/FabImage.png", name: "Cookie Fab Plant", baseCost: 1400000, cookiesPerSecond: 1400, rateDisplay: "1.4k/s" },
  { id: "planet", image: "Images/PlanetImage.png", name: "Cookie Planet", baseCost: 20000000, cookiesPerSecond: 7800, rateDisplay: "7.8k/s" },
];

// Cost scaling factor per upgrade owned
export const COST_MULTIPLIER = 1.15;

// Base cookies per click
export const BASE_COOKIES_PER_CLICK = 1;

// Game tick interval in milliseconds
export const TICK_INTERVAL_MS = 100;

// Auto-save interval in milliseconds
export const AUTO_SAVE_INTERVAL_MS = 30000;
// #endregion

// #region 🛠️ Utility Functions
// Calculate upgrade cost based on number owned
export function calculateUpgradeCost(baseCost: number, owned: number): number {
  return Math.floor(baseCost * Math.pow(COST_MULTIPLIER, owned));
}

// Calculate total cookies per second from owned upgrades
export function calculateCPS(upgrades: { [upgradeId: string]: number }): number {
  let totalCPS = 0;
  for (const config of UPGRADE_CONFIGS) {
    const owned = upgrades[config.id] || 0;
    totalCPS += config.cookiesPerSecond * owned;
  }
  return totalCPS;
}

// Format large numbers for display
export function formatNumber(num: number): string {
  if (num >= 1000000000000) {
    return `${(num / 1000000000000).toFixed(1)}T`;
  } else if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(1)}B`;
  } else if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return Math.floor(num).toLocaleString();
}

// Format cookie count for header display
export function formatCookieDisplay(cookies: number): string {
  return `${formatNumber(cookies)} Cookies!`;
}

// Format CPS for header display
export function formatCPSDisplay(cps: number): string {
  if (cps === 0) {
    return "click to start!";
  }
  return `${formatNumber(cps)} per second`;
}

// Format price for buy button
export function formatPrice(cost: number): string {
  return `$${formatNumber(cost)}`;
}

// Create default game state
export function createDefaultGameState(): GameState {
  const upgrades: { [upgradeId: string]: number } = {};
  for (const config of UPGRADE_CONFIGS) {
    upgrades[config.id] = 0;
  }
  
  return {
    cookies: 0,
    totalCookiesEarned: 0,
    cookiesPerClick: BASE_COOKIES_PER_CLICK,
    upgrades,
    lastSaveTime: Date.now(),
  };
}
// #endregion
