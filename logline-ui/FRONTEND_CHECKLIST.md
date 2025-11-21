# Frontend Working Checklist

## ✅ Fixed Issues

1. **Backend Endpoint Path** - Fixed duplicate `api/v1` prefix
   - Changed `@Post('api/v1/render')` to `@Post('render')`
   - Endpoint now correctly accessible at `/api/v1/render`

2. **Build Status** - ✅ Compiles successfully
   - No TypeScript errors
   - No linting errors
   - All components properly typed

3. **Component Registry** - ✅ All components registered
   - Card, Metric, TraceRibbon, Table, Chart, Badge
   - AtomicRenderer properly handles all types

## 🔍 Testing Checklist

### Backend Connection
- [ ] Test `/api/v1/render` endpoint responds
- [ ] Verify CORS allows frontend origin
- [ ] Check response format matches `UILayout` type

### Frontend Components
- [ ] OmniBar renders and expands on focus
- [ ] Loading state shows when `isThinking={true}`
- [ ] Error state displays on API failure
- [ ] Empty state shows when no layout

### Component Rendering
- [ ] SafeCard renders with variants
- [ ] SafeMetric shows values and trends
- [ ] SafeTable displays data with sorting/search
- [ ] SafeChart renders (bar, line, pie, area)
- [ ] TraceRibbon shows events
- [ ] SafeBadge displays correctly

### Layout Generation
- [ ] "Show me the system status" → Dashboard layout
- [ ] "show contracts" → Contracts layout
- [ ] "show people" → People layout
- [ ] "show objects" → Objects layout
- [ ] "show ideas" → Ideas layout
- [ ] "show agents" → Agents layout
- [ ] "debug" or "trace" → Trace Ribbon layout

### PWA Features
- [ ] Service Worker registers
- [ ] App installable on iPhone
- [ ] Splash screen shows
- [ ] Offline mode works (cached content)

## 🚀 Quick Test Commands

### Test Backend
```bash
curl -X POST https://log-line-llm-world-new.vercel.app/api/v1/render \
  -H "Content-Type: application/json" \
  -d '{"prompt":"show contracts"}'
```

### Run Frontend Locally
```bash
cd logline-ui
npm run dev
```

### Build for Production
```bash
cd logline-ui
npm run build
npm start
```

## 📝 Known Issues / TODOs

- [ ] Generate actual PWA icons (currently using placeholders)
- [ ] Test on actual iPhone 16 device
- [ ] Verify all Registry layouts fetch real data
- [ ] Add error boundaries for component failures
- [ ] Add retry logic for failed API calls

## 🐛 Debugging

### If backend doesn't respond:
1. Check Vercel deployment status
2. Verify environment variables
3. Check CORS configuration
4. Test endpoint directly with curl

### If components don't render:
1. Check browser console for errors
2. Verify component registry includes all types
3. Check props match component expectations
4. Verify Framer Motion is working

### If PWA doesn't install:
1. Check manifest.json is accessible
2. Verify service worker registers
3. Test on HTTPS (required for PWA)
4. Check iOS Safari version (iOS 11.3+)

