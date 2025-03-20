/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Service for application logging
 */
export default class LoggingService {
  private static instance: LoggingService;
  private logLevel: LogLevel = LogLevel.INFO;
  private logListeners: ((level: LogLevel, message: string, data?: any) => void)[] = [];

  /**
   * Get the singleton instance of LoggingService
   */
  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param data Optional data to include
   */
  public debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param data Optional data to include
   */
  public info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Optional data to include
   */
  public warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param data Optional data to include
   */
  public error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Log a message at the specified level
   * @param level The log level
   * @param message The message to log
   * @param data Optional data to include
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (level < this.logLevel) {
      return;
    }

    // Create timestamp
    const timestamp = new Date().toISOString();
    
    // Format log message
    const formattedMessage = `[${timestamp}] ${this.getLevelString(level)}: ${message}`;
    
    // Log to console
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, data || '');
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, data || '');
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, data || '');
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, data || '');
        break;
    }
    
    // Notify listeners
    this.notifyListeners(level, message, data);
  }

  /**
   * Get string representation of log level
   * @param level The log level
   * @returns String representation
   */
  private getLevelString(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'DEBUG';
      case LogLevel.INFO:
        return 'INFO';
      case LogLevel.WARN:
        return 'WARN';
      case LogLevel.ERROR:
        return 'ERROR';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Notify log listeners
   * @param level Log level
   * @param message Log message
   * @param data Optional data
   */
  private notifyListeners(level: LogLevel, message: string, data?: any): void {
    for (const listener of this.logListeners) {
      try {
        listener(level, message, data);
      } catch (error) {
        console.error('Error in log listener:', error);
      }
    }
  }

  /**
   * Add a log listener
   * @param listener Listener function
   */
  public addListener(listener: (level: LogLevel, message: string, data?: any) => void): void {
    this.logListeners.push(listener);
  }

  /**
   * Remove a log listener
   * @param listener Listener function to remove
   */
  public removeListener(listener: (level: LogLevel, message: string, data?: any) => void): void {
    const index = this.logListeners.indexOf(listener);
    if (index !== -1) {
      this.logListeners.splice(index, 1);
    }
  }

  /**
   * Set the minimum log level
   * @param level Minimum log level
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get the current log level
   * @returns Current log level
   */
  public getLogLevel(): LogLevel {
    return this.logLevel;
  }
} 