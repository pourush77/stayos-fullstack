from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "uat"
SCREENSHOT_DIR = OUT_DIR / "screenshots"
PDF_PATH = OUT_DIR / "StayOS_Staff_Usage_Guide.pdf"

PAGE_W, PAGE_H = A4
MARGIN = 42
PURPLE = colors.HexColor("#7C3AED")
INK = colors.HexColor("#101828")
MUTED = colors.HexColor("#64748B")
LIGHT = colors.HexColor("#F5F3FF")
BORDER = colors.HexColor("#E2E8F0")


def draw_header(c, title, page_no):
    c.setFillColor(PURPLE)
    c.roundRect(MARGIN, PAGE_H - 54, 32, 32, 10, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(MARGIN + 16, PAGE_H - 43, "S")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(MARGIN + 42, PAGE_H - 35, "StayOS")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 35, f"Page {page_no}")
    c.setStrokeColor(BORDER)
    c.line(MARGIN, PAGE_H - 68, PAGE_W - MARGIN, PAGE_H - 68)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(MARGIN, PAGE_H - 108, title)


def draw_wrapped(c, text, x, y, width, font="Helvetica", size=11, leading=15, color=MUTED):
    c.setFont(font, size)
    c.setFillColor(color)
    words = text.split()
    line = ""
    for word in words:
      candidate = f"{line} {word}".strip()
      if c.stringWidth(candidate, font, size) <= width:
          line = candidate
      else:
          c.drawString(x, y, line)
          y -= leading
          line = word
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_bullets(c, items, x, y, width, check=False):
    for item in items:
        marker = "OK" if check else "-"
        c.setFillColor(PURPLE if check else MUTED)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x, y, marker)
        y = draw_wrapped(c, item, x + 18, y, width - 18, size=11, leading=16, color=INK) + 1
    return y


def draw_screenshot(c, filename, x, y_top, max_w, max_h):
    path = SCREENSHOT_DIR / filename
    image = ImageReader(str(path))
    img_w, img_h = image.getSize()
    scale = min(max_w / img_w, max_h / img_h)
    draw_w = img_w * scale
    draw_h = img_h * scale
    y = y_top - draw_h
    c.setFillColor(colors.white)
    c.setStrokeColor(BORDER)
    c.roundRect(x - 6, y - 6, draw_w + 12, draw_h + 12, 10, fill=1, stroke=1)
    c.drawImage(image, x, y, width=draw_w, height=draw_h, preserveAspectRatio=True, mask="auto")
    return y - 22


def cover(c):
    c.setFillColor(colors.white)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(LIGHT)
    c.roundRect(MARGIN, PAGE_H - 390, PAGE_W - 2 * MARGIN, 290, 18, fill=1, stroke=0)
    c.setFillColor(PURPLE)
    c.roundRect(MARGIN + 28, PAGE_H - 162, 52, 52, 16, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(MARGIN + 54, PAGE_H - 145, "S")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 32)
    c.drawString(MARGIN + 28, PAGE_H - 220, "StayOS")
    c.setFont("Helvetica-Bold", 25)
    c.drawString(MARGIN + 28, PAGE_H - 262, "Manager Configuration")
    c.drawString(MARGIN + 28, PAGE_H - 294, "& Front Desk Booking")
    draw_wrapped(
        c,
        "This guide explains how room occupancy, child pricing and taxes configured by the Manager are automatically applied while Front Desk creates a booking.",
        MARGIN + 28,
        PAGE_H - 330,
        PAGE_W - 2 * MARGIN - 56,
        size=12,
        leading=18,
        color=MUTED,
    )
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(PAGE_W / 2, 250, "Manager configures the rules")
    c.drawCentredString(PAGE_W / 2, 218, "then")
    c.drawCentredString(PAGE_W / 2, 186, "Front Desk uses them automatically")


def standard_page(c, page_no, title, screenshot, bullets, note=None, max_h=430):
    draw_header(c, title, page_no)
    y = draw_screenshot(c, screenshot, MARGIN, PAGE_H - 132, PAGE_W - 2 * MARGIN, max_h)
    if note:
        c.setFillColor(LIGHT)
        c.roundRect(MARGIN, y - 48, PAGE_W - 2 * MARGIN, 42, 10, fill=1, stroke=0)
        draw_wrapped(c, note, MARGIN + 14, y - 21, PAGE_W - 2 * MARGIN - 28, size=11, color=INK)
        y -= 64
    draw_bullets(c, bullets, MARGIN, y, PAGE_W - 2 * MARGIN)


