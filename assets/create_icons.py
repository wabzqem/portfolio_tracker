#!/usr/bin/env python3
"""
Create app icons for Portfolio Tracker Electron app
This script generates icons in various sizes needed for different platforms
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_portfolio_icon(size):
    """Create a portfolio-themed icon"""
    # Create a new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Define colors
    bg_color = (34, 139, 34, 255)  # Forest green
    accent_color = (255, 215, 0, 255)  # Gold
    text_color = (255, 255, 255, 255)  # White
    
    # Draw rounded rectangle background
    margin = size // 8
    corner_radius = size // 6
    
    # Draw background circle
    draw.ellipse([margin, margin, size-margin, size-margin], fill=bg_color)
    
    # Draw chart elements (representing portfolio growth)
    chart_margin = size // 4
    chart_width = size - 2 * chart_margin
    chart_height = chart_width // 2
    
    # Draw bars representing portfolio performance
    bar_width = chart_width // 5
    bar_spacing = bar_width // 2
    
    for i in range(4):
        x = chart_margin + i * (bar_width + bar_spacing)
        bar_height = chart_height * (0.3 + i * 0.2)  # Ascending bars
        y = chart_margin + chart_height - bar_height
        
        draw.rectangle([x, y, x + bar_width, chart_margin + chart_height], fill=accent_color)
    
    # Draw upward arrow (growth indicator)
    arrow_size = size // 6
    arrow_x = size - chart_margin - arrow_size
    arrow_y = chart_margin
    
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