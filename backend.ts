// Desktop Editor Setup: Attach to Empty Object entity. Use Default (server) execution mode.

// #region 📋 README
// Backend - Server-side game manager for Cookie Clicker.
// This script handles:
// - Game state (cookies, upgrades, CPS)
// - Cookie production tick (passive income)
// - Purchase validation and processing
// - State synchronization with clients via network events
// - Player controller assignment
// 
// IMPORTANT: This is SERVER-ONLY (Default execution mode).
// UI scripts receive state via UIEvents.toClient network event directly.
// #endregion

import { Component, Player, CodeBlockEvents, PropTypes, LEADEBOARD_SCORE_MAX_VALUE } from "horizon/core";
import { Logger } from "./util_logger";
import {
  GameState,
  GameEventPayload,
  UIEventPayload,
  GameEvents,
  UIEvents,
  LocalUIEvents,
  UPGRADE_CONFIGS,
  TICK_INTERVAL_MS,
  calculateUpgradeCost,
  calculateCPS,
  calculateCookiesPerClick,
  createDefaultGameState,
} from "./util_gameData";

// #region 🏷️ Type Definitions
// Leaderboard configuration - must match the leaderboard names created in Systems > Leaderboards
const LEADERBOARD_TOTAL_COOKIES = "TotalCookies";    // Lifetime total - never decreases
const LEADERBOARD_CURRENT_COOKIES = "CurrentCookies"; // Current balance - can decrease when buying
const LEADERBOARD_UPDATE_THROTTLE_MS = 5000; // Update every 5 seconds max

// Clamp score to valid leaderboard range (leaderboards only support 32-bit signed integers)
// Max value is ~2.1 billion (2^31 - 1)
function clampLeaderboardScore(score: number): number {
  return Math.min(Math.max(Math.floor(score), -LEADEBOARD_SCORE_MAX_VALUE), LEADEBOARD_SCORE_MAX_VALUE);
}

