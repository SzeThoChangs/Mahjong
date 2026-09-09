"""
Cut the two tile charts into the 47 faces the app names, at the 240x330 it already uses.

Fixed boxes rather than edge detection. The first attempt tightened onto white pixels inside a rough
box, which works for a solid card like a circle tile and fails badly for sparse art: a bamboo tile is
mostly white, so the tightening found a gap between two stalks and cropped to that. The chart is a
regular grid, so the columns measured off the solid rows are the right boxes for every row.
"""
import sys
from PIL import Image

OUT_W, OUT_H = 240, 330
INSET = 7          # step inside the card's rounded edge and its hairline border

def cut(im, box):
    """Crop, scale on height, then trim the surplus width evenly. Cards are slightly wider than the
       app's 240x330, so a few pixels of blank margin go rather than the picture being squashed."""
    x0, y0, x1, y1 = box
    t = im.crop((x0 + INSET, y0 + INSET, x1 - INSET, y1 - INSET))
    t = t.resize((max(1, round(t.width * OUT_H / t.height)), OUT_H), Image.LANCZOS)
    if t.width > OUT_W:
        off = (t.width - OUT_W) // 2
        t = t.crop((off, 0, off + OUT_W, OUT_H))
    elif t.width < OUT_W:
        pad = Image.new('RGB', (OUT_W, OUT_H), t.getpixel((1, 1)))
        pad.paste(t, ((OUT_W - t.width) // 2, 0))
        t = pad
    return t

COLS = [(733, 1043), (1146, 1456), (1559, 1869), (1972, 2282), (2385, 2695),
        (2798, 3108), (3211, 3521), (3624, 3934), (4037, 4347)]
ROWS = {'t': (533, 937), 's': (1040, 1444), 'w': (1547, 1951),
        'honour': (2246, 2650), 'bonus': (2946, 3350)}
HONOURS = {0: 'N', 1: 'E', 2: 'W', 3: 'S', 5: 'Wh', 6: 'R', 7: 'G'}
BONUS = {0: 'S1', 1: 'S2', 2: 'S3', 3: 'S4', 5: 'F1', 6: 'F2', 7: 'F3', 8: 'F4'}

# The animals chart carries compression blobs around its cards, so these are measured off the image
# rather than found: four animals on one line, the joker alone below.
# The four animal cards sit on one row, y 162-496, found where the blue ground gives way at a
# vertical scan. Their centres are the four column centres of a 1774-wide chart, nudged 5px left to
# match the one card whose edges could be read cleanly. The joker is centred below them.
CHART_B = [((89, 162, 345, 496), 'A_mouse'), ((532, 162, 788, 496), 'A_cat'),
           ((976, 162, 1232, 496), 'A_rooster'), ((1420, 162, 1676, 496), 'A_centipede'),
           ((795, 596, 978, 862), 'J')]
# The joker card runs off the bottom of its chart, so its box takes the card's own width and the
# height that width implies, centred on what is visible, rather than the clipped 301px on the page.

def build(chart_a, chart_b):
    out = {}
    im = Image.open(chart_a).convert('RGB')
    for suit, (y0, y1) in ROWS.items():
        for ci, (x0, x1) in enumerate(COLS):
            name = (f'{ci + 1}{suit}' if suit in 'tsw'
                    else HONOURS.get(ci) if suit == 'honour' else BONUS.get(ci))
            if name:
                out[name] = cut(im, (x0, y0, x1, y1))
    im2 = Image.open(chart_b).convert('RGB')
    for box, name in CHART_B:
        out[name] = cut(im2, box)
    return out

if __name__ == '__main__':
    faces = build(sys.argv[1], sys.argv[2])
    for n, img in faces.items():
        img.save(f'{sys.argv[3]}/{n}.png')
    print(f'{len(faces)} faces')
