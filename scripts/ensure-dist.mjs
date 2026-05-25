import { existsSync } from 'fs';
import { execSync } from 'child_process';

const mainPath = 'dist/main.js';

if (!existsSync(mainPath)) {
  console.log('dist/main.js missing — clean build...');
  execSync('npx rimraf dist && nest build', { stdio: 'inherit', shell: true });
}
