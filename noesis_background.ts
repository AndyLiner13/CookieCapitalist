// Desktop Editor Setup: Attach to NoesisUI entity with Background.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 0, Input Mode = No Interaction

// #region 📋 README
// Background overlay with blue gradient and falling cookie rain.
// Listens for cookie click events (1 cookie) and batch completion events (queued cookies).
// Rain is proportional: tapping triggers 1 cookie, batch completion triggers proportional rain.
// Uses a queue system - if batch cookies exceed available rain slots, excess is queued.
// Rain only visible on home page.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import * as hz from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import { PageType, LocalUIEvents } from "./util_gameData";

// #region 🏷️ Type Definitions
const RAIN_COOKIE_COUNT = 250;
const RAIN_STAGGER_INTERVAL_MS = 15; // Stagger between each cookie rain start (smaller = denser rain)
const RAIN_COOKIE_DURATION_MS = 3000; // Must match XAML DoubleAnimation Duration (0:0:3)
const COOKIE_DISPLAY_WIDTH = 111; // 128 * 0.87 scale factor

// Column-based distribution for guaranteed full coverage
// Divide screen into columns, each cookie picks a column then adds random jitter
const RAIN_COLUMNS = 12; // Number of columns to divide screen into (more = better horizontal coverage)
const RAIN_VIEWPORT_WIDTH = 900; // Estimated max viewport width (generous)
const RAIN_COLUMN_WIDTH = RAIN_VIEWPORT_WIDTH / RAIN_COLUMNS;
const RAIN_MIN_LEFT = -COOKIE_DISPLAY_WIDTH * 0.5; // Allow cookies to start partially off-screen
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    enableRain: { type: hz.PropTypes.Boolean, default: true },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_background");
  private noesisGizmo: NoesisGizmo | null = null;
  private dataContext: IUiViewModelObject = {};
  
  // Rain cookie state
  private nextRainCookieIndex: number = 0;
  private currentPage: PageType = "home";
  
  // Queue system for cookie rain
  private rainQueue: number = 0; // Number of cookies waiting to rain
  private isProcessingQueue: boolean = false;
  private rainCookieInUse: boolean[] = []; // Track which rain cookies are currently animating
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");

    this.noesisGizmo = this.entity.as(NoesisGizmo);
    if (!this.noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }
    
    // Initialize rain cookie tracking
    for (let i = 0; i < RAIN_COOKIE_COUNT; i++) {
      this.rainCookieInUse[i] = false;
    }

    // Listen for cookie click events (triggers 1 rain cookie)
    this.connectLocalBroadcastEvent(
      LocalUIEvents.cookieClicked,
      () => this.queueRainCookies(1)
    );
    
    // Listen for batch completion events (triggers proportional rain cookies)
    this.connectLocalBroadcastEvent(
      LocalUIEvents.batchComplete,
      (data: { cookies: number }) => this.queueRainCookies(data.cookies)
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
    const log = this.log.inactive("onPageChange");
    this.currentPage = page;
    this.dataContext.rainVisible = page === "home";
    
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
  }

  private buildDataContext(): void {
    const log = this.log.inactive("buildDataContext");
    this.dataContext = {
      rainVisible: this.currentPage === "home",
    };
    
    // Initialize rain cookie slots
    for (let i = 0; i < RAIN_COOKIE_COUNT; i++) {
      this.dataContext[`RainCookie${i}Visible`] = false;
      this.dataContext[`RainCookie${i}Animate`] = false;
      this.dataContext[`RainCookie${i}Left`] = 0;
      this.dataContext[`RainCookie${i}Opacity`] = 0;
    }
  }

  private queueRainCookies(count: number): void {
    const log = this.log.inactive("queueRainCookies");

    if (!this.props.enableRain || this.currentPage !== "home") {
      return;
    }
    
    // Add to queue
    this.rainQueue += count;
    log.info(`Queued ${count} cookies for rain. Total queue: ${this.rainQueue}`);
    
    // Start processing if not already
    if (!this.isProcessingQueue) {
      this.processRainQueue();
    }
  }
  
  private processRainQueue(): void {
    const log = this.log.inactive("processRainQueue");
    
    if (this.rainQueue <= 0) {
      this.isProcessingQueue = false;
      return;
    }
    
    this.isProcessingQueue = true;
    
    // Find an available rain cookie slot
    const availableIndex = this.findAvailableRainCookie();
    
    if (availableIndex === -1) {
      // All slots busy, wait and retry
      this.async.setTimeout(() => this.processRainQueue(), RAIN_STAGGER_INTERVAL_MS);
      return;
    }
    
    // Trigger this cookie
    this.triggerRainCookie(availableIndex);
    this.rainQueue--;
    
    // Continue processing queue with stagger delay
    if (this.rainQueue > 0) {
      this.async.setTimeout(() => this.processRainQueue(), RAIN_STAGGER_INTERVAL_MS);
    } else {
      this.isProcessingQueue = false;
    }
  }
  
  private findAvailableRainCookie(): number {
    const log = this.log.inactive("findAvailableRainCookie");
    
    // Round-robin starting from nextRainCookieIndex
    for (let i = 0; i < RAIN_COOKIE_COUNT; i++) {
      const index = (this.nextRainCookieIndex + i) % RAIN_COOKIE_COUNT;
      if (!this.rainCookieInUse[index]) {
        this.nextRainCookieIndex = (index + 1) % RAIN_COOKIE_COUNT;
        return index;
      }
    }
    return -1; // All slots in use
  }

  private triggerRainCookie(rainIndex: number): void {
    const log = this.log.inactive("triggerRainCookie");

    // Column-based positioning with jitter for guaranteed full coverage
    // Each cookie is assigned to a column based on its index, with random offset within column
    const column = rainIndex % RAIN_COLUMNS;
    const columnStart = RAIN_MIN_LEFT + (column * RAIN_COLUMN_WIDTH);
    const jitter = Math.random() * RAIN_COLUMN_WIDTH; // Random position within column
    const randomLeft = Math.floor(columnStart + jitter);
    
    // Mark as in use
    this.rainCookieInUse[rainIndex] = true;

    // Set opacity to 0 and position BEFORE making visible (prevents jitter)
    this.dataContext[`RainCookie${rainIndex}Animate`] = false;
    this.dataContext[`RainCookie${rainIndex}Opacity`] = 0;
    this.dataContext[`RainCookie${rainIndex}Left`] = randomLeft;
    
    if (this.noesisGizmo) {
      // First update: set new position while opacity is 0
      this.noesisGizmo.dataContext = this.dataContext;
      
      // Small delay to let position update, then show and animate
      this.async.setTimeout(() => {
        this.dataContext[`RainCookie${rainIndex}Visible`] = true;
        this.dataContext[`RainCookie${rainIndex}Opacity`] = 1;
        if (this.noesisGizmo) {
          this.noesisGizmo.dataContext = this.dataContext;
        }
        
        // Another small delay to ensure visible is processed before animate
        this.async.setTimeout(() => {
          this.dataContext[`RainCookie${rainIndex}Animate`] = true;
          if (this.noesisGizmo) {
            this.noesisGizmo.dataContext = this.dataContext;
          }

          // When animation completes, immediately check for queued cookies
          this.async.setTimeout(() => {
            // Set opacity to 0 immediately (hides cookie at bottom before repositioning)
            this.dataContext[`RainCookie${rainIndex}Opacity`] = 0;
            if (this.noesisGizmo) {
              this.noesisGizmo.dataContext = this.dataContext;
            }
            
            // Mark cookie available
            this.rainCookieInUse[rainIndex] = false;
            
            // If there are queued cookies, immediately re-trigger this same cookie
            if (this.rainQueue > 0) {
              this.rainQueue--;
              this.triggerRainCookie(rainIndex);
            } else {
              // No more queued - hide and reset
              this.dataContext[`RainCookie${rainIndex}Animate`] = false;
              this.dataContext[`RainCookie${rainIndex}Visible`] = false;
              if (this.noesisGizmo) {
                this.noesisGizmo.dataContext = this.dataContext;
              }
            }
          }, RAIN_COOKIE_DURATION_MS);
        }, 1);
      }, 1);
    }

    log.info(`Triggering rain cookie ${rainIndex} at x=${randomLeft}`);
  }
  // #endregion
}

hz.Component.register(Default);
