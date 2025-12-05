// Desktop Editor Setup: Attach to NoesisUI entity with CookieRain.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 1, Input Mode = No Interaction

// #region 📋 README
// Controller for the CookieRain Noesis overlay (back layer).
// Listens for cookie click events and triggers falling cookie animations.
// Visibility controlled by page navigation (only visible on home page).
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import * as hz from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import { PageType, LocalUIEvents } from "./util_gameData";

// #region 🏷️ Type Definitions
const RAIN_COOKIE_COUNT = 10;
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    // Rain cookie animation duration in ms
    rainCookieDurationMs: { type: hz.PropTypes.Number, default: 2000 },
    // Rain cookie scale (1.0 = 100%)
    rainCookieScale: { type: hz.PropTypes.Number, default: 0.5 },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_cookieRain");
  private noesisGizmo: NoesisGizmo | null = null;
  private dataContext: IUiViewModelObject = {};
  
  // Rain cookie state - round-robin index for next rain cookie slot
  private nextRainCookieIndex: number = 0;
  
  // Current page (only trigger rain on home page)
  private currentPage: PageType = "home";
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

    // Listen for local cookie click events
    this.connectLocalBroadcastEvent(
      LocalUIEvents.cookieClicked,
      () => this.triggerRainCookie()
    );

    // Listen for page change events
    this.connectLocalBroadcastEvent(
      LocalUIEvents.changePage,
      (data: { page: PageType }) => this.onPageChange(data.page)
    );

    // Build and set initial data context
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;

    log.info("CookieRain gizmo initialized (visible on home page only)");
  }
  // #endregion

  // #region 🎯 Main Logic
  private onPageChange(page: PageType): void {
    const log = this.log.inactive("onPageChange");
    
    this.currentPage = page;
    
    if (!this.noesisGizmo) return;
    
    // Only visible on home page
    const isVisible = page === "home";
    this.noesisGizmo.setLocalEntityVisibility(isVisible);
    
    log.info(`CookieRain visibility: ${isVisible}`);
  }

  private buildDataContext(): void {
    this.dataContext = {
      rainCookieScale: this.props.rainCookieScale,
    };
    
    // Initialize all rain cookie slots
    for (let i = 0; i < RAIN_COOKIE_COUNT; i++) {
      this.dataContext[`RainCookie${i}Visible`] = false;
      this.dataContext[`RainCookie${i}Animate`] = false;
      this.dataContext[`RainCookie${i}Left`] = 0;
    }
  }

  // Trigger a rain cookie falling from a random horizontal position
  private triggerRainCookie(): void {
    const log = this.log.inactive("triggerRainCookie");

    // Only trigger rain on home page
    if (this.currentPage !== "home") {
      return;
    }

    // Use round-robin slot selection
    const rainIndex = this.nextRainCookieIndex;
    this.nextRainCookieIndex = (rainIndex + 1) % RAIN_COOKIE_COUNT;

    // Random horizontal position (0-100% of viewport width, accounting for cookie size)
    const randomLeft = Math.floor(Math.random() * 350); // 0 to ~350px for 400px wide viewport

    // Reset animation state first, then set new values
    this.dataContext[`RainCookie${rainIndex}Animate`] = false;
    this.dataContext[`RainCookie${rainIndex}Visible`] = true;
    this.dataContext[`RainCookie${rainIndex}Left`] = randomLeft;

    // Apply changes and trigger animation
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;

      // Trigger animation on next frame
      this.async.setTimeout(() => {
        this.dataContext[`RainCookie${rainIndex}Animate`] = true;
        if (this.noesisGizmo) {
          this.noesisGizmo.dataContext = this.dataContext;
        }

        // Hide the cookie after animation completes
        this.async.setTimeout(() => {
          this.dataContext[`RainCookie${rainIndex}Visible`] = false;
          this.dataContext[`RainCookie${rainIndex}Animate`] = false;
          if (this.noesisGizmo) {
            this.noesisGizmo.dataContext = this.dataContext;
          }
        }, this.props.rainCookieDurationMs);
      }, 1);
    }

    log.info(`Triggering rain cookie ${rainIndex} at x=${randomLeft}`);
  }
  // #endregion
}

hz.Component.register(Default);
