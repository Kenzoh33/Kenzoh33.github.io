"""Shared palette for every pixel-art icon.

Each key is one character used in the icon grids. "." is transparent.
K and G match the site's --ink and --accent tokens in css/styles.css.
"""

PALETTE = {
    ".": None,        # transparent
    "K": "#1C1B19",   # outline (--ink)
    "D": "#3A3631",   # charcoal (terminal body)
    "M": "#8A847C",   # mid gray
    "L": "#D9D3C7",   # light gray
    "W": "#FFFFFF",   # white / paper
    "G": "#2F4B3C",   # forest green (--accent)
    "g": "#6B9A7C",   # light green
    "Y": "#E9B949",   # warm yellow
    "y": "#B98A2A",   # yellow shade
    "R": "#D0573B",   # red
    "r": "#9C3B26",   # red shade
    "N": "#2E3F66",   # navy
    "n": "#4B5F8F",   # navy highlight
    "S": "#F1C6A0",   # skin
    "s": "#D9A47E",   # skin shade
    "P": "#E99A9A",   # blush pink
    "H": "#4A3326",   # hair brown
    "B": "#2A2420",   # hair black
    "b": "#574C45",   # hair highlight
}
