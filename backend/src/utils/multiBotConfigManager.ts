import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface KoreConfig {
  bot_id: string;
  client_id: string;
  client_secret: string;
  base_url?: string;
}

export interface BotConfig {
  name: string;
  kore: KoreConfig;
}

export interface BotsConfiguration {
  bots: {
    default: string;
    configs: {
      [botKey: string]: BotConfig;
    };
  };
}

export class MultiBotConfigManager {
  private static instance: MultiBotConfigManager;
  private config: BotsConfiguration | null = null;
  private configPath: string;

  private constructor() {
    this.configPath = path.join(__dirname, '../../config/bots.yaml');
  }

  public static getInstance(): MultiBotConfigManager {
    if (!MultiBotConfigManager.instance) {
      MultiBotConfigManager.instance = new MultiBotConfigManager();
    }
    return MultiBotConfigManager.instance;
  }

  /**
   * Load configuration from YAML file
   */
  public loadConfig(configPath?: string): BotsConfiguration {
    if (this.config) {
      return this.config;
    }

    const configFile = configPath || this.configPath;
    
    try {
      // First, try to load the new multi-bot config
      if (fs.existsSync(configFile)) {
        const fileContents = fs.readFileSync(configFile, 'utf8');
        this.config = yaml.load(fileContents) as BotsConfiguration;

        if (!this.config?.bots?.configs) {
          throw new Error('Invalid configuration file format');
        }

        console.log(`✅ Loaded multi-bot configuration with ${Object.keys(this.config.bots.configs).length} bots`);
        return this.config;
      }

      // Fallback: Try to load legacy single-bot config
      const legacyConfigFile = path.join(__dirname, '../../config/optum-bot.yaml');
      if (fs.existsSync(legacyConfigFile)) {
        console.log('⚠️  Loading legacy single-bot configuration. Consider migrating to bots.yaml');
        const fileContents = fs.readFileSync(legacyConfigFile, 'utf8');
        const legacyConfig = yaml.load(fileContents) as any;
        
        // Convert legacy format to new format
        this.config = {
          bots: {
            default: 'optum',
            configs: {
              optum: {
                name: legacyConfig.kore.name || 'Optum Bot',
                kore: {
                  bot_id: legacyConfig.kore.bot_id,
                  client_id: legacyConfig.kore.client_id,
                  client_secret: legacyConfig.kore.client_secret,
                  base_url: legacyConfig.kore.base_url
                }
              }
            }
          }
        };
        
        return this.config;
      }

      throw new Error(`Configuration file not found. Please create ${configFile} from bots.example.yaml`);
    } catch (error) {
      console.error('❌ Error loading configuration:', error);
      throw error;
    }
  }

  /**
   * Get configuration for a specific bot
   */
  public getBotConfig(botKey?: string): BotConfig {
    if (!this.config) {
      this.loadConfig();
    }

    const key = botKey || this.config!.bots.default;
    const botConfig = this.config!.bots.configs[key];

    if (!botConfig) {
      throw new Error(`Bot configuration not found for: ${key}`);
    }

    return botConfig;
  }

  /**
   * Get Kore.ai configuration for a specific bot
   */
  public getKoreConfig(botKey?: string): KoreConfig & { name: string } {
    const botConfig = this.getBotConfig(botKey);
    return {
      ...botConfig.kore,
      base_url: botConfig.kore.base_url || 'https://bots.kore.ai',
      name: botConfig.name
    };
  }

  /**
   * Get list of available bot keys
   */
  public getAvailableBots(): string[] {
    if (!this.config) {
      this.loadConfig();
    }
    return Object.keys(this.config!.bots.configs);
  }

  /**
   * Get default bot key
   */
  public getDefaultBot(): string {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config!.bots.default;
  }

  /**
   * Check if a bot exists
   */
  public botExists(botKey: string): boolean {
    if (!this.config) {
      this.loadConfig();
    }
    return botKey in this.config!.bots.configs;
  }

  /**
   * Clear configuration (for testing)
   */
  public clearConfig(): void {
    this.config = null;
  }
}

// Export singleton instance
export const multiBotConfigManager = MultiBotConfigManager.getInstance();