"""Home hero: the avatar raises a hand, waves, drops it, then blinks."""

from _avatar_base import BASE, stamp

LABEL = "Home"
SIZE = 32
FPS = 4

# Patches are stamped onto BASE at (top, left); "." keeps the base pixel.
ARM_UP = """
    ...K.K..
    ..KSKSK.
    ..KSsSSK
    ..KSsSSK
    ..SSSSSK
    ..SSSSSK
    ...SSSSK
    ...KSSK.
    ...KSsK.
    ...KSsK.
    ...KSsK.
    ...KSSK.
    ...GGGK.
    ..KGGGK.
    ..KGGGK.
    ..KGgGK.
    ..KGgGK.
    KKKGGGK.
    GGGGGGK.
    GGGGKK..
    .GGGK...
    ..KK....
    """
ARM_TILT = """
    ....K.K.
    ...KSKSK
    ...KSsSS
    ...KSsSS
    ...SSSSS
    ...SSSSK
    ...KSSSK
    ...KSSK.
    ...KSsK.
    ...KSsK.
    ...KSsK.
    ...KSSK.
    ...GGGK.
    ..KGGGK.
    ..KGGGK.
    ..KGgGK.
    ..KGgGK.
    KKKGGGK.
    GGGGGGK.
    GGGGKK..
    .GGGK...
    ..KK....
    """
BLINK = """
    .SS......SS.
    K..K....K..K
    """

FRAMES = [
    BASE,
    stamp(BASE, ARM_UP, 7, 24),
    stamp(BASE, ARM_TILT, 7, 24),
    stamp(BASE, BLINK, 14, 8),
]
