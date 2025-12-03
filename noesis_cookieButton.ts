// Desktop Editor Setup: Attach to NoesisUI entity with CookieButton.xaml. Use Shared execution mode.

// #region 📋 README
// Controller for the standalone cookie button Noesis gizmo.
// Handles cookie click events and sends them to the game manager.
// Enforces focused interaction mode on this spatial gizmo when player clicks.
// This gizmo should be positioned behind Text Gizmos in 3D space.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import { Component, Player } from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import { GameEventPayload, UIEventPayload, GameEvents, UIEvents } from "./util_gameData";

// #region 🏷️ Type Definitions
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_cookieButton");
  private noesisGizmo: NoesisGizmo | null = null;
  private cookiesPerClick: number = 1;
  private dataContext: IUiViewModelObject = {};
  private localPlayer: Player | null = null;
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
    
    // Get local player reference (null on server)
    this.localPlayer = this.world.getLocalPlayer();
    
    // Only run client-side code if we have a local player
    // The focused interaction is now handled by controller_player.ts
    
    // Listen for state updates from game manager to get cookiesPerClick
    this.connectNetworkBroadcastEvent(
      UIEvents.toClient,
      (data: UIEventPayload) => {
        if (data.type === "state_update" && data.cookiesPerClick !== undefined) {
          this.cookiesPerClick = data.cookiesPerClick as number;
        }
      }
    );
    
    // Build and set data context
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;
    
    log.info("Cookie button initialized");
  }
  // #endregion

  // #region 🎯 Main Logic
  private buildDataContext(): void {
    this.dataContext = {
      onCookieClick: () => this.onCookieClick(),
    };
  }
  
  private onCookieClick(): void {
    const log = this.log.active("onCookieClick");
    log.info("Cookie clicked!");
    
    // Show +# popup using Text Gizmo pool
    this.sendNetworkBroadcastEvent(UIEvents.showClickPopup, {
      type: "state_update",
      text: `+${this.cookiesPerClick}`,
    });
    
    // Send click to game manager
    this.sendNetworkBroadcastEvent(GameEvents.toServer, {
      type: "cookie_clicked",
    } as GameEventPayload);
  }
  // #endregion
}

Component.register(Default);