def checks_page(c):
    draw_header(c, "6. What Staff Should Check", 7)
    y = PAGE_H - 150
    y = draw_wrapped(
        c,
        "Please try normal hotel booking scenarios and check that StayOS applies the Manager's rules correctly.",
        MARGIN,
        y,
        PAGE_W - 2 * MARGIN,
        size=12,
        leading=18,
        color=INK,
    )
    y -= 14
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN, y, "Try different combinations")
    y -= 24
    y = draw_bullets(
        c,
        [
            "Different room types",
            "Different number of adults",
            "Different number of children",
            "Child ages such as 4, 6, 9, 12 and 17",
            "Different stay durations",
        ],
        MARGIN,
        y,
        PAGE_W - 2 * MARGIN,
    )
    y -= 8
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(INK)
    c.drawString(MARGIN, y, "Check")
    y -= 24
    y = draw_bullets(
        c,
        [
            "Correct room capacity",
            "Correct child price",
            "Correct tax",
            "Correct total",
            "Booking creates successfully",
        ],
        MARGIN,
        y,
        PAGE_W - 2 * MARGIN,
        check=True,
    )
    y -= 8
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(INK)
    c.drawString(MARGIN, y, "If something looks wrong, share")
    y -= 24
    y = draw_bullets(
        c,
        [
            "Screenshot",
            "What you entered",
            "What you expected",
            "What StayOS showed",
        ],
        MARGIN,
        y,
        PAGE_W - 2 * MARGIN,
    )
    c.setFillColor(LIGHT)
    c.roundRect(MARGIN, 82, PAGE_W - 2 * MARGIN, 70, 12, fill=1, stroke=0)
    draw_wrapped(
        c,
        "Please explore the system normally as you would while handling hotel bookings. If anything feels incorrect, confusing or difficult to use, please report it.",
        MARGIN + 16,
        126,
        PAGE_W - 2 * MARGIN - 32,
        size=11,
        leading=16,
        color=INK,
    )


def build_pdf():
    PDF_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(PDF_PATH), pagesize=A4)

    cover(c)
    c.showPage()

    standard_page(
        c,
        2,
        "1. Configure Room Occupancy",
        "01-room-occupancy.png",
        [
            "Standard occupancy: 2",
            "Maximum occupancy: 3",
            "Maximum adults: 2",
            "Maximum children: 1",
        ],
        "These settings decide how many guests can stay in this room type. Front Desk cannot create a booking that exceeds these limits.",
    )
    c.showPage()

    standard_page(
        c,
        3,
        "2. Configure Child Pricing",
        "02-child-pricing.png",
        [
            "Age 0-5: Free",
            "Age 6-11: INR 850 per child per night",
            "Age 12-17: Adult pricing",
        ],
        "When Front Desk enters the child's age, StayOS automatically selects the matching pricing rule.",
    )
    c.showPage()

    standard_page(
        c,
        4,
        "3. Configure Taxes",
        "03-taxes.png",
        ["Tax name: GST", "Tax percentage: 12%"],
        "The configured tax is automatically used when StayOS calculates the booking total.",
    )
    c.showPage()

    standard_page(
        c,
        5,
        "4. Front Desk Creates Booking",
        "04-invalid-occupancy.png",
        [
            "Front Desk enters guest, dates, room, adults, children and child age.",
            "If a room does not fit the guest count, StayOS shows a warning and prevents booking.",
            "Example: 2 adults and 2 children exceeds the configured Deluxe child limit.",
        ],
        None,
        max_h=500,
    )
    c.showPage()

    standard_page(
        c,
        6,
        "5. Automatic Price Calculation",
        "06-confirm-total.png",
        [
            "Room charges, applicable child charges and tax are calculated before booking is created.",
            "In this example, StayOS applies the child price for age 9 and GST at 12%.",
        ],
        None,
        max_h=450,
    )
    c.showPage()

    checks_page(c)
    c.save()


if __name__ == "__main__":
    build_pdf()
    print(PDF_PATH)
