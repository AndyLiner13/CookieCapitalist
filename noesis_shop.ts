// Desktop Editor Setup: Attach to NoesisUI entity with Shop.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 5, Input Mode = Interactive blocking

// #region 📋 README
// Shop UI controller - manages upgrade cards and production timers.
// Handles upgrade purchases and client-side production timers.
// Visibility is controlled via LocalUIEvents.changePage (shop page only).
// #endregion

import * as hz from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import {
  PageType,
  GameEvents,
  UIEvents,
  UIEventPayload,
  LocalUIEvents,
  UPGRADE_CONFIGS,
  calculateUpgradeCost,
  formatPrice,
  formatTimeRemaining,
  getTier,
  getNextTierThreshold,
  getTierSpeedMultiplier,
  calculateCookiesPerCycle,
  formatRateDisplay,
} from "./util_gameData";

class Default extends hz.Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_shop");
  private noesisGizmo: NoesisGizmo | null = null;
  private dataContext: IUiViewModelObject = {};

  private cookies: number = 0;
  private cookiesPerClick: number = 1;
  private cookiesPerSecond: number = 0;
  private upgrades: { [upgradeId: string]: number } = {};

  private productionProgress: { [upgradeId: string]: number } = {};
  private lastTickTime: number = 0;
  private static readonly TICK_RATE_MS = 50;
  private static readonly PROGRESS_SYNC_INTERVAL_MS = 5000; // Sync progress every 5 seconds
  
  // Streak multiplier tracking
  private streakMultiplier: number = 1;
  private streakEndTime: number = 0;
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.inactive("start");

    this.noesisGizmo = this.entity.as(NoesisGizmo);
    if (!this.noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }

    // Initialize upgrades and production progress
    for (const config of UPGRADE_CONFIGS) {
      this.upgrades[config.id] = 0;
      this.productionProgress[config.id] = 0;
    }

    // Build initial shop data context
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;

    // Listen for page change events (shop page only)
    this.connectLocalBroadcastEvent(
      LocalUIEvents.changePage,
      (data: { page: PageType }) => this.onPageChange(data.page)
    );

    // Listen for state updates via NETWORK event (from Backend)
    this.connectNetworkBroadcastEvent(
      UIEvents.toClient,
      (data: UIEventPayload) => this.handleStateChanged(data)
    );
    
    // Listen for streak multiplier updates from cookie component
    this.connectLocalBroadcastEvent(
      LocalUIEvents.dunkMultiplier,
      (data: { multiplier: number; durationMs: number; isRefresh?: boolean }) => this.onStreakMultiplierUpdate(data)
    );

    // Start production timer tick
    this.lastTickTime = Date.now();
    this.async.setInterval(() => this.productionTick(), Default.TICK_RATE_MS);
    
    // Start progress sync interval (sends production progress to backend for saving)
    this.async.setInterval(() => this.syncProgressToBackend(), Default.PROGRESS_SYNC_INTERVAL_MS);

    // Start hidden until Shop tab is clicked
    this.noesisGizmo.setLocalEntityVisibility(false);

    log.info("Shop UI initialized");
  }
  // #endregion

  // #region 🎯 Main Logic
  private buildDataContext(): void {
    const log = this.log.inactive("buildDataContext");

    const upgradeData: { [key: string]: any } = {};
    for (const config of UPGRADE_CONFIGS) {
      const owned = this.upgrades[config.id] || 0;
      const cost = calculateUpgradeCost(config.baseCost, owned);
      const canAfford = this.cookies >= cost;
      const isMaxed = config.id === "clicker" && owned >= 24;
      const progress = this.productionProgress[config.id] || 0;

      const tier = getTier(owned);
      const speedMultiplier = getTierSpeedMultiplier(tier);
      const effectiveProductionTime = config.productionTimeMs / speedMultiplier;
      const timeRemainingMs = (1 - progress) * effectiveProductionTime;
      const isProducing = owned > 0;
      const nextTierThreshold = getNextTierThreshold(owned);
      const tierProgress = nextTierThreshold ? `${owned}/${nextTierThreshold}` : `${owned} MAX`;

      const actualCookiesPerCycle = calculateCookiesPerCycle(config.cookiesPerCycle, owned);

      upgradeData[config.id] = {
        name: config.name,
        owned: owned.toString(),
        price: isMaxed ? "MAXED OUT" : formatPrice(cost),
        canAfford: isMaxed ? false : canAfford,
        isMaxed: isMaxed,
        buyCommand: () => this.purchaseUpgrade(config.id),
        progress: progress,
        progressWidth: Math.min(240, Math.round(progress * 240)),
        timeRemaining: formatTimeRemaining(timeRemainingMs),
        isProducing: isProducing,
        rateDisplay: isProducing ? formatRateDisplay(actualCookiesPerCycle) : config.rateDisplay,
        tier: tier,
        tierProgress: tierProgress,
        speedMultiplier: `${speedMultiplier}x`,
      };
    }

    this.dataContext = {
      clicker: upgradeData["clicker"],
      grandma: upgradeData["grandma"],
      farm: upgradeData["farm"],
      factory: upgradeData["factory"],
      lab: upgradeData["lab"],
      fab: upgradeData["fab"],
      planet: upgradeData["planet"],
      galaxy: upgradeData["galaxy"],
      onShopInteraction: () => this.resetFocusedInteraction(),
    };

    log.info("Shop dataContext initialized");
  }

  private updateShopData(): void {
    const log = this.log.inactive("updateShopData");

    for (const config of UPGRADE_CONFIGS) {
      const owned = this.upgrades[config.id] || 0;
      const cost = calculateUpgradeCost(config.baseCost, owned);
      const canAfford = this.cookies >= cost;
      const isMaxed = config.id === "clicker" && owned >= 24;
      const progress = this.productionProgress[config.id] || 0;

      const tier = getTier(owned);
      const speedMultiplier = getTierSpeedMultiplier(tier);
      const effectiveProductionTime = config.productionTimeMs / speedMultiplier;
      const timeRemainingMs = (1 - progress) * effectiveProductionTime;
      const isProducing = owned > 0;
      const nextTierThreshold = getNextTierThreshold(owned);
      const tierProgress = nextTierThreshold ? `${owned}/${nextTierThreshold}` : `${owned} MAX`;

      const actualCookiesPerCycle = calculateCookiesPerCycle(config.cookiesPerCycle, owned);

      const upgradeObj = this.dataContext[config.id] as any;
      if (upgradeObj) {
        upgradeObj.owned = owned.toString();
        upgradeObj.price = isMaxed ? "MAXED OUT" : formatPrice(cost);
        upgradeObj.canAfford = isMaxed ? false : canAfford;
        upgradeObj.isMaxed = isMaxed;
        upgradeObj.progress = progress;
        upgradeObj.progressWidth = Math.min(240, Math.round(progress * 240));
        upgradeObj.timeRemaining = formatTimeRemaining(timeRemainingMs);
        upgradeObj.isProducing = isProducing;
        upgradeObj.rateDisplay = isProducing ? formatRateDisplay(actualCookiesPerCycle) : config.rateDisplay;
        upgradeObj.tier = tier;
        upgradeObj.tierProgress = tierProgress;
        upgradeObj.speedMultiplier = `${speedMultiplier}x`;
      }
    }

    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }

    log.info("Shop data updated");
  }

  private productionTick(): void {
    const log = this.log.inactive("productionTick");

    const now = Date.now();
    const deltaTime = now - this.lastTickTime;
    this.lastTickTime = now;

    let dataChanged = false;

    for (const config of UPGRADE_CONFIGS) {
      const owned = this.upgrades[config.id] || 0;
      if (owned <= 0) continue;

      const tier = getTier(owned);
      const speedMultiplier = getTierSpeedMultiplier(tier);
      const effectiveProductionTime = config.productionTimeMs / speedMultiplier;

      const progressIncrement = deltaTime / effectiveProductionTime;
      this.productionProgress[config.id] = (this.productionProgress[config.id] || 0) + progressIncrement;

      if (this.productionProgress[config.id] >= 1) {
        const baseCookiesEarned = calculateCookiesPerCycle(config.cookiesPerCycle, owned);
        
        // Apply streak multiplier if active
        const activeMultiplier = this.getActiveStreakMultiplier();
        const cookiesEarned = baseCookiesEarned * activeMultiplier;

        this.sendNetworkBroadcastEvent(GameEvents.toServer, {
          type: "production_complete",
          upgradeId: config.id,
          cookies: cookiesEarned,
        });

        this.sendLocalBroadcastEvent(LocalUIEvents.batchComplete, {
          cookies: cookiesEarned,
        });

        this.productionProgress[config.id] = this.productionProgress[config.id] - 1;
      }

      const upgradeObj = this.dataContext[config.id] as any;
      if (upgradeObj) {
        const progress = this.productionProgress[config.id];
        const timeRemainingMs = (1 - progress) * effectiveProductionTime;
        upgradeObj.progress = progress;
        upgradeObj.progressWidth = Math.min(240, Math.round(progress * 240));
        upgradeObj.timeRemaining = formatTimeRemaining(timeRemainingMs);
        upgradeObj.isProducing = true;
        dataChanged = true;
      }
    }

    if (dataChanged && this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
    }
  }

  private handleStateChanged(data: UIEventPayload): void {
    const log = this.log.inactive("handleStateChanged");

    if (data.type !== "state_update" && data.type !== "state_with_progress") return;

    this.cookies = (data.cookies as number) || 0;
    this.cookiesPerClick = (data.cookiesPerClick as number) || 1;
    this.cookiesPerSecond = (data.cps as number) || 0;

    if (data.upgrades) {
      for (const [id, count] of Object.entries(data.upgrades as { [key: string]: number })) {
        this.upgrades[id] = count;
      }
    }
    
    // Restore upgrade progress if provided (from server load)
    if (data.type === "state_with_progress" && data.upgradeProgress) {
      for (const [id, progress] of Object.entries(data.upgradeProgress as { [key: string]: number })) {
        this.productionProgress[id] = progress;
      }
      log.info(`Restored upgrade progress from server: ${JSON.stringify(this.productionProgress)}`);
    }

    this.updateShopData();

    log.info("Shop state updated from backend");
  }

  private onPageChange(page: PageType): void {
    const log = this.log.inactive("onPageChange");

    if (!this.noesisGizmo) return;

    const isVisible = page === "shop";
    this.noesisGizmo.setLocalEntityVisibility(isVisible);

    log.info(`Shop visibility: ${isVisible}`);
  }
  // #endregion

  // #region 🎬 Handlers
  private purchaseUpgrade(upgradeId: string): void {
    const log = this.log.inactive("purchaseUpgrade");
    log.info(`Purchasing upgrade: ${upgradeId}`);

    this.sendNetworkBroadcastEvent(GameEvents.toServer, {
      type: "buy_upgrade",
      upgradeId: upgradeId,
    });
  }
  // Note: We no longer reset focused interaction on each purchase so
  // rapid buy clicks behave like cookie clicks without extra delay.
  
  private onStreakMultiplierUpdate(data: { multiplier: number; durationMs: number; isRefresh?: boolean }): void {
    const log = this.log.inactive("onStreakMultiplierUpdate");
    
    this.streakMultiplier = data.multiplier;
    this.streakEndTime = Date.now() + data.durationMs;
    
    log.info(`Streak multiplier updated: ${data.multiplier}x for ${data.durationMs}ms`);
  }
  
  // Returns the active streak multiplier, or 1 if streak has expired
  private getActiveStreakMultiplier(): number {
    const now = Date.now();
    if (now < this.streakEndTime && this.streakMultiplier > 1) {
      return this.streakMultiplier;
    }
    return 1;
  }
  
  // Sync production progress to backend for saving
  private syncProgressToBackend(): void {
    const log = this.log.inactive("syncProgressToBackend");
    
    // Only sync if we have any progress to sync
    const hasProgress = Object.values(this.productionProgress).some(p => p > 0);
    if (!hasProgress) return;
    
    this.sendNetworkBroadcastEvent(GameEvents.toServer, {
      type: "sync_progress",
      progress: this.productionProgress,
    });
    
    log.info(`Synced progress to backend: ${JSON.stringify(this.productionProgress)}`);
  }
  // #endregion
}

hz.Component.register(Default);
