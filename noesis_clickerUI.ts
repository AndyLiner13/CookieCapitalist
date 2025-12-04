// Desktop Editor Setup: Attach to NoesisUI entity with ClickerGame.xaml. Use Shared execution mode.

// #region 📋 README
// Unified Noesis UI controller for Cookie Clicker.
// Handles all three pages (Home, Shop, Stats) with navigation.
// Includes cookie button with click animations and +# popup system.
// Communicates with manager_game.ts via NetworkEvents.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import { Component, PropTypes } from "horizon/core";
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
const POPUP_COUNT = 10;
const POPUP_DURATION_MS = 600; // Match animation duration in XAML
const FINGER_COUNT = 24;
const FINGER_CLICK_INTERVAL_MS = 150; // ms between each finger "click" in the ring
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    popupFontSize: { type: PropTypes.Number, default: 48 },
    popupColor: { type: PropTypes.String, default: "#FFFFFF" },
  };
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
  
  // Popup system state - round-robin index for next popup slot
  private nextPopupIndex: number = 0;
  
  // Finger ring state - which finger is currently "clicking"
  private activeFingerIndex: number = 0;
  
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
    
    // Start sequential finger click animation loop
    this.startFingerClickLoop();
    
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
    const homeData: IUiViewModelObject = {
      onCookieClick: () => this.onCookieClick(),
      // Popup style configuration
      PopupFontSize: this.props.popupFontSize,
      PopupColor: this.props.popupColor,
      // Finger positions for the rotating ring
      // Uses FINGER_COUNT fingers around the circle, all clicking at the same speed
      // but staggered so only one finger "clicks" at a time
      fingerPositions: this.generateFingerPositions(FINGER_COUNT, 150),
    };
    
    // Preserve existing popup state or initialize to defaults
    for (let i = 0; i < POPUP_COUNT; i++) {
      homeData[`Popup${i}Text`] = this.dataContext[`Popup${i}Text`] || "";
      homeData[`Popup${i}Visible`] = this.dataContext[`Popup${i}Visible`] || "Collapsed";
      homeData[`Popup${i}Animate`] = this.dataContext[`Popup${i}Animate`] || false;
      homeData[`Popup${i}Margin`] = this.dataContext[`Popup${i}Margin`] || "0,0,0,0";
    }
    
    return homeData;
  }
  
  // Generate finger positions around a circle
  // Returns array of {left, top, rotation, isClicking} for each finger
  private generateFingerPositions(count: number, radius: number): Array<{left: number; top: number; rotation: number; isClicking: boolean}> {
    const positions: Array<{left: number; top: number; rotation: number; isClicking: boolean}> = [];
    const centerX = 168 - 18; // Canvas center (336/2) minus half finger width (36/2)
    const centerY = 168 - 18;
    
    for (let i = 0; i < count; i++) {
      const angleDegrees = (i * 360) / count;
      const angleRadians = (angleDegrees * Math.PI) / 180;
      
      // Position on circle (0° is at bottom, going clockwise)
      const left = centerX + radius * Math.sin(angleRadians);
      const top = centerY + radius * Math.cos(angleRadians);
      
      // Rotation to point finger toward center (opposite of position angle)
      const rotation = -angleDegrees;
      
      // Mark this finger as the active "clicking" finger if its index matches
      const isClicking = i === this.activeFingerIndex;
      
      positions.push({ left, top, rotation, isClicking });
    }
    
    return positions;
  }
  
  // Start loop that advances which finger is currently "clicking"
  private startFingerClickLoop(): void {
    // Advance active finger index in a simple endless loop
    this.async.setInterval(() => {
      // Step in the opposite direction around the ring
      this.activeFingerIndex = (this.activeFingerIndex - 1 + FINGER_COUNT) % FINGER_COUNT;
      // Rebuild only the parts of the UI that depend on activeFingerIndex
      this.updateUI();
    }, FINGER_CLICK_INTERVAL_MS);
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

  // #region 🍪 Cookie Click & Popup Logic
  private onCookieClick(): void {
    const log = this.log.inactive("onCookieClick");
    log.info("Cookie clicked!");
    
    // Optimistic local update - immediately update UI without waiting for server
    this.cookies += this.cookiesPerClick;
    this.updateCookieDisplay();
    
    // Show +# popup (immediate visual feedback)
    this.showPopup(`+${this.cookiesPerClick}`);
    
    // Send click to game manager (server will validate and sync)
    this.sendToManager({ type: "cookie_clicked" });
  }
  
  // Update just the cookie display without rebuilding entire data context
  private updateCookieDisplay(): void {
    if (!this.noesisGizmo) return;
    
    this.dataContext.cookieCount = formatCookieDisplay(this.cookies);
    this.noesisGizmo.dataContext = this.dataContext;
  }
  
  private showPopup(text: string): void {
    const log = this.log.inactive("showPopup");
    
    // Use round-robin slot selection - always use the next slot
    // This ensures even distribution and avoids "in use" checks
    const popupIndex = this.nextPopupIndex;
    this.nextPopupIndex = (popupIndex + 1) % POPUP_COUNT;
    
    // Generate random position anywhere on the cookie (256x256 cookie area)
    const offsetX = Math.floor((Math.random() - 0.5) * 256);
    const offsetY = Math.floor((Math.random() - 0.5) * 256);
    
    // Reset animation state first, then set new values
    this.dataContext[`Popup${popupIndex}Animate`] = false;
    this.dataContext[`Popup${popupIndex}Text`] = text;
    this.dataContext[`Popup${popupIndex}Visible`] = "Visible";
    this.dataContext[`Popup${popupIndex}Margin`] = `${offsetX},${offsetY},0,0`;
    
    // Apply changes and trigger animation in one update
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
