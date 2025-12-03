// Desktop Editor Setup: Attach to Empty Object entity. Use Local execution mode. Set as playerControllerEntity prop in manager_game.

// #region 📋 README
// Local controller assigned to each player when they join.
// Forces permanent interaction with the cookie button gizmo.
// The player will always be in focused interaction mode - never released.
// Must use Local execution mode - runs on the owning player's client.
// #endregion

import { Component, Player, PropTypes, Vec3, Quaternion } from "horizon/core";
import LocalCamera from "horizon/camera";
import { Logger } from "./util_logger";

// #region 🏷️ Type Definitions
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    cookieButtonGizmo: { type: PropTypes.Entity },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("controller_player");
  private localPlayer: Player | null = null;
  private hasForcedInteraction: boolean = false;
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");
    
    // Get local player and server player references
    this.localPlayer = this.world.getLocalPlayer();
    const serverPlayer = this.world.getServerPlayer();
    
    // Check if we're running on the server
    // On the server, getLocalPlayer() returns the server player
    const isServer = this.localPlayer === serverPlayer;
    log.info(`isServer: ${isServer}`);
    
    if (isServer) {
      log.info("Running on server - waiting for ownership transfer to client");
      return;
    }
    
    // On client: check if this entity is already owned by the local player
    // (This handles the case where the script starts after ownership was already set)
    const owner = this.entity.owner.get();
    log.info(`owner: ${owner?.name?.get() ?? "null"}, localPlayer: ${this.localPlayer?.name?.get() ?? "null"}`);
    
    if (owner && owner === this.localPlayer) {
      log.info(`Player controller already owned by ${this.localPlayer.name.get()}`);
      this.forcePermanentInteraction();
    } else {
      log.info("Waiting for ownership transfer");
    }
  }
  
  // Called when ownership is transferred to this client
  receiveOwnership(
    _oldOwner: Player,
    _newOwner: Player,
    _state: {}
  ): void {
    const log = this.log.active("receiveOwnership");
    
    // Update local player reference
    this.localPlayer = this.world.getLocalPlayer();
    const serverPlayer = this.world.getServerPlayer();
    
    // Safety check - only run on actual client, not server
    if (this.localPlayer === serverPlayer) {
      log.info("receiveOwnership called on server - ignoring");
      return;
    }
    
    log.info(`newOwner: ${_newOwner?.name?.get() ?? "null"}, localPlayer: ${this.localPlayer?.name?.get() ?? "null"}`);
    
    if (this.localPlayer && _newOwner === this.localPlayer) {
      log.info(`Ownership received by ${this.localPlayer.name.get()}`);
      this.forcePermanentInteraction();
    }
  }
  
  // Called when ownership is transferred away from this client
  transferOwnership(
    _oldOwner: Player,
    _newOwner: Player
  ): {} {
    const log = this.log.active("transferOwnership");
    log.info("Ownership transferred away");
    return {};
  }
  // #endregion

  // #region 🎯 Main Logic
  // Force permanent focus on the cookie button gizmo
  private forcePermanentInteraction(): void {
    const log = this.log.active("forcePermanentInteraction");
    
    if (!this.localPlayer) {
      log.warn("Cannot force interaction - no local player");
      return;
    }
    
    if (this.hasForcedInteraction) {
      log.info("Already focused on cookie button");
      return;
    }
    
    if (!this.props.cookieButtonGizmo) {
      log.error("No cookie button gizmo configured!");
      return;
    }
    
    // Get the cookie button gizmo position
    const gizmoPos = this.props.cookieButtonGizmo.position.get();
    const gizmoForward = this.props.cookieButtonGizmo.forward.get();
    
    // Position camera IN FRONT of the gizmo (along its forward direction)
    // NoesisUI renders on the front face of the gizmo
    const cameraDistance = .70; // Close to cookie
    const cameraPos = gizmoPos.add(gizmoForward.mul(cameraDistance));
    
    // Calculate rotation to look back at the gizmo
    const directionToGizmo = gizmoPos.sub(cameraPos).normalize();
    const cameraRot = Quaternion.lookRotation(directionToGizmo, Vec3.up);
    
    log.info(`Gizmo at: ${gizmoPos.toString()}, forward: ${gizmoForward.toString()}`);
    log.info(`Camera at: ${cameraPos.toString()}, looking at gizmo`);
    
    // Set camera to fixed mode facing the cookie button
    LocalCamera.setCameraModeFixed({
      position: cameraPos,
      rotation: cameraRot,
    });
    
    // Disable perspective switching
    LocalCamera.perspectiveSwitchingEnabled.set(false);
    
    log.info("Entering focused interaction mode");
    
    // Enter focused interaction mode permanently
    // disableFocusExitButton: true prevents the player from ever exiting
    this.localPlayer.enterFocusedInteractionMode({
      disableFocusExitButton: true,
    });
    
    this.hasForcedInteraction = true;
    log.info("Camera set and focused interaction mode enabled");
  }
  // #endregion
}

Component.register(Default);
