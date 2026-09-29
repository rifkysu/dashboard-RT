"""Gabungkan dokumen Model (teks) dengan diagram Model (format SEB) sebagai Lampiran.

Pemakaian (dari folder docs/):
    python merge_model_pdf.py
Butuh: pypdf, reportlab. Dokumen teks dibuat ulang lewat generate_model_doc.py (ke _sumber/),
diagram lewat generate_model_pdf.py, lalu hasil gabungan ditulis ke docs/.
"""
import io
import os
import subprocess
import sys

from pypdf import PdfReader, PdfWriter, Transformation
from pypdf._page import PageObject
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "_sumber")
A4_LAND = (841.89, 595.28)

# (dokumen asli, penanda nama diagram, judul entri daftar isi, y baris terakhir daftar isi)
DOCS = [
    ("Model_Aplikasi_Biro_Umum.pdf", "aplikasi", "Lampiran. Diagram Aplikasi Model (format SEB)", 575.087),
    ("Model_Infrastruktur_Biro_Umum.pdf", "infra",
     "Lampiran. Diagram Infrastruktur Model (Server, Jaringan, Sistem Penghubung)", 483.197),
]


def toc_overlay(text, page_no, y):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(595.28, 841.89))
    c.setFillColor(HexColor("#0F172A"))
    c.setFont("Helvetica", 10)
    c.drawString(57.4, y, text)
    c.drawRightString(537.8, y, str(page_no))
    c.save()
    buf.seek(0)
    return PdfReader(buf).pages[0]


def fit_a4_landscape(page):
    w, h = float(page.mediabox.width), float(page.mediabox.height)
    s = min(A4_LAND[0] / w, A4_LAND[1] / h)
    blank = PageObject.create_blank_page(width=A4_LAND[0], height=A4_LAND[1])
    tx, ty = (A4_LAND[0] - w * s) / 2, (A4_LAND[1] - h * s) / 2
    blank.merge_transformed_page(page, Transformation().scale(s).translate(tx, ty))
    return blank


subprocess.run([sys.executable, os.path.join(HERE, "generate_model_doc.py")], check=True)

for name, tag, toc_text, last_y in DOCS:
    base = PdfReader(os.path.join(SRC, name))
    start = len(base.pages) + 1
    diag_path = os.path.join(HERE, f"_diagram_{tag}.pdf")
    subprocess.run([sys.executable, os.path.join(HERE, "generate_model_pdf.py"), diag_path, str(start)], check=True)

    out = PdfWriter()
    for i, pg in enumerate(base.pages):
        if i == 1:  # halaman Daftar Isi
            pg.merge_page(toc_overlay(toc_text, start, last_y - 23))
        out.add_page(pg)
    for pg in PdfReader(diag_path).pages:
        out.add_page(fit_a4_landscape(pg))
    out.add_metadata(base.metadata or {})
    with open(os.path.join(HERE, name), "wb") as f:
        out.write(f)
    os.remove(diag_path)
    print(f"{name}: {len(base.pages)} + lampiran -> halaman {start}+")
