# Mobile iPhone Architecture - Surviving Apple's Restrictions

## The Challenge: iPhone + Mobile Safari

**Apple's restrictions we must work around:**
1. ❌ No local file system access
2. ❌ Background execution killed aggressively
3. ❌ Memory limits (much stricter than desktop)
4. ❌ Network interruptions (mobile connections)
5. ❌ SSE connection drops on app switch
6. ❌ No WebSocket in background
7. ❌ Limited storage (localStorage/sessionStorage)

## Core Architecture Changes

### 1. **File Storage: Backend-Only**

**Problem:** iPhone can't write to local filesystem.

**Solution:** All files stored in backend/cloud storage.

```typescript
// Files are stored in backend, not local filesystem
interface FileState {
  path: string;
  content: string;
  version: number;
  lastModified: Date;
  storedAt: string; // Backend storage ID
}

// Frontend only holds current working set in memory
const [files, setFiles] = useState<Record<string, FileState>>({});
```

**Backend endpoints:**
```typescript
// Store file
POST /api/runs/:runId/files
Body: { path: string, content: string }
Response: { fileId: string, url: string }

// Get file
GET /api/files/:fileId
Response: { path: string, content: string }

// List files for run
GET /api/runs/:runId/files
Response: FileState[]
```

### 2. **SSE with Reconnection Logic**

**Problem:** Safari kills SSE connections on background/network change.

**Solution:** Aggressive reconnection with state sync.

```typescript
// Mobile-optimized SSE client
class MobileSSEClient {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start at 1s
  
  async connect(runId: string, onMessage: (data: any) => void) {
    const connect = async () => {
      try {
        const response = await fetch(`/api/runs/${runId}/stream`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Accept': 'text/event-stream',
          },
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Connection closed, reconnect
            throw new Error('Connection closed');
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.substring(6));
              onMessage(data);
            }
          }
        }
      } catch (error) {
        // Reconnect with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30s
          
          await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
          
          // Sync state before reconnecting
          await this.syncState(runId);
          
          return connect();
        } else {
          throw new Error('Max reconnection attempts reached');
        }
      }
    };

    return connect();
  }

  private async syncState(runId: string) {
    // Fetch latest state from backend
    const run = await fetch(`/api/runs/${runId}`);
    const events = await fetch(`/api/runs/${runId}/events`);
    // Update local state
  }
}
```

### 3. **State Persistence: Backend + IndexedDB**

**Problem:** localStorage limited, lost on clear.

**Solution:** Backend as source of truth, IndexedDB for offline cache.

```typescript
// Use IndexedDB for larger storage
class MobileStateManager {
  private db: IDBDatabase;

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CodeAgentDB', 1);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Files store
        if (!db.objectStoreNames.contains('files')) {
          const filesStore = db.createObjectStore('files', { keyPath: 'path' });
          filesStore.createIndex('runId', 'runId', { unique: false });
        }
        
        // Runs store
        if (!db.objectStoreNames.contains('runs')) {
          db.createObjectStore('runs', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = reject;
    });
  }

  async saveFile(runId: string, path: string, content: string) {
    const transaction = this.db.transaction(['files'], 'readwrite');
    const store = transaction.objectStore('files');
    await store.put({ path, content, runId, timestamp: Date.now() });
  }

  async getFiles(runId: string) {
    const transaction = this.db.transaction(['files'], 'readonly');
    const store = transaction.objectStore('files');
    const index = store.index('runId');
    return index.getAll(runId);
  }
}
```

### 4. **Background Handling: Service Worker (PWA)**

**Problem:** App killed when switching away.

**Solution:** PWA with service worker for background sync.

```typescript
// service-worker.ts
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-run-state') {
    event.waitUntil(syncRunState());
  }
});

async function syncRunState() {
  // Sync pending state to backend
  const pending = await getPendingState();
  for (const state of pending) {
    await fetch(`/api/runs/${state.runId}/sync`, {
      method: 'POST',
      body: JSON.stringify(state),
    });
  }
}
```

### 5. **File Transfer: Chunked + Compression**

**Problem:** Large files on slow mobile connections.

**Solution:** Chunk files, compress, stream progressively.

