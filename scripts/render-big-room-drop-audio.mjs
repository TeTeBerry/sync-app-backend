#!/usr/bin/env node
/**
 * Render a short Big Room style build-up + drop clip for personality-test audio.
 * Output: assets/personality-test/audio/big-room-drop.mp3 (~12s, normalized).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'assets/personality-test/audio/big-room-drop.mp3');
const TMP = path.join(ROOT, 'assets/personality-test/.tmp-audio');

const BPM = 128;
const BEAT_MS = Math.round((60 / BPM) * 1000);
const BUILD_SEC = 7;
const DROP_BEATS = 10;
const DROP_SEC = (DROP_BEATS * 60) / BPM;
const TOTAL_SEC = BUILD_SEC + DROP_SEC;

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

function main() {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(path.dirname(OUTPUT), { recursive: true });

  const buildWav = path.join(TMP, 'build.wav');
  const dropWav = path.join(TMP, 'drop.wav');
  const mergedWav = path.join(TMP, 'merged.wav');

  run(
    [
      'ffmpeg -y',
      '-f lavfi',
      `-i "anoisesrc=color=pink:duration=${BUILD_SEC}:sample_rate=44100:amplitude=0.85"`,
      '-af',
      `"highpass=f=220,lowpass=f=9000,volume=0.2,afade=t=in:st=0:d=${BUILD_SEC - 0.2},afade=t=out:st=${BUILD_SEC - 0.15}:d=0.15"`,
      JSON.stringify(buildWav),
    ].join(' '),
  );

  const kickSplitLabels = Array.from({ length: DROP_BEATS }, (_, i) => `kick${i}`);
  const kickMixLabels = Array.from({ length: DROP_BEATS }, (_, i) => `k${i}`);
  const kickChain = kickSplitLabels
    .map((splitLabel, index) => {
      const delayMs = index * BEAT_MS;
      return `[${splitLabel}]adelay=${delayMs}|${delayMs},volume=0.85[${kickMixLabels[index]}]`;
    })
    .join(';');

  const dropFilter = [
    `[0:a]volume=0.58,afade=t=out:st=${DROP_SEC - 0.35}:d=0.35[sub]`,
    `[1:a]volume=0.6,afade=t=out:st=0.08:d=0.55[crash]`,
    `[2:a]asplit=${DROP_BEATS}${kickSplitLabels.map((label) => `[${label}]`).join('')}`,
    kickChain,
    `${kickMixLabels.map((label) => `[${label}]`).join('')}amix=inputs=${DROP_BEATS}:duration=longest:dropout_transition=0[kicks]`,
    `[3:a]highpass=f=7000,lowpass=f=14000,volume=0.1,tremolo=f=${(BPM / 15).toFixed(2)}:d=0.45[hat]`,
    `[sub][crash][kicks][hat]amix=inputs=4:duration=first:dropout_transition=0[out]`,
  ].join(';');

  run(
    [
      'ffmpeg -y',
      `-f lavfi -i "sine=frequency=48:duration=${DROP_SEC}:sample_rate=44100"`,
      `-f lavfi -i "anoisesrc=color=white:duration=1.1:sample_rate=44100:amplitude=1.0"`,
      `-f lavfi -i "sine=frequency=58:duration=0.18:sample_rate=44100"`,
      `-f lavfi -i "anoisesrc=color=white:duration=${DROP_SEC}:sample_rate=44100:amplitude=0.3"`,
      `-filter_complex "${dropFilter}"`,
      '-map "[out]"',
      JSON.stringify(dropWav),
    ].join(' '),
  );

  run(
    [
      'ffmpeg -y',
      `-i ${JSON.stringify(buildWav)}`,
      `-i ${JSON.stringify(dropWav)}`,
      '-filter_complex',
      `"[0:a][1:a]concat=n=2:v=0:a=1,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11[out]"`,
      '-map "[out]"',
      JSON.stringify(mergedWav),
    ].join(' '),
  );

  run(
    [
      'ffmpeg -y',
      `-i ${JSON.stringify(mergedWav)}`,
      '-ac 2',
      '-ar 44100',
      '-b:a 128k',
      JSON.stringify(OUTPUT),
    ].join(' '),
  );

  rmSync(TMP, { recursive: true, force: true });
  console.log(`Rendered ${OUTPUT} (${TOTAL_SEC.toFixed(1)}s @ ${BPM} BPM)`);
}

main();
