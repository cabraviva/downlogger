const DownLogger = require('../dist/index.js')
const Logger = new DownLogger(true, 100, 'TIMEOUT_3_MINUTES', true)

Logger.pipe('./my.long.log')

Logger.info('Infos here!')

let i = 0

for (i; i < 300; i++) {
  Logger.info(`Line ${i}/300`)
}
