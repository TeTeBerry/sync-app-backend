# Personality test media assets

Upload these files to **CloudBase 云存储** under `static/personality-test/`.

## Audio

| Local file | Cloud path |
|------------|------------|
| `audio/big-room-drop.mp3` | `static/personality-test/audio/big-room-drop.mp3` |

Short Big Room drop clip (~8–15s), normalized volume.

## VJ previews

Each style needs a short looping MP4 (3–8s) and a JPG poster.

| Style | Video | Poster |
|-------|-------|--------|
| 激光射线+爆闪 | `vj/laser-flash.mp4` | `vj/laser-flash-poster.jpg` |
| 粒子流动+渐变 | `vj/particle-flow.mp4` | `vj/particle-flow-poster.jpg` |
| 几何矩阵+节奏同步 | `vj/geometry-matrix.mp4` | `vj/geometry-matrix-poster.jpg` |
| 霓虹文字+复古 | `vj/neon-retro.mp4` | `vj/neon-retro-poster.jpg` |

## Upload

1. Place source files in this directory following the table above.
2. Run:

```bash
node scripts/upload-personality-test-media.mjs
```

Or upload manually in WeChat CloudBase console to the paths in
`src/modules/personality-test/data/personality-media.ts`.

```bash
npm run media:generate-personality-test
npm run media:upload-personality-test
```

After upload, set `CLOUDBASE_STORAGE_BUCKET` on the backend runtime (printed by the upload script).

The mini program resolves media only via backend `GET /api/personality-test/media-urls` (cloud storage temp URLs).
