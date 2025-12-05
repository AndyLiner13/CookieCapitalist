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

import { Component, Player, CodeBlockEvents, PropTypes } from "horizon/core";
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
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    playerController: { type: PropTypes.Entity },
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
  
  // Active player reference
  private activePlayer: Player | null = null;
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");
    
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
    
    // Note: Production timers are now handled client-side (noesis_coreGame.ts)
    // The client sends production_complete events when timers finish
    
    // Handle existing players (Desktop Editor preview)
    const players = this.world.getPlayers();
    if (players.length > 0) {
      this.activePlayer = players[0];
      log.info(`Found existing player: ${this.activePlayer.name.get()}`);
      this.async.setTimeout(() => this.broadcastStateUpdate(), 500);
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
    const log = this.log.active("onPlayerEnter");
    log.info(`Player entered: ${player.name.get()}`);
    
    this.activePlayer = player;
    this.assignPlayerController(player);
    this.async.setTimeout(() => this.broadcastStateUpdate(), 500);
  }
  
  private assignPlayerController(player: Player): void {
    const log = this.log.active("assignPlayerController");
    
    const controller = this.props.playerController;
    if (!controller) {
      log.error("playerController prop is not set!");
      return;
    }
    
    controller.owner.set(player);
    log.info(`Assigned player controller ownership to ${player.name.get()}`);
  }
  
  private onPlayerExit(player: Player): void {
    const log = this.log.active("onPlayerExit");
    log.info(`Player exited: ${player.name.get()}`);
    
    if (this.activePlayer === player) {
      this.activePlayer = null;
    }
  }
  
  // Handle network events from clients
  private handlePlayerEvent(data: GameEventPayload): void {
    const log = this.log.active("handlePlayerEvent");
    
    if (!data || !data.type) return;
    
    switch (data.type) {
      case "cookie_clicked":
        this.handleCookieClick();
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
    }
  }
  
  private handleCookieClick(): void {
    const log = this.log.inactive("handleCookieClick");
    
    this.gameState.cookies += this.gameState.cookiesPerClick;
    this.gameState.totalCookiesEarned += this.gameState.cookiesPerClick;
    
    log.info(`Cookie clicked! Total: ${this.gameState.cookies}`);
    this.throttledBroadcastStateUpdate();
  }
  
  private handleProductionComplete(upgradeId: string, cookies: number): void {
    const log = this.log.inactive("handleProductionComplete");
    
    if (!upgradeId || cookies <= 0) return;
    
    // Award cookies from production
    this.gameState.cookies += cookies;
    this.gameState.totalCookiesEarned += cookies;
    
    log.info(`Production complete: ${upgradeId} awarded ${cookies} cookies. Total: ${this.gameState.cookies}`);
    this.throttledBroadcastStateUpdate();
  }
  
  private handleBuyUpgrade(upgradeId: string): void {
    const log = this.log.active("handleBuyUpgrade");
    
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
    
    this.gameState.cookies -= cost;
    this.gameState.upgrades[upgradeId] = owned + 1;
    this.recalculateCPS();
    
    log.info(`Purchased ${config.name}. Now own ${owned + 1}. CPS: ${this.cookiesPerSecond}`);
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
    };
    
    this.sendNetworkBroadcastEvent(UIEvents.toClient, stateData);
    log.info(`State broadcast: ${this.gameState.cookies} cookies`);
  }
  // #endregion
}

Component.register(Default);
