"""Adds the logo header and page footer to the rendered parts and builds:
   - the binder (cover, contents, intro, all guides; each section starts on a right-hand page for double-sided printing)
   - one PDF per guide
Usage: python3 assemble.py <work dir> <out dir>"""
import json, os, sys, pymupdf

work, out = sys.argv[1], sys.argv[2]
parts = os.path.join(work, "parts")
os.makedirs(os.path.join(out, "Individual guides"), exist_ok=True)
guides = json.load(open(os.path.join(work, "parts.json")))
stages = json.load(open(os.path.join(work, "stages.json")))
by_num = {g["num"]: g for g in guides}
stage_of = {n: i for i, (_, nums) in enumerate(stages) for n in nums}
ordered = [by_num[n] for _, nums in stages for n in nums]
HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(HERE, "logo-mark.png")
BLUE = (0x00/255, 0x0A/255, 0xB5/255)
GOLD = (0xFF/255, 0xA7/255, 0x00/255)
INK = (0.09, 0.09, 0.11)
MUTED = (0.33, 0.36, 0.40)
FONT_B = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
IN = 72
INNER, OUTER = 0.95 * IN, 0.6 * IN   # same mirrored margins as the CSS

def stamp(page, right_hand, section_label, page_label, section_num=None):
    w, h = page.rect.width, page.rect.height
    left = INNER if right_hand else OUTER
    right = w - (OUTER if right_hand else INNER)
    page.insert_font(fontname="LB", fontfile=FONT_B)
    page.insert_font(fontname="LR", fontfile=FONT_R)
    # Header: logo on the outside edge, titles, blue rule with a gold accent
    logo_h = 0.42 * IN
    top = 0.32 * IN
    if right_hand:
        logo_rect = pymupdf.Rect(right - logo_h, top, right, top + logo_h)
    else:
        logo_rect = pymupdf.Rect(left, top, left + logo_h, top + logo_h)
    page.insert_image(logo_rect, filename=LOGO, keep_proportion=True)
    base = top + logo_h * 0.68
    team = "FRC 5090 PROGRAMMING GUIDES"
    if right_hand:
        page.insert_text((left, base), team, fontname="LB", fontsize=7.5, color=BLUE)
        tw = pymupdf.get_text_length(section_label, fontname="helv", fontsize=8.5) * 1.0
        x = right - logo_h - 8 - pymupdf.Font(fontfile=FONT_R).text_length(section_label, 8.5)
        page.insert_text((x, base), section_label, fontname="LR", fontsize=8.5, color=INK)
    else:
        page.insert_text((left + logo_h + 8, base), section_label, fontname="LR", fontsize=8.5, color=INK)
        x = right - pymupdf.Font(fontfile=FONT_B).text_length(team, 7.5)
        page.insert_text((x, base), team, fontname="LB", fontsize=7.5, color=BLUE)
    rule_y = top + logo_h + 5
    page.draw_line((left, rule_y), (right, rule_y), color=BLUE, width=1.2)
    gold_w = 1.1 * IN
    gx = (right - gold_w) if right_hand else left
    page.draw_line((gx, rule_y), (gx + gold_w, rule_y), color=GOLD, width=3)
    # Footer: page number on the outside edge (in a gold tab with the guide number), team name inside
    fy = h - 0.42 * IN
    page.draw_line((left, fy - 12), (right, fy - 12), color=(0.8, 0.82, 0.86), width=0.6)
    fb = pymupdf.Font(fontfile=FONT_B)
    inside = "Trenton TorqueNados  ·  Team 5090"
    if right_hand:
        page.insert_text((left, fy), inside, fontname="LR", fontsize=7.5, color=MUTED)
        page.insert_text((right - fb.text_length(page_label, 9), fy), page_label, fontname="LB", fontsize=9, color=BLUE)
    else:
        page.insert_text((left, fy), page_label, fontname="LB", fontsize=9, color=BLUE)
        page.insert_text((right - pymupdf.Font(fontfile=FONT_R).text_length(inside, 7.5), fy), inside, fontname="LR", fontsize=7.5, color=MUTED)
    # Edge tab: the guide number in gold on the outside edge, so you can flip to it in a binder
    if section_num:
        tab_h, tab_w = 0.62 * IN, 0.5 * IN
        idx = stage_of.get(section_num, 0)
        ty = 1.25 * IN + (idx % 9) * (tab_h + 4)
        if right_hand:
            r = pymupdf.Rect(w - tab_w, ty, w, ty + tab_h)
        else:
            r = pymupdf.Rect(0, ty, tab_w, ty + tab_h)
        page.draw_rect(r, color=None, fill=GOLD)
        tl = fb.text_length(section_num, 11)
        cx = (r.x0 + 0.12 * IN + r.x1) / 2 if right_hand else (r.x0 + r.x1 - 0.12 * IN) / 2
        page.insert_text((cx - tl / 2, r.y0 + tab_h / 2 + 4), section_num, fontname="LB", fontsize=11, color=BLUE)

