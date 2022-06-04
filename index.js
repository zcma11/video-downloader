#!/usr/bin/env node
// import { createWriteStream, readFile } from 'fs'
// import { request } from 'http'
// import { join } from 'path'

// const listName = ''
// const fileName = ''
// const outputDir = ''
// const baseUrl = 'https://dl193248.twitcasting.tv'

// readFile(Path.join(process.cwd, listName))

// const download = (fileName, output, urls) => {}
const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const { errorColor, isRegExp } = require('./lib/utils')
const { checkFile, createDir } = require('./lib/fs')
const useThead = require('./lib/useThead')
const { Command } = require('commander')
const program = new Command()

const configDir = path.join(process.cwd(), 'config')
const fileExt = '.mp4'

// program
//   .command('download <url>')
//   .description('请输入 URL')
//   .action(url => {
//     console.log(url)
//     getConfig(url)
//   })
// .error('Please fill in the URL')
program.option('-c <configFile>').action(async ({ c }) => {
  let defaultName = 1
  const config = require(path.join(configDir, c))
  console.log(config)
  let { outputDir = './dist', fileName = defaultName, baseUrl } = config
  const { isExist, existPath, unExistPath } = await checkFile(
    config.outputDir
    // config.fileName || 'media.21.mp4'
  )
  console.log(isExist, existPath, unExistPath)
  if (!isExist) {
    createDir(unExistPath, existPath)
  }

  const source = await parseSource(config.source)
  console.log(source)
  let count = 0
  let mission = []
  for (let src of source) {
    if (!src.startsWith(http) && config.baseUrl) {
      let pathName
      switch (typeof fileName) {
        case 'number':
          ++fileName
          pathName = path.resolve(process.cwd(), outputDir, fileName + fileExt)
          break
        case 'string':
          pathName = path.resolve(process.cwd(), outputDir, fileName)
          break
        case 'object':
          if (isRegExp(fileName)) {
            pathName = path.resolve(
              process.cwd(),
              outputDir,
              src.split('/').find(s => fileName.exec(s))
            )
          }
          break
        default:
          throw new Error('fileName must be a string but got ', fileName)
      }

      const p = () => {
        const writeStream = fs.createWriteStream(pathName)
        writeStream.on('error', e => {
          writeStream.end()
        })

        return download(baseUrl + src, () => data => {
          writeStream.write(data)
        })
          .then(
            () => writeStream.end(),
            () => writeStream.end()
          )
          .finally(() => {
            console.log(
              `${pathName} is over. schedule: ${++count}/${source.length}`
            )
          })
      }

      mission.push(p)
    }
  }

  const thead = useThead(mission, 5)

  await thead.work()

  console.log('finish')
})

program.configureOutput({
  outputError: (str, write) => write(errorColor(str))
})
program.parse(process.argv)

// const { program } = require('commander')
// download()

// function getConfig(fileName) {
//   return new Promise((resolve, reject) => {
//     if (fileName.startsWith('http')) {
//       return download(fileName)
//     }
//     fs.readFile(`./config/${fileName}`, 'utf8', (err, data) => {
//       console.log(data)
//       resolve(JSON.parse(data))
//     })
//   })
// }

function parseSource(source) {
  return new Promise(async resolve => {
    if (source.startsWith('http')) {
      try {
        const res = await download(source, res => {
          res.result = ''
          return data => {
            res.result += data.toString()
          }
        })
        source = res.result.match(/(\/.*?)(?=\"|\n)/g)
        // resolve(res)
        console.log(source)
        if (!source) {
          resolve([])
        }
        resolve(source)
      } catch (error) {
        console.log(error)
        resolve([])
      }
    }
    // fs.readFile('./media.m3u8', 'utf8', (err, data) => {
    //   if (err) {
    //     reject(err)
    //   }
    //   console.log(typeof data)
    //   const r =
    //   resolve(r)
    // })
  })
}

function download(url, cb) {
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
      response.on('data', cb(res))
      response.on('end', () => resolve(res))
    })
  })
}
