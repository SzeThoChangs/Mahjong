"""Generate the Singapore mahjong tile set (148 tiles)."""
import json

tiles, uid = [], 0
def add(**kw):
    global uid
    for copy in range(kw.pop("copies")):
        tiles.append({"id": uid, "copy": copy, **kw}); uid += 1

# --- Suited tiles: 3 suits x 9 ranks x 4 copies = 108 -------------------
SUITS = [("wan","萬","Million"), ("tong","筒","Circle"), ("sok","索","Bamboo")]
for suit, glyph, label in SUITS:
    for rank in range(1, 10):
        add(kind="suit", suit=suit, rank=rank, copies=4,
            name=f"{rank} {label}", glyph=f"{rank}{glyph}",
            terminal=rank in (1, 9))

# --- Honours: 4 winds + 3 dragons, 4 copies each = 28 -------------------
WINDS   = [("east","東"), ("south","南"), ("west","西"), ("north","北")]
DRAGONS = [("red","中"), ("green","發"), ("white","白")]
for i, (wind, glyph) in enumerate(WINDS):
    add(kind="honour", honour="wind", wind=wind, seat_index=i, copies=4,
        name=f"{wind.title()} Wind", glyph=glyph)
for dragon, glyph in DRAGONS:
    add(kind="honour", honour="dragon", dragon=dragon, copies=4,
        name=f"{dragon.title()} Dragon", glyph=glyph)

# --- Bonus tiles: 4 flowers + 4 seasons + 4 animals = 12, 1 copy each ---
# Flowers and seasons are seat-linked: index 0..3 maps to E/S/W/N.
FLOWERS = [("plum","梅"), ("orchid","蘭"), ("chrysanthemum","菊"), ("bamboo","竹")]
SEASONS = [("spring","春"), ("summer","夏"), ("autumn","秋"), ("winter","冬")]
for i, (flower, glyph) in enumerate(FLOWERS):
    add(kind="bonus", bonus="flower", flower=flower, seat_index=i, copies=1,
        name=f"Flower: {flower.title()}", glyph=glyph)
for i, (season, glyph) in enumerate(SEASONS):
    add(kind="bonus", bonus="season", season=season, seat_index=i, copies=1,
        name=f"Season: {season.title()}", glyph=glyph)

# Animals are NOT seat-linked. They pay on draw and pair with each other.
ANIMALS = [("cat","猫","mouse"), ("mouse","老鼠","cat"),
           ("rooster","公鷄","centipede"), ("centipede","蜈蚣","rooster")]
for animal, glyph, partner in ANIMALS:
    add(kind="bonus", bonus="animal", animal=animal, partner=partner, copies=1,
        name=f"Animal: {animal.title()}", glyph=glyph)

counts = {}
for t in tiles:
    counts[t["kind"]] = counts.get(t["kind"], 0) + 1
assert len(tiles) == 148, len(tiles)

with open("data/tiles.json", "w", encoding="utf-8") as fh:
    json.dump({"variant": "singapore", "total": len(tiles),
               "counts": counts, "tiles": tiles}, fh,
              ensure_ascii=False, indent=2)
print(f"{len(tiles)} tiles ->", counts)
