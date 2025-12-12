declare module 'horizon/editor' {
/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @format
 */
import { UINode, Callback, Bindable, ColorValue, CallbackWithPayload } from 'horizon/ui';
/**
 * The name of the API.
 */
export declare const ApiName = "editing";
/**
 * The API for editing a world in Desktop Editor.
 *
 * @remarks Running the editor in play mode is no longer supported, so use these APIs instead.
 */
declare class EditorAPI {
}
export declare const Editor: EditorAPI;
/**
 * The props of an {@link EditorButton} component.
 */
export declare type EditorButtonProps = {
    /**
     * The nested children components. Can be a single UINode or an array of UINodes.
     */
    text?: Bindable<string>;
    /**
     * Indicates whether the component is disabled. If `true`, the `onClick` and `onRelease` callbacks are disabled. The default value is `false`.
     */
    disabled?: Bindable<boolean>;
    /**
     * Called when the player presses the controller trigger or a mouse button.
     */
    onPress: Callback;
};
/**
 * Creates an EditorButton component, which represents a button element in the
 * editor and specifies the behavior for the onPress event.
 *
 * @param props - The props of the component.
 *
 * @returns A {@link UINode | https://horizon.meta.com/resources/scripting-api/ui.uinode.md/?api_version=2.0.0}
 * that represents the EditorButton component.
 */
export declare function EditorButton(props: Readonly<EditorButtonProps>): UINode<EditorButtonProps>;
/**
 * The possible size and weight properties for a text element.
 */
export declare type TextType = 'XXLMedium' | 'XLMedium' | 'LMedium' | 'MLBold' | 'MLRegular' | 'MBold' | 'MRegular' | 'SBold' | 'SRegular' | 'XSRegular';
/**
 * The props of an {@link EditorText} component.
 */
export declare type EditorTextProps = {
    /**
     * The nested children components. Can be a single
     * {@link UINode | https://horizon.meta.com/resources/scripting-api/ui.uinode.md/?api_version=2.0.0}
     * or an array of UINodes.
     */
    text?: Bindable<string>;
    /**
     * The color of the text.
     */
    color?: Bindable<ColorValue>;
    /**
     * The text overflow behaviour.
     */
    overflow?: 'wrap' | 'ellipsis';
    /**
     * The horizontal alignment of the text.
     */
    textAlign?: 'auto' | 'left' | 'center' | 'right';
    /**
     * The type and size of the text.
     */
    type?: TextType;
};
/**
 * Creates an EditorText component, which represents a text element in the editor.
 *
 * @param props - The props of the component.
 *
 * @returns A {@link UINode | https://horizon.meta.com/resources/scripting-api/ui.uinode.md/?api_version=2.0.0}
 * that represents the EditorText component.
 */
export declare function EditorText(props: Readonly<EditorTextProps>): UINode<EditorTextProps>;
/**
 * The props of an {@link EditorTextInput} component.
 */
export declare type EditorTextInputProps = {
    /**
     * The callback that is triggered when the text changes.
     */
    onChangeText?: CallbackWithPayload;
    /**
     * The size of the text input.
     */
    size?: number;
    /**
     * true to render the text on multiple lines; false to render it on a single line.
     */
    multiline?: boolean;
};
/**
 * Creates an EditorTextInput component, which represents in a text input element in the editor.
 *
 * @param props - The props of the component.
 *
 * @returns A {@link UINode | https://horizon.meta.com/resources/scripting-api/ui.uinode.md/?api_version=2.0.0}
 * that represents the EditorTextInput component.
 */
export declare function EditorTextInput(props: Readonly<EditorTextInputProps>): UINode<EditorTextInputProps>;
export {};

}