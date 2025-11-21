# PWA Setup for iPhone 16

LogLine OS is now a Progressive Web App (PWA) optimized for iPhone 16.

## Features

✅ **Standalone Mode** - Appears as a native app when installed
✅ **Offline Support** - Service Worker caches resources
✅ **iPhone 16 Optimized** - Splash screens and icons for 430x932 @3x
✅ **App Shortcuts** - Quick actions from home screen
✅ **Status Bar Styling** - Black translucent theme

## Setup Instructions

### 1. Generate Icons

Run the icon generation script (requires ImageMagick):

```bash
cd logline-ui
./scripts/generate-icons.sh
```

Or manually create these files in `public/`:
- `icon-192x192.png` (192x192)
- `icon-512x512.png` (512x512)
- `apple-touch-icon.png` (180x180)
- `splash-iphone-16.png` (1290x2796 for portrait)
- `splash-iphone-16-landscape.png` (2796x1290 for landscape)
- `splash-iphone-16-pro-max.png` (1290x2796)

### 2. Install on iPhone 16

1. Open Safari on iPhone 16
2. Navigate to your deployed app URL
3. Tap the Share button
4. Select "Add to Home Screen"
5. Customize the name if needed
6. Tap "Add"

### 3. Testing

- **Standalone Mode**: App should open without Safari UI
- **Splash Screen**: Should show on launch
- **Offline**: Disable network, app should still load cached content
- **Service Worker**: Check in Safari DevTools → Application → Service Workers

## Configuration Files

- `public/manifest.json` - PWA manifest
- `public/sw.js` - Service Worker
- `src/app/layout.tsx` - PWA meta tags
- `src/app/register-sw.tsx` - Service Worker registration
- `next.config.ts` - Next.js PWA headers

## Customization

### Change App Name
Edit `public/manifest.json`:
```json
{
  "name": "Your App Name",
  "short_name": "ShortName"
}
```

### Change Theme Color
Edit `src/app/layout.tsx`:
```typescript
themeColor: "#YOUR_COLOR"
```

### Add More Shortcuts
Edit `public/manifest.json` shortcuts array.

## Troubleshooting

**Service Worker not registering?**
- Ensure you're on HTTPS (or localhost)
- Check browser console for errors
- Verify `sw.js` is accessible at `/sw.js`

**Icons not showing?**
- Clear browser cache
- Verify icon files exist in `public/`
- Check icon sizes match manifest

**Splash screen not working?**
- Verify splash images are correct dimensions
- Check media queries in `layout.tsx`
- Test on actual device (not simulator)

## Next Steps

- [ ] Replace placeholder icons with actual logo
- [ ] Add push notification support
- [ ] Implement background sync
- [ ] Add install prompt
- [ ] Create app screenshots for App Store

