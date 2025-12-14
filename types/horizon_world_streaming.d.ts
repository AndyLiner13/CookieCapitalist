declare module 'horizon/world_streaming' {
/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @format
 */
import { Entity, ReadableHorizonProperty } from 'horizon/core';
/**
 * The possible states of a {@link SublevelEntity | sublevel} in a world when
 * using world streaming.
 *
 * @remarks
 * For more information about world streaming,
 * see the {@link https://developers.meta.com/horizon-worlds/learn/documentation/typescript/asset-spawning/world-streaming | World Streaming} guide.
 */
export declare enum SublevelStates {
    /**
     * The sublevel's asset data is not yet available.
     */
    NotReady = 0,
    /**
     * The sublevel's asset data is available but not loaded.
     */
    Unloaded = 1,
    /**
     * The sublevel's asset data is loading.
     */
    Loading = 2,
    /**
     * The sublevel's loading is paused.
     */
    Paused = 3,
    /**
     * The sublevel's loading is complete and ready to be enabled,
     * but does not yet count towards capacity.
     */
    Loaded = 4,
    /**
     * The spawn is complete and the sublevel is ready for use.
     */
    Active = 5,
    /**
     * The sublevel is in the process of unloading.
     */
    Unloading = 6
}
/**
 * A sublevel of a world that you can stream independentaly from the rest of
 * the world at runtime.
 *
 * @remarks
 * Sublevels are a way to break up a world into smaller pieces that you can
 * stream separately from other portions of the world. Streaming sublevels
 * can have performance benefits when spawning large amounts of static
 * content that is always spawned at the same location.
 *
 * For more information about world streaming,
 * see the {@link https://developers.meta.com/horizon-worlds/learn/documentation/typescript/asset-spawning/world-streaming | World Streaming} guide.
 *
 * To spawn smaller sets of dynamic content at runtime, you should use
 * a {@link core#SpawnController} object to spawn and despawn {@link core#Asset | assets}. For
 * more information about asset spawning, see the
 * {@link https://developers.meta.com/horizon-worlds/learn/documentation/typescript/asset-spawning/introduction-to-asset-spawning | Introduction to Asset Spawning} guide.
 *
 * @example
 * This example demonstrates how to spawn and despawn sublevels at runtime.
 * ```
 * import { Component, PropTypes, Entity, CodeBlockEvents } from 'horizon/core';
 * import { SublevelEntity } from 'horizon/world_streaming';
 *
 *
 * class TestSublevelAPI extends Component {
 *   static propsDefinition = {
 *     sublevel: {type: PropTypes.Entity},
 *     state: {type: 'number', default: 0}, // States 0 to 4 are:
 *                                          // Unloaded, Loaded, Active,
 *                                          // Pause, and Hide (Loaded).
 *   };
 *
 *   start() {
 *     this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterTrigger, async (player) = {
 *       var sublevel = this.props.sublevel?.as(SublevelEntity);
 *       var state = this.props.state;
 *
 *
 *       if (sublevel == null \|\| sublevel == undefined) {
 *         console.log("The sublevel entity was either null or invalid.")
 *         return;
 *       }
 *
 *       console.log("Sublevel Trigger entered. Trying to set sublevel " + sublevel.toString() + " to " + state + ", current sublevel state is " + sublevel.currentState.get() + ", previous target sublevel state is " + sublevel.targetState.get());
 *       switch(state) {
 *         case 0: {
 *           sublevel.unload().then(() = {
 *             console.log("Sublevel " + sublevel?.toString() + " is now unloaded!");
 *           });
 *           break;
 *         }
 *         case 1: {
 *           sublevel.load().then(() = {
 *             console.log("Sublevel " + sublevel?.toString() + " is now loaded!");
 *           });
 *           break;
 *         }
 *         case 2: {
 *           sublevel.activate().then(() = {
 *             console.log("Sublevel " + sublevel?.toString() + " is now activated!");
 *           });
 *           break;
 *         }
 *         case 3: {
 *           sublevel.pause().then(() = {
 *             console.log("Sublevel " + sublevel?.toString() + " is now paused!");
 *           });
 *           break;
 *         }
 *         case 4: {
 *           sublevel.hide().then(() = {
 *             console.log("Sublevel " + sublevel?.toString() + " is now hidden!");
 *           });
 *           break;
 *         }
 *         default: {
 *           console.log("Invalid/Unexpected sublevel state # given: " + state);
 *           // unexpected state
 *           break;
 *         }
 *       }
 *     });
 *   }
 * }
 * Component.register(TestSublevelAPI);
 * ```
 */
export declare class SublevelEntity extends Entity {
    /**
     * Creates a human-readable representation of the SublevelEntity.
     * @returns A string representation of the SublevelEntity.
     */
    toString(): string;
    /**
     * Gets the current state of the sublevel.
     */
    readonly currentState: ReadableHorizonProperty<SublevelStates>;
    /**
     * Gets the state the sublevel is attempting to reach.
     */
    readonly targetState: ReadableHorizonProperty<SublevelStates>;
    /**
     * Loads the sublevel's asset data if not already loaded and makes it active in the world.
     *
     * @returns A promise that resolves when the sublevel is active.
     */
    activate(): Promise<void>;
    /**
     * Despawns the sublevel and preloads the sublevel's asset data so it can be re-activated later.
     *
     * @returns A promise that resolves when the sublevel is loaded.
     */
    hide(): Promise<void>;
    /**
     * Preloads the sublevel's asset data so it can be activated later.
     *
     * @returns A promise that resolves when the sublevel is loaded.
     */
    load(): Promise<void>;
    /**
     * Pauses the sublevel's asset data loading.
     *
     * @returns A promise that resolves when the sublevel is paused.
     */
    pause(): Promise<void>;
    /**
     * Despawns the sublevel's asset data.
     *
     * @returns A promise that resolves when the sublevel is unloaded.
     */
    unload(): Promise<void>;
}

}