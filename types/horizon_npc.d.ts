declare module 'horizon/npc' {
/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @format
 */
import { Entity, Handedness, HorizonProperty, NetworkEvent, Player, ReadableHorizonProperty, TextGizmo, Vec3 } from 'horizon/core';
/**
 * The name of the API.
 */
export declare const ApiName = "HorizonNpc";
export { LocomotionResult as NpcLocomotionResult } from 'horizon/core';
export { LocomotionOptions as NpcLocomotionOptions } from 'horizon/core';
export { RotationOptions as NpcRotationOptions } from 'horizon/core';
/**
 * The audio output settings for an {@link Npc.conversation | NPC conversation}.
 */
export declare type NpcAudioSettings = {
    /**
     * True to use 3D spatial audio; false to use 2D audio. 2D audio plays sound from a fixed
     * point, without taking into account the player's position or movement, resulting
     * in a flat and less immersive experience. 3D audio simulates how sound behaves in real
     * life, allowing players to pinpoint the source of sounds with left/right channel and
     * distance falloff. minDistance and maxDistance settings are only effective for 3D audio.
     */
    enable3D: boolean;
    /**
     * The volume of the audio. The value must be between 0 to 1.
     */
    volume: number;
    /**
     * The minimum spatial distance for 3D audio. This value only takes effect when the `enable3D`
     * property is set to true. The spatial distance specifies the full volume range of the audio source in
     * 3D space relative to the player. If the player is within the minimum distance, the sound only
     * plays at the maximum level set by the `volume` property. The `minDistance` must be a
     * positive number.
     */
    minDistance: number;
    /**
     * The maximum spatial distance for 3D audio. This value only takes effect when
     * the `enable3D` property is set to true. The spatial distance specifies the full volume
     * range of the audio source in 3D space relative to the player. The volume gradually decreases for
     * any player between minimum and maximum distance, and fades out completely beyond the maximum distance.
     * The value of the `maxDistance` property must be larger than the `minDistance` property.
     */
    maxDistance: number;
};
/**
 * Represents the NPC's conversation engagement phase. This phase is only informational. Currently,
 * engagement with certain users can be triggered using the {@link NpcAttentionTarget} indicated by
 * the `NpcConversation.elicitResponse()` or `NpcConversation.speak()` method.
 *
 * @privateRemarks
 * This must remain in sync with the AelEngagementPhase enum in AelAPIEnums.cs and
 * NPCEngagementPhase in NotifyEngagementPhaseEvent.cs.
 */
export declare enum NpcEngagementPhase {
    /**
     * The NPC is idle and can start a conversation anytime. No user is engaged yet. New instructions
     * can be processed by the NPC.
     */
    Idle = 0,
    /**
     * The NPC is listening to the user. Listening to the user isn't currently supported.
     */
    Listening = 1,
    /**
     * The NPC is processing input and formulating a response based on instructions from
     * `NpcConversation.elicitResponse()` method.
     */
    Reacting = 2,
    /**
     * The NPC is speaking. This phase can be triggered by the `NpcConversation.speak()` and
     * `NpcConversation.elicitResponse()` methods. Certain users can be engaged
     * with the NPC if the `NpcAttentionTargets` parameter of the `NpcConversation.elicitResponse()` method
     * specifies a player in the world. New instructions are queued when the NPC is responding. The
     * responding phase is transited again during the yielding and reacting phases if there's more
     * instructions in the queue.
     */
    Responding = 3,
    /**
     * The NPC finished speaking and is waiting for further instructions. The {@link NpcAttentionTarget}
     * is still engaged. The NPC can process new instructions.
     */
    Yielding = 4,
    /**
     * The NPC is idle and can process new instructions. The {@link NpcAttentionTarget} is still engaged
     * with the NPC.
     */
    FocusedIdle = 5
}
/**
 * Represents a viseme received by an {@link Npc | NPC}. A viseme is a visual representation of the
 * shape a mouth when a corresponding sound is spoken.
 *
 * @remarks
 * For information about visemes, see {@link https://developers.meta.com/horizon/documentation/unity/audio-ovrlipsync-viseme-reference/}.
 *
 * @privateRemarks
 * Must remain in sync with the Viseme enum in Meta.WitAi.TTS.Data.
 */
export declare enum Viseme {
    /**
     * Mouth is closed.
     */
    sil = 0,
    /**
     * Phonemes: p, b, m,
     * Ex: put, but, mouse
     */
    PP = 1,
    /**
     * Phonemes: f, v
     * Ex: fine, verb
     */
    FF = 2,
    /**
     * Phonemes: th, dh
     * Ex: three, the
     */
    TH = 3,
    /**
     * Phonemes: t, d
     * Ex: truck, duck
     */
    DD = 4,
    /**
     * Phonemes: k, g
     * Ex: kit, get, thing
     */
    kk = 5,
    /**
     * Phonemes: SH, ZH, CH, JH
     * Ex: shift, treasure, check, jungle
     */
    CH = 6,
    /**
     * Phonemes: s, z
     * Ex: sit, zebra
     */
    SS = 7,
    /**
     * Phonemes: n, l
     * Ex: no, long
     */
    nn = 8,
    /**
     * Phonemes: R, ER, AXR
     * Ex: right, her, water
     */
    RR = 9,
    /**
     * Phonemes: AA, AH, AX, A(Y), A(W)
     * Ex: car, cut, about
     */
    aa = 10,
    /**
     * Phonemes: EH, AE, E(Y)
     * Ex: bay, bed, cat
     */
    E = 11,
    /**
     * Phonemes: IH, IY, IX, Y
     * Ex: hit, here
     */
    ih = 12,
    /**
     * Phonemes: AO
     * Ex: talk, toe
     */
    oh = 13,
    /**
     * Phonemes: UW, UH, W
     * Ex: boot, book, how, water
     */
    ou = 14
}
/**
 * The conditions required to trigger a response from an NPC during conversation.
 */
export declare enum ConversationResponseTrigger {
    /**
     * The NPC will start responding once it detects that the player has finished speaking.
     */
    Automatic = 0,
    /**
     * The NPC will start responding once the stopListening method is called.
     */
    Manual = 1
}
/**
 * The type of text that should be displayed on the Text Gizmo
 */
export declare enum SpeechBubbleTargetType {
    None = 0,
    Response = 1,
    UserTranscript = 2
}
/**
 * A player or item (entity) that is the focus target of the {@link Npc | NPC} when the NPC
 * engages in {@link Npc.conversation | conversation}.
 */
export declare type NpcAttentionTarget = Player | Entity;
/**
 * The result of a request for an NPC to pick up an entity.
 */
export declare enum NpcGrabActionResult {
    /**
     * The entity was successfully picked up.
     */
    Success = 0,
    /**
     * The request failed because another entity is already being held.
     */
    AlreadyHolding = 1,
    /**
     * The NPC is not allowed to hold the entity.
     */
    NotAllowed = 2,
    /**
     * The entity is not grabbable.
     */
    InvalidEntity = 3
}
/**
 * The result of a player spawn request
 */
export declare enum NpcPlayerSpawnResult {
    /**
     * The player was successfully spawned
     */
    Success = 0,
    /**
     * This NPC already has a player.
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
 * Defines the currently playable player Emotes
 */
export declare enum EmoteName {
    HeartHands = 0,
    Like = 1,
    Laugh = 2,
    Wave = 3,
    Dislike = 4,
    Cheer = 5
}
/**
 * An Npc related error
 */
export declare class NpcError extends Error {
    category: NpcErrorCategory;
    constructor(category: NpcErrorCategory, message: string);
}
/**
 * Represents different error categories.
 *
 * @privateRemarks
 * Must remain in sync with the NpcErrorCategory enum in the NpcErrorEvent.cs.
 */
export declare enum NpcErrorCategory {
    UnknownError = 0,
    AudioTranscriptionRequestError = 1,
    LLMAnalysisRequestError = 2,
    TextToSpeechRequestError = 3,
    AiNotAvailableError = 4
}
/**
 * A set of events that are triggered by various types of {@link Npc | NPC} engagement.
 */
export declare const NpcEvents: {
    OnNpcAction: NetworkEvent<{
        actionId: string;
        parameters: any;
    }>;
    /**
     * Triggered when the NPC switches engagement phases.
     *
     * @remarksThe engagement phase received by this event is the current state of NPC.
     *
     * @param entityId - The ID of the NPC entity that emits the event.
     * @param phase - The engagement phase the NPC is currently in.
     * @param playerId - The ID of the player that is engaging with the NPC. -1 indicates
     * no player is engaging the NPC. To get the player object from player ID, call `new Player(playerId)`.
     */
    OnNpcEngagementChanged: NetworkEvent<{
        phase: NpcEngagementPhase;
        playerId: number;
    }>;
    OnNpcStartedSpeaking: NetworkEvent<Record<string, never>>;
    OnNpcStoppedSpeaking: NetworkEvent<Record<string, never>>;
    OnNpcVisemeChanged: NetworkEvent<{
        viseme: Viseme;
    }>;
    OnNpcEmoteStart: NetworkEvent<{
        emote: string;
    }>;
    OnNpcEmoteStop: NetworkEvent<{
        emote: string;
    }>;
    /**
     * Triggered when an NPC starts speaking a part of a response or TTS prompt. Each partial is broken
     * down into sentences that coincide with captions (speech bubbles by default). This event fires
     * multiple times during a single speaking session, allowing for real-time display of speech content.
     *
     * @param text - The partial text content being spoken by the NPC.
     */
    OnNpcPartialResponse: NetworkEvent<{
        text: string;
    }>;
    /**
     * Triggered after the final partial response from the speaking NPC has been delivered.
     * The text contains the complete response with all content that was spoken since the last
     * OnNpcStartedSpeaking event. This event provides the full aggregated text for logging,
     * analysis, or display purposes.
     *
     * @param text - The complete text content that was spoken by the NPC.
     */
    OnNpcFullResponse: NetworkEvent<{
        text: string;
    }>;
    OnNpcError: NetworkEvent<{
        category: NpcErrorCategory;
        errorCode: number;
        errorMessage: string;
        playerId: number;
    }>;
};
/**
 * Manages the ability of conversation output of an AI-powered NPC, such as an {@link Npc} entity.
 *
 * @remarks
 * With this class, you can design NPCs that use an LLM to provide context-aware
 * interactions with players based on parameters such as storylines, and the
 * state of the world instance.
 */
export declare class NpcConversation {
    protected readonly entity: Npc;
    readonly actions: ActionSystem;
    constructor(entity: Npc);
    /**
     * The audio settings for speech capabilities of NPC. This setting will take effect on every
     * player in the world. It can be overridden by setAudioSettingsForPlayer below.
     *
     * @param audioSetting- The audio setting in {@link NpcAudioSettings}
     */
    audioSettings: HorizonProperty<NpcAudioSettings>;
    private throwIfNotEnabled;
    /**
     *  Awaits to ensure that the npc conversation model is ready for access.
     *  Throws an error if setup fails or times out.
     */
    protected isReady(): Promise<void>;
    /**
     * Overrides audio settings for a specific player. Setting the global audio settings will clear all previous per player settings.
     *
     * @param audioSetting- The audio setting in {@link NpcAudioSettings}
     * @param player- The player the setting will take effect on.
     */
    setAudioSettingsForPlayer(audioSettings: NpcAudioSettings, player: Player): Promise<void>;
    /**
     * Makes the NPC generate audio output that follows a script.
     *
     * @param script - The script used to generate the audio output.
     */
    speak(script: string): Promise<void>;
    /**
     * Forces the NPC to immediately stop speaking.
     */
    stopSpeaking(): Promise<void>;
    /**
     * Specifies instructions triggering an audio response from the NPC. NPC will speak using the instruction provided together
     * with the existing event and dynamic context.
     *
     * @param instruction - The instruction for the model to follow. If the instruction is missing, there will be response
     * generated with previous context.
     */
    elicitResponse(instruction?: string): Promise<void>;
    /**
     * Simulates a player or another npc speaking to the NPC by providing a text transcription that will be processed
     * as if it was spoken aloud and heard by the NPC. This method allows for programmatic conversation
     * input without requiring actual voice input from players.
     *
     * @remarks
     * This method is useful for testing NPC conversations programmatically, creating scripted dialogue
     * sequences, allowing text-based input to voice-enabled NPCs, and building chat interfaces for NPCs.
     * The transcription will be added to the NPC's conversation context. You may trigger a response to this
     * with elicitResponse(). Unlike real voice input, this method bypasses audio processing and transcription
     * services.
     *
     * @param player - The player who is simulated to be speaking to the NPC.
     * @param transcription - The text content that represents what the player or npc said. This should be
     * natural, conversational text as if spoken aloud.
     */
    addResponse(player: Player, transcription: string): Promise<void>;
    /**
     * Inform the model of events that happened around it. The event itself should be a fact that can't be undone.
     * The NPC won't keep track of the time sequence of what happened here.
     *
     * There's no removeEventPerception because once the event being added, it's persisted in NPC memory and
     * it's not possible to remove one particular event.{@link resetMemory} can be used to clear all the previous memory of the NPC.
     *
     * @param eventDescription - The detailed description of what happened. Good example, "The vase is broken.", "A plane has
     * landed in the airport",or "an earthquake just happened". A BAD example of the usage of this event would be some transient events.
     * You should use `setDynamicContext` to track the state of a certain player, like "Player A has entered the shop with a ball in his hand".
     */
    addEventPerception(eventDescription: string): Promise<void>;
    /**
     * Updates the model with dynamically changing states, such as environmental conditions or state changing events.
     * This method will be used to track the status of the things around the NPC.
     *
     * NOTE: These should be human readable and descriptive. They help the NPC understand what is going on. A single word
     * descriptor like "winter" or "summer" is not enough. The NPC will have no context about the purpose of the word and
     * it will likely be ignored entirely. A better descriptor for a season might be "The season is currently winter".
     *
     * @param key - The key to the entry on the client-side.
     * @param value - The value to set for the key.
     *
     * For example, use setDynamicContext(key="playerX_relation", value="You are angry at player X because he interrupts other
     * players") to keep track of NPC's relationship with a certain player. Or Use setDynamicContext(key="soda_status", value="The soda in the store is sold out now.")
     * to keep track of the storage status of the soda.
     */
    setDynamicContext(key: string, value: string): Promise<void>;
    /**
     * Remove an existing dynamic context of a given key.
     *
     * @param key - The key to the entry.
     */
    removeDynamicContext(key: string): Promise<void>;
    /**
     * Remove all existing dynamic context being added in setDynamicContext.
     */
    clearDynamicContext(): Promise<void>;
    /**
     * Resets all current session memory of NPC without long term memory. Calling this method will result in NPC forgetting all previous interactions within the current world instance.
     * If this method is called while Long Term Memory is enabled within the NPC's configuration, it will override the previous long term memory id until the end of the session.
     *
     * Note: resetMemory also prevents the AI model response from degrading over time so please use this to reset in the logic to have a good response quality.
     */
    resetMemory(): Promise<void>;
    /**
     * Forces the NPC to immediately stop listening, speaking and performing any additional requests
     */
    stop(): Promise<void>;
    /**
     * Register a player as a conversation participant.
     * The NPC will automatically listen and respond to any player registered as a conversation participant, without the need make a call to {@link startListeningTo}
     * A given player must be looking at the NPC for that NPC to listen.
     *
     * @param player - The player to register.
     * @example
     * ```
     * const npc = this.entity.as(Npc);
     * // Listen for the OnPlayerEnterWorld event
     * this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterWorld, (player: Player) => {
     *    npc.conversation.registerParticipant(player);
     *  });
     * ```
     */
    registerParticipant(player: Player): Promise<void>;
    /**
     * Unregister a player as a conversation participant.
     * The NPC will no longer listen and respond to this player automatically.
     *
     * @param player - The player to unregister.
     *
     * @example
     * ```
     * // Listen for the OnPlayerExitWorld event
     * this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerExitWorld, (player: Player) => {
     *   npc.conversation.unregisterParticipant(player);
     * });
     * ```
     */
    unregisterParticipant(player: Player): Promise<void>;
    /**
     * Unregister all registered conversation participants.
     */
    unregisterAllParticipants(): Promise<void>;
    /**
     * Get all currently registered conversation participants.
     *
     * @returns - An array of Players.
     */
    getRegisteredParticipants(): Promise<Array<Player>>;
    /**
     * Forces an idle NPC to engage with the specified player and enter the listening state.
     *
     * @remarks This method only makes the NPC listen to the player once.
     * After the NPC responds, they won't listen to the Player unless they're been registered using the {@link registerParticipant} method or {@link startListeningTo} is called again.
     *
     * @param player - The player to engage
     * @param responseTrigger - Determines the conditions required to trigger a response from the NPC
     */
    startListeningTo(player: Player, responseTrigger: ConversationResponseTrigger): Promise<void>;
    /**
     * Forces an NPC to stop listening to the engaged player and respond.
     *
     * @remarks Has no effect if the NPC is not currently listening to anyone.
     */
    stopListening(): Promise<void>;
    /**
     * Assign a Text Gizmo to display conversation text
     * @param target - The Text Gizmo to display text on
     * @param targetType - The type of conversation text to display on the Text Gizmo
     */
    setSpeechBubbleTarget(target: TextGizmo, targetType: SpeechBubbleTargetType): Promise<void>;
    /**
     * Check if Conversational AI functionality is available in the current World Instance.
     *
     * @returns - A promise that resolves to true if AI is available, false otherwise
     */
    static isAiAvailable(): Promise<boolean>;
    /**
     * Manages a collection of dynamic actions for an NPC, providing methods to
     * add, remove, retrieve, and synchronize actions with the NPC's AI context.
     */
    private ActionSystem;
}
/**
 * A player associated with an NPC.
 */
export declare class NpcPlayer extends Player {
    /**
     * @param id - The ID of the player.
     * @param entity - An optional NPC Gizmo entity associated with the player.
     * @returns The new player.
     */
    constructor(id: number, entity?: Entity);
    /**
     * The current locomotion target of the NPC. Undefined if the NPC isn't currently moving.
     */
    targetPosition: ReadableHorizonProperty<Vec3 | undefined>;
    /**
     * The current target direction of the NPC. Undefined if the NPC isn't currently rotating to a specific target direction.
     */
    targetDirection: ReadableHorizonProperty<Vec3 | undefined>;
    /**
     * Indicates whether the NPC is moving.
     */
    isMoving: ReadableHorizonProperty<boolean>;
    /**
     * Gets the entity currently held by the specified hand.
     * @param handedness - The hand to query.
     * @returns - The held entity or undefined if not holding anything.
     */
    getGrabbedEntity(handedness: Handedness): Entity | undefined;
    /**
     * Commands the NPC to pick up an entity.
     * @param handedness - The hand to pick up the entity with.
     * @param entity - The entity to grab. The entity must be grabbable.
     * @returns - A promise describing how the grabbing action ended.
     */
    grab(handedness: Handedness, entity: Entity): Promise<NpcGrabActionResult>;
    /**
     * Commands an NPC to drop a held item.
     * @param handedness - The hand to drop the item from.
     */
    drop(handedness: Handedness): void;
    /**
     * Play an Emote on the Player's avatar once. The Emote is composed of an Avatar animation and accompanying particle and sound effects.
     * @param emote - The Emote to play
     */
    playEmote(emote: EmoteName): Promise<boolean>;
    /**
     * Set the target to look at for the NPC.
     * @param target - The target to look at. It is a position in vector format.
     */
    setLookAtTarget(target: Vec3): void;
    /**
     * Clear the look at target for the NPC.
     */
    clearLookAtTarget(): void;
    /**
     * Fetch the current look at target for the NPC.
     */
    getLookAtTarget(): Vec3;
    /**
     * Add an NpcAttentionTarget (player or entity) as an attention Target.
     *
     * @remarks
     * For AI Conversational NPCs, attention targets define things in the scene (players or entities) that the NPC may look at.
     * For example, when the NPC is speaking to a player, the NPC will only look at that player if they are added as an attention target.
     * The NPC has an internal system to determine what, from among its attention targets, it will look at at a given time.
     * Making a call to setLookAtTarget will override attention targets.
     *
     * @param target - NpcAttentionTarget to be added as attention target.
     */
    addAttentionTarget(target: NpcAttentionTarget): void;
    /**
     * Remove NpcAttentionTarget (player or entity) as an attention Target.
     *
     * @param player - NpcAttentionTarget to be removed as attention target.
     */
    removeAttentionTarget(target: NpcAttentionTarget): void;
    /**
     * Remove all attention targets.
     */
    removeAllAttentionTargets(): void;
    /**
     * Get the current attention target. This is whatever the NPC has decided to look at at this moment.
     *
     * @returns - The current attention target as an NpcAttentionTarget (player or entity).
     */
    getCurrentAttentionTarget(): NpcAttentionTarget | undefined;
    /**
     * Get the set of all attention targets that have been added through addAttentionTarget().
     *
     * @returns - A promise that resolves to an array of all this NPC's NpcAttentionTargets
     */
    getAllAttentionTargets(): Array<NpcAttentionTarget>;
}
/**
 * Represents an NPC with LLM-powered conversation capabilities that support audio
 * and transcription.
 *
 * @remarks
 * Conversation functionality must be enabled before using conversation capabilities.
 */
export declare class Npc extends Entity {
    /**
     * The object that manages the conversation of the NPC.
     */
    readonly conversation: NpcConversation;
    /**
     * A string representation of the `Npc` object in the format `[Npc] id` where
     * `id` is the identifier of the object.
     */
    toString(): string;
    /**
     * Indicates whether conversation capabilities are enabled for the `Npc` object.
     *
     * @return
     * True if conversation is enabled; false otherwise.
     */
    isConversationEnabled(): boolean;
    /**
     * Get the NpcPlayer associated with this NPC.
     * Only NPCs with the Horizon Avatar Body Type will have an associated NpcPlayer.
     *
     * @returns A promise that resolves to an NpcPlayer instance once initialization completes, or undefined if this NPC lacks an NpcPlayer component.
     */
    tryGetPlayer(): Promise<NpcPlayer | undefined>;
    /**
     * Spawns a player controlled by the `NpcPlayer` object.
     *
     * @returns A promise describing the results of the spawn operation.
     */
    spawnPlayer(): Promise<NpcPlayerSpawnResult>;
    /**
     * Despawns the player controlled by the `NpcPlayer` object.
     */
    despawnPlayer(): void;
    /**
     * Returns the `NpcGizmo` that is associated with the provided player.
     * @param player - The player.
     * @returns The gizmo, or undefined if no gizmo is associated with the player.
     */
    static getGizmoFromPlayer(player: Player): Npc | undefined;
    /**
     * Indicates whether the provided player is an NPC.
     * @param player - The player to check.
     * @returns `true` if the player is an NPC, `false` otherwise.
     */
    static playerIsNpc(player: Player): boolean;
}
/**
 * Definition of an action parameter that describes what input is expected
 * for a dynamic action. Used to configure parameters for AI-generated actions.
 *
 * @example
 * {
 *   name: 'action',
 *   description: 'The action to do with the entity',
 * }
 */
export declare type ActionParameterDefinition = {
    /** The name/identifier of the parameter */
    name: string;
    /** Optional description explaining what this parameter represents */
    description?: string;
};
/**
 * An actual parameter value passed to an action during execution.
 * Contains both the parameter name and its concrete value.
 *
 */
export declare type ActionParameter = {
    /** The name/identifier of the parameter */
    name: string;
    /** The actual value being passed for this parameter */
    value: string;
};
/**
 * An example that demonstrates how a specific action should behave.
 * Used to train the AI on proper action usage and expected responses.
 *
 * @example
 * {
 *   query: 'Give me 6 bananas',
 *   context: 'I am currently holding 12 bananas that I can give the user.',
 *   response: 'Here you go!',
 *   // Example of how the action extracts parameters from the query
 *   output_parameters: [
 *     {
 *       name: 'action',
 *       value: 'give',
 *     },
 *     {
 *       name: 'entity',
 *       value: 'bananas',
 *     },
 *     {
 *       name: 'quantity',
 *       value: '6',
 *     }
 *   ]
 * }
 */
export declare type ActionExample = {
    /** The user's input query that triggers this example */
    query: string;
    /** The contextual information describing how the NPC might perceive the world when this action gets called.
     * This helps the NPC understand when it might return this particular example due to the provided user input.
     * @example "I'm currently holding 12 bananas. I can give any number of them away" */
    context: string;
    /** The expected response text from the NPC */
    response: string;
    /** Parameters that should be extracted and passed to the action callback */
    output_parameters: ActionParameter[];
};
/**
 * Represents a dynamic action that an NPC can perform in response to user interactions.
 * Actions can be defined with parameters, examples, and callback functions to enable
 * AI-powered NPC behavior with custom logic execution.
 *
 * @example
 * const action = {
 *   name: 'Subject',
 *   description: 'Triggered when someone asks you to do something with some quantity of things.',
 *   // Define the parameters this action can extract from user input
 *   action_parameters: [
 *     {
 *       name: 'action',
 *       description: 'The action to do with the entity',
 *     },
 *     {
 *       name: 'entity',
 *       description: 'The entity to do something with',
 *     },
 *     {
 *       name: 'quantity',
 *       description: 'The quantity of things to do something with',
 *     }
 *   ],
 *   examples: [
 *     {
 *       query: 'Give me 6 bananas',
 *       context: 'I am currently holding 12 bananas that I can give the user.',
 *       response: 'Here you go!',
 *       // Example of how the action extracts parameters from the query
 *       output_parameters: [
 *         {
 *           name: 'action',
 *           value: 'give',
 *         },
 *         {
 *           name: 'entity',
 *           value: 'bananas',
 *         },
 *         {
 *           name: 'quantity',
 *           value: '6',
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * npc.conversation.actions.setAction(action);
 */
export declare type Action = {
    /** Unique identifier for the action */
    name: string;
    /** Optional description explaining what this action does */
    description?: string;
    /** Parameters that this action expects to receive */
    action_parameters?: ActionParameterDefinition[];
    /** Training examples showing how this action should be used */
    examples?: ActionExample[];
    /** Callback function to execute when this action is triggered by the AI (not sent to AI) */
    callback?: (parameters: any) => void;
};
/**
 * Container for a collection of dynamic actions that can be used by an NPC.
 * This structure is serialized and sent to the AI to inform it about available actions.
 */
export declare type DynamicActions = {
    /** General description of what these actions enable */
    description?: string;
    /** Array of available actions the NPC can perform */
    actions?: Action[];
};
export declare type ActionSystem = InstanceType<NpcConversation['ActionSystem']>;

}