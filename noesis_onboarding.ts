// Desktop Editor Setup: Attach to NoesisUI entity with Onboarding.xaml. Use Shared execution mode.
// Display Mode: Screen Overlay, Render Order: 150, Input Mode: Interactive blocking

// #region 📋 README
// Onboarding controller - guides new players through the game UI with mascot and spotlight.
// Extended flow:
// 1. Intro chat bubbles (3 steps)
// 2. Header spotlight
// 3. Cookie tap tutorial (wait for first cookie, then 15 cookies)
// 4. Swipe down tutorial (dunk mechanic)
// 5. Multiplier challenge (reach 16x)
// 6. Admiration + Shop introduction
// Triggers when player has 0 cookies and 0 CPS (new player detection).
// Must use Shared execution mode for proper Noesis integration.
// #endregion

import { Component, PlayerDeviceType } from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";
import { Logger } from "./util_logger";
import { UIEvents, UIEventPayload, LocalUIEvents } from "./util_gameData";

// #region 🏷️ Type Definitions
// Focus state for each UI element
interface FocusState {
	header: boolean;
	cookie: boolean;
	milk: boolean;
	footer: boolean;
}

// Onboarding step configuration
interface OnboardingStep {
	id: string;
	chatText: string;
	showChatBubble: boolean;
	showTapPrompt: boolean;
	focus: FocusState;
	showSwipeAnimation: boolean;
	// Wait conditions (if set, step won't advance on tap)
	waitForCookies?: number;
	waitForMultiplier?: number;
	waitForMultiplierEnd?: boolean;
	waitForSwipeDown?: boolean;
}

// Helper to create focus state (all false by default)
const noFocus: FocusState = { header: false, cookie: false, milk: false, footer: false };
const focusAll: FocusState = { header: true, cookie: true, milk: true, footer: true };

// Onboarding steps configuration
const ONBOARDING_STEPS: OnboardingStep[] = [
	// Intro sequence - everything dimmed
	{
		id: "intro_1",
		chatText: "Welcome to Cookie Capitalist! I'm Coogie, and I'll show you around!",
		showChatBubble: true,
		showTapPrompt: true,
		focus: noFocus,
		showSwipeAnimation: false,
	},
	{
		id: "intro_2",
		chatText: "Your goal is to tap cookies and build a cookie empire!",
		showChatBubble: true,
		showTapPrompt: true,
		focus: noFocus,
		showSwipeAnimation: false,
	},
	{
		id: "intro_3",
		chatText: "Let me show you the important parts of the screen...",
		showChatBubble: true,
		showTapPrompt: true,
		focus: noFocus,
		showSwipeAnimation: false,
	},
	// Header spotlight
	{
		id: "header_spotlight",
		chatText: "This is where your cookie count and cookies per second are displayed!",
		showChatBubble: true,
		showTapPrompt: true,
		focus: { header: true, cookie: false, milk: false, footer: false },
		showSwipeAnimation: false,
	},
	// Cookie tap tutorial
	{
		id: "cookie_intro",
		chatText: "Now tap the cookie to earn your first cookie!",
		showChatBubble: true,
		showTapPrompt: false,
		focus: { header: false, cookie: true, milk: false, footer: false },
		showSwipeAnimation: false,
		waitForCookies: 1,
	},
	{
		id: "cookie_cheer",
		chatText: "🎉 Amazing! You got your first cookie! Keep tapping until you have 15!",
		showChatBubble: true,
		showTapPrompt: false,
		focus: { header: true, cookie: true, milk: false, footer: false },
		showSwipeAnimation: false,
		waitForCookies: 15,
	},
	// Swipe down tutorial
	{
		id: "swipe_intro",
		chatText: "Great job! Now I'll teach you a secret move... Swipe DOWN on the cookie!",
		showChatBubble: true,
		showTapPrompt: false,
		focus: { header: false, cookie: true, milk: true, footer: false },
		showSwipeAnimation: true,
		waitForSwipeDown: true,
	},
	{
		id: "swipe_success",
		chatText: "You dunked the cookie! 🥛 This gives you a 2x multiplier!",
		showChatBubble: true,
		showTapPrompt: true,
		focus: { header: true, cookie: true, milk: true, footer: false },
		showSwipeAnimation: false,
	},
	// Multiplier challenge
	{
		id: "multiplier_challenge",
		chatText: "Now tap as FAST as you can to reach 16x multiplier! Go go go!",
		showChatBubble: true,
		showTapPrompt: false,
		focus: { header: true, cookie: true, milk: false, footer: false },
		showSwipeAnimation: false,
		waitForMultiplier: 16,
	},
	{
		id: "multiplier_wait",
		chatText: "Incredible speed! 🔥 Now let the multiplier expire to see your earnings!",
		showChatBubble: true,
		showTapPrompt: false,
		focus: { header: true, cookie: true, milk: false, footer: false },
		showSwipeAnimation: false,
		waitForMultiplierEnd: true,
	},
	// Admiration and shop
	{
		id: "admiration",
		chatText: "Wow! You're a natural cookie tapper! 🌟 I'm impressed!",
		showChatBubble: true,
		showTapPrompt: true,
		focus: noFocus,
		showSwipeAnimation: false,
	},
	{
		id: "shop_intro",
		chatText: "One more thing - check out the Shop to buy upgrades that earn cookies automatically!",
		showChatBubble: true,
		showTapPrompt: true,
		focus: { header: false, cookie: false, milk: false, footer: true },
		showSwipeAnimation: false,
	},
	{
		id: "complete",
		chatText: "You're all set! Now go build your cookie empire! 🍪",
		showChatBubble: true,
		showTapPrompt: true,
		focus: focusAll,
		showSwipeAnimation: false,
	},
];
// #endregion

