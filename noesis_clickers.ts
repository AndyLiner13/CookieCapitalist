// Clickers Entity Configuration: file://./.github/instructions/entities/Clickers.instructions.md

// #region 📋 README
// Controller for the Clickers Noesis overlay (rotating finger ring).
// The clicker ring is 100% XAML-driven - no TypeScript animation logic needed.
// All 24 fingers and the rotation animation are hardcoded in XAML for performance.
// This script handles visibility based on page navigation (only visible on home page).
// Finger visibility is controlled by the number of clicker upgrades purchased.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import * as hz from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import { PageType, LocalUIEvents, UIEvents, UIEventPayload } from "./util_gameData";

// #region 🏷️ Type Definitions
const FINGER_COUNT = 24;
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_clickers");
  private noesisGizmo: NoesisGizmo | null = null;
  private dataContext: IUiViewModelObject = {};
  private clickerCount: number = 0;
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.inactive("start");

    this.noesisGizmo = this.entity.as(NoesisGizmo);
    if (!this.noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }

    // Initialize finger visibility (all hidden by default)
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;

    // Listen for page change events
    this.connectLocalBroadcastEvent(
      LocalUIEvents.changePage,
      (data: { page: PageType }) => this.onPageChange(data.page)
    );

    // Listen for state updates via NETWORK event (from Backend)
    this.connectNetworkBroadcastEvent(
      UIEvents.toClient,
      (data: UIEventPayload) => this.handleStateChanged(data)
    );

    log.info("Clickers initialized - 0 fingers visible by default");
  }
  // #endregion

  // #region 🎯 Main Logic
  private buildDataContext(): void {
    // Initialize all fingers as hidden
    for (let i = 0; i < FINGER_COUNT; i++) {
      this.dataContext[`Finger${i}Visible`] = false;
    }
  }
  
  private updateFingerVisibility(): void {
    const log = this.log.inactive("updateFingerVisibility");
    
    // Show fingers based on clicker count (max 24)
    const visibleCount = Math.min(this.clickerCount, FINGER_COUNT);
    
    for (let i = 0; i < FINGER_COUNT; i++) {
      this.dataContext[`Finger${i}Visible`] = i < visibleCount;
    }
    
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
    
    log.info(`Showing ${visibleCount} of ${FINGER_COUNT} fingers`);
  }
  
  private handleStateChanged(data: UIEventPayload): void {
    const log = this.log.inactive("handleStateChanged");
    
    if (data.type !== "state_update") return;
    
    // Extract clicker count from upgrades
    const upgrades = data.upgrades as { [key: string]: number } | undefined;
    const newClickerCount = upgrades?.["clicker"] || 0;
    
    if (newClickerCount !== this.clickerCount) {
      log.info(`Clicker count changed: ${this.clickerCount} -> ${newClickerCount}`);
      this.clickerCount = newClickerCount;
      this.updateFingerVisibility();
    }
  }
  
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