```typescript
// Backend: Chunk large files
@Get('runs/:runId/files/:fileId/chunks')
async getFileChunks(
  @Param('runId') runId: string,
  @Param('fileId') fileId: string,
  @Query('chunk') chunk: number,
) {
  const file = await this.fileService.getFile(fileId);
  const chunkSize = 64 * 1024; // 64KB chunks
  const start = chunk * chunkSize;
  const end = Math.min(start + chunkSize, file.content.length);
  
  return {
    chunk,
    totalChunks: Math.ceil(file.content.length / chunkSize),
    content: file.content.slice(start, end),
    compressed: compress(file.content.slice(start, end)), // gzip
  };
}

// Frontend: Progressive loading
async function loadFileProgressive(fileId: string) {
  let content = '';
  let chunk = 0;
  
  while (true) {
    const response = await fetch(
      `/api/runs/${runId}/files/${fileId}/chunks?chunk=${chunk}`
    );
    const data = await response.json();
    
    content += decompress(data.compressed);
    
    // Update UI progressively
    updateFileInEditor(fileId, content);
    
    if (chunk >= data.totalChunks - 1) break;
    chunk++;
  }
}
```

### 6. **Mobile-Optimized UI**

**Touch-friendly, efficient rendering:**

```typescript
// Mobile code editor component
export function MobileCodeEditor() {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState<string | null>(null);
  
  // Virtual scrolling for large files
  const visibleLines = useMemo(() => {
    if (!activeFile) return [];
    const content = files[activeFile] || '';
    const lines = content.split('\n');
    // Only render visible lines
    return lines.slice(viewportStart, viewportEnd);
  }, [activeFile, files, viewportStart, viewportEnd]);

  return (
    <div className="mobile-editor">
      {/* File switcher - swipeable tabs */}
      <SwipeableFileTabs 
        files={Object.keys(files)}
        active={activeFile}
        onSelect={setActiveFile}
      />
      
      {/* Code editor - touch-optimized */}
      <TouchCodeEditor
        content={files[activeFile] || ''}
        onChange={(content) => {
          setFiles(prev => ({
            ...prev,
            [activeFile!]: content,
          }));
        }}
        visibleLines={visibleLines}
      />
    </div>
  );
}
```

### 7. **Network Resilience**

**Handle interruptions gracefully:**

```typescript
// Network-aware client
class NetworkAwareClient {
  private isOnline = navigator.onLine;
  private pendingRequests: Array<() => Promise<void>> = [];

  constructor() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushPending();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  async request(url: string, options: RequestInit) {
    if (!this.isOnline) {
      // Queue for later
      return new Promise((resolve) => {
        this.pendingRequests.push(async () => {
          const result = await fetch(url, options);
          resolve(result);
        });
      });
    }

    try {
      return await fetch(url, options);
    } catch (error) {
      // Network error, queue for retry
      this.pendingRequests.push(async () => {
        return await fetch(url, options);
      });
      throw error;
    }
  }

  private async flushPending() {
    while (this.pendingRequests.length > 0) {
      const request = this.pendingRequests.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          // Retry later
          this.pendingRequests.push(request);
        }
      }
    }
  }
}
```

## Complete Mobile Flow

### File Creation/Modification

```
1. User edits in mobile editor
   ↓
2. Changes saved to IndexedDB (immediate)
   ↓
3. Debounced sync to backend (every 2s or on pause)
   ↓
4. Backend stores in cloud storage
   ↓
5. Other devices can fetch via API
```

### Code Execution

```
1. User triggers execution
   ↓
2. Frontend sends code + file refs to backend
   ↓
3. Backend executes in sandbox
   ↓
4. Backend stores result files
   ↓
5. SSE streams file IDs (not contents)
   ↓
6. Frontend fetches files progressively
   ↓
7. Files cached in IndexedDB
```

### State Recovery

```
1. App reopens after background
   ↓
2. Check IndexedDB for cached state
   ↓
3. Fetch latest from backend
   ↓
4. Merge and resolve conflicts
   ↓
5. Resume SSE connection
```

## Key Principles for iPhone

1. **Backend is source of truth** - Never rely on local storage alone
2. **Progressive loading** - Load files as needed, not all at once
3. **Offline-first** - Cache in IndexedDB, sync when online
4. **Reconnection logic** - Always reconnect SSE, sync state
5. **Chunked transfers** - Large files in chunks
6. **Touch-optimized** - Mobile-first UI
7. **Battery efficient** - Minimize background work

## Implementation Priority

1. ✅ **Backend file storage API** - Store files server-side
2. ✅ **IndexedDB caching** - Local cache for offline
3. ✅ **SSE reconnection** - Handle connection drops
4. ✅ **Progressive file loading** - Chunked transfers
5. ✅ **Mobile UI** - Touch-friendly editor
6. ⚠️ **Service Worker** - Background sync (optional, complex)

## Testing on iPhone

**Must test:**
- [ ] App switching (background/foreground)
- [ ] Network interruption (airplane mode)
- [ ] Low memory (many files open)
- [ ] Slow network (3G simulation)
- [ ] Safari refresh (state recovery)
- [ ] Battery drain (long sessions)

This architecture survives Apple's restrictions! 🍎💪

