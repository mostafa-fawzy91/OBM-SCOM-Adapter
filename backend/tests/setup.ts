import { config as loadEnv } from 'dotenv';
import { configService } from '@/config/config.service';

loadEnv({ path: process.env.TEST_ENV_PATH ?? '.env.test', quiet: true });

jest.setTimeout(30000);

beforeAll(async () => {
  try {
    await configService.initialize('tests/__fixtures__/config.valid.yaml');
  } catch (error) {
    if ((error as Error).message !== 'Configuration file not found at tests/__fixtures__/config.valid.yaml') {
      throw error;
    }
  }
});