class Default extends Component<typeof Default> {
	// #region ⚙️ Props
	static propsDefinition = {};
	// #endregion

	// #region 📊 State
	private log = new Logger("noesis_onboarding");
	private noesisGizmo: NoesisGizmo | null = null;
	private dataContext: IUiViewModelObject = {};
	private currentStep: number = 0;
	private isOnboardingActive: boolean = false;
	private isOnboardingPending: boolean = false; // True during 2-second delay before onboarding starts
	private hasCompletedOnboarding: boolean = false;
	
	// Tracking state for wait conditions
	private currentCookies: number = 0;
	private currentMultiplier: number = 1;
	private hasSwipedDown: boolean = false;
	// #endregion

	// #region 🔄 Lifecycle Events
	start(): void {
		const log = this.log.active("start");

		this.noesisGizmo = this.entity.as(NoesisGizmo);
		if (!this.noesisGizmo) {
			log.error("Entity is not a NoesisGizmo!");
			return;
		}

		this.buildDataContext();
		this.noesisGizmo.dataContext = this.dataContext;

		// Listen for UI events from backend (state updates)
		this.connectNetworkBroadcastEvent(
			UIEvents.toClient,
			(data: UIEventPayload) => {
				this.handleUIEvent(data);
			}
		);

		// Listen for dunk multiplier events (local)
		this.connectLocalBroadcastEvent(LocalUIEvents.dunkMultiplier, (data) => {
			this.handleDunkMultiplier(data);
		});

		// Listen for swipe down events (local)
		this.connectLocalBroadcastEvent(LocalUIEvents.swipeDown, () => {
			this.handleSwipeDown();
		});

		log.info("Onboarding controller initialized and listening for events");
	}
	// #endregion

	// #region 🎯 Main Logic
	private buildDataContext(): void {
		const log = this.log.inactive("buildDataContext");

		this.dataContext = {
			isVisible: false,
			showChatBubble: true,
			showTapPrompt: true,
			chatText: "",
			showSwipeAnimation: false,
			allowTapAnywhere: true, // When false, clicks pass through to cookie
			
			onTapToContinue: () => this.onTapToContinue(),
		};

		log.info("DataContext created for Onboarding");
	}

	private startOnboarding(): void {
		const log = this.log.active("startOnboarding");

		if (this.hasCompletedOnboarding) {
			log.info("Onboarding already completed, skipping");
			return;
		}

		this.isOnboardingActive = true;
		this.currentStep = 0;
		this.hasSwipedDown = false;

		// Disable dunk gesture at start of onboarding (until swipe tutorial)
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingDunkEnabled, {
			enabled: false,
		});

		// Enable forced interaction mode to prevent player from dismissing
		const player = this.world.getLocalPlayer();
		player.enterFocusedInteractionMode({
			disableFocusExitButton: true,
		});
		log.info("Enabled forced interaction mode for onboarding");

		this.showStep(this.currentStep);

