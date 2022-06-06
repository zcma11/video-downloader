const fs = require('fs')
const path = require('path')

async function checkFile(...args) {
  let isExist = false
  let currentPath = process.cwd()
  let i = 0
  for (; i < args.length; i++) {
    const item = args[i]
    const temp = path.resolve(currentPath, item)
    if (!fs.existsSync(temp)) {
      isExist = false
      break
    }
    isExist = true
    currentPath = temp
  }

  return {
    isExist,
    existPath: currentPath,
    unExistPath: args.slice(i)
  }
}

function createDir(dirPath, root = process.cwd()) {
  for (let p of dirPath) {
    const slash = /[/\\]/.exec(p)
    const sp = p.split(slash)
    if (sp.length > 1) {
      createDir(sp, root)
    } else {
      root = path.resolve(root, p)
      if (!['.', '..'].includes(p)) {
        if (!fs.existsSync(root)) {
          fs.mkdirSync(root)
        }
      }
    }
  }
}

/**
 *
 * @param {string} output
 * @param {() => promise} action should returns promise
 * @returns
 */
const write = (output, action) => {
  const writeStream = fs.createWriteStream(output)
  writeStream.on('error', e => {
    writeStream.end()
  })

  const _write = data => writeStream.write(data)
  const f = _ => {
    writeStream.end()
    return _
  }

  return action(_write).then(f, f)
}

module.exports = {
  checkFile,
  createDir,
  write
}
