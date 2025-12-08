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
import { PPVManager } from "./util_ppv";
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
const LEADERBOARD_CPS = "CookiesPerSecond"; // Cookies per second (base, no multiplier)

// Clamp score to valid leaderboard range (leaderboards only support 32-bit signed integers)
// Max value is ~2.1 billion (2^31 - 1)
function clampLeaderboardScore(score: number): number {
  return Math.min(Math.max(Math.floor(score), -LEADEBOARD_SCORE_MAX_VALUE), LEADEBOARD_SCORE_MAX_VALUE);
}
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
  
  // PPV Manager for persistent storage
  private ppv!: PPVManager;
  
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
  
  // Leaderboard tracking
  private lastCPSScore: number = 0;
  
  // Session tracking
  private sessionStartTime: number = 0; // When current session started
  private longestStreakMs: number = 0; // Longest session streak (leaderboard-only tracking)
  private totalTimeOnlineMs: number = 0; // Total time online across sessions (leaderboard-only tracking)
  
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
    
    // Initialize PPV Manager
    this.ppv = new PPVManager(this.world);

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
    const log = this.log.inactive("resetPlayerStats");
    
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
    const log = this.log.inactive("onPlayerExit");
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
    }
  }
  
  private handleSyncProgress(progress: { [key: string]: number }): void {
    const log = this.log.inactive("handleSyncProgress");
    
    if (progress && typeof progress === "object") {
      this.gameState.upgradeProgress = progress;
      log.info(`Synced upgrade progress: ${JSON.stringify(progress)}`);
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
    
    // Force immediate leaderboard update after purchase (no throttle)
    this.updateLeaderboard();
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
  
  // Update CPS leaderboard for the active player
  private updateLeaderboard(): void {
    const log = this.log.inactive("updateLeaderboard");
    
    if (!this.activePlayer) {
      log.warn("[LEADERBOARD] No active player - skipping");
      return;
    }
    
    // Clamp CPS to valid leaderboard range (max ~2.1 billion, whole numbers only)
    const cpsScore = clampLeaderboardScore(Math.floor(this.cookiesPerSecond));
    
    log.info(`[LEADERBOARD] Check: cps=${cpsScore} (raw: ${this.cookiesPerSecond})`);
    
    // Only update if CPS has changed
    if (cpsScore === this.lastCPSScore) {
      log.info("[LEADERBOARD] Skipped - CPS unchanged");
      return;
    }
    
    try {
      // Update CPS leaderboard (always override - CPS can go up or down)
      this.world.leaderboards.setScoreForPlayer(
        LEADERBOARD_CPS,
        this.activePlayer,
        cpsScore,
        true // Always override - CPS can change based on upgrades
      );
      this.lastCPSScore = cpsScore;
      log.info(`[LEADERBOARD] Updated ${LEADERBOARD_CPS}: ${cpsScore} CPS for ${this.activePlayer.name.get()}`);
    } catch (error) {
      log.error(`[LEADERBOARD] Failed: ${error}`);
    }
  }
  
  // #region 💾 PPV (Persistent Player Variables)
  // Load player's saved state from PPVs
  private loadPlayerState(player: Player): void {
    const log = this.log.active("loadPlayerState");
    
    try {
      // Load data using PPV utility
      const ppvData = this.ppv.load(player);
      
      // Apply loaded values to game state
      this.gameState.cookies = ppvData.cookies;
      this.gameState.upgrades = ppvData.upgrades;
      this.gameState.upgradeProgress = ppvData.upgradeProgress;
      this.gameState.lastSaveTime = ppvData.lastSaveTime;
      this.gameState.totalCookiesEarned = 0; // Reset session tracking (not persisted)
      
      // Reset leaderboard-only tracking for this session
      this.longestStreakMs = 0;
      this.totalTimeOnlineMs = 0;
      
      // Recalculate CPS based on loaded upgrades
      this.recalculateCPS();
      
      // Calculate offline earnings if player has been away
      const now = Date.now();
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
            upgradeOfflineCookies += calculateCookiesPerCycle(config.cookiesPerCycle, owned);
            remainingOfflineTime -= timeRemainingInCycleMs;
            this.gameState.upgradeProgress[config.id] = 0;
          } else if (savedProgress > 0 && remainingOfflineTime > 0) {
            const additionalProgress = remainingOfflineTime / effectiveProductionTime;
            this.gameState.upgradeProgress[config.id] = Math.min(1, savedProgress + additionalProgress);
            remainingOfflineTime = 0;
          }
          
          // Calculate full cycles completed during remaining offline time
          if (remainingOfflineTime > 0) {
            const fullCycles = Math.floor(remainingOfflineTime / effectiveProductionTime);
            const partialCycleTime = remainingOfflineTime % effectiveProductionTime;
            
            upgradeOfflineCookies += fullCycles * calculateCookiesPerCycle(config.cookiesPerCycle, owned);
            
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
        log.info(`[OFFLINE EARNINGS] Total earned: ${offlineCookies} cookies`);
      } else {
        log.info(`[OFFLINE EARNINGS] No time since save, showing welcome modal with 0 cookies`);
      }
      
      // Always send welcome back event to client
      this.async.setTimeout(() => {
        const welcomeData: UIEventPayload = {
          type: "welcome_back",
          offlineCookies: Math.abs(offlineCookies),
          timeAwayMs: Math.abs(timeSinceLastSaveMs),
          cookies: this.gameState.cookies,
          cps: this.cookiesPerSecond,
        };
        this.sendNetworkBroadcastEvent(UIEvents.toClient, welcomeData);
        log.info(`[WELCOME BACK] Sent event: ${offlineCookies} cookies, ${timeSinceLastSaveMs}ms since last save, total=${this.gameState.cookies}, cps=${this.cookiesPerSecond}`);
      }, 1000);
      
      log.info(`Loaded state for ${player.name.get()}: ${this.gameState.cookies} cookies, ${Object.values(this.gameState.upgrades).reduce((a, b) => a + b, 0)} upgrades`);
      
      // Broadcast state to client after loading (includes upgrade progress)
      this.async.setTimeout(() => this.broadcastStateWithProgress(), 500);
      
      // Update leaderboard with loaded CPS value
      this.async.setTimeout(() => this.updateLeaderboard(), 1000);
      
      // Do an immediate save after 5 seconds to capture any early changes
      this.async.setTimeout(() => {
        if (this.activePlayer) {
          log.info("[PPV] Initial save after load");
          this.savePlayerState(this.activePlayer);
        }
      }, 5000);
      
    } catch (error) {
      log.error(`Failed to load PPV state for ${player.name.get()}: ${error}`);
      this.gameState = createDefaultGameState();
      this.recalculateCPS();
      this.async.setTimeout(() => this.broadcastStateUpdate(), 500);
      this.async.setTimeout(() => this.updateLeaderboard(), 1000);
    }
  }
  
  // Save player's current state to PPVs
  private savePlayerState(player: Player): void {
    const log = this.log.active("savePlayerState");
    
    try {
      // Save using PPV utility
      const lastSaveTime = this.ppv.save(player, {
        cookies: this.gameState.cookies,
        upgrades: this.gameState.upgrades,
        upgradeProgress: this.gameState.upgradeProgress,
      });
      
      // Update local state with save time
      this.gameState.lastSaveTime = lastSaveTime;
      
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
    const log = this.log.inactive("handleDeviceTypeReport");
    
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
    const log = this.log.inactive("updateMobileOnlyVisibility");
    
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