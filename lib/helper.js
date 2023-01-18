/**
 * outputFile : fileName of mp4
 * fileName   : match media extension from url of m3u8 file
 * outputDir  : all files save in in it
 * baseUrl    : host of media file
 * source     : url of m3u8(online or local)
 * @param {{ outputDir: string, fileName: RegExp, baseUrl: string, outputFile: string, source: string, cookies: any[] }} config
 * @returns config
 */
const createConfig = config => config

module.exports = {
  createConfig
}
