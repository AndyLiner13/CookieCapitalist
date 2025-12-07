// Desktop Editor Setup: Attach to NoesisUI entity with WelcomeBack.xaml. Use Shared execution mode.

// #region 📋 README
// WelcomeBack modal controller - displays offline earnings when a player rejoins.
// Listens for welcome_back UI events from Backend and shows/hides the modal.
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import { Component } from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import { UIEvents, UIEventPayload, formatNumber } from "./util_gameData";

class Default extends Component<typeof Default> {
	// #region ⚙️ Props
	static propsDefinition = {};
	// #endregion

	// #region 📊 State
	private log = new Logger("noesis_welcomeBack");
	private noesisGizmo: NoesisGizmo | null = null;
	private dataContext: IUiViewModelObject = {};
	// #endregion

	// #region 🔄 Lifecycle Events
	start(): void {
		const log = this.log.active("start");

		this.noesisGizmo = this.entity.as(NoesisGizmo);
		if (!this.noesisGizmo) {
			log.error("Entity is not a NoesisGizmo!");
			return;
		}

		// Initial data context; values here are mostly placeholders for runtime
		this.buildDataContext();
		this.noesisGizmo.dataContext = this.dataContext;

		// Listen for welcome_back events from backend
		this.connectNetworkBroadcastEvent(
			UIEvents.toClient,
			(data: UIEventPayload) => {
				log.info(`Received UIEvent: type=${data.type}`);
				this.handleWelcomeBackData(data);
			}
		);

		log.info("WelcomeBack controller initialized");
	}
	// #endregion

	// #region 🎯 Main Logic
	private buildDataContext(): void {
		const log = this.log.inactive("buildDataContext");

		this.dataContext = {
			isVisible: false,
			timeAway: "0s",
			cookiesEarned: "0",
			onCollect: () => this.onCollect(),
		};

		log.info("DataContext created for WelcomeBack modal");
	}
	// #endregion

	// #region 🎬 Handlers
	private handleWelcomeBackData(data: UIEventPayload): void {
		const log = this.log.active("handleWelcomeBackData");

		if (data.type !== "welcome_back") {
			return;
		}

		const offlineCookies = (data.offlineCookies as number) || 0;
		const timeAwayMs = (data.timeAwayMs as number) || 0;

		// Always show modal (even with 0 cookies for testing)
		const timeAwayFormatted = this.formatTimeAway(timeAwayMs);

		this.updateDataContext({
			isVisible: true,
			timeAway: timeAwayFormatted,
			cookiesEarned: formatNumber(offlineCookies),
		});

		log.info(`Showing WelcomeBack modal: ${offlineCookies} cookies over ${timeAwayFormatted}`);
	}

	private onCollect(): void {
		const log = this.log.active("onCollect");

		this.updateDataContext({ isVisible: false });
		log.info("WelcomeBack modal dismissed by player");
	}
	// #endregion

	// #region 🛠️ Helper Methods
	private formatTimeAway(ms: number): string {
		const log = this.log.inactive("formatTimeAway");

		// Handle zero, negative, or very small values
		if (ms <= 1000) {
			return "just now";
		}

		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);
		const weeks = Math.floor(days / 7);
		const months = Math.floor(days / 30);
		const years = Math.floor(days / 365);

		const parts: string[] = [];

		if (years > 0) parts.push(`${years}y`);
		if (months % 12 > 0) parts.push(`${months % 12}m`);
		if (weeks % 4 > 0) parts.push(`${weeks % 4}w`);
		if (days % 7 > 0) parts.push(`${days % 7}d`);
		if (hours % 24 > 0) parts.push(`${hours % 24}h`);
		if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
		if (seconds % 60 > 0 && parts.length < 3) parts.push(`${seconds % 60}s`);

		const result = parts.length > 0 ? parts.slice(0, 3).join(" ") : "0s";
		log.info(`Formatted timeAway: ${result}`);
		return result;
	}

	private updateDataContext(updates: Partial<IUiViewModelObject>): void {
		const log = this.log.inactive("updateDataContext");

		Object.assign(this.dataContext, updates);

		if (this.noesisGizmo) {
			this.noesisGizmo.dataContext = this.dataContext;
			log.info(`DataContext updated: ${JSON.stringify(updates)}`);
		}
	}
	// #endregion
}

Component.register(Default);


