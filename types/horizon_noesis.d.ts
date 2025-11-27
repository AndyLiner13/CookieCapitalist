declare module 'horizon/noesis' {
/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @format
 */
import { Entity } from 'horizon/core';
import { ImageSource } from 'horizon/ui';
/**
 * Type of data context which can be passed to a NoesisUI gizmo
 * for bindings in the UI.
 */
export declare type IUiViewModelObject = {
    [key: string]: IUiViewModel;
};
export declare type IUiViewModel = IUiViewModelObject | number | string | IUiViewModel[] | Map<string | number, IUiViewModel> | ((parameter?: unknown) => unknown) | ImageSource | null;
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
}

}