// Desktop Editor Setup: Attach to NoesisUI entity with Cookie.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 5, Input Mode = Interactive nonblocking

// #region 📋 README
// Controller for the Cookie Noesis overlay.
// Handles direct button clicks from Noesis UI (no raycast needed).
// Shows +# popup animations on click, broadcasts click to other overlays,
// and forwards click to game manager.
// Visibility controlled by page navigation (visible on "home" page).
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import * as hz from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import { PageType, GameEvents, LocalUIEvents, UIEvents, UIEventPayload } from "./util_gameData";

// #region 🏷️ Type Definitions
const POPUP_COUNT = 10;
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    popupFontSize: { type: hz.PropTypes.Number, default: 48 },
    popupColor: { type: hz.PropTypes.String, default: "#FFFFFF" },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_cookie");
  private noesisGizmo: NoesisGizmo | null = null;
  private dataContext: IUiViewModelObject = {};
  
  // Page visibility (visible on "home" page)
  private isVisible: boolean = true;
  
  // Popup system state
  private nextPopupIndex: number = 0;
  
  // Cached cookies per click (updated from game manager)
  private cookiesPerClick: number = 1;
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

    // Listen for state updates from game manager to get cookiesPerClick
    this.connectNetworkBroadcastEvent(
      UIEvents.toClient,
      (data: UIEventPayload) => {
        if (data.type === "state_update" && data.cookiesPerClick !== undefined) {
          this.cookiesPerClick = data.cookiesPerClick as number;
        }
      }
    );
    
    // Listen for page change events
    this.connectLocalBroadcastEvent(
      LocalUIEvents.changePage,
      (data: { page: PageType }) => this.onPageChange(data.page)
    );

    // Build and set initial data context (includes click handler)
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;

    log.info("Cookie overlay initialized (Render Order: 5)");
  }
  // #endregion

  // #region 🎯 Main Logic
  private onPageChange(page: PageType): void {
    const log = this.log.inactive("onPageChange");
    const wasVisible = this.isVisible;
    this.isVisible = page === "home";
    
    if (wasVisible !== this.isVisible) {
      log.info(`Cookie visibility: ${this.isVisible}`);
      this.updateUI();
    }
  }
  
  private buildDataContext(): void {
    this.dataContext = {
      // Page visibility
      isVisible: this.isVisible,
      // Noesis button command - called directly when cookie button is clicked
      onCookieClick: () => this.onCookieClick(),
      // Popup style configuration
      PopupFontSize: this.props.popupFontSize,
      PopupColor: this.props.popupColor,
    };
    
    // Initialize all popup slots
    for (let i = 0; i < POPUP_COUNT; i++) {
      this.dataContext[`Popup${i}Text`] = "";
      this.dataContext[`Popup${i}Visible`] = false;
      this.dataContext[`Popup${i}Animate`] = false;
      this.dataContext[`Popup${i}Margin`] = "0,0,0,0";
    }
  }

  private onCookieClick(): void {
    const log = this.log.active("onCookieClick");
    log.info("Cookie clicked!");

    // Show +# popup
    this.showPopup(`+${this.cookiesPerClick}`);

    // Broadcast click to other overlays (CookieRain, etc.)
    this.sendLocalBroadcastEvent(LocalUIEvents.cookieClicked, {});

    // Send click to game manager (server)
    this.sendNetworkBroadcastEvent(GameEvents.toServer, {
      type: "cookie_clicked",
    });
  }
  
  private showPopup(text: string): void {
    const log = this.log.inactive("showPopup");
    
    // Use round-robin slot selection
    const popupIndex = this.nextPopupIndex;
    this.nextPopupIndex = (popupIndex + 1) % POPUP_COUNT;
    
    // Generate random position around cookie center (256x256 cookie area)
    const offsetX = Math.floor((Math.random() - 0.5) * 200);
    const offsetY = Math.floor((Math.random() - 0.5) * 200);
    
    // Reset animation state first, then set new values
    this.dataContext[`Popup${popupIndex}Animate`] = false;
    this.dataContext[`Popup${popupIndex}Text`] = text;
    this.dataContext[`Popup${popupIndex}Visible`] = true;
    this.dataContext[`Popup${popupIndex}Margin`] = `${offsetX},${offsetY},0,0`;
    
    // Apply changes and trigger animation
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
      
      // Trigger animation on next frame
      this.async.setTimeout(() => {
        this.dataContext[`Popup${popupIndex}Animate`] = true;
        if (this.noesisGizmo) {
          this.noesisGizmo.dataContext = this.dataContext;
        }
      }, 1);
    }
    
    log.info(`Showing popup ${popupIndex}: ${text}`);
  }
  
  private updateUI(): void {
    if (!this.noesisGizmo) return;
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;
  }
  // #endregion
}

hz.Component.register(Default);
