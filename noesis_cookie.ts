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
const MAX_MULTIPLIER = 16; // Maximum multiplier cap
const CLICK_RATE_WINDOW_MS = 5000; // 5 second window to count clicks

// Click thresholds to upgrade multiplier (clicks needed in 5 second window)
const CLICKS_TO_4X = 20;  // 2x -> 4x: 10 clicks in 5 seconds
const CLICKS_TO_8X = 30;  // 4x -> 8x: 15 clicks in 5 seconds  
const CLICKS_TO_16X = 40; // 8x -> 16x: 20 clicks in 5 seconds

// Timeout durations per multiplier tier (ms)
const TIMEOUT_2X = 15000;  // 15 seconds
const TIMEOUT_4X = 12000;  // 12 seconds
const TIMEOUT_8X = 9000;   // 9 seconds
const TIMEOUT_16X = 6000;  // 6 seconds
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    popupFontSize: { type: hz.PropTypes.Number, default: 48 },
    popupColor: { type: hz.PropTypes.String, default: "#FFFFFF" },
    glowSize: { type: hz.PropTypes.Number, default: 420 },
    glowSpinSpeed: { type: hz.PropTypes.Number, default: 0.5 }, // degrees per frame
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
  
  // Glow rotation state
  private glowRotation: number = 0;
  private glowSpinTimerId: number | null = null;
  
  // Click rate tracking for multiplier upgrades
  private clickTimestamps: number[] = [];
  private clickRateCheckTimerId: number | null = null;
  private clickRateDisplayTimerId: number | null = null;
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
      GlowOpacity: 0,
      GlowScale: 1,
      GlowSize: this.props.glowSize,
      GlowRotation: 0,
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
    
    // Check if multiplier is still active (not during dunk animation)
    const now = Date.now();
    const isMultiplierActive = !this.isDunking && now < this.multiplierEndTime && this.currentMultiplier > 1;
    const activeMultiplier = isMultiplierActive ? this.currentMultiplier : 1;
    const effectiveCookies = this.cookiesPerClick * activeMultiplier;
    
    // Track click for rate calculation if multiplier is active
    if (isMultiplierActive) {
      this.clickTimestamps.push(now);
      // Keep only clicks from the last 5 seconds
      this.clickTimestamps = this.clickTimestamps.filter(t => now - t < CLICK_RATE_WINDOW_MS);
      
      // Store multiplier before upgrade check
      const multiplierBeforeCheck = this.currentMultiplier;
      
      // Check if we've reached the click threshold to upgrade
      // This may clear clickTimestamps and update currentMultiplier
      this.checkMultiplierUpgrade();
      
      // Only broadcast refresh if multiplier didn't change (upgrade broadcasts its own event)
      if (this.currentMultiplier === multiplierBeforeCheck) {
        // Reset multiplier timer on click (use tier-specific timeout)
        const currentTimeout = this.getTimeoutForMultiplier(this.currentMultiplier);
        this.multiplierEndTime = now + currentTimeout;
        
        // Broadcast updated timer to overlay (don't trigger pop-in, just refresh timer)
        this.sendLocalBroadcastEvent(LocalUIEvents.dunkMultiplier, {
          multiplier: this.currentMultiplier,
          durationMs: currentTimeout,
          isRefresh: true,
        });
      }
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
    
    const now = Date.now();
    const isMultiplierActive = now < this.multiplierEndTime && this.currentMultiplier > 1;
    
    // Block dunking while multiplier is active
    if (isMultiplierActive) {
      log.info("Multiplier already active, cannot dunk again");
      return;
    }

    this.isDunking = true;
    
    // No active multiplier - start fresh at 2x
    this.currentMultiplier = DUNK_BASE_MULTIPLIER;
    
    // Reset click tracking - will start AFTER dunk animation completes
    this.clickTimestamps = [];

    this.dataContext.dunkAnimate = false;
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }

    this.async.setTimeout(() => {
      this.dataContext.dunkAnimate = true;
      if (this.noesisGizmo) {
        this.noesisGizmo.dataContext = this.dataContext;
      }

      // After dunk animation completes (1700ms), show multiplier and glow
      this.async.setTimeout(() => {
        this.dataContext.dunkAnimate = false;
        this.isDunking = false;
        if (this.noesisGizmo) {
          this.noesisGizmo.dataContext = this.dataContext;
        }
        
        // NOW set the multiplier end time - timer starts AFTER dunk animation
        const initialTimeout = this.getTimeoutForMultiplier(this.currentMultiplier);
        this.multiplierEndTime = Date.now() + initialTimeout;
        
        // NOW show the multiplier and glow after animation completes
        // Start click rate checker (5-second window starts now)
        this.startClickRateChecker();
        
        // Start click rate display updates (every 500ms)
        this.startClickRateDisplay();
        
        // Broadcast dunk multiplier event to overlay (triggers pop-in animation)
        this.sendLocalBroadcastEvent(LocalUIEvents.dunkMultiplier, {
          multiplier: this.currentMultiplier,
          durationMs: initialTimeout,
          isRefresh: false,
        });
        
        // Update glow opacity for new multiplier
        this.updateGlowOpacity(this.currentMultiplier);
        
        // Start glow spin animation
        this.startGlowSpin();
        
        log.info(`Dunk animation complete - showing ${this.currentMultiplier}x multiplier for ${initialTimeout}ms`);
      }, 1700);
    }, 50);
  }
  
  // Returns the timeout duration for a given multiplier tier
  private getTimeoutForMultiplier(multiplier: number): number {
    switch (multiplier) {
      case 2: return TIMEOUT_2X;
      case 4: return TIMEOUT_4X;
      case 8: return TIMEOUT_8X;
      case 16: return TIMEOUT_16X;
      default: return TIMEOUT_2X;
    }
  }
  
  // Returns the click threshold needed to upgrade from current multiplier
  private getClickThresholdForUpgrade(currentMultiplier: number): number {
    switch (currentMultiplier) {
      case 2: return CLICKS_TO_4X;   // Need 10 clicks to go 2x -> 4x
      case 4: return CLICKS_TO_8X;   // Need 15 clicks to go 4x -> 8x
      case 8: return CLICKS_TO_16X;  // Need 20 clicks to go 8x -> 16x
      default: return Infinity;      // At max, can't upgrade
    }
  }
  
  // Checks if user has clicked enough to upgrade multiplier
  private checkMultiplierUpgrade(): void {
    const log = this.log.active("checkMultiplierUpgrade");
    
    if (this.currentMultiplier >= MAX_MULTIPLIER) {
      return; // Already at max
    }
    
    const clickCount = this.clickTimestamps.length;
    const threshold = this.getClickThresholdForUpgrade(this.currentMultiplier);
    
    log.info(`Click count: ${clickCount}/${threshold} for upgrade from ${this.currentMultiplier}x`);
    
    if (clickCount >= threshold) {
      // Upgrade multiplier!
      const previousMultiplier = this.currentMultiplier;
      this.currentMultiplier *= 2;
      
      // Clear click cache for the new tier
      this.clickTimestamps = [];
      
      // Set new timeout for upgraded tier
      const newTimeout = this.getTimeoutForMultiplier(this.currentMultiplier);
      this.multiplierEndTime = Date.now() + newTimeout;
      
      log.info(`Multiplier upgraded from ${previousMultiplier}x to ${this.currentMultiplier}x! New timeout: ${newTimeout}ms`);
      
      // Broadcast new multiplier with pop-in animation (isRefresh: false)
      this.sendLocalBroadcastEvent(LocalUIEvents.dunkMultiplier, {
        multiplier: this.currentMultiplier,
        durationMs: newTimeout,
        isRefresh: false,
      });
      
      // Update glow opacity for increased multiplier
      this.updateGlowOpacity(this.currentMultiplier);
    }
  }
  
  private startClickRateChecker(): void {
    const log = this.log.active("startClickRateChecker");
    
    // Clear existing timer if any
    if (this.clickRateCheckTimerId !== null) {
      this.async.clearInterval(this.clickRateCheckTimerId);
    }
    
    // Check for multiplier expiration every 100ms
    this.clickRateCheckTimerId = this.async.setInterval(() => {
      const now = Date.now();
      
      // Stop checking if multiplier expired
      if (now >= this.multiplierEndTime || this.currentMultiplier <= 1) {
        this.stopClickRateChecker();
        log.info("Multiplier expired");
        return;
      }
    }, 100);
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
    
    // Notify overlay that click rate is no longer active
    this.sendLocalBroadcastEvent(LocalUIEvents.clickRateUpdate, {
      clicksPerSecond: 0,
      isActive: false,
    });
    
    // Fade out glow over 1500ms when streak ends
    this.fadeOutGlow();
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
      
      // Calculate current click count in window
      this.clickTimestamps = this.clickTimestamps.filter(t => now - t < CLICK_RATE_WINDOW_MS);
      const clickCount = this.clickTimestamps.length;
      const clicksPerSecond = clickCount / (CLICK_RATE_WINDOW_MS / 1000);
      
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
  
  // Updates the golden glow opacity behind the cookie based on multiplier
  // Opacity: 2x=70%, 4x=80%, 8x=90%, 16x=100%
  // Scale: starts at 1.3 (16x base size) and increases 10% per tier down from there
  // So 2x=1.0, 4x=1.1, 8x=1.2, 16x=1.3
  private updateGlowOpacity(multiplier: number): void {
    const log = this.log.inactive("updateGlowOpacity");
    
    if (multiplier <= 1) {
      // No multiplier - hide glow
      this.dataContext.GlowOpacity = 0;
      this.dataContext.GlowScale = 1;
    } else {
      // Fixed opacity values per tier
      let opacity: number;
      switch (multiplier) {
        case 2:  opacity = 0.7; break;  // 70%
        case 4:  opacity = 0.8; break;  // 80%
        case 8:  opacity = 0.9; break;  // 90%
        case 16: opacity = 1.0; break;  // 100%
        default: opacity = 0.7; break;
      }
      
      // Calculate scale: starts at 1.0 for 2x, increases 10% per tier
      // tier 0 (2x) = 1.0, tier 1 (4x) = 1.1, tier 2 (8x) = 1.2, tier 3 (16x) = 1.3
      const tier = Math.log2(multiplier) - 1; // 2x=0, 4x=1, 8x=2, 16x=3
      const scale = 1.0 + (tier * 0.1);
      
      this.dataContext.GlowOpacity = opacity;
      this.dataContext.GlowScale = scale;
    }
    
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
    
    log.info(`Glow: opacity=${(this.dataContext.GlowOpacity as number).toFixed(2)}, scale=${(this.dataContext.GlowScale as number).toFixed(2)} for multiplier ${multiplier}x`);
  }
  
  // Starts the glow rotation animation
  private startGlowSpin(): void {
    const log = this.log.inactive("startGlowSpin");
    
    // Stop existing timer if any
    if (this.glowSpinTimerId !== null) {
      this.async.clearInterval(this.glowSpinTimerId);
    }
    
    // Reset rotation
    this.glowRotation = 0;
    
    // Start spinning counter-clockwise at configured speed (default 0.5 degrees per frame = ~30 deg/sec at 60fps)
    this.glowSpinTimerId = this.async.setInterval(() => {
      this.glowRotation = (this.glowRotation - this.props.glowSpinSpeed + 360) % 360;
      this.dataContext.GlowRotation = this.glowRotation;
      
      if (this.noesisGizmo) {
        this.noesisGizmo.dataContext = this.dataContext;
      }
    }, 16); // ~60fps
    
    log.info(`Glow spin started at ${this.props.glowSpinSpeed} deg/frame`);
  }
  
  // Stops the glow rotation animation
  private stopGlowSpin(): void {
    if (this.glowSpinTimerId !== null) {
      this.async.clearInterval(this.glowSpinTimerId);
      this.glowSpinTimerId = null;
    }
    
    // Reset rotation
    this.glowRotation = 0;
    this.dataContext.GlowRotation = 0;
    
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
  }
  
  // Fades out the glow effect over 1500ms
  private fadeOutGlow(): void {
    const log = this.log.inactive("fadeOutGlow");
    
    const startOpacity = this.dataContext.GlowOpacity as number;
    const startScale = this.dataContext.GlowScale as number;
    const fadeDuration = 1500; // 1500ms fade out
    const startTime = Date.now();
    
    const fadeTimerId = this.async.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / fadeDuration, 1);
      
      // Linear fade from current values to 0
      this.dataContext.GlowOpacity = startOpacity * (1 - progress);
      this.dataContext.GlowScale = startScale - (startScale - 1) * progress;
      
      if (this.noesisGizmo) {
        this.noesisGizmo.dataContext = this.dataContext;
      }
      
      if (progress >= 1) {
        this.async.clearInterval(fadeTimerId);
        this.stopGlowSpin();
        log.info("Glow fade-out complete");
      }
    }, 16); // ~60fps
    
    log.info("Started glow fade-out animation (1500ms)");
  }
  // #endregion
}

hz.Component.register(Default);
