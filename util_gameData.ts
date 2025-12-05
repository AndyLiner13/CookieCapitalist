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
  cookiesPerCycle: number;      // Cookies awarded when production completes
  productionTimeMs: number;     // Time in ms for one production cycle
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
  type: "cookie_clicked" | "buy_upgrade" | "request_state" | "production_complete";
};

export type UIEventPayload = {
  [key: string]: SerializableState;
  type: "state_update" | "purchase_result";
};
// #endregion

// #region 🔌 Network Events
// Events sent from Backend (client) to Backend (server)
export const GameEvents = {
  toServer: new NetworkEvent<GameEventPayload>("game_to_server"),
};

// Events sent from Backend (server) to Backend (client)
export const UIEvents = {
  toClient: new NetworkEvent<UIEventPayload>("game_to_client"),
};

// Local events (client-side only - used by ALL UI scripts)
// Backend is the only script that bridges network ↔ local
export const LocalUIEvents = {
  // State changed - Backend redistributes server state to UI scripts
  stateChanged: new LocalEvent<{
    cookies: number;
    cps: number;
    cookiesPerClick: number;
    upgrades: { [key: string]: number };
  }>("local_state_changed"),
  
  // Cookie clicked - UI sends to Backend, Backend forwards to server
  cookieClicked: new LocalEvent("local_cookie_clicked"),
  
  // Buy upgrade - UI sends to Backend, Backend forwards to server
  buyUpgrade: new LocalEvent<{ upgradeId: string }>("local_buy_upgrade"),
  
  // Page navigation (purely local, no server involvement)
  changePage: new LocalEvent<{ page: PageType }>("local_change_page"),
};
// #endregion

// #region ⚙️ Game Constants
// All upgrade types in the game
// Production model: Each owned upgrade produces cookiesPerCycle every productionTimeMs
export const UPGRADE_CONFIGS: UpgradeConfig[] = [
  { id: "clicker", image: "Images/ClickerImage.png", name: "Clicker", baseCost: 15, cookiesPerCycle: 1, productionTimeMs: 10000, rateDisplay: "+1" },
  { id: "grandma", image: "Images/GrandmaImage.png", name: "Grandma", baseCost: 100, cookiesPerCycle: 10, productionTimeMs: 10000, rateDisplay: "+10" },
  { id: "farm", image: "Images/FarmImage.png", name: "Cookie Farm", baseCost: 1100, cookiesPerCycle: 80, productionTimeMs: 10000, rateDisplay: "+80" },
  { id: "factory", image: "Images/FactoryImage.png", name: "Cookie Factory", baseCost: 12000, cookiesPerCycle: 470, productionTimeMs: 10000, rateDisplay: "+470" },
  { id: "lab", image: "Images/LabImage.png", name: "Cookie Laboratory", baseCost: 130000, cookiesPerCycle: 2600, productionTimeMs: 10000, rateDisplay: "+2.6K" },
  { id: "fab", image: "Images/FabImage.png", name: "Cookie Fab Plant", baseCost: 1400000, cookiesPerCycle: 14000, productionTimeMs: 10000, rateDisplay: "+14K" },
  { id: "planet", image: "Images/PlanetImage.png", name: "Cookie Planet", baseCost: 20000000, cookiesPerCycle: 78000, productionTimeMs: 10000, rateDisplay: "+78K" },
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

// Calculate total cookies per second from owned upgrades (for display purposes)
export function calculateCPS(upgrades: { [upgradeId: string]: number }): number {
  let totalCPS = 0;
  for (const config of UPGRADE_CONFIGS) {
    const owned = upgrades[config.id] || 0;
    // CPS = (cookiesPerCycle / productionTimeMs) * 1000 * owned
    totalCPS += (config.cookiesPerCycle / config.productionTimeMs) * 1000 * owned;
  }
  return totalCPS;
}

// Calculate cookies per click based on clicker upgrades
export function calculateCookiesPerClick(upgrades: { [upgradeId: string]: number }): number {
  const clickerCount = upgrades["clicker"] || 0;
  return BASE_COOKIES_PER_CLICK + clickerCount;
}

// Format time remaining in seconds
export function formatTimeRemaining(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${seconds}s`;
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

// Format cookie count for header display (shows full number)
export function formatCookieDisplay(cookies: number): string {
  return `${Math.floor(cookies).toLocaleString()} Cookies!`;
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
