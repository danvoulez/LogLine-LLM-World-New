# How Files Reach the Frontend After Server Execution

## The Flow

```
1. Agent calls tool on backend
   ↓
2. Tool executes, modifies files on server
   ↓
3. Tool returns result with file contents
   ↓
4. Result included in toolCall object
   ↓
5. Backend streams toolCall via SSE
   ↓
6. Frontend receives toolCall in SSE stream
   ↓
7. Frontend extracts files from toolCall.result
   ↓
8. Frontend updates file tree/editor
```

## Step-by-Step with Code

### 1. Tool Executes on Backend

```typescript
// backend/src/tools/vercel-sandbox.tool.ts
this.toolHandlers.set('vercel_sandbox.execute', async (input, ctx) => {
  const { code, files } = input;
  
  // Execute code in sandbox (server-side)
  const result = await executeInSandbox(code, files);
  
  // Return result INCLUDING file contents
  return {
    output: result.stdout,
    error: result.stderr,
    files: {
      // Modified files with their contents
      'src/app.ts': result.files['src/app.ts'], // Full file content
      'src/components/Button.tsx': result.files['src/components/Button.tsx'],
    },
  };
});
```

### 2. Tool Result Gets Wrapped in toolCall

```typescript
// backend/src/agents/agent-runtime.service.ts
// When agent calls tool, AI SDK wraps it:
const toolCall = {
  toolName: 'vercel_sandbox.execute',
  args: { code: '...', files: {...} },
  result: {
    // This is what the tool returned
    output: '...',
    files: {
      'src/app.ts': 'export default function App() {...}',
      'src/components/Button.tsx': 'export function Button() {...}',
    },
  },
};
```

### 3. Backend Streams toolCall to Frontend

```typescript
// backend/src/agents/agents.controller.ts
// Stream tool calls if any
if (result.toolCalls && result.toolCalls.length > 0) {
  for (const toolCall of result.toolCalls) {
    // This streams the ENTIRE toolCall object, including result with files
    res.write(`data: ${JSON.stringify({ 
      type: 'tool_call', 
      toolCall: toolCall  // Contains: toolName, args, result (with files!)
    })}\n\n`);
  }
}
```

**What gets streamed:**
```json
{
  "type": "tool_call",
  "toolCall": {
    "toolName": "vercel_sandbox.execute",
    "args": { "code": "...", "files": {...} },
    "result": {
      "output": "Code executed successfully",
      "files": {
        "src/app.ts": "export default function App() { return <div>Hello</div>; }",
        "src/components/Button.tsx": "export function Button() { return <button>Click</button>; }"
      }
    }
  }
}
```

### 4. Frontend Receives via SSE Stream

```typescript
// frontend: ConversationPanel.tsx or similar
const handleSSE = (data: any) => {
  if (data.type === 'tool_call') {
    const { toolCall } = data;
    
    // Extract files from tool result
    if (toolCall.result?.files) {
      const files = toolCall.result.files;
      
      // Update file tree/editor with new file contents
      updateFileTree(files);
    }
  }
};

// Example updateFileTree function
function updateFileTree(files: Record<string, string>) {
  // Update your file tree state
  setFileTree((prev) => {
    const newTree = { ...prev };
    
    for (const [path, content] of Object.entries(files)) {
      // Update or create file in tree
      newTree[path] = {
        content,
        lastModified: new Date(),
      };
    }
    
    return newTree;
  });
  
  // If a file is currently open in editor, update it
  if (openFilePath && files[openFilePath]) {
    setEditorContent(files[openFilePath]);
  }
}
```

### 5. Complete Example: Frontend Handling

```typescript
// frontend: CodeEditor.tsx
import { useEffect, useState } from 'react';
import { streamRunUpdates } from '../lib/backend-client';

export function CodeEditor() {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [openFile, setOpenFile] = useState<string | null>(null);

  const executeCode = async (code: string) => {
    // Execute app action
    const result = await executeAppAction(
      'coding-agent-frontend',
      'execute_code_agent',
      { code },
      { user_id: 'user-123', tenant_id: 'tenant-abc' }
    );

    // Stream updates
    streamRunUpdates(result.run_id, (data) => {
      if (data.type === 'tool_call') {
        const { toolCall } = data;
        
        // Check if this tool call has file results
        if (toolCall.toolName === 'vercel_sandbox.execute' && toolCall.result?.files) {
          // Update files state with new contents
          setFiles((prev) => ({
            ...prev,
            ...toolCall.result.files, // Merge new files
          }));
          
          // If first file, open it in editor
          if (!openFile && Object.keys(toolCall.result.files).length > 0) {
            const firstFile = Object.keys(toolCall.result.files)[0];
            setOpenFile(firstFile);
          }
        }
      }
    });
  };

  return (
    <div>
      <FileTree files={files} onSelect={setOpenFile} />
      <Editor 
        file={openFile} 
        content={files[openFile] || ''} 
        onChange={(content) => {
          setFiles((prev) => ({
            ...prev,
            [openFile!]: content,
          }));
        }}
      />
    </div>
  );
}
```

## Key Points

1. **Tool returns file contents in result**
   - Tool executes on backend
   - Returns object with `files: { path: content }` mapping

2. **Result wrapped in toolCall**
   - AI SDK wraps tool result in `toolCall.result`
   - Includes `toolName`, `args`, and `result`

3. **Backend streams entire toolCall**
   - Via SSE: `{ type: 'tool_call', toolCall: {...} }`
   - Frontend receives complete toolCall object

4. **Frontend extracts files**
   - From `toolCall.result.files`
   - Updates file tree/editor state
   - Displays in UI

## Alternative: Fetch Files After Execution

If files are too large to stream, you can:

1. Tool returns file paths/IDs
2. Frontend fetches files separately

```typescript
// Tool returns file IDs
return {
  output: '...',
  fileIds: ['file-123', 'file-456'],
};

// Frontend fetches files
for (const fileId of toolCall.result.fileIds) {
  const file = await fetch(`/api/files/${fileId}`);
  const content = await file.text();
  updateFile(fileId, content);
}
```

But for most cases, **streaming file contents in the tool result works best**.

## Summary

**Files reach the frontend via:**
1. Tool returns files in result object
2. Result wrapped in toolCall
3. Backend streams toolCall via SSE
4. Frontend extracts `toolCall.result.files`
5. Frontend updates file tree/editor

**The files are in the SSE stream, not a separate API call.**

