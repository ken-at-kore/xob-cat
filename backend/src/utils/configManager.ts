import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface BotConfig {
  kore: {
    bot_id: string;
    client_id: string;
    client_secret: string;
    base_url: string;
    name: string;
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: BotConfig | null = null;

  private constructor() {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from YAML file
   */
  public loadConfig(configPath?: string): BotConfig {
    if (this.config) {
      return this.config;
    }

    const configFile = configPath || path.join(__dirname, '../../config/optum-bot.yaml');
    
    try {
      if (!fs.existsSync(configFile)) {
        throw new Error(`Configuration file not found: ${configFile}`);
      }

      const fileContents = fs.readFileSync(configFile, 'utf8');
      this.config = yaml.load(fileContents) as BotConfig;

      if (!this.config?.kore?.bot_id || !this.config?.kore?.client_id || !this.config?.kore?.client_secret) {
        throw new Error('Missing required Kore.ai credentials in configuration file');
      }

      console.log(`✅ Loaded configuration for: ${this.config.kore.name}`);
      return this.config;
    } catch (error) {
      console.error('❌ Error loading configuration:', error);
      throw error;
    }
  }

  /**
   * Get Kore.ai configuration
   */
  public getKoreConfig() {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config!.kore;
  }

  /**
   * Check if configuration is loaded
   */
  public isConfigLoaded(): boolean {
    return this.config !== null;
  }

  /**
   * Clear configuration (for testing)
   */
  public clearConfig(): void {
    this.config = null;
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance(); 