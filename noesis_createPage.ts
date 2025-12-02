/**
 * @file noesis_createPage.ts
 * @description Controller for the CreatePage Noesis UI - manages countdown timers for upgrade nodes
 */

import { Component, Entity, World } from "horizon/core";
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";

//#region Type Definitions
/** Timer state for each upgrade node */
interface TimerState {
  /** Current time remaining in seconds */
  remaining: number;
  /** Total duration in seconds */
  duration: number;
}
//#endregion

class Default extends Component<typeof Default> {
  //#region Properties Definition
  static propsDefinition = {};
  //#endregion

  //#region Private Properties
  /** Reference to the NoesisGizmo for UI updates */
  private noesisGizmo: NoesisGizmo | null = null;
  
  /** Duration for each progress bar in seconds (matches XAML animation: 7.5s) */
  private readonly TIMER_DURATION = 7.5;
  
  /** Update interval in milliseconds */
  private readonly UPDATE_INTERVAL = 100;
  
  /** Timer states for each upgrade node */
  private timers: Map<string, TimerState> = new Map([
    ["planning", { remaining: 7.5, duration: 7.5 }],
    ["recording", { remaining: 7.5, duration: 7.5 }],
    ["editing", { remaining: 7.5, duration: 7.5 }],
    ["thumbnail", { remaining: 7.5, duration: 7.5 }],
    ["upload", { remaining: 7.5, duration: 7.5 }],
  ]);
  
  /** Total views counter */
  private totalViews = 123456789;
  
  /** Data context for Noesis UI bindings */
  private dataContext: IUiViewModelObject = {
    totalViews: "123,456,789 Views!",
    planningTimer: "7.5s",
    recordingTimer: "7.5s",
    editingTimer: "7.5s",
    thumbnailTimer: "7.5s",
    uploadTimer: "7.5s",
  };
  //#endregion

  //#region Lifecycle Methods
  /**
   * Called when the component starts
   */
  start(): void {
    this.noesisGizmo = this.entity.as(NoesisGizmo);
    
    if (this.noesisGizmo) {
      this.noesisGizmo.dataContext = this.dataContext;
      this.startTimerLoop();
    } else {
      console.error("[noesis_createPage] Failed to get NoesisGizmo from entity");
    }
  }
  //#endregion

  //#region Timer Management
  /**
   * Starts the timer update loop
   */
  private startTimerLoop(): void {
    const intervalSeconds = this.UPDATE_INTERVAL / 1000;
    
    this.async.setInterval(() => {
      this.updateTimers(intervalSeconds);
      this.updateDataContext();
    }, this.UPDATE_INTERVAL);
  }
  
  /**
   * Updates all timer states
   * @param deltaTime - Time elapsed since last update in seconds
   */
  private updateTimers(deltaTime: number): void {
    for (const [key, timer] of this.timers) {
      timer.remaining -= deltaTime;
      
      // Reset timer when it reaches 0
      if (timer.remaining <= 0) {
        timer.remaining = timer.duration;
      }
    }
  }
  
  /**
   * Updates the data context with current timer values
   */
  private updateDataContext(): void {
    if (!this.noesisGizmo) return;
    
    const planning = this.timers.get("planning")!;
    const recording = this.timers.get("recording")!;
    const editing = this.timers.get("editing")!;
    const thumbnail = this.timers.get("thumbnail")!;
    const upload = this.timers.get("upload")!;
    
    this.dataContext = {
      totalViews: this.formatViews(this.totalViews),
      planningTimer: this.formatTime(planning.remaining),
      recordingTimer: this.formatTime(recording.remaining),
      editingTimer: this.formatTime(editing.remaining),
      thumbnailTimer: this.formatTime(thumbnail.remaining),
      uploadTimer: this.formatTime(upload.remaining),
    };
    
    this.noesisGizmo.dataContext = this.dataContext;
  }
  //#endregion

  //#region Formatting Helpers
  /**
   * Formats time remaining as a string (e.g., "7.5s")
   * @param seconds - Time in seconds
   * @returns Formatted time string
   */
  private formatTime(seconds: number): string {
    return `${seconds.toFixed(1)}s`;
  }
  
  /**
   * Formats view count with commas (e.g., "123,456,789 Views!")
   * @param views - Number of views
   * @returns Formatted view count string
   */
  private formatViews(views: number): string {
    return `${views.toLocaleString()} Views!`;
  }
  //#endregion
}

Component.register(Default);
