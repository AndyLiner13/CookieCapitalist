// Desktop Editor Setup: Attach to Empty Object entity. Use Local execution mode.

// #region 📋 README
// SFX Controller - Centralized sound effect handler for Cookie Clicker.
// This controller handles all game sound effects and provides a single point
// of configuration for audio assets.
// 
// All SFX are configured via entity props (drag-and-drop in Desktop Editor).
// Call the public methods to play sounds from other scripts.
// #endregion

import * as hz from "horizon/core";
import { Logger } from "./util_logger";

// #region 🏷️ Type Definitions
// #endregion

export class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    // Navigation sound (for UI button clicks, menu navigation)
    navigationSfx: { type: hz.PropTypes.Entity },
    
    // Purchase sound (for buying upgrades)
    buySfx: { type: hz.PropTypes.Entity },
    
    // Cookie click sounds (5 variants for random selection)
    cookieClickSfx1: { type: hz.PropTypes.Entity },
    cookieClickSfx2: { type: hz.PropTypes.Entity },
    cookieClickSfx3: { type: hz.PropTypes.Entity },
    cookieClickSfx4: { type: hz.PropTypes.Entity },
    cookieClickSfx5: { type: hz.PropTypes.Entity },
    
    // Dunk sound (cookie dunking in milk)
    dunkSfx: { type: hz.PropTypes.Entity },
    
    // Swipe sound (gesture at start of dunk animation)
    swipeSfx: { type: hz.PropTypes.Entity },
    
    // Error sound (insufficient cookies)
    errorSfx: { type: hz.PropTypes.Entity },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("controller_sfx");
  
  // Singleton reference for easy access from other scripts
  private static instance: Default | null = null;
  // #endregion

  // #region 🔄 Lifecycle Events
  preStart() {
    const log = this.log.active("preStart");
    log.info("SFX Controller initializing");
    
    // Set singleton instance
    Default.instance = this;
  }

  start() {
    const log = this.log.active("start");
    log.info("SFX Controller ready");
  }
  // #endregion

  // #region 🔌 Public API
  /**
   * Get the singleton instance of the SFX controller
   * @returns The SFX controller instance, or null if not initialized
   */
  public static getInstance(): Default | null {
    return Default.instance;
  }

  /**
   * Play navigation SFX (UI clicks, menu navigation)
   * @param player - Optional. If provided, only plays for this player
   */
  public playNavigation(player?: hz.Player): void {
    const log = this.log.active("playNavigation");
    this.playSfx(this.props.navigationSfx, "Navigation", player, log);
  }

  /**
   * Play buy SFX (purchase confirmation)
   * @param player - Optional. If provided, only plays for this player
   */
  public playBuy(player?: hz.Player): void {
    const log = this.log.active("playBuy");
    this.playSfx(this.props.buySfx, "Buy", player, log);
  }

  /**
   * Play cookie click SFX (randomly selects from 5 variants)
   * @param player - Optional. If provided, only plays for this player
   */
  public playCookieClick(player?: hz.Player): void {
    const log = this.log.active("playCookieClick");
    
    // Collect all configured cookie click sounds
    const cookieClickSounds = [
      this.props.cookieClickSfx1,
      this.props.cookieClickSfx2,
      this.props.cookieClickSfx3,
      this.props.cookieClickSfx4,
      this.props.cookieClickSfx5,
    ].filter(sfx => sfx !== null && sfx !== undefined);
    
    // If no sounds configured, warn and return
    if (cookieClickSounds.length === 0) {
      log.warn("No cookie click sounds configured");
      return;
    }
    
    // Randomly select one of the configured sounds
    const randomIndex = Math.floor(Math.random() * cookieClickSounds.length);
    const selectedSfx = cookieClickSounds[randomIndex];
    
    this.playSfx(selectedSfx, `Cookie Click #${randomIndex + 1}`, player, log);
  }

  // Play swipe SFX (gesture starting dunk animation)
  public playSwipe(player?: hz.Player): void {
    const log = this.log.active("playSwipe");
    this.playSfx(this.props.swipeSfx, "Swipe", player, log);
  }

  /**
   * Play dunk SFX (cookie dunking in milk)
   * @param player - Optional. If provided, only plays for this player
   */
  public playDunk(player?: hz.Player): void {
    const log = this.log.active("playDunk");
    this.playSfx(this.props.dunkSfx, "Dunk", player, log);
  }

  /**
   * Play error SFX (insufficient cookies, invalid action)
   * @param player - Optional. If provided, only plays for this player
   */
  public playError(player?: hz.Player): void {
    const log = this.log.active("playError");
    this.playSfx(this.props.errorSfx, "Error", player, log);
  }
  // #endregion

  // #region 🛠️ Helper Methods
  /**
   * Internal helper to play a sound effect
   * @param sfxEntity - The entity containing the AudioGizmo
   * @param sfxName - Name for logging purposes
   * @param player - Optional player to play sound for
   * @param log - Logger instance
   */
  private playSfx(
    sfxEntity: hz.Entity | null | undefined,
    sfxName: string,
    player: hz.Player | undefined,
    log: ReturnType<Logger["active"]>
  ): void {
    if (!sfxEntity) {
      log.warn(`${sfxName} SFX entity not configured`);
      return;
    }

    const audioGizmo = sfxEntity.as(hz.AudioGizmo);
    if (!audioGizmo) {
      log.error(`${sfxName} entity is not an AudioGizmo`);
      return;
    }

    // For global sounds, we need to ensure they play for all players
    // Use empty options to play globally
    audioGizmo.play();
    log.info(`${sfxName} played globally`);
  }
  // #endregion
}

hz.Component.register(Default);