def notes_page(page, right_hand, page_label):
    """Filler page before a new section (double-sided printing): turn it into a lined notes page."""
    stamp(page, right_hand, "Notes", page_label)
    w, h = page.rect.width, page.rect.height
    left = INNER if right_hand else OUTER
    right = w - (OUTER if right_hand else INNER)
    page.insert_font(fontname="LB", fontfile=FONT_B)
    page.insert_text((left, 1.25 * IN), "Notes", fontname="LB", fontsize=16, color=BLUE)
    page.draw_line((left, 1.33 * IN), (left + 0.9 * IN, 1.33 * IN), color=GOLD, width=3)
    y = 1.75 * IN
    while y < h - 0.85 * IN:
        page.draw_line((left, y), (right, y), color=(0.8, 0.82, 0.86), width=0.6)
        y += 0.32 * IN

def open_part(name):
    return pymupdf.open(os.path.join(parts, name + ".pdf"))

# ---- Individual guides (each starts on a right-hand page, numbered "07-1, 07-2...") ----
for g in guides:
    src = open_part(f"guide-{g['num']}")
    n = len(src)
    for i, page in enumerate(src):
        stamp(page, i % 2 == 0, f"{g['num']}  {g['title']}", f"{g['num']} · page {i + 1} of {n}", g["num"])
    fname = f"{g['num']} - {g['title'].replace(':', ' -').replace('/', '-').replace('?', '')}.pdf"
    src.save(os.path.join(out, "Individual guides", fname), garbage=3, deflate=True)

# ---- Binder ----
binder = pymupdf.open()
labels = []   # (section label, section num) per binder page; None = no header/footer (cover, blanks)
def add(doc, label, num, odd_start=True, even_start=False):
    # Divider pages go on a left-hand page so they face the first page of their stage
    if even_start and len(binder) % 2 == 0:
        binder.new_page(width=612, height=792); labels.append("notes")
    elif not even_start and odd_start and len(binder) % 2 == 1:
        binder.new_page(width=612, height=792); labels.append("notes")
    start = len(binder) + 1
    binder.insert_pdf(doc)
    labels.extend([(label, num) if label else None] * len(doc))
    return start

add(open_part("cover"), None, None)
labels[0] = None
starts = {}
binder.new_page(width=612, height=792); labels.append(None)   # inside of the cover stays blank
starts["toc"] = add(open_part("toc"), "Contents", None)
starts["intro"] = add(open_part("intro"), "How to use these guides", None)
for si, (stage_name, nums) in enumerate(stages):
    starts[f"stage{si}"] = add(open_part(f"divider-{si}"), None, None, even_start=True)
    for n in nums:
        g = by_num[n]
        starts[n] = add(open_part(f"guide-{n}"), f"{n}  {g['title']}", n)
if len(binder) % 2 == 1:
    binder.new_page(width=612, height=792); labels.append("notes")

for i, page in enumerate(binder):
    if labels[i] is None:
        continue
    if labels[i] == "notes":
        notes_page(page, i % 2 == 0, str(i + 1))
        continue
    label, num = labels[i]
    stamp(page, i % 2 == 0, label, str(i + 1), num)

json.dump(starts, open(os.path.join(work, "start-pages.json"), "w"))
binder.save(os.path.join(out, "5090 Programming Guides - Full Binder.pdf"), garbage=3, deflate=True)
print("binder pages:", len(binder), "starts:", starts)

# ---- One PDF per part (slices of the binder, so page numbers match the Contents page) ----
os.makedirs(os.path.join(out, "Parts"), exist_ok=True)
bounds = [starts[f"stage{i}"] for i in range(len(stages))] + [len(binder) + 1]
for i, (stage_name, _) in enumerate(stages):
    first, last = bounds[i], bounds[i + 1] - 1
    part = pymupdf.open()
    part.insert_pdf(binder, from_page=0, to_page=0)            # cover
    part.insert_pdf(binder, from_page=first - 1, to_page=last - 1)
    part.save(os.path.join(out, "Parts", f"Part {i + 1} - {stage_name}.pdf"), garbage=3, deflate=True)
print("parts written")
