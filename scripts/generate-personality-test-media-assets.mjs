#!/usr/bin/env node
/**
 * Generate placeholder personality-test media under assets/personality-test/.
 * Replace with production assets before launch; placeholders unblock dev + cloud upload.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets/personality-test');

const MINIMAL_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIVFhUVFRUVFRUVFRUWFxUYFxgYFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAgMBAAAAAAAAAAAAAAAGBwQFAwIBAP/EADUQAAEDAwIEBQIFAwQDAAAAAAECAwQABREGEiExQQcTIlFhFDJxgZEjQlKhsRUzYnLR/8QAGgEAAgIDAAAAAAAAAAAAAAAABAECAwUG/8QAJREAAgICAgICAgMAAAAAAAAAAAECEQMhEjEEQRNRImEUFTJx/9oADAMBAAIRAxEAPwDqWiiigAooooAKKKKACiiigD/2Q==';

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function writePoster(filePath) {
  writeFileSync(filePath, Buffer.from(MINIMAL_JPEG_B64, 'base64'));
}

function writeAudio(filePath) {
  ensureDir(path.dirname(filePath));
  execSync(
    `ffmpeg -y -f lavfi -i "sine=frequency=880:duration=4" -ac 1 -ar 44100 -b:a 96k ${JSON.stringify(filePath)}`,
    { stdio: 'ignore' },
  );
}

function writeVideo(filePath, color) {
  ensureDir(path.dirname(filePath));
  execSync(
    `ffmpeg -y -f lavfi -i "color=c=${color}:s=640x360:d=4" -f lavfi -i "sine=frequency=440:duration=4" -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 64k ${JSON.stringify(filePath)}`,
    { stdio: 'ignore' },
  );
}

function main() {
  const audioDir = path.join(ASSETS_DIR, 'audio');
  const vjDir = path.join(ASSETS_DIR, 'vj');
  ensureDir(audioDir);
  ensureDir(vjDir);

  const audioPath = path.join(audioDir, 'big-room-drop.mp3');
  if (!existsSync(audioPath)) {
    writeAudio(audioPath);
    console.log(`Generated ${audioPath}`);
  } else {
    console.log(`Keep existing ${audioPath}`);
  }

  const posters = [
    ['laser-flash-poster.jpg', '#ff0066'],
    ['particle-flow-poster.jpg', '#7b61ff'],
    ['geometry-matrix-poster.jpg', '#22d3ee'],
    ['neon-retro-poster.jpg', '#facc15'],
  ];
  for (const [name] of posters) {
    const posterPath = path.join(vjDir, name);
    if (!existsSync(posterPath)) {
      writePoster(posterPath);
      console.log(`Generated ${posterPath}`);
    }
  }

  const videos = [
    ['laser-flash.mp4', 'red'],
    ['particle-flow.mp4', 'purple'],
    ['geometry-matrix.mp4', 'cyan'],
    ['neon-retro.mp4', 'yellow'],
  ];
  for (const [name, color] of videos) {
    const videoPath = path.join(vjDir, name);
    if (!existsSync(videoPath)) {
      writeVideo(videoPath, color);
      console.log(`Generated ${videoPath}`);
    }
  }

  console.log('Placeholder personality-test media ready.');
}

main();
