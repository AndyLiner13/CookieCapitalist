declare module 'horizon/noesis' {
/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @format
 */
import { Asset, Entity } from 'horizon/core';
import { ImageSource } from 'horizon/ui';
/**
 * Type of data context which can be passed to a NoesisUI gizmo
 * for bindings in the UI.
 */
export declare type IUiViewModelObject = {
    [key: string]: IUiViewModel;
};
/**
 * Types supported in Noesis data context
 */
export declare type IUiViewModel = IUiViewModelObject | boolean | number | string | IUiViewModel[] | Map<string | number, IUiViewModel> | ((parameter?: unknown) => unknown) | ImageSource | NoesisAssetResource | null;
/**
 * A Noesis bundle {@link Asset | asset}, with XAMLs, images and other resources
 * needed to render a Noesis UI.
 */
export declare class NoesisAsset extends Asset {
    private readonly _magicType;
    /**
     * @returns A resource in the Noesis asset with the given name if exists, otherwise null.
     */
    getResource(name: string): NoesisAssetResource | null;
    /**
     *
     * @returns All resources in the Noesis asset.
     */
    getResources(): NoesisAssetResource[] | null;
    /**
     * Gets a human readable representation of the Noesis asset.
     * @returns A string representation of the Noesis asset.
     */
    toString(): string;
}
/**
 * A resource (file) in a {@link NoesisAsset | Noesis bundle asset}.
 */
export declare class NoesisAssetResource {
    private readonly _magicType;
    readonly noesisAsset: NoesisAsset;
    readonly name: string;
}
/**
 * Represents NoesisUI gizmo
 */
export declare class NoesisGizmo extends Entity {
    /**
     * Creates a human-readable representation of the entity.
     * @returns A string representation
     */
    toString(): string;
    get dataContext(): IUiViewModelObject;
    set dataContext(dataModel: IUiViewModelObject);
    getAsset(): NoesisAsset | null;
    /**
     * Controls the local visibility of the Noesis UI entity for the calling client only.
     *
     * @param visible - True to show the entity, false to hide it locally.
     *
     * @remarks
     * This method controls whether the Noesis UI is rendered on the calling client.
     * The visibility state does not affect other players - each client independently controls
     * which Noesis UIs they see. This is particularly useful for Noesis UI in **shared script mode**,
     * where each player can independently control whether they see UI elements.
     *
     * Unlike `setVisibilityForPlayers()`, this does NOT modify networked state and changes
     * are NOT synchronized across clients. Each client independently tracks which Noesis UIs
     * they have hidden locally.
     *
     * - If you need network-synchronized visibility control, use `setVisibilityForPlayers()` instead.
     *
     * @example
     * ```
     * // Get the Noesis UI entity and hide it locally
     * const noesisUI = world.getEntityByName("MyNoesisUI") as NoesisGizmo;
     * if (noesisUI) {
     *   noesisUI.setLocalEntityVisibility(false); // Hide for this client only
     *   // Later, show it again
     *   noesisUI.setLocalEntityVisibility(true); // Show for this client only
     * }
     * ```
     *
     * @see {@link setVisibilityForPlayers} for network-synchronized visibility control
     */
    setLocalEntityVisibility(visible: boolean): void;
}

}