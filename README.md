# downlogger
A simple logging tool written in TypeScript

## Installation
```bash
npm install downlogger
```

## Usage

### JavaScript
```javascript
const DownLogger = require('downlogger');
const logger = new DownLogger();

logger.pipe('./my.log');
logger.info('This is an info message');
logger.warn('This is a warning');
logger.error('This is an error');
```

### TypeScript
```typescript
import Logger from 'downlogger';

const logger = new Logger();
logger.pipe('./my.log');
logger.info('This is an info message');
logger.warn('This is a warning');
logger.error('This is an error');
```

## Features
- Full TypeScript support with type declarations
- Automatic type inference for better IDE support
- Buffer-based logging for better performance
- Express middleware for request logging

## Development

### Build
```bash
npm run build
```

### Watch mode
```bash
npm run watch
```

The package automatically builds when installed via the `prepare` script.

