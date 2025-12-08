// #region 📋 README
// PPV (Persistent Player Variables) Utility
// A clean, reusable, and scalable system for managing player data persistence.
// 
// Features:
// - Type-safe PPV definitions with schemas
// - Automatic default value handling
// - Centralized load/save with logging
// - Easy to extend with new variables
// #endregion

import { Player, World } from "horizon/core";
import { Logger } from "./util_logger";
import { UPGRADE_CONFIGS } from "./util_gameData";

// #region 🏷️ Type Definitions
// Raw PPV data as loaded from storage
export interface PPVData {
  cookies: number;
  upgrades: { [key: string]: number };
  upgradeProgress: { [key: string]: number };
  lastSaveTime: number;
}

// GameState object stored in PPV (consolidates upgradeProgress and lastSaveTime)
export interface PPVGameStateData {
  [key: string]: { [upgradeId: string]: number } | number; // Index signature for PersistentSerializableState
  upgradeProgress: { [upgradeId: string]: number };
  lastSaveTime: number;
}

// Data to save to PPVs
export interface PPVSaveData {
  cookies: number;
  upgrades: { [key: string]: number };
  upgradeProgress: { [key: string]: number };
}
// #endregion

// #region ⚙️ PPV Configuration
// Variable group name - must match Systems > Variable Groups in Desktop Editor
const PPV_GROUP = "CookieCapitalist";

// PPV keys
const PPV_KEYS = {
  COOKIES: `${PPV_GROUP}:Cookies`,
  UPGRADES: `${PPV_GROUP}:Upgrades`,
  GAME_STATE: `${PPV_GROUP}:GameState`,
};

// Default value generators
function getDefaultUpgrades(): { [key: string]: number } {
  const upgrades: { [key: string]: number } = {};
  for (const config of UPGRADE_CONFIGS) {
    upgrades[config.id] = 0;
  }
  return upgrades;
}

function getDefaultUpgradeProgress(): { [key: string]: number } {
  const progress: { [key: string]: number } = {};
  for (const config of UPGRADE_CONFIGS) {
    progress[config.id] = 0;
  }
  return progress;
}
// #endregion

// #region 🔌 Public API
// PPV Manager class - handles all PPV operations
export class PPVManager {
  private log = new Logger("ppv");
  private world: World;
  
  constructor(world: World) {
    this.world = world;
  }
  
  // Load all PPV data for a player
  load(player: Player): PPVData {
    const log = this.log.active("load");
    
    // Load cookies
    const cookiesRaw = this.world.persistentStorage.getPlayerVariable(
      player,
      PPV_KEYS.COOKIES
    );
    const cookies = typeof cookiesRaw === "number" ? cookiesRaw : 0;
    log.info(`[READ] ${PPV_KEYS.COOKIES} = ${cookies}`);
    
    // Load upgrades
    const upgradesRaw = this.world.persistentStorage.getPlayerVariable<{ [key: string]: number }>(
      player,
      PPV_KEYS.UPGRADES
    );
    const defaultUpgrades = getDefaultUpgrades();
    const upgrades = (upgradesRaw && typeof upgradesRaw === "object" && upgradesRaw !== null)
      ? { ...defaultUpgrades, ...upgradesRaw }
      : defaultUpgrades;
    log.info(`[READ] ${PPV_KEYS.UPGRADES} = ${JSON.stringify(upgrades)}`);
    
    // Load gameState (contains upgradeProgress and lastSaveTime)
    const gameStateRaw = this.world.persistentStorage.getPlayerVariable<PPVGameStateData>(
      player,
      PPV_KEYS.GAME_STATE
    );
    log.info(`[READ] ${PPV_KEYS.GAME_STATE} = ${JSON.stringify(gameStateRaw)}`);
    
    // Parse gameState
    const defaultProgress = getDefaultUpgradeProgress();
    let upgradeProgress: { [key: string]: number };
    let lastSaveTime: number;
    
    if (gameStateRaw && typeof gameStateRaw === "object" && gameStateRaw !== null) {
      lastSaveTime = typeof gameStateRaw.lastSaveTime === "number" ? gameStateRaw.lastSaveTime : Date.now();
      upgradeProgress = (gameStateRaw.upgradeProgress && typeof gameStateRaw.upgradeProgress === "object")
        ? { ...defaultProgress, ...gameStateRaw.upgradeProgress }
        : defaultProgress;
    } else {
      lastSaveTime = Date.now();
      upgradeProgress = defaultProgress;
    }
    
    log.info(`[LOAD COMPLETE] ${player.name.get()}: ${cookies} cookies, ${Object.values(upgrades).reduce((a, b) => a + b, 0)} upgrades`);
    
    return { cookies, upgrades, upgradeProgress, lastSaveTime };
  }
  
  // Save all PPV data for a player
  save(player: Player, data: PPVSaveData): number {
    const log = this.log.active("save");
    
    const cookiesToSave = Math.floor(data.cookies);
    const lastSaveTime = Date.now();
    
    // Build GameState object
    const gameStateToSave: PPVGameStateData = {
      upgradeProgress: data.upgradeProgress || getDefaultUpgradeProgress(),
      lastSaveTime,
    };
    
    log.info(`[WRITE] ${PPV_KEYS.COOKIES} = ${cookiesToSave}`);
    log.info(`[WRITE] ${PPV_KEYS.UPGRADES} = ${JSON.stringify(data.upgrades)}`);
    log.info(`[WRITE] ${PPV_KEYS.GAME_STATE} = ${JSON.stringify(gameStateToSave)}`);
    
    // Save cookies
    this.world.persistentStorage.setPlayerVariable(
      player,
      PPV_KEYS.COOKIES,
      cookiesToSave
    );
    
    // Save upgrades
    this.world.persistentStorage.setPlayerVariable(
      player,
      PPV_KEYS.UPGRADES,
      data.upgrades
    );
    
    // Save gameState
    this.world.persistentStorage.setPlayerVariable(
      player,
      PPV_KEYS.GAME_STATE,
      gameStateToSave
    );
    
    log.info(`[SAVE COMPLETE] ${player.name.get()}`);
    
    return lastSaveTime;
  }
  
  // Reset all PPV data for a player to defaults
  reset(player: Player): number {
    const log = this.log.active("reset");
    
    const defaultData: PPVSaveData = {
      cookies: 0,
      upgrades: getDefaultUpgrades(),
      upgradeProgress: getDefaultUpgradeProgress(),
    };
    
    const lastSaveTime = this.save(player, defaultData);
    log.info(`[RESET COMPLETE] ${player.name.get()}`);
    
    return lastSaveTime;
  }
}
// #endregion
