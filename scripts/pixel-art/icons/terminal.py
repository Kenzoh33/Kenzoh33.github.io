"""advProm: terminal window. The cursor blinks, then a prompt line types out."""

LABEL = "advProm"
FPS = 3

FRAMES = [
    # 0: cursor on
    """
    ................
    ................
    KKKKKKKKKKKKKKKK
    KLRLYLgLLLLLLLLK
    KKKKKKKKKKKKKKKK
    KDDDDDDDDDDDDDDK
    KDDDDDDDDDDDDDDK
    KDgDDDDDDDDDDDDK
    KDDgDDDDDDDDDDDK
    KDgDDWWDDDDDDDDK
    KDDDDDDDDDDDDDDK
    KDDDDDDDDDDDDDDK
    KDDDDDDDDDDDDDDK
    KKKKKKKKKKKKKKKK
    ................
    ................
    """,
    # 1: cursor off
    """
    ................
    ................
    KKKKKKKKKKKKKKKK
    KLRLYLgLLLLLLLLK
    KKKKKKKKKKKKKKKK
    KDDDDDDDDDDDDDDK
    KDDDDDDDDDDDDDDK
    KDgDDDDDDDDDDDDK
    KDDgDDDDDDDDDDDK
    KDgDDDDDDDDDDDDK
    KDDDDDDDDDDDDDDK
    KDDDDDDDDDDDDDDK
    KDDDDDDDDDDDDDDK
    KKKKKKKKKKKKKKKK
    ................
    ................
    """,
    # 2: first word typed
    """
    ................
    ................
    KKKKKKKKKKKKKKKK
    KLRLYLgLLLLLLLLK
    KKKKKKKKKKKKKKKK
    KDDDDDDDDDDDDDDK
    KDDDDDDDDDDDDDDK
    KDgDDDDDDDDDDDDK
    KDDgDLLLDDDDDDDK
    KDgDDDDDDWWDDDDK
    KDDDDDDDDDDDDDDK
    KDDDDDDDDDDDDDDK
    KDDDDDDDDDDDDDDK
    KKKKKKKKKKKKKKKK
    ................
    ................
    """,
    # 3: second word typed
    """
    ................
    ................
    KKKKKKKKKKKKKKKK
    KLRLYLgLLLLLLLLK
    KKKKKKKKKKKKKKKK
    KDDDDDDDDDDDDDDK
    KDDDDDDDDDDDDDDK
    KDgDDDDDDDDDDDDK
    KDDgDLLLDLLDDDDK
    KDgDDDDDDDDDWWDK
    KDDDDDDDDDDDDDDK
    KDDDDDDDDDDDDDDK
    KDDDDDDDDDDDDDDK
    KKKKKKKKKKKKKKKK
    ................
    ................
    """,
]
