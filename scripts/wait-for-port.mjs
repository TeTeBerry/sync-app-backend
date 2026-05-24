import net from 'net';

const host = process.argv[2] ?? 'localhost';
const port = parseInt(process.argv[3] ?? '27017', 10);
const timeoutMs = parseInt(process.argv[4] ?? '90000', 10);
const label = process.argv[5] ?? 'MongoDB';
const start = Date.now();

function tryConnect() {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve(true);
    });

    socket.on('error', reject);
    socket.setTimeout(2000, () => {
      socket.destroy();
      reject(new Error('timeout'));
    });
  });
}

async function main() {
  process.stdout.write(`Waiting for ${label} at ${host}:${port}`);

  while (Date.now() - start < timeoutMs) {
    try {
      await tryConnect();
      console.log('\n✅ Ready');
      return;
    } catch {
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.error(`\n❌ ${label} not available on ${host}:${port}`);
  console.error('Try: npm run infra:up');
  console.error('Or install MongoDB locally and ensure it listens on 27017.');
  process.exit(1);
}

main();
