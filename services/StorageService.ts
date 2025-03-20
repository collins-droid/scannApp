import AsyncStorage from '@react-native-async-storage/async-storage';
import LoggingService from './LoggingService';

/**
 * Service for handling app storage needs
 */
export default class StorageService {
  private static instance: StorageService;
  private logger: LoggingService;

  /**
   * Get the singleton instance of StorageService
   */
  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Initialize the storage service
   */
  private constructor() {
    this.logger = LoggingService.getInstance();
  }

  /**
   * Store an item in storage
   * @param key Storage key
   * @param value Value to store
   */
  public async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      this.logger.error(`Error storing item with key ${key}`, error);
      throw error;
    }
  }

  /**
   * Get an item from storage
   * @param key Storage key
   * @returns Value or null if not found
   */
  public async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      this.logger.error(`Error retrieving item with key ${key}`, error);
      throw error;
    }
  }

  /**
   * Store an object in storage by serializing it to JSON
   * @param key Storage key
   * @param value Object to store
   */
  public async storeObject<T>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await this.setItem(key, jsonValue);
    } catch (error) {
      this.logger.error(`Error storing object with key ${key}`, error);
      throw error;
    }
  }

  /**
   * Get an object from storage by parsing it from JSON
   * @param key Storage key
   * @returns Parsed object or null if not found
   */
  public async getObject<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await this.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) as T : null;
    } catch (error) {
      this.logger.error(`Error retrieving object with key ${key}`, error);
      throw error;
    }
  }

  /**
   * Remove an item from storage
   * @param key Storage key
   */
  public async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      this.logger.error(`Error removing item with key ${key}`, error);
      throw error;
    }
  }

  /**
   * Clear all storage
   */
  public async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      this.logger.error('Error clearing storage', error);
      throw error;
    }
  }

  /**
   * Get all keys in storage
   * @returns Array of keys
   */
  public async getAllKeys(): Promise<readonly string[]> {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      this.logger.error('Error getting all keys', error);
      throw error;
    }
  }

  /**
   * Get multiple items at once
   * @param keys Array of keys
   * @returns Array of [key, value] pairs
   */
  public async multiGet(keys: readonly string[]): Promise<readonly [string, string | null][]> {
    try {
      return await AsyncStorage.multiGet(keys);
    } catch (error) {
      this.logger.error('Error retrieving multiple items', error);
      throw error;
    }
  }

  /**
   * Store multiple items at once
   * @param keyValuePairs Array of [key, value] pairs
   */
  public async multiSet(keyValuePairs: readonly [string, string][]): Promise<void> {
    try {
      await AsyncStorage.multiSet(keyValuePairs as [string, string][]);
    } catch (error) {
      this.logger.error('Error storing multiple items', error);
      throw error;
    }
  }

  /**
   * Remove multiple items at once
   * @param keys Array of keys
   */
  public async multiRemove(keys: readonly string[]): Promise<void> {
    try {
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      this.logger.error('Error removing multiple items', error);
      throw error;
    }
  }

  /**
   * Store multiple key-value pairs
   * @param items Array of [key, value] pairs to store
   */
  public async storeMultiple(items: readonly [string, string][]): Promise<void> {
    try {
      // Convert readonly array to mutable array
      const mutableItems = items.map(([key, value]) => [key, value] as [string, string]);
      await AsyncStorage.multiSet(mutableItems);
    } catch (error) {
      console.error('Error storing multiple items:', error);
      throw error;
    }
  }
} 