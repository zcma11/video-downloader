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
const M3U8_URL_REG = /(\/.*?)(?=\"|\n)/g

program.option('-c <configFile>').action(async ({ c }) => {
  let defaultName = 1
  const config = require(path.join(CONFIG_DIR, c))
  console.log(config)
  const {
    outputDir: _outputDir = DEFAULT_OUTPUT,
    fileName = defaultName,
    baseUrl,
    outputFile
  } = config
  const { isExist, existPath, unExistPath } = await checkFile(
    path.relative(process.cwd(), _outputDir)
  )
  console.log(isExist, existPath, unExistPath)
  if (!isExist) {
    createDir(unExistPath, existPath)
  }

  const { source, fileContent } = await parseSource(config.source)
  const outputDir = path.resolve(process.cwd(), _outputDir)
  const fileList = path.resolve(outputDir, FILE_M3U8)
  console.log(fileContent)
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
    return _write(finalContent)
  })

  let count = 0
  let mission = []
  for (let src of source) {
    if (!src.startsWith(http) && config.baseUrl) {
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

      const task = () =>
        write(pathName, _write => {
          return download(baseUrl + src, () => _write)
        }).finally(() => {
          console.log(
            `${pathName} is over. schedule: ${++count}/${source.length}`
          )
        })

      mission.push(task)
    }
  }

  const thead = useThead(mission, 5)

  await thead.work()

  console.log(`try to convert ${FILE_M3U8} to ${outputFile}`)

  await new Promise(resolve => {
    childProcess
      .exec(
        `cd ${outputDir} && ffmpeg -i ${FILE_M3U8} -c copy ${outputFile}`,
        (err, stdout) => {
          if (err) {
            console.log(err + '\nfail to convert m3u8')
          } else {
            console.log(stdout)
          }
        }
      )
      .on('close', resolve)
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
        const { isExist } = await checkFile(file)
        if (!isExist) {
          return
        }

        source = fs.readFileSync(file, 'utf8')
      }

      const urlList = source.match(M3U8_URL_REG) || []
      resolve({ source: urlList, fileContent: source })
    } catch (error) {
      console.log(error)
      resolve({ source: [], fileContent: '' })
    }
  })
}

function download(url, action) {
  return new Promise((resolve, reject) => {
    let request
    switch (url.match(/https?/)[0]) {
      case 'http':
        request = http.get(url)
      case 'https':
        request = https.get(url)
    }

    request.on('error', err => {
      reject(err)
    })

    request.on('response', response => {
      let res = {}
      response.on('data', action(res))
      response.on('end', () => resolve(res))
    })
  })
}
