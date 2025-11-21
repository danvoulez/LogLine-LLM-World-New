#!/bin/bash

# Generate PWA icons for LogLine OS
# This script creates placeholder icons - replace with actual designs

echo "🎨 Generating PWA icons for LogLine OS..."

# Create public directory if it doesn't exist
mkdir -p public

# Create a simple SVG icon (you should replace this with your actual logo)
cat > /tmp/logline-icon.svg << 'EOF'
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="100" fill="#000000"/>
  <text x="256" y="320" font-family="Arial, sans-serif" font-size="200" font-weight="bold" fill="#FFFFFF" text-anchor="middle">LL</text>
</svg>
EOF

# Convert SVG to PNG using ImageMagick (if available) or provide instructions
if command -v convert &> /dev/null; then
  echo "Using ImageMagick to generate icons..."
  
  # Generate 192x192
  convert -background none /tmp/logline-icon.svg -resize 192x192 public/icon-192x192.png
  
  # Generate 512x512
  convert -background none /tmp/logline-icon.svg -resize 512x512 public/icon-512x512.png
  
  # Generate Apple Touch Icon (180x180)
  convert -background none /tmp/logline-icon.svg -resize 180x180 public/apple-touch-icon.png
  
  # Generate splash screens for iPhone 16 (430x932 @3x = 1290x2796)
  convert -background "#F3F4F6" -size 1290x2796 xc:#F3F4F6 \
    -gravity center \
    -font Arial -pointsize 120 -fill "#000000" \
    -annotate +0+0 "LogLine OS" \
    public/splash-iphone-16.png
  
  # Landscape splash (2796x1290)
  convert -background "#F3F4F6" -size 2796x1290 xc:#F3F4F6 \
    -gravity center \
    -font Arial -pointsize 120 -fill "#000000" \
    -annotate +0+0 "LogLine OS" \
    public/splash-iphone-16-landscape.png
  
  # Pro Max splash (same dimensions)
  cp public/splash-iphone-16.png public/splash-iphone-16-pro-max.png
  
  echo "✅ Icons generated successfully!"
  echo "📝 Note: These are placeholder icons. Replace with your actual logo design."
else
  echo "⚠️  ImageMagick not found. Please install it or manually create icons:"
  echo "   - public/icon-192x192.png (192x192)"
  echo "   - public/icon-512x512.png (512x512)"
  echo "   - public/apple-touch-icon.png (180x180)"
  echo "   - public/splash-iphone-16.png (1290x2796)"
  echo "   - public/splash-iphone-16-landscape.png (2796x1290)"
  echo "   - public/splash-iphone-16-pro-max.png (1290x2796)"
fi

