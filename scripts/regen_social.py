from PIL import Image, ImageDraw, ImageFont
import os

# Load the circular logo
logo_src = '/Users/paolaalvarez/NeusicLiveLoopV1.DSOqz9/favicon-512x512.png'
logo = Image.open(logo_src).convert('RGBA')
logo = logo.resize((320, 320), Image.LANCZOS)

# Create social card 1200x630
card = Image.new('RGBA', (1200, 630), (18, 18, 22, 255))  # Dark background
draw = ImageDraw.Draw(card)

# Draw subtle gradient overlay
for y in range(630):
    alpha = int(30 * (1 - y / 630))
    draw.line([(0, y), (1200, y)], fill=(40, 40, 50, alpha))

# Paste circular logo centered-left
logo_x = 180
logo_y = (630 - 320) // 2
card.paste(logo, (logo_x, logo_y), logo)

# Draw headline text
try:
    font = ImageFont.truetype('/System/Library/Fonts/SF-Pro-Display-Bold.otf', 72)
except:
    font = ImageFont.load_default()

text = 'Something New Is Arriving'
text_x = logo_x + 320 + 60
text_y = 630 // 2 - 36

# Text shadow
draw.text((text_x + 2, text_y + 2), text, font=font, fill=(0, 0, 0, 180))
# Main text
draw.text((text_x, text_y), text, font=font, fill=(255, 255, 255, 255))

# Subtitle
try:
    sub_font = ImageFont.truetype('/System/Library/Fonts/SF-Pro-Text-Regular.otf', 28)
except:
    sub_font = ImageFont.load_default()

sub_text = 'The next wave is almost here.'
draw.text((text_x + 2, text_y + 82), sub_text, font=sub_font, fill=(0, 0, 0, 150))
draw.text((text_x, text_y + 80), sub_text, font=sub_font, fill=(180, 180, 190, 255))

# Small badge
try:
    badge_font = ImageFont.truetype('/System/Library/Fonts/SF-Pro-Text-Medium.otf', 20)
except:
    badge_font = ImageFont.load_default()

badge_text = 'Join the private waitlist at neusicwave.com'
draw.text((text_x + 2, text_y + 132), badge_text, font=badge_font, fill=(0, 0, 0, 120))
draw.text((text_x, text_y + 130), badge_text, font=badge_font, fill=(100, 180, 255, 220))

card.save('/Users/paolaalvarez/NeusicLiveLoopV1.DSOqz9/social/neusicwave-link-preview-20260724.png', 'PNG')
print('Social card regenerated with circular logo at 1200x630')