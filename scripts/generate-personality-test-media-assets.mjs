#!/usr/bin/env node
/**
 * Generate placeholder personality-test media under assets/personality-test/.
 * Replace with production assets before launch; placeholders unblock dev + cloud upload.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets/personality-test');
const DEFAULT_AUDIO_SOURCE = path.join(ASSETS_DIR, 'audio/big-room-drop-source.wav');

function resolveAudioSource() {
  const fromEnv = process.env.PERSONALITY_TEST_AUDIO_SOURCE?.trim();
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv;
  }
  if (existsSync(DEFAULT_AUDIO_SOURCE)) {
    return DEFAULT_AUDIO_SOURCE;
  }
  return '';
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function writeAudio(filePath) {
  ensureDir(path.dirname(filePath));
  const source = resolveAudioSource();
  if (source) {
    execSync(
      `ffmpeg -y -i ${JSON.stringify(source)} -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ac 2 -ar 44100 -b:a 128k ${JSON.stringify(filePath)}`,
      { stdio: 'inherit' },
    );
    return;
  }
  execSync('node scripts/render-big-room-drop-audio.mjs', {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

function main() {
  const audioDir = path.join(ASSETS_DIR, 'audio');
  ensureDir(audioDir);

  const audioPath = path.join(audioDir, 'big-room-drop.mp3');
  if (!existsSync(audioPath)) {
    writeAudio(audioPath);
    console.log(`Generated ${audioPath}`);
  } else {
    console.log(`Keep existing ${audioPath}`);
  }

  console.log('Placeholder personality-test media ready.');
}

main();