// PPV (Persistent Player Variable) keys - format: "VariableGroupName:VariableName"
// These must match the variable group and variable names created in Systems > Variable Groups
const PPV_GROUP = "CookieCapitalist";
const PPV_COOKIES = `${PPV_GROUP}:Cookies`;
const PPV_TOTAL_COOKIES = `${PPV_GROUP}:TotalCookies`;
const PPV_UPGRADES = `${PPV_GROUP}:Upgrades`;
const PPV_LAST_JOIN_TIME = `${PPV_GROUP}:LastJoinTime`;
const PPV_LAST_SAVE_TIME = `${PPV_GROUP}:LastSaveTime`;
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    playerController: { type: PropTypes.Entity },
    mobileOnlyGizmo: { type: PropTypes.Entity },
    resetStats: { type: PropTypes.Boolean, default: false }, // When enabled, resets all player stats to 0 on join
    mobileOnly: { type: PropTypes.Boolean, default: false }, // When enabled, shows warning for non-mobile users
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("backend");
  
  // Core game state (server authoritative)
  private gameState: GameState = createDefaultGameState();
  
  // Calculated values
  private cookiesPerSecond: number = 0;
  
  // Tick accumulator for fractional cookies
  private cookieAccumulator: number = 0;
  
  // Throttle state broadcasts
  private pendingStateUpdate: boolean = false;
  private lastBroadcastTime: number = 0;
  private static readonly BROADCAST_THROTTLE_MS = 100;
  
  // Leaderboard throttle
  private lastLeaderboardUpdate: number = 0;
  private lastTotalCookiesScore: number = 0;
  private lastCurrentCookiesScore: number = 0;
  
  // Active player reference
  private activePlayer: Player | null = null;
  
  // Device type tracking
  private playerIsMobile: boolean | null = null;
  
  // Auto-save interval ID
  private autoSaveTimerId: number | null = null;
  private static readonly AUTO_SAVE_INTERVAL_MS = 30000; // Save every 30 seconds
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.inactive("start");
    
    // === SERVER-SIDE SETUP ===

    // Listen for player events
    this.connectCodeBlockEvent(
      this.entity,
      CodeBlockEvents.OnPlayerEnterWorld,
      this.onPlayerEnter.bind(this)
    );
    
    this.connectCodeBlockEvent(
      this.entity,
      CodeBlockEvents.OnPlayerExitWorld,
      this.onPlayerExit.bind(this)
    );
    
    // Listen for game events from clients (network → server)
    this.connectNetworkBroadcastEvent(
      GameEvents.toServer,
      (data: GameEventPayload) => this.handlePlayerEvent(data)
    );
    
    // Listen for device type reports from local player script
    this.connectNetworkBroadcastEvent(
      GameEvents.toServer,
      (data: GameEventPayload) => this.handleDeviceTypeReport(data)
    );
    
    // Note: Production timers are now handled client-side (noesis_coreGame.ts)
    // The client sends production_complete events when timers finish
    
    // Handle existing players (Desktop Editor preview)
    const players = this.world.getPlayers();
    if (players.length > 0) {
      const existingPlayer = players[0];
      log.info(`Found existing player: ${existingPlayer.name.get()}`);
      
      // Treat as if they just entered - load PPVs and assign controller
      this.onPlayerEnter(existingPlayer);
    }
    
    log.info("Backend initialized (Server)");
  }
  // #endregion

  // #region 🎯 Server Logic
  // Main game tick - handles passive cookie production
  private gameTick(): void {
    if (this.cookiesPerSecond <= 0) return;
    
    const cookiesThisTick = this.cookiesPerSecond * (TICK_INTERVAL_MS / 1000);
    this.cookieAccumulator += cookiesThisTick;
    
    if (this.cookieAccumulator >= 1) {
      const wholeCookies = Math.floor(this.cookieAccumulator);
      this.gameState.cookies += wholeCookies;
      this.gameState.totalCookiesEarned += wholeCookies;
      this.cookieAccumulator -= wholeCookies;
      
      this.broadcastStateUpdate();
    }
  }
  
  private recalculateCPS(): void {
    this.cookiesPerSecond = calculateCPS(this.gameState.upgrades);
    this.gameState.cookiesPerClick = calculateCookiesPerClick(this.gameState.upgrades);
  }
  
  // Handle player entering world
  private onPlayerEnter(player: Player): void {
    const log = this.log.inactive("onPlayerEnter");
    log.info(`Player entered: ${player.name.get()}`);
    
    this.activePlayer = player;
    this.playerIsMobile = null; // Reset device type - will be reported by controller
    this.assignPlayerController(player);
    
    // Check if stats should be reset
    if (this.props.resetStats) {
      log.info(`[RESET STATS] Resetting all stats for ${player.name.get()}`);
      this.resetPlayerStats(player);
    } else {
      // Load saved state from PPVs
      this.loadPlayerState(player);
    }
    
    // Start auto-save timer
    this.startAutoSave();
  }
  
  private assignPlayerController(player: Player): void {
    const log = this.log.inactive("assignPlayerController");
    
    const controller = this.props.playerController;
    if (!controller) {
      log.error("playerController prop is not set!");
      return;
    }
    
    controller.owner.set(player);
    log.info(`Assigned player controller ownership to ${player.name.get()}`);
  }
  
  // Note: MobileOnly overlay visibility is now handled by noesis_mobileOnly.ts
  // which uses setLocalEntityVisibility() for proper client-side control
  
  // Reset all player stats to 0 and save to PPVs
  private resetPlayerStats(player: Player): void {
    const log = this.log.active("resetPlayerStats");
    
    // Reset game state to defaults
    this.gameState = createDefaultGameState();
    this.recalculateCPS();
    
    // Save the reset state to PPVs
    this.savePlayerState(player);
    
    // Reset leaderboard scores to 0
    try {
      this.world.leaderboards.setScoreForPlayer(
        LEADERBOARD_TOTAL_COOKIES,
        player,
        0,
        true
      );
      this.world.leaderboards.setScoreForPlayer(
        LEADERBOARD_CURRENT_COOKIES,
        player,
        0,
        true
      );
      this.lastTotalCookiesScore = 0;
      this.lastCurrentCookiesScore = 0;
      log.info(`[RESET STATS] Leaderboards reset to 0`);
    } catch (error) {
      log.error(`[RESET STATS] Failed to reset leaderboards: ${error}`);
    }
    
    // Broadcast the reset state to client
    this.async.setTimeout(() => this.broadcastStateUpdate(), 500);
    
    log.info(`[RESET STATS] All stats reset for ${player.name.get()}`);
  }
  
  private onPlayerExit(player: Player): void {
    const log = this.log.inactive("onPlayerExit");
    log.info(`Player exited: ${player.name.get()}`);
    
    // Save state before player leaves
    this.savePlayerState(player);
    
    // Stop auto-save timer
    this.stopAutoSave();
    
    if (this.activePlayer === player) {
      this.activePlayer = null;
      this.playerIsMobile = null;
    }
  }
  
  // Handle save request from UI (e.g., when opening leaderboard)
  private handleSaveRequest(): void {
    const log = this.log.inactive("handleSaveRequest");
    
    if (!this.activePlayer) {
      log.warn("No active player - cannot save");
      return;
    }
    
    log.info("[SAVE REQUEST] Triggered by UI - saving PPV now");
    this.savePlayerState(this.activePlayer);
  }
  
  // Handle network events from clients
  private handlePlayerEvent(data: GameEventPayload): void {
    const log = this.log.inactive("handlePlayerEvent");
    
    if (!data || !data.type) return;
    
    switch (data.type) {
      case "cookie_clicked":
        this.handleCookieClick(data.multiplier as number | undefined);
        break;
        
      case "buy_upgrade":
        this.handleBuyUpgrade(data.upgradeId as string);
        break;
        
      case "production_complete":
        this.handleProductionComplete(data.upgradeId as string, data.cookies as number);
        break;
        
      case "request_state":
        this.broadcastStateUpdate();
        break;
        
      case "request_save":
        this.handleSaveRequest();
        break;
        
      case "device_type_report":
        this.handleDeviceTypeReport(data);
        break;
    }
  }
  
  private handleCookieClick(multiplier?: number): void {
    const log = this.log.inactive("handleCookieClick");
    
    const effectiveMultiplier = multiplier && multiplier > 1 ? multiplier : 1;
    const earnedAmount = this.gameState.cookiesPerClick * effectiveMultiplier;
    this.gameState.cookies += earnedAmount;
    this.gameState.totalCookiesEarned += earnedAmount; // Leaderboard stat - never decreases
    
    log.info(`Cookie clicked! Earned: ${earnedAmount} (${effectiveMultiplier}x), Total: ${this.gameState.cookies}, Lifetime: ${this.gameState.totalCookiesEarned}`);
    this.throttledBroadcastStateUpdate();
  }
  
  private handleProductionComplete(upgradeId: string, cookies: number): void {
    const log = this.log.inactive("handleProductionComplete");
    
    if (!upgradeId || cookies <= 0) return;
    
    // Award cookies from production
    this.gameState.cookies += cookies;
    this.gameState.totalCookiesEarned += cookies; // Leaderboard stat - never decreases
    
    log.info(`Production complete: ${upgradeId} awarded ${cookies} cookies. Total: ${this.gameState.cookies}, Lifetime: ${this.gameState.totalCookiesEarned}`);
    this.throttledBroadcastStateUpdate();
  }
  
  private handleBuyUpgrade(upgradeId: string): void {
    const log = this.log.inactive("handleBuyUpgrade");
    
    const config = UPGRADE_CONFIGS.find((c) => c.id === upgradeId);
    if (!config) {
      log.warn(`Unknown upgrade: ${upgradeId}`);
      return;
    }
    
    const owned = this.gameState.upgrades[upgradeId] || 0;
    
    // Clicker has a max limit of 24 (matches the visual finger ring)
    if (upgradeId === "clicker" && owned >= 24) {
      log.info(`Clicker at max limit (24)`);
      return;
    }
    
    const cost = calculateUpgradeCost(config.baseCost, owned);
    
    if (this.gameState.cookies < cost) {
      log.info(`Cannot afford ${config.name}`);
      return;
    }
    
    // Deduct cost from current balance (does NOT affect totalCookiesEarned/leaderboard)
    this.gameState.cookies -= cost;
    this.gameState.upgrades[upgradeId] = owned + 1;
    this.recalculateCPS();
    
    log.info(`Purchased ${config.name}. Cost: ${cost}, Now own: ${owned + 1}, Balance: ${this.gameState.cookies}, CPS: ${this.cookiesPerSecond}`);
    this.broadcastStateUpdate();
  }
  
  private throttledBroadcastStateUpdate(): void {
    const now = Date.now();
    const timeSinceLastBroadcast = now - this.lastBroadcastTime;
    
    if (timeSinceLastBroadcast >= Default.BROADCAST_THROTTLE_MS) {
      this.broadcastStateUpdate();
      this.lastBroadcastTime = now;
      this.pendingStateUpdate = false;
    } else if (!this.pendingStateUpdate) {
      this.pendingStateUpdate = true;
      const delay = Default.BROADCAST_THROTTLE_MS - timeSinceLastBroadcast;
      this.async.setTimeout(() => {
        if (this.pendingStateUpdate) {
          this.broadcastStateUpdate();
          this.lastBroadcastTime = Date.now();
          this.pendingStateUpdate = false;
        }
      }, delay);
    }
  }
  
  // Broadcast state over network (server → all clients)
  private broadcastStateUpdate(): void {
    const log = this.log.inactive("broadcastStateUpdate");
    
    const stateData: UIEventPayload = {
      type: "state_update",
      cookies: this.gameState.cookies,
      cps: this.cookiesPerSecond,
      cookiesPerClick: this.gameState.cookiesPerClick,
      upgrades: this.gameState.upgrades,
      // Mirror backend MobileOnly prop into client state so local scripts
      // (controller_player, MobileOnly overlay) can apply device-specific rules.
      mobileOnly: this.props.mobileOnly,
    };
    
    this.sendNetworkBroadcastEvent(UIEvents.toClient, stateData);
    log.info(`State broadcast: ${this.gameState.cookies} cookies`);
    
    // Update leaderboard (throttled)
    this.updateLeaderboard();
  }
  
  // #region 💾 PPV (Persistent Player Variables)
  // Load player's saved state from PPVs
  private loadPlayerState(player: Player): void {
    const log = this.log.inactive("loadPlayerState");
    
    try {
      // Load cookies (Number type - returns 0 if not set)
      const cookies = this.world.persistentStorage.getPlayerVariable(player, PPV_COOKIES);
      log.info(`[PPV READ] ${PPV_COOKIES} = ${cookies} (type: ${typeof cookies})`);
      
      // Load total cookies earned (Number type - returns 0 if not set)
      const totalCookies = this.world.persistentStorage.getPlayerVariable(player, PPV_TOTAL_COOKIES);
      log.info(`[PPV READ] ${PPV_TOTAL_COOKIES} = ${totalCookies} (type: ${typeof totalCookies})`);
      
      // Load upgrades (Object type - returns 0 if not set, null for uninitialized objects)
      const upgradesRaw = this.world.persistentStorage.getPlayerVariable<{ [key: string]: number }>(player, PPV_UPGRADES);
      log.info(`[PPV READ] ${PPV_UPGRADES} = ${JSON.stringify(upgradesRaw)} (type: ${typeof upgradesRaw})`);
      
      // Load last join time (Number type - returns 0 if not set)
      const lastJoinTime = this.world.persistentStorage.getPlayerVariable(player, PPV_LAST_JOIN_TIME);
      log.info(`[PPV READ] ${PPV_LAST_JOIN_TIME} = ${lastJoinTime} (type: ${typeof lastJoinTime})`);
      
      // Load last save time (Object type - returns timestamp)
      const lastSaveTimeRaw = this.world.persistentStorage.getPlayerVariable<{ timestamp: number }>(player, PPV_LAST_SAVE_TIME);
      log.info(`[PPV READ] ${PPV_LAST_SAVE_TIME} = ${JSON.stringify(lastSaveTimeRaw)} (type: ${typeof lastSaveTimeRaw})`);
      
      // Apply loaded values to game state
      this.gameState.cookies = typeof cookies === "number" ? cookies : 0;
      this.gameState.totalCookiesEarned = typeof totalCookies === "number" ? totalCookies : 0;
      this.gameState.lastJoinTime = typeof lastJoinTime === "number" && lastJoinTime > 0 ? lastJoinTime : Date.now();
      this.gameState.lastSaveTime = (lastSaveTimeRaw && typeof lastSaveTimeRaw === "object" && lastSaveTimeRaw.timestamp) ? lastSaveTimeRaw.timestamp : Date.now();
      
      // Handle upgrades - could be 0 (default), null, or an object
      if (upgradesRaw && typeof upgradesRaw === "object" && upgradesRaw !== null) {
        // Merge loaded upgrades with defaults (in case new upgrade types were added)
        const defaultState = createDefaultGameState();
        this.gameState.upgrades = { ...defaultState.upgrades, ...upgradesRaw };
      } else {
        // No saved upgrades - use defaults
        this.gameState.upgrades = createDefaultGameState().upgrades;
      }
      
      // Recalculate CPS based on loaded upgrades
      this.recalculateCPS();
      
      // Calculate offline earnings if player has been away
      const now = Date.now();
      // Calculate time since last save (not last join) for offline earnings
      const timeSinceLastSaveMs = Math.abs(now - this.gameState.lastSaveTime);
      let offlineCookies = 0;
      
      // Always show welcome back modal (even with 0 offline earnings for testing)
      // Calculate offline earnings if player has production upgrades
      if (this.cookiesPerSecond > 0 && timeSinceLastSaveMs > 0) {
        // Cap offline time to 7 days to prevent overflow
        const cappedTimeMs = Math.min(timeSinceLastSaveMs, 7 * 24 * 60 * 60 * 1000);
        offlineCookies = Math.abs(Math.floor((cappedTimeMs / 1000) * this.cookiesPerSecond));
        
        // Award offline cookies
        this.gameState.cookies += offlineCookies;
        this.gameState.totalCookiesEarned += offlineCookies;
        
        log.info(`[OFFLINE EARNINGS] Time since last save: ${timeSinceLastSaveMs}ms (${cappedTimeMs}ms capped)`);
        log.info(`[OFFLINE EARNINGS] Earned ${offlineCookies} cookies (${this.cookiesPerSecond} CPS)`);
      } else {
        log.info(`[OFFLINE EARNINGS] No CPS or no time since save, showing welcome modal with 0 cookies`);
      }
      
      // Always send welcome back event to client (ensure non-negative values)
      this.async.setTimeout(() => {
        const welcomeData: UIEventPayload = {
          type: "welcome_back",
          offlineCookies: Math.abs(offlineCookies),
          timeAwayMs: Math.abs(timeSinceLastSaveMs),
        };
        this.sendNetworkBroadcastEvent(UIEvents.toClient, welcomeData);
        log.info(`[WELCOME BACK] Sent event: ${offlineCookies} cookies, ${timeSinceLastSaveMs}ms since last save`);
      }, 1000);
      
      // Update last join time to now
      this.gameState.lastJoinTime = now;
      
      log.info(`Loaded PPV state for ${player.name.get()}: ${this.gameState.cookies} cookies, ${this.gameState.totalCookiesEarned} total, ${Object.values(this.gameState.upgrades).reduce((a, b) => a + b, 0)} upgrades`);
      
      // Broadcast state to client after loading
      this.async.setTimeout(() => this.broadcastStateUpdate(), 500);
      
      // Force a leaderboard update after load (bypass throttle)
      this.async.setTimeout(() => {
        const timeoutLog = this.log.active("leaderboardTimeout");
        timeoutLog.info("[LEADERBOARD] === FORCE UPDATE TIMEOUT FIRED ===");
        if (this.activePlayer) {
          timeoutLog.info("[LEADERBOARD] Active player exists, calling forceLeaderboardUpdate");
          this.forceLeaderboardUpdate();
        } else {
          timeoutLog.warn("[LEADERBOARD] No active player in timeout!");
        }
      }, 1000);
      
      // Do an immediate save after 5 seconds to capture any early changes
      this.async.setTimeout(() => {
        if (this.activePlayer) {
          log.info("[PPV] Initial save after load");
          this.savePlayerState(this.activePlayer);
        }
      }, 5000);
      
    } catch (error) {
      log.error(`Failed to load PPV state for ${player.name.get()}: ${error}`);
      // Use default state on error
      this.gameState = createDefaultGameState();
      this.recalculateCPS();
      this.async.setTimeout(() => this.broadcastStateUpdate(), 500);
    }
  }
  
  // Save player's current state to PPVs
  private savePlayerState(player: Player): void {
    const log = this.log.inactive("savePlayerState");
    
    try {
      const cookiesToSave = Math.floor(this.gameState.cookies);
      const totalToSave = Math.floor(this.gameState.totalCookiesEarned);
      const upgradesToSave = this.gameState.upgrades;
      const lastJoinTimeToSave = this.gameState.lastJoinTime;
      const lastSaveTimeToSave = Date.now();
      
      // Update gameState with save time
      this.gameState.lastSaveTime = lastSaveTimeToSave;
      
      log.info(`[PPV WRITE] ${PPV_COOKIES} = ${cookiesToSave}`);
      log.info(`[PPV WRITE] ${PPV_TOTAL_COOKIES} = ${totalToSave}`);
      log.info(`[PPV WRITE] ${PPV_UPGRADES} = ${JSON.stringify(upgradesToSave)}`);
      log.info(`[PPV WRITE] ${PPV_LAST_JOIN_TIME} = ${lastJoinTimeToSave}`);
      log.info(`[PPV WRITE] ${PPV_LAST_SAVE_TIME} = ${lastSaveTimeToSave}`);
      
      // Save cookies (Number type)
      this.world.persistentStorage.setPlayerVariable(
        player,
        PPV_COOKIES,
        cookiesToSave
      );
      
      // Save total cookies earned (Number type)
      this.world.persistentStorage.setPlayerVariable(
        player,
        PPV_TOTAL_COOKIES,
        totalToSave
      );
      
      // Save upgrades (Object type)
      this.world.persistentStorage.setPlayerVariable(
        player,
        PPV_UPGRADES,
        upgradesToSave
      );
      
      // Save last join time (Number type)
      this.world.persistentStorage.setPlayerVariable(
        player,
        PPV_LAST_JOIN_TIME,
        lastJoinTimeToSave
      );
      
      // Save last save time (Object type - stores timestamp)
      this.world.persistentStorage.setPlayerVariable(
        player,
        PPV_LAST_SAVE_TIME,
        { timestamp: lastSaveTimeToSave }
      );
      
      log.info(`[PPV WRITE COMPLETE] Saved state for ${player.name.get()}`);
      
    } catch (error) {
      log.error(`Failed to save PPV state for ${player.name.get()}: ${error}`);
    }
  }
  
  // Start auto-save timer
  private startAutoSave(): void {
    const log = this.log.inactive("startAutoSave");
    
    // Clear any existing timer
    this.stopAutoSave();
    
    // Start new timer
    this.autoSaveTimerId = this.async.setInterval(() => {
      if (this.activePlayer) {
        this.savePlayerState(this.activePlayer);
      }
    }, Default.AUTO_SAVE_INTERVAL_MS);
    
    log.info(`[AUTO-SAVE] Started (every ${Default.AUTO_SAVE_INTERVAL_MS / 1000}s)`);
  }
  
  // Stop auto-save timer
  private stopAutoSave(): void {
    if (this.autoSaveTimerId !== null) {
      this.async.clearInterval(this.autoSaveTimerId);
      this.autoSaveTimerId = null;
    }
  }
  // #endregion
  
  // Update leaderboard score for the active player (throttled)
  // Tracks totalCookiesEarned - never decreases when purchasing items
  private updateLeaderboard(): void {
    const log = this.log.inactive("updateLeaderboard");
    
    if (!this.activePlayer) {
      log.warn("[LEADERBOARD] No active player - skipping");
      return;
    }
    
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastLeaderboardUpdate;
    
    // Clamp scores to valid leaderboard range (max ~2.1 billion)
    const totalCookies = clampLeaderboardScore(this.gameState.totalCookiesEarned);
    const currentCookies = clampLeaderboardScore(this.gameState.cookies);
    
    log.info(`[LEADERBOARD] Check: total=${totalCookies}, current=${currentCookies}, timeSince=${timeSinceLastUpdate}ms`);
    
    // Only update if enough time has passed
    if (timeSinceLastUpdate < LEADERBOARD_UPDATE_THROTTLE_MS) {
      log.info("[LEADERBOARD] Throttled - too soon");
      return;
    }
    
    // Check if either score has changed
    const totalChanged = totalCookies > this.lastTotalCookiesScore;
    const currentChanged = currentCookies !== this.lastCurrentCookiesScore;
    
    if (!totalChanged && !currentChanged) {
      log.info("[LEADERBOARD] Skipped - no score changes");
      return;
    }
    
    try {
      // Update TotalCookies leaderboard (lifetime, never decreases)
      if (totalChanged) {
        this.world.leaderboards.setScoreForPlayer(
          LEADERBOARD_TOTAL_COOKIES,
          this.activePlayer,
          totalCookies,
          false // Don't override if player has higher existing score
        );
        this.lastTotalCookiesScore = totalCookies;
        log.info(`[LEADERBOARD] Updated ${LEADERBOARD_TOTAL_COOKIES}: ${totalCookies}`);
      }
      
      // Update CurrentCookies leaderboard (current balance, can decrease)
      if (currentChanged) {
        this.world.leaderboards.setScoreForPlayer(
          LEADERBOARD_CURRENT_COOKIES,
          this.activePlayer,
          currentCookies,
          true // Always override - current balance can go up or down
        );
        this.lastCurrentCookiesScore = currentCookies;
        log.info(`[LEADERBOARD] Updated ${LEADERBOARD_CURRENT_COOKIES}: ${currentCookies}`);
      }
      
      this.lastLeaderboardUpdate = now;
      log.info(`[LEADERBOARD] Success! ${this.activePlayer.name.get()}`);
    } catch (error) {
      log.error(`[LEADERBOARD] Failed: ${error}`);
    }
  }
  
  // Handle device type report from local player script
  private handleDeviceTypeReport(data: GameEventPayload): void {
    const log = this.log.active("handleDeviceTypeReport");
    
    if (data.type !== "device_type_report") {
      return;
    }
    
    const isMobile = data.isMobile as boolean | undefined;
    if (typeof isMobile !== "boolean") {
      log.warn("Invalid device type report - isMobile not boolean");
      return;
    }
    
    this.playerIsMobile = isMobile;
    log.info(`[DEVICE TYPE] Player reported: ${isMobile ? "Mobile" : "Desktop/VR"}`);
    
    // Update MobileOnly gizmo visibility based on device type and mobileOnly setting
    this.updateMobileOnlyVisibility();
  }
  
  // Update MobileOnly overlay visibility based on player device and backend setting
  private updateMobileOnlyVisibility(): void {
    const log = this.log.active("updateMobileOnlyVisibility");
    
    if (!this.props.mobileOnlyGizmo) {
      log.info("[MOBILE ONLY] mobileOnlyGizmo prop not set - skipping");
      return;
    }
    
    if (this.playerIsMobile === null) {
      log.info("[MOBILE ONLY] Device type not yet reported - skipping");
      return;
    }
    
    // Show overlay if mobileOnly is enabled AND player is NOT on mobile
    const shouldShow = this.props.mobileOnly && !this.playerIsMobile;
    
    this.props.mobileOnlyGizmo.visible.set(shouldShow);
    log.info(`[MOBILE ONLY] Overlay visibility: ${shouldShow} (mobileOnly=${this.props.mobileOnly}, isMobile=${this.playerIsMobile})`);
  }
  
  // Force leaderboard update (bypasses throttle) - used for initial load
  private forceLeaderboardUpdate(): void {
    const log = this.log.inactive("forceLeaderboardUpdate");
    
    if (!this.activePlayer) {
      log.warn("[LEADERBOARD] No active player - cannot force update");
      return;
    }
    
    // Clamp scores to valid leaderboard range (max ~2.1 billion)
    const totalCookies = clampLeaderboardScore(this.gameState.totalCookiesEarned);
    const currentCookies = clampLeaderboardScore(this.gameState.cookies);
    
    log.info(`[LEADERBOARD] FORCE updating both leaderboards: total=${totalCookies}, current=${currentCookies}`);
    
    try {
      // Force update TotalCookies
      this.world.leaderboards.setScoreForPlayer(
        LEADERBOARD_TOTAL_COOKIES,
        this.activePlayer,
        totalCookies,
        true
      );
      this.lastTotalCookiesScore = totalCookies;
      
      // Force update CurrentCookies
      this.world.leaderboards.setScoreForPlayer(
        LEADERBOARD_CURRENT_COOKIES,
        this.activePlayer,
        currentCookies,
        true
      );
      this.lastCurrentCookiesScore = currentCookies;
      
      this.lastLeaderboardUpdate = Date.now();
      log.info(`[LEADERBOARD] FORCE Success! total=${totalCookies}, current=${currentCookies}`);
    } catch (error) {
      log.error(`[LEADERBOARD] FORCE Failed: ${error}`);
    }
  }
  // #endregion
}

Component.register(Default);