const DownLogger = require('../dist/index.js')
const Logger = new DownLogger()

Logger.pipe('./my.log')
Logger.info('Program started')
Logger.debug('Debugging')
Logger.warn('Warning')
Logger.error('Error')
Logger.throw(new Error('Invalid Character in line 2'))
Logger.info('Program ended')

Logger.print('This normal console output')

Logger.info("Now we'll start logging a webserver")

const express = require('express')
const app = express()

app.use(Logger.presets.middleWare) // Web Server Logging

app.get('/no', (req, res) => {
  res.status(500)
  res.send('Internal Server Error')
})

app.listen(8080, Logger.presets.serverListening)
