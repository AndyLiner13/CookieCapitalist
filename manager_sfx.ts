// Desktop Editor Setup: Attach to Empty Object entity. Use Default (server) execution mode.

// #region 📋 README
// SFX Manager - Centralized sound effect handler for Cookie Clicker.
// This manager handles all game sound effects and provides a single point
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
    
    // Cookie click sound
    cookieClickSfx: { type: hz.PropTypes.Entity },
    
    // Error sound (insufficient cookies)
    errorSfx: { type: hz.PropTypes.Entity },
    
    // Multiplier sounds (one for each tier)
    multiplier1Sfx: { type: hz.PropTypes.Entity },
    multiplier2Sfx: { type: hz.PropTypes.Entity },
    multiplier3Sfx: { type: hz.PropTypes.Entity },
    multiplier4Sfx: { type: hz.PropTypes.Entity },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("manager_sfx");
  
  // Singleton reference for easy access from other scripts
  private static instance: Default | null = null;
  // #endregion

  // #region 🔄 Lifecycle Events
  preStart() {
    const log = this.log.active("preStart");
    log.info("SFX Manager initializing");
    
    // Set singleton instance
    Default.instance = this;
  }

  start() {
    const log = this.log.active("start");
    log.info("SFX Manager ready");
  }
  // #endregion

  // #region 🔌 Public API
  /**
   * Get the singleton instance of the SFX manager
   * @returns The SFX manager instance, or null if not initialized
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
   * Play cookie click SFX
   * @param player - Optional. If provided, only plays for this player
   */
  public playCookieClick(player?: hz.Player): void {
    const log = this.log.inactive("playCookieClick");
    this.playSfx(this.props.cookieClickSfx, "Cookie Click", player, log);
  }

  /**
   * Play error SFX (insufficient cookies, invalid action)
   * @param player - Optional. If provided, only plays for this player
   */
  public playError(player?: hz.Player): void {
    const log = this.log.active("playError");
    this.playSfx(this.props.errorSfx, "Error", player, log);
  }

  /**
   * Play multiplier SFX based on tier (1-4)
   * @param tier - The multiplier tier (1, 2, 3, or 4)
   * @param player - Optional. If provided, only plays for this player
   */
  public playMultiplier(tier: number, player?: hz.Player): void {
    const log = this.log.active("playMultiplier");
    
    let sfxEntity: hz.Entity | null | undefined = null;
    let sfxName = "";
    
    switch (tier) {
      case 1:
        sfxEntity = this.props.multiplier1Sfx;
        sfxName = "Multiplier 1";
        break;
      case 2:
        sfxEntity = this.props.multiplier2Sfx;
        sfxName = "Multiplier 2";
        break;
      case 3:
        sfxEntity = this.props.multiplier3Sfx;
        sfxName = "Multiplier 3";
        break;
      case 4:
        sfxEntity = this.props.multiplier4Sfx;
        sfxName = "Multiplier 4";
        break;
      default:
        log.warn(`Invalid multiplier tier: ${tier}. Must be 1-4.`);
        return;
    }
    
    this.playSfx(sfxEntity, sfxName, player, log);
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

    const audioOptions: hz.AudioOptions | undefined = player
      ? { fade: 0, players: [player] }
      : undefined;

    audioGizmo.play(audioOptions);
    log.info(`${sfxName} played${player ? ` for player ${player.name.get()}` : " for all"}`);
  }
  // #endregion
}

hz.Component.register(Default);
