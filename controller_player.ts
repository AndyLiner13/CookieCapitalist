// Desktop Editor Setup: Attach to Empty Object entity. Use Local execution mode.
// #region 📋 README
// Local controller assigned to each player when they join.
// Sets up focused interaction mode (removes thumbstick/jump button) for mobile UI gameplay.
// Uses Portrait Camera API to detect device orientation.
// All UI is now screen overlays - no raycast needed!
// Must use Local execution mode - runs on the owning player's client.
// #endregion

import * as hz from "horizon/core";
import LocalCamera from "horizon/camera";
import { PortraitCamera, CameraOrientation } from "horizon/portrait_camera";
import { Logger } from "./util_logger";

// #region 🏷️ Type Definitions
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("controller_player");
  private localPlayer: hz.Player | null = null;
  private hasForcedInteraction: boolean = false;
  private portraitCamera: PortraitCamera | null = null;
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");

    // Get local player and server player references
    this.localPlayer = this.world.getLocalPlayer();
    const serverPlayer = this.world.getServerPlayer();

    // Check if we're running on the server
    const isServer = this.localPlayer === serverPlayer;
    log.info(`isServer: ${isServer}`);

    if (isServer) {
      log.info("Running on server - waiting for ownership transfer to client");
      return;
    }

    // On client: check if this entity is already owned by the local player
    const owner = this.entity.owner.get();
    log.info(`owner: ${owner?.name?.get() ?? "null"}, localPlayer: ${this.localPlayer?.name?.get() ?? "null"}`);

    if (owner && owner === this.localPlayer) {
      log.info(`Player controller already owned by ${this.localPlayer.name.get()}`);
      this.setupInteraction();
    } else {
      log.info("Waiting for ownership transfer");
    }
  }

  // Called when ownership is transferred to this client
  receiveOwnership(
    _oldOwner: hz.Player,
    _newOwner: hz.Player,
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
      this.setupInteraction();
    }
  }

  // Called when ownership is transferred away from this client
  transferOwnership(
    _oldOwner: hz.Player,
    _newOwner: hz.Player
  ): {} {
    const log = this.log.active("transferOwnership");
    log.info("Ownership transferred away");
    return {};
  }
  // #endregion

  // #region 🎯 Main Logic
  // Set up focused interaction mode and portrait camera
  private setupInteraction(): void {
    const log = this.log.active("setupInteraction");

    if (!this.localPlayer) {
      log.warn("Cannot setup interaction - no local player");
      return;
    }

    if (this.hasForcedInteraction) {
      log.info("Already in focused interaction mode");
      return;
    }

    // Initialize Portrait Camera API for orientation detection
    this.portraitCamera = new PortraitCamera();
    const orientation = this.portraitCamera.currentOrientation.get();
    const isPortrait = orientation === CameraOrientation.Portrait;
    log.info(`Device orientation: ${isPortrait ? "Portrait" : "Landscape"}`);

    // Disable perspective switching (lock camera mode)
    LocalCamera.perspectiveSwitchingEnabled.set(false);

    // Enter focused interaction mode permanently
    // This removes the thumbstick and jump button on mobile
    // disableFocusExitButton: true prevents the player from ever exiting
    this.localPlayer.enterFocusedInteractionMode({
      disableFocusExitButton: true,
    });

    this.hasForcedInteraction = true;
    log.info("Focused interaction mode enabled - thumbstick/jump hidden, ready for UI clicks");
  }
  // #endregion
}

hz.Component.register(Default);
