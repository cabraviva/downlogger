const fs = require('fs')
const humanDate = require('./human-date')

class Logger {
    constructor (consoleOutput = true) {
        this.consoleOutput = consoleOutput
        this.files = []

        const self = this

        this.presets = {
            serverListening: (port) => {
                self.info('WebServer is listening now')
            },
            middleWare: (req, res, next) => {
                self.inContext('WebServer').info(`${req.method} ${req.url} from ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`)

                next()
            }
        }

        process.on("beforeExit", (code) => {
        self.exitMsg("Process beforeExit event with code: ", code || 'unknown');
        });

        // only works when the process normally exits
        // on windows, ctrl-c will not trigger this handler (it is unnormal)
        // unless you listen on 'SIGINT'
        process.on("exit", (code) => {
        self.exitMsg("Process exit event with code: ", code || 'unknown');
        });

        // just in case some user like using "kill"
        process.on("SIGTERM", (signal) => {
        self.exitMsg(`Process ${process.pid} received a SIGTERM signal`);
        process.exit(0);
        });

        // catch ctrl-c, so that event 'exit' always works
        process.on("SIGINT", (signal) => {
        self.exitMsg(`Process ${process.pid} has been interrupted`);
        process.exit(0);
        });

        // what about errors
        // try remove/comment this handler, 'exit' event still works
        process.on("uncaughtException", (err) => {
        self.exitMsg(`Uncaught Exception: ${err.message}`);
        process.exit(1);
        });
    }

    inContext (context) {
        const self = this
        return {
            info: (message) => {
                self.info(`[${context}] ${message}`)
            }
        }
    }

    info (message) {
        this._onChange(`[${humanDate()}: INFO] ${message}`)
    }

    exitMsg (message) {
        this._onChangeSync(`[${humanDate()}: EXIT] ${message}`)
    }

    debug (message) {
        this._onChange(`[${humanDate()}: DEBUG] ${message}`)
    }

    warn (message) {
        this._onChange(`[${humanDate()}: WARN] ${message}`)
    }

    error (message) {
        this._onChange(`[${humanDate()}: ERROR] ${message}`)
    }

    throw (error) {
        this._onChange(`[${humanDate()}: ERROR] ${error.name}: ${error.message}`)
    }

    print (...messages) {
        console.log(...messages)
        this.files.forEach(file => {
            fs.appendFileSync(file, `[${humanDate()}: CONSOLE OUTPUT] ${messages.join(' ')}\n`, () => {})
        })
    }

    printr (...messages) {
        console.log(...messages)
        this.files.forEach(file => {
            fs.appendFileSync(file, `${messages.join(' ')}\n`, () => {})
        })
    }

    printrf (...messages) {
        this.files.forEach(file => {
            fs.appendFileSync(file, `${messages.join(' ')}\n`, () => {})
        })
    }

    _onChange (line) {
        if (this.consoleOutput) {
            console.log(line)
        }

        this.files.forEach(file => {
            fs.appendFileSync(file, `${line}\n`)
        })
    }

    _onChangeSync (line) {
        if (this.consoleOutput) {
            console.log(line)
        }

        this.files.forEach(file => {
            fs.appendFileSync(file, `${line}\n`)
        })
    }

    pipe (file) {
        const os = require('os')

        this.files.push(file)
        this.printrf()
        this.printrf()
        this.printrf('------------------------------------------------------------')
        this.printrf(`---- NEW LOGGING SESSION STARTED at ${humanDate()} ----`)
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