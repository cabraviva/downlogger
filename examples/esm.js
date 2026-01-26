import DownLogger from '../dist/index.js'
const Logger = new DownLogger()

Logger.pipe('./my.minimal.log')

Logger.info('Infos here!')

setTimeout(() => {
  process.exit(0)
}, 1000)
