const errorColor = str => {
  return `\x1b[31m${str}\x1b[0m`
}

const isVaild = type => val =>
  Object.prototype.toString.call(val).slice(8, -1) === type

const isRegExp = isVaild('RegExp')
const isFunction = isVaild('Function')
const isObject = isVaild('Object')
const isArray = isVaild('Array')
const isString = isVaild('String')
const isNumber = isVaild('Number')

const formatM3U8Url = url => {
  try {
    return url.replace(/\\/g, '/')
  } catch (e) {
    console.log('fail to format url of m3u8\n' + e)
    return ''
  }
}

module.exports = {
  errorColor,
  isArray,
  isFunction,
  isNumber,
  isObject,
  isString,
  isRegExp,
  formatM3U8Url
}
