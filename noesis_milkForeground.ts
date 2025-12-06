// Desktop Editor Setup: Attach to NoesisUI entity with MilkBackground.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Spatial, Render Order = 7, Input Mode = No Interaction

// #region 📋 README
// Milk Background (front wave layer) controller.
// Hides when player navigates to shop or leaderboard pages.
// Listens to LocalUIEvents.changePage broadcast from Overlay controller.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import { Component } from "horizon/core";
import { NoesisGizmo } from "horizon/noesis";
import { Logger } from "./util_logger";
import { PageType, LocalUIEvents } from "./util_gameData";

// #region 🏷️ Type Definitions
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_milkBackground");
  private noesisGizmo: NoesisGizmo | null = null;
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");

    this.noesisGizmo = this.entity.as(NoesisGizmo);
    if (!this.noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }

    // Listen for page changes from Overlay
    this.connectLocalBroadcastEvent(
      LocalUIEvents.changePage,
      (data) => this.handlePageChange(data.page)
    );

    log.info("Milk Background initialized");
  }
  // #endregion

  // #region 🎬 Handlers
  private handlePageChange(page: PageType): void {
    const log = this.log.active("handlePageChange");
    
    if (!this.noesisGizmo) return;

    // Show milk only on home page, hide on shop and stats
    const shouldShow = page === "home";
    this.noesisGizmo.visible.set(shouldShow);
    
    log.info(`Page changed to ${page}, milk ${shouldShow ? "visible" : "hidden"}`);
  }
  // #endregion
}

Component.register(Default);
