#!/usr/bin/env node
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')
const childProcess = require('child_process')
const { errorColor, isRegExp, isString } = require('./lib/utils')
const { checkFile, createDir, write } = require('./lib/fs')
const useThead = require('./lib/useThead')
const { Command } = require('commander')
const program = new Command()

const CONFIG_DIR = path.join(process.cwd(), 'config')
const FILE_EXT = '.mp4'
const FILE_M3U8 = 'media.m3u8'
const DEFAULT_OUTPUT = './dist'
const M3U8_URL_REG = /(?<="|\n)([^#\n]+?)(?="|\n)/g

program
  .option('-c <configFile>')
  .option('-re, --reload')
  .action(async ({ c, reload }) => {
    let defaultName = 1
    const config = require(path.join(CONFIG_DIR, c))
    console.log(config)
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

    const { source, fileContent } = await parseSource(config.source)
    if (!source.length || !fileContent) return

    const fileList = path.resolve(outputDir, FILE_M3U8)

    await write(fileList, async _write => {
      let finalContent = ''
      finalContent = fileContent.replace(M3U8_URL_REG, _ => {
        return path
          .resolve(
            process.cwd(),
            path.resolve(
              path.relative(process.cwd(), outputDir),
              _.split('/').find(s => s.match(fileName))
            )
          )
          .replace(/\\/g, '/') /* for window */
      })
      return _write(finalContent.trim())
    })

    let count = 0
    const fufillFile = path.resolve(outputDir, 'fulfill.txt')
    const failureFile = path.resolve(outputDir, 'failure.txt')
    const mission = []
    const fulfill =
      !reload && checkFile(fufillFile).isExist
        ? [...new Set(fs.readFileSync(fufillFile, 'utf8').split('\n'))]
        : []
    const failure = []

    for (let src of source) {
      if (fulfill.includes(src)) {
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

        const url = baseUrl + src
        const task = async () => {
          const res = await write(pathName, async _write => {
            return download(url, () => _write)
              .then(_ => {
                fulfill.push(url)
                return _
              })
              .catch(_ => {
                failure.push(url)
                return _
              })
          })

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
      process.exit(0)
    }
    console.log(`\ntry to convert ${FILE_M3U8} to ${outputFile}`)

    await new Promise(resolve => {
      childProcess
        .exec(
          `cd ${outputDir} && ffmpeg -i ${FILE_M3U8} -c copy ${outputFile}`,
          (err, stdout) => {
            if (err) {
              console.log(err + '\nfail to convert m3u8')
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
  })

program.configureOutput({
  outputError: (str, write) => write(errorColor(str))
})
program.parse(process.argv)

function parseSource(source) {
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

      console.log(source.match(M3U8_URL_REG))
      const urlList = source.match(M3U8_URL_REG) || []
      resolve({ source: urlList, fileContent: source })
    } catch (error) {
      console.log(error)
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
