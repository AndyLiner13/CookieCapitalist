// Desktop Editor Setup: Attach to NoesisUI entity with Background.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 0, Input Mode = No Interaction

// #region 📋 README
// Background overlay with blue gradient and falling cookie rain.
// Listens for cookie click events and triggers falling cookie animations.
// Rain only visible on home page.
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
    rainCookieDurationMs: { type: hz.PropTypes.Number, default: 2000 },
    rainCookieScale: { type: hz.PropTypes.Number, default: 0.5 },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_background");
  private noesisGizmo: NoesisGizmo | null = null;
  private dataContext: IUiViewModelObject = {};
  
  // Rain cookie state
  private nextRainCookieIndex: number = 0;
  private currentPage: PageType = "home";
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");

    this.noesisGizmo = this.entity.as(NoesisGizmo);
    if (!this.noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }

    // Listen for cookie click events
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

    log.info("Background overlay initialized (Render Order: 0)");
  }
  // #endregion

  // #region 🎯 Main Logic
  private onPageChange(page: PageType): void {
    this.currentPage = page;
    this.dataContext.rainVisible = page === "home";
    
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
  }

  private buildDataContext(): void {
    this.dataContext = {
      rainVisible: this.currentPage === "home",
      rainCookieScale: this.props.rainCookieScale,
    };
    
    // Initialize rain cookie slots
    for (let i = 0; i < RAIN_COOKIE_COUNT; i++) {
      this.dataContext[`RainCookie${i}Visible`] = false;
      this.dataContext[`RainCookie${i}Animate`] = false;
      this.dataContext[`RainCookie${i}Left`] = 0;
    }
  }

  private triggerRainCookie(): void {
    const log = this.log.inactive("triggerRainCookie");

    if (this.currentPage !== "home") {
      return;
    }

    const rainIndex = this.nextRainCookieIndex;
    this.nextRainCookieIndex = (rainIndex + 1) % RAIN_COOKIE_COUNT;

    const randomLeft = Math.floor(Math.random() * 350);

    this.dataContext[`RainCookie${rainIndex}Animate`] = false;
    this.dataContext[`RainCookie${rainIndex}Visible`] = true;
    this.dataContext[`RainCookie${rainIndex}Left`] = randomLeft;

    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;

      this.async.setTimeout(() => {
        this.dataContext[`RainCookie${rainIndex}Animate`] = true;
        if (this.noesisGizmo) {
          this.noesisGizmo.dataContext = this.dataContext;
        }

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
