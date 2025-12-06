// Desktop Editor Setup: Attach to NoesisUI entity with Leaderboard.xaml. Use Shared execution mode.
// NoesisUI Settings: Display Mode = Screen Overlay, Render Order = 5, Input Mode = Interactive blocking

// #region 📋 README
// Leaderboard UI controller - shows top scores and highlights the local player.
// Listens for state updates (cookies) and page navigation events.
// Visibility is controlled via LocalUIEvents.changePage (stats page only).
// #endregion

import * as hz from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import {
	PageType,
	UIEvents,
	UIEventPayload,
	LocalUIEvents,
	formatNumber,
} from "./util_gameData";

// #region 🏷️ Type Definitions
// #endregion

class Default extends hz.Component<typeof Default> {
	// #region ⚙️ Props
	static propsDefinition = {};
	// #endregion

	// #region 📊 State
	private log = new Logger("noesis_leaderboard");
	private noesisGizmo: NoesisGizmo | null = null;
	private dataContext: IUiViewModelObject = {};

	private cookies: number = 0;
	private playerName: string = "You";
	// #endregion

	// #region 🔄 Lifecycle Events
	start(): void {
		const log = this.log.active("start");

		this.noesisGizmo = this.entity.as(NoesisGizmo);
		if (!this.noesisGizmo) {
			log.error("Entity is not a NoesisGizmo!");
			return;
		}

		const localPlayer = this.world.getLocalPlayer();
		this.playerName = localPlayer?.name.get() || "You";

		// Listen for page change events (stats page only)
		this.connectLocalBroadcastEvent(
			LocalUIEvents.changePage,
			(data: { page: PageType }) => this.onPageChange(data.page)
		);

		// Listen for state updates via NETWORK event (from Backend)
		this.connectNetworkBroadcastEvent(
			UIEvents.toClient,
			(data: UIEventPayload) => this.handleStateChanged(data)
		);

		// Build initial leaderboard data
		this.buildDataContext();
		this.noesisGizmo.dataContext = this.dataContext;

		// Start hidden until Stats tab is clicked
		this.noesisGizmo.setLocalEntityVisibility(false);

		log.info("Leaderboard UI initialized");
	}
	// #endregion

	// #region 🎯 Main Logic
	private buildDataContext(): void {
		const log = this.log.inactive("buildDataContext");

		this.dataContext = {
			leaderboard1: {
				username: "Cookie Titan",
				score: "1.2B",
			},
			leaderboard2: {
				username: "Sugar Wizard",
				score: "850M",
			},
			leaderboard3: {
				username: "Dough Dev",
				score: "420M",
			},
			leaderboard4: {
				rank: "4",
				username: this.playerName,
				score: this.formatPlayerScore(),
			},
			leaderboard5: {
				username: "Crumb Collector",
				score: "10M",
			},
		};

		log.info("Leaderboard dataContext initialized");
	}

	private updateLeaderboard(): void {
		const log = this.log.inactive("updateLeaderboard");

		const youEntry = this.dataContext["leaderboard4"] as IUiViewModelObject;
		if (youEntry) {
			youEntry["username"] = this.playerName;
			youEntry["score"] = this.formatPlayerScore();
			youEntry["rank"] = youEntry["rank"] || "4";
		}

		if (this.noesisGizmo) {
			this.noesisGizmo.dataContext = this.dataContext;
		}

		log.info("Leaderboard updated from latest cookies state");
	}

	private formatPlayerScore(): string {
		const log = this.log.inactive("formatPlayerScore");
		const safeCookies = this.cookies || 0;
		const formatted = formatNumber(safeCookies);
		log.info(`Formatting player score: ${safeCookies} -> ${formatted}`);
		return `${formatted}`;
	}

	private onPageChange(page: PageType): void {
		const log = this.log.inactive("onPageChange");

		if (!this.noesisGizmo) return;

		const isVisible = page === "stats";
		this.noesisGizmo.setLocalEntityVisibility(isVisible);

		log.info(`Leaderboard visibility: ${isVisible}`);
	}
	// #endregion

	// #region 🎬 Handlers
	private handleStateChanged(data: UIEventPayload): void {
		const log = this.log.inactive("handleStateChanged");

		if (data.type !== "state_update") return;

		this.cookies = (data.cookies as number) || 0;
		this.updateLeaderboard();

		log.info("Leaderboard state updated from backend");
	}
	// #endregion
}

hz.Component.register(Default);


