// Desktop Editor Setup: Attach to each Text Gizmo entity. Use Default execution mode.
// Position the Text Gizmo in front of the cookie in the scene, facing the camera.

// #region 📋 README
// Controller for a single Text Gizmo in the click popup pool.
// Listens for popup events and displays the text at the gizmo's original position.
// Each text gizmo manages its own availability state.
// Text appears at its scene position, faces the camera, floats up, then hides.
// Uses Default (server) execution mode for single-player game.
// #endregion

import { Component, PropTypes, TextGizmo, Vec3, Player, Quaternion } from "horizon/core";
import { Logger } from "./util_logger";
import { UIEvents, UIEventPayload } from "./util_gameData";

// #region 🏷️ Type Definitions
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    displayDuration: { type: PropTypes.Number, default: 0.8 },
    floatDistance: { type: PropTypes.Number, default: 0.3 },
    cameraEntity: { type: PropTypes.Entity },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("controller_clickPopup");
  private textGizmo: TextGizmo | null = null;
  private inUse: boolean = false;
  private originalPosition: Vec3 = Vec3.zero;
  private originalRotation: Quaternion = Quaternion.identity;
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");
    
    // Get TextGizmo reference from this entity
    this.textGizmo = this.entity.as(TextGizmo);
    
    if (!this.textGizmo) {
      log.error("Entity is not a TextGizmo!");
      return;
    }
    
    // Store original position and rotation (where the gizmo is placed in the scene)
    this.originalPosition = this.entity.position.get();
    this.originalRotation = this.entity.rotation.get();
    log.info(`Original position: ${this.originalPosition.toString()}`);
    log.info(`Original rotation: ${this.originalRotation.toString()}`);
    
    // Clear text initially (but keep position)
    this.textGizmo.text.set("");
    
    // Listen for click popup events from the UI
    this.connectNetworkBroadcastEvent(
      UIEvents.showClickPopup,
      (data: UIEventPayload, fromPlayer: Player) => {
        this.showPopup(data.text as string, fromPlayer);
      }
    );
    
    log.info("Click popup text gizmo initialized");
  }
  // #endregion

  // #region 🎯 Main Logic
  private showPopup(text: string, player: Player): void {
    const log = this.log.active("showPopup");
    
    if (!this.textGizmo) {
      log.error("No textGizmo reference!");
      return;
    }
    
    // Skip if already showing text
    if (this.inUse) {
      log.info("Skipping - already in use");
      return;
    }
    
    // Mark as in use
    this.inUse = true;
    
    // Add small random offset to original position
    const randomOffsetX = (Math.random() - 0.5) * 0.4;
    const randomOffsetY = (Math.random() - 0.5) * 0.2;
    
    const spawnPos = this.originalPosition.add(new Vec3(randomOffsetX, randomOffsetY, 0));
    
    // Set position
    this.entity.position.set(spawnPos);
    
    // Make text face the camera/player
    // Get camera position (use cameraEntity prop if set, otherwise use player head)
    let cameraPos: Vec3;
    if (this.props.cameraEntity) {
      cameraPos = this.props.cameraEntity.position.get();
      log.info(`Using cameraEntity position: ${cameraPos.toString()}`);
    } else {
      cameraPos = player.head.position.get();
      log.info(`Using player head position: ${cameraPos.toString()}`);
    }
    
    // Look at camera position
    this.entity.lookAt(cameraPos, Vec3.up);
    log.info(`Text positioned at: ${spawnPos.toString()}, looking at: ${cameraPos.toString()}`);
    
    // Set text AFTER positioning
    this.textGizmo.text.set(text);
    log.info(`Text set to: "${text}"`);
    
    // Animate floating up
    this.animateFloat(spawnPos);
  }
  
  private animateFloat(startPos: Vec3): void {
    const log = this.log.inactive("animateFloat");
    
    const duration = this.props.displayDuration * 1000;
    const floatDistance = this.props.floatDistance;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out curve for smooth deceleration
      const easedProgress = 1 - Math.pow(1 - progress, 2);
      
      // Move up (Y axis is up in Horizon)
      const currentPos = startPos.add(new Vec3(0, floatDistance * easedProgress, 0));
      this.entity.position.set(currentPos);
      
      if (progress < 1) {
        this.async.setTimeout(animate, 16); // ~60fps
      } else {
        this.clearPopup();
      }
    };
    
    animate();
  }
  
  private clearPopup(): void {
    const log = this.log.inactive("clearPopup");
    
    if (this.textGizmo) {
      this.textGizmo.text.set("");
    }
    // Return to original position and rotation
    this.entity.position.set(this.originalPosition);
    this.entity.rotation.set(this.originalRotation);
    this.inUse = false;
    
    log.info("Popup cleared");
  }
  // #endregion
}

Component.register(Default);
