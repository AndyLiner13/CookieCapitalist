// Desktop Editor Setup: Attach to NoesisUI entity with CookieButton.xaml. Use Shared execution mode.

// #region 📋 README
// Controller for the standalone cookie button Noesis gizmo.
// Handles cookie click events and sends them to the game manager.
// Manages 10 popup text elements for +# indicators that animate independently.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import { Component, Player, PropTypes } from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import { GameEventPayload, UIEventPayload, GameEvents, UIEvents, LocalUIEvents } from "./util_gameData";

// #region 🏷️ Type Definitions
const POPUP_COUNT = 10;
const POPUP_DURATION_MS = 600; // Match animation duration in XAML
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    popupFontSize: { type: PropTypes.Number, default: 48 },
    popupColor: { type: PropTypes.String, default: "#FFFFFF" },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_cookieButton");
  private noesisGizmo: NoesisGizmo | null = null;
  private cookiesPerClick: number = 1;
  private dataContext: IUiViewModelObject = {};
  private localPlayer: Player | null = null;
  private nextPopupIndex: number = 0;
  private popupInUse: boolean[] = new Array(POPUP_COUNT).fill(false);
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
    
    // Listen for local cookie click events from player controller
    // This is triggered when player clicks in focused interaction mode
    this.connectLocalBroadcastEvent(
      LocalUIEvents.cookieClicked,
      () => this.onCookieClick()
    );
    
    // Listen for visibility changes (when navigating between pages)
    this.connectLocalBroadcastEvent(
      LocalUIEvents.setCookieVisible,
      (data: { visible: boolean }) => this.setCookieVisible(data.visible)
    );
    
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
    
    log.info("Cookie button initialized with popup system");
  }
  // #endregion

  // #region 🎯 Main Logic
  // Set cookie visibility
  private setCookieVisible(visible: boolean): void {
    const log = this.log.active("setCookieVisible");
    log.info(`Setting cookie visible: ${visible}`);
    this.entity.visible.set(visible);
  }
  
  private buildDataContext(): void {
    const log = this.log.inactive("buildDataContext");
    
    this.dataContext = {
      onCookieClick: () => this.onCookieClick(),
      isClicking: false,
      // Popup style configuration (shared by all popups)
      PopupFontSize: this.props.popupFontSize,
      PopupColor: this.props.popupColor,
    };
    
    // Initialize all popup bindings
    for (let i = 0; i < POPUP_COUNT; i++) {
      this.dataContext[`Popup${i}Text`] = "";
      this.dataContext[`Popup${i}Visible`] = "Collapsed";
      this.dataContext[`Popup${i}Animate`] = false;
      this.dataContext[`Popup${i}Margin`] = "0,0,0,0";
    }
  }
  
  private onCookieClick(): void {
    const log = this.log.active("onCookieClick");
    log.info("Cookie clicked!");
    
    // Trigger click animation by toggling isClicking
    if (this.noesisGizmo) {
      this.dataContext.isClicking = true;
      this.noesisGizmo.dataContext = this.dataContext;
      
      // Reset after animation duration
      this.async.setTimeout(() => {
        this.dataContext.isClicking = false;
        if (this.noesisGizmo) {
          this.noesisGizmo.dataContext = this.dataContext;
        }
      }, 150);
    }
    
    // Show +# popup using internal popup system
    this.showPopup(`+${this.cookiesPerClick}`);
    
    // Send click to game manager
    this.sendNetworkBroadcastEvent(GameEvents.toServer, {
      type: "cookie_clicked",
    } as GameEventPayload);
  }
  
  private showPopup(text: string): void {
    const log = this.log.active("showPopup");
    
    // Find an available popup slot
    let popupIndex = -1;
    for (let i = 0; i < POPUP_COUNT; i++) {
      const checkIndex = (this.nextPopupIndex + i) % POPUP_COUNT;
      if (!this.popupInUse[checkIndex]) {
        popupIndex = checkIndex;
        break;
      }
    }
    
    if (popupIndex === -1) {
      log.info("All popups in use, skipping");
      return;
    }
    
    // Mark as in use
    this.popupInUse[popupIndex] = true;
    this.nextPopupIndex = (popupIndex + 1) % POPUP_COUNT;
    
    // Generate random position anywhere on the cookie (256x256 cookie area)
    // Offset from center: -128 to 128 pixels in both directions
    const offsetX = Math.floor((Math.random() - 0.5) * 256);
    const offsetY = Math.floor((Math.random() - 0.5) * 256);
    
    // Update data context for this popup
    this.dataContext[`Popup${popupIndex}Text`] = text;
    this.dataContext[`Popup${popupIndex}Visible`] = "Visible";
    this.dataContext[`Popup${popupIndex}Margin`] = `${offsetX},${offsetY},0,0`;
    this.dataContext[`Popup${popupIndex}Animate`] = false;
    
    // Apply changes
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
    
    // Trigger animation on next frame (need to toggle from false to true)
    this.async.setTimeout(() => {
      this.dataContext[`Popup${popupIndex}Animate`] = true;
      if (this.noesisGizmo) {
        this.noesisGizmo.dataContext = this.dataContext;
      }
    }, 16);
    
    log.info(`Showing popup ${popupIndex}: ${text}`);
    
    // Hide popup after animation completes
    this.async.setTimeout(() => {
      this.hidePopup(popupIndex);
    }, POPUP_DURATION_MS);
  }
  
  private hidePopup(index: number): void {
    const log = this.log.inactive("hidePopup");
    
    // Reset popup state
    this.dataContext[`Popup${index}Text`] = "";
    this.dataContext[`Popup${index}Visible`] = "Collapsed";
    this.dataContext[`Popup${index}Animate`] = false;
    this.popupInUse[index] = false;
    
    // Apply changes
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
    
    log.info(`Hidden popup ${index}`);
  }
  // #endregion
}

Component.register(Default);
