import { SSIPClient } from './test-client.js';

const client = new SSIPClient();

try {
  await client.connect();

  console.log('\n--- Sending test commands ---\n');

  await new Promise(resolve => setTimeout(resolve, 100));
  client.getPowerStatus();

  await new Promise(resolve => setTimeout(resolve, 200));
  client.setPowerOn();

  await new Promise(resolve => setTimeout(resolve, 200));
  client.setVolume(50);

  await new Promise(resolve => setTimeout(resolve, 200));
  client.setMute(true);

  await new Promise(resolve => setTimeout(resolve, 200));
  client.setPowerOff();

  await new Promise(resolve => setTimeout(resolve, 500));
  client.disconnect();

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
