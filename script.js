#!/usr/bin/env node
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')
const childProcess = require('child_process')
const {
  errorColor,
  isRegExp,
  isString,
  formatM3U8Url,
  isArray
} = require('./lib/utils')
const { checkFile, createDir, write } = require('./lib/fs')
const useThead = require('./lib/useThead')
const { Command } = require('commander')
const program = new Command()

const CONFIG_DIR = path.join(process.cwd(), 'config')
const FILE_EXT = '.mp4'
const FILE_M3U8 = 'media.m3u8'
const DEFAULT_OUTPUT = './dist'
const M3U8_URL_REG = /(?<="|\n)([^#\n]+?)(?="|\n)/g
const KEY_REG = /{(.*)}/
const hasKey = c => c.match('#EXT-X-KEY')
const KEY_LINE_REG = /(#EXT-X-KEY.*?\n)/

program
  .option('-c <configFile>')
  .option('-re, --reload')
  .action(async ({ c, reload }) => {
    let config = require(path.join(CONFIG_DIR, c))
    console.log(config)

    if (!isArray(config)) {
      config = [config]
    }

    for (let i = 0; i < config.length; i++) {
      const conf = config[i]
      try {
        console.log(`[vd] handle ${conf.outputFile}`)
        await main({ c, reload }, conf)
        console.log(
          `[vd] finish ${conf.outputFile} (${i + 1}/${config.length})`
        )
      } catch (error) {
        console.log(
          errorColor(
            `[error] Encountered an unknown error. ${conf.outputFile} config[${i}]\n${error}`
          )
        )
      }
    }
  })

async function main({ reload }, config) {
  let defaultName = 1
  const {
    outputDir: _outputDir = DEFAULT_OUTPUT,
    fileName = defaultName,
    baseUrl,
    outputFile
  } = config
  const outputDir = path.resolve(process.cwd(), _outputDir)

  if (checkFile(outputDir, outputFile).isExist) {
    console.log(errorColor(`[warn] ${outputFile} is exist`))
    return
  }
  const { isExist, existPath, unExistPath } = checkFile(
    path.relative(process.cwd(), _outputDir)
  )

  if (!isExist) {
    createDir(unExistPath, existPath)
  }

  const originSource = await parseSource(config.source)
  let source = originSource.source
  let fileContent = originSource.fileContent

  if (!source.length || !fileContent) {
    console.log(errorColor('[error] can not find source'))
    return
  }

  // handle .key v1.1
  const IS_ENCRYPTION = hasKey(fileContent)
  if (IS_ENCRYPTION) {
    reload = true
    try {
      const afterProcessing = await parseKey(source, fileContent, outputDir)
      source = afterProcessing.source
      fileContent = afterProcessing.fileContent
    } catch (error) {
      console.log(errorColor('[error] fail to create .key\n  ') + error + '\n')
    }
  }

  const fileList = path.resolve(outputDir, FILE_M3U8)

  try {
    console.log('save .m3u8\n')
    await write(fileList, async _write => {
      let finalContent = ''
      finalContent = fileContent.replace(M3U8_URL_REG, _ => {
        const srcLine = _.split('/').find(s => s.match(fileName))
        if (!srcLine) {
          return _
        }

        return formatM3U8Url(
          path.resolve(
            process.cwd(),
            path.resolve(
              path.relative(process.cwd(), outputDir),
              srcLine.replace(/\?.*/, '')
            )
          )
        )
      })

      return _write(finalContent.trim())
    })
  } catch (error) {
    console.log(errorColor('[warn] fail to save .m3u8\n  ' + error))
  }

  let count = 0
  const fufillFile = path.resolve(outputDir, 'fulfill.txt')
  const failureFile = path.resolve(outputDir, 'failure.txt')
  const mission = []
  const fulfill =
    !reload && !IS_ENCRYPTION && checkFile(fufillFile).isExist
      ? [...new Set(fs.readFileSync(fufillFile, 'utf8').split('\n'))]
      : []
  const failure = []
  for (let _src of source) {
    const src = baseUrl ? baseUrl + _src : _src

    if (fulfill.includes(src)) {
      console.log(`${src} is downloaded. schedule: ${++count}/${source.length}`)
      continue
    }

    if (baseUrl) {
      // download and merge online file
      let pathName
      switch (typeof fileName) {
        case 'number':
          ++fileName
          pathName = path.resolve(outputDir, fileName + FILE_EXT)
          break
        case 'string':
          pathName = path.resolve(outputDir, fileName)
          break
        case 'object':
          if (isRegExp(fileName)) {
            pathName = path.resolve(
              outputDir,
              src.split('/').find(s => s.match(fileName))
            )
          }
          break
        default:
          throw new Error('fileName must be a string but got ', fileName)
      }

      const url = src
      const task = async () => {
        const res = await write(
          pathName.replace(/(\?.*)/, ''),
          async _write => {
            return download(url, () => _write)
              .then(_ => {
                fulfill.push(url)
                return _
              })
              .catch(_ => {
                failure.push(url)
                return _
              })
          }
        )

        console.log(
          `${pathName} is over. schedule: ${++count}/${source.length}`
        )

        return res
      }

      mission.push(task)
    } else {
      // only merge local file
      fulfill.push(src)
    }
  }

  const thead = useThead(mission, 5)

  await thead.work()

  const logFile = (file, content) => {
    write(file, async _write => {
      _write(content.join('\n'))
    })
  }

  if (fulfill.length) {
    logFile(fufillFile, fulfill)
  }

  if (failure.length) {
    logFile(failureFile, failure)
  }

  if (failure.length || !fulfill.length) {
    await new Promise(resolve => {
      setTimeout(() => {
        resolve()
      }, 3000)
    })
    console.log(errorColor('exit with failure file'))
    process.exit(1)
  }
  console.log(`\ntry to convert ${FILE_M3U8} to ${outputFile}`)

  await new Promise(resolve => {
    childProcess
      .exec(
        `ffmpeg -allowed_extensions ALL -i ${path.resolve(
          outputDir,
          FILE_M3U8
        )} -c copy ${path.resolve(outputDir, outputFile)}`,
        (err, stdout) => {
          if (err) {
            console.log(errorColor(err + '\nfail to convert m3u8\n'))
          } else {
            console.log(stdout)
            console.log('creating...')
          }
        }
      )
      .on('close', () => {
        setTimeout(() => {
          resolve()
        }, 1000)
      })
  })

  console.log('\n**** finish ****')
}

program.configureOutput({
  outputError: (str, write) => write(errorColor(str))
})
program.parse(process.argv)

function parseSource(source) {
  console.log('parse source')
  return new Promise(async resolve => {
    try {
      if (source.startsWith('http')) {
        const res = await download(source, res => {
          res.result = ''
          return data => {
            res.result += data.toString()
          }
        })

        source = res.result
      } else if (isString(source)) {
        const file = path.resolve(process.cwd(), source)
        const { isExist } = checkFile(file)
        if (!isExist) {
          return
        }

        source = fs.readFileSync(file, 'utf8')
      }

      // add for key v1.1
      if (hasKey(source)) {
        const line = KEY_LINE_REG.exec(source)[0]
        const url = line.match(M3U8_URL_REG)[0]
        source = source.replace(url, `{${url}}`)
      }

      const urlList = source.match(M3U8_URL_REG) || []
      resolve({ source: urlList, fileContent: source })
    } catch (error) {
      console.log(
        errorColor(
          '[error] Encountered an unknown error, when parsing source.\n  '
        ) + error
      )
      resolve({ source: [], fileContent: '' })
    }
  })
}

function download(url, action) {
  return new Promise((resolve, _reject) => {
    let request
    switch (url.match(/https?/)[0]) {
      case 'http':
        request = http.get(url, { timeout: 10000 })
      case 'https':
        request = https.get(url, { timeout: 10000 })
    }

    const reject = _ => {
      console.log(errorColor(`[error] fail to download url\n  ${_}`))
      _reject(_)
    }

    request
      .on('error', reject)
      .on('timeout', reject)
      .on('response', response => {
        let res = {}
        response
          .on('data', action(res))
          .on('end', () => resolve(res))
          .on('error', reject)
      })
  })
}

// v1.1
async function parseKey(source, fileContent, outputDir) {
  const matchResult = fileContent.match(KEY_REG)
  if (!matchResult) {
    return { source, fileContent }
  }

  const url = matchResult[1]
  let file = path.resolve(url)

  if (url.startsWith('http')) {
    file = path.resolve(outputDir, '1.key')
    await write(file, _write => {
      return download(url, () => _write)
    })
  }

  fileContent = fileContent.replace(matchResult[0], _ => {
    return formatM3U8Url(file)
  })
  source = source.filter(s => s !== matchResult[0])
  return { source, fileContent }
}
