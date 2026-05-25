import { execSync } from 'child_process';

const port = process.argv[2] ?? '3000';

try {
  execSync(`lsof -ti :${port} | xargs kill -9`, { stdio: 'ignore' });
  console.log(`✅ Freed port ${port}`);
} catch {
  console.log(`ℹ️  Port ${port} is already free`);
}
