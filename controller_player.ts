// Desktop Editor Setup: Attach to Empty Object entity. Use Local execution mode.
// #region 📋 README
// Local controller for each player.
// Handles mobile gesture detection and forces interaction mode.
// NoesisUI set to Interactive, Non-blocking to allow gestures through.
// Must use Local execution mode - runs on each player's client.
// #endregion

import * as hz from "horizon/core";
import { Gestures, SwipeDirection } from "horizon/mobile_gestures";
import LocalCamera from "horizon/camera";
import { Logger } from "./util_logger";
import { GameEvents, LocalUIEvents, UIEvents, UIEventPayload } from "./util_gameData";

// #region 🏷️ Type Definitions
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    raycastGizmo: { type: hz.PropTypes.Entity },
    cookieCollider: { type: hz.PropTypes.Entity },
    cookieGizmo: { type: hz.PropTypes.Entity },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("controller_player");
  private gestures: Gestures | null = null;
  private raycastGizmo: hz.RaycastGizmo | null = null;
  private cookieCollider: hz.Entity | null = null;
  private isCookiePressed: boolean = false;
  private deviceTypeReported: boolean = false; // Only report device type once
  private isInputBlocked: boolean = false; // Blocks input when non-mobile user on mobile-only mode
  private isMobile: boolean = false; // Cached device type
  private isNavInputBlocked: boolean = false; // Temporarily blocks input when nav buttons are pressed
  private currentPage: string = "home"; // Track current page to block gestures/clicks on non-home pages
  private isDunkEnabled: boolean = true; // Blocks dunk gesture during onboarding until swipe tutorial
  private isCookieClickEnabled: boolean = true; // Blocks cookie clicks during onboarding until cookie tap step
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.inactive("start");

    const localPlayer = this.world.getLocalPlayer();
    const serverPlayer = this.world.getServerPlayer();

    // Skip if running on server
    if (localPlayer === serverPlayer) {
      log.info("Running on server - skipping");
      return;
    }

    log.info(`Setting up for player: ${localPlayer.name.get()}`);
    
    // Transfer entity ownership to local player (required for Gestures API)
    this.entity.owner.set(localPlayer);
    log.info("Entity ownership transferred to local player");

    // NOTE: Focused interaction mode is NOT enabled on start.
    // It will be enabled when the user clicks the Collect button in the WelcomeBack modal.
    // This prevents drag line artifacts from appearing on the overlay buttons.
    
    // Position camera to face the cookie
    this.positionCameraAtCookie();
    
    // Set up mobile gesture detection
    this.setupMobileGestures();

    // Set up raycast-based cookie tapping (mobile/web)
    this.setupRaycastCookieClick();

    // Report device type to server on first state update
    this.connectNetworkBroadcastEvent(
      UIEvents.toClient,
      (data: UIEventPayload) => this.reportDeviceType(data, localPlayer)
    );
    
    // Listen for mobileOnly state changes to block/unblock input
    this.connectNetworkBroadcastEvent(
      UIEvents.toClient,
      (data: UIEventPayload) => this.handleInputBlockingState(data)
    );
    
    // Listen for navigation input block events (prevents drag line artifacts)
    this.connectLocalBroadcastEvent(
      LocalUIEvents.navInputBlock,
      (data: { block: boolean }) => this.handleNavInputBlock(data)
    );
    
    // Listen for page changes to enable/disable input detection
    this.connectLocalBroadcastEvent(
      LocalUIEvents.changePage,
      (data: { page: string }) => this.handlePageChange(data)
    );
    
    // Listen for onboarding dunk control (enables/disables swipe gesture)
    this.connectLocalBroadcastEvent(
      LocalUIEvents.onboardingDunkEnabled,
      (data: { enabled: boolean }) => this.handleOnboardingDunkEnabled(data)
    );
    
    // Listen for onboarding cookie click control (enables/disables cookie clicking)
    this.connectLocalBroadcastEvent(
      LocalUIEvents.onboardingCookieClickEnabled,
      (data: { enabled: boolean }) => this.handleOnboardingCookieClickEnabled(data)
    );
  }
  // #endregion
  
  // #region 🎬 Handlers
  // Handle onboarding dunk control
  private handleOnboardingDunkEnabled(data: { enabled: boolean }): void {
    const log = this.log.active("handleOnboardingDunkEnabled");
    this.isDunkEnabled = data.enabled;
    log.info(`Dunk enabled: ${this.isDunkEnabled}`);
  }
  
  // Handle onboarding cookie click control
  private handleOnboardingCookieClickEnabled(data: { enabled: boolean }): void {
    const log = this.log.active("handleOnboardingCookieClickEnabled");
    this.isCookieClickEnabled = data.enabled;
    log.info(`Cookie click enabled: ${this.isCookieClickEnabled}`);
  }
  
  // Report device type to backend once when first state update arrives
  private reportDeviceType(data: UIEventPayload, player: hz.Player): void {
    const log = this.log.inactive("reportDeviceType");

    if (data.type !== "state_update") {
      return;
    }

    // Only report device type once
    if (this.deviceTypeReported) {
      return;
    }

    this.deviceTypeReported = true;

    // Get device type - possible values: "VR", "Mobile", "Desktop"
    const deviceType = player.deviceType.get();
    this.isMobile = deviceType === hz.PlayerDeviceType.Mobile;

    log.info(`[DEVICE TYPE] Detected: "${deviceType}", isMobile=${this.isMobile}`);

    // Send device type to backend
    this.sendNetworkBroadcastEvent(GameEvents.toServer, {
      type: "device_type_report",
      isMobile: this.isMobile,
    });
    
    log.info(`[DEVICE TYPE] Reported to backend: isMobile=${this.isMobile}`);
  }
  
  // Update input blocking state based on backend's mobileOnly setting
  private handleInputBlockingState(data: UIEventPayload): void {
    const log = this.log.inactive("handleInputBlockingState");
    
    if (data.type !== "state_update") {
      return;
    }
    
    // Check if mobileOnly mode is enabled on backend
    const mobileOnlyFlag = (data as any).mobileOnly as boolean | undefined;
    if (typeof mobileOnlyFlag !== "boolean") {
      return;
    }
    
    // Only update if we've reported device type
    if (!this.deviceTypeReported) {
      return;
    }
    
    // Don't block input - allow Web/VR users to still play even with MobileOnly overlay shown
    // The overlay is just a warning, not a hard block
    this.isInputBlocked = false;
    log.info(`[INPUT BLOCKING] Disabled (mobileOnly=${mobileOnlyFlag}, isMobile=${this.isMobile})`);
  }
  
  // Track page changes to conditionally block input on non-home pages
  private handlePageChange(data: { page: string }): void {
    const log = this.log.inactive("handlePageChange");
    this.currentPage = data.page;
    log.info(`Page changed to: ${this.currentPage}`);
  }
  
  // Handle navigation input block events from overlay
  private handleNavInputBlock(data: { block: boolean }): void {
    const log = this.log.inactive("handleNavInputBlock");
    
    this.isNavInputBlocked = data.block;
    
    // If blocking, also reset any pressed state to prevent stuck finger
    if (data.block && this.isCookiePressed) {
      this.isCookiePressed = false;
      log.info("Reset cookie pressed state due to nav input block");
    }
    
    log.info(`Nav input block: ${data.block}`);
  }
  
  private positionCameraAtCookie(): void {
    const log = this.log.inactive("positionCameraAtCookie");

    if (!this.props.cookieGizmo) {
      log.warn("No cookie gizmo configured for camera positioning");
      return;
    }

    // Get the cookie gizmo position and forward direction
    const gizmoPos = this.props.cookieGizmo.position.get();
    const gizmoForward = this.props.cookieGizmo.forward.get();

    // Position camera IN FRONT of the gizmo (along its forward direction)
    // NoesisUI renders on the front face of the gizmo
    const cameraDistance = 0.70; // Close to cookie for better view
    const cameraPos = gizmoPos.add(gizmoForward.mul(cameraDistance));

    // Calculate rotation to look back at the gizmo
    const directionToGizmo = gizmoPos.sub(cameraPos).normalize();
    const cameraRot = hz.Quaternion.lookRotation(directionToGizmo, hz.Vec3.up);

    log.info(`Camera positioned at: ${cameraPos.toString()}, looking at cookie`);

    // Set camera to fixed mode facing the cookie
    LocalCamera.setCameraModeFixed({
      position: cameraPos,
      rotation: cameraRot,
    });

    // Disable perspective switching so player stays locked on cookie
    LocalCamera.perspectiveSwitchingEnabled.set(false);

    log.info("Camera locked to cookie position");
  }

  private setupMobileGestures(): void {
    const log = this.log.inactive("setupMobileGestures");
    
    try {
      this.gestures = new Gestures(this);
      
      // Detect swipe down gesture
      this.gestures.onSwipe.connectLocalEvent(({ swipeDirection }) => {
        // Block gestures when mobile-only warning is shown, nav button was pressed, on non-home pages, or dunk disabled during onboarding
        if (this.isInputBlocked || this.isNavInputBlocked || this.currentPage !== "home" || !this.isDunkEnabled) {
          return;
        }
        
        if (swipeDirection === SwipeDirection.Down) {
          log.info("Swipe down detected!");
          this.sendLocalBroadcastEvent(LocalUIEvents.swipeDown, {});
        }
      });
      
      log.info("Mobile gestures initialized successfully");
    } catch (e) {
      log.warn(`Mobile gestures setup failed: ${e}`);
    }
  }

  private setupRaycastCookieClick(): void {
    const log = this.log.inactive("setupRaycastCookieClick");

    if (!this.props.raycastGizmo) {
      log.warn("raycastGizmo prop not set - cookie tap handling disabled");
      return;
    }
    
    if (!this.props.cookieCollider) {
      log.warn("cookieCollider prop not set - cookie tap handling disabled");
      return;
    }

    const raycast = this.props.raycastGizmo.as(hz.RaycastGizmo);
    if (!raycast) {
      log.warn("raycastGizmo prop is not a RaycastGizmo entity");
      return;
    }

    this.raycastGizmo = raycast;
    this.cookieCollider = this.props.cookieCollider;
    
    log.info(`Raycast gizmo ready: ${this.raycastGizmo.toString()}`);
    log.info(`Cookie collider target: ${this.cookieCollider.name.get()}`);

    // Use connectLocalBroadcastEvent for Focused Interaction tap events
    // InputStarted = press down, InputEnded = release
    this.connectLocalBroadcastEvent(
      hz.PlayerControls.onFocusedInteractionInputStarted,
      (data: { interactionInfo: hz.InteractionInfo[] }) => {
        const innerLog = this.log.active("onFocusedInteractionInputStarted");
        this.handleInteractionStart(data.interactionInfo, innerLog);
      }
    );
    
    this.connectLocalBroadcastEvent(
      hz.PlayerControls.onFocusedInteractionInputEnded,
      (data: { interactionInfo: hz.InteractionInfo[] }) => {
        const innerLog = this.log.active("onFocusedInteractionInputEnded");
        this.handleInteractionEnd(data.interactionInfo, innerLog);
      }
    );
    
    log.info("Raycast cookie click handler connected");
  }

  private handleInteractionStart(interactionInfo: hz.InteractionInfo[], log: { info: (msg: string) => void; warn: (msg: string) => void }): void {
    if (!this.raycastGizmo || !this.cookieCollider) {
      return;
    }
    
    // Block input when mobile-only warning is shown, nav button was pressed, on non-home pages, or cookie click disabled during onboarding
    if (this.isInputBlocked || this.isNavInputBlocked || this.currentPage !== "home" || !this.isCookieClickEnabled) {
      return;
    }

    const interactions = interactionInfo || [];
    
    for (const interaction of interactions) {
      if (interaction.interactionIndex !== 0) continue;

      const hit = this.raycastGizmo.raycast(
        interaction.worldRayOrigin,
        interaction.worldRayDirection
      ) as hz.RaycastHit | null;

      if (hit && hit.targetType === hz.RaycastTargetType.Entity && hit.target === this.cookieCollider) {
        log.info("Cookie pressed down");
        this.isCookiePressed = true;
        this.sendLocalBroadcastEvent(LocalUIEvents.cookiePressed, {});
      }
    }
  }

  private handleInteractionEnd(interactionInfo: hz.InteractionInfo[], log: { info: (msg: string) => void; warn: (msg: string) => void }): void {
    // Block input when mobile-only warning is shown, nav button was pressed, on non-home pages, or cookie click disabled during onboarding
    if (this.isInputBlocked || this.isNavInputBlocked || this.currentPage !== "home" || !this.isCookieClickEnabled) {
      return;
    }
    
    // If cookie was pressed, release it regardless of where the finger ended
    // This handles the case where user swipes away (e.g., dunk gesture)
    if (this.isCookiePressed) {
      log.info("Cookie released (was pressed)");
      this.isCookiePressed = false;
      this.sendLocalBroadcastEvent(LocalUIEvents.cookieClicked, {});
      return;
    }
    
    // If cookie wasn't already pressed, check if this is a quick tap on the cookie
    if (!this.raycastGizmo || !this.cookieCollider) {
      return;
    }

    const interactions = interactionInfo || [];
    
    for (const interaction of interactions) {
      // Only respond to primary tap (index 0)
      if (interaction.interactionIndex !== 0) {
        continue;
      }

      log.info(`Tap at origin: ${interaction.worldRayOrigin.toString()}, dir: ${interaction.worldRayDirection.toString()}`);

      const hit = this.raycastGizmo.raycast(
        interaction.worldRayOrigin,
        interaction.worldRayDirection
      ) as hz.RaycastHit | null;

      if (!hit) {
        log.info("Raycast returned null - no hit");
        continue;
      }
      
      log.info(`Hit targetType: ${hit.targetType}, hitPoint: ${hit.hitPoint.toString()}`);

      if (hit.targetType !== hz.RaycastTargetType.Entity) {
        log.info(`Hit was not an Entity (type: ${hit.targetType})`);
        continue;
      }
      
      if (!hit.target) {
        log.info("Hit target is null");
        continue;
      }
      
      log.info(`Hit entity: ${hit.target.name.get()}`);

      if (hit.target === this.cookieCollider) {
        log.info("Cookie collider tapped via raycast - sending cookieClicked event!");
        this.sendLocalBroadcastEvent(LocalUIEvents.cookieClicked, {});
      } else {
        log.info(`Hit entity doesn't match cookieCollider`);
      }
    }
  }
  // #endregion
}

hz.Component.register(Default);
