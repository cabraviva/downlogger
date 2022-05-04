const fs = require('fs')
const humanDate = require('./human-date')

class Logger {
    /**
     * 
     * @param {Boolean} consoleOutput Defines if everythin logged should also be displayed in the console
     * @param {Number} logBufferOverflow Sets the maximum lines of logBuffer before it is written to the file
     * @param {Number} overflowTimeout Sets the time in milliseconds after which the logBuffer is written to the file
     * @param {Boolean} synchronous Sets if the logBuffer should be written to the file synchronously or asynchronously
     */
    constructor (consoleOutput = true, logBufferOverflow = 100, overflowTimeout = 'TIMEOUT_3_MINUTES', synchronous = true) {
        if (overflowTimeout === 'TIMEOUT_3_MINUTES') {
            overflowTimeout = 1000 * 60 * 3
        }

        this.overflowTimeout = overflowTimeout
        this.__console = console
        
        this.consoleOutput = consoleOutput
        this.synchronous = synchronous
        this.files = []
        this.logBufferOverflow = logBufferOverflow < 0 ? 100 : logBufferOverflow
        this.logBuffer = [] // Store lines to log until logBufferOverflow is reached

        const self = this

        this.presets = {
            serverListening: (port) => {
                self.info('WebServer is listening now')
            },
            middleWare: (req, res, next) => {
                const startTimeStamp = new Date()

                onFinished(res, () => {
                    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
                    if (ip === '::1') ip = '127.0.0.1'
                    const endTimeStamp = new Date()

                    const payload = {
                        url: req.url,
                        fullUrl: `${req.headers.host}${req.url}`,
                        method: req.method,
                        headers: req.headers,
                        body: req.body,
                        params: req.params,
                        query: req.query,
                        timestamp: endTimeStamp,
                        startTimeStamp: startTimeStamp,
                        session: req.session,
                        ip,
                        response: {
                            statusCode: res.statusCode,
                            headers: res.getHeaders(),
                            responseTimeInMs: endTimeStamp - startTimeStamp
                        }
                    }

                    // GET /route - 200 - 0.000 FROM 127.0.0.1
                    self.inContext('WebServer').info(`${payload.method} ${payload.url} - ${payload.response.statusCode} - ${payload.response.responseTimeInMs}ms FROM ${ip}`)
                })

                next()
            },
            onlyFileMiddleware: (req, res, next) => {
                const startTimeStamp = new Date()

                onFinished(res, () => {
                    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
                    if (ip === '::1') ip = '127.0.0.1'
                    const endTimeStamp = new Date()

                    const payload = {
                        url: req.url,
                        fullUrl: `${req.headers.host}${req.url}`,
                        method: req.method,
                        headers: req.headers,
                        body: req.body,
                        params: req.params,
                        query: req.query,
                        timestamp: endTimeStamp,
                        startTimeStamp: startTimeStamp,
                        session: req.session,
                        ip,
                        response: {
                            statusCode: res.statusCode,
                            headers: res.getHeaders(),
                            responseTimeInMs: endTimeStamp - startTimeStamp
                        }
                    }

                    // GET /route - 200 - 0.000 FROM 127.0.0.1
                    self.inFileContext('WebServer').info(`${payload.method} ${payload.url} - ${payload.response.statusCode} - ${payload.response.responseTimeInMs}ms FROM ${ip}`)
                })

                next()
            }
        }

        setInterval(() => {
            this._writeToFile()
        }, overflowTimeout)

        process.on('beforeExit', (code) => {
            this._writeBufferSync()
            self.exitMsg('Process beforeExit event with code: ', code || 'unknown')
        })

        // only works when the process normally exits
        // on windows, ctrl-c will not trigger this handler (it is unnormal)
        // unless you listen on 'SIGINT'
        process.on('exit', (code) => {
            this._writeBufferSync()
            self.exitMsg('Process exit event with code: ', code || 'unknown')
        })

        // just in case some user like using "kill"
        process.on('SIGTERM', (signal) => {
            this._writeBufferSync()
            self.exitMsg(`Process ${process.pid} received a SIGTERM signal`)
            process.exit(0)
        })

        // catch ctrl-c, so that event 'exit' always works
        process.on('SIGINT', (signal) => {
            this._writeBufferSync()
            self.exitMsg(`Process ${process.pid} has been interrupted`)
            process.exit(0)
        })
    }

    /**
     * Sets a custom console to use instead of the default console
     * @param {Console} customConsole Custom console to use instead of the default console
     */
    setCustomConsole (customConsole) {
        this.__console = customConsole
    }

    /**
     * 
     * @param {String} context Execution context name
     * @returns {Logger}
     */
    inContext (context) {
        const self = this
        return {
            info: (message) => {
                self.info(`[${context}] ${message}`)
            }
        }
    }

    /**
     * @description Same as inContext but doesn't log to the console
     * @param {String} context Execution context name
     * @returns {Logger}
     */
    inFileContext (context) {
        const self = this
        return {
            info: (message) => {
                self.finfo(`[${context}] ${message}`)
            }
        }
    }

    /**
     * @description Logs a message to the console and to the file
     * @param {*} message Object to log
     */
    info (message) {
        this._onChange(`[${humanDate()}: INFO] ${message}`)
    }

    /**
     * @description Logs a message only to the file
     * @param {*} message Object to log
     */
    finfo (message) {
        // Buffer output
        this.logBuffer.push(`[${humanDate()}: INFO] ${message}`)
        if (this.logBuffer.length > this.logBufferOverflow) {
            this._writeToFile()
        }
    }

