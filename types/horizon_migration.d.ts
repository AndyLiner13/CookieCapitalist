declare module 'horizon/migration' {
/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @format
 */
import { Player, ReadableHorizonProperty } from 'horizon/core';
/**
 * The type of mobile app the player is using to play Horizon.
 */
export declare enum MobileAppPlatform {
    /**
     * The player is not on a mobile device.
     */
    NOT_MOBILE = "NOT_MOBILE",
    /**
     * The player is playing through the dedicated Meta Horizon app
     */
    META_HORIZON = "META_HORIZON",
    /**
     * The player is playing through other Meta Apps like Facebook or Instagram.
     */
    META_OTHER = "META_OTHER"
}
/**
 * Options for customising the effect of calling the {@link PlayerMigration.migrateToHorizonApp} method.
 * @remarks
 * `migrationIdentifier` - (string) A unique identifier for the migration flow. If a player is tagged with an identifier, it will be returned as part of the {@link PlayerMigration.getMigrationData} method call. Default = ''
 * `destinationWorldId` - (string) The ID of the world the player should be migrated to. If not specified, the player will be migrated to the same world this was called from. Default = ''
 */
export declare type MigrationOptions = {
    migrationIdentifier?: string | null;
    destinationWorldId?: string | null;
};
/**
 * The default values for the {@link MigrationOptions} type, used when no options are provided to the {@link PlayerMigration.migrateToHorizonApp} method.
 *
 * @remarks
 * `migrationIdentifier` - ''
 * `destinationWorldId` - ''
 */
export declare const DefaultMigrationOptions: MigrationOptions;
/**
 * The data returned from the {@link PlayerMigration.getMigrationData} method.
 *
 * @remarks
 * `migrationIdentifier` - (string) A unique identifier for the migration flow. Set via the {@link PlayerMigration.migrateToHorizonApp} method, can be empty/null if none set during migration.
 * `hasMigrated` - (boolean) Whether the player has migrated to the Meta Horizon app.
 */
export declare type MigrationData = {
    migrationIdentifier: string | null;
    hasMigrated: boolean | null;
};
/**
 * The base class for all players in the world.
 */
export declare class PlayerMigration extends Player {
    /**
     * Gets the type of mobile app player is using to play Horizon.
     *
     * @remarks New device types may be added in the future, so you should handle
     * this property with a switch statement.
     */
    mobileAppPlatform: ReadableHorizonProperty<MobileAppPlatform>;
    /**
     * Trigger the migration flow for the player. Should be called from a positive user action (e.g. button press to confirm graduation)
     * This will likely exit the player from the world via the app store or deeplink to Meta Horizon app.
     *
     * @param options - Options to customise the data used to migrate the player. If not provided, the default values will be used.
     * @returns A promise that resolves `true` if the migration flow was successfully triggered, `false` otherwise.
     */
    migrateToHorizonApp(options?: Partial<MigrationOptions>): Promise<boolean>;
    /**
     * Indicates whether the player has graduated from the world on other Mobile App Platforms.
     * @param autoRewardPlayer - If true, the player will be tagged as rewarded for this migration flow.
     *
     * @returns `MigrationData` containing the `migrationIdentifier` (if set from {@link MigrateToHorizonApp}) and `hasMigrated` dictating if the player was from the migration flow.
     */
    getMigrationData(autoRewardPlayer?: boolean): Promise<MigrationData>;
    /**
     * Specifies that the player has completed their migration to the Meta Horizon app.
     *
     * @returns A promise that resolves `true` if the migration flow was successfully completed, `false` otherwise.
     */
    setMigrationComplete(): Promise<boolean>;
}

}