// Desktop Editor Setup: Attach to NoesisUI entity with Overlay.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 10, Input Mode = Interactive nonblocking

// #region 📋 README
// Overlay controller - combines Header and Navigation.
// Displays cookie count/CPS at top, navigation tabs at bottom.
// Broadcasts page change events to CoreGame and other overlays.
// Receives state updates via NETWORK events from Backend.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import { Component, PropTypes, Entity, Vec3, Quaternion } from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import LocalCamera from "horizon/camera";
import { Logger } from "./util_logger";
import {
  PageType,
  UIEvents,
  UIEventPayload,
  GameEvents,
  LocalUIEvents,
  formatCookieDisplay,
  formatCPSDisplay,
} from "./util_gameData";

// #region 🏷️ Type Definitions
// Hidden position for leaderboard (world origin, out of view)
const LEADERBOARD_HIDDEN_POS = new Vec3(0, -100, 0);
// Distance in front of camera when visible
const LEADERBOARD_DISTANCE_FROM_CAMERA = 1.23; // 2 meters in front of camera
// Subtle shake effect - just a few pixels of movement
// Range = pixels of shake, frequency = new target chance per frame, speed = lerp speed
const SHAKE_2X = { range: 2, frequency: 0.4, speed: 0.25 };    // 2x: subtle shake
const SHAKE_4X = { range: 3, frequency: 0.4, speed: 0.28 };    // 4x: slightly more
const SHAKE_8X = { range: 4, frequency: 0.45, speed: 0.32 };   // 8x: moderate shake
const SHAKE_16X = { range: 5, frequency: 0.5, speed: 0.38 };   // 16x: noticeable shake
const FLASH_THRESHOLD_MS = 5000; // Start pulsing at 5 seconds remaining
const PULSE_MIN_OPACITY = 0.5; // Never go below 50% opacity
const PULSE_SPEED = 0.12; // Faster pulse speed (1 second cycle = 0.12 per frame @ 60fps)
// Blink animation: number of smooth oscillations between 100% and 50%
// 2.5 cosine cycles over 5000ms gives 3 smooth dips to 50%,
// with the last minimum landing exactly at 5000ms.
const BLINK_CYCLES = 2.5;
// Pop-in/balloon animation settings
const POP_IN_DURATION_MS = 870; // 1500ms for pop-in animation (fixed duration)
const POP_IN_OVERSHOOT = 1.23; // How much to overshoot before settling (smaller bounce)
// Scale multiplier per tier (1.23x bigger each level)
const SCALE_PER_TIER = 1.23;
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    leaderboardGizmo: { type: PropTypes.Entity },
    milkBackgroundGizmo: { type: PropTypes.Entity },
    milkForegroundGizmo: { type: PropTypes.Entity },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_overlay");
  private noesisGizmo: NoesisGizmo | null = null;
  private dataContext: IUiViewModelObject = {};
  private leaderboardGizmo: Entity | null = null;
  private milkBackgroundGizmo: Entity | null = null;
  private milkForegroundGizmo: Entity | null = null;
  
  // Current page
  private currentPage: PageType = "home";
  
  // Cached game state for header
  private cookies: number = 0;
  private cookiesPerSecond: number = 0;
  
  // Multiplier state
  private currentMultiplier: number = 1;
  private multiplierEndTime: number = 0;
  private multiplierTimerId: number | null = null;
  private shakeTimerId: number | null = null;
  private popInTimerId: number | null = null;
  private fadeOutTimerId: number | null = null;
  
  // Smooth animation state
  private targetShakeX: number = 0;
  private targetShakeY: number = 0;
  private currentShakeX: number = 0;
  private currentShakeY: number = 0;
  private pulsePhase: number = 0;
  private currentScale: number = 1;
  private baseScale: number = 1; // Base scale increases 1.23x per tier
  private isFalling: boolean = false;
  private fallStartShakeY: number = 0;
  private fallStartScale: number = 1;
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.inactive("start");

    this.noesisGizmo = this.entity.as(NoesisGizmo);
    if (!this.noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }

    // Cache leaderboard gizmo (optional) and hide it on start
    this.leaderboardGizmo = this.props.leaderboardGizmo || null;
    log.info(`Leaderboard prop value: ${this.leaderboardGizmo ? "SET" : "NULL"}`);
    if (this.leaderboardGizmo) {
      const gizmoName = this.leaderboardGizmo.name.get();
      log.info(`Leaderboard gizmo found: ${gizmoName} - will position dynamically based on camera`);
      
      // Move leaderboard to hidden position on start
      this.leaderboardGizmo.position.set(LEADERBOARD_HIDDEN_POS);
      log.info(`Leaderboard gizmo moved to hidden position: ${LEADERBOARD_HIDDEN_POS.toString()}`);
    } else {
      log.warn("leaderboardGizmo prop is NOT SET on overlay entity - cannot control leaderboard visibility");
    }

    // Cache milk gizmos (optional)
    this.milkBackgroundGizmo = this.props.milkBackgroundGizmo || null;
    this.milkForegroundGizmo = this.props.milkForegroundGizmo || null;
    log.info(`Milk background prop: ${this.milkBackgroundGizmo ? "SET" : "NULL"}`);
    log.info(`Milk foreground prop: ${this.milkForegroundGizmo ? "SET" : "NULL"}`);

    // Listen for state updates via NETWORK event (from Backend)
    this.connectNetworkBroadcastEvent(
      UIEvents.toClient,
      (data: UIEventPayload) => this.handleStateChanged(data)
    );
    
    // Listen for dunk multiplier events
    this.connectLocalBroadcastEvent(
      LocalUIEvents.dunkMultiplier,
      (data: { multiplier: number; durationMs: number; isRefresh?: boolean }) => this.onDunkMultiplier(data)
    );
    
    // Listen for click rate updates
    this.connectLocalBroadcastEvent(
      LocalUIEvents.clickRateUpdate,
      (data: { clicksPerSecond: number; isActive: boolean }) => this.onClickRateUpdate(data)
    );

    // Build and set initial data context (commands are set once here)
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;

    // Broadcast initial page so all gizmos set correct visibility
    this.async.setTimeout(() => {
      this.sendLocalBroadcastEvent(LocalUIEvents.changePage, { page: this.currentPage });
    }, 100);

    log.info("Overlay initialized (Header + Navigation)");
  }
  // #endregion

  // #region 🎯 Main Logic
  private buildDataContext(): void {
    // Commands are set once and reused - don't recreate them on updates!
    this.dataContext = {
      // Header data
      cookieCount: formatCookieDisplay(this.cookies),
      cookiesPerSecond: formatCPSDisplay(this.cookiesPerSecond),
      
      // Click rate indicator (shown during active multiplier)
      clicksPerSecondText: "",
      clicksPerSecondVisible: false,
      clicksPerSecondColor: "#ffffff",
      
      // Multiplier display
      multiplierText: "2x",
      multiplierVisible: false,
      multiplierOpacity: 1,
      multiplierScale: 1,
      shakeX: 0,
      shakeY: 0,
      
      // Navigation commands (set once, never recreated)
      onShopClick: () => this.navigateToPage("shop"),
      onHomeClick: () => this.navigateToPage("home"),
      onStatsClick: () => this.navigateToPage("stats"),
    };
  }

  private navigateToPage(page: PageType): void {
    const log = this.log.active("navigateToPage");

    if (this.currentPage === page) {
      log.info(`Already on ${page} page`);
      return;
    }

    log.info(`Navigating from ${this.currentPage} to ${page}`);
    this.currentPage = page;

    // Broadcast page change to CoreGame and other overlays (Clickers, Background)
    this.sendLocalBroadcastEvent(LocalUIEvents.changePage, { page });
    
    // Update multiplier visibility based on page (only show on home)
    this.updateMultiplierVisibility();
    
    // Request save when navigating to stats (leaderboard) - ensures latest data is saved
    if (page === "stats") {
      log.info("Requesting PPV save before viewing leaderboard");
      this.sendNetworkBroadcastEvent(GameEvents.toServer, { type: "request_save" });
    }

    // Toggle leaderboard gizmo position when changing pages
    if (this.leaderboardGizmo) {
      if (page === "stats") {
        // Get current camera position and forward direction
        const cameraPos = LocalCamera.position.get();
        const cameraForward = LocalCamera.forward.get();
        
        // Position leaderboard in front of camera, slightly lower
        const leaderboardPos = cameraPos.add(cameraForward.mul(LEADERBOARD_DISTANCE_FROM_CAMERA)).sub(new Vec3(0, 0.065, 0));
        
        // Rotate to face the same direction as camera (not back at it)
        const leaderboardRot = Quaternion.lookRotation(cameraForward, Vec3.up);
        
        this.leaderboardGizmo.position.set(leaderboardPos);
        this.leaderboardGizmo.rotation.set(leaderboardRot);
        log.info(`Leaderboard moved to visible position: ${leaderboardPos.toString()} (${LEADERBOARD_DISTANCE_FROM_CAMERA}m in front of camera)`);
      } else {
        // Move leaderboard to hidden position (world origin, underground)
        this.leaderboardGizmo.position.set(LEADERBOARD_HIDDEN_POS);
        log.info(`Leaderboard moved to hidden position: ${LEADERBOARD_HIDDEN_POS.toString()}`);
      }
    }
    
    // Show/hide milk gizmos based on page (only visible on home)
    const showMilk = page === "home";
    if (this.milkBackgroundGizmo) {
      this.milkBackgroundGizmo.visible.set(showMilk);
      log.info(`Milk background ${showMilk ? "shown" : "hidden"}`);
    }
    if (this.milkForegroundGizmo) {
      this.milkForegroundGizmo.visible.set(showMilk);
      log.info(`Milk foreground ${showMilk ? "shown" : "hidden"}`);
    }
  }
  // #endregion

  // #region 🎬 Handlers
  private handleStateChanged(data: UIEventPayload): void {
    const log = this.log.inactive("handleStateChanged");
    
    if (data.type !== "state_update") return;
    
    this.cookies = (data.cookies as number) || 0;
    this.cookiesPerSecond = (data.cps as number) || 0;
    this.updateUI();
  }
  
  private onClickRateUpdate(data: { clicksPerSecond: number; isActive: boolean }): void {
    const log = this.log.inactive("onClickRateUpdate");
    
    if (!data.isActive) {
      // Hide click rate indicator
      this.dataContext.clicksPerSecondVisible = false;
      this.dataContext.clicksPerSecondText = "";
    } else {
      // Show click rate with color coding
      const cps = data.clicksPerSecond;
      const requiredCps = 2; // CLICKS_PER_SECOND_THRESHOLD from noesis_cookie.ts
      
      this.dataContext.clicksPerSecondVisible = true;
      this.dataContext.clicksPerSecondText = `⚡ ${cps.toFixed(1)} clicks/sec`;
      
      // Color coding: green if meeting threshold, yellow if close, red if low
      if (cps >= requiredCps) {
        this.dataContext.clicksPerSecondColor = "#4CAF50"; // Green
      } else if (cps >= requiredCps * 0.75) {
        this.dataContext.clicksPerSecondColor = "#FFC107"; // Yellow/amber
      } else {
        this.dataContext.clicksPerSecondColor = "#FF5722"; // Red/orange
      }
      
      log.info(`Click rate: ${cps.toFixed(1)} CPS, color: ${this.dataContext.clicksPerSecondColor}`);
    }
    
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
  }
  
  private onDunkMultiplier(data: { multiplier: number; durationMs: number; isRefresh?: boolean }): void {
    const log = this.log.active("onDunkMultiplier");
    
    const wasActive = this.currentMultiplier > 1;
    const isNewOrUpgraded = !wasActive || (!data.isRefresh && data.multiplier > this.currentMultiplier);
    const isFirstActivation = !wasActive; // Track if this is the initial 2x activation
    
    this.currentMultiplier = data.multiplier;
    this.multiplierEndTime = Date.now() + data.durationMs;
    
    log.info(`Multiplier ${data.isRefresh ? 'refreshed' : 'activated'}: ${data.multiplier}x for ${data.durationMs}ms`);
    
    // Clear existing timers for active streak logic
    if (this.multiplierTimerId !== null) {
      this.async.clearInterval(this.multiplierTimerId);
      this.multiplierTimerId = null;
    }
    if (this.shakeTimerId !== null) {
      this.async.clearInterval(this.shakeTimerId);
      this.shakeTimerId = null;
    }
    // Do NOT clear fade-out timer here – the falling animation
    // is treated as a separate, one-shot animation that only
    // plays after blinking has finished. Clicks that refresh or
    // start a new streak shouldn't restart or cancel an in-flight
    // fall; it just runs to completion once triggered.
    // Don't clear pop-in timer - let it complete naturally
    // Only reset pop-in for new activations
    if (!data.isRefresh && this.popInTimerId !== null) {
      this.async.clearInterval(this.popInTimerId);
      this.popInTimerId = null;
    }
    
    // Reset multiplier display state (opacity, shake position) when refreshing
    if (data.isRefresh) {
      this.dataContext.multiplierOpacity = 1;
      this.dataContext.shakeY = 0;
    }
    
    // Trigger pop-in animation only for new streak or multiplier upgrade (not refreshes)
    // Also check if animation is already running to prevent retriggering
    if (isNewOrUpgraded && this.popInTimerId === null) {
      this.triggerPopInAnimation(isFirstActivation);
    }
    
    // Start shake effect based on multiplier tier
    this.startShakeEffect();
    
    // Reset pulse phase
    this.pulsePhase = 0;
    
    // Start countdown timer (update every 16ms for smooth animations)
    this.multiplierTimerId = this.async.setInterval(() => {
      const now = Date.now();
      const remaining = this.multiplierEndTime - now;
      
      // Update display - only visible on home page, no timer shown
      this.dataContext.multiplierText = `${this.currentMultiplier}x`;
      this.dataContext.multiplierVisible = this.currentPage === "home";
      
      if (remaining <= 0) {
        // Ensure final state is fully faded/finished, then stop effects
        this.dataContext.multiplierOpacity = 0;
        if (this.noesisGizmo) {
          this.noesisGizmo.dataContext = this.dataContext;
        }
        this.stopMultiplierEffects();
        log.info("Multiplier animation complete (blink + fall)");
        return;
      }
      
      // When more than FLASH_THRESHOLD_MS remains, keep full opacity (no blink/fall yet)
      if (remaining > FLASH_THRESHOLD_MS) {
        this.dataContext.multiplierOpacity = 1;
      } else {
        // Time within the 5000ms blink window
        const elapsedInBlink = FLASH_THRESHOLD_MS - remaining; // 0..5000ms
        const clamped = Math.max(0, Math.min(FLASH_THRESHOLD_MS, elapsedInBlink));
        const segmentDuration = FLASH_THRESHOLD_MS / 3; // 3 segments: 2 blinks + 1 blink+fall
        const segmentIndex = Math.min(2, Math.floor(clamped / segmentDuration)); // 0,1,2
        const segmentT = (clamped - segmentIndex * segmentDuration) / segmentDuration; // 0..1
        
        if (segmentIndex < 2) {
          // First two segments: classic blink between 100% and 50% (cosine wave)
          const wave = (Math.cos(2 * Math.PI * segmentT) + 1) / 2; // 1 -> 0 -> 1
          this.dataContext.multiplierOpacity = PULSE_MIN_OPACITY + (1 - PULSE_MIN_OPACITY) * wave;
        } else {
          // Third segment: final blink from 100% to 0% opacity.
          // Opacity eases down using a half-cosine wave.
          const fadeWave = (Math.cos(Math.PI * segmentT) + 1) / 2; // 1 -> 0
          this.dataContext.multiplierOpacity = fadeWave;
          
          // Fall animation starts when opacity drops below 95% (very early in the fade)
          // This ensures the fade is visibly underway before fall motion begins
          if (fadeWave < 0.95 && !this.isFalling) {
            this.isFalling = true;
            this.fallStartShakeY = this.dataContext.shakeY as number;
            this.fallStartScale = this.dataContext.multiplierScale as number;
            // Stop shake timer so only the fall animation controls shakeY.
            if (this.shakeTimerId !== null) {
              this.async.clearInterval(this.shakeTimerId);
              this.shakeTimerId = null;
            }
            this.currentShakeX = 0;
            this.currentShakeY = 0;
            this.targetShakeX = 0;
            this.targetShakeY = 0;
          }
          
          // Fall progresses over the entire 3rd segment (0..1) once started
          if (this.isFalling) {
            const fallDistance = 120;
            const easeIn = segmentT * segmentT; // quadratic ease-in for downward motion
            const fallY = this.fallStartShakeY + (fallDistance * easeIn);
            
            // Scale down slightly as it falls
            const scale = this.fallStartScale * (1 - segmentT * 0.2);
            
            this.dataContext.shakeX = 0; // Remove horizontal shake during fall
            this.dataContext.shakeY = fallY;
            this.dataContext.multiplierScale = scale;
          }
        }
      }
      
      if (this.noesisGizmo) {
        this.noesisGizmo.dataContext = this.dataContext;
      }
    }, 16);
    
    // Initial update - only visible on home page
    this.dataContext.multiplierText = `${this.currentMultiplier}x`;
    this.dataContext.multiplierVisible = this.currentPage === "home";
    this.dataContext.multiplierOpacity = 1;
    // Don't reset scale if pop-in animation is running
    if (this.popInTimerId === null) {
      this.dataContext.multiplierScale = 1;
    }
    
    log.info(`Multiplier UI: visible=${this.dataContext.multiplierVisible}, text=${this.dataContext.multiplierText}, page=${this.currentPage}`);
    
    this.updateUI();
  }
  
  private triggerPopInAnimation(isFirstActivation: boolean = false): void {
    const log = this.log.active("triggerPopInAnimation");
    log.info("Starting pop-in animation");
    
    // Clear any existing pop-in animation
    if (this.popInTimerId !== null) {
      this.async.clearInterval(this.popInTimerId);
      this.popInTimerId = null;
    }
    
    // Use constant base scale of 1.0 for all multiplier tiers
    // This keeps the text at a consistent size regardless of multiplier value
    this.baseScale = 1.0;
    
    // Balloon effect: start from small scale for first activation, or current scale for upgrades
    // Use 0.3x of target scale to ensure visible animation for all tiers
    const startScale = isFirstActivation ? this.baseScale * 0.3 : this.currentScale;
    const overshootScale = this.baseScale * POP_IN_OVERSHOOT;
    const targetScale = this.baseScale;
    
    this.currentScale = startScale;
    this.dataContext.multiplierScale = startScale;
    
    const startTime = Date.now();
    
    this.popInTimerId = this.async.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / POP_IN_DURATION_MS, 1);
      
      if (progress >= 1) {
        // Animation complete - settle at base scale
        this.currentScale = this.baseScale;
        this.dataContext.multiplierScale = this.baseScale;
        if (this.popInTimerId !== null) {
          this.async.clearInterval(this.popInTimerId);
          this.popInTimerId = null;
        }
        log.info(`Pop-in animation complete, baseScale: ${this.baseScale.toFixed(2)}`);
      } else {
        // Balloon effect: elastic ease out with overshoot (1500ms duration)
        // Phase 1 (0-0.4): rapid expansion from start to overshoot
        // Phase 2 (0.4-1): slow settle down to target
        let scale: number;
        if (progress < 0.4) {
          // Expand rapidly to overshoot (first 600ms)
          const t = progress / 0.4; // 0 to 1 in first 40%
          const easeOut = 1 - Math.pow(1 - t, 3); // Cubic ease out
          scale = startScale + (overshootScale - startScale) * easeOut;
        } else {
          // Settle down slowly to target (remaining 900ms)
          const t = (progress - 0.4) / 0.6; // 0 to 1 in remaining 60%
          const easeOut = 1 - Math.pow(1 - t, 2.5); // Slow ease out
          scale = overshootScale + (targetScale - overshootScale) * easeOut;
        }
        this.currentScale = scale;
        this.dataContext.multiplierScale = scale;
      }
      
      if (this.noesisGizmo) {
        this.noesisGizmo.dataContext = this.dataContext;
      }
    }, 16);
  }
  
  private startShakeEffect(): void {
    // Determine shake intensity based on multiplier - exponential scaling
    let shakeConfig = SHAKE_2X;
    if (this.currentMultiplier >= 16) {
      shakeConfig = SHAKE_16X;
    } else if (this.currentMultiplier >= 8) {
      shakeConfig = SHAKE_8X;
    } else if (this.currentMultiplier >= 4) {
      shakeConfig = SHAKE_4X;
    }
    
    // BorisFX s_shake style - aggressive random movement with fast lerp
    this.shakeTimerId = this.async.setInterval(() => {
      const range = shakeConfig.range;
      const frequency = shakeConfig.frequency;
      const speed = shakeConfig.speed;
      
      // High frequency target changes for jittery aggressive shake
      if (Math.random() < frequency) {
        // Random direction with full range
        this.targetShakeX = (Math.random() - 0.5) * 2 * range;
        this.targetShakeY = (Math.random() - 0.5) * 2 * range;
      }
      
      // Fast interpolation for snappy movement
      this.currentShakeX += (this.targetShakeX - this.currentShakeX) * speed;
      this.currentShakeY += (this.targetShakeY - this.currentShakeY) * speed;
      
      // Add micro-jitter for extra aggression
      const jitter = range * 0.1;
      const finalX = this.currentShakeX + (Math.random() - 0.5) * jitter;
      const finalY = this.currentShakeY + (Math.random() - 0.5) * jitter;
      
      this.dataContext.shakeX = finalX;
      this.dataContext.shakeY = finalY;
      
      if (this.noesisGizmo) {
        this.noesisGizmo.dataContext = this.dataContext;
      }
    }, 16);
  }
  
  private stopMultiplierEffects(): void {
    this.currentMultiplier = 1;
    this.dataContext.multiplierVisible = false;
    this.dataContext.multiplierText = "";
    this.dataContext.shakeX = 0;
    this.dataContext.shakeY = 0;
    this.dataContext.multiplierOpacity = 1;
    this.dataContext.multiplierScale = 1;
    
    // Reset smooth animation state
    this.currentShakeX = 0;
    this.currentShakeY = 0;
    this.targetShakeX = 0;
    this.targetShakeY = 0;
    this.pulsePhase = 0;
    this.currentScale = 1;
    this.baseScale = 1;
    this.isFalling = false;
    this.fallStartShakeY = 0;
    this.fallStartScale = 1;
    
    if (this.multiplierTimerId !== null) {
      this.async.clearInterval(this.multiplierTimerId);
      this.multiplierTimerId = null;
    }
    if (this.shakeTimerId !== null) {
      this.async.clearInterval(this.shakeTimerId);
      this.shakeTimerId = null;
    }
    if (this.popInTimerId !== null) {
      this.async.clearInterval(this.popInTimerId);
      this.popInTimerId = null;
    }
    if (this.fadeOutTimerId !== null) {
      this.async.clearInterval(this.fadeOutTimerId);
      this.fadeOutTimerId = null;
    }
    
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
  }
  
  // Fades out the multiplier text with fall animation over 1500ms
  // This is called when the timer hits 0, starting the fall from 50% to 0% opacity
  private fadeOutMultiplier(): void {
    const log = this.log.active("fadeOutMultiplier");
    
    // Legacy method no longer used – fall is now driven directly
    // from the main multiplier timer's third segment.
    log.info("fadeOutMultiplier called, but fall is now handled in onDunkMultiplier timer");
  }
  // #endregion

  // #region 🛠️ Helper Methods
  private updateMultiplierVisibility(): void {
    // Multiplier is only visible on home page AND when active
    const isMultiplierActive = this.currentMultiplier > 1 && Date.now() < this.multiplierEndTime;
    this.dataContext.multiplierVisible = this.currentPage === "home" && isMultiplierActive;
    
    // Reset shake position when hidden
    if (!this.dataContext.multiplierVisible) {
      this.dataContext.shakeX = 0;
      this.dataContext.shakeY = 0;
      this.currentShakeX = 0;
      this.currentShakeY = 0;
      this.targetShakeX = 0;
      this.targetShakeY = 0;
    }
    
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
  }
  
  private updateUI(): void {
    if (!this.noesisGizmo) return;
    
    // Calculate effective CPS with multiplier if active
    const activeMultiplier = this.getActiveMultiplier();
    const effectiveCps = this.cookiesPerSecond * activeMultiplier;
    
    // Only update header values - DON'T recreate commands!
    this.dataContext.cookieCount = formatCookieDisplay(this.cookies);
    this.dataContext.cookiesPerSecond = formatCPSDisplay(effectiveCps);
    
    this.noesisGizmo.dataContext = this.dataContext;
  }
  
  // Returns the active streak multiplier, or 1 if streak has expired
  private getActiveMultiplier(): number {
    const now = Date.now();
    if (now < this.multiplierEndTime && this.currentMultiplier > 1) {
      return this.currentMultiplier;
    }
    return 1;
  }
  // #endregion
}

Component.register(Default);
