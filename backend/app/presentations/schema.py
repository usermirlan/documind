"""Slide content contract between the LLM, the API, the preview and the PPTX builder.
Length limits keep text inside its boxes on the slide."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

SlideType = Literal["title", "agenda", "bullets", "comparison", "stats", "timeline",
                    "chart", "process", "quote", "conclusion", "thanks"]
SLIDE_TYPES: tuple[str, ...] = SlideType.__args__  # type: ignore[attr-defined]

STYLES = ("minimal", "modern", "corporate", "education", "academic", "creative")
LAYOUTS = ("auto", "image-left", "image-right", "image-top", "none")
# icon names the preview can draw (lucide); anything else is dropped
ICONS = ("rocket", "target", "lightbulb", "users", "globe", "chart", "shield", "leaf", "heart", "book",
         "graduation", "briefcase", "cpu", "zap", "clock", "calendar", "map-pin", "mountain", "sun", "dollar",
         "trending-up", "award", "check", "star", "settings", "layers", "message", "handshake", "building",
         "flag", "compass", "database", "lock", "smile", "sparkles", "puzzle", "coins", "plane", "camera", "music")
# slide types that may carry a picture
IMAGE_TYPES = ("title", "bullets", "quote", "conclusion", "agenda", "stats", "process", "thanks")
LANGS = ("ky", "ru", "en")


def _clip(v: str, n: int) -> str:
    v = " ".join(str(v).split())
    return v if len(v) <= n else v[: n - 1].rsplit(" ", 1)[0] + "…"


class OutlineSlide(BaseModel):
    type: SlideType
    title: str = Field(min_length=1, max_length=120)
    brief: str = Field(default="", max_length=400)


class Outline(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    subtitle: str = Field(default="", max_length=200)
    slides: list[OutlineSlide] = Field(min_length=3, max_length=20)


class Stat(BaseModel):
    value: str
    label: str

    @field_validator("value")
    @classmethod
    def v(cls, x):
        return _clip(x, 12)

    @field_validator("label")
    @classmethod
    def lbl(cls, x):
        return _clip(x, 70)


class Event(BaseModel):
    when: str
    text: str

    @field_validator("when")
    @classmethod
    def w(cls, x):
        return _clip(x, 20)

    @field_validator("text")
    @classmethod
    def tx(cls, x):
        return _clip(x, 90)


class Step(BaseModel):
    title: str
    text: str = ""

    @field_validator("title")
    @classmethod
    def ti(cls, x):
        return _clip(x, 40)

    @field_validator("text")
    @classmethod
    def tx(cls, x):
        return _clip(x, 110)


class Column(BaseModel):
    heading: str
    points: list[str] = Field(default_factory=list)

    @field_validator("heading")
    @classmethod
    def h(cls, x):
        return _clip(x, 40)

    @field_validator("points")
    @classmethod
    def p(cls, xs):
        return [_clip(x, 110) for x in xs[:4]]


class Chart(BaseModel):
    kind: Literal["bar", "column", "pie", "line"] = "column"
    labels: list[str]
    values: list[float]
    unit: str = ""

    @field_validator("labels")
    @classmethod
    def lb(cls, xs):
        return [_clip(x, 24) for x in xs[:8]]


class Slide(BaseModel):
    type: SlideType
    title: str = ""
    subtitle: str = ""
    bullets: list[str] = Field(default_factory=list)
    takeaway: str = ""
    left: Column | None = None
    right: Column | None = None
    stats: list[Stat] = Field(default_factory=list)
    events: list[Event] = Field(default_factory=list)
    steps: list[Step] = Field(default_factory=list)
    chart: Chart | None = None
    quote: str = ""
    author: str = ""
    notes: str = ""
    # visual layer (Gamma-style cards)
    layout: Literal[LAYOUTS] = "auto"  # type: ignore[valid-type]
    image_prompt: str = ""
    image_id: str = ""
    icons: list[str] = Field(default_factory=list)

    @field_validator("image_prompt")
    @classmethod
    def ip(cls, x):
        return _clip(x, 300)

    @field_validator("icons")
    @classmethod
    def ic(cls, xs):
        return [x if x in ICONS else "" for x in (str(i).lower().strip() for i in xs[:6])]

    @field_validator("layout", mode="before")
    @classmethod
    def lay(cls, x):
        return x if x in LAYOUTS else "auto"

    @field_validator("title")
    @classmethod
    def ti(cls, x):
        return _clip(x, 80).rstrip(".")

    @field_validator("subtitle", "takeaway")
    @classmethod
    def sub(cls, x):
        return _clip(x, 160)

    @field_validator("bullets")
    @classmethod
    def bl(cls, xs):
        return [_clip(x, 120) for x in xs[:6]]

    @field_validator("quote")
    @classmethod
    def q(cls, x):
        return _clip(x, 220)

    @field_validator("notes")
    @classmethod
    def n(cls, x):
        return _clip(x, 1200)

    def usable(self) -> "Slide":
        """Downgrade a slide whose structured payload is missing to plain bullets."""
        ok = {
            "comparison": self.left and self.right and (self.left.points or self.right.points),
            "stats": len(self.stats) >= 2,
            "timeline": len(self.events) >= 2,
            "process": len(self.steps) >= 2,
            "chart": self.chart and len(self.chart.labels) >= 2 and len(self.chart.labels) == len(self.chart.values),
            "quote": bool(self.quote),
        }.get(self.type, True)
        if self.type not in IMAGE_TYPES:
            self.image_prompt, self.image_id = "", ""
        if ok:
            self.stats, self.events, self.steps = self.stats[:4], self.events[:6], self.steps[:5]
            return self
        return self.model_copy(update={"type": "bullets", "bullets": self.bullets or [self.subtitle or self.title]})


def image_side(slide: "Slide") -> str | None:
    """Where the picture goes for this slide, or None when it has no picture."""
    if not slide.image_id or slide.layout == "none":
        return None
    if slide.layout != "auto":
        return slide.layout.removeprefix("image-")
    return {"title": "right", "quote": "left", "thanks": "top", "stats": "top", "process": "top"}.get(slide.type, "right")


class Deck(BaseModel):
    slides: list[Slide] = Field(min_length=1, max_length=20)
