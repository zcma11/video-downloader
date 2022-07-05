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
  outputFile: 'foo.mp4',
  fileName: /\.ts/,
  baseUrl: 'http:**',
  outputDir: './dist/**',
  source: './dist/*.m3u8' | 'http:**'
}

// with jsdoc
// path is see to the position of your config file
const { createConfig } = require(path.resolve(__dirname, '../lib/helper.js'))
createConfig({
  outputFile: 'foo.mp4',
  fileName: /\.ts/,
  baseUrl: 'http:**',
  outputDir: './dist/**',
  source: './dist/*.m3u8' | 'http:**'
})
```

Maybe you can create config with function. Finally export an array.

```js
  // config/a.js
  const create = (source, name, dir) => {
    const baseUrl = source.match(/* your reg */)[0]
    return {
      source,
      baseUrl,
      outputDir: `./dist/${dir}/${name}`,
      outputFile: `${name}.mp4`,
      fileName: /\.ts/
    }
  }

  module.exports = [....].map((...) => create(...))
```

2. run

```
  yarn

  vd -c a.js
```

It will automatically save the download record. If you need to download again, please delete `fulfill.txt` or use `vd -c a.js -re`.

## note!

1. the path of file or the file name shouldn't have any white space.

## ---

to be continue...
