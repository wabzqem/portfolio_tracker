const fs = require('fs');
const path = require('path');

// Create a simple base64 PNG icon (16x16 green square with white $)
const createSimpleIcon = (size) => {
  // This is a simple green icon with portfolio theme
  // For a real app, you'd want to use a proper icon design tool
  const canvas = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2-2}" fill="#228B22"/>
    <text x="${size/2}" y="${size/2+4}" font-family="Arial" font-size="${size/3}" fill="white" text-anchor="middle">$</text>
    <rect x="${size/4}" y="${size/3}" width="${size/8}" height="${size/4}" fill="#FFD700"/>
    <rect x="${size/2.5}" y="${size/3.5}" width="${size/8}" height="${size/3}" fill="#FFD700"/>
    <rect x="${size/1.8}" y="${size/4}" width="${size/8}" height="${size/2.5}" fill="#FFD700"/>
  </svg>`;
  
  return canvas;
};

// Create all required icon sizes
const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];

console.log('Creating simple SVG icons for Portfolio Tracker...');

sizes.forEach(size => {
  const iconSvg = createSimpleIcon(size);
  const filename = `icon-${size}x${size}.svg`;
  fs.writeFileSync(path.join(__dirname, filename), iconSvg);
  console.log(`Created ${filename}`);
});

// Copy the main icon
fs.writeFileSync(path.join(__dirname, 'icon.png.svg'), createSimpleIcon(512));

console.log('✅ Basic SVG icons created!');
console.log('Note: For production, consider using a professional icon design tool.');