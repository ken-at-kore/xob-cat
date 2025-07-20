import { jest } from '@jest/globals';
import { ConfigManager, BotConfig } from '../../utils/configManager';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

// Mock the modules
jest.mock('fs');
jest.mock('js-yaml');
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockYaml = yaml as jest.Mocked<typeof yaml>;

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const mockConfig: BotConfig = {
    kore: {
      bot_id: 'test-bot-id',
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
      base_url: 'https://bots.kore.ai',
      name: 'Test Bot'
    }
  };

  beforeEach(() => {
    configManager = ConfigManager.getInstance();
    configManager.clearConfig(); // Reset for each test
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('loadConfig', () => {
    it('should load configuration from YAML file successfully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock yaml content');
      mockYaml.load.mockReturnValue(mockConfig);

      const result = configManager.loadConfig();

      expect(mockFs.existsSync).toHaveBeenCalledWith(expect.stringContaining('config/optum-bot.yaml'));
      expect(mockFs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('config/optum-bot.yaml'), 'utf8');
      expect(mockYaml.load).toHaveBeenCalledWith('mock yaml content');
      expect(result).toEqual(mockConfig);
    });

    it('should return cached config on subsequent calls', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock yaml content');
      mockYaml.load.mockReturnValue(mockConfig);

      // First call
      configManager.loadConfig();
      // Second call
      const result = configManager.loadConfig();

      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockConfig);
    });

    it('should throw error when config file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => configManager.loadConfig()).toThrow('Configuration file not found');
    });

    it('should throw error when required credentials are missing', () => {
      const invalidConfig = {
        kore: {
          bot_id: 'test-bot-id',
          // Missing client_id and client_secret
          base_url: 'https://bots.kore.ai',
          name: 'Test Bot'
        }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock yaml content');
      mockYaml.load.mockReturnValue(invalidConfig);

      expect(() => configManager.loadConfig()).toThrow('Missing required Kore.ai credentials');
    });

    it('should load config from custom path', () => {
      const customPath = '/custom/path/config.yaml';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock yaml content');
      mockYaml.load.mockReturnValue(mockConfig);

      configManager.loadConfig(customPath);

      expect(mockFs.existsSync).toHaveBeenCalledWith(customPath);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(customPath, 'utf8');
    });
  });

  describe('getKoreConfig', () => {
    it('should return Kore configuration', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock yaml content');
      mockYaml.load.mockReturnValue(mockConfig);

      const result = configManager.getKoreConfig();

      expect(result).toEqual(mockConfig.kore);
    });

    it('should load config if not already loaded', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock yaml content');
      mockYaml.load.mockReturnValue(mockConfig);

      const result = configManager.getKoreConfig();

      expect(mockFs.existsSync).toHaveBeenCalled();
      expect(result).toEqual(mockConfig.kore);
    });
  });

  describe('isConfigLoaded', () => {
    it('should return false when config is not loaded', () => {
      expect(configManager.isConfigLoaded()).toBe(false);
    });

    it('should return true when config is loaded', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock yaml content');
      mockYaml.load.mockReturnValue(mockConfig);

      configManager.loadConfig();

      expect(configManager.isConfigLoaded()).toBe(true);
    });
  });

  describe('clearConfig', () => {
    it('should clear the loaded configuration', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock yaml content');
      mockYaml.load.mockReturnValue(mockConfig);

      configManager.loadConfig();
      expect(configManager.isConfigLoaded()).toBe(true);

      configManager.clearConfig();
      expect(configManager.isConfigLoaded()).toBe(false);
    });
  });
}); 