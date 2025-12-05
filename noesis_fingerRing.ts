// Desktop Editor Setup: Attach to NoesisUI entity with FingerRing.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 2, Input Mode = No Interaction

// #region 📋 README
// Controller for the FingerRing Noesis overlay.
// The finger ring is now 100% XAML-driven - no TypeScript animation logic needed!
// All 8 fingers and the rotation animation are hardcoded in XAML for maximum performance.
// This script just initializes the NoesisGizmo.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import * as hz from "horizon/core";
import { NoesisGizmo } from "horizon/noesis";
import { Logger } from "./util_logger";

// #region 🏷️ Type Definitions
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_fingerRing");
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");

    // Get NoesisGizmo reference
    const noesisGizmo = this.entity.as(NoesisGizmo);

    if (!noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }

    // No dataContext needed - fingers are hardcoded in XAML for performance
    // The rotation animation runs entirely in XAML

    log.info("FingerRing initialized (100% XAML-driven, no TypeScript animation)");
  }
  // #endregion
}

hz.Component.register(Default);
