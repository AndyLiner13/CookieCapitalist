// Desktop Editor Setup: Attach to NoesisUI entity with Overlay.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 10, Input Mode = Interactive nonblocking

// #region 📋 README
// Overlay controller - combines Header and Navigation.
// Displays cookie count/CPS at top, navigation tabs at bottom.
// Broadcasts page change events to CoreGame and other overlays.
// Receives state updates from manager_game for header display.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import { Component } from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import {
  PageType,
  UIEventPayload,
  UIEvents,
  LocalUIEvents,
  formatCookieDisplay,
  formatCPSDisplay,
} from "./util_gameData";

// #region 🏷️ Type Definitions
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_overlay");
  private noesisGizmo: NoesisGizmo | null = null;
  private dataContext: IUiViewModelObject = {};
  
  // Current page
  private currentPage: PageType = "home";
  
  // Cached game state for header
  private cookies: number = 0;
  private cookiesPerSecond: number = 0;
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");

    this.noesisGizmo = this.entity.as(NoesisGizmo);
    if (!this.noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }

    // Listen for state updates from game manager
    this.connectNetworkBroadcastEvent(
      UIEvents.toClient,
      (data: UIEventPayload) => this.handleManagerEvent(data)
    );

    // Build and set initial data context (commands are set once here)
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;

    log.info("Overlay initialized (Header + Navigation)");
  }
  // #endregion

  // #region 🎯 Main Logic
  private buildDataContext(): void {
    // Commands are set once and reused - don't recreate them on updates!
    this.dataContext = {
      // Header data
      cookieCount: formatCookieDisplay(this.cookies),
      cookiesPerSecond: formatCPSDisplay(this.cookiesPerSecond),
      
      // Navigation commands (set once, never recreated)
      onShopClick: () => this.navigateToPage("shop"),
      onHomeClick: () => this.navigateToPage("home"),
      onStatsClick: () => this.navigateToPage("stats"),
    };
  }

  private navigateToPage(page: PageType): void {
    const log = this.log.active("navigateToPage");

    if (this.currentPage === page) {
      log.info(`Already on ${page} page`);
      return;
    }

    log.info(`Navigating from ${this.currentPage} to ${page}`);
    this.currentPage = page;

    // Broadcast page change to CoreGame and other overlays (Clickers, Background)
    this.sendLocalBroadcastEvent(LocalUIEvents.changePage, { page });
  }
  // #endregion

  // #region 🎬 Handlers
  private handleManagerEvent(data: UIEventPayload): void {
    if (!data || data.type !== "state_update") {
      return;
    }

    this.cookies = (data.cookies as number) || 0;
    this.cookiesPerSecond = (data.cps as number) || 0;

    this.updateUI();
  }
  // #endregion

  // #region 🛠️ Helper Methods
  private updateUI(): void {
    if (!this.noesisGizmo) return;
    
    // Only update header values - DON'T recreate commands!
    this.dataContext.cookieCount = formatCookieDisplay(this.cookies);
    this.dataContext.cookiesPerSecond = formatCPSDisplay(this.cookiesPerSecond);
    
    this.noesisGizmo.dataContext = this.dataContext;
  }
  // #endregion
}

Component.register(Default);
