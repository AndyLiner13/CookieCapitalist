// Desktop Editor Setup: Attach to NoesisUI entity with Clickers.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 2, Input Mode = No Interaction

// #region 📋 README
// Controller for the Clickers Noesis overlay (rotating finger ring).
// The clicker ring is 100% XAML-driven - no TypeScript animation logic needed.
// All 24 fingers and the rotation animation are hardcoded in XAML for performance.
// This script handles visibility based on page navigation (only visible on home page).
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import * as hz from "horizon/core";
import { NoesisGizmo } from "horizon/noesis";
import { Logger } from "./util_logger";
import { PageType, LocalUIEvents } from "./util_gameData";

// #region 🏷️ Type Definitions
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_clickers");
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

    // Listen for page change events
    this.connectLocalBroadcastEvent(
      LocalUIEvents.changePage,
      (data: { page: PageType }) => this.onPageChange(data.page)
    );

    log.info("Clickers initialized (100% XAML-driven, visible on home page only)");
  }
  // #endregion

  // #region 🎯 Main Logic
  private onPageChange(page: PageType): void {
    const log = this.log.inactive("onPageChange");
    
    if (!this.noesisGizmo) return;
    
    // Only visible on home page
    const isVisible = page === "home";
    this.noesisGizmo.setLocalEntityVisibility(isVisible);
    
    log.info(`Clickers visibility: ${isVisible}`);
  }
  // #endregion
}

hz.Component.register(Default);