    /**
     * @description Logs an exit-message to the console and to the file (this should only be used if the process is about to exit)
     * @param {*} message Exit Message
     */
    exitMsg (message) {
        this._onChangeSync(`[${humanDate()}: EXIT] ${message}`)
    }

    /**
     * @description Logs a debug-message to the console and to the file (this should only be used for debugging purposes)
     * @param {*} message Object to log
     */
    debug (message) {
        this._onChange(`[${humanDate()}: DEBUG] ${message}`)
    }

    /**
     * @description Logs a warning to the console and to the file
     * @param {*} message Object to log
     */
    warn (message) {
        this._onChange(`[${humanDate()}: WARN] ${message}`)
    }

    /**
     * @description Logs an error to the console and to the file
     * @param {*} message Object to log
     */
    error (message) {
        this._onChange(`[${humanDate()}: ERROR] ${message}`)
    }

    /**
     * @description Logs an error to the console and to the file and logs the stacktrace to the console and to the file
     * @param {*} message Object to log
     */
    throw (error) {
        this.__console.error(error)
        this._onChange(`[${humanDate()}: ERROR] ${error.name}: ${error.message}`)
        // Add stacktrace as an extra line
        this._onChange(`[${humanDate()}: ERRORSTACK] ${error.stack}`)
    }

    /**
     * @description Intsantly Logs a message to the console and to the file (WARNING: This will block the process)
     * @param {*} message Object to log
     */
    print (...messages) {
        this.__console.log(...messages)
        this.files.forEach(file => {
            fs.appendFileSync(file, `[${humanDate()}: CONSOLE OUTPUT] ${messages.join(' ')}\n`, () => {})
        })
    }

    /**
     * @description Instantly logs a message to the console and to the file (WARNING: This will block the process)
     * @param {*} message Object to log
     */
    printr (...messages) {
        this.__console.log(...messages)
        this.files.forEach(file => {
            fs.appendFileSync(file, `${messages.join(' ')}\n`, () => {})
        })
    }

    /**
     * @description Instantly logs a message into just the file (WARNING: This will block the process)
     * @param {*} message Object to log
     */
    printrf (...messages) {
        this.files.forEach(file => {
            fs.appendFileSync(file, `${messages.join(' ')}\n`, () => {})
        })
    }

    /**
     * @description Internal function to log a message to the console and to the file
     * @warning This function is only for internal use
     * @param {*} line 
     */
    _onChange (line) {
        if (this.consoleOutput) {
            this.__console.log(line)
        }

        // Buffer output
        this.logBuffer.push(line)
        if (this.logBuffer.length > this.logBufferOverflow) {
            this._writeToFile()
        }
    }

    /**
     * @description Internal function to write the buffer to the file
     * @warning This function is only for internal use
     */
    _writeToFile () {
        const self = this
        const linez = this.logBuffer.join('\n') // Concat all lines

        this.logBuffer = [] // Reset buffer

        this.files.forEach(file => {
            if (self.synchronous) {
                fs.appendFileSync(file, `${linez}\n`)
            } else {
                fs.appendFile(file, `${linez}\n`, () => {})
            }
        })
    }

    /**
     * @description Internal function to write the buffer synchronously to the file
     * @warning This function is only for internal use
     */
    _writeToFileSync () {
        const self = this
        const linez = this.logBuffer.join('\n') // Concat all lines

        this.logBuffer = [] // Reset buffer

        this.files.forEach(file => {
            fs.appendFileSync(file, `${linez}\n`)
        })
    }

    /**
     * @description Internal function to write the Buffer synchronously
     * @warning This function is only for internal use
     */
    _writeBufferSync () {
        if (this.logBuffer.length > 0) {
            this._writeToFileSync()
        }
    }

    /**
     * @description Internal function to log a message to the console and to the file (WARNING: This will block the process)
     * @warning This function is only for internal use
     * @param {*} line 
     */
    _onChangeSync (line) {
        if (this.consoleOutput) {
            this.__console.log(line)
        }

        this.files.forEach(file => {
            fs.appendFileSync(file, `${line}\n`)
        })
    }

    /**
     * @description Manually writes the log buffer to the file
     */
    writeNow () {
        this._writeToFile()
    }

    /**
     * @description Pipes the logs into a file
     * @param {String} file Filepath for the logfile
     */
    pipe (file) {
        const os = require('os')

        this.files.push(file)
        this.printrf()
        this.printrf()
        this.printrf('------------------------------------------------------------')
        this.printrf(`-- NEW LOGGING SESSION STARTED at ${humanDate()}`)
        this.printrf(`-- Logging to ${file}`)
        this.printrf(`-- CWD: ${process.cwd()}`)
        this.printrf(`-- OS: ${os.platform()} ${os.arch()}`)
        this.printrf(`-- Node: ${process.version}`)
        this.printrf(`-- PID: ${process.pid}`)
        this.printrf(`-- Uptime: ${process.uptime()} seconds`)
        this.printrf(`-- Logged in as ${os.userInfo().username}@${os.hostname()}`)
        this.printrf(`-- Total Memory: ${os.totalmem()} bytes (${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB)`)
        this.printrf(`-- Free Memory: ${os.freemem()} bytes (${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)}) GB)`)
        this.printrf('------------------------------------------------------------')
    }
}

module.exports = Logger