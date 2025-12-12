declare module 'horizon/portrait_camera' {
/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @format
 */
import { ReadableHorizonProperty } from 'horizon/core';
import { Camera } from 'horizon/camera';
/**
 * The orientation of the camera
 */
export declare enum CameraOrientation {
    /**
     * Camera is set to be in landscape orientation
     */
    Landscape = 0,
    /**
     * Camera is set to be in portrait orientation
     */
    Portrait = 1
}
export declare class PortraitCamera extends Camera {
    /**
     * The orientation of camera.
     */
    currentOrientation: ReadableHorizonProperty<CameraOrientation>;
}

}