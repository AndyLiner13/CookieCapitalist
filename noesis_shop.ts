// Desktop Editor Setup: Attach to NoesisUI entity with Shop.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 5, Input Mode = Interactive nonblocking

// #region 📋 README
// Controller for the Shop overlay.
// Shows upgrade items that can be purchased.
// Visibility controlled by page navigation events.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import * as hz from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import {
  PageType,
  GameEventPayload,
  UIEventPayload,
  GameEvents,
  UIEvents,
  LocalUIEvents,
  UPGRADE_CONFIGS,
  calculateUpgradeCost,
  formatPrice,
} from "./util_gameData";

// #region 🏷️ Type Definitions
// #endregion

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_shop");
  private noesisGizmo: NoesisGizmo | null = null;
  private dataContext: IUiViewModelObject = {};
  
  // Current page visibility
  private isVisible: boolean = false;
  
  // Cached game state
  private cookies: number = 0;
  private upgrades: { [upgradeId: string]: number } = {};
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");

    this.noesisGizmo = this.entity.as(NoesisGizmo);
    if (!this.noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }
    
    // Initialize upgrades map
    for (const config of UPGRADE_CONFIGS) {
      this.upgrades[config.id] = 0;
    }

    // Listen for state updates from game manager
    this.connectNetworkBroadcastEvent(
      UIEvents.toClient,
      (data: UIEventPayload) => this.handleManagerEvent(data)
    );
    
    // Listen for page change events
    this.connectLocalBroadcastEvent(
      LocalUIEvents.changePage,
      (data: { page: PageType }) => this.onPageChange(data.page)
    );

    // Build initial UI (hidden by default)
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;

    log.info("Shop overlay initialized (Render Order: 5)");
  }
  // #endregion

  // #region 🎯 Main Logic
  private buildDataContext(): void {
    // Build individual upgrade objects (not an array - Noesis works better with named properties)
    const upgradeData: { [key: string]: any } = {};
    
    for (const config of UPGRADE_CONFIGS) {
      const owned = this.upgrades[config.id] || 0;
      const cost = calculateUpgradeCost(config.baseCost, owned);
      const canAfford = this.cookies >= cost;
      
      upgradeData[config.id] = {
        name: config.name,
        owned: owned.toString(),
        price: formatPrice(cost),
        canAfford: canAfford,
        buyCommand: () => this.purchaseUpgrade(config.id),
      };
    }
    
    this.dataContext = {
      isVisible: this.isVisible,
      // Individual upgrade objects by id
      clicker: upgradeData["clicker"],
      grandma: upgradeData["grandma"],
      farm: upgradeData["farm"],
      factory: upgradeData["factory"],
      lab: upgradeData["lab"],
      fab: upgradeData["fab"],
      planet: upgradeData["planet"],
    };
  }
  
  private onPageChange(page: PageType): void {
    const log = this.log.inactive("onPageChange");
    const wasVisible = this.isVisible;
    this.isVisible = page === "shop";
    
    if (wasVisible !== this.isVisible) {
      log.info(`Shop visibility: ${this.isVisible}`);
      this.updateUI();
    }
  }
  
  private handleManagerEvent(data: UIEventPayload): void {
    const log = this.log.inactive("handleManagerEvent");
    
    if (data.type === "state_update") {
      this.cookies = (data.cookies as number) || 0;
      
      // Update upgrades
      if (data.upgrades) {
        for (const [id, count] of Object.entries(data.upgrades as { [key: string]: number })) {
          this.upgrades[id] = count;
        }
      }
      
      this.updateUI();
    }
  }
  
  private purchaseUpgrade(upgradeId: string): void {
    const log = this.log.active("purchaseUpgrade");
    log.info(`Purchasing upgrade: ${upgradeId}`);
    
    this.sendNetworkBroadcastEvent(GameEvents.toServer, {
      type: "buy_upgrade",
      upgradeId: upgradeId,
    });
  }
  
  private updateUI(): void {
    if (!this.noesisGizmo) return;
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;
  }
  // #endregion
}

hz.Component.register(Default);
