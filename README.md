## instruction

- depend on `ffmpeg`.
- it can download and convert m3u8 to mp4, and also convert local m3u8.

## Usage

1. create a Javascript file under **config**

| Prop       | Description                                 | Type   | Default                       |
| ---------- | ------------------------------------------- | ------ | ----------------------------- |
| outputFile | fileName of mp4                             | string | `-`                           |
| fileName   | match media extension from url of m3u8 file | regexp | `-`                           |
| outputDir  | all files save in in it                     | string | `./dist`                      |
| baseUrl    | host of media file                          | string | if empty, load local fragment |
| source     | url of m3u8(online or local)                | string | `-`                           |

```js
// config/a.js

module.exports = {
  outputFile: /\.ts/,
  fileName: 'foo.mp4',
  baseUrl: 'http:**',
  outputDir: './dist/**',
  source: './dist/*.m3u8' | 'http:**'
}
```

2. run

```
  yarn

  vd -c a.js
```

It will automatically save the download record. If you need to download again, please delete `fulfill.txt` or `vd -c a.js -re`.

### ---

to be continue...
