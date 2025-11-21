import express from 'express';
import { config } from './config';
import { validateSignature } from './middleware/auth';
import { registry } from './handlers';
import * as fs from 'fs/promises';
import * as os from 'os';

const app = express();

// Parse JSON bodies (needed for HMAC)
app.use(express.json({ limit: '10mb' }));

// Track in-flight requests for graceful shutdown
let inFlightRequests = 0;
let isShuttingDown = false;

// Enhanced health check (no auth needed)
app.get('/health', async (req, res) => {
  try {
    // Check if we can write to /tmp (critical for code execution)
    const testFile = `/tmp/health-check-${Date.now()}`;
    await fs.writeFile(testFile, 'ok');
    await fs.unlink(testFile);

    // Check memory availability (at least 100MB free)
    const freeMemoryMB = os.freemem() / (1024 * 1024);
    const memoryOk = freeMemoryMB > 100;

    // Check CPU load (simple check)
    const loadAvg = os.loadavg()[0];
    const cpuOk = loadAvg < 10; // Allow up to 10x CPU load

    if (!memoryOk || !cpuOk) {
      return res.status(503).json({
        status: 'degraded',
        service: 'logline-executor',
        checks: {
          disk: 'ok',
          memory: memoryOk ? 'ok' : 'low',
          cpu: cpuOk ? 'ok' : 'high',
        },
      });
    }

    res.json({
      status: 'ok',
      service: 'logline-executor',
      checks: {
        disk: 'ok',
        memory: 'ok',
        cpu: 'ok',
      },
      inFlightRequests,
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      service: 'logline-executor',
      error: error.message,
    });
  }
});

// Execution endpoint (Protected)
app.post('/execute', validateSignature, async (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ error: 'Service is shutting down' });
  }

  inFlightRequests++;
  const { tool_id, input, context } = req.body;

  if (!tool_id || !registry[tool_id]) {
    inFlightRequests--;
    return res.status(400).json({ error: `Unknown tool_id: ${tool_id}` });
  }

  try {
    console.log(`[Executor] Running ${tool_id}`, { context });
    const handler = registry[tool_id];
    const result = await handler(input);
    
    inFlightRequests--;
    res.json({ status: 'success', result });
  } catch (error: any) {
    inFlightRequests--;
    console.error(`[Executor] Error in ${tool_id}:`, error);
    res.status(500).json({ 
      status: 'error', 
      error: error.message || 'Internal execution error' 
    });
  }
});

const server = app.listen(config.PORT, () => {
  console.log(`💪 LogLine Executor (Muscle) running on port ${config.PORT}`);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  isShuttingDown = true;

  // Stop accepting new requests
  server.close(() => {
    console.log('✅ HTTP server closed');
  });

  // Wait for in-flight requests (max 30 seconds)
  const maxWait = 30000;
  const startTime = Date.now();
  
  const checkInFlight = setInterval(() => {
    if (inFlightRequests === 0 || Date.now() - startTime > maxWait) {
      clearInterval(checkInFlight);
      console.log(`✅ All requests completed (waited ${Date.now() - startTime}ms)`);
      process.exit(0);
    } else {
      console.log(`⏳ Waiting for ${inFlightRequests} in-flight requests...`);
    }
  }, 1000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

