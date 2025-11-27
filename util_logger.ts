// #region 📋 README
// Logger utility for function-level console logging
// 
// Usage - Each function explicitly declares if logging is active:
//   import { Logger } from './util_logger';
//   const log = new Logger('MyComponent');
//   
//   myFunction() {
//     const log = this.log.active('myFunction');  // Enable all logging
//     log.info('Hello world');      // Logs
//     log.warn('Warning message');  // Logs
//     log.error('Error message');   // Logs
//   }
//   
//   otherFunction() {
//     const log = this.log.active('otherFunction');  // Active - logs everything
//     log.info('This appears');   // Logs
//     log.warn('This appears');   // Logs
//     // log.error('Not needed');  // Just delete logs you don't want
//   }
//   
//   silentFunction() {
//     const log = this.log.inactive('silentFunction');  // Completely silent
//     log.info('Silent');   // Blocked
//     log.warn('Silent');   // Blocked
//     log.error('Silent');  // Blocked
//   }
// #endregion

// #region 🏷️ Type Definitions
// Function logger interface - returned by active/inactive methods
interface FunctionLogger {
  active: boolean;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
// #endregion

export class Logger {
  // #region 📊 State
  private file: string;
  // #endregion

  // #region 🔄 Lifecycle Events
  // Create a new logger instance
  // @param file - Component/file name (e.g., "manager_players", "controller_player")
  constructor(file: string) {
    this.file = file;
  }
  // #endregion

  // #region 🔌 Public API
  // Create an active function logger (logs info, warn, error)
  active(functionName: string): FunctionLogger {
    return this.createFunctionLogger(functionName, true);
  }

  // Create an inactive function logger (logs nothing)
  inactive(functionName: string): FunctionLogger {
    return this.createFunctionLogger(functionName, false);
  }
  // #endregion

  // #region 🛠️ Helper Methods
  private createFunctionLogger(functionName: string, isActive: boolean): FunctionLogger {
    const file = this.file;
    
    // Create logger object
    const logger: FunctionLogger = {
      active: isActive,
      
      info: (message: string) => {
        if (isActive) {
          const timestamp = Date.now();
          console.log(`🪵 | ${file}[${functionName}] | xX_${timestamp}_Xx | ${message}`);
        }
      },
      
      warn: (message: string) => {
        if (isActive) {
          const timestamp = Date.now();
          console.warn(`⚠️ | ${file}[${functionName}] | xX_${timestamp}_Xx | ${message}`);
        }
      },
      
      error: (message: string) => {
        if (isActive) {
          const timestamp = Date.now();
          console.error(`🚨 | ${file}[${functionName}] | xX_${timestamp}_Xx | ${message}`);
        }
      }
    };
    
    return logger;
  }
  // #endregion
}
