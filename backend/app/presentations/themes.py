"""Six visual styles. Fonts are ones that ship with Office and cover Cyrillic incl. Kyrgyz ү ө ң."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Theme:
    key: str
    head: str        # heading font
    body: str        # body font
    bg: str          # content slide background
    surface: str     # card fill on content slides
    text: str
    muted: str
    primary: str     # dominant brand color
    accent: str      # sharp accent
    dark: str        # background of title / conclusion / thanks slides
    on_dark: str     # text on dark slides
    on_primary: str  # text on primary-filled shapes
    chart: tuple[str, ...]
    radius: float = 0.12   # rounded-card corner (0 = square)
    dark_content: bool = False


THEMES: dict[str, Theme] = {
    "minimal": Theme("minimal", "Arial", "Arial", "FFFFFF", "F4F4F5", "18181B", "6B6B73",
                     "3F3F46", "E4572E", "18181B", "FFFFFF", "FFFFFF",
                     ("3F3F46", "E4572E", "A1A1AA", "52525B", "F59E0B", "D4D4D8"), radius=0.04),
    "modern": Theme("modern", "Calibri", "Calibri", "FFFFFF", "F3F0FF", "1E1B2E", "6B6880",
                    "6D28D9", "06B6D4", "17132B", "FFFFFF", "FFFFFF",
                    ("6D28D9", "06B6D4", "A78BFA", "F472B6", "34D399", "FBBF24"), radius=0.16),
    "corporate": Theme("corporate", "Calibri", "Calibri", "FFFFFF", "EEF2FB", "1B2340", "5F6884",
                       "1E2761", "F2A900", "121A42", "FFFFFF", "FFFFFF",
                       ("1E2761", "F2A900", "5B6BB5", "9FB0E0", "2E8B8B", "C2C9DD"), radius=0.06),
    "education": Theme("education", "Arial", "Calibri", "FFFFFF", "FFF1F1", "2B2D42", "6A6C80",
                       "F25F5C", "247BA0", "2B2D42", "FFFFFF", "FFFFFF",
                       ("F25F5C", "247BA0", "FFC857", "70C1B3", "50514F", "B2DBBF"), radius=0.22),
    "academic": Theme("academic", "Cambria", "Calibri", "FFFFFF", "F4EEF1", "231A1F", "6E6268",
                      "6D2E46", "A26769", "2A1520", "FFFFFF", "FFFFFF",
                      ("6D2E46", "A26769", "D5B9B2", "4A5759", "B08968", "8E9AAF"), radius=0.03),
    "creative": Theme("creative", "Arial", "Calibri", "0B1F2A", "12303F", "F1F5F9", "9FB3C1",
                      "02C39A", "FFB703", "061219", "F1F5F9", "062A23",
                      ("02C39A", "FFB703", "00A8E8", "FB5607", "8338EC", "E9EDF0"), radius=0.18, dark_content=True),
}
