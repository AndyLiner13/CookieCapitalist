declare module 'horizon/avatar_ai_agent' {
/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @format
 */
import { Vec3, AIAgentGizmo, Player, Entity, ReadableHorizonProperty, Handedness } from 'horizon/core';
/**
 * The name of the API.
 */
export declare const ApiName = "avatar_ai_agent";
/**
 * @deprecated Please use the NpcLocomotionResult enum and NpcPlayer class in the horizon/npc module instead.
 *
 * The possible results of a move action for an NPC agent.
 */
export declare enum AgentLocomotionResult {
    /**
     * The action is complete.
     */
    Complete = 0,
    /**
     * The action is canceled.
     */
    Canceled = 1,
    /**
     * An error occured when attempting the action.
     */
    Error = 2
}
/**
 * @deprecated Please use the NpcLocomotionOptions type and NpcPlayer class in the horizon/npc module instead.
 *
 * The options used when a movement command is issued to the agent.
 */
export declare type AgentLocomotionOptions = {
    /**
     * The agent's movement speed in meter per second. Defaults to 4.5 m/s.
     * This value is caped by the player's max speed or an absolute cap of 45 m/s.
     */
    movementSpeed?: number;
    /**
     * The time in seconds to travel from the agent's current position to the final position.
     * The agent's movement speed will vary to achieve this goal.
     */
    travelTime?: number;
    /**
     * The agent's acceleration in m/s^2. Defaults to 30 m/s^2.
     */
    acceleration?: number;
    /**
     * The agent's deceleration in m/s^2. Deftaults to 15 m/s^2
     */
    deceleration?: number;
};
/**
 * @deprecated Please use the NpcRotationOptions type and NpcPlayer class in the horizon/npc module instead.
 *
 * The options that can be specified when issuing a rotation command to an agent.
 */
export declare type AgentRotationOptions = {
    /**
     * The agent's rotation speed in degrees per second.
     */
    rotationSpeed?: number;
    /**
     * The amount of time in seconds for the agent to complete the desired rotation.
     */
    rotationTime?: number;
};
/**
 * @deprecated Please use the NpcPlayer class in the horizon/npc module instead.
 *
 * Exposes the locomotion features of an AI agent.
 *
 * @remarks To use agent locomotion, you must enable Navigation Locomotion in
 * Desktop Editor. For more information, see the
 * {@link https://developers.meta.com/horizon-worlds/learn/documentation/desktop-editor/npcs/nav-mesh-agents | Nav Mesh Agents}
 * guide.
 */
export declare class AgentLocomotion {
    /**
     * The entity that is attached to the agent.
     */
    entity: Entity;
    /**
     * The current locomotion target of the agent. Undefined if the agent isn't currently moving.
     */
    targetPosition: ReadableHorizonProperty<Vec3 | undefined>;
    /**
     * The current target direction of the agent. Undefined if the agent isn't currently rotating to a specific target direction.
     */
    targetDirection: ReadableHorizonProperty<Vec3 | undefined>;
    /**
     * Indicates whether the agent is moving.
     */
    isMoving: ReadableHorizonProperty<boolean>;
    /**
     * Indicates whether the agent is on the ground. true if the agent is on the
     * ground, false if the agent is above, below, or otherwise away from the ground.
     */
    isGrounded: ReadableHorizonProperty<boolean>;
    /**
     * Indicates whether the agent is performing a jump.
     */
    isJumping: ReadableHorizonProperty<boolean>;
    /**
     * Issues a movement command to the agent. Issuing a new move, rotate, follow, or jump command cancels any previous move command.
     * @param position - The desired destination.
     * @param options - Optional parameters.
     * @returns - A promise describing how the locomotion ended.
     */
    moveToPosition(position: Vec3, options?: AgentLocomotionOptions): Promise<AgentLocomotionResult>;
    /**
     * Issues a movement command along a path. Issuing a new move, rotate, follow, or jump command cancels any previous move command.
     * @param path - An array of points to follow, in order.
     * @param options - Optional parameters
     * @returns - A promise describing how the locomotion ended.
     */
    moveToPositions(path: Array<Vec3>, options?: AgentLocomotionOptions): Promise<AgentLocomotionResult>;
    /**
     * Issues a rotation command to change the direction the agent faces. Issuing a new move, rotate, follow, or jump command cancels any previous move command.
     * @param direction - The desired facing direction.
     * @param options - Optional parameters.
     * @returns - A promise describing how the rotation ended.
     */
    rotateTo(direction: Vec3, options?: AgentRotationOptions): Promise<AgentLocomotionResult>;
    /**
     * Stops any movement in progress.
     */
    stopMovement(): void;
    /**
     * Issues a jump command.
     * @returns A promise describing how the jump ended.
     */
    jump(): Promise<AgentLocomotionResult>;
}
/**
 * @deprecated Please use the NpcGrabActionResult enum and NpcPlayer class in the horizon/npc module instead.
 *
 * The result of a request for an agent to pick up an entity.
 */
export declare enum AgentGrabActionResult {
    /**
     * The entity was successfully picked up.
     */
    Success = 0,
    /**
     * The request failed because another entity is already being held.
     */
    AlreadyHolding = 1,
    /**
     * The agent is not allowed to hold the entity.
     */
    NotAllowed = 2,
    /**
     * The entity is not grabbable.
     */
    InvalidEntity = 3
}
/**
 * @deprecated Please use the NpcPlayer class in the horizon/npc module instead.
 *
 * The grabbing features of an agent.
 */
export declare class AgentGrabbableInteraction {
    /**
     * The entity that is attached to the agent.
     */
    entity: Entity;
    /**
     * Gets the entity currently held by the specified hand.
     * @param handedness - The hand to query.
     * @returns - The held entity or undefined if not holding anything.
     */
    getGrabbedEntity(handedness: Handedness): Entity | undefined;
    /**
     * Commands the agent to pick up an entity.
     * @param handedness - The hand to pick up the entity with.
     * @param entity - The entity to grab. The entity must be grabbable.
     * @returns - A promise describing how the grabbing action ended.
     */
    grab(handedness: Handedness, entity: Entity): Promise<AgentGrabActionResult>;
    /**
     * Commands an agent to drop a held item.
     * @param handedness - The hand to drop the item from.
     */
    drop(handedness: Handedness): void;
}
/**
 * * @deprecated Please use the NpcPlayerSpawnResult enum and Npc class in the horizon/npc module instead.
 *
 * The result of a player spawn request
 */
export declare enum AgentSpawnResult {
    /**
     * The player was successfully spawned
     */
    Success = 0,
    /**
     * This agent already has a player.
     */
    AlreadySpawned = 1,
    /**
     * There is no room in the world for an additional player.
     */
    WorldAtCapacity = 2,
    /**
     * An error has occured.
     */
    Error = 3
}
/**
 * @deprecated Please use the Npc class in the horizon/npc module instead.
 *
 * An AI-powered NPC that scripts can spawn and despawn at runtime and is represented
 * by a player avatar. `AvatarAIAgent` objects are also capable of pathfinding,
 * locomotion, and grabbale interacation.
 *
 * @remarks
 * For more information, see {@link https://developers.meta.com/horizon-worlds/learn/documentation/desktop-editor/npcs/scripted-avatar-npcs/getting-started-with-scripted-avatar-npcs | Getting Started with Scripted Avatar NPCs} and
 * {@link https://developers.meta.com/horizon-worlds/learn/documentation/desktop-editor/npcs/scripted-avatar-npcs/spawning-for-scripted-avatar-npcs | Spawning for Scripted Avatar NPCs}.
 */
export declare class AvatarAIAgent extends AIAgentGizmo {
    /**
     * The Locomotion capabilities of the agent.
     */
    readonly locomotion: AgentLocomotion;
    /**
     * The grabbable interaction capabilities of the agent.
     */
    readonly grabbableInteraction: AgentGrabbableInteraction;
    /**
     * The ID of the `AvatarAIAgent` object.
     * @returns A string representation of the ID.
     */
    toString(): string;
    /**
     * Returns the `AIAgentGizmo` that is associated with the provided player.
     * @param player - The player.
     * @returns The gizmo, or undefined if no gizmo is associated with the player.
     */
    static getGizmoFromPlayer(player: Player): Entity | undefined;
    /**
     * The player controlled by the `AvatarAIAgent` object.
     */
    agentPlayer: ReadableHorizonProperty<Player | undefined>;
    /**
     * Spawns a player controlled by the `AvatarAIAgent` object.
     *
     * @returns A promise describing the results of the spawn operation.
     */
    spawnAgentPlayer(): Promise<AgentSpawnResult>;
    /**
     * Despawns the player controlled by the `AvatarAIAgent` object.
     */
    despawnAgentPlayer(): void;
}

}