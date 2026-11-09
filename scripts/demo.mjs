// Starts the dev server for Expo Go with sample AI answers, so the app can be tried on a phone
// without deploying the AI server. Works the same on macOS, Linux and Windows.
//
//   npm run demo                # phone and computer on the same Wi-Fi
//   npm run demo -- --tunnel    # any network
import { spawn } from 'node:child_process';

const child = spawn('npx', ['expo', 'start', '--go', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_PUBLIC_API_URL: 'demo' },
});
child.on('exit', (code) => process.exit(code ?? 0));
