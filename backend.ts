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
  calculateCookiesPerCycle,
  createDefaultGameState,
  getTier,
  getTierSpeedMultiplier,
} from "./util_gameData";

// #region 🏷️ Type Definitions
// Leaderboard configuration - must match the leaderboard names created in Systems > Leaderboards
const LEADERBOARD_TOTAL_COOKIES = "TotalCookies";    // Lifetime total - never decreases
const LEADERBOARD_CURRENT_COOKIES = "CurrentCookies"; // Current balance - can decrease when buying
const LEADERBOARD_CPS = "CookiesPerSecond";          // Cookies per second (base, no multiplier)
const LEADERBOARD_LONGEST_STREAK = "LongestStreak";  // Longest multiplier streak in seconds
const LEADERBOARD_TIME_ONLINE = "TotalTimeOnline";   // Total time spent in game in seconds
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
const PPV_UPGRADE_PROGRESS = `${PPV_GROUP}:UpgradeProgress`;
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
  private lastCPSScore: number = 0;
  private lastLongestStreakScore: number = 0;
  private lastTimeOnlineScore: number = 0;
  
  // Session tracking
  private sessionStartTime: number = 0; // When current session started
  
  // Active player reference
  private activePlayer: Player | null = null;
  
  // Device type tracking
  private playerIsMobile: boolean | null = null;
  
  // Auto-save interval ID
  private autoSaveTimerId: number | null = null;
  private static readonly AUTO_SAVE_INTERVAL_MS = 30000; // Save every 30 seconds
  
  // Leaderboard-only tracking (not persisted to PPV)
  private longestStreakMs: number = 0; // Current session's longest streak
  private totalTimeOnlineMs: number = 0; // Accumulated from previous sessions (loaded from leaderboard indirectly)
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
    
    // Start session timer
    this.sessionStartTime = Date.now();
    
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
    
    // Broadcast the reset state to client
    this.async.setTimeout(() => this.broadcastStateUpdate(), 500);
    
    log.info(`[RESET STATS] All stats reset for ${player.name.get()}`);
  }
  
  private onPlayerExit(player: Player): void {
    const log = this.log.active("onPlayerExit");
    log.info(`Player exited: ${player.name.get()}`);
    
    // Add session time to total time online (leaderboard-only tracking)
    if (this.sessionStartTime > 0) {
      const sessionDuration = Date.now() - this.sessionStartTime;
      this.totalTimeOnlineMs += sessionDuration;
      log.info(`[SESSION] Added ${sessionDuration}ms to total time online (total: ${this.totalTimeOnlineMs}ms)`);
    }
    
    // Save state before player leaves
    this.savePlayerState(player);
    
    // Stop auto-save timer
    this.stopAutoSave();
    
    // Reset session tracking
    this.sessionStartTime = 0;
    
    if (this.activePlayer === player) {
      this.activePlayer = null;
      this.playerIsMobile = null;
    }
  }
  
  // Handle save request from UI
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
        
      case "sync_progress":
        this.handleSyncProgress(data.progress as { [key: string]: number });
        break;
        
      case "streak_ended":
        this.handleStreakEnded(data.durationMs as number);
        break;
    }
  }
  
  private handleSyncProgress(progress: { [key: string]: number }): void {
    const log = this.log.inactive("handleSyncProgress");
    
    if (progress && typeof progress === "object") {
      this.gameState.upgradeProgress = progress;
      log.info(`Synced upgrade progress: ${JSON.stringify(progress)}`);
    }
  }
  
  private handleStreakEnded(durationMs: number): void {
    const log = this.log.active("handleStreakEnded");
    
    if (typeof durationMs !== "number" || durationMs <= 0) {
      return;
    }
    
    // Update longest streak if this one is longer (leaderboard-only tracking)
    if (durationMs > this.longestStreakMs) {
      this.longestStreakMs = durationMs;
      log.info(`[STREAK] New longest streak: ${durationMs}ms (${(durationMs / 1000).toFixed(1)}s)`);
      
      // Trigger leaderboard update for new record
      this.updateLeaderboard();
    } else {
      log.info(`[STREAK] Streak ended: ${durationMs}ms (record: ${this.longestStreakMs}ms)`);
    }
  }
  
  private handleCookieClick(multiplier?: number): void {
    const log = this.log.inactive("handleCookieClick");
    
    const effectiveMultiplier = multiplier && multiplier > 1 ? multiplier : 1;
    const earnedAmount = this.gameState.cookiesPerClick * effectiveMultiplier;
    this.gameState.cookies += earnedAmount;
    this.gameState.totalCookiesEarned += earnedAmount;
    
    log.info(`Cookie clicked! Earned: ${earnedAmount} (${effectiveMultiplier}x), Total: ${this.gameState.cookies}, Lifetime: ${this.gameState.totalCookiesEarned}`);
    this.throttledBroadcastStateUpdate();
  }
  
  private handleProductionComplete(upgradeId: string, cookies: number): void {
    const log = this.log.inactive("handleProductionComplete");
    
    if (!upgradeId || cookies <= 0) return;
    
    // Award cookies from production
    this.gameState.cookies += cookies;
    this.gameState.totalCookiesEarned += cookies;
    
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
    
    // Deduct cost from current balance
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
  
  // Broadcast state with upgrade progress (used after loading to restore client progress)
  private broadcastStateWithProgress(): void {
    const log = this.log.inactive("broadcastStateWithProgress");
    
    const stateData: UIEventPayload = {
      type: "state_with_progress",
      cookies: this.gameState.cookies,
      cps: this.cookiesPerSecond,
      cookiesPerClick: this.gameState.cookiesPerClick,
      upgrades: this.gameState.upgrades,
      upgradeProgress: this.gameState.upgradeProgress,
      mobileOnly: this.props.mobileOnly,
    };
    
    this.sendNetworkBroadcastEvent(UIEvents.toClient, stateData);
    log.info(`State with progress broadcast: ${this.gameState.cookies} cookies, progress: ${JSON.stringify(this.gameState.upgradeProgress)}`);
  }
  
  // Update leaderboard scores for the active player (throttled)
  private updateLeaderboard(): void {
    const log = this.log.inactive("updateLeaderboard");
    
    if (!this.activePlayer) {
      log.warn("[LEADERBOARD] No active player - skipping");
      return;
    }
    
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastLeaderboardUpdate;
    
    // Only update if enough time has passed
    if (timeSinceLastUpdate < LEADERBOARD_UPDATE_THROTTLE_MS) {
      log.info("[LEADERBOARD] Throttled - too soon");
      return;
    }
    
    // Clamp scores to valid leaderboard range (max ~2.1 billion)
    const totalCookies = clampLeaderboardScore(this.gameState.totalCookiesEarned);
    const currentCookies = clampLeaderboardScore(this.gameState.cookies);
    const cpsScore = clampLeaderboardScore(Math.floor(this.cookiesPerSecond * 10)); // Store as CPS * 10 for 1 decimal precision
    const longestStreakScore = clampLeaderboardScore(Math.floor(this.longestStreakMs / 1000)); // Convert to seconds
    
    // Calculate total time online including current session
    let totalTimeOnline = this.totalTimeOnlineMs;
    if (this.sessionStartTime > 0) {
      totalTimeOnline += now - this.sessionStartTime;
    }
    const timeOnlineScore = clampLeaderboardScore(Math.floor(totalTimeOnline / 1000)); // Convert to seconds
    
    log.info(`[LEADERBOARD] Check: total=${totalCookies}, current=${currentCookies}, cps=${cpsScore}, streak=${longestStreakScore}s, timeOnline=${timeOnlineScore}s`);
    
    // Check if scores have changed
    const totalChanged = totalCookies > this.lastTotalCookiesScore;
    const currentChanged = currentCookies !== this.lastCurrentCookiesScore;
    const cpsChanged = cpsScore !== this.lastCPSScore;
    const streakChanged = longestStreakScore > this.lastLongestStreakScore;
    const timeChanged = timeOnlineScore > this.lastTimeOnlineScore;
    
    if (!totalChanged && !currentChanged && !cpsChanged && !streakChanged && !timeChanged) {
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
      
      // Update CPS leaderboard (can go up or down based on upgrades)
      if (cpsChanged) {
        this.world.leaderboards.setScoreForPlayer(
          LEADERBOARD_CPS,
          this.activePlayer,
          cpsScore,
          true // Always override - CPS can change
        );
        this.lastCPSScore = cpsScore;
        log.info(`[LEADERBOARD] Updated ${LEADERBOARD_CPS}: ${cpsScore / 10} CPS`);
      }
      
      // Update LongestStreak leaderboard (only increases)
      if (streakChanged) {
        this.world.leaderboards.setScoreForPlayer(
          LEADERBOARD_LONGEST_STREAK,
          this.activePlayer,
          longestStreakScore,
          false // Don't override if player has higher existing score
        );
        this.lastLongestStreakScore = longestStreakScore;
        log.info(`[LEADERBOARD] Updated ${LEADERBOARD_LONGEST_STREAK}: ${longestStreakScore}s`);
      }
      
      // Update TotalTimeOnline leaderboard (only increases)
      if (timeChanged) {
        this.world.leaderboards.setScoreForPlayer(
          LEADERBOARD_TIME_ONLINE,
          this.activePlayer,
          timeOnlineScore,
          false // Don't override if player has higher existing score
        );
        this.lastTimeOnlineScore = timeOnlineScore;
        log.info(`[LEADERBOARD] Updated ${LEADERBOARD_TIME_ONLINE}: ${timeOnlineScore}s`);
      }
      
      this.lastLeaderboardUpdate = now;
      log.info(`[LEADERBOARD] Success! ${this.activePlayer.name.get()}`);
    } catch (error) {
      log.error(`[LEADERBOARD] Failed: ${error}`);
    }
  }
  
  // Force leaderboard update (bypass throttle)
  private forceLeaderboardUpdate(): void {
    this.lastLeaderboardUpdate = 0;
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
      
      // Load upgrade progress (Object type - production progress 0.0-1.0 for each upgrade)
      const upgradeProgressRaw = this.world.persistentStorage.getPlayerVariable<{ [key: string]: number }>(player, PPV_UPGRADE_PROGRESS);
      log.info(`[PPV READ] ${PPV_UPGRADE_PROGRESS} = ${JSON.stringify(upgradeProgressRaw)} (type: ${typeof upgradeProgressRaw})`);
      
      // Apply loaded values to game state
      this.gameState.cookies = typeof cookies === "number" ? cookies : 0;
      this.gameState.totalCookiesEarned = typeof totalCookies === "number" ? totalCookies : 0;
      this.gameState.lastJoinTime = typeof lastJoinTime === "number" && lastJoinTime > 0 ? lastJoinTime : Date.now();
      this.gameState.lastSaveTime = (lastSaveTimeRaw && typeof lastSaveTimeRaw === "object" && lastSaveTimeRaw.timestamp) ? lastSaveTimeRaw.timestamp : Date.now();
      
      // Reset leaderboard-only tracking for this session
      this.longestStreakMs = 0;
      this.totalTimeOnlineMs = 0;
      
      // Handle upgrade progress - could be 0 (default), null, or an object
      if (upgradeProgressRaw && typeof upgradeProgressRaw === "object" && upgradeProgressRaw !== null) {
        const defaultState = createDefaultGameState();
        this.gameState.upgradeProgress = { ...defaultState.upgradeProgress, ...upgradeProgressRaw };
      } else {
        this.gameState.upgradeProgress = createDefaultGameState().upgradeProgress;
      }
      
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
      
      // Calculate precise offline earnings per upgrade, accounting for saved progress
      if (timeSinceLastSaveMs > 0) {
        // Cap offline time to 7 days to prevent overflow
        const cappedTimeMs = Math.min(timeSinceLastSaveMs, 7 * 24 * 60 * 60 * 1000);
        
        // Calculate cookies earned per upgrade, accounting for partial progress at save time
        for (const config of UPGRADE_CONFIGS) {
          const owned = this.gameState.upgrades[config.id] || 0;
          if (owned <= 0) continue;
          
          const tier = getTier(owned);
          const speedMultiplier = getTierSpeedMultiplier(tier);
          const effectiveProductionTime = config.productionTimeMs / speedMultiplier;
          const savedProgress = this.gameState.upgradeProgress[config.id] || 0;
          
          // Calculate how much time was left in the current cycle at save time
          const timeRemainingInCycleMs = (1 - savedProgress) * effectiveProductionTime;
          
          // Total time available for production = offline time
          let remainingOfflineTime = cappedTimeMs;
          let upgradeOfflineCookies = 0;
          
          // First, complete the partial cycle if there was one
          if (savedProgress > 0 && remainingOfflineTime >= timeRemainingInCycleMs) {
            // Complete the partial cycle
            upgradeOfflineCookies += calculateCookiesPerCycle(config.cookiesPerCycle, owned);
            remainingOfflineTime -= timeRemainingInCycleMs;
            
            // Reset progress for this upgrade (new cycle will start)
            this.gameState.upgradeProgress[config.id] = 0;
          } else if (savedProgress > 0 && remainingOfflineTime > 0) {
            // Didn't complete the partial cycle, add progress
            const additionalProgress = remainingOfflineTime / effectiveProductionTime;
            this.gameState.upgradeProgress[config.id] = Math.min(1, savedProgress + additionalProgress);
            remainingOfflineTime = 0;
          }
          
          // Calculate full cycles completed during remaining offline time
          if (remainingOfflineTime > 0) {
            const fullCycles = Math.floor(remainingOfflineTime / effectiveProductionTime);
            const partialCycleTime = remainingOfflineTime % effectiveProductionTime;
            
            // Award cookies for full cycles
            upgradeOfflineCookies += fullCycles * calculateCookiesPerCycle(config.cookiesPerCycle, owned);
            
            // Store partial progress for next session
            if (partialCycleTime > 0) {
              this.gameState.upgradeProgress[config.id] = partialCycleTime / effectiveProductionTime;
            }
          }
          
          offlineCookies += upgradeOfflineCookies;
          log.info(`[OFFLINE] ${config.id}: ${owned} owned, progress ${savedProgress.toFixed(3)} -> ${(this.gameState.upgradeProgress[config.id] || 0).toFixed(3)}, earned ${upgradeOfflineCookies}`);
        }
        
        // Award offline cookies
        if (offlineCookies > 0) {
          this.gameState.cookies += offlineCookies;
          this.gameState.totalCookiesEarned += offlineCookies;
        }
        
        log.info(`[OFFLINE EARNINGS] Time since last save: ${timeSinceLastSaveMs}ms (${cappedTimeMs}ms capped)`);
        log.info(`[OFFLINE EARNINGS] Total earned: ${offlineCookies} cookies (precise calculation with progress)`);
      } else {
        log.info(`[OFFLINE EARNINGS] No time since save, showing welcome modal with 0 cookies`);
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
      
      // Broadcast state to client after loading (includes upgrade progress)
      this.async.setTimeout(() => this.broadcastStateWithProgress(), 500);
      
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
      const upgradeProgressToSave = this.gameState.upgradeProgress || {};
      const lastJoinTimeToSave = this.gameState.lastJoinTime;
      const lastSaveTimeToSave = Date.now();
      
      // Update gameState with save time
      this.gameState.lastSaveTime = lastSaveTimeToSave;
      
      log.info(`[PPV WRITE] ${PPV_COOKIES} = ${cookiesToSave}`);
      log.info(`[PPV WRITE] ${PPV_TOTAL_COOKIES} = ${totalToSave}`);
      log.info(`[PPV WRITE] ${PPV_UPGRADES} = ${JSON.stringify(upgradesToSave)}`);
      log.info(`[PPV WRITE] ${PPV_UPGRADE_PROGRESS} = ${JSON.stringify(upgradeProgressToSave)}`);
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
      
      // Save upgrade progress (Object type - production progress 0.0-1.0 for each upgrade)
      this.world.persistentStorage.setPlayerVariable(
        player,
        PPV_UPGRADE_PROGRESS,
        upgradeProgressToSave
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
      
      // Note: longestStreakMs and totalTimeOnlineMs are leaderboard-only values, not saved to PPV
      
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
  // #endregion
}

Component.register(Default);