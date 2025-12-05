// Desktop Editor Setup: Attach to Empty Object entity. Use Local execution mode.
// #region 📋 README
// Local controller for each player.
// Forces interaction mode on mobile to hide thumbstick/jump button.
// Must use Local execution mode - runs on each player's client.
// #endregion

import * as hz from "horizon/core";
import { Logger } from "./util_logger";

// #region 🏷️ Type Definitions
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("controller_player");
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

    // Force interaction mode immediately - hides thumbstick/jump on mobile
    localPlayer.enterFocusedInteractionMode({
      disableFocusExitButton: true,
    });

    log.info("Forced interaction mode enabled");
  }
  // #endregion
}

hz.Component.register(Default);
