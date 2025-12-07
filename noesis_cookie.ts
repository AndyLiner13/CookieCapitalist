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
const CLICKS_TO_8X = 35;  // 4x -> 8x: 15 clicks in 5 seconds  
const CLICKS_TO_16X = 50; // 8x -> 16x: 20 clicks in 5 seconds

// Timeout durations per multiplier tier (ms)
const TIMEOUT_2X = 16000;  // 15 seconds
const TIMEOUT_4X = 12000;  // 12 seconds
const TIMEOUT_8X = 8000;   // 9 seconds
const TIMEOUT_16X = 5500;  // 5.5 seconds
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    popupFontSize: { type: hz.PropTypes.Number, default: 48 },
    popupColor: { type: hz.PropTypes.String, default: "#FFFFFF" },
    glow1Size: { type: hz.PropTypes.Number, default: 280 }, // Ring 1 (2x) - innermost
    glow2Size: { type: hz.PropTypes.Number, default: 360 }, // Ring 2 (4x)
    glow3Size: { type: hz.PropTypes.Number, default: 440 }, // Ring 3 (8x)
    glow4Size: { type: hz.PropTypes.Number, default: 520 }, // Ring 4 (16x) - outermost
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
  private streakStartTime: number = 0; // When the current streak started (multiplier > 1)
  
  // Glow rotation state (4 rings with alternating directions)
  private glow1Rotation: number = 0; // 2x - counter-clockwise
  private glow2Rotation: number = 0; // 4x - clockwise
  private glow3Rotation: number = 0; // 8x - counter-clockwise
  private glow4Scale: number = 1; // 16x - pulsing scale (no rotation)
  private glowSpinTimerId: number | null = null;
  
  // Click rate tracking for multiplier upgrades
  private clickTimestamps: number[] = [];
  private clickRateCheckTimerId: number | null = null;
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
    
    // Listen for fall animation started (from overlay)
    this.connectLocalBroadcastEvent(
      LocalUIEvents.fallAnimationStarted,
      () => this.onFallAnimationStarted()
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
      // 4 glow rings - sizes configurable via props
      Glow1Opacity: 0,
      Glow1Size: this.props.glow1Size,
      Glow1Scale: 0,
      Glow1Rotation: 0,
      Glow2Opacity: 0,
      Glow2Size: this.props.glow2Size,
      Glow2Scale: 0,
      Glow2Rotation: 0,
      Glow3Opacity: 0,
      Glow3Size: this.props.glow3Size,
      Glow3Scale: 0,
      Glow3Rotation: 0,
      Glow4Opacity: 0,
      Glow4Size: this.props.glow4Size,
      Glow4Scale: 0,
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
  
  private onFallAnimationStarted(): void {
    const log = this.log.active("onFallAnimationStarted");
    
    // Calculate and report streak duration if there was an active streak
    if (this.streakStartTime > 0) {
      const streakDuration = Date.now() - this.streakStartTime;
      log.info(`Streak ended! Duration: ${streakDuration}ms (${(streakDuration / 1000).toFixed(1)}s)`);
      
      // Send streak_ended event to backend
      this.sendNetworkBroadcastEvent(GameEvents.toServer, {
        type: "streak_ended",
        durationMs: streakDuration,
      });
      
      this.streakStartTime = 0;
    }
    
    // End the streak - set multiplier to 1 and end time to past
    this.currentMultiplier = 1;
    this.multiplierEndTime = 0;
    this.clickTimestamps = [];
    
    // Stop all multiplier timers immediately
    this.stopClickRateChecker();
    
    // Trigger glow collapse animation
    this.fadeOutGlow();
    
    log.info("Fall animation started - streak ended, multiplier cleared, glow collapsing");
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
      
      // Start streak timer if this is the first upgrade (1x -> 2x)
      if (previousMultiplier === 1) {
        this.streakStartTime = Date.now();
        log.info(`Streak started at ${this.streakStartTime}`);
      }
      
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
    
    // Fade out glow over 1500ms when streak ends
    this.fadeOutGlow();
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
  
  // Updates the golden glow rings opacity based on multiplier
  // Each ring becomes visible at its corresponding multiplier tier
  // Ring 1 (2x), Ring 2 (4x), Ring 3 (8x), Ring 4 (16x)
  private updateGlowOpacity(multiplier: number): void {
    const log = this.log.inactive("updateGlowOpacity");
    
    if (multiplier <= 1) {
      // No multiplier - hide all glows
      this.dataContext.Glow1Opacity = 0;
      this.dataContext.Glow2Opacity = 0;
      this.dataContext.Glow3Opacity = 0;
      this.dataContext.Glow4Opacity = 0;
    } else {
      // Show rings based on current multiplier and trigger pop-in animation for new rings
      // Each ring gets 70% opacity when active
      const wasRing1Active = (this.dataContext.Glow1Opacity as number) > 0;
      const wasRing2Active = (this.dataContext.Glow2Opacity as number) > 0;
      const wasRing3Active = (this.dataContext.Glow3Opacity as number) > 0;
      const wasRing4Active = (this.dataContext.Glow4Opacity as number) > 0;
      
      this.dataContext.Glow1Opacity = multiplier >= 2 ? 0.7 : 0;   // 2x+
      this.dataContext.Glow2Opacity = multiplier >= 4 ? 0.7 : 0;   // 4x+
      this.dataContext.Glow3Opacity = multiplier >= 8 ? 0.7 : 0;   // 8x+
      this.dataContext.Glow4Opacity = multiplier >= 16 ? 0.7 : 0;  // 16x
      
      // Trigger pop-in animations for newly active rings
      if (!wasRing1Active && multiplier >= 2) this.popInGlowRing(1);
      if (!wasRing2Active && multiplier >= 4) this.popInGlowRing(2);
      if (!wasRing3Active && multiplier >= 8) this.popInGlowRing(3);
      if (!wasRing4Active && multiplier >= 16) this.popInGlowRing(4);
    }
    
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
    
    log.info(`Glow rings updated for ${multiplier}x: Ring1=${this.dataContext.Glow1Opacity}, Ring2=${this.dataContext.Glow2Opacity}, Ring3=${this.dataContext.Glow3Opacity}, Ring4=${this.dataContext.Glow4Opacity}`);
  }
  
  // Pop-in animation for a glow ring (scales from 0 to 1 over 300ms)
  private popInGlowRing(ringNumber: number): void {
    const log = this.log.inactive("popInGlowRing");
    const duration = 300; // 300ms pop-in
    const startTime = Date.now();
    
    const scaleKey = `Glow${ringNumber}Scale`;
    
    const popInTimer = this.async.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic for smooth pop-in
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const scale = easeOut;
      
      this.dataContext[scaleKey] = scale;
      
      if (this.noesisGizmo) {
        this.noesisGizmo.dataContext = this.dataContext;
      }
      
      if (progress >= 1) {
        this.async.clearInterval(popInTimer);
        log.info(`Ring ${ringNumber} pop-in complete`);
      }
    }, 16);
    
    log.info(`Starting pop-in animation for Ring ${ringNumber}`);
  }
  
  // Starts the glow rotation animation with alternating directions
  // Ring 1 (2x): counter-clockwise, Ring 2 (4x): clockwise
  // Ring 3 (8x): counter-clockwise, Ring 4 (16x): clockwise
  private startGlowSpin(): void {
    const log = this.log.inactive("startGlowSpin");
    
    // Stop existing timer if any
    if (this.glowSpinTimerId !== null) {
      this.async.clearInterval(this.glowSpinTimerId);
    }
    
    // Reset rotations and scale
    this.glow1Rotation = 0;
    this.glow2Rotation = 0;
    this.glow3Rotation = 0;
    this.glow4Scale = this.dataContext.Glow4Scale as number || 1; // Use current scale from pop-in
    
    let pulsePhase = 0;
    const pulseSpeed = 0.05; // Speed of pulse animation
    
    // Spin rings with alternating directions and pulse Ring 4
    this.glowSpinTimerId = this.async.setInterval(() => {
      // Ring 1 & 3: counter-clockwise (negative)
      this.glow1Rotation = (this.glow1Rotation - this.props.glowSpinSpeed + 360) % 360;
      this.glow3Rotation = (this.glow3Rotation - this.props.glowSpinSpeed + 360) % 360;
      
      // Ring 2: clockwise (positive)
      this.glow2Rotation = (this.glow2Rotation + this.props.glowSpinSpeed) % 360;
      
      // Ring 4: pulse scale by 5% (only if fully scaled in)
      const currentScale4 = this.dataContext.Glow4Scale as number;
      if (currentScale4 >= 0.99) {
        // Ring 4 is fully popped in, apply pulse
        pulsePhase += pulseSpeed;
        const pulseValue = (Math.sin(pulsePhase) + 1) / 2; // 0 to 1
        this.glow4Scale = 1.0 + (pulseValue * 0.05); // Pulse between 1.0 and 1.05
        this.dataContext.Glow4Scale = this.glow4Scale;
      }
      // Otherwise, let the pop-in animation control the scale
      
      this.dataContext.Glow1Rotation = this.glow1Rotation;
      this.dataContext.Glow2Rotation = this.glow2Rotation;
      this.dataContext.Glow3Rotation = this.glow3Rotation;
      
      if (this.noesisGizmo) {
        this.noesisGizmo.dataContext = this.dataContext;
      }
    }, 16); // ~60fps
    
    log.info(`Glow rings spinning at ${this.props.glowSpinSpeed} deg/frame (Ring 4 pulsing 5%)`);
  }
  
  // Stops the glow rotation animation
  private stopGlowSpin(): void {
    if (this.glowSpinTimerId !== null) {
      this.async.clearInterval(this.glowSpinTimerId);
      this.glowSpinTimerId = null;
    }
    
    // Reset rotations and scale
    this.glow1Rotation = 0;
    this.glow2Rotation = 0;
    this.glow3Rotation = 0;
    this.glow4Scale = 0;
    
    this.dataContext.Glow1Rotation = 0;
    this.dataContext.Glow1Scale = 0;
    this.dataContext.Glow2Rotation = 0;
    this.dataContext.Glow2Scale = 0;
    this.dataContext.Glow3Rotation = 0;
    this.dataContext.Glow3Scale = 0;
    this.dataContext.Glow4Scale = 0;
    
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
  }
  
  // Scales down the glow effect to 0 over 1500ms
  private fadeOutGlow(): void {
    const log = this.log.inactive("fadeOutGlow");
    
    const startScale1 = this.dataContext.Glow1Scale as number;
    const startScale2 = this.dataContext.Glow2Scale as number;
    const startScale3 = this.dataContext.Glow3Scale as number;
    const startScale4 = this.dataContext.Glow4Scale as number;
    const fadeDuration = 1500; // 1500ms scale down
    const startTime = Date.now();
    
    const fadeTimerId = this.async.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / fadeDuration, 1);
      
      // Ease in cubic for smooth scale down
      const easeIn = progress * progress * progress;
      
      // Scale from current values to 0
      this.dataContext.Glow1Scale = startScale1 * (1 - easeIn);
      this.dataContext.Glow2Scale = startScale2 * (1 - easeIn);
      this.dataContext.Glow3Scale = startScale3 * (1 - easeIn);
      this.dataContext.Glow4Scale = startScale4 * (1 - easeIn);
      
      if (this.noesisGizmo) {
        this.noesisGizmo.dataContext = this.dataContext;
      }
      
      if (progress >= 1) {
        this.async.clearInterval(fadeTimerId);
        // Reset opacities after scale-down complete
        this.dataContext.Glow1Opacity = 0;
        this.dataContext.Glow2Opacity = 0;
        this.dataContext.Glow3Opacity = 0;
        this.dataContext.Glow4Opacity = 0;
        this.stopGlowSpin();
        log.info("Glow scale-down complete");
      }
    }, 16); // ~60fps
    
    log.info("Started glow scale-down animation (1500ms)");
  }
  // #endregion
}

hz.Component.register(Default);
