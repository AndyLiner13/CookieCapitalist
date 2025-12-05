// Desktop Editor Setup: Attach to NoesisUI entity with Navigation.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 10, Input Mode = Interactive nonblocking

// #region 📋 README
// Navigation overlay controller for Cookie Clicker.
// Handles bottom tab bar with Shop, Home, and Leaderboard buttons.
// Broadcasts page change events to other overlays via LocalUIEvents.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import { Component, PropTypes } from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import { PageType, LocalUIEvents } from "./util_gameData";

// #region 🏷️ Type Definitions
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_navigation");
  private noesisGizmo: NoesisGizmo | null = null;

  // Current page being displayed
  private currentPage: PageType = "home";

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

    // Build and set initial UI
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;

    log.info("Navigation initialized");
  }
  // #endregion

  // #region 🎯 Main Logic
  private buildDataContext(): void {
    this.dataContext = {
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

    // Broadcast page change to other overlays (Cookie, Shop, Leaderboard, FingerRing, etc.)
    this.sendLocalBroadcastEvent(LocalUIEvents.changePage, { page });
  }
  // #endregion

  // #region 🛠️ Helper Methods
  // #endregion
}

Component.register(Default);
