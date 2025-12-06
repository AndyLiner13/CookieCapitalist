// Desktop Editor Setup: Attach to NoesisUI entity with CoreGame.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 5, Input Mode = Interactive nonblocking

// #region 📋 README
// Core game controller - manages all three pages (Cookie, Shop, Leaderboard).
// Handles page switching, cookie clicks, upgrade purchases, and data contexts.
// Receives page change events from Overlay and state updates via NETWORK events from Backend.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import * as hz from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import {
  PageType,
  GameEvents,
  UIEvents,
  UIEventPayload,
  LocalUIEvents,
  UPGRADE_CONFIGS,
  calculateUpgradeCost,
  formatPrice,
  formatNumber,
  formatTimeRemaining,
  getTier,
  getNextTierThreshold,
  getTierSpeedMultiplier,
  calculateCookiesPerCycle,
  formatRateDisplay,
} from "./util_gameData";

// #region 🏷️ Type Definitions
// 40 popups to handle max click rate (600ms animation / 16ms per frame ≈ 38 max visible)
const POPUP_COUNT = 40;
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    popupFontSize: { type: hz.PropTypes.Number, default: 48 },
    popupColor: { type: hz.PropTypes.String, default: "#FFFFFF" },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_coreGame");
  private noesisGizmo: NoesisGizmo | null = null;
  private dataContext: IUiViewModelObject = {};
  
  // Current page
  private currentPage: PageType = "home";
  
  // Game state (from manager)
  private cookies: number = 0;
  private cookiesPerClick: number = 1;
  private cookiesPerSecond: number = 0;
  private upgrades: { [upgradeId: string]: number } = {};
  
  // Production timer state (progress 0-1 for each upgrade type)
  private productionProgress: { [upgradeId: string]: number } = {};
  private lastTickTime: number = 0;
  private static readonly TICK_RATE_MS = 50; // Update progress every 50ms
  
  // Popup system state
  private nextPopupIndex: number = 0;
  
  // Dunk animation state
  private isDunking: boolean = false;
  
  // Player info for leaderboard
  private playerName: string = "You";
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");

    this.noesisGizmo = this.entity.as(NoesisGizmo);
    if (!this.noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }
    
    // Get local player name for leaderboard
    try {
      const localPlayer = this.world.getLocalPlayer();
      if (localPlayer) {
        this.playerName = localPlayer.name.get();
        log.info(`Local player: ${this.playerName}`);
      }
    } catch (e) {
      log.warn("Could not get local player name");
    }
    
    // Initialize upgrades map and production progress
    for (const config of UPGRADE_CONFIGS) {
      this.upgrades[config.id] = 0;
      this.productionProgress[config.id] = 0;
    }

    // Listen for state updates via NETWORK event (from Backend)
    this.connectNetworkBroadcastEvent(
      UIEvents.toClient,
      (data: UIEventPayload) => this.handleStateChanged(data)
    );
    
    // Listen for page change events from Overlay
    this.connectLocalBroadcastEvent(
      LocalUIEvents.changePage,
      (data: { page: PageType }) => this.onPageChange(data.page)
    );
    
    // Listen for swipe down gesture (from controller_player on mobile)
    this.connectLocalBroadcastEvent(
      LocalUIEvents.swipeDown,
      () => this.onSwipeDown()
    );

    // Build and set initial data context
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;
    
    // Start production timer tick
    this.lastTickTime = Date.now();
    this.async.setInterval(() => this.productionTick(), Default.TICK_RATE_MS);

    log.info("CoreGame initialized - Home page visible");
  }
  // #endregion

  // #region 🎯 Main Logic
  private onPageChange(page: PageType): void {
    const log = this.log.active("onPageChange");
    
    if (this.currentPage === page) {
      return;
    }
    
    log.info(`Page changed: ${this.currentPage} -> ${page}`);
    this.currentPage = page;
    
    // Update page visibility
    this.dataContext.homeVisible = page === "home";
    this.dataContext.shopVisible = page === "shop";
    this.dataContext.statsVisible = page === "stats";
    
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
  }
  
  private buildDataContext(): void {
    // Page visibility
    const homeVisible = this.currentPage === "home";
    const shopVisible = this.currentPage === "shop";
    const statsVisible = this.currentPage === "stats";
    
    // Build upgrade data for shop (commands set once)
    const upgradeData: { [key: string]: any } = {};
    for (const config of UPGRADE_CONFIGS) {
      const owned = this.upgrades[config.id] || 0;
      const cost = calculateUpgradeCost(config.baseCost, owned);
      const canAfford = this.cookies >= cost;
      const isMaxed = config.id === "clicker" && owned >= 24;
      const progress = this.productionProgress[config.id] || 0;
      
      // Tier calculations
      const tier = getTier(owned);
      const speedMultiplier = getTierSpeedMultiplier(tier);
      const effectiveProductionTime = config.productionTimeMs / speedMultiplier;
      const timeRemainingMs = (1 - progress) * effectiveProductionTime;
      const isProducing = owned > 0;
      const nextTierThreshold = getNextTierThreshold(owned);
      const tierProgress = nextTierThreshold ? `${owned}/${nextTierThreshold}` : `${owned} MAX`;
      
      // Calculate actual cookies per cycle for rate display
      const actualCookiesPerCycle = calculateCookiesPerCycle(config.cookiesPerCycle, owned);
      
      upgradeData[config.id] = {
        name: config.name,
        owned: owned.toString(),
        price: isMaxed ? "MAXED OUT" : formatPrice(cost),
        canAfford: isMaxed ? false : canAfford,
        isMaxed: isMaxed,
        buyCommand: () => this.purchaseUpgrade(config.id),
        // Production timer data
        progress: progress,                              // 0.0 to 1.0
        progressWidth: Math.min(240, Math.round(progress * 240)), // Width for progress bar (240 max)
        timeRemaining: formatTimeRemaining(timeRemainingMs),
        isProducing: isProducing,
        rateDisplay: isProducing ? formatRateDisplay(actualCookiesPerCycle) : config.rateDisplay,
        // Tier data
        tier: tier,
        tierProgress: tierProgress,                      // e.g. "5/10" or "1000 MAX"
        speedMultiplier: `${speedMultiplier}x`,
      };
    }
    
    // Build leaderboard data
    // Note: Horizon Worlds API only allows SETTING leaderboard scores, not READING them
    // Real leaderboard rankings are shown via the World Leaderboard Gizmo in-world
    // This custom UI shows placeholder data with the current player's real score
    const leaderboardData = {
      leaderboard1: { username: "CookieMaster", score: "1.2M" },
      leaderboard2: { username: "ClickKing", score: "890K" },
      leaderboard3: { username: "BakerPro", score: "654K" },
      leaderboard4: { username: this.playerName, score: formatNumber(this.cookies), rank: "4" },
      leaderboard5: { username: "NewPlayer", score: "12K" },
    };
    
    this.dataContext = {
      // Page visibility
      homeVisible,
      shopVisible,
      statsVisible,
      
      // Cookie page (command set once)
      onCookieClick: () => this.onCookieClick(),
      dunkAnimate: false,
      PopupFontSize: this.props.popupFontSize,
      PopupColor: this.props.popupColor,
      
      // Shop page - individual upgrade objects
      clicker: upgradeData["clicker"],
      grandma: upgradeData["grandma"],
      farm: upgradeData["farm"],
      factory: upgradeData["factory"],
      lab: upgradeData["lab"],
      fab: upgradeData["fab"],
      planet: upgradeData["planet"],
      
      // Leaderboard page
      ...leaderboardData,
    };
    
    // Initialize popup slots (only on initial build)
    for (let i = 0; i < POPUP_COUNT; i++) {
      this.dataContext[`Popup${i}Text`] = "";
      this.dataContext[`Popup${i}Visible`] = false;
      this.dataContext[`Popup${i}Animate`] = false;
      this.dataContext[`Popup${i}Margin`] = "0,0,0,0";
    }
  }
  
  private updateShopData(): void {
    // Update shop upgrade data without resetting commands or popups
    for (const config of UPGRADE_CONFIGS) {
      const owned = this.upgrades[config.id] || 0;
      const cost = calculateUpgradeCost(config.baseCost, owned);
      const canAfford = this.cookies >= cost;
      const isMaxed = config.id === "clicker" && owned >= 24;
      const progress = this.productionProgress[config.id] || 0;
      
      // Tier calculations
      const tier = getTier(owned);
      const speedMultiplier = getTierSpeedMultiplier(tier);
      const effectiveProductionTime = config.productionTimeMs / speedMultiplier;
      const timeRemainingMs = (1 - progress) * effectiveProductionTime;
      const isProducing = owned > 0;
      const nextTierThreshold = getNextTierThreshold(owned);
      const tierProgress = nextTierThreshold ? `${owned}/${nextTierThreshold}` : `${owned} MAX`;
      
      // Calculate actual cookies per cycle for rate display
      const actualCookiesPerCycle = calculateCookiesPerCycle(config.cookiesPerCycle, owned);
      
      const upgradeObj = this.dataContext[config.id] as any;
      if (upgradeObj) {
        upgradeObj.owned = owned.toString();
        upgradeObj.price = isMaxed ? "MAXED OUT" : formatPrice(cost);
        upgradeObj.canAfford = isMaxed ? false : canAfford;
        upgradeObj.isMaxed = isMaxed;
        // Production timer data
        upgradeObj.progress = progress;
        upgradeObj.progressWidth = Math.min(240, Math.round(progress * 240));
        upgradeObj.timeRemaining = formatTimeRemaining(timeRemainingMs);
        upgradeObj.isProducing = isProducing;
        upgradeObj.rateDisplay = isProducing ? formatRateDisplay(actualCookiesPerCycle) : config.rateDisplay;
        // Tier data
        upgradeObj.tier = tier;
        upgradeObj.tierProgress = tierProgress;
        upgradeObj.speedMultiplier = `${speedMultiplier}x`;
      }
    }
    
    // Update leaderboard "You" score
    const leaderboard4 = this.dataContext.leaderboard4 as any;
    if (leaderboard4) {
      leaderboard4.score = formatNumber(this.cookies);
    }
  }
  
  private productionTick(): void {
    const now = Date.now();
    const deltaTime = now - this.lastTickTime;
    this.lastTickTime = now;
    
    let dataChanged = false;
    
    // Update production progress for each upgrade type
    for (const config of UPGRADE_CONFIGS) {
      const owned = this.upgrades[config.id] || 0;
      if (owned <= 0) continue;
      
      // Calculate tier and speed multiplier
      const tier = getTier(owned);
      const speedMultiplier = getTierSpeedMultiplier(tier);
      const effectiveProductionTime = config.productionTimeMs / speedMultiplier;
      
      // Progress increment based on delta time and effective production time
      const progressIncrement = deltaTime / effectiveProductionTime;
      this.productionProgress[config.id] = (this.productionProgress[config.id] || 0) + progressIncrement;
      
      // Check if production cycle completed
      if (this.productionProgress[config.id] >= 1) {
        // Award cookies using scaled amount (8.7% increase per upgrade owned)
        const cookiesEarned = calculateCookiesPerCycle(config.cookiesPerCycle, owned);
        
        // Send production completion to server
        this.sendNetworkBroadcastEvent(GameEvents.toServer, {
          type: "production_complete",
          upgradeId: config.id,
          cookies: cookiesEarned,
        });
        
        // Notify background to rain cookies proportional to batch size
        this.sendLocalBroadcastEvent(LocalUIEvents.batchComplete, {
          cookies: cookiesEarned,
        });
        
        // Reset progress (keep overflow for smooth cycles)
        this.productionProgress[config.id] = this.productionProgress[config.id] - 1;
      }
      
      // Update UI data
      const upgradeObj = this.dataContext[config.id] as any;
      if (upgradeObj) {
        const progress = this.productionProgress[config.id];
        const timeRemainingMs = (1 - progress) * effectiveProductionTime;
        upgradeObj.progress = progress;
        upgradeObj.progressWidth = Math.min(240, Math.round(progress * 240));
        upgradeObj.timeRemaining = formatTimeRemaining(timeRemainingMs);
        upgradeObj.isProducing = true;
        dataChanged = true;
      }
    }
    
    // Push updated data context to Noesis
    if (dataChanged && this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
  }
  
  private handleStateChanged(data: UIEventPayload): void {
    const log = this.log.inactive("handleStateChanged");
    
    if (data.type !== "state_update") return;
    
    // Update cached state
    this.cookies = (data.cookies as number) || 0;
    this.cookiesPerClick = (data.cookiesPerClick as number) || 1;
    this.cookiesPerSecond = (data.cps as number) || 0;
    
    // Update upgrades
    if (data.upgrades) {
      for (const [id, count] of Object.entries(data.upgrades as { [key: string]: number })) {
        this.upgrades[id] = count;
      }
    }
    
    // Update shop data without resetting popups
    this.updateShopData();
    
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
  }
  // #endregion
  
  // #region 🎬 Handlers
  private onCookieClick(): void {
    const log = this.log.active("onCookieClick");
    log.info("Cookie clicked!");

    // Show +# popup
    this.showPopup(`+${this.cookiesPerClick}`);

    // Broadcast click via LOCAL event (for rain/visual effects)
    this.sendLocalBroadcastEvent(LocalUIEvents.cookieClicked, {});
    
    // Send to server via NETWORK event
    this.sendNetworkBroadcastEvent(GameEvents.toServer, {
      type: "cookie_clicked",
    });
  }
  
  private triggerDunkAnimation(): void {
    const log = this.log.active("triggerDunkAnimation");
    
    if (this.isDunking) {
      log.info("Already dunking, ignoring");
      return;
    }
    
    this.isDunking = true;
    
    // Trigger animation by toggling dunkAnimate
    this.dataContext.dunkAnimate = false;
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
    
    // Small delay then set to true to trigger animation
    this.async.setTimeout(() => {
      this.dataContext.dunkAnimate = true;
      if (this.noesisGizmo) {
        this.noesisGizmo.dataContext = this.dataContext;
      }
      
      // Reset after animation completes (1.6 seconds)
      this.async.setTimeout(() => {
        this.dataContext.dunkAnimate = false;
        this.isDunking = false;
        if (this.noesisGizmo) {
          this.noesisGizmo.dataContext = this.dataContext;
        }
      }, 1700);
    }, 50);
  }
  
  private onSwipeDown(): void {
    const log = this.log.active("onSwipeDown");
    
    // Only trigger dunk when on home page
    if (this.currentPage !== "home") {
      log.info("Not on home page, ignoring swipe");
      return;
    }
    
    log.info("Swipe down received - triggering dunk!");
    this.triggerDunkAnimation();
  }
  
  private purchaseUpgrade(upgradeId: string): void {
    const log = this.log.active("purchaseUpgrade");
    log.info(`Purchasing upgrade: ${upgradeId}`);
    
    // Send to server via NETWORK event
    this.sendNetworkBroadcastEvent(GameEvents.toServer, {
      type: "buy_upgrade",
      upgradeId: upgradeId,
    });
  }
  
  private showPopup(text: string): void {
    const log = this.log.inactive("showPopup");
    
    // Round-robin slot selection
    const popupIndex = this.nextPopupIndex;
    this.nextPopupIndex = (popupIndex + 1) % POPUP_COUNT;
    
    // Random position within circular cookie area (cookie is 256x256, radius 128)
    // Use sqrt for uniform distribution across the circular area
    // Margin offsets are doubled since centered elements need 2x offset to move the same distance
    const angle = Math.random() * 2 * Math.PI;
    const radius = Math.sqrt(Math.random()) * 128;
    const offsetX = Math.floor(Math.cos(angle) * radius * 2);
    const offsetY = Math.floor(Math.sin(angle) * radius * 2);
    
    // Reset and set new values
    this.dataContext[`Popup${popupIndex}Animate`] = false;
    this.dataContext[`Popup${popupIndex}Text`] = text;
    this.dataContext[`Popup${popupIndex}Visible`] = true;
    this.dataContext[`Popup${popupIndex}Margin`] = `${offsetX},${offsetY},0,0`;
    
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
      
      // Trigger animation on next frame
      this.async.setTimeout(() => {
        this.dataContext[`Popup${popupIndex}Animate`] = true;
        if (this.noesisGizmo) {
          this.noesisGizmo.dataContext = this.dataContext;
        }
      }, 1);
    }
    
    log.info(`Showing popup ${popupIndex}: ${text}`);
  }
  // #endregion
}

hz.Component.register(Default);
