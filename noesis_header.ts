// Desktop Editor Setup: Attach to NoesisUI entity with Header.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 10, Input Mode = No Interaction

// #region 📋 README
// Header overlay controller for Cookie Clicker.
// Displays cookie count and cookies per second at top of screen.
// Receives state updates from manager_game.ts via NetworkEvents.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import { Component, PropTypes } from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import {
  UIEventPayload,
  UIEvents,
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
  private log = new Logger("noesis_header");
  private noesisGizmo: NoesisGizmo | null = null;

  // Cached game state
  private cookies: number = 0;
  private cookiesPerSecond: number = 0;

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

    log.info("Header initialized");
  }
  // #endregion

  // #region 🎯 Main Logic
  private buildDataContext(): void {
    this.dataContext = {
      cookieCount: formatCookieDisplay(this.cookies),
      cookiesPerSecond: formatCPSDisplay(this.cookiesPerSecond),
    };
  }
  // #endregion

  // #region 🎬 Handlers
  private handleManagerEvent(data: UIEventPayload): void {
    if (!data || data.type !== "state_update") {
      return;
    }

    this.cookies = data.cookies as number;
    this.cookiesPerSecond = data.cps as number;

    this.updateUI();
  }
  // #endregion

  // #region 🛠️ Helper Methods
  private updateUI(): void {
    if (!this.noesisGizmo) return;

    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;
  }
  // #endregion
}

Component.register(Default);
