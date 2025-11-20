# File Transfer Alternatives & Issues

## Potential Problems with SSE Streaming Approach

### 1. **File Size Limits**
- SSE messages have practical size limits
- Large files (MB+) in JSON can cause issues
- JSON encoding overhead for binary/large text

### 2. **Memory Issues**
- Entire file contents loaded in memory
- Multiple large files = memory pressure
- Serverless function memory limits

### 3. **Performance**
- JSON.stringify/parse overhead for large files
- Network transfer of entire file contents
- Blocking SSE stream

### 4. **Real-World Patterns**
- Most code execution tools (Vercel Sandbox, etc.) don't return full file contents
- They return file paths, diffs, or require separate fetch

## Alternative Approaches

### Option 1: File IDs / References (Recommended)

**Tool returns file references, frontend fetches separately:**

```typescript
// Tool returns file IDs/references
return {
  output: 'Code executed successfully',
  files: {
    'src/app.ts': { id: 'file-123', size: 1024, modified: true },
    'src/components/Button.tsx': { id: 'file-456', size: 512, modified: true },
  },
};

// Frontend fetches files separately
for (const [path, fileRef] of Object.entries(toolCall.result.files)) {
  const content = await fetch(`/api/files/${fileRef.id}`).then(r => r.text());
  updateFile(path, content);
}
```

**Backend endpoint:**
```typescript
@Get('files/:id')
async getFile(@Param('id') id: string) {
  // Return file content directly (not via SSE)
  return this.fileService.getFile(id);
}
```

### Option 2: File Diffs Only

**Tool returns only changes, frontend applies:**

```typescript
// Tool returns diffs
return {
  output: '...',
  fileDiffs: {
    'src/app.ts': {
      type: 'modified',
      diff: '@@ -1,3 +1,5 @@\n export default...',
      // Or just changed lines
      changes: [
        { line: 10, old: 'old code', new: 'new code' },
      ],
    },
  },
};
```

### Option 3: Separate File Stream Endpoint

**Tool returns file list, separate endpoint streams files:**

```typescript
// Tool returns file list
return {
  output: '...',
  fileIds: ['file-123', 'file-456'],
};

// Frontend streams files separately
const fileStream = await fetch(`/api/runs/${runId}/files/stream`);
// Stream files one by one
```

### Option 4: WebSocket for Large Files

**Use WebSocket instead of SSE for binary/large transfers:**

```typescript
// WebSocket connection for file transfer
const ws = new WebSocket(`/api/runs/${runId}/files`);
ws.onmessage = (event) => {
  const { path, content, chunk } = JSON.parse(event.data);
  // Handle chunked file transfer
};
```

### Option 5: Store in Database/Storage, Return URLs

**Tool stores files, returns URLs:**

```typescript
// Tool stores files in S3/storage
const fileUrl = await storeFile(content);
return {
  output: '...',
  files: {
    'src/app.ts': { url: fileUrl, expiresIn: 3600 },
  },
};

// Frontend fetches from URL
const content = await fetch(fileUrl).then(r => r.text());
```

## Recommended Approach: Hybrid

**For small files (< 10KB): Stream in SSE**
**For large files: Return file IDs, fetch separately**

```typescript
// Tool returns mixed format
return {
  output: '...',
  files: {
    // Small files: inline content
    'src/config.ts': 'export const config = {...}',
    
    // Large files: reference
    'src/large-file.ts': { 
      id: 'file-123',
      size: 50000,
      fetchUrl: `/api/files/file-123`,
    },
  },
};

// Frontend handles both
for (const [path, fileData] of Object.entries(files)) {
  if (typeof fileData === 'string') {
    // Inline content
    updateFile(path, fileData);
  } else {
    // Fetch large file
    const content = await fetch(fileData.fetchUrl).then(r => r.text());
    updateFile(path, content);
  }
}
```

## What's Your Concern?

**Which issue are you worried about?**
1. File size limits?
2. Performance with large files?
3. How Vercel Sandbox actually works?
4. Something else?

Let me know and we can design the right solution for your use case.

