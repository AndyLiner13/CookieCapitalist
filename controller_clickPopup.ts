// Desktop Editor Setup: Attach to any entity. Pre-spawn Text Gizmos with tag "textGizmo" in the scene.

// #region 📋 README
// Controller for managing a pool of pre-spawned Text Gizmos.
// Shows +# popup text when player clicks the cookie.
// Each text gizmo is positioned in front of the player, floats up, then returns to pool.
// Must use Local execution mode - runs on each player's client independently.
// #endregion

import { Component, PropTypes, Entity, TextGizmo, Vec3, Player } from "horizon/core";
import { Logger } from "./util_logger";
import { UIEvents, UIEventPayload } from "./util_gameData";

// #region 🏷️ Type Definitions
type PooledTextGizmo = {
  entity: Entity;
  gizmo: TextGizmo;
  inUse: boolean;
};
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    floatDistance: { type: PropTypes.Number, default: 0.5 },
    floatDuration: { type: PropTypes.Number, default: 0.8 },
    spawnDistance: { type: PropTypes.Number, default: 2.0 },
    textGizmoTag: { type: PropTypes.String, default: "textGizmo" },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("controller_clickPopup");
  private textGizmoPool: PooledTextGizmo[] = [];
  private localPlayer: Player | null = null;
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");
    
    // Get local player reference
    this.localPlayer = this.world.getLocalPlayer();
    
    // Find all text gizmos with the specified tag
    const textEntities = this.world.getEntitiesWithTags([this.props.textGizmoTag]);
    
    if (textEntities.length === 0) {
      log.error(`No entities found with tag "${this.props.textGizmoTag}"`);
      return;
    }
    
    // Initialize pool with all found text gizmos
    for (const entity of textEntities) {
      const gizmo = entity.as(TextGizmo);
      if (gizmo) {
        // Hide initially by moving far away
        entity.position.set(new Vec3(0, -1000, 0));
        gizmo.text.set("");
        
        this.textGizmoPool.push({
          entity,
          gizmo,
          inUse: false,
        });
      }
    }
    
    log.info(`Initialized pool with ${this.textGizmoPool.length} text gizmos`);
    
    // Listen for click popup events from the UI
    this.connectNetworkBroadcastEvent(
      UIEvents.showClickPopup,
      (data: UIEventPayload) => {
        this.showPopup(data.text as string);
      }
    );
  }
  // #endregion

  // #region 🎯 Main Logic
  private showPopup(text: string): void {
    const log = this.log.active("showPopup");
    
    if (!this.localPlayer) {
      log.warn("No local player available");
      return;
    }
    
    // Find an available text gizmo from the pool
    const available = this.textGizmoPool.find(item => !item.inUse);
    
    if (!available) {
      log.warn("No available text gizmos in pool");
      return;
    }
    
    // Mark as in use
    available.inUse = true;
    
    // Calculate spawn position in front of player's head with random offset
    const headPos = this.localPlayer.head.position.get();
    const headForward = this.localPlayer.head.forward.get();
    const headUp = this.localPlayer.head.up.get();
    
    // Random horizontal offset (-0.3 to 0.3)
    const randomOffsetX = (Math.random() - 0.5) * 0.6;
    const randomOffsetY = (Math.random() - 0.5) * 0.3;
    
    // Calculate right vector from forward and up
    const right = headForward.cross(headUp).normalize();
    
    // Position: in front of head + random offset
    const spawnPos = headPos
      .add(headForward.mul(this.props.spawnDistance))
      .add(right.mul(randomOffsetX))
      .add(headUp.mul(randomOffsetY));
    
    // Set text and position
    available.gizmo.text.set(text);
    available.entity.position.set(spawnPos);
    
    // Animate floating up
    this.animateFloat(available, spawnPos, headUp);
  }
  
  private animateFloat(item: PooledTextGizmo, startPos: Vec3, upDirection: Vec3): void {
    const log = this.log.inactive("animateFloat");
    
    const duration = this.props.floatDuration * 1000; // Convert to ms
    const floatDistance = this.props.floatDistance;
    const startTime = Date.now();
    
    // Animation loop
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out curve for smooth deceleration
      const easedProgress = 1 - Math.pow(1 - progress, 2);
      
      // Move up along the up direction
      const currentPos = startPos.add(upDirection.mul(floatDistance * easedProgress));
      item.entity.position.set(currentPos);
      
      if (progress < 1) {
        // Continue animation
        this.async.setTimeout(animate, 16); // ~60fps
      } else {
        // Animation complete - return to pool
        this.returnToPool(item);
      }
    };
    
    animate();
  }
  
  private returnToPool(item: PooledTextGizmo): void {
    const log = this.log.inactive("returnToPool");
    
    // Hide by moving far away and clearing text
    item.entity.position.set(new Vec3(0, -1000, 0));
    item.gizmo.text.set("");
    item.inUse = false;
    
    log.info("Text gizmo returned to pool");
  }
  // #endregion
}

Component.register(Default);
