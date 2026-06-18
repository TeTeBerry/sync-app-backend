# Raver 人格测试随机头像

上传到 **CloudBase 云存储** 根目录下的 `avatar/` 文件夹。

| 本地文件 | 云存储路径 |
|----------|------------|
| `cat-pink-headphones.png` | `avatar/cat-pink-headphones.png` |
| `rabbit-green-headphones.png` | `avatar/rabbit-green-headphones.png` |
| `cat-cyan-headphones.png` | `avatar/cat-cyan-headphones.png` |
| `bunny-pink-green.png` | `avatar/bunny-pink-green.png` |
| `fox-rainbow-headphones.png` | `avatar/fox-rainbow-headphones.png` |
| `cat-neon-headphones.png` | `avatar/cat-neon-headphones.png` |
| `fox-peach-headphones.png` | `avatar/fox-peach-headphones.png` |
| `bunny-teal-headphones.png` | `avatar/bunny-teal-headphones.png` |
| `cat-violet-headphones.png` | `avatar/cat-violet-headphones.png` |

上传：

```bash
npm run media:upload-raver-avatars
```

将 PNG 放入本目录后执行上传；上传完成后可删除本地 PNG，仅保留 catalog 与云存储副本。

Catalog 与前后端 `RAVER_AVATAR_ASSET_KEYS` 保持一致。
