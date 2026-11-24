"""Build an editable .pptx from validated slide data with python-pptx.

Every element is a native shape, text box or chart, so the deck stays editable in
PowerPoint and LibreOffice Impress. No images are needed (no paid image APIs)."""

from __future__ import annotations

import io

from lxml import etree
from pptx import Presentation as PptxPresentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION, XL_LEGEND_POSITION
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

from .schema import Slide, image_side
from .themes import THEMES, Theme

W, H = 13.333, 7.5
M = 0.65  # outer margin (inches)


def rgb(h: str) -> RGBColor:
    return RGBColor.from_string(h)


def luminance(h: str) -> float:
    def ch(c: int) -> float:
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def on(fill: str) -> str:
    """Readable text color on a filled shape (WCAG contrast against white vs near-black)."""
    lw = (1.05) / (luminance(fill) + 0.05)
    lb = (luminance(fill) + 0.05) / (luminance("141414") + 0.05)
    return "FFFFFF" if lw >= lb else "141414"


class Builder:
    def __init__(self, theme: Theme, deck_title: str, total: int):
        self.t = theme
        self.deck_title = deck_title
        self.total = total
        self.prs = PptxPresentation()
        self.prs.slide_width, self.prs.slide_height = Inches(W), Inches(H)
        self.blank = self.prs.slide_layouts[6]
        self.X0, self.CW = M, W - 2 * M   # content frame; narrowed when a slide has a side picture
        self.images: dict[str, bytes] = {}

    # ---------------------------------------------------------------- primitives
    def slide(self, dark: bool = False):
        s = self.prs.slides.add_slide(self.blank)
        fill = s.background.fill
        fill.solid()
        fill.fore_color.rgb = rgb(self.t.dark if dark else self.t.bg)
        return s

    def box(self, s, x, y, w, h, color, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=None, name=None):
        sh = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
        sh.fill.solid()
        sh.fill.fore_color.rgb = rgb(color)
        sh.line.fill.background()
        sh.shadow.inherit = False
        if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
            sh.adjustments[0] = self.t.radius if radius is None else radius
        if name:
            sh.name = name
        return sh

    def text(self, s, x, y, w, h, runs, size=18, color=None, font=None, bold=False, italic=False,
             align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, shape=None, spacing=1.1, autofit=False, name=None):
        """`runs` is a string, or a list of paragraphs (each a string)."""
        if shape is None:
            shape = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        if name:
            shape.name = name
        tf = shape.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = anchor
        for side in ("left", "right", "top", "bottom"):
            setattr(tf, f"margin_{side}", Emu(0) if shape.shape_type == 17 else Inches(0.12))
        paras = runs if isinstance(runs, list) else [runs]
        for i, ptext in enumerate(paras):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = align
            p.line_spacing = spacing
            r = p.add_run()
            r.text = str(ptext)
            f = r.font
            f.size, f.bold, f.italic = Pt(size), bold, italic
            f.name = font or self.t.body
            f.color.rgb = rgb(color or self.t.text)
        if autofit:  # PowerPoint shrinks text that would overflow (safety net; sizes are pre-chosen)
            body = tf._txBody.find(qn("a:bodyPr"))
            for child in list(body):
                if child.tag in (qn("a:spAutoFit"), qn("a:noAutofit"), qn("a:normAutofit")):
                    body.remove(child)
            etree.SubElement(body, qn("a:normAutofit"))
        return shape

    def bullets(self, s, x, y, w, h, items, size=18, color=None, gap=10):
        tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        tf = tb.text_frame
        tf.word_wrap = True
        for i, item in enumerate(items):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.space_after = Pt(gap)
            p.line_spacing = 1.1
            pPr = p._p.get_or_add_pPr()
            pPr.set("marL", str(Inches(0.3)))
            pPr.set("indent", str(-Inches(0.3)))
            bu_clr = etree.SubElement(pPr, qn("a:buClr"))
            etree.SubElement(bu_clr, qn("a:srgbClr")).set("val", self.t.primary if not self.t.dark_content else self.t.accent)
            etree.SubElement(pPr, qn("a:buFont")).set("typeface", "Arial")
            etree.SubElement(pPr, qn("a:buChar")).set("char", "•")
            r = p.add_run()
            r.text = item
            r.font.size, r.font.name = Pt(size), self.t.body
            r.font.color.rgb = rgb(color or self.t.text)
        return tb

    def badge(self, s, x, y, d, label, fill=None, color=None, size=16):
        fill = fill or self.t.primary
        c = self.box(s, x, y, d, d, fill, shape=MSO_SHAPE.OVAL)
        self.text(s, 0, 0, 0, 0, str(label), size=size, bold=True, color=on(fill),
                  align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, shape=c, autofit=False)
        tf = c.text_frame
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Emu(0)
        tf.word_wrap = False
        return c

    def title(self, s, text, dark=False):
        size = 34 if len(text) <= 40 else 28 if len(text) <= 58 else 24
        self.text(s, self.X0, 0.45, self.CW, 0.95, text, size=size, bold=True, font=self.t.head,
                  color=self.t.on_dark if dark else self.t.text, anchor=MSO_ANCHOR.MIDDLE, name="Title")

    def footer(self, s, n, dark=False):
        col = self.t.on_dark if dark else self.t.muted
        self.text(s, self.X0, H - 0.55, min(7, self.CW - 1.8), 0.35, self.deck_title, size=11, color=col, autofit=False, name="Footer")
        self.text(s, self.X0 + self.CW - 1.6, H - 0.55, 1.6, 0.35, f"{n} / {self.total}", size=11, color=col,
                  align=PP_ALIGN.RIGHT, autofit=False, name="Slide number")

    def picture(self, s, data: bytes, x, y, w, h, name="Picture"):
        """Insert an image cropped to fill the box (like CSS object-fit: cover)."""
        from PIL import Image

        iw, ih = Image.open(io.BytesIO(data)).size
        pic = s.shapes.add_picture(io.BytesIO(data), Inches(x), Inches(y), Inches(w), Inches(h))
        box_r, img_r = w / h, iw / ih
        if img_r > box_r:      # too wide: crop the sides
            cut = (1 - box_r / img_r) / 2
            pic.crop_left = pic.crop_right = cut
        else:                  # too tall: crop top and bottom
            cut = (1 - img_r / box_r) / 2
            pic.crop_top = pic.crop_bottom = cut
        pic.name = name
        return pic

    def overlay(self, s, color: str, alpha: int):
        """Full-slide translucent color (alpha 0-100) so text stays readable on a photo."""
        sh = self.box(s, 0, 0, W, H, color, shape=MSO_SHAPE.RECTANGLE, name="Overlay")
        clr = sh.fill._xPr.find(qn("a:solidFill")).find(qn("a:srgbClr"))
        etree.SubElement(clr, qn("a:alpha")).set("val", str(alpha * 1000))
        return sh

    def notes(self, s, text):
        if text:
            s.notes_slide.notes_text_frame.text = text

    @property
    def card(self):
        return self.t.surface

    @property
    def ink(self):
        return self.t.text

    # ---------------------------------------------------------------- slide types
    def s_title(self, d: Slide, n):
        s = self.slide(dark=True)
        img = self.images.get(d.image_id) if image_side(d) else None
        if img:
            self.picture(s, img, W * 0.5, 0, W * 0.5, H, name="Title picture")
        else:
            # motif: two overlapping circles bleeding off the right edge
            self.box(s, W - 4.6, -1.2, 6.2, 6.2, self.t.primary, shape=MSO_SHAPE.OVAL, name="Motif")
            self.box(s, W - 3.0, 3.6, 3.6, 3.6, self.t.accent, shape=MSO_SHAPE.OVAL, name="Motif accent")
        tw = W * 0.5 - M - 0.4 if img else 8.4
        self.text(s, M, 2.0, tw, 2.4, d.title, size=46 if len(d.title) < 45 else 38, bold=True,
                  font=self.t.head, color=self.t.on_dark, anchor=MSO_ANCHOR.BOTTOM, spacing=1.0)
        if d.subtitle:
            self.text(s, M, 4.55, tw, 1.3, d.subtitle, size=20, color=self.t.on_dark)
        return s

    def s_agenda(self, d: Slide, n):
        s = self.slide(self.t.dark_content)
        self.title(s, d.title, self.t.dark_content)
        items = d.bullets[:6]
        cols = 2 if len(items) > 3 else 1
        rows = (len(items) + cols - 1) // cols
        cw = (self.CW - (cols - 1) * 0.5) / cols
        rh = min(1.15, (H - 2.0 - 1.0) / max(rows, 1))
        for i, item in enumerate(items):
            cx = self.X0 + (i // rows) * (cw + 0.5)
            cy = 1.75 + (i % rows) * (rh + 0.2)
            self.box(s, cx, cy, cw, rh, self.card)
            self.badge(s, cx + 0.25, cy + (rh - 0.6) / 2, 0.6, f"{i + 1:02d}", size=15)
            self.text(s, cx + 1.05, cy, cw - 1.25, rh, item, size=19, anchor=MSO_ANCHOR.MIDDLE)
        return s

    def s_bullets(self, d: Slide, n):
        s = self.slide(self.t.dark_content)
        self.title(s, d.title, self.t.dark_content)
        items = d.bullets[:5]
        total = sum(len(b) for b in items)
        size = 20 if total < 260 else 18 if total < 400 else 16
        if d.takeaway and self.CW < 9:
            self.bullets(s, self.X0, 1.75, self.CW, 3.3, items, size=min(size, 18))
            card = self.box(s, self.X0, 5.2, self.CW, 1.15, self.t.primary)
            self.text(s, 0, 0, 0, 0, d.takeaway, size=17, italic=True, bold=True, font=self.t.head,
                      color=on(self.t.primary), anchor=MSO_ANCHOR.MIDDLE, shape=card)
            card.text_frame.margin_left = card.text_frame.margin_right = Inches(0.35)
        elif d.takeaway:
            lw = self.CW * 0.58
            self.bullets(s, self.X0, 1.75, lw, 4.7, items, size=size)
            card = self.box(s, self.X0 + lw + 0.4, 1.85, self.CW - lw - 0.4, 4.4, self.t.primary)
            self.text(s, 0, 0, 0, 0, d.takeaway, size=24 if len(d.takeaway) < 90 else 20, italic=True,
                      bold=True, font=self.t.head, color=on(self.t.primary), anchor=MSO_ANCHOR.MIDDLE, shape=card)
            card.text_frame.margin_left = card.text_frame.margin_right = Inches(0.45)
        else:
            # icon rows: numbered circles + text, on cards
            rh = min(0.95, (H - 1.85 - 0.9) / max(len(items), 1) - 0.15)
            for i, item in enumerate(items):
                cy = 1.75 + i * (rh + 0.15)
                self.box(s, self.X0, cy, self.CW, rh, self.card)
                self.badge(s, self.X0 + 0.22, cy + (rh - 0.5) / 2, 0.5, i + 1, size=14,
                           fill=self.t.accent if i == 0 else self.t.primary)
                self.text(s, self.X0 + 0.95, cy, self.CW - 1.2, rh, item, size=size - 1, anchor=MSO_ANCHOR.MIDDLE)
        return s

    def s_comparison(self, d: Slide, n):
        s = self.slide(self.t.dark_content)
        self.title(s, d.title, self.t.dark_content)
        cw = (self.CW - 0.5) / 2
        rows = max(len(d.left.points), len(d.right.points), 1)
        ch = min(4.75, 1.55 + rows * 0.78)
        top = 1.75 + (4.75 - ch) / 2
        for i, col in enumerate([d.left, d.right]):
            cx = self.X0 + i * (cw + 0.5)
            self.box(s, cx, top, cw, ch, self.card)
            head_fill = self.t.primary if i == 0 else self.t.accent
            pill = self.box(s, cx + 0.35, top + 0.3, cw - 0.7, 0.7, head_fill, radius=0.5)
            self.text(s, 0, 0, 0, 0, col.heading, size=20, bold=True, font=self.t.head,
                      color=on(head_fill), align=PP_ALIGN.CENTER,
                      anchor=MSO_ANCHOR.MIDDLE, shape=pill)
            self.bullets(s, cx + 0.4, top + 1.3, cw - 0.8, ch - 1.45, col.points, size=19)
        return s

    def s_stats(self, d: Slide, n):
        s = self.slide(self.t.dark_content)
        self.title(s, d.title, self.t.dark_content)
        k = len(d.stats)
        cw = (self.CW - (k - 1) * 0.4) / k
        for i, st in enumerate(d.stats):
            cx = self.X0 + i * (cw + 0.4)
            self.box(s, cx, 2.0, cw, 3.4, self.card)
            fit = cw / max(len(st.value), 1) * 110   # ~points that keep the value on one line
            vsize = int(min(60, max(28, fit)))
            self.text(s, cx + 0.2, 2.25, cw - 0.4, 1.6, st.value, size=vsize, bold=True, font=self.t.head,
                      color=self.t.accent if i % 2 else self.t.primary, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.BOTTOM)
            self.text(s, cx + 0.3, 3.95, cw - 0.6, 1.3, st.label, size=16, color=self.t.muted, align=PP_ALIGN.CENTER)
        if d.subtitle:
            self.text(s, self.X0, 5.75, self.CW, 0.7, d.subtitle, size=16, italic=True, color=self.t.muted)
        return s

    def s_timeline(self, d: Slide, n):
        s = self.slide(self.t.dark_content)
        self.title(s, d.title, self.t.dark_content)
        k = len(d.events)
        step = (self.CW) / k
        ly = 3.55
        line = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(self.X0), Inches(ly), Inches((self.X0 + self.CW)), Inches(ly))
        line.line.color.rgb = rgb(self.t.muted)
        line.line.width = Pt(1.5)
        line.name = "Timeline axis"
        for i, ev in enumerate(d.events):
            cx = self.X0 + i * step + step / 2
            self.box(s, cx - 0.17, ly - 0.17, 0.34, 0.34, self.t.accent if i == k - 1 else self.t.primary, shape=MSO_SHAPE.OVAL)
            self.text(s, cx - step / 2 + 0.05, 2.3, step - 0.1, 0.9, ev.when, size=22 if k <= 4 else 18, bold=True,
                      font=self.t.head, color=self.t.primary if not self.t.dark_content else self.t.accent,
                      align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.BOTTOM)
            self.text(s, cx - step / 2 + 0.1, 4.0, step - 0.2, 2.2, ev.text, size=15 if k <= 4 else 14,
                      align=PP_ALIGN.CENTER)
        return s

    def s_chart(self, d: Slide, n):
        s = self.slide(self.t.dark_content)
        self.title(s, d.title, self.t.dark_content)
        ch = d.chart
        data = CategoryChartData()
        data.categories = ch.labels
        data.add_series(ch.unit or "value", ch.values)
        kind = {"bar": XL_CHART_TYPE.BAR_CLUSTERED, "column": XL_CHART_TYPE.COLUMN_CLUSTERED,
                "pie": XL_CHART_TYPE.DOUGHNUT, "line": XL_CHART_TYPE.LINE_MARKERS}[ch.kind]
        cw = self.CW * 0.6 if d.takeaway else self.CW
        gf = s.shapes.add_chart(kind, Inches(self.X0), Inches(1.65), Inches(cw), Inches(4.9), data)
        gf.name = "Chart"
        chart = gf.chart
        chart.has_title = False
        chart.font.size, chart.font.name = Pt(13), self.t.body
        chart.font.color.rgb = rgb(self.t.muted)
        plot = chart.plots[0]
        plot.has_data_labels = True
        dl = plot.data_labels
        dl.font.size, dl.font.bold = Pt(13), True
        dl.font.color.rgb = rgb(self.t.text)
        dl.number_format = '0.##' + (f'"{ch.unit}"' if ch.unit and len(ch.unit) <= 3 else "")
        dl.number_format_is_linked = False
        if ch.kind == "pie":
            chart.has_legend = True
            chart.legend.position = XL_LEGEND_POSITION.RIGHT
            chart.legend.include_in_layout = False
            chart.legend.font.size = Pt(13)
            chart.legend.font.color.rgb = rgb(self.t.text)
            for i, pt in enumerate(plot.series[0].points):
                pt.format.fill.solid()
                pt.format.fill.fore_color.rgb = rgb(self.t.chart[i % len(self.t.chart)])
            dl.font.color.rgb = rgb("FFFFFF")
        else:
            chart.has_legend = False
            ser = plot.series[0]
            if ch.kind == "line":
                ser.format.line.color.rgb = rgb(self.t.primary)
                ser.format.line.width = Pt(3)
                ser.smooth = False
                dl.position = XL_LABEL_POSITION.ABOVE
            else:
                plot.gap_width = 70
                ser.format.fill.solid()
                ser.format.fill.fore_color.rgb = rgb(self.t.primary)
                # highlight the largest value with the accent color
                top = max(range(len(ch.values)), key=lambda i: ch.values[i])
                pt = ser.points[top]
                pt.format.fill.solid()
                pt.format.fill.fore_color.rgb = rgb(self.t.accent)
                dl.position = XL_LABEL_POSITION.OUTSIDE_END
            va = chart.value_axis
            va.has_major_gridlines = True
            va.major_gridlines.format.line.color.rgb = rgb(self.t.surface)
            va.format.line.fill.background()
            va.tick_labels.font.size = Pt(12)
            va.tick_labels.font.color.rgb = rgb(self.t.muted)
            ca = chart.category_axis
            ca.tick_labels.font.size = Pt(13)
            ca.tick_labels.font.color.rgb = rgb(self.t.text)
            ca.format.line.color.rgb = rgb(self.t.muted)
        if d.takeaway:
            card = self.box(s, self.X0 + cw + 0.4, 1.95, self.CW - cw - 0.4, 4.3, self.card)
            self.text(s, 0, 0, 0, 0, d.takeaway, size=21 if len(d.takeaway) < 100 else 18, bold=True,
                      font=self.t.head, color=self.ink, anchor=MSO_ANCHOR.MIDDLE, shape=card)
            card.text_frame.margin_left = card.text_frame.margin_right = Inches(0.35)
        return s

    def s_process(self, d: Slide, n):
        s = self.slide(self.t.dark_content)
        self.title(s, d.title, self.t.dark_content)
        k = len(d.steps)
        gap = 0.45
        cw = (self.CW - (k - 1) * gap) / k
        for i, st in enumerate(d.steps):
            cx = self.X0 + i * (cw + gap)
            self.box(s, cx, 1.95, cw, 4.3, self.card)
            self.badge(s, cx + 0.3, 2.25, 0.75, i + 1, size=20, fill=self.t.accent if i == k - 1 else self.t.primary)
            narrow = cw < 2.3
            self.text(s, cx + 0.2, 3.2, cw - 0.4, 0.95, st.title, size=15 if narrow else 19 if k <= 4 else 17, bold=True,
                      font=self.t.head, anchor=MSO_ANCHOR.BOTTOM)
            self.text(s, cx + 0.2, 4.2, cw - 0.4, 1.9, st.text, size=13 if narrow else 15 if k <= 4 else 14, color=self.t.muted)
            if i < k - 1:
                arrow = self.box(s, cx + cw + 0.08, 3.95, gap - 0.16, 0.3, self.t.muted, shape=MSO_SHAPE.RIGHT_ARROW)
                arrow.name = f"Arrow {i + 1}"
        return s

    def s_quote(self, d: Slide, n):
        s = self.slide(self.t.dark_content)
        self.box(s, self.X0, 1.0, self.CW, H - 2.1, self.card)
        self.text(s, self.X0 + 0.5, 1.05, 2, 1.6, "“", size=120, bold=True, font=self.t.head, color=self.t.accent, autofit=False)
        self.text(s, self.X0 + 1.3, 2.0, self.CW - 2.3, 2.9, d.quote, size=30 if len(d.quote) < 120 else 24,
                  italic=True, font=self.t.head, anchor=MSO_ANCHOR.MIDDLE)
        if d.author:
            self.text(s, self.X0 + 1.3, 5.1, self.CW - 2.3, 0.6, f"— {d.author}", size=18, bold=True, color=self.t.muted)
        return s

    def s_conclusion(self, d: Slide, n):
        s = self.slide(dark=True)
        self.title(s, d.title, dark=True)
        items = d.bullets[:4]
        for i, item in enumerate(items):
            cy = 1.85 + i * 0.95
            self.badge(s, self.X0, cy + 0.1, 0.55, "✓", fill=self.t.accent, size=16)
            self.text(s, self.X0 + 0.85, cy, self.CW - 0.9, 0.8, item, size=20, color=self.t.on_dark, anchor=MSO_ANCHOR.MIDDLE)
        if d.takeaway:
            pill = self.box(s, self.X0, 5.85, min(self.CW, 0.6 + len(d.takeaway) * 0.13), 0.75, self.t.primary, radius=0.5)
            self.text(s, 0, 0, 0, 0, d.takeaway, size=18, bold=True, color=on(self.t.primary),
                      anchor=MSO_ANCHOR.MIDDLE, shape=pill)
            pill.text_frame.margin_left = Inches(0.3)
        return s

    def s_thanks(self, d: Slide, n):
        s = self.slide(dark=True)
        img = self.images.get(d.image_id) if image_side(d) else None
        if img:
            self.picture(s, img, 0, 0, W, H, name="Background picture")
            self.overlay(s, self.t.dark, 62)
        else:
            self.box(s, -1.6, H - 3.2, 4.6, 4.6, self.t.primary, shape=MSO_SHAPE.OVAL, name="Motif")
            self.box(s, W - 2.4, -1.0, 3.2, 3.2, self.t.accent, shape=MSO_SHAPE.OVAL, name="Motif accent")
        self.text(s, 1.5, 2.3, W - 3.0, 1.6, d.title, size=48, bold=True, font=self.t.head,
                  color=self.t.on_dark, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.BOTTOM)
        if d.subtitle:
            self.text(s, 1.5, 4.05, W - 3.0, 1.0, d.subtitle, size=20, color=self.t.on_dark, align=PP_ALIGN.CENTER)
        return s

    # ---------------------------------------------------------------- deck
    def add(self, d: Slide, n: int):
        d = d.usable()
        side = image_side(d) if d.type not in ("title", "thanks") else None
        img = self.images.get(d.image_id) if side else None
        pw = 3.6 if d.type in ("process", "stats", "agenda", "comparison", "timeline") else 5.0
        if img:
            side = "left" if side == "left" else "right"
            self.X0, self.CW = (pw + 0.55, W - pw - 0.55 - M) if side == "left" else (M, W - pw - 0.55 - M)
        s = getattr(self, f"s_{d.type}")(d, n)
        if img:
            self.picture(s, img, 0 if side == "left" else W - pw, 0, pw, H, name="Slide picture")
        dark = d.type in ("title", "conclusion", "thanks") or self.t.dark_content
        if d.type not in ("title", "thanks"):
            self.footer(s, n, dark)
        self.notes(s, d.notes)
        self.X0, self.CW = M, W - 2 * M

    def save(self) -> bytes:
        self.prs.core_properties.title = self.deck_title
        self.prs.core_properties.author = "DocuMind"
        buf = io.BytesIO()
        self.prs.save(buf)
        return buf.getvalue()


def build_pptx(slides: list[dict], style: str, title: str, images: dict[str, bytes] | None = None) -> bytes:
    theme = THEMES.get(style, THEMES["modern"])
    b = Builder(theme, title, len(slides))
    b.images = images or {}
    for i, raw in enumerate(slides, 1):
        b.add(Slide.model_validate(raw), i)
    return b.save()
