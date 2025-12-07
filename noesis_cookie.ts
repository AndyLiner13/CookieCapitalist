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
const DUNK_BASE_MULTIPLIER = 2;
const DUNK_DURATION_MS = 15000; // 15 seconds for all multipliers
const MAX_MULTIPLIER = 16; // Maximum multiplier cap
const CLICKS_PER_SECOND_THRESHOLD = 2; // Required click rate to double multiplier
const CLICK_RATE_WINDOW_MS = 5000; // 5 second window to maintain click rate
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
  
  // Multiplier state
  private currentMultiplier: number = 1;
  private multiplierEndTime: number = 0;
  
  // Click rate tracking for multiplier upgrades
  private clickTimestamps: number[] = [];
  private clickRateCheckTimerId: number | null = null;
  private clickRateDisplayTimerId: number | null = null;
  private consecutiveGoodIntervals: number = 0;
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.inactive("start");

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
    log.info(`cookiesPerClick updated from backend: ${this.cookiesPerClick}`);
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
    
    // Check if multiplier is still active
    const now = Date.now();
    const isMultiplierActive = now < this.multiplierEndTime && this.currentMultiplier > 1;
    const activeMultiplier = isMultiplierActive ? this.currentMultiplier : 1;
    const effectiveCookies = this.cookiesPerClick * activeMultiplier;
    
    // Track click for rate calculation if multiplier is active
    if (isMultiplierActive) {
      this.clickTimestamps.push(now);
      // Keep only clicks from the last 5 seconds
      this.clickTimestamps = this.clickTimestamps.filter(t => now - t < CLICK_RATE_WINDOW_MS);
      
      // Reset multiplier timer on click
      this.multiplierEndTime = now + DUNK_DURATION_MS;
      // Broadcast updated timer to overlay (don't trigger pop-in, just refresh timer)
      this.sendLocalBroadcastEvent(LocalUIEvents.dunkMultiplier, {
        multiplier: this.currentMultiplier,
        durationMs: DUNK_DURATION_MS,
        isRefresh: true,
      });
    }

    // Show +# popup (with multiplier if active)
    this.showPopup(`+${effectiveCookies}`);

    // Send to server via NETWORK event with multiplier
    this.sendNetworkBroadcastEvent(GameEvents.toServer, {
      type: "cookie_clicked",
      multiplier: activeMultiplier,
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
    
    const now = Date.now();
    const isMultiplierActive = now < this.multiplierEndTime && this.currentMultiplier > 1;
    
    // If multiplier is already active, just refresh the timer (don't reset to 2x)
    if (isMultiplierActive) {
      this.multiplierEndTime = now + DUNK_DURATION_MS;
      log.info(`Dunk refreshed timer for ${this.currentMultiplier}x multiplier`);
      
      // Broadcast refresh to overlay
      this.sendLocalBroadcastEvent(LocalUIEvents.dunkMultiplier, {
        multiplier: this.currentMultiplier,
        durationMs: DUNK_DURATION_MS,
        isRefresh: true,
      });
    } else {
      // No active multiplier - start fresh at 2x
      this.currentMultiplier = DUNK_BASE_MULTIPLIER;
      this.multiplierEndTime = now + DUNK_DURATION_MS;
      
      // Reset click tracking
      this.clickTimestamps = [];
      this.consecutiveGoodIntervals = 0;
      
      // Start click rate checker
      this.startClickRateChecker();
      
      // Start click rate display updates (every 500ms)
      this.startClickRateDisplay();
      
      // Broadcast dunk multiplier event to overlay
      this.sendLocalBroadcastEvent(LocalUIEvents.dunkMultiplier, {
        multiplier: this.currentMultiplier,
        durationMs: DUNK_DURATION_MS,
        isRefresh: false,
      });
      log.info(`Dunk started multiplier at ${this.currentMultiplier}x for ${DUNK_DURATION_MS}ms`);
    }

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
  
  private startClickRateChecker(): void {
    const log = this.log.active("startClickRateChecker");
    
    // Clear existing timer if any
    if (this.clickRateCheckTimerId !== null) {
      this.async.clearInterval(this.clickRateCheckTimerId);
    }
    
    // Check click rate every second
    this.clickRateCheckTimerId = this.async.setInterval(() => {
      const now = Date.now();
      
      // Stop checking if multiplier expired
      if (now >= this.multiplierEndTime || this.currentMultiplier <= 1) {
        this.stopClickRateChecker();
        return;
      }
      
      // Calculate clicks per second over the last 5 seconds
      this.clickTimestamps = this.clickTimestamps.filter(t => now - t < CLICK_RATE_WINDOW_MS);
      const clicksPerSecond = this.clickTimestamps.length / (CLICK_RATE_WINDOW_MS / 1000);
      
      log.info(`Click rate: ${clicksPerSecond.toFixed(2)} CPS (need ${CLICKS_PER_SECOND_THRESHOLD}), consecutive good: ${this.consecutiveGoodIntervals}`);
      
      if (clicksPerSecond >= CLICKS_PER_SECOND_THRESHOLD) {
        this.consecutiveGoodIntervals++;
        
        // After 5 consecutive good intervals (5 seconds), double the multiplier
        if (this.consecutiveGoodIntervals >= 5 && this.currentMultiplier < MAX_MULTIPLIER) {
          this.currentMultiplier *= 2;
          this.consecutiveGoodIntervals = 0;
          
          log.info(`Multiplier doubled to ${this.currentMultiplier}x!`);
          
          // Broadcast new multiplier with pop-in animation
          this.sendLocalBroadcastEvent(LocalUIEvents.dunkMultiplier, {
            multiplier: this.currentMultiplier,
            durationMs: this.multiplierEndTime - now,
            isRefresh: false,
          });
        }
      } else {
        // Reset consecutive counter if click rate drops
        this.consecutiveGoodIntervals = 0;
      }
    }, 1000);
  }
  
  private stopClickRateChecker(): void {
    if (this.clickRateCheckTimerId !== null) {
      this.async.clearInterval(this.clickRateCheckTimerId);
      this.clickRateCheckTimerId = null;
    }
    if (this.clickRateDisplayTimerId !== null) {
      this.async.clearInterval(this.clickRateDisplayTimerId);
      this.clickRateDisplayTimerId = null;
    }
    this.consecutiveGoodIntervals = 0;
    
    // Notify overlay that click rate is no longer active
    this.sendLocalBroadcastEvent(LocalUIEvents.clickRateUpdate, {
      clicksPerSecond: 0,
      isActive: false,
    });
  }
  
  private startClickRateDisplay(): void {
    // Clear existing timer if any
    if (this.clickRateDisplayTimerId !== null) {
      this.async.clearInterval(this.clickRateDisplayTimerId);
    }
    
    // Update click rate display every 500ms
    this.clickRateDisplayTimerId = this.async.setInterval(() => {
      const now = Date.now();
      
      // Stop if multiplier expired
      if (now >= this.multiplierEndTime || this.currentMultiplier <= 1) {
        this.sendLocalBroadcastEvent(LocalUIEvents.clickRateUpdate, {
          clicksPerSecond: 0,
          isActive: false,
        });
        return;
      }
      
      // Calculate current click rate
      this.clickTimestamps = this.clickTimestamps.filter(t => now - t < CLICK_RATE_WINDOW_MS);
      const clicksPerSecond = this.clickTimestamps.length / (CLICK_RATE_WINDOW_MS / 1000);
      
      // Broadcast to overlay
      this.sendLocalBroadcastEvent(LocalUIEvents.clickRateUpdate, {
        clicksPerSecond: clicksPerSecond,
        isActive: true,
      });
    }, 500);
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
