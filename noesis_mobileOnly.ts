// MobileOnly Modal Entity Configuration: file://./.github/instructions/entities/MobileOnly Modal.instructions.md

// #region 📋 README
// MobileOnly overlay controller - shows a blocking warning for non-mobile users.
// Listens for state updates from Backend and toggles visibility based on:
// - Backend mobileOnly flag
// - Local player device type (Mobile vs Web/VR)
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import { Component, PlayerDeviceType } from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import { UIEvents, UIEventPayload } from "./util_gameData";

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_mobileOnly");
  private noesisGizmo: NoesisGizmo | null = null;
  private dataContext: IUiViewModelObject = {};
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.inactive("start");

    // Skip server - Noesis dataContext only works on clients
    if (this.world.getLocalPlayer().id === this.world.getServerPlayer().id) {
      log.info("Running on server - skipping");
      return;
    }

    this.noesisGizmo = this.entity.as(NoesisGizmo);
    if (!this.noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }

    // Initial data context - start hidden
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;

    // Listen for state updates from backend (contains mobileOnly flag)
    this.connectNetworkBroadcastEvent(
      UIEvents.toClient,
      (data: UIEventPayload) => {
        this.handleStateUpdate(data);
      }
    );

    log.info("MobileOnly controller initialized");
  }
  // #endregion

  // #region 🎯 Main Logic
  private buildDataContext(): void {
    const log = this.log.inactive("buildDataContext");

    this.dataContext = {
      isVisible: false,
    };

    log.info("DataContext created for MobileOnly overlay");
  }
  // #endregion

  // #region 🎬 Handlers
  private handleStateUpdate(data: UIEventPayload): void {
    const log = this.log.inactive("handleStateUpdate");

    // Only respond to state payloads that include mobileOnly flag
    if (data.type !== "state_update" && data.type !== "state_with_progress") {
      return;
    }

    const mobileOnlyFlag = (data as any).mobileOnly as boolean | undefined;
    if (typeof mobileOnlyFlag !== "boolean") {
      return;
    }

    // Determine local device type
    const localPlayer = this.world.getLocalPlayer();
    const deviceType = localPlayer.deviceType.get();
    const isMobile = deviceType === PlayerDeviceType.Mobile;

    // Show MobileOnly overlay only when backend has mobileOnly enabled
    // AND the player is NOT on a mobile device (Web/VR)
    const shouldShow = mobileOnlyFlag && !isMobile;

    this.updateDataContext({ isVisible: shouldShow });
    log.info(
      `MobileOnly visibility updated: ${shouldShow} (mobileOnly=${mobileOnlyFlag}, deviceType=${deviceType})`
    );
  }
  // #endregion

  // #region 🛠️ Helper Methods
  private updateDataContext(updates: Partial<IUiViewModelObject>): void {
    const log = this.log.inactive("updateDataContext");

    Object.assign(this.dataContext, updates);

    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
      log.info(`DataContext updated: ${JSON.stringify(updates)}`);
    }
  }
  // #endregion
}

Component.register(Default);
