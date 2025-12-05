// Desktop Editor Setup: Attach to NoesisUI entity with Leaderboard.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 5, Input Mode = Interactive nonblocking

// #region 📋 README
// Controller for the Leaderboard overlay.
// Shows player stats and leaderboard rankings.
// Visibility controlled by page navigation events.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import * as hz from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import {
  PageType,
  UIEventPayload,
  UIEvents,
  LocalUIEvents,
  formatNumber,
} from "./util_gameData";

// #region 🏷️ Type Definitions
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_leaderboard");
  private noesisGizmo: NoesisGizmo | null = null;
  private dataContext: IUiViewModelObject = {};
  
  // Current page visibility
  private isVisible: boolean = false;
  
  // Cached game state
  private cookiesPerClick: number = 1;
  private cookiesPerSecond: number = 0;
  private totalUpgrades: number = 0;
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
    
    // Listen for page change events
    this.connectLocalBroadcastEvent(
      LocalUIEvents.changePage,
      (data: { page: PageType }) => this.onPageChange(data.page)
    );

    // Build initial UI (hidden by default)
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;

    log.info("Leaderboard overlay initialized (Render Order: 5)");
  }
  // #endregion

  // #region 🎯 Main Logic
  private buildDataContext(): void {
    // Mock leaderboard data - in a real game this would come from the server
    const leaderboardData = [
      { rank: "#1", username: "CookieMaster", score: "1.2M" },
      { rank: "#2", username: "ClickKing", score: "890K" },
      { rank: "#3", username: "BakerPro", score: "654K" },
      { rank: "#4", username: "You", score: formatNumber(this.cookiesPerSecond * 3600) },
      { rank: "#5", username: "NewPlayer", score: "12K" },
    ];
    
    this.dataContext = {
      isVisible: this.isVisible,
      cookiesPerClick: formatNumber(this.cookiesPerClick),
      currentCPS: formatNumber(this.cookiesPerSecond),
      totalUpgrades: this.totalUpgrades.toString(),
      leaderboard: leaderboardData,
    };
  }
  
  private onPageChange(page: PageType): void {
    const log = this.log.inactive("onPageChange");
    const wasVisible = this.isVisible;
    this.isVisible = page === "stats";
    
    if (wasVisible !== this.isVisible) {
      log.info(`Leaderboard visibility: ${this.isVisible}`);
      this.updateUI();
    }
  }
  
  private handleManagerEvent(data: UIEventPayload): void {
    const log = this.log.inactive("handleManagerEvent");
    
    if (data.type === "state_update") {
      this.cookiesPerClick = (data.cookiesPerClick as number) || 1;
      this.cookiesPerSecond = (data.cookiesPerSecond as number) || 0;
      
      // Count total upgrades
      if (data.upgrades) {
        this.totalUpgrades = Object.values(data.upgrades as { [key: string]: number })
          .reduce((sum, count) => sum + count, 0);
      }
      
      this.updateUI();
    }
  }
  
  private updateUI(): void {
    if (!this.noesisGizmo) return;
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;
  }
  // #endregion
}

hz.Component.register(Default);
