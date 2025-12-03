// Desktop Editor Setup: Attach to NoesisUI entity with HomePage.xaml

// #region 📋 README
// Unified Noesis UI controller for Cookie Clicker.
// Handles all three pages (Home, Shop, Stats) with navigation.
// Communicates with manager_game.ts via NetworkEvents.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import { Component } from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import {
  PageType,
  GameEventPayload,
  UIEventPayload,
  GameEvents,
  UIEvents,
  UPGRADE_CONFIGS,
  calculateUpgradeCost,
  formatCookieDisplay,
  formatCPSDisplay,
  formatPrice,
  formatNumber,
} from "./util_gameData";

// #region 🏷️ Type Definitions
// (Types are now in util_gameData.ts)
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_clickerUI");
  private noesisGizmo: NoesisGizmo | null = null;
  
  // Current page being displayed
  private currentPage: PageType = "home";
  
  // Cached game state from manager
  private cookies: number = 0;
  private cookiesPerSecond: number = 0;
  private cookiesPerClick: number = 1;
  private upgrades: { [upgradeId: string]: number } = {};
  
  // Data context for Noesis binding
  private dataContext: IUiViewModelObject = {};
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");
    
    // Get NoesisGizmo reference
    this.noesisGizmo = this.entity.as(NoesisGizmo);
    
    if (!this.noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }
    
    // Initialize upgrades map
    for (const config of UPGRADE_CONFIGS) {
      this.upgrades[config.id] = 0;
    }
    
    // Listen for state updates from game manager
    this.connectNetworkBroadcastEvent(
      UIEvents.toClient,
      (data: UIEventPayload) => {
        this.handleManagerEvent(data);
      }
    );
    
    // Build and set initial UI
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;
    
    // Request initial state from game manager
    this.async.setTimeout(() => {
      this.sendToManager({ type: "request_state" });
    }, 100);
    
    log.info("ClickerUI initialized on page: " + this.currentPage);
  }
  // #endregion

  // #region 🎯 Main Logic
  // Build the complete data context for current page
  private buildDataContext(): void {
    // Common header data (shown on all pages)
    const headerData = {
      cookieCount: formatCookieDisplay(this.cookies),
      cookiesPerSecond: formatCPSDisplay(this.cookiesPerSecond),
    };
    
    // Page visibility bindings (Noesis uses "Visible" and "Collapsed")
    const pageVisibility = {
      homePageVisible: this.currentPage === "home" ? "Visible" : "Collapsed",
      shopPageVisible: this.currentPage === "shop" ? "Visible" : "Collapsed",
      statsPageVisible: this.currentPage === "stats" ? "Visible" : "Collapsed",
    };
    
    // Navigation events (shown on all pages)
    // Left = Shop, Middle = Home, Right = Stats/Leaderboard
    const navEvents = {
      onShopClick: () => this.navigateToPage("shop"),
      onHomeClick: () => this.navigateToPage("home"),
      onStatsClick: () => this.navigateToPage("stats"),
    };
    
    // Build page-specific data
    const homeData = this.buildHomePageData();
    const shopData = this.buildShopPageData();
    const statsData = this.buildStatsPageData();
    
    // Combine all data (all pages included, visibility controls which is shown)
    this.dataContext = {
      ...headerData,
      ...pageVisibility,
      ...homeData,
      ...shopData,
      ...statsData,
      events: navEvents,
    };
  }
  
  // Build home page specific data
  private buildHomePageData(): IUiViewModelObject {
    // Cookie button is now in a separate gizmo (CookieButton.xaml)
    // This page is empty - just a placeholder for navigation state
    return {};
  }
  
  // Build shop page specific data
  private buildShopPageData(): IUiViewModelObject {
    const upgradesList = UPGRADE_CONFIGS.map((config) => {
      const owned = this.upgrades[config.id] || 0;
      const cost = calculateUpgradeCost(config.baseCost, owned);
      const canAfford = this.cookies >= cost;
      
      return {
        image: config.image,
        name: config.name,
        buyLabel: `Buy x1`,
        price: formatPrice(cost),
        rate: config.rateDisplay,
        owned: owned.toString(),
        canAfford: canAfford,
        buyCommand: () => this.onBuyUpgrade(config.id),
      };
    });
    
    return {
      upgrades: upgradesList,
    };
  }
  
  // Build stats/leaderboard page specific data
  private buildStatsPageData(): IUiViewModelObject {
    // Calculate some stats
    let totalUpgrades = 0;
    for (const id in this.upgrades) {
      totalUpgrades += this.upgrades[id];
    }
    
    return {
      totalUpgrades: totalUpgrades.toString(),
      cookiesPerClick: this.cookiesPerClick.toString(),
      currentCPS: formatNumber(this.cookiesPerSecond),
      // Placeholder leaderboard entries
      leaderboard: [
        { rank: "1", username: "You", score: formatNumber(this.cookies) },
      ],
    };
  }
  // #endregion

  // #region 🎬 Handlers
  // Handle events from game manager
  private handleManagerEvent(data: UIEventPayload): void {
    const log = this.log.active("handleManagerEvent");
    
    if (!data || !data.type) {
      return;
    }
    
    switch (data.type) {
      case "state_update":
        this.handleStateUpdate(data);
        break;
        
      case "purchase_result":
        this.handlePurchaseResult(data);
        break;
        
      default:
        log.warn(`Unknown UI event type`);
    }
  }
  
  // Handle state update from manager
  private handleStateUpdate(data: UIEventPayload): void {
    const log = this.log.inactive("handleStateUpdate");
    
    this.cookies = data.cookies as number;
    this.cookiesPerSecond = data.cps as number;
    this.cookiesPerClick = data.cookiesPerClick as number;
    this.upgrades = data.upgrades as { [upgradeId: string]: number };
    
    log.info(`State updated: ${this.cookies} cookies, ${this.cookiesPerSecond} CPS`);
    
    this.updateUI();
  }
  
  // Handle purchase result from manager
  private handlePurchaseResult(data: UIEventPayload): void {
    const log = this.log.active("handlePurchaseResult");
    
    if (data.success) {
      log.info(`Purchase success: ${data.message}`);
    } else {
      log.info(`Purchase failed: ${data.message}`);
    }
    // Could show a toast notification here
  }
  
  // Handle buying an upgrade
  private onBuyUpgrade(upgradeId: string): void {
    const log = this.log.active("onBuyUpgrade");
    log.info(`Attempting to buy upgrade: ${upgradeId}`);
    
    this.sendToManager({
      type: "buy_upgrade",
      upgradeId: upgradeId,
    });
  }
  
  // Navigate to a different page
  private navigateToPage(page: PageType): void {
    const log = this.log.active("navigateToPage");
    
    if (this.currentPage === page) {
      log.info(`Already on ${page} page`);
      return;
    }
    
    log.info(`Navigating from ${this.currentPage} to ${page}`);
    this.currentPage = page;
    
    this.updateUI();
  }
  // #endregion

  // #region 🛠️ Helper Methods
  // Update the Noesis UI
  private updateUI(): void {
    if (!this.noesisGizmo) return;
    
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;
  }
  
  // Send event to game manager (server)
  private sendToManager(data: GameEventPayload): void {
    this.sendNetworkBroadcastEvent(GameEvents.toServer, data);
  }
  // #endregion
}

Component.register(Default);
