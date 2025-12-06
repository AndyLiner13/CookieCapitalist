// Desktop Editor Setup: Attach to NoesisUI entity with Overlay.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 10, Input Mode = Interactive nonblocking

// #region 📋 README
// Overlay controller - combines Header and Navigation.
// Displays cookie count/CPS at top, navigation tabs at bottom.
// Broadcasts page change events to CoreGame and other overlays.
// Receives state updates via NETWORK events from Backend.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import { Component, PropTypes, Entity, Vec3, Quaternion } from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import LocalCamera from "horizon/camera";
import { Logger } from "./util_logger";
import {
  PageType,
  UIEvents,
  UIEventPayload,
  LocalUIEvents,
  formatCookieDisplay,
  formatCPSDisplay,
} from "./util_gameData";

// #region 🏷️ Type Definitions
// Hidden position for leaderboard (world origin, out of view)
const LEADERBOARD_HIDDEN_POS = new Vec3(0, -100, 0);
// Distance in front of camera when visible
const LEADERBOARD_DISTANCE_FROM_CAMERA = 1.23; // 2 meters in front of camera
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {
    leaderboardGizmo: { type: PropTypes.Entity },
  };
  // #endregion

  // #region 📊 State
  private log = new Logger("noesis_overlay");
  private noesisGizmo: NoesisGizmo | null = null;
  private dataContext: IUiViewModelObject = {};
  private leaderboardGizmo: Entity | null = null;
  
  // Current page
  private currentPage: PageType = "home";
  
  // Cached game state for header
  private cookies: number = 0;
  private cookiesPerSecond: number = 0;
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");

    this.noesisGizmo = this.entity.as(NoesisGizmo);
    if (!this.noesisGizmo) {
      log.error("Entity is not a NoesisGizmo!");
      return;
    }

    // Cache leaderboard gizmo (optional) and hide it on start
    this.leaderboardGizmo = this.props.leaderboardGizmo || null;
    log.info(`Leaderboard prop value: ${this.leaderboardGizmo ? "SET" : "NULL"}`);
    if (this.leaderboardGizmo) {
      const gizmoName = this.leaderboardGizmo.name.get();
      log.info(`Leaderboard gizmo found: ${gizmoName} - will position dynamically based on camera`);
      
      // Move leaderboard to hidden position on start
      this.leaderboardGizmo.position.set(LEADERBOARD_HIDDEN_POS);
      log.info(`Leaderboard gizmo moved to hidden position: ${LEADERBOARD_HIDDEN_POS.toString()}`);
    } else {
      log.warn("leaderboardGizmo prop is NOT SET on overlay entity - cannot control leaderboard visibility");
    }

    // Listen for state updates via NETWORK event (from Backend)
    this.connectNetworkBroadcastEvent(
      UIEvents.toClient,
      (data: UIEventPayload) => this.handleStateChanged(data)
    );

    // Build and set initial data context (commands are set once here)
    this.buildDataContext();
    this.noesisGizmo.dataContext = this.dataContext;

    // Broadcast initial page so all gizmos set correct visibility
    this.async.setTimeout(() => {
      this.sendLocalBroadcastEvent(LocalUIEvents.changePage, { page: this.currentPage });
    }, 100);

    log.info("Overlay initialized (Header + Navigation)");
  }
  // #endregion

  // #region 🎯 Main Logic
  private buildDataContext(): void {
    // Commands are set once and reused - don't recreate them on updates!
    this.dataContext = {
      // Header data
      cookieCount: formatCookieDisplay(this.cookies),
      cookiesPerSecond: formatCPSDisplay(this.cookiesPerSecond),
      
      // Navigation commands (set once, never recreated)
      onShopClick: () => this.navigateToPage("shop"),
      onHomeClick: () => this.navigateToPage("home"),
      onStatsClick: () => this.navigateToPage("stats"),
    };
  }

  private navigateToPage(page: PageType): void {
    const log = this.log.active("navigateToPage");

    if (this.currentPage === page) {
      log.info(`Already on ${page} page`);
      return;
    }

    log.info(`Navigating from ${this.currentPage} to ${page}`);
    this.currentPage = page;

    // Broadcast page change to CoreGame and other overlays (Clickers, Background)
    this.sendLocalBroadcastEvent(LocalUIEvents.changePage, { page });

    // Toggle leaderboard gizmo position when changing pages
    if (this.leaderboardGizmo) {
      if (page === "stats") {
        // Get current camera position and forward direction
        const cameraPos = LocalCamera.position.get();
        const cameraForward = LocalCamera.forward.get();
        
        // Position leaderboard in front of camera
        const leaderboardPos = cameraPos.add(cameraForward.mul(LEADERBOARD_DISTANCE_FROM_CAMERA));
        
        // Rotate to face the same direction as camera (not back at it)
        const leaderboardRot = Quaternion.lookRotation(cameraForward, Vec3.up);
        
        this.leaderboardGizmo.position.set(leaderboardPos);
        this.leaderboardGizmo.rotation.set(leaderboardRot);
        log.info(`Leaderboard moved to visible position: ${leaderboardPos.toString()} (${LEADERBOARD_DISTANCE_FROM_CAMERA}m in front of camera)`);
      } else {
        // Move leaderboard to hidden position (world origin, underground)
        this.leaderboardGizmo.position.set(LEADERBOARD_HIDDEN_POS);
        log.info(`Leaderboard moved to hidden position: ${LEADERBOARD_HIDDEN_POS.toString()}`);
      }
    }
  }
  // #endregion

  // #region 🎬 Handlers
  private handleStateChanged(data: UIEventPayload): void {
    if (data.type !== "state_update") return;
    
    this.cookies = (data.cookies as number) || 0;
    this.cookiesPerSecond = (data.cps as number) || 0;
    this.updateUI();
  }
  // #endregion

  // #region 🛠️ Helper Methods
  private updateUI(): void {
    if (!this.noesisGizmo) return;
    
    // Only update header values - DON'T recreate commands!
    this.dataContext.cookieCount = formatCookieDisplay(this.cookies);
    this.dataContext.cookiesPerSecond = formatCPSDisplay(this.cookiesPerSecond);
    
    this.noesisGizmo.dataContext = this.dataContext;
  }
  // #endregion
}

Component.register(Default);
