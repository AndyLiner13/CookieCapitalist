// Desktop Editor Setup: Attach to NoesisUI entity with Background.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 0, Input Mode = No Interaction

// #region 📋 README
// Simple background overlay - no logic needed, just displays the blue gradient.
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
  private log = new Logger("noesis_background");
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");
    
    const noesisGizmo = this.entity.as(NoesisGizmo);
    if (!noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }
    
    log.info("Background overlay initialized (Render Order: 0)");
  }
  // #endregion
}

hz.Component.register(Default);