		log.info("Onboarding started");
	}

	private showStep(stepIndex: number): void {
		const log = this.log.active("showStep");

		if (stepIndex >= ONBOARDING_STEPS.length) {
			this.completeOnboarding();
			return;
		}

		const step = ONBOARDING_STEPS[stepIndex];
		log.info(`Showing step ${stepIndex}: ${step.id}`);

		// Broadcast focus state to all UI components
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingFocus, {
			header: step.focus.header,
			cookie: step.focus.cookie,
			milk: step.focus.milk,
			footer: step.focus.footer,
		});

		// Determine if step requires interaction with game elements (not tap anywhere)
		const hasWaitCondition = step.waitForCookies !== undefined ||
			step.waitForMultiplier !== undefined ||
			step.waitForMultiplierEnd ||
			step.waitForSwipeDown;

		// Enable cookie clicks when we reach a step that requires cookie interaction
		const isCookieStep = step.waitForCookies !== undefined || step.waitForMultiplier !== undefined;
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingCookieClickEnabled, {
			enabled: isCookieStep,
		});
		log.info(`Cookie click enabled: ${isCookieStep}`);
		
		// Show "X/15 Cookies!" format and blink during cookie collection steps (both cookie_intro and cookie_cheer)
		const isCookieCollectionStep = step.id === "cookie_intro" || step.id === "cookie_cheer";
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingCookieCollection, {
			active: isCookieCollectionStep,
			target: 15, // Always show /15 as the goal
		});
		log.info(`Cookie collection display: ${isCookieCollectionStep}`);

		// Enable dunk gesture only when we reach the swipe tutorial step
		const isDunkStep = step.waitForSwipeDown === true;
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingDunkEnabled, {
			enabled: isDunkStep,
		});
		log.info(`Dunk enabled: ${isDunkStep}`);

		// Hide the Noesis entity only during cookie interaction steps (not swipe steps)
		// This prevents it from blocking focused interaction input to the cookie
		// For swipe steps, we need to show the entity to display the swipe animation
		const shouldHideEntity = (step.waitForCookies !== undefined || step.waitForMultiplier !== undefined) && !step.waitForSwipeDown;
		if (this.noesisGizmo) {
			this.noesisGizmo.setLocalEntityVisibility(!shouldHideEntity);
			log.info(`Onboarding entity visibility: ${!shouldHideEntity}`);
		}
		
		// Reset focused interaction when entering a cookie step (first cookie tap step)
		// This ensures a clean interaction state before the user starts clicking the cookie
		if (step.id === "cookie_intro") {
			this.resetFocusedInteraction();
			log.info("Reset focused interaction for cookie step");
		}

		this.updateDataContext({
			isVisible: true,
			showChatBubble: step.showChatBubble,
			showTapPrompt: step.showTapPrompt,
			chatText: step.chatText,
			showSwipeAnimation: step.showSwipeAnimation,
			allowTapAnywhere: !hasWaitCondition, // Disable tap capture when waiting for cookie/swipe
		});
	}
	
	private advanceStep(): void {
		const log = this.log.active("advanceStep");

		this.currentStep++;
		log.info(`Advancing to step ${this.currentStep}`);
		this.showStep(this.currentStep);
	}

	private checkWaitCondition(): boolean {
		const log = this.log.active("checkWaitCondition");

		if (this.currentStep >= ONBOARDING_STEPS.length) return false;

		const step = ONBOARDING_STEPS[this.currentStep];

		// Check cookie count
		if (step.waitForCookies !== undefined) {
			if (this.currentCookies >= step.waitForCookies) {
				log.info(`Cookie condition met: ${this.currentCookies} >= ${step.waitForCookies}`);
				return true;
			}
			return false;
		}

		// Check multiplier
		if (step.waitForMultiplier !== undefined) {
			if (this.currentMultiplier >= step.waitForMultiplier) {
				log.info(`Multiplier condition met: ${this.currentMultiplier} >= ${step.waitForMultiplier}`);
				return true;
			}
			return false;
		}

		// Check multiplier end
		if (step.waitForMultiplierEnd) {
			if (this.currentMultiplier === 1) {
				log.info("Multiplier ended condition met");
				return true;
			}
			return false;
		}

		// Check swipe down
		if (step.waitForSwipeDown) {
			if (this.hasSwipedDown) {
				log.info("Swipe down condition met");
				return true;
			}
			return false;
		}

		return false;
	}

	private completeOnboarding(): void {
		const log = this.log.active("completeOnboarding");

		this.isOnboardingActive = false;
		this.hasCompletedOnboarding = true;
		
		// Show the entity again (in case it was hidden during game interaction steps)
		if (this.noesisGizmo) {
			this.noesisGizmo.setLocalEntityVisibility(true);
		}
		
		this.updateDataContext({ isVisible: false });
		
		// Broadcast focus=all to un-dim all UI elements
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingFocus, {
			header: true,
			cookie: true,
			milk: true,
			footer: true,
		});
		
		// Re-enable cookie clicks and dunk gesture after onboarding completes
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingCookieClickEnabled, {
			enabled: true,
		});
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingDunkEnabled, {
			enabled: true,
		});

		// Exit forced interaction mode and reset with normal settings
		const player = this.world.getLocalPlayer();
		player.exitFocusedInteractionMode();
		player.enterFocusedInteractionMode({
			disableFocusExitButton: true,
		});
		log.info("Onboarding completed - focused interaction reset");
	}
	// #endregion

	// #region 🎬 Handlers
	private handleUIEvent(data: UIEventPayload): void {
		const log = this.log.active("handleUIEvent");

		// Handle state updates for cookie tracking during onboarding
		if (data.type === "state_update" || data.type === "state_with_progress") {
			const cookies = (data.cookies as number) || 0;
			
			if (this.isOnboardingActive) {
				this.currentCookies = cookies;
				log.info(`State update during onboarding: cookies=${this.currentCookies}`);
				
				// Check if wait condition is now met
				if (this.checkWaitCondition()) {
					this.advanceStep();
				}
			}
		}

		// Check for state_update or welcome_back events to detect new players
		if (data.type === "state_update" || data.type === "welcome_back") {
			// Only process on mobile devices
			const localPlayer = this.world.getLocalPlayer();
			if (localPlayer === this.world.getServerPlayer()) {
				return;
			}

			const deviceType = localPlayer.deviceType.get();
			if (deviceType !== PlayerDeviceType.Mobile) {
				log.info(`Skipping - device is ${deviceType}, not Mobile`);
				return;
			}

			// Check if this is a new player (0 cookies and 0 CPS)
			const cookies = (data.cookies as number) || 0;
			const cps = (data.cps as number) || 0;

			// Start onboarding if player has 0 cookies and 0 CPS (brand new player)
			if (cookies === 0 && cps === 0 && !this.hasCompletedOnboarding && !this.isOnboardingActive && !this.isOnboardingPending) {
				log.info("NEW PLAYER DETECTED - Starting onboarding in 2 seconds");
				
				// Mark as pending to prevent duplicate detection
				this.isOnboardingPending = true;
				
				// Immediately disable dunk gesture and cookie clicks while waiting for onboarding to start
				this.sendLocalBroadcastEvent(LocalUIEvents.onboardingDunkEnabled, {
					enabled: false,
				});
				this.sendLocalBroadcastEvent(LocalUIEvents.onboardingCookieClickEnabled, {
					enabled: false,
				});
				
				this.async.setTimeout(() => {
					this.startOnboarding();
				}, 2000);
			}
		}
	}

	private handleDunkMultiplier(data: { multiplier: number; durationMs: number }): void {
		const log = this.log.active("handleDunkMultiplier");

		if (!this.isOnboardingActive) return;

		this.currentMultiplier = data.multiplier;
		log.info(`Dunk multiplier: ${this.currentMultiplier}`);

		// Check if wait condition is now met
		if (this.checkWaitCondition()) {
			this.advanceStep();
		}

		// Schedule check for multiplier end
		if (ONBOARDING_STEPS[this.currentStep]?.waitForMultiplierEnd) {
			this.async.setTimeout(() => {
				this.currentMultiplier = 1;
				if (this.checkWaitCondition()) {
					this.advanceStep();
				}
			}, data.durationMs + 100);
		}
	}

	private handleSwipeDown(): void {
		const log = this.log.active("handleSwipeDown");

		if (!this.isOnboardingActive) return;

		this.hasSwipedDown = true;
		log.info("Swipe down detected!");

		// Check if wait condition is now met
		if (this.checkWaitCondition()) {
			this.advanceStep();
		}
	}

	private onTapToContinue(): void {
		const log = this.log.active("onTapToContinue");

		if (!this.isOnboardingActive) return;

		const step = ONBOARDING_STEPS[this.currentStep];
		if (!step) return;

		// If step has wait conditions, don't advance on tap
		if (step.waitForCookies !== undefined || 
			step.waitForMultiplier !== undefined || 
			step.waitForMultiplierEnd || 
			step.waitForSwipeDown) {
			log.info("Step has wait condition, ignoring tap");
			return;
		}

		// Reset forced interaction on every tap during intro steps (before cookie clicking)
		// This prevents drag line artifacts from accumulating
		this.resetFocusedInteraction();
		log.info("Reset focused interaction on tap");

		this.advanceStep();
	}
	// #endregion

	// #region 🛠️ Helper Methods
	// Reset focused interaction mode (exit then re-enter) to clear drag artifacts
	private resetFocusedInteraction(): void {
		const player = this.world.getLocalPlayer();
		player.exitFocusedInteractionMode();
		player.enterFocusedInteractionMode({
			disableFocusExitButton: true,
		});
	}
	
	private updateDataContext(updates: Partial<IUiViewModelObject>): void {
		const log = this.log.inactive("updateDataContext");

		Object.assign(this.dataContext, updates);
		if (this.noesisGizmo) {
			this.noesisGizmo.dataContext = this.dataContext;
		}

		log.info(`DataContext updated: ${JSON.stringify(updates)}`);
	}
	// #endregion
}

Component.register(Default);
