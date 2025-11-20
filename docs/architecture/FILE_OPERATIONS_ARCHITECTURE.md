# File Operations Architecture

## The Question

**If an agent needs to create/modify files, does the backend send text and the frontend handles the filesystem?**

**Answer: It depends on the tool implementation. You can do either approach.**

## Two Approaches

### Approach 1: Backend-Executed Tools (Default)

**Tools run on the backend server. They have direct access to the server's filesystem.**

```
Agent → Tool Call → ToolRuntimeService → Tool Handler (Backend)
                                              ↓
                                        File System (Server)
```

**Example: Vercel Sandbox Tool**

```typescript
// backend/src/tools/vercel-sandbox.tool.ts
this.toolHandlers.set('vercel_sandbox.execute', async (input, ctx) => {
  // Tool runs on backend
  // Has access to server filesystem
  const { code, files } = input;
  
  // Execute code in sandbox (runs on server)
  const result = await executeInSandbox(code, files);
  
  return {
    output: result.stdout,
    files: result.modifiedFiles, // Files modified on server
  };
});
```

**When to use:**
- Code execution in sandbox (like Vercel Sandbox)
- Server-side file operations
- Secure operations that shouldn't run on client

### Approach 2: Frontend-Executed Tools (Hybrid)

**Tool sends instructions to frontend. Frontend executes filesystem operations.**

```
Agent → Tool Call → ToolRuntimeService → Tool Handler (Backend)
                                              ↓
                                        Returns Instructions
                                              ↓
                                        Frontend Receives
                                              ↓
                                        Frontend Executes
                                              ↓
                                        File System (Client)
```

**Example: File Editor Tool**

```typescript
// backend/src/tools/file-editor.tool.ts
this.toolHandlers.set('file_editor.write', async (input, ctx) => {
  // Tool runs on backend but returns instructions
  const { filePath, content, operation } = input;
  
  // Return instruction for frontend to execute
  return {
    type: 'file_operation',
    operation: 'write', // or 'create', 'delete', 'read'
    filePath,
    content,
    requiresFrontendExecution: true,
  };
});
```

**Frontend handles it:**

```typescript
// frontend handles tool call result
const toolResult = await executeAppAction(appId, actionId, event, context);

if (toolResult.type === 'file_operation') {
  // Frontend executes filesystem operation
  if (toolResult.operation === 'write') {
    await writeFile(toolResult.filePath, toolResult.content);
  }
}
```

**When to use:**
- Client-side file operations (browser file system)
- User's local files
- Operations that require user permission

## Current Architecture

### Tools Run on Backend by Default

Looking at `backend/src/tools/tool-runtime.service.ts`:

```typescript
async callTool(toolId: string, input: any, context: ToolContext): Promise<any> {
  // Get handler (runs on backend)
  const handler = this.toolHandlers.get(toolId);
  
  // Execute tool (on backend)
  const output = await handler(input, context);
  
  return output; // Returned to agent, then to frontend
}
```

**Flow:**
1. Agent calls tool → `ToolRuntimeService.callTool()`
2. Tool handler executes on backend
3. Tool result returned to agent
4. Agent result streamed to frontend via SSE
5. Frontend receives result and can act on it

### How Frontend Receives Tool Results

**Via SSE Stream:**

```typescript
// Backend streams tool calls
res.write(`data: ${JSON.stringify({ 
  type: 'tool_call', 
  toolCall: {
    toolName: 'file_editor.write',
    args: { filePath: 'src/app.ts', content: '...' },
    result: { ... } // Tool result
  }
})}\n\n`);
```

**Frontend receives:**

```typescript
// Frontend handles SSE stream
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'tool_call') {
    const { toolName, args, result } = data.toolCall;
    
    // If tool returns instructions for frontend
    if (result.requiresFrontendExecution) {
      executeFileOperation(result);
    }
  }
};
```

## Recommended Pattern for File Operations

### For Code Agent (Vercel Sandbox)

**Use Backend-Executed Tool:**

```typescript
// backend/src/tools/vercel-sandbox.tool.ts
@Injectable()
export class VercelSandboxTool {
  async createExecuteTool() {
    return {
      id: 'vercel_sandbox.execute',
      execute: async (input: {
        code: string;
        files?: Record<string, string>;
      }, context: ToolContext) => {
        // Runs on backend
        // Uses Vercel Sandbox API (server-side)
        const result = await this.sandbox.execute(input.code, input.files);
        
        return {
          output: result.stdout,
          files: result.files, // Modified files
          error: result.stderr,
        };
      },
    };
  }
}
```

**Frontend receives result and displays it:**

```typescript
// Frontend just displays the result
if (event.type === 'tool_call' && event.toolCall.toolName === 'vercel_sandbox.execute') {
  const { output, files } = event.toolCall.result;
  
  // Display output
  setCodeOutput(output);
  
  // Update file tree if files were modified
  if (files) {
    updateFileTree(files);
  }
}
```

### For Local File Editing

**Use Frontend-Executed Pattern:**

```typescript
// backend/src/tools/file-editor.tool.ts
this.toolHandlers.set('file_editor.write', async (input, ctx) => {
  // Validate and prepare instruction
  return {
    type: 'file_operation',
    operation: 'write',
    filePath: input.filePath,
    content: input.content,
    requiresFrontendExecution: true,
  };
});
```

**Frontend executes:**

```typescript
// frontend handles file operation
if (result.requiresFrontendExecution) {
  // Use File System Access API or similar
  const fileHandle = await window.showSaveFilePicker();
  const writable = await fileHandle.createWritable();
  await writable.write(result.content);
  await writable.close();
}
```

## Summary

**Default: Tools run on backend**
- Tools execute on server
- Have access to server filesystem
- Results streamed to frontend
- Frontend displays results

**Alternative: Frontend-executed**
- Tool returns instructions
- Frontend executes filesystem operations
- Useful for client-side file operations

**For your use case (code agent):**
- Use backend-executed tool (Vercel Sandbox)
- Tool runs on server
- Frontend receives results and displays them
- Files are modified on server, frontend shows updates

**The architecture is flexible - you choose where tools execute based on your needs.**

