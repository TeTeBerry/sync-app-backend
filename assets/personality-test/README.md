# Personality test media assets

Upload these files to **CloudBase 云存储** under `static/personality-test/`.

## Audio

| Local file | Cloud path |
|------------|------------|
| `audio/big-room-drop.mp3` | `static/personality-test/audio/big-room-drop.mp3` |

Short Big Room drop clip (~8–15s), normalized volume.

Audio files are **not committed** (see `.gitignore`). Place the MP3 locally under
`audio/big-room-drop.mp3` before upload.

## Upload

1. Place source files in this directory following the table above.
2. Run:

```bash
npm run media:upload-personality-test
```

Or upload manually in WeChat CloudBase console to the paths in
`src/modules/personality-test/data/personality-media.ts`.

After upload, set `CLOUDBASE_STORAGE_BUCKET` on the backend runtime (printed by the upload script).

The mini program resolves media only via backend `GET /api/personality-test/media-urls` (cloud storage temp URLs).
