// Onboarding Entity Configuration: file://./.github/instructions/entities/Onboarding.instructions.md

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
import { UIEvents, UIEventPayload, LocalUIEvents, GameEvents } from "./util_gameData";
import { Default as SfxManager } from "./controller_sfx";

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
	waitForShopOpen?: boolean;
	waitForUpgrade?: string; // Wait for specific upgrade to be purchased
	// Shop-specific flags
	shopStep?: boolean; // True if this step occurs in the shop page
	spotlightClicker?: boolean; // True if should spotlight only the clicker upgrade
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
		focus: { header: true, cookie: true, milk: false, footer: false },
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
		chatText: "",
		showChatBubble: false, // No mascot during swipe tutorial
		showTapPrompt: false,
		focus: { header: true, cookie: true, milk: true, footer: false },
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
	// Multiplier challenge - tap fast to reach 8x
	{
		id: "multiplier_challenge",
		chatText: "Now tap as FAST as you can to reach 8x multiplier! Go go go!",
		showChatBubble: true,
		showTapPrompt: false,
		focus: { header: true, cookie: true, milk: true, footer: false },
		showSwipeAnimation: false,
		waitForMultiplier: 8,
	},
	// Admiration after multiplier
	{
		id: "multiplier_success",
		chatText: "WOW! 🔥 Look at all those cookies! You're a natural!",
		showChatBubble: true,
		showTapPrompt: true,
		focus: { header: true, cookie: false, milk: false, footer: false },
		showSwipeAnimation: false,
	},
	// Shop introduction
	{
		id: "shop_spotlight",
		chatText: "Now let's put those cookies to work! Tap the Shop button!",
		showChatBubble: true,
		showTapPrompt: false,
		focus: { header: false, cookie: false, milk: false, footer: true },
		showSwipeAnimation: false,
		waitForShopOpen: true,
	},
	// Shop onboarding - Overview
	{
		id: "shop_overview",
		chatText: "Welcome to the Shop! Here you can buy upgrades that earn cookies automatically!",
		showChatBubble: true,
		showTapPrompt: true,
		focus: focusAll,
		showSwipeAnimation: false,
		shopStep: true,
	},
	// Shop onboarding - Timer explanation
	{
		id: "shop_timer",
		chatText: "Each upgrade has a timer. When it fills up, you earn cookies automatically!",
		showChatBubble: true,
		showTapPrompt: true,
		focus: focusAll,
		showSwipeAnimation: false,
		shopStep: true,
	},
	// Shop onboarding - Progress bar
	{
		id: "shop_progress",
		chatText: "The progress bar shows how close you are to the next payout!",
		showChatBubble: true,
		showTapPrompt: true,
		focus: focusAll,
		showSwipeAnimation: false,
		shopStep: true,
	},
	// Shop onboarding - Level up explanation
	{
		id: "shop_levelup",
		chatText: "Level up upgrades to DOUBLE their production rate! 📈",
		showChatBubble: true,
		showTapPrompt: true,
		focus: focusAll,
		showSwipeAnimation: false,
		shopStep: true,
	},
	// Shop onboarding - Buy clicker
	{
		id: "shop_buy_clicker",
		chatText: "Try it out! Buy the Clicker upgrade to start earning cookies automatically!",
		showChatBubble: true,
		showTapPrompt: false,
		focus: focusAll,
		showSwipeAnimation: false,
		shopStep: true,
		waitForUpgrade: "clicker",
		spotlightClicker: true,
	},
	// Completion
	{
		id: "complete",
		chatText: "🎉 You're all set! Now go build your cookie empire! 🍪",
		showChatBubble: true,
		showTapPrompt: true,
		focus: focusAll,
		showSwipeAnimation: false,
		shopStep: true,
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
	private purchasedUpgradeId: string = ""; // Last purchased upgrade ID
	private isTapBlocked: boolean = false; // Temporarily blocks tap-to-continue after multiplier step
	private static readonly MULTIPLIER_ADVANCE_DELAY_MS = 3000; // Delay before allowing tap after multiplier step (prevents accidental clicks)
	
	// Encouragement text for multiplier challenge
	private encouragementInterval: number | null = null;
	private lastMultiplierUpdateTime: number = 0; // Track when multiplier last increased
	private static readonly MULTIPLIER_STALE_MS = 2000; // Show "Faster!" after 2 seconds without multiplier increase
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
		
		// Listen for shop opened events (for shop onboarding)
		this.connectLocalBroadcastEvent(LocalUIEvents.onboardingShopOpened, () => {
			this.handleShopOpened();
		});
		
		// Listen for upgrade purchased events (for shop onboarding)
		this.connectLocalBroadcastEvent(LocalUIEvents.onboardingUpgradePurchased, (data) => {
			this.handleUpgradePurchased(data);
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
			showEncouragementText: false,
			encouragementText: "",
			
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
			shopButtonBlink: step.waitForShopOpen === true, // Blink shop button when waiting for shop to open
		});

		// Determine if step requires interaction with game elements (not tap anywhere)
		const hasWaitCondition = step.waitForCookies !== undefined ||
			step.waitForMultiplier !== undefined ||
			step.waitForMultiplierEnd ||
			step.waitForSwipeDown ||
			step.waitForShopOpen ||
			step.waitForUpgrade !== undefined;

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

		// Enable dunk gesture for swipe step and multiplier challenge (need to keep dunking)
		const isDunkStep = step.waitForSwipeDown === true || step.waitForMultiplier !== undefined;
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingDunkEnabled, {
			enabled: isDunkStep,
		});
		log.info(`Dunk enabled: ${isDunkStep}`);
		
		// Broadcast swipe animation state to Cookie UI
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingSwipeAnimation, {
			show: step.showSwipeAnimation === true,
		});
		log.info(`Swipe animation on Cookie UI: ${step.showSwipeAnimation === true}`);
		
		// Broadcast shop dim state to Shop UI (dim entire shop during explanation steps, except when buying clicker)
		const shouldDimShop = step.shopStep === true && step.spotlightClicker !== true;
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingShopDim, {
			active: shouldDimShop,
		});
		log.info(`Shop dim: ${shouldDimShop}`);
		
		// Broadcast clicker spotlight state to Shop UI
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingSpotlightClicker, {
			active: step.spotlightClicker === true,
		});
		log.info(`Clicker spotlight: ${step.spotlightClicker === true}`);
		
		// Reset focused interaction when entering a cookie step (first cookie tap step)
		// This ensures a clean interaction state before the user starts clicking the cookie
		if (step.id === "cookie_intro") {
			this.resetFocusedInteraction();
			log.info("Reset focused interaction for cookie step");
		}

		// Show encouragement text during multiplier challenge step
		const isMultiplierChallenge = step.id === "multiplier_challenge";
		if (isMultiplierChallenge) {
			this.startEncouragementText();
		} else {
			this.stopEncouragementText();
		}
		
		// Hide the onboarding overlay completely during cookie/swipe interaction steps
		// This prevents the blocking Screen Overlay from interfering with Focused Interaction raycasts
		// The dimming effect is still active via onboardingFocus events sent above
		// IMPORTANT: Must use setLocalEntityVisibility because "Interactive, blocking" mode
		// blocks input at the entity level, not the XAML level
		const shouldHideOverlay = step.waitForCookies !== undefined || 
			step.waitForMultiplier !== undefined ||
			step.waitForSwipeDown;
		
		// Hide the actual NoesisUI entity during interaction steps
		if (this.noesisGizmo) {
			this.noesisGizmo.setLocalEntityVisibility(!shouldHideOverlay);
			log.info(`Onboarding entity visibility: ${!shouldHideOverlay}`);
		}
		
		this.updateDataContext({
			isVisible: !shouldHideOverlay, // Also hide in dataContext for consistency
			showChatBubble: step.showChatBubble,
			showTapPrompt: step.showTapPrompt,
			chatText: step.chatText,
			showSwipeAnimation: step.showSwipeAnimation,
			allowTapAnywhere: !hasWaitCondition, // Disable tap capture when waiting for cookie/swipe
			showEncouragementText: isMultiplierChallenge,
		});
	}
	
	private advanceStep(): void {
		const log = this.log.active("advanceStep");

		// Check if we're advancing FROM a multiplier step - block tap input temporarily
		const previousStep = ONBOARDING_STEPS[this.currentStep];
		if (previousStep?.waitForMultiplier !== undefined) {
			log.info(`Advancing from multiplier step - blocking tap for ${Default.MULTIPLIER_ADVANCE_DELAY_MS}ms`);
			this.isTapBlocked = true;
			this.async.setTimeout(() => {
				this.isTapBlocked = false;
				log.info("Tap block lifted");
			}, Default.MULTIPLIER_ADVANCE_DELAY_MS);
		}

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
		
		// Check shop open
		if (step.waitForShopOpen) {
			// This is checked directly in handleShopOpened
			log.info("Shop open condition met");
			return true;
		}
		
		// Check upgrade purchase
		if (step.waitForUpgrade !== undefined) {
			if (this.purchasedUpgradeId === step.waitForUpgrade) {
				log.info(`Upgrade condition met: ${this.purchasedUpgradeId}`);
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
		
		// Stop encouragement text if running
		this.stopEncouragementText();
		
		// Show the entity again (was hidden during game interaction steps)
		if (this.noesisGizmo) {
			this.noesisGizmo.setLocalEntityVisibility(true);
		}
		
		this.updateDataContext({ isVisible: false });
		
		// Clear any remaining shop dimming and clicker spotlight
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingShopDim, {
			active: false,
		});
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingSpotlightClicker, {
			active: false,
		});
		
		// Broadcast focus=all to un-dim all UI elements
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingFocus, {
			header: true,
			cookie: true,
			milk: true,
			footer: true,
			shopButtonBlink: false,
		});
		
		// Re-enable cookie clicks and dunk gesture after onboarding completes
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingCookieClickEnabled, {
			enabled: true,
		});
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingDunkEnabled, {
			enabled: true,
		});
		
		// Notify server that onboarding is complete (for quest reward)
		this.sendNetworkBroadcastEvent(GameEvents.toServer, {
			type: "onboarding_complete",
		});
		log.info("Sent onboarding_complete event to server");

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
				
				// Enable focused interaction mode immediately for new players
				// (WelcomeBack modal is skipped for new players, so we need to enable it here)
				const player = this.world.getLocalPlayer();
				player.enterFocusedInteractionMode({
					disableFocusExitButton: true,
				});
				log.info("Enabled focused interaction mode for new player");
				
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

		// Track when multiplier increases (for encouragement text)
		if (data.multiplier > this.currentMultiplier) {
			this.lastMultiplierUpdateTime = Date.now();
		}
		
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
	
	private handleShopOpened(): void {
		const log = this.log.active("handleShopOpened");

		if (!this.isOnboardingActive) return;

		log.info("Shop opened!");

		// Check if wait condition is now met
		if (this.checkWaitCondition()) {
			this.advanceStep();
		}
	}
	
	private handleUpgradePurchased(data: { upgradeId: string }): void {
		const log = this.log.active("handleUpgradePurchased");

		if (!this.isOnboardingActive) return;

		log.info(`Upgrade purchased: ${data.upgradeId}`);
		this.purchasedUpgradeId = data.upgradeId;

		// Check if wait condition is now met
		if (this.checkWaitCondition()) {
			this.advanceStep();
		}
	}

	private onTapToContinue(): void {
		const log = this.log.active("onTapToContinue");

		if (!this.isOnboardingActive) return;
		
		// Block tap input temporarily after multiplier step to prevent accidental clicks
		if (this.isTapBlocked) {
			log.info("Tap blocked (cooldown after multiplier step)");
			return;
		}

		const step = ONBOARDING_STEPS[this.currentStep];
		if (!step) return;

		// If step has wait conditions, don't advance on tap
		if (step.waitForCookies !== undefined || 
			step.waitForMultiplier !== undefined || 
			step.waitForMultiplierEnd || 
			step.waitForSwipeDown ||
			step.waitForShopOpen ||
			step.waitForUpgrade !== undefined) {
			log.info("Step has wait condition, ignoring tap");
			return;
		}

		// Play navigation SFX for tap-to-continue
		const sfx = SfxManager.getInstance();
		if (sfx) {
			sfx.playNavigation();
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
	
	private startEncouragementText(): void {
		const log = this.log.active("startEncouragementText");
		
		// Clear any existing interval
		this.stopEncouragementText();
		
		// Initialize tracking - start with "Keep clicking!"
		this.lastMultiplierUpdateTime = Date.now();
		this.sendLocalBroadcastEvent(LocalUIEvents.onboardingEncouragement, {
			show: true,
			text: "Keep clicking!",
		});
		
		// Check every 500ms if we need to show "Faster!"
		this.encouragementInterval = this.async.setInterval(() => {
			const timeSinceLastIncrease = Date.now() - this.lastMultiplierUpdateTime;
			const isStale = timeSinceLastIncrease > Default.MULTIPLIER_STALE_MS;
			
			this.sendLocalBroadcastEvent(LocalUIEvents.onboardingEncouragement, {
				show: true,
				text: isStale ? "Faster!" : "Keep clicking!",
			});
		}, 500);
		
		log.info("Started encouragement text");
	}
	
	private stopEncouragementText(): void {
		const log = this.log.inactive("stopEncouragementText");
		
		if (this.encouragementInterval !== null) {
			this.async.clearInterval(this.encouragementInterval);
			this.encouragementInterval = null;
			
			// Hide encouragement text on Cookie UI
			this.sendLocalBroadcastEvent(LocalUIEvents.onboardingEncouragement, {
				show: false,
				text: "",
			});
			
			log.info("Stopped encouragement text");
		}
	}
	// #endregion
}

Component.register(Default);
