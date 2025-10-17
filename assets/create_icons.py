#!/usr/bin/env python3
"""
Convert SVG icons to PNG for Portfolio Tracker Electron app
"""
import os
import cairosvg

def convert_svg_to_png(size):
    """Convert SVG icon to PNG for the given size"""
    svg_file = f'icon-{size}x{size}.svg'
    png_file = f'{size}x{size}.png'
    
    if not os.path.exists(svg_file):
        print(f"Warning: {svg_file} not found")
        return False
        
    try:
        # Convert SVG to PNG
        cairosvg.svg2png(
            url=svg_file,
            write_to=png_file,
            output_width=size,
            output_height=size
        )
        print(f"Creating {png_file} ({size}x{size})")
        return True
    except Exception as e:
        print(f"Error converting {svg_file}: {e}")
        return False

def main():
    print("Creating Portfolio Tracker icons...")
    
    # Arrow points
    points = [
        (arrow_x + arrow_size//2, arrow_y),  # Top point
        (arrow_x, arrow_y + arrow_size//2),  # Left point
        (arrow_x + arrow_size//4, arrow_y + arrow_size//2),  # Left inner
        (arrow_x + arrow_size//4, arrow_y + arrow_size),  # Left bottom
        (arrow_x + 3*arrow_size//4, arrow_y + arrow_size),  # Right bottom
        (arrow_x + 3*arrow_size//4, arrow_y + arrow_size//2),  # Right inner
        (arrow_x + arrow_size, arrow_y + arrow_size//2)  # Right point
    ]
    
    draw.polygon(points, fill=text_color)
    
    return img

def create_all_icons():
    """Create icons in all required sizes"""
    # Icon sizes needed for different platforms
    sizes = {
        'icon.png': 512,      # Main icon
        'icon@2x.png': 1024,  # Retina display
        '16x16.png': 16,      # Windows small
        '32x32.png': 32,      # Windows medium
        '48x48.png': 48,      # Windows large
        '64x64.png': 64,      # Windows extra large
        '128x128.png': 128,   # Windows jumbo
        '256x256.png': 256,   # macOS
        '512x512.png': 512,   # macOS retina
        '1024x1024.png': 1024 # macOS retina large
    }
    
    # Create assets directory if it doesn't exist
    os.makedirs('assets', exist_ok=True)
    
    print("Creating Portfolio Tracker icons...")
    
    for filename, size in sizes.items():
        print(f"Creating {filename} ({size}x{size})")
        icon = create_portfolio_icon(size)
        icon.save(f'assets/{filename}', 'PNG')
    
    print("✅ All icons created successfully!")
    print("\nCreated icons:")
    for filename in sizes.keys():
        print(f"  📁 assets/{filename}")

if __name__ == "__main__":
    try:
        create_all_icons()
    except ImportError:
        print("❌ Error: PIL (Pillow) is required to create icons.")
        print("Install it with: pip install Pillow")
    except Exception as e:
        print(f"❌ Error creating icons: {e}")