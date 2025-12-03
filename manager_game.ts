// Desktop Editor Setup: Attach to Empty Object entity

// #region 📋 README
// Server-side game manager for Cookie Clicker.
// Handles:
// - Game state (cookies, upgrades, CPS)
// - Cookie production tick (passive income)
// - Purchase validation and processing
// - State synchronization with UI
// - Player controller ownership assignment
// #endregion

import { Component, Player, CodeBlockEvents, PropTypes, Entity } from "horizon/core";
import { Logger } from "./util_logger";
import {
  GameState,
  GameEventPayload,
  UIEventPayload,
  GameEvents,
  UIEvents,
  UPGRADE_CONFIGS,
  TICK_INTERVAL_MS,
  calculateUpgradeCost,
  calculateCPS,
  createDefaultGameState,
} from "./util_gameData";

// #region 🏷️ Type Definitions
// (Types are now in util_gameData.ts)
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    playerControllerEntity: { type: PropTypes.Entity },
    cookieButtonGizmo: { type: PropTypes.Entity },
    clickerUIGizmo: { type: PropTypes.Entity },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("manager_game");
  
  // Core game state
  private gameState: GameState = createDefaultGameState();
  
  // Calculated values
  private cookiesPerSecond: number = 0;
  
  // Tick accumulator for fractional cookies
  private cookieAccumulator: number = 0;
  
  // Active player reference
  private activePlayer: Player | null = null;
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");
    
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
    
    // Listen for game events from clients
    this.connectNetworkBroadcastEvent(
      GameEvents.toServer,
      (data: GameEventPayload) => {
        this.handlePlayerEvent(data);
      }
    );
    
    // Start game tick
    this.async.setInterval(() => this.gameTick(), TICK_INTERVAL_MS);
    
    // Handle any players already in world (e.g., in Desktop Editor preview)
    const players = this.world.getPlayers();
    if (players.length > 0) {
      this.activePlayer = players[0];
      log.info(`Found existing player: ${this.activePlayer.name.get()}`);
      
      // Transfer ownership of player controller entity to the existing player
      if (this.props.playerControllerEntity) {
        this.props.playerControllerEntity.owner.set(this.activePlayer);
        log.info(`Transferred player controller ownership to existing player ${this.activePlayer.name.get()}`);
      }
      
      // Send initial state after a short delay to let UI initialize
      this.async.setTimeout(() => this.broadcastStateUpdate(), 500);
    }
    
    log.info("Game manager initialized");
  }
  // #endregion

  // #region 🎯 Main Logic
  // Main game tick - handles passive cookie production
  private gameTick(): void {
    if (this.cookiesPerSecond <= 0) return;
    
    // Calculate cookies earned this tick
    const cookiesThisTick = this.cookiesPerSecond * (TICK_INTERVAL_MS / 1000);
    this.cookieAccumulator += cookiesThisTick;
    
    // Only add whole cookies to prevent floating point issues
    if (this.cookieAccumulator >= 1) {
      const wholeCookies = Math.floor(this.cookieAccumulator);
      this.gameState.cookies += wholeCookies;
      this.gameState.totalCookiesEarned += wholeCookies;
      this.cookieAccumulator -= wholeCookies;
      
      // Broadcast state update
      this.broadcastStateUpdate();
    }
  }
  
  // Recalculate CPS from current upgrades
  private recalculateCPS(): void {
    this.cookiesPerSecond = calculateCPS(this.gameState.upgrades);
  }
  // #endregion

  // #region 🎬 Handlers
  // Handle player entering world
  private onPlayerEnter(player: Player): void {
    const log = this.log.active("onPlayerEnter");
    log.info(`Player entered: ${player.name.get()}`);
    
    // For single player, just track the active player
    this.activePlayer = player;
    
    // Transfer ownership of player controller entity to the player
    // This triggers focused interaction mode on their client
    if (this.props.playerControllerEntity) {
      this.props.playerControllerEntity.owner.set(player);
      log.info(`Transferred player controller ownership to ${player.name.get()}`);
    } else {
      log.warn("No playerControllerEntity configured - player won't enter focused interaction mode");
    }
    
    // Send initial state after a short delay
    this.async.setTimeout(() => this.broadcastStateUpdate(), 500);
  }
  
  // Handle player exiting world
  private onPlayerExit(player: Player): void {
    const log = this.log.active("onPlayerExit");
    log.info(`Player exited: ${player.name.get()}`);
    
    if (this.activePlayer === player) {
      this.activePlayer = null;
      // Could save state here for persistence
    }
  }
  
  // Handle events from player UI
  private handlePlayerEvent(data: GameEventPayload): void {
    const log = this.log.active("handlePlayerEvent");
    
    if (!data || !data.type) {
      return;
    }
    
    switch (data.type) {
      case "cookie_clicked":
        this.handleCookieClick();
        break;
        
      case "buy_upgrade":
        this.handleBuyUpgrade(data.upgradeId as string);
        break;
        
      case "request_state":
        this.broadcastStateUpdate();
        break;
        
      default:
        log.warn(`Unknown event type`);
    }
  }
  
  // Handle cookie click
  private handleCookieClick(): void {
    const log = this.log.inactive("handleCookieClick");
    
    this.gameState.cookies += this.gameState.cookiesPerClick;
    this.gameState.totalCookiesEarned += this.gameState.cookiesPerClick;
    
    log.info(`Cookie clicked! Total: ${this.gameState.cookies}`);
    
    this.broadcastStateUpdate();
  }
  
  // Handle upgrade purchase
  private handleBuyUpgrade(upgradeId: string): void {
    const log = this.log.active("handleBuyUpgrade");
    
    // Find upgrade config
    const config = UPGRADE_CONFIGS.find((c) => c.id === upgradeId);
    if (!config) {
      log.warn(`Unknown upgrade: ${upgradeId}`);
      this.sendPurchaseResult(false, upgradeId, "Unknown upgrade");
      return;
    }
    
    // Calculate cost
    const owned = this.gameState.upgrades[upgradeId] || 0;
    const cost = calculateUpgradeCost(config.baseCost, owned);
    
    // Check if player can afford
    if (this.gameState.cookies < cost) {
      log.info(`Cannot afford ${config.name}. Need ${cost}, have ${this.gameState.cookies}`);
      this.sendPurchaseResult(false, upgradeId, "Not enough cookies!");
      return;
    }
    
    // Process purchase
    this.gameState.cookies -= cost;
    this.gameState.upgrades[upgradeId] = owned + 1;
    
    // Recalculate CPS
    this.recalculateCPS();
    
    log.info(`Purchased ${config.name}. Now own ${owned + 1}. CPS: ${this.cookiesPerSecond}`);
    
    // Send results
    this.sendPurchaseResult(true, upgradeId, `Purchased ${config.name}!`);
    this.broadcastStateUpdate();
  }
  // #endregion

  // #region 🛠️ Helper Methods
  // Broadcast state to all players
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
  
  // Send purchase result to all players
  private sendPurchaseResult(success: boolean, upgradeId: string, message: string): void {
    const resultData: UIEventPayload = {
      type: "purchase_result",
      success,
      upgradeId,
      message,
    };
    
    this.sendNetworkBroadcastEvent(UIEvents.toClient, resultData);
  }
  // #endregion
}

Component.register(Default);
