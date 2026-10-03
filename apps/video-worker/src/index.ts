import { workerConfig } from './config.js';
import { WorkerAgent } from './agent/worker-agent.js';
import * as fs from 'node:fs';

async function bootstrap() {
  console.log('====================================================');
  console.log('       PACKING VIDEO PROOF - VIDEO WORKER DAEMON    ');
  console.log('====================================================');
  console.log(`Station Code: ${workerConfig.stationCode}`);
  console.log(`Temp Dir:     ${workerConfig.tempDir}`);
  console.log(`Archive Dir:  ${workerConfig.archiveDir}`);
  console.log(`NAS Dir:      ${workerConfig.nasDir}`);

  // 1. Ensure required storage directories exist
  for (const dir of [workerConfig.tempDir, workerConfig.archiveDir, workerConfig.journalDir]) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.warn(`[Bootstrap] Warning: Could not create directory ${dir}:`, err);
      }
    }
  }

  // 2. Verified Station ID
  console.log(`Station ID:   ${workerConfig.stationId}`);

  // 3. Start Agent
  const agent = new WorkerAgent();
  await agent.start();

  process.on('SIGINT', () => {
    console.log('Stopping Worker Daemon gracefully...');
    agent.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Terminating Worker Daemon...');
    agent.stop();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal Worker Error:', err);
  process.exit(1);
});
