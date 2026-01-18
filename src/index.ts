import * as fs from 'fs';
import * as os from 'os';
import humanDate from './human-date';
import onFinished = require('on-finished');

interface LoggerContext {
    info: (message: string) => void;
}

type OverflowTimeout = number | 'TIMEOUT_3_MINUTES';

export default class Logger {
    private overflowTimeout: number;
    private __console: Console;
    private consoleOutput: boolean;
    private synchronous: boolean;
    private files: string[];
    private logBufferOverflow: number;
    private logBuffer: string[];
    public presets: {
        serverListening: (port: number) => void;
        middleWare: (req: any, res: any, next: any) => void;
        onlyFileMiddleware: (req: any, res: any, next: any) => void;
    };

    /**
     * @param consoleOutput Defines if everything logged should also be displayed in the console
     * @param logBufferOverflow Sets the maximum lines of logBuffer before it is written to the file
     * @param overflowTimeout Sets the time in milliseconds after which the logBuffer is written to the file
     * @param synchronous Sets if the logBuffer should be written to the file synchronously or asynchronously
     */
    constructor(
        consoleOutput: boolean = true,
        logBufferOverflow: number = 100,
        overflowTimeout: OverflowTimeout = 'TIMEOUT_3_MINUTES',
        synchronous: boolean = true
    ) {
        if (overflowTimeout === 'TIMEOUT_3_MINUTES') {
            overflowTimeout = 1000 * 60 * 3;
        }

        this.overflowTimeout = overflowTimeout as number;
        this.__console = console;
        
        this.consoleOutput = consoleOutput;
        this.synchronous = synchronous;
        this.files = [];
        this.logBufferOverflow = logBufferOverflow < 0 ? 100 : logBufferOverflow;
        this.logBuffer = []; // Store lines to log until logBufferOverflow is reached

        const self = this;

        this.presets = {
            serverListening: (port: number) => {
                self.info('WebServer is listening now');
            },
            middleWare: (req: any, res: any, next: any) => {
                const startTimeStamp = new Date();

                onFinished(res, () => {
                    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                    if (ip === '::1') ip = '127.0.0.1';
                    const endTimeStamp = new Date();

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
                            responseTimeInMs: endTimeStamp.getTime() - startTimeStamp.getTime()
                        }
                    };

                    // GET /route - 200 - 0.000 FROM 127.0.0.1
                    self.inContext('WebServer').info(`${payload.method} ${payload.url} - ${payload.response.statusCode} - ${payload.response.responseTimeInMs}ms FROM ${ip}`);
                });

                next();
            },
            onlyFileMiddleware: (req: any, res: any, next: any) => {
                const startTimeStamp = new Date();

                onFinished(res, () => {
                    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                    if (ip === '::1') ip = '127.0.0.1';
                    const endTimeStamp = new Date();

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
                            responseTimeInMs: endTimeStamp.getTime() - startTimeStamp.getTime()
                        }
                    };

                    // GET /route - 200 - 0.000 FROM 127.0.0.1
                    self.inFileContext('WebServer').info(`${payload.method} ${payload.url} - ${payload.response.statusCode} - ${payload.response.responseTimeInMs}ms FROM ${ip}`);
                });

                next();
            }
        };

        setInterval(() => {
            this._writeToFile();
        }, overflowTimeout as number);

        process.on('beforeExit', (code: number) => {
            this._writeBufferSync();
            self.exitMsg('Process beforeExit event with code: ' + (code || 'unknown'));
        });

        // only works when the process normally exits
        // on windows, ctrl-c will not trigger this handler (it is unnormal)
        // unless you listen on 'SIGINT'
        process.on('exit', (code: number) => {
            this._writeBufferSync();
            self.exitMsg('Process exit event with code: ' + (code || 'unknown'));
        });

        // just in case some user like using "kill"
        process.on('SIGTERM', (signal: string) => {
            this._writeBufferSync();
            self.exitMsg(`Process ${process.pid} received a SIGTERM signal`);
            process.exit(0);
        });

        // catch ctrl-c, so that event 'exit' always works
        process.on('SIGINT', (signal: string) => {
            this._writeBufferSync();
            self.exitMsg(`Process ${process.pid} has been interrupted`);
            process.exit(0);
        });
    }

    /**
     * Sets a custom console to use instead of the default console
     * @param customConsole Custom console to use instead of the default console
     */
    setCustomConsole(customConsole: Console): void {
        this.__console = customConsole;
    }

    /**
     * @param context Execution context name
     * @returns Logger context object
     */
    inContext(context: string): LoggerContext {
        const self = this;
        return {
            info: (message: string) => {
                self.info(`[${context}] ${message}`);
            }
        };
    }

    /**
     * Same as inContext but doesn't log to the console
     * @param context Execution context name
     * @returns Logger context object
     */
    inFileContext(context: string): LoggerContext {
        const self = this;
        return {
            info: (message: string) => {
                self.finfo(`[${context}] ${message}`);
            }
        };
    }

    /**
     * Logs a message to the console and to the file
     * @param message Object to log
     */
    info(message: string): void {
        this._onChange(`[${humanDate()}: INFO] ${message}`);
    }

    /**
     * Logs a message only to the file
     * @param message Object to log
     */
    finfo(message: string): void {
        // Buffer output
        this.logBuffer.push(`[${humanDate()}: INFO] ${message}`);
        if (this.logBuffer.length > this.logBufferOverflow) {
            this._writeToFile();
        }
    }

    /**
     * Logs an exit-message to the console and to the file (this should only be used if the process is about to exit)
     * @param message Exit Message
     */
    exitMsg(message: string): void {
        this._onChangeSync(`[${humanDate()}: EXIT] ${message}`);
    }

    /**
     * Logs a debug-message to the console and to the file (this should only be used for debugging purposes)
     * @param message Object to log
     */
    debug(message: string): void {
        this._onChange(`[${humanDate()}: DEBUG] ${message}`);
    }

    /**
     * Logs a warning to the console and to the file
     * @param message Object to log
     */
    warn(message: string): void {
        this._onChange(`[${humanDate()}: WARN] ${message}`);
    }

    /**
     * Logs an error to the console and to the file
     * @param message Object to log
     */
    error(message: string): void {
        this._onChange(`[${humanDate()}: ERROR] ${message}`);
    }

    /**
     * Logs an error to the console and to the file and logs the stacktrace to the console and to the file
     * @param error Error object to log
     */
    throw(error: Error): void {
        this.__console.error(error);
        this._onChange(`[${humanDate()}: ERROR] ${error.name}: ${error.message}`);
        // Add stacktrace as an extra line
        this._onChange(`[${humanDate()}: ERRORSTACK] ${error.stack}`);
    }

    /**
     * Instantly Logs a message to the console and to the file (WARNING: This will block the process)
     * @param messages Messages to log
     */
    print(...messages: any[]): void {
        this.__console.log(...messages);
        this.files.forEach(file => {
            fs.appendFileSync(file, `[${humanDate()}: CONSOLE OUTPUT] ${messages.join(' ')}\n`);
        });
    }

    /**
     * Instantly logs a message to the console and to the file (WARNING: This will block the process)
     * @param messages Messages to log
     */
    printr(...messages: any[]): void {
        this.__console.log(...messages);
        this.files.forEach(file => {
            fs.appendFileSync(file, `${messages.join(' ')}\n`);
        });
    }

    /**
     * Instantly logs a message into just the file (WARNING: This will block the process)
     * @param messages Messages to log
     */
    printrf(...messages: any[]): void {
        this.files.forEach(file => {
            fs.appendFileSync(file, `${messages.join(' ')}\n`);
        });
    }

    /**
     * Internal function to log a message to the console and to the file
     * @private
     * @param line Line to log
     */
    private _onChange(line: string): void {
        if (this.consoleOutput) {
            this.__console.log(line);
        }

        // Buffer output
        this.logBuffer.push(line);
        if (this.logBuffer.length > this.logBufferOverflow) {
            this._writeToFile();
        }
    }

    /**
     * Internal function to write the buffer to the file
     * @private
     */
    private _writeToFile(): void {
        const self = this;
        const linez = this.logBuffer.join('\n'); // Concat all lines

        this.logBuffer = []; // Reset buffer

        this.files.forEach(file => {
            if (self.synchronous) {
                fs.appendFileSync(file, `${linez}\n`);
            } else {
                fs.appendFile(file, `${linez}\n`, () => {});
            }
        });
    }

    /**
     * Internal function to write the buffer synchronously to the file
     * @private
     */
    private _writeToFileSync(): void {
        const self = this;
        const linez = this.logBuffer.join('\n'); // Concat all lines

        this.logBuffer = []; // Reset buffer

        this.files.forEach(file => {
            fs.appendFileSync(file, `${linez}\n`);
        });
    }

    /**
     * Internal function to write the Buffer synchronously
     * @private
     */
    private _writeBufferSync(): void {
        if (this.logBuffer.length > 0) {
            this._writeToFileSync();
        }
    }

    /**
     * Internal function to log a message to the console and to the file (WARNING: This will block the process)
     * @private
     * @param line Line to log
     */
    private _onChangeSync(line: string): void {
        if (this.consoleOutput) {
            this.__console.log(line);
        }

        this.files.forEach(file => {
            fs.appendFileSync(file, `${line}\n`);
        });
    }

    /**
     * Manually writes the log buffer to the file
     */
    writeNow(): void {
        this._writeToFile();
    }

    /**
     * Pipes the logs into a file
     * @param file Filepath for the logfile
     */
    pipe(file: string): void {
        this.files.push(file);
        this.printrf();
        this.printrf();
        this.printrf('------------------------------------------------------------');
        this.printrf(`-- NEW LOGGING SESSION STARTED at ${humanDate()}`);
        this.printrf(`-- Logging to ${file}`);
        this.printrf(`-- CWD: ${process.cwd()}`);
        this.printrf(`-- OS: ${os.platform()} ${os.arch()}`);
        this.printrf(`-- Node: ${process.version}`);
        this.printrf(`-- PID: ${process.pid}`);
        this.printrf(`-- Uptime: ${process.uptime()} seconds`);
        this.printrf(`-- Logged in as ${os.userInfo().username}@${os.hostname()}`);
        this.printrf(`-- Total Memory: ${os.totalmem()} bytes (${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB)`);
        this.printrf(`-- Free Memory: ${os.freemem()} bytes (${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB)`);
        this.printrf('------------------------------------------------------------');
    }
}

// Export as both default and named export for CommonJS compatibility
module.exports = Logger;
module.exports.default = Logger;
