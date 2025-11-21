import express from 'express';
import { config } from './config';
import { validateSignature } from './middleware/auth';
import { registry } from './handlers';

const app = express();

// Parse JSON bodies (needed for HMAC)
app.use(express.json({ limit: '10mb' }));

// Health check (no auth needed)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'logline-executor' });
});

// Execution endpoint (Protected)
app.post('/execute', validateSignature, async (req, res) => {
  const { tool_id, input, context } = req.body;

  if (!tool_id || !registry[tool_id]) {
    return res.status(400).json({ error: `Unknown tool_id: ${tool_id}` });
  }

  try {
    console.log(`[Executor] Running ${tool_id}`, { context });
    const handler = registry[tool_id];
    const result = await handler(input);
    
    res.json({ status: 'success', result });
  } catch (error: any) {
    console.error(`[Executor] Error in ${tool_id}:`, error);
    res.status(500).json({ 
      status: 'error', 
      error: error.message || 'Internal execution error' 
    });
  }
});

app.listen(config.PORT, () => {
  console.log(`💪 LogLine Executor (Muscle) running on port ${config.PORT}`);
});

