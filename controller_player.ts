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
import { LocalUIEvents } from "./util_gameData";

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
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");

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

    // Force interaction mode - hides thumbstick/jump, enables gesture detection
    localPlayer.enterFocusedInteractionMode({
      disableFocusExitButton: true,
    });

    log.info("Forced interaction mode enabled");
    
    // Position camera to face the cookie
    this.positionCameraAtCookie();
    
    // Set up mobile gesture detection
    this.setupMobileGestures();

    // Set up raycast-based cookie tapping (mobile/web)
    this.setupRaycastCookieClick();
  }
  // #endregion
  
  // #region 🎬 Handlers
  private positionCameraAtCookie(): void {
    const log = this.log.active("positionCameraAtCookie");

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
    const log = this.log.active("setupMobileGestures");
    
    try {
      this.gestures = new Gestures(this);
      
      // Detect swipe down gesture
      this.gestures.onSwipe.connectLocalEvent(({ swipeDirection }) => {
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
    const log = this.log.active("setupRaycastCookieClick");

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
    // Only listen to InputEnded to avoid double-triggering on single taps
    this.connectLocalBroadcastEvent(
      hz.PlayerControls.onFocusedInteractionInputEnded,
      (data: { interactionInfo: hz.InteractionInfo[] }) => {
        const innerLog = this.log.inactive("onFocusedInteractionInputEnded");
        this.handleInteraction(data.interactionInfo, innerLog);
      }
    );
    
    log.info("Raycast cookie click handler connected");
  }

  private handleInteraction(interactionInfo: hz.InteractionInfo[], log: { info: (msg: string) => void; warn: (msg: string) => void }): void {
    if (!this.raycastGizmo || !this.cookieCollider) {
      log.warn("Raycast or collider not set");
      return;
    }

    const interactions = interactionInfo || [];
    log.info(`Processing ${interactions.length} interactions`);
    
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
