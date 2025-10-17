#!/usr/bin/env python3
"""
Convert SVG icons to PNG for Portfolio Tracker Electron app using Inkscape
"""
import os
import subprocess

def convert_svg_to_png(svg_file, png_file, size):
    """Convert SVG to PNG using Inkscape"""
    try:
        subprocess.run([
            'inkscape',
            '--export-filename=' + png_file,
            '--export-width=' + str(size),
            '--export-height=' + str(size),
            svg_file
        ], check=True, capture_output=True)
        print(f"Created {png_file} ({size}x{size})")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error converting {svg_file}: {e}")
        print(f"Inkscape output: {e.output.decode()}")
        return False
    except FileNotFoundError:
        print("Error: Inkscape not found. Please install Inkscape to convert SVG files.")
        return False

def main():
    print("Creating Portfolio Tracker icons...")
    
    # Convert main icons first
    if not os.path.exists('icon.svg'):
        print("Error: icon.svg not found")
        return
        
    convert_svg_to_png('icon.svg', 'icon.png', 512)
    convert_svg_to_png('icon.svg', 'icon@2x.png', 1024)
    
    # Convert all size variants
    sizes = [16, 32, 48, 64, 128, 256, 512, 1024]
    success = True
    
    for size in sizes:
        svg_file = f'icon-{size}x{size}.svg'
        png_file = f'{size}x{size}.png'
        
        if os.path.exists(svg_file):
            if not convert_svg_to_png(svg_file, png_file, size):
                success = False
        else:
            print(f"Warning: {svg_file} not found")
            success = False
            
    if success:
        print("\n✅ All icons created successfully!")
    else:
        print("\n⚠️ Some icons could not be created")
        
    # List created files
    print("\nCreated icons:")
    for f in sorted(os.listdir('.')):
        if f.endswith('.png'):
            print(f"  📁 assets/{f}")

if __name__ == '__main__':
    main()