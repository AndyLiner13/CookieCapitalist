// Desktop Editor Setup: Attach to NoesisUI entity with FingerRing.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 2, Input Mode = No Interaction

// #region 📋 README
// Controller for the FingerRing Noesis overlay.
// Manages the rotating ring of clicking fingers around the cookie.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import * as hz from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";

// #region 🏷️ Type Definitions
const FINGER_COUNT = 24;
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    // Time between starting each finger click in the cascade (ms)
    fingerCascadeIntervalMs: { type: hz.PropTypes.Number, default: 60 },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_fingerRing");
  private noesisGizmo: NoesisGizmo | null = null;
  private dataContext: IUiViewModelObject = {};
  
  // Finger ring state - which finger is currently "clicking"
  private activeFingerIndex: number = 0;
  private fingerClickStates: boolean[] = new Array(FINGER_COUNT).fill(false);
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");

    // Get NoesisGizmo reference
    this.noesisGizmo = this.entity.as(NoesisGizmo);

    if (!this.noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }

    // Build and set initial data context
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;

    // Start sequential finger click animation loop
    this.startFingerClickLoop();

    log.info("FingerRing gizmo initialized");
  }
  // #endregion

  // #region 🎯 Main Logic
  private buildDataContext(): void {
    this.dataContext = {
      fingerPositions: this.generateFingerPositions(FINGER_COUNT, 150),
    };
  }

  // Generate finger positions around a circle
  // Returns array of {left, top, rotation, isClicking} for each finger
  private generateFingerPositions(count: number, radius: number): Array<{left: number; top: number; rotation: number; isClicking: boolean}> {
    const positions: Array<{left: number; top: number; rotation: number; isClicking: boolean}> = [];
    const centerX = 168 - 18; // Canvas center (336/2) minus half finger width (36/2)
    const centerY = 168 - 18;

    for (let i = 0; i < count; i++) {
      const angleDegrees = (i * 360) / count;
      const angleRadians = (angleDegrees * Math.PI) / 180;

      // Position on circle (0° is at bottom, going clockwise)
      const left = centerX + radius * Math.sin(angleRadians);
      const top = centerY + radius * Math.cos(angleRadians);

      // Rotation to point finger toward center (opposite of position angle)
      const rotation = -angleDegrees;

      // This finger is currently in its click animation if its state flag is true
      const isClicking = this.fingerClickStates[i] || false;

      positions.push({ left, top, rotation, isClicking });
    }

    return positions;
  }

  // Start loop that advances which finger is currently "clicking"
  private startFingerClickLoop(): void {
    // Advance active finger index in a simple endless loop
    this.async.setInterval(() => {
      if (!this.noesisGizmo) return;

      // Step in the opposite direction around the ring
      this.activeFingerIndex = (this.activeFingerIndex - 1 + FINGER_COUNT) % FINGER_COUNT;
      const index = this.activeFingerIndex;

      // Trigger click animation for this finger by toggling isClicking true then false
      this.fingerClickStates[index] = true;
      this.updateFingerPositions();

      // Immediately set back to false on next frame so the trigger can fire again next cycle
      this.async.setTimeout(() => {
        this.fingerClickStates[index] = false;
        // No need to updateFingerPositions here - the animation is already running
      }, 1);
    }, this.props.fingerCascadeIntervalMs);
  }

  // Update just the finger positions without rebuilding the full data context
  private updateFingerPositions(): void {
    if (!this.noesisGizmo) return;
    this.dataContext.fingerPositions = this.generateFingerPositions(FINGER_COUNT, 150);
    this.noesisGizmo.dataContext = this.dataContext;
  }
  // #endregion
}

hz.Component.register(Default);
