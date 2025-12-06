// Desktop Editor Setup: Attach to NoesisUI entity with Cookie.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Spatial, Render Order = 5, Input Mode = No Interaction

// #region 📋 README
// Cookie UI controller - handles cookie clicks, popups, and dunk animation.
// Listens for state updates (cookiesPerClick) and swipe-down gestures.
// Visibility is controlled via LocalUIEvents.changePage (home page only).
// #endregion

import * as hz from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import {
  PageType,
  GameEvents,
  UIEvents,
  UIEventPayload,
  LocalUIEvents,
} from "./util_gameData";

// #region 🏷️ Type Definitions
const POPUP_COUNT = 40;
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

  private cookiesPerClick: number = 1;
  private nextPopupIndex: number = 0;
  private isDunking: boolean = false;
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");

    this.noesisGizmo = this.entity.as(NoesisGizmo);
    if (!this.noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }

    // Initialize data context
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;

    // Listen for page change events (home page only)
    this.connectLocalBroadcastEvent(
      LocalUIEvents.changePage,
      (data: { page: PageType }) => this.onPageChange(data.page)
    );

    // Listen for state updates via NETWORK event (from Backend)
    this.connectNetworkBroadcastEvent(
      UIEvents.toClient,
      (data: UIEventPayload) => this.handleStateChanged(data)
    );

    // Listen for swipe down gesture (from controller_player on mobile)
    this.connectLocalBroadcastEvent(
      LocalUIEvents.swipeDown,
      () => this.onSwipeDown()
    );

    // Listen for cookie press events (finger down on cookie)
    this.connectLocalBroadcastEvent(
      LocalUIEvents.cookiePressed,
      () => this.onCookiePressedEvent()
    );

    // Listen for cookie click events (finger released on cookie)
    this.connectLocalBroadcastEvent(
      LocalUIEvents.cookieClicked,
      () => this.onCookieClickedEvent()
    );

    log.info("Cookie UI initialized");
  }
  // #endregion

  // #region 🎯 Main Logic
  private buildDataContext(): void {
    const log = this.log.inactive("buildDataContext");

    // Note: onCookieClick is NOT exposed here - clicks are only detected via
    // raycast gizmo + cookie collider in controller_player.ts
    this.dataContext = {
      clickDown: false,
      clickUp: false,
      dunkAnimate: false,
      PopupFontSize: this.props.popupFontSize,
      PopupColor: this.props.popupColor,
    };

    for (let i = 0; i < POPUP_COUNT; i++) {
      this.dataContext[`Popup${i}Text`] = "";
      this.dataContext[`Popup${i}Visible`] = false;
      this.dataContext[`Popup${i}Animate`] = false;
      this.dataContext[`Popup${i}Margin`] = "0,0,0,0";
    }

    log.info("Cookie dataContext initialized");
  }

  private handleStateChanged(data: UIEventPayload): void {
    const log = this.log.inactive("handleStateChanged");

    if (data.type !== "state_update") return;

    this.cookiesPerClick = (data.cookiesPerClick as number) || 1;
    log.info(`cookiesPerClick updated: ${this.cookiesPerClick}`);
  }

  private onPageChange(page: PageType): void {
    const log = this.log.inactive("onPageChange");

    if (!this.noesisGizmo) return;

    const isVisible = page === "home";
    this.noesisGizmo.setLocalEntityVisibility(isVisible);

    log.info(`Cookie visibility: ${isVisible}`);
  }
  // #endregion

  // #region 🎬 Handlers
  private onCookiePressedEvent(): void {
    const log = this.log.inactive("onCookiePressedEvent");
    log.info("Cookie pressed down");

    // Trigger press down animation
    this.triggerClickDown();
  }

  private onCookieClickedEvent(): void {
    const log = this.log.inactive("onCookieClickedEvent");
    log.info("Cookie released");

    // Trigger release animation
    this.triggerClickUp();

    // Show +# popup
    this.showPopup(`+${this.cookiesPerClick}`);

    // Send to server via NETWORK event
    this.sendNetworkBroadcastEvent(GameEvents.toServer, {
      type: "cookie_clicked",
    });
  }

  private triggerClickDown(): void {
    // Reset and trigger the click down animation
    this.dataContext.clickDown = false;
    this.dataContext.clickUp = false;
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }

    this.async.setTimeout(() => {
      this.dataContext.clickDown = true;
      if (this.noesisGizmo) {
        this.noesisGizmo.dataContext = this.dataContext;
      }
    }, 1);
  }

  private triggerClickUp(): void {
    // Reset and trigger the click up animation
    this.dataContext.clickDown = false;
    this.dataContext.clickUp = false;
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }

    this.async.setTimeout(() => {
      this.dataContext.clickUp = true;
      if (this.noesisGizmo) {
        this.noesisGizmo.dataContext = this.dataContext;
      }
    }, 1);
  }

  private onSwipeDown(): void {
    const log = this.log.active("onSwipeDown");

    // Only trigger dunk when this gizmo is visible
    if (!this.entity.visible.get()) {
      log.info("Cookie UI not visible, ignoring swipe");
      return;
    }

    log.info("Swipe down received - triggering dunk!");
    this.triggerDunkAnimation();
  }

  private triggerDunkAnimation(): void {
    const log = this.log.active("triggerDunkAnimation");

    if (this.isDunking) {
      log.info("Already dunking, ignoring");
      return;
    }

    this.isDunking = true;

    this.dataContext.dunkAnimate = false;
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }

    this.async.setTimeout(() => {
      this.dataContext.dunkAnimate = true;
      if (this.noesisGizmo) {
        this.noesisGizmo.dataContext = this.dataContext;
      }

      this.async.setTimeout(() => {
        this.dataContext.dunkAnimate = false;
        this.isDunking = false;
        if (this.noesisGizmo) {
          this.noesisGizmo.dataContext = this.dataContext;
        }
      }, 1700);
    }, 50);
  }

  private showPopup(text: string): void {
    const log = this.log.inactive("showPopup");

    const popupIndex = this.nextPopupIndex;
    this.nextPopupIndex = (popupIndex + 1) % POPUP_COUNT;

    const angle = Math.random() * 2 * Math.PI;
    const radius = Math.sqrt(Math.random()) * 128;
    const offsetX = Math.floor(Math.cos(angle) * radius * 2);
    const offsetY = Math.floor(Math.sin(angle) * radius * 2);

    this.dataContext[`Popup${popupIndex}Animate`] = false;
    this.dataContext[`Popup${popupIndex}Text`] = text;
    this.dataContext[`Popup${popupIndex}Visible`] = true;
    this.dataContext[`Popup${popupIndex}Margin`] = `${offsetX},${offsetY},0,0`;

    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;

      this.async.setTimeout(() => {
        this.dataContext[`Popup${popupIndex}Animate`] = true;
        if (this.noesisGizmo) {
          this.noesisGizmo.dataContext = this.dataContext;
        }
      }, 1);
    }

    log.info(`Showing popup ${popupIndex}: ${text}`);
  }
  // #endregion
}

hz.Component.register(Default);
