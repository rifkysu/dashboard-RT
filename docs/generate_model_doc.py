"""Generate dokumen teks Model Aplikasi & Model Infrastruktur (A4 portrait).

Pemakaian (dari folder docs/):
    python generate_model_doc.py            -> tulis kedua dokumen ke _sumber/
    python generate_model_doc.py aplikasi   -> hanya Model Aplikasi
    python generate_model_doc.py infra      -> hanya Model Infrastruktur
    python generate_model_doc.py all <dir>  -> tulis ke folder lain (mis. untuk cek)

Hasilnya adalah dokumen asli TANPA lampiran; `merge_model_pdf.py` menambahkan
lampiran diagram SEB (generate_model_pdf.py) dan menulis PDF final ke docs/.

Cara mengubah isi: edit bagian ISI DOKUMEN di bawah. Markup teks sederhana:
    **tebal**   *miring*   `kode`   (karakter & < > otomatis di-escape)
Setiap perubahan kode aplikasi yang memengaruhi isi dokumen -> update di sini,
naikkan TANGGAL, lalu jalankan `python merge_model_pdf.py`.
"""
import io
import math
import os
import re
import sys
from xml.sax.saxutils import escape

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (BaseDocTemplate, Flowable, Frame, PageBreak, PageTemplate,
                                Paragraph, Spacer, Table, TableStyle)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LOGO = os.path.join(ROOT, "frontend", "public", "logo-kemnaker.png")

TANGGAL = "30 September 2026"
SISTEM = "Sistem Layanan Biro Umum & Rumah Tangga"

PW, PH = A4
MARGIN = 18 * mm
TOP = 20 * mm
BOTTOM = 20 * mm
CONTENT_X = MARGIN + 6          # frame padding 6 pt
CONTENT_W = PW - 2 * MARGIN - 12

NAVY = HexColor("#0f172a")
INK = HexColor("#1e293b")
MUTED = HexColor("#475569")
BLUE = HexColor("#2563eb")
LINE = HexColor("#cbd5e1")
ZEBRA = HexColor("#f1f5f9")

# ------------------------------------------------------------------ gaya teks
H1 = ParagraphStyle("H1", fontName="Helvetica-Bold", fontSize=16, leading=22, textColor=NAVY,
                    spaceBefore=6, spaceAfter=8)
H2 = ParagraphStyle("H2", fontName="Helvetica-Bold", fontSize=12, leading=18, textColor=BLUE,
                    spaceBefore=10, spaceAfter=4)
BODY = ParagraphStyle("Body", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=INK,
                      spaceBefore=6, spaceAfter=4)
BULLET = ParagraphStyle("Bullet", parent=BODY, leftIndent=12, bulletIndent=2, bulletFontSize=10,
                        spaceBefore=6, spaceAfter=0)
NOTE = ParagraphStyle("Note", fontName="Helvetica", fontSize=8, leading=10.5, textColor=INK,
                      spaceBefore=6, spaceAfter=0)
CAPTION = ParagraphStyle("Caption", fontName="Helvetica", fontSize=8, leading=10.5, textColor=MUTED,
                         alignment=TA_CENTER, spaceBefore=4, spaceAfter=8)
INTRO = ParagraphStyle("Intro", fontName="Helvetica", fontSize=10.5, leading=15.5, textColor=INK)
CELL = ParagraphStyle("Cell", fontName="Helvetica", fontSize=8, leading=10.5, textColor=INK)
CELL_HEAD = ParagraphStyle("CellHead", parent=CELL, fontName="Helvetica-Bold", textColor=white)


def md(text):
    """Markup ringan -> markup Paragraph ReportLab."""
    codes = []

    def keep(m):
        codes.append(m.group(1))
        return f"\x00{len(codes) - 1}\x00"

    text = re.sub(r"`([^`]+)`", keep, text)
    text = escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\*(\S.*?)\*", r"<i>\1</i>", text)
    return re.sub("\x00(\\d+)\x00", lambda m: f'<font face="Courier">{escape(codes[int(m.group(1))])}</font>', text)


# ------------------------------------------------------------ blok penyusun
class Heading(Paragraph):
    """Judul bab (H1) -- dicatat untuk Daftar Isi."""

    def __init__(self, text):
        super().__init__(md(text), H1)
        self.toc_text = text


def h1(text):
    return Heading(text)


def h2(text):
    return Paragraph(md(text), H2)


def p(text):
    return Paragraph(md(text), BODY)


def note(text):
    return Paragraph(md(text), NOTE)


def caption(text):
    return Paragraph(md(text), CAPTION)


def bullets(*items):
    return [Paragraph(md(t), BULLET, bulletText="•") for t in items]


def table(widths_mm, rows, header=True, width=None, zebra_first=False):
    """rows: list baris; baris pertama = judul kolom bila header=True."""
    data = []
    for r, row in enumerate(rows):
        st = CELL_HEAD if header and r == 0 else CELL
        data.append([Paragraph(md(c), st) for c in row])
    t = Table(data, colWidths=[w * mm for w in widths_mm], repeatRows=1 if header else 0,
              spaceBefore=5)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]
    if header:
        style += [("BACKGROUND", (0, 0), (-1, 0), NAVY),
                  ("ROWBACKGROUNDS", (0, 1), (-1, -1), [None, ZEBRA])]
    else:
        style += [("ROWBACKGROUNDS", (0, 0), (-1, -1), [ZEBRA, None] if zebra_first else [None, ZEBRA])]
    t.setStyle(TableStyle(style))
    return t


class TocBlock(Flowable):
    """Daftar Isi: diisi nomor halaman pada build kedua."""

    PITCH = 23

    def __init__(self, doc):
        super().__init__()
        self.doc = doc

    def wrap(self, aw, ah):
        return CONTENT_W, max(len(self.doc.toc_entries), 1) * self.PITCH

    def draw(self):
        c = self.canv
        c.setFont("Helvetica", 10)
        c.setFillColor(NAVY)
        _, h = self.wrap(0, 0)
        for i, (text, page) in enumerate(self.doc.toc_entries):
            y = h - 13 - i * self.PITCH
            c.drawString(0, y, text)
            c.drawRightString(CONTENT_W, y, str(page))


# ------------------------------------------------------------------ diagram
PALET = {  # nama: (isi, garis)
    "blue": ("#e0edff", "#2563eb"), "indigo": ("#eef2ff", "#4f46e5"),
    "green": ("#ecfdf5", "#059669"), "amber": ("#fff7ed", "#d97706"),
    "amber2": ("#fffbeb", "#d97706"), "rose": ("#fff1f2", "#e11d48"),
    "violet": ("#f5f3ff", "#7c3aed"), "plain": ("#ffffff", "#cbd5e1"),
    "wIndigo": ("#ffffff", "#4f46e5"),
}
# ukuran teks kotak: (judul, keterangan, jarak baris)
SZ_M = (8, 6.7, 10.5)
SZ_L = (8.5, 7.2, 11)
SZ_S = (6.8, 5.5, 9.3)
SZ_XS = (7, 5.7, 9.5)


class Diagram(Flowable):
    """Gambar vektor. Koordinat ditulis dalam koordinat halaman (x dari kiri kertas,
    y dari atas kertas) relatif terhadap posisi atas flowable `top`."""

    def __init__(self, top, bottom, painter):
        super().__init__()
        self.top, self.h, self.painter = top, bottom - top, painter

    def wrap(self, aw, ah):
        return CONTENT_W, self.h

    def draw(self):
        self.painter(Pen(self.canv, self.top, self.h))


class Pen:
    def __init__(self, c, top, h):
        self.c, self.top, self.h = c, top, h

    def X(self, x):
        return x - CONTENT_X

    def Y(self, y):
        return self.h - (y - self.top)

    def text(self, x, y, s, size, color=MUTED, bold=False, align="left"):
        c = self.c
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.setFillColor(HexColor(color) if isinstance(color, str) else color)
        fn = {"left": c.drawString, "center": c.drawCentredString, "right": c.drawRightString}[align]
        fn(self.X(x), self.Y(y), s)

    def group(self, x, y, w, h, label, pal):
        c = self.c
        col = HexColor(PALET[pal][1])
        c.saveState()
        c.setStrokeColor(col)
        c.setLineWidth(0.8)
        c.setDash(3, 2)
        c.roundRect(self.X(x), self.Y(y + h), w, h, 8, stroke=1, fill=0)
        c.restoreState()
        self.text(x + 7, y + 11, label, 7.5, col, bold=True)

    def box(self, x, y, w, h, title, subs=(), pal="blue", sz=SZ_M):
        c = self.c
        fill, stroke = PALET[pal]
        c.setFillColor(HexColor(fill))
        c.setStrokeColor(HexColor(stroke))
        c.setLineWidth(1)
        c.roundRect(self.X(x), self.Y(y + h), w, h, 6, stroke=1, fill=1)
        ts, ss, pitch = sz
        lines = [title, *subs]
        cy = y + h / 2
        for i, s in enumerate(lines):
            by = cy - (len(lines) - 1) * pitch / 2 + i * pitch + ts * 0.33
            if i == 0:
                self.text(x + w / 2, by, s, ts, NAVY, bold=True, align="center")
            else:
                self.text(x + w / 2, by, s, ss, MUTED, align="center")

    def entity(self, x, y, w, title, rows, color):
        """Kotak tabel ERD. Baris berawalan PK/FK dicetak tebal."""
        c = self.c
        col = HexColor(color)
        h = 16 + len(rows) * 10.5 + 6
        c.setLineWidth(1)
        c.setStrokeColor(col)
        c.setFillColor(white)
        c.rect(self.X(x), self.Y(y + h), w, h, stroke=1, fill=1)
        c.setFillColor(col)
        c.rect(self.X(x), self.Y(y + 16), w, 16, stroke=1, fill=1)
        self.text(x + w / 2, y + 11.5, title, 8, white, bold=True, align="center")
        for i, r in enumerate(rows):
            self.text(x + 5, y + 27 + i * 10.5, r, 6.6, NAVY, bold=r.startswith(("PK", "FK")))

    def arrow(self, x1, y1, x2, y2, both=False):
        c = self.c
        col = MUTED
        c.setStrokeColor(col)
        c.setFillColor(col)
        c.setLineWidth(1.1)
        c.line(self.X(x1), self.Y(y1), self.X(x2), self.Y(y2))
        heads = [(x1, y1, x2, y2)] + ([(x2, y2, x1, y1)] if both else [])
        for ax, ay, bx, by in heads:
            ang = math.atan2(by - ay, bx - ax)
            ln, hw = 4.5, 2.175
            bxp, byp = bx - ln * math.cos(ang), by - ln * math.sin(ang)
            nx, ny = -math.sin(ang) * hw, math.cos(ang) * hw
            path = c.beginPath()
            path.moveTo(self.X(bx), self.Y(by))
            path.lineTo(self.X(bxp + nx), self.Y(byp + ny))
            path.lineTo(self.X(bxp - nx), self.Y(byp - ny))
            path.close()
            c.setLineWidth(1)
            c.drawPath(path, stroke=1, fill=1)
            c.setLineWidth(1.1)


# ------------------------------------------------------------------ dokumen
class ModelDoc(BaseDocTemplate):
    def __init__(self, filename, judul, intro, **kw):
        super().__init__(filename, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                         topMargin=TOP, bottomMargin=BOTTOM, title=judul, subject=judul,
                         author="Biro Umum & Rumah Tangga", **kw)
        self.judul, self.intro = judul, intro
        self.toc_entries = []
        frame = Frame(MARGIN, BOTTOM, PW - 2 * MARGIN, PH - TOP - BOTTOM, id="f")
        self.addPageTemplates([PageTemplate("cover", [frame], onPage=self._cover),
                               PageTemplate("isi", [frame], onPage=self._page)])

    def afterFlowable(self, f):
        if isinstance(f, Heading):
            self._found.append((f.toc_text, self.page))

    def _cover(self, c, d):
        c.saveState()
        c.setFillColor(NAVY)
        c.rect(0, PH - 95 * mm, PW, 95 * mm, stroke=0, fill=1)
        c.setFillColor(BLUE)
        c.rect(0, PH - 98 * mm, PW, 3 * mm, stroke=0, fill=1)
        bx, btop, bs = CONTENT_X, 68.4, 26 * mm
        c.setFillColor(white)
        c.rect(bx, PH - btop - bs, bs, bs, stroke=0, fill=1)
        if os.path.exists(LOGO):
            c.drawImage(LOGO, bx + 4 * mm, PH - btop - 22 * mm, 18 * mm, 18 * mm, mask="auto")
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 26)
        c.drawString(CONTENT_X, PH - 185.1, self.judul)
        c.setFillColor(HexColor("#bfdbfe"))
        c.setFont("Helvetica", 12.5)
        c.drawString(CONTENT_X, PH - 202.6, SISTEM)
        c.drawString(CONTENT_X, PH - 219.6, "Kementerian Ketenagakerjaan")
        c.restoreState()

    def _page(self, c, d):
        c.saveState()
        c.setFillColor(BLUE)
        c.rect(0, PH - 6 * mm, PW, 6 * mm, stroke=0, fill=1)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 7.5)
        c.drawString(MARGIN, PH - 36.9, f"{self.judul}  |  {SISTEM}")
        c.setStrokeColor(LINE)
        c.setLineWidth(1)
        c.line(MARGIN, 14 * mm, PW - MARGIN, 14 * mm)
        c.drawString(MARGIN, PH - 813.5, f"Versi {TANGGAL}")
        c.drawRightString(PW - MARGIN, PH - 813.5, f"Halaman {d.page}")
        c.restoreState()

    def story(self, body):
        from reportlab.platypus.doctemplate import NextPageTemplate
        info = table([40, 120], [
            ["Dokumen", self.judul],
            ["Sistem", "Aplikasi Layanan Biro Umum & Rumah Tangga (web internal)"],
            ["Kode sumber", "biro-umum-app (backend/ & frontend/)"],
            ["Tanggal", TANGGAL],
            ["Disusun oleh", "Tim Biro Umum & Rumah Tangga"],
        ], header=False, zebra_first=True)
        return [Spacer(1, 280.8), Paragraph(md(self.intro), INTRO), Spacer(1, 22.6), info,
                NextPageTemplate("isi"), PageBreak(),
                Paragraph("Daftar Isi", H1), TocBlock(self), PageBreak(), *body]


def build(filename, judul, intro, body_fn):
    doc = ModelDoc(filename, judul, intro)
    # build pertama ke memori agar jumlah entri Daftar Isi sudah benar
    doc.filename = io.BytesIO()
    doc._found = []
    doc.build(doc.story(body_fn()))
    doc.toc_entries = doc._found
    doc.filename = filename
    doc._found = []
    doc.build(doc.story(body_fn()))
    assert doc._found == doc.toc_entries, "Daftar Isi berubah antar build"


# ============================================================ ISI DOKUMEN
# ------------------------------------------------------------ Model Aplikasi
def d_arsitektur(g):
    g.group(62, 383.7, 470, 90, "LAPISAN PRESENTASI  (Browser - React 18 SPA)", "blue")
    for i, (t, s) in enumerate([
            ("Halaman Publik", ["Landing, Jadwal Rapat"]),
            ("Autentikasi", ["Login, Daftar, Reset"]),
            ("Modul Operasional", ["Dashboard, Pemeliharaan,", "Pengadaan, Kendaraan, Rapat"]),
            ("Administrasi", ["Akun & Akses, Settings"])]):
        g.box(72 + 115 * i, 405.7, 108, 58, t, s, "blue")
    g.arrow(297, 473.7, 297, 485.7, both=True)
    g.text(303, 481.7, "HTTPS JSON + SSE", 6.8)
    g.group(62, 485.7, 470, 98, "LAPISAN APLIKASI  (Node.js - Express REST API :4000)", "indigo")
    g.box(72, 502.7, 450, 26, "Middleware",
          ["Security headers, CORS, rate limit, JWT (requireAuth), role (requireRole), maintenance"], "indigo")
    for i, r in enumerate(["auth", "dashboard", "pemeliharaan", "pengadaan", "kendaraan",
                           "ruang-rapat", "maintenance", "users"]):
        g.box(72 + 56.5 * i, 537.7, 52, 36, r, ["route"], "wIndigo", SZ_S)
    g.arrow(297, 583.7, 297, 593.7, both=True)
    g.group(62, 593.7, 470, 80, "LAPISAN DATA", "green")
    for i, (t, s) in enumerate([("Prisma ORM 6", ["schema.prisma", "24 migration"]),
                                ("PostgreSQL", ["biro_umum_db", "7 tabel inti"]),
                                ("File Storage", ["backend/uploads/", "(PDF, JPG, PNG)"])]):
        g.box(72 + 155 * i, 608.7, 140, 55, t, s, "green", SZ_L)
    g.arrow(212, 636.7, 227, 636.7)


def d_alur_permintaan(g):
    steps = [("Permintaan", ["Tambah + dokumen", "status: pending"], "blue"),
             ("Tahap 1", ["Analisa & HPS", "(BOQ, nilai HPS)"], "blue"),
             ("Tahap 2", ["Invoice & Pembayaran", "GUP/TUP/LS + RM/PNBP"], "blue"),
             ("Tahap 3", ["Dokumentasi / BAST", "dokumen final"], "blue"),
             ("Selesai", ["status: selesai", "tanggal_selesai"], "green")]
    for i, (t, s, pal) in enumerate(steps):
        x = 59 + 96 * i
        g.box(x, 132.7, 86, 55, t, s, pal)
        if i < len(steps) - 1:
            g.arrow(x + 86, 160.7, x + 96, 160.7)
    g.text(297.02, 204.7, 'Status tahap: pending -> on_progress -> selesai. "Simpan Draf" menyimpan tanpa '
           'pindah tahap.', 7, align="center")


def d_alur_booking(g):
    g.box(59, 319.7, 88, 48, "Isi Form", ["ruang, agenda, PIC,", "tanggal s/d, jam"], "blue", SZ_L)
    g.box(167, 319.7, 95, 48, "Validasi", ["frontend + backend", "maks. 90 hari"], "blue", SZ_L)
    g.box(282, 319.7, 110, 48, "Kunci Ruangan", ["advisory lock per ruang", "cek bentrok tanggal+jam"],
          "indigo", SZ_L)
    g.box(412, 319.7, 120, 33, "Tersimpan (201)", ["SSE broadcast ke semua"], "green", SZ_L)
    g.box(412, 362.7, 120, 33, "Bentrok (409)", ["pesan booking yang bentrok"], "rose", SZ_L)
    g.arrow(147, 343.7, 167, 343.7)
    g.arrow(262, 343.7, 282, 343.7)
    g.arrow(392, 337.7, 412, 336.7)
    g.arrow(392, 353.7, 412, 377.7)
    g.box(59, 404.7, 150, 48, "Cancel per tanggal",
          ["pilih tanggal yang dibatalkan", "(tanggal diklik tercentang)"], "amber", SZ_L)
    g.box(229, 404.7, 150, 48, "Pecah rentang",
          ["28 Sep-1 Okt, batal 29 Sep", "-> 28 Sep & 30 Sep-1 Okt"], "amber", SZ_L)
    g.box(399, 404.7, 133, 48, "Semua tanggal dipilih", ["booking berstatus batal", "+ SSE broadcast"], "amber", SZ_L)
    g.arrow(209, 428.7, 229, 428.7)
    g.arrow(379, 428.7, 399, 428.7)


def d_alur_auth(g):
    steps = [(59, 85, "Daftar Akun", ["validasi per kolom", "role: karyawan"], "blue"),
             (159, 85, "Halaman Login", ['pesan "akun dibuat"', "email terisi"], "blue"),
             (259, 85, "POST /auth/login", ["bcrypt compare", "rate limit IP+email"], "indigo"),
             (359, 80, "Popup Logo", ["animasi 3 detik", '"Selamat datang"'], "violet"),
             (454, 80, "Dashboard", ["JWT 8 jam", "di localStorage"], "green")]
    for i, (x, w, t, s, pal) in enumerate(steps):
        g.box(x, 511.2, w, 45, t, s, pal, SZ_L)
        if i < len(steps) - 1:
            g.arrow(x + w, 534.2, steps[i + 1][0], 534.2)
    g.box(59, 571.2, 230, 38, "Login Google (SSO, opsional)",
          ["OAuth 2.0 -> /sso-callback#token -> langsung ke Dashboard"], "plain", SZ_L)
    g.box(304, 571.2, 230, 38, "Logout (dari Sidebar)",
          ['popup "Sampai jumpa" 3 detik -> sesi dihapus -> Landing'], "violet", SZ_L)


def d_erd(g):
    g.entity(239, 142.2, 118, "users", [
        "PK id", "nama_lengkap, email (unik)", "password_hash, role (enum)", "no_hp, unit_kerja",
        "is_active, last_login_at", "sso_provider, reset_token"], "#0f172a")
    g.entity(62, 142.2, 142, "pemeliharaan", [
        "PK id, kode (unik)", "judul, lokasi, kategori", "status + tahap1..3_status",
        "stage1_* (BOQ, HPS)", "stage2_* (pembayaran, invoice)", "stage3_* (dokumentasi, BAST)",
        "FK created_by, updated_by"], "#059669")
    g.entity(394, 142.2, 138, "pengadaan", [
        "PK id, kode (unik)", "nama_barang_jasa, nilai_hps", "status + tahap1..3_status",
        "stage2_* (pembayaran)", "stage3_final_document_*", "FK created_by, updated_by"], "#d97706")
    g.entity(62, 262.2, 142, "kendaraan", [
        "PK id, plate (unik)", "nama_barang, merk, tipe, jenis", "masa_berlaku_stnk, waktu_pajak",
        "photos, bpkb_*, stnk_*", "FK created_by, updated_by"], "#0d9488")
    g.entity(62, 354.2, 142, "kendaraan_service", ["FK kendaraan_id (cascade)"], "#0d9488")
    g.entity(239, 282.2, 118, "maintenance_mode", [
        "PK id, menu_key (unik)", "is_active, message", "FK updated_by"], "#e11d48")
    g.entity(394, 262.2, 138, "ruang_rapat", [
        "PK id, room, agenda, pic", "booking_date .. end_date", "start_time .. end_time",
        "surat_status, nomor_surat", "FK created_by, updated_by"], "#7c3aed")
    g.arrow(204, 175.2, 239, 175.2)
    g.text(204.7, 171.2, "created_by", 6.8)
    g.arrow(394, 175.2, 357, 175.2)
    g.text(358.7, 171.2, "created_by", 6.8)
    g.arrow(167, 262.2, 262, 227.2)
    g.arrow(452, 262.2, 337, 227.2)
    g.arrow(298, 282.2, 298, 227.2)
    g.text(303, 254.7, "updated_by", 6.5)
    g.arrow(117, 354.2, 117, 336.7)
    g.text(123, 347.4, "1 kendaraan : N service", 6.5)


def isi_aplikasi():
    return [
        h1("1. Ringkasan Aplikasi"),
        p("Aplikasi Layanan Biro Umum & Rumah Tangga adalah aplikasi web internal untuk mengelola layanan "
          "operasional kantor dalam satu portal: permintaan **pemeliharaan** fasilitas, **pengadaan** "
          "barang/jasa, data aset **kendaraan** dinas beserta riwayat service, dan **booking ruang rapat**. "
          "Aplikasi juga menyediakan halaman publik (landing page & layar kiosk) yang menampilkan jadwal "
          "ruang rapat secara real-time."),
        h2("Tujuan utama"),
        *bullets(
            "Menggantikan pencatatan manual/terpisah dengan satu basis data terpusat (PostgreSQL).",
            "Memantau progres permintaan dari pengajuan hingga selesai melalui alur 3 tahap yang terdokumentasi.",
            "Mencegah jadwal ruang rapat bentrok dan menampilkan ketersediaan ruangan secara langsung.",
            "Mengingatkan jatuh tempo pajak kendaraan (H-14) dan mencatat riwayat service.",
            "Memberi kendali akses berbasis peran (karyawan, PIC, kabag, admin) yang diterapkan di frontend "
            "dan backend."),
        h2("Gambaran arsitektur aplikasi"),
        p("Aplikasi memakai arsitektur tiga lapis: antarmuka Single Page Application (React) di browser, "
          "REST API (Node.js/Express) sebagai lapisan logika bisnis, dan lapisan data (Prisma ORM + "
          "PostgreSQL + penyimpanan berkas). Perubahan jadwal rapat dan status maintenance dikirim ke "
          "browser secara real-time melalui Server-Sent Events (SSE)."),
        Diagram(377.7, 677.7, d_arsitektur),
        caption("Gambar 1. Arsitektur logis aplikasi (3 lapis)"),

        PageBreak(),
        h1("2. Pengguna & Hak Akses"),
        p("Sistem mengenal empat peran (*enum* `user_role`). Peran dan status aktif pengguna selalu dibaca "
          "ulang dari database pada setiap request, sehingga perubahan peran lewat pgAdmin 4 atau menu Akun & "
          "Akses langsung berlaku tanpa perlu login ulang."),
        table([25, 62, 87], [
            ["Peran", "Cara mendapatkan", "Ringkasan wewenang"],
            ["Karyawan", "Daftar mandiri lewat halaman Daftar Akun (satu-satunya peran yang bisa dipilih).",
             "Melihat data, mengajukan permintaan Pemeliharaan/Pengadaan, mengelola booking ruang rapat."],
            ["PIC", "Otomatis: karyawan yang menambahkan permintaan Pemeliharaan/Pengadaan pertamanya "
             "dinaikkan menjadi PIC.",
             "Seperti karyawan + memproses tahapan, mengedit & menghapus **data yang dibuatnya sendiri**; "
             "mengelola kendaraan."],
            ["Kabag", "Diberikan manual oleh admin melalui database.",
             "Setara admin: mengedit/menghapus seluruh data, Mode Maintenance, Akun & Akses, dan tetap dapat "
             "mengakses menu yang sedang maintenance."],
            ["Admin", "Diberikan manual melalui pgAdmin 4 (tidak tersedia di form Daftar).",
             "Mengedit/menghapus seluruh data + Mode Maintenance, Akun & Akses (ban/aktifkan akun, kirim link "
             "reset), tetap dapat mengakses menu yang sedang maintenance."],
        ]),
        h2("Matriks hak akses per modul"),
        table([64, 18, 21, 25, 23, 23], [
            ["Modul / aksi", "Publik", "Karyawan", "PIC", "Kabag", "Admin"],
            ["Landing page & jadwal rapat publik", "Lihat", "Lihat", "Lihat", "Lihat", "Lihat"],
            ["Dashboard", "-", "Lihat", "Lihat", "Lihat", "Lihat"],
            ["Pemeliharaan / Pengadaan: lihat & ajukan", "-", "Ya", "Ya", "Ya", "Ya"],
            ["Pemeliharaan / Pengadaan: proses tahap, edit, hapus", "-", "-", "Data sendiri", "Semua", "Semua"],
            ["Kendaraan: lihat", "-", "Ya", "Ya", "Ya", "Ya"],
            ["Kendaraan: tambah, ubah, foto, dokumen, service", "-", "-", "Ya", "Ya", "Ya"],
            ["Ruang Rapat: booking, edit, surat/status, cancel", "-", "Ya", "Ya", "Ya", "Ya"],
            ["Akun & Akses, Settings (Mode Maintenance)", "-", "-", "-", "Ya", "Ya"],
            ["Akses menu saat maintenance", "-", "-", "-", "Ya", "Ya"],
        ]),
        note("Otorisasi diterapkan dua lapis: tombol/menu disembunyikan di frontend, dan setiap endpoint API "
             "memeriksa ulang peran (HTTP 403 bila ditolak)."),

        PageBreak(),
        h1("3. Modul & Fitur"),
        h2("3.1 Landing Page & Layar Kiosk"),
        *bullets(
            "Halaman awal (**/**) berisi hero, ringkasan modul, dan jadwal ruang rapat (tampilan grid "
            "ruangan x tanggal per bulan, sama dengan menu Ruang Rapat) yang diperbarui real-time.",
            "Halaman kiosk **/jadwal-rapat** menampilkan jadwal yang sama dalam mode baca saja untuk layar di "
            "dekat ruang rapat.",
            "Mengikuti Mode Maintenance menu *landing*; status dibaca dari endpoint publik tanpa login."),
        h2("3.2 Autentikasi"),
        *bullets(
            "Login email & kata sandi; validasi per kolom (email wajib & berformat benar, kata sandi wajib).",
            "Setelah login berhasil muncul **popup animasi logo** selama 3 detik (\"Selamat datang, nama\") "
            "lalu masuk Dashboard; saat logout muncul popup \"Sampai jumpa\" lalu kembali ke landing page "
            "(sesi yang berakhir karena hal lain, mis. token kedaluwarsa, diarahkan ke halaman login).",
            "Daftar Akun: nama (min. 3 huruf, boleh gelar), email, nomor HP Indonesia, unit kerja, kata sandi "
            "min. 8 karakter berisi huruf & angka. Setelah daftar, pengguna diarahkan ke halaman Login (tidak "
            "otomatis masuk).",
            "Lupa kata sandi: link reset berlaku 1 jam, dikirim via email (SMTP) atau diteruskan admin dari "
            "menu Akun & Akses. Kata sandi baru mengikuti aturan yang sama dengan Daftar Akun (8-128 karakter, "
            "huruf & angka), diperiksa di frontend dan backend.",
            "Login Google (SSO) opsional melalui OAuth 2.0.",
            "Proteksi percobaan login: 5 kali per menit per kombinasi IP + email, dengan hitung mundur di "
            "layar."),
        h2("3.3 Dashboard"),
        *bullets(
            "Kartu ringkasan hal yang perlu ditindaklanjuti: permintaan Pending dan On Progress (gabungan "
            "Pemeliharaan + Pengadaan), pajak kendaraan perlu tindakan (belum bayar + jatuh tempo H-14), dan "
            "jumlah ruang rapat kosong saat ini.",
            "Kartu modul Pemeliharaan & Pengadaan menampilkan komposisi status (Pending / On Progress / "
            "Selesai); kartu Kendaraan menampilkan jumlah belum bayar pajak dan peringatan pajak H-14.",
            "Warna dipakai konsisten hanya untuk status: merah = Pending, kuning = On Progress, hijau = Selesai.",
            "Bila data gagal dimuat, tampil pesan error + tombol Coba lagi; angka tidak ditampilkan sebagai 0 "
            "(tampil \"-\" sebelum data pertama termuat, atau data terakhir beserta jamnya).",
            "Status ruang rapat saat ini: Kosong / Dipakai s.d. jam tertentu, termasuk booking multi-hari yang "
            "sedang berjalan.",
            "Daftar aktivitas terbaru gabungan Pemeliharaan & Pengadaan."),
        h2("3.4 Pemeliharaan & Pengadaan"),
        *bullets(
            "Pengajuan permintaan dengan dokumen pendukung (PDF/gambar/Office).",
            "Alur 3 tahap: (1) Analisa & HPS, (2) Invoice & Pembayaran - metode GUP (1-20), TUP (1-10) atau "
            "LS + tanggal, asal anggaran RM/PNBP, (3) Dokumentasi/BAST.",
            "Simpan Draf, Lanjut ke Tahap, Selesaikan (tanggal selesai otomatis).",
            "Filter per kolom, export Excel berdasarkan filter & rentang tanggal; pesan error + tombol Coba "
            "lagi bila data gagal dimuat."),
        h2("3.5 Kendaraan"),
        *bullets(
            "Data aset sesuai nomenklatur BMN: nama barang, merk, tipe, No BPKB, No Polisi (unik), plat "
            "khusus, tanggal perolehan, masa berlaku STNK, waktu pajak.",
            "Galeri hingga 6 foto (dikompres di browser, maks. 1600 px), dokumen PDF BPKB & STNK. Di modal "
            "Detail foto bisa dibuka ukuran penuh; kabag/PIC/admin dapat menambah, mengganti, dan menghapus "
            "foto (tetap maks. 6).",
            "Status Tersedia / Digunakan / Servis; riwayat service per tanggal (satu catatan per tanggal) "
            "dengan invoice PDF.",
            "Pencarian dan filter pill: merek, status, tahun perolehan; tab Roda 2/4/6."),
        h2("3.6 Ruang Rapat"),
        *bullets(
            "Lima ruangan: SERBAGUNA, SETJEN II, TRI DHARMA, BIRO UMUM, GRAHA KEMNAKER.",
            "Grid jadwal: **nama ruangan horizontal** (kolom) dan **tanggal vertikal** (baris, dikelompokkan "
            "per bulan); header ruangan & kolom tanggal menempel saat digulir; penanda hari ini, hari libur "
            "nasional, cuti bersama, dan akhir pekan.",
            "**Quick filter bulan** (pilih tahun lalu Jan-Des, tombol Bulan Ini) dan **infinite scroll**: bulan "
            "berikutnya dimuat otomatis saat digulir ke bawah, maks. 12 bulan sekaligus.",
            "**Booking multi-hari** (maks. 90 hari, jam sama setiap hari) dengan label \"Hari 2/3\" di "
            "kalender.",
            "Cek bentrok berdasarkan irisan rentang tanggal dan jam; penguncian per ruangan mencegah "
            "double-booking bersamaan.",
            "**Cancel per tanggal**: tanggal yang dipilih saja yang dibatalkan; rentang otomatis dipecah bila "
            "tanggal di tengah dibatalkan.",
            "**Cancel tidak menghapus data**: booking/tanggal yang dibatalkan tetap tersimpan di database dengan "
            "status batal (cancelled_at, cancelled_by) dan **alasan pembatalan opsional** yang diisi di popup "
            "Cancel. Booking batal tidak tampil di jadwal, dashboard, dan export, serta diabaikan saat cek bentrok.",
            "Toggle **Tampilkan yang dibatalkan** di menu Ruang Rapat: booking batal tampil abu-abu & dicoret; "
            "klik untuk melihat alasan, siapa yang membatalkan, dan waktunya (`GET /ruang-rapat?include_cancelled=1`).",
            "Status surat (Belum / Ditinjau / Diterima) dengan unggah surat, nomor surat, export Excel, "
            "\"Terakhir diedit oleh\", pembaruan real-time (SSE).",
            "Export Excel per hari (booking multi-hari dipecah satu baris per tanggal) dengan kolom Tanggal, "
            "Ruang Rapat, Nama Rapat, PIC, Nomor Surat.",
            "**Export Surat (ZIP)** dengan rentang tanggal yang sama: semua file surat booking aktif diunduh "
            "dalam satu ZIP (+ daftar_surat.csv); nomor surat yang sama cukup satu file "
            "(`GET /ruang-rapat/surat-export`)."),
        h2("3.7 Settings - Mode Maintenance (Admin)"),
        *bullets(
            "Menonaktifkan menu Landing, Dashboard, Pemeliharaan, Pengadaan, Kendaraan, Ruang Rapat dengan "
            "pesan khusus.",
            "Berlaku real-time lewat SSE; API menolak akses dengan HTTP 503 kecuali untuk admin."),
        h2("3.8 Akun & Akses (Admin)"),
        *bullets(
            "Daftar semua akun: peran, status, metode login, tanggal daftar, login terakhir.",
            "Ban/aktifkan akun (kecuali akun sendiri), notifikasi permintaan reset kata sandi, kirim/salin "
            "link reset.",
            "Akun yang di-ban melihat popup *Akun Anda Diblokir* (melanggar ketentuan / spam berlebihan) saat "
            "login dengan kata sandi yang benar, saat login SSO, atau langsung dikeluarkan bila sedang login. "
            "Link reset kata sandi yang masih berlaku ikut dihapus saat akun di-ban."),

        PageBreak(),
        h1("4. Alur Proses Bisnis"),
        h2("4.1 Alur permintaan Pemeliharaan / Pengadaan"),
        Diagram(116.7, 211.7, d_alur_permintaan),
        caption("Gambar 2. Alur 3 tahap permintaan Pemeliharaan dan Pengadaan"),
        p("Setiap tahap memiliki status sendiri (`tahap1_status` .. `tahap3_status`). Kolom wajib diperiksa "
          "saat tombol Lanjut/Selesaikan ditekan; Simpan Draf menyimpan tanpa validasi kelengkapan. Karyawan "
          "yang mengajukan permintaan pertama otomatis menjadi PIC atas permintaan tersebut."),
        h2("4.2 Alur booking & pembatalan ruang rapat"),
        Diagram(306.7, 456.7, d_alur_booking),
        caption("Gambar 3. Alur booking ruang rapat, cek bentrok, dan cancel per tanggal"),
        h2("4.3 Alur autentikasi"),
        Diagram(503.2, 613.2, d_alur_auth),
        caption("Gambar 4. Alur daftar akun, login, dan logout"),

        PageBreak(),
        h1("5. Struktur Halaman (Frontend)"),
        table([42, 38, 18, 76], [
            ["Rute", "Halaman", "Akses", "Keterangan"],
            ["/", "Landing", "Publik", "Ringkasan modul + jadwal rapat real-time"],
            ["/jadwal-rapat", "Jadwal Rapat (kiosk)", "Publik", "Tampilan baca saja untuk layar besar"],
            ["/login", "Login", "Publik", "Validasi kolom, anti-spam, popup animasi"],
            ["/register", "Daftar Akun", "Publik", "Validasi lengkap, lanjut ke Login"],
            ["/forgot-password, /reset-password", "Lupa & Reset Kata Sandi", "Publik",
             "Link reset berlaku 1 jam; aturan sandi sama dengan Daftar Akun"],
            ["/sso-callback", "SSO Callback", "Publik", "Menerima token login Google"],
            ["/dashboard", "Dashboard", "Login", "KPI, status ruang, aktivitas"],
            ["/pemeliharaan", "Pemeliharaan", "Login", "Daftar, tahapan, export"],
            ["/pengadaan", "Pengadaan", "Login", "Daftar, tahapan, export"],
            ["/kendaraan", "Kendaraan", "Login", "Aset, foto, dokumen, service"],
            ["/ruang-rapat", "Jadwal Ruang Rapat", "Login", "Kalender, booking, surat, export"],
            ["/profile", "Profil", "Login", "Data pengguna yang sedang masuk"],
            ["/akun", "Akun & Akses", "Admin", "Manajemen akun"],
            ["/settings", "Settings", "Admin", "Mode Maintenance per menu"],
        ]),
        h2("Komponen bersama"),
        *bullets(
            "**ProtectedRoute** & **Sidebar**: layout halaman login yang dipasang sekali (sidebar tetap di "
            "tempat saat pindah menu), menu per peran; **MenuGate**: notifikasi maintenance per menu.",
            "**PageTransition** & **SlideTransition**: animasi masuk halaman dan animasi geser antar-tahap, "
            "dan antar-tab kendaraan.",
            "**RoomDateGrid** + **MonthFilter** + hook **useMonthSchedule**: grid jadwal ruang rapat per bulan "
            "dengan infinite scroll, dipakai menu Ruang Rapat, landing page, dan kiosk.",
            "**AuthContext**: sesi, peran, status maintenance, sinkronisasi berkala (30 detik) + sinyal live.",
            "**live.js** + hook **useLive**: satu koneksi SSE bersama per tab; halaman berlangganan topik "
            "modulnya dan memuat ulang data tanpa kedip saat ada perubahan dari pengguna lain.",
            "**Feedback**: popup konfirmasi/peringatan dan notifikasi toast yang seragam.",
            "**DocumentViewer**: pratinjau dokumen melalui Blob URL; **LoginSplash**: popup animasi logo "
            "login/logout.",
            "**utils**: validation.js (aturan validasi), holidays.js (hari libur otomatis), fileSignature.js "
            "(cek magic number), imageCompress.js."),

        PageBreak(),
        h1("6. Antarmuka API (REST)"),
        p("Seluruh endpoint berada di bawah prefix `/api`, bertukar data JSON (berkas dikirim sebagai data URL "
          "Base64, maks. 25 MB per request). Endpoint bertanda Login memerlukan header "
          "`Authorization: Bearer <JWT>`."),
        table([24, 70, 32, 48], [
            ["Kelompok", "Metode & path", "Akses", "Fungsi"],
            ["Auth", "POST /auth/register", "Publik", "Daftar akun karyawan (tanpa token)"],
            ["", "POST /auth/login", "Publik", "Login, mengembalikan JWT"],
            ["", "POST /auth/forgot-password, /auth/reset-password", "Publik", "Minta & pakai link reset"],
            ["", "GET /auth/me; GET /auth/google", "Login; Publik", "Profil sesi; mulai SSO Google"],
            ["Dashboard", "GET /dashboard/summary, /dashboard/activities", "Login", "Ringkasan KPI & aktivitas"],
            ["Pemeliharaan", "GET / , GET /:id, POST /", "Login", "Daftar, detail, ajukan"],
            ["", "PUT /:id, DELETE /:id", "PIC (milik)/Kabag/Admin", "Proses tahap, ubah, hapus"],
            ["Pengadaan", "GET / , GET /:id, POST /, PUT /:id, DELETE /:id", "Sama dengan Pemeliharaan",
             "Alur pengadaan"],
            ["Kendaraan", "GET / , GET /:id, GET /:id/services, GET .../invoice", "Login",
             "Data aset & riwayat service"],
            ["", "POST /, PUT /:id, DELETE /:id, POST/PUT/DELETE services", "PIC/Kabag/Admin",
             "Kelola aset, dokumen, service"],
            ["Ruang Rapat", "GET /public-schedule, GET /stream (SSE)", "Publik", "Jadwal publik & sinyal real-time"],
            ["", "GET / , GET /:id, POST /, PUT /:id, DELETE /:id", "Login", "Kelola booking"],
            ["", "POST /:id/cancel-dates", "Login", "Batalkan tanggal tertentu"],
            ["Maintenance", "GET /landing-status, GET /stream (SSE)", "Publik", "Status landing & sinyal real-time"],
            ["", "GET / ; PUT /:menu_key", "Login; Admin/Kabag", "Baca & ubah mode maintenance"],
            ["Live", "GET /live/stream (SSE)", "Publik", "Satu sinyal real-time untuk semua modul"],
            ["Users", "GET /, GET /reset-requests/count, PUT /:id/status, POST /:id/reset-link", "Admin/Kabag",
             "Akun & Akses"],
            ["Health", "GET /health", "Publik", "Cek backend hidup"],
        ]),
        note("Kode respons umum: 200/201 berhasil, 400 input tidak valid (dengan pesan jelas), 401 belum/sesi "
             "habis, 403 peran tidak berwenang, 404 data tidak ada, 409 bentrok/duplikat, 413 berkas terlalu "
             "besar, 429 terlalu banyak permintaan, 503 menu sedang maintenance. Akun yang di-ban mendapat kode "
             "`ACCOUNT_BANNED` (403 saat login, 401 pada request lain)."),

        PageBreak(),
        h1("7. Model Data"),
        p("Skema database didefinisikan di `backend/prisma/schema.prisma` dan diterapkan melalui 24 migration "
          "berurutan (0001 s.d. 0024). Relasi *created_by/updated_by* ke tabel users memakai ON DELETE SET "
          "NULL agar data tetap ada saat akun dihapus."),
        Diagram(137.2, 399.2, d_erd),
        caption("Gambar 5. Diagram relasi entitas (ringkas)"),
        table([32, 42, 100], [
            ["Tabel", "Isi", "Kunci & aturan penting"],
            ["users", "Akun pengguna", "email unik; role enum; password bcrypt; token reset disimpan sebagai hash"],
            ["pemeliharaan", "Permintaan pemeliharaan",
             "kode unik REQ-tahun-nnnn; kategori sarana/prasarana; status tahap enum"],
            ["pengadaan", "Permintaan pengadaan", "kode unik PGD-tahun-nnnn; nilai_hps desimal (18,2)"],
            ["kendaraan", "Aset kendaraan", "plate unik; foto JSON; dokumen BPKB/STNK"],
            ["kendaraan_service", "Riwayat service",
             "unik (kendaraan_id, tanggal_service); ikut terhapus bersama kendaraan"],
            ["ruang_rapat", "Booking ruang rapat",
             "booking_date..end_date (CHECK end_date >= booking_date); end_time > start_time; batal = "
             "cancelled_at terisi + cancel_reason (tidak dihapus)"],
            ["maintenance_mode", "Status maintenance per menu", "menu_key unik"],
        ]),

        PageBreak(),
        h1("8. Aturan Validasi & Bisnis"),
        table([36, 138], [
            ["Area", "Aturan"],
            ["Daftar akun", "Nama 3-150 karakter (huruf, spasi, . , ' -); email valid; HP 08/62/+62 10-15 digit; "
             "unit kerja wajib; kata sandi 8-128 karakter berisi huruf & angka; email tidak boleh ganda."],
            ["Reset kata sandi", "Token reset 32-256 karakter dan belum kedaluwarsa (1 jam); kata sandi baru "
             "8-128 karakter berisi huruf & angka (sama dengan daftar akun)."],
            ["Login", "Email berformat benar; kunci 1 menit setelah 5 percobaan gagal per IP+email; akun "
             "yang di-ban ditolak dengan pesan ban hanya bila kata sandi benar (selain itu pesan umum "
             "\"Email atau kata sandi salah\")."],
            ["Pemeliharaan/Pengadaan", "Panjang teks sesuai kolom database; tanggal harus benar-benar ada "
             "(31 Feb ditolak); nominal angka >= 0; status hanya pending/on_progress/selesai; nomor GUP 1-20, "
             "TUP 1-10; asal anggaran RM/PNBP."],
            ["Kendaraan", "Nama barang dari daftar BMN; jenis Roda 2/4/6; No Polisi unik (dicek sebelum foto/dokumen disimpan); "
             "tanggal tahun 1950-2100, masa berlaku STNK & waktu pajak tidak sebelum tanggal perolehan; tanggal service tidak melebihi hari ini "
             "dan tidak ganda per tanggal; maks. 6 foto. Di modal Detail: mengosongkan tanggal & keluar dari status Servis tanpa "
             "riwayat service minta konfirmasi."],
            ["Ruang Rapat", "Jam selesai > jam mulai; rentang maks. 90 hari; tidak boleh beririsan tanggal+jam "
             "di ruangan yang sama; nomor HP PIC 6-30 karakter; nomor surat maks. 100 karakter; nama file surat maks. 255 "
             "karakter."],
            ["Berkas", "Hanya PDF/JPG/PNG/WebP/DOC/DOCX/XLS/XLSX; isi dicek magic number di server & browser; "
             "surat rapat maks. 8 MB, dokumen lain maks. 12 MB; nama berkas disanitasi."],
        ]),
    ]


# ------------------------------------------------------ Model Infrastruktur
def d_topologi(g):
    g.group(62, 142.2, 470, 76, "PENGGUNA", "blue")
    for i, (t, s) in enumerate([("Pegawai Internal", ["browser PC / HP", "(jaringan kantor)"]),
                                ("Pengunjung Publik", ["Landing & jadwal rapat", "tanpa login"]),
                                ("Layar Kiosk", ["/jadwal-rapat", "dekat ruang rapat"])]):
        g.box(72 + 155 * i, 163.2, 140, 45, t, s, "blue", SZ_L)
    g.arrow(142, 208.2, 142, 258.2)
    g.text(148, 235.2, "memuat HTML/JS", 6.8)
    g.arrow(297, 208.2, 297, 258.2, both=True)
    g.text(303, 235.2, "HTTPS REST + SSE", 6.8)
    g.arrow(452, 208.2, 452, 258.2)
    g.group(62, 238.2, 470, 150, "SERVER APLIKASI", "indigo")
    g.box(72, 258.2, 140, 50, "Frontend (statis)", ["Vite build -> dist/", "dev: Vite :5173"], "indigo", SZ_L)
    g.box(227, 258.2, 140, 50, "Backend API", ["Node.js 22 + Express 4", "port 4000  /api/*"], "indigo", SZ_L)
    g.box(382, 258.2, 140, 50, "Reverse Proxy (disarankan)", ["HTTPS / TLS di depan", "frontend & backend"],
          "plain", SZ_L)
    g.box(72, 331.2, 140, 45, "Prisma Client", ["query engine", "migrate deploy"], "wIndigo", SZ_L)
    g.box(227, 331.2, 140, 45, "File Upload & Log", ["backend/uploads/", "backend/logs/app.log"], "wIndigo", SZ_L)
    g.arrow(212, 283.2, 227, 283.2)
    g.arrow(262, 308.2, 187, 331.2)
    g.arrow(297, 308.2, 297, 331.2)
    g.group(62, 401.2, 300, 82, "SERVER DATABASE", "green")
    g.box(72, 421.2, 135, 52, "PostgreSQL 18", ["biro_umum_db", "port 5432"], "green", SZ_L)
    g.box(217, 421.2, 135, 52, "pgAdmin 4", ["administrasi DB", "peran admin manual"], "green", SZ_L)
    g.arrow(142, 376.2, 142, 421.2, both=True)
    g.text(148, 393.7, "TCP 5432", 6.8)
    g.arrow(207, 447.2, 217, 447.2, both=True)
    g.group(372, 401.2, 160, 82, "EKSTERNAL (opsional)", "amber")
    g.box(382, 419.2, 140, 24, "Google OAuth 2.0", [], "amber2", (7.5, 7.5, 0))
    g.box(382, 451.2, 140, 24, "SMTP (email reset)", [], "amber2", (7.5, 7.5, 0))
    g.arrow(357, 308.2, 512, 419.2)


def d_lapisan_keamanan(g):
    items = [("Header", "keamanan"), ("CORS", "origin"), ("Rate", "limit"), ("JWT +", "cek DB"),
             ("Role", "RBAC"), ("Maintenance", "mode"), ("Validasi", "input"), ("Magic", "number")]
    for i, (t, s) in enumerate(items):
        x = 59 + 60 * i
        g.box(x, 100.7, 54, 38, t, [s], "blue" if i % 2 == 0 else "indigo", SZ_XS)
        if i < len(items) - 1:
            g.arrow(x + 54, 119.7, x + 60, 119.7)
    g.text(297.02, 151.7, "Urutan pemeriksaan setiap request API sebelum menyentuh database/berkas", 7,
           align="center")


def isi_infra():
    return [
        h1("1. Topologi Sistem"),
        p("Sistem terdiri atas frontend statis (hasil build Vite), backend REST API Node.js, database "
          "PostgreSQL, dan penyimpanan berkas di disk server aplikasi. Layanan eksternal (Google OAuth dan "
          "SMTP) bersifat opsional dan hanya aktif bila dikonfigurasi."),
        Diagram(137.2, 487.2, d_topologi),
        caption("Gambar 1. Topologi infrastruktur"),
        h2("Arus komunikasi"),
        *bullets(
            "Browser memuat berkas statis frontend, lalu memanggil backend di `/api/*` (JSON melalui "
            "HTTP/HTTPS).",
            "Pembaruan real-time memakai **Server-Sent Events** (koneksi HTTP satu arah yang tetap terbuka): "
            "satu koneksi per tab ke `/api/live/stream` untuk semua modul (Pemeliharaan, Pengadaan, Kendaraan, "
            "Ruang Rapat, Maintenance, Akun). Setiap perubahan data yang berhasil mengirim sinyal nama modul, "
            "lalu halaman yang terbuka mengambil ulang datanya. Heartbeat 25 detik, reconnect otomatis 3 detik, "
            "dan setelah reconnect semua halaman memuat ulang sekali.",
            "Syarat deploy real-time: backend dijalankan sebagai satu proses (bukan cluster/beberapa instance), "
            "reverse proxy tidak mem-buffer `/api/live/stream`, dan TRUST_PROXY=true bila di belakang proxy.",
            "Backend mengakses PostgreSQL melalui Prisma Client (TCP 5432); pgAdmin 4 dipakai admin untuk "
            "administrasi database.",
            "Berkas unggahan disimpan di `backend/uploads/` dan tidak diekspos sebagai folder publik; isi "
            "berkas hanya diambil lewat endpoint yang terautentikasi."),

        PageBreak(),
        h1("2. Komponen & Teknologi"),
        table([26, 70, 78], [
            ["Lapisan", "Komponen", "Versi / keterangan"],
            ["Frontend", "React, React DOM", "18.3"],
            ["", "React Router DOM", "6.24 (routing SPA)"],
            ["", "Axios", "1.7 (HTTP client, interceptor token & 401)"],
            ["", "Vite + @vitejs/plugin-react", "5.3 (dev server :5173, build ke dist/)"],
            ["", "Tailwind CSS 3 (dibundel saat build) + app-theme.css; font dibundel lokal", "Styling & animasi, tanpa CDN"],
            ["Backend", "Node.js", "22 LTS"],
            ["", "Express", "4.19 (REST API, port 4000)"],
            ["", "Prisma ORM & Prisma Client", "6.19"],
            ["", "jsonwebtoken", "9 (JWT HS256, masa berlaku 8 jam)"],
            ["", "bcryptjs", "2.4 (hash kata sandi, cost 12)"],
            ["", "passport + passport-google-oauth20", "SSO Google (opsional)"],
            ["", "nodemailer", "10 (email reset kata sandi, opsional)"],
            ["", "cors, dotenv", "CORS & konfigurasi environment"],
            ["Database", "PostgreSQL", "18 (database biro_umum_db, port 5432)"],
            ["", "pgAdmin 4", "Administrasi database & pemberian peran admin"],
            ["Tooling", "nodemon", "Auto-restart backend saat pengembangan"],
        ]),
        h2("Struktur kode sumber"),
        table([40, 134], [
            ["Folder", "Isi"],
            ["backend/src/routes", "auth, dashboard, pemeliharaan, pengadaan, kendaraan, ruangRapat, maintenance, users"],
            ["backend/src/middleware", "auth (JWT & peran), maintenance, security (header, rate limit, batas SSE)"],
            ["backend/src", "prisma.js, validate.js, fileStorage.js, fileSignature.js, token.js, mailer.js, logger.js"],
            ["backend/prisma", "schema.prisma dan 24 migration (sumber kebenaran skema)"],
            ["backend/scripts", "db-verify.js (cek kolom & jumlah baris), cleanup-uploads.js (berkas yatim)"],
            ["backend/sql", "Script SQL manual untuk pgAdmin 4 (arsip pra-Prisma & sinkronisasi)"],
            ["frontend/src", "pages, components, context (AuthContext), live.js + hooks (useLive, SSE), utils"],
        ]),

        PageBreak(),
        h1("3. Lingkungan"),
        table([24, 70, 80], [
            ["Aspek", "Pengembangan (lokal)", "Produksi (disarankan)"],
            ["Frontend", "npm run dev (Vite, http://localhost:5173)",
             "npm run build, berkas dist/ disajikan web server/reverse proxy"],
            ["Backend", "npm run dev (nodemon, http://localhost:4000)",
             "npm start di bawah process manager (mis. PM2/NSSM) agar otomatis restart"],
            ["Database", "PostgreSQL 18 lokal (localhost:5432)",
             "Server PostgreSQL terpisah/terkelola dengan backup terjadwal"],
            ["Skema", "npx prisma migrate deploy", "npx prisma migrate deploy saat rilis"],
            ["Akses", "HTTP", "HTTPS melalui reverse proxy, TRUST_PROXY=true"],
            ["Berkas", "backend/uploads di disk lokal", "Disk persisten + backup, atau object storage (S3-compatible)"],
        ]),
        note("Catatan: platform serverless (mis. Vercel) tidak menyimpan berkas lokal secara permanen, sehingga "
             "backend sebaiknya dijalankan di server/VPS dengan disk persisten."),
        h1("4. Konfigurasi Environment (backend/.env)"),
        table([58, 16, 100], [
            ["Variabel", "Wajib", "Fungsi"],
            ["DATABASE_URL", "Ya", "Koneksi PostgreSQL (postgresql://user:pass@host:5432/biro_umum_db)"],
            ["JWT_SECRET", "Ya", "Kunci tanda tangan token, minimal 32 karakter (server menolak start bila kurang)"],
            ["JWT_EXPIRES_IN", "Tidak", "Masa berlaku token, default 8h"],
            ["FRONTEND_URL", "Ya", "Origin yang diizinkan CORS & dasar link reset/SSO"],
            ["PORT", "Tidak", "Port backend, default 4000"],
            ["TRUST_PROXY", "Tidak", "true bila di belakang reverse proxy agar IP klien terbaca benar"],
            ["PRISMA_LOG", "Tidak", "true untuk log peringatan Prisma"],
            ["GOOGLE_CLIENT_ID / SECRET / CALLBACK_URL", "Tidak", "Mengaktifkan login Google"],
            ["SMTP_HOST / PORT / USER / PASS, MAIL_FROM", "Tidak",
             "Mengirim email reset kata sandi; bila kosong permintaan masuk ke notifikasi admin"],
            ["VITE_API_URL (frontend)", "Tidak", "Alamat API untuk frontend, default http://localhost:4000/api"],
        ]),

        PageBreak(),
        h1("5. Database"),
        *bullets(
            "DBMS PostgreSQL 18, database `biro_umum_db`, skema `public`; 7 tabel inti + tabel riwayat "
            "migration Prisma (`_prisma_migrations`).",
            "Perubahan struktur **hanya** melalui migration Prisma (0001 s.d. 0024) agar Prisma dan pgAdmin 4 "
            "selalu sinkron. Cek sinkron: `npx prisma migrate status` dan `npx prisma migrate diff "
            "--from-schema-datasource ... --to-schema-datamodel ...` (read-only).",
            "Integritas dijaga di level database: UNIQUE (email, kode, plate, menu_key, service per tanggal), "
            "CHECK (kategori, status surat, jam & tanggal booking), foreign key dengan SET NULL/CASCADE, trigger "
            "updated_at & tanggal_selesai.",
            "Konkurensi booking ruang rapat memakai *advisory lock* per ruangan di dalam transaksi sehingga dua "
            "booking bersamaan tidak lolos cek bentrok.",
            "**Peringatan:** jangan pernah memakai DATABASE_URL produksi/utama sebagai "
            "`--shadow-database-url`; Prisma mengosongkan shadow database."),
        h1("6. Penyimpanan Berkas"),
        *bullets(
            "Berkas dikirim dari browser sebagai data URL Base64, divalidasi (tipe, ukuran, magic number), lalu "
            "disimpan ke `backend/uploads/<modul>/<tahun>/<bulan>/` dengan nama acak (timestamp + UUID). "
            "Ekstensi ditentukan dari tipe terverifikasi, bukan dari nama berkas.",
            "Isi berkas juga tersimpan di kolom `*_file_data` database untuk kompatibilitas; path disk tidak "
            "pernah dikirim ke klien.",
            "Foto kendaraan dikompres di browser (maks. 1600 px, JPEG kualitas 0.75) sebelum diunggah.",
            "Berkas yang tidak lagi direferensikan dapat dirapikan dengan `npm run uploads:cleanup` (laporan) "
            "atau `-- --apply` (dipindah ke uploads/_orphaned, tidak dihapus)."),
        h1("7. Jaringan & Port"),
        table([40, 60, 74], [
            ["Komponen", "Port / protokol", "Diakses oleh"],
            ["Frontend (dev)", "5173 / HTTP", "Browser pengguna"],
            ["Backend API", "4000 / HTTP(S), JSON + SSE", "Browser (origin FRONTEND_URL)"],
            ["PostgreSQL", "5432 / TCP", "Backend & pgAdmin 4 saja (jangan dibuka ke publik)"],
            ["Google OAuth", "443 / HTTPS keluar", "Backend (opsional)"],
            ["SMTP", "465 (SSL) atau 587 / keluar", "Backend (opsional)"],
        ]),

        PageBreak(),
        h1("8. Keamanan"),
        Diagram(92.7, 153.7, d_lapisan_keamanan),
        caption("Gambar 2. Lapisan pemeriksaan keamanan pada setiap request"),
        table([32, 142], [
            ["Kontrol", "Implementasi"],
            ["Header keamanan", "CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, "
             "Permissions-Policy, COOP/CORP; header X-Powered-By dimatikan."],
            ["CORS", "Hanya origin FRONTEND_URL; metode GET/POST/PUT/DELETE/OPTIONS."],
            ["Rate limit", "Global 180 request/menit per akun (per IP bila belum login); login 5/menit per "
             "IP+email dan 30/menit per IP; daftar 50/jam; lupa sandi 5/jam; reset 20/jam; koneksi SSE maks. "
             "200 per IP & 1000 total."],
            ["Autentikasi", "JWT HS256 berlaku 8 jam; peran & status aktif dibaca ulang dari database setiap "
             "request; akun yang di-ban langsung ditolak (kode ACCOUNT_BANNED) dan dikeluarkan dari sesi."],
            ["Kata sandi", "bcrypt cost 12; token reset acak 32 byte, disimpan sebagai hash SHA-256, berlaku "
             "1 jam, tidak pernah ditampilkan ke peminta publik."],
            ["Otorisasi", "RBAC per endpoint (requireRole) + aturan kepemilikan data PIC; menu disembunyikan di "
             "frontend."],
            ["Validasi input", "Validasi tipe, panjang, tanggal, nominal di backend (validate.js) dan frontend; "
             "body JSON maks. 25 MB."],
            ["Berkas", "Whitelist MIME + pemeriksaan magic number; nama berkas disanitasi; folder uploads tidak "
             "dipublikasikan; pratinjau lewat Blob URL."],
            ["Maintenance", "Menu dapat dikunci (HTTP 503) tanpa mematikan server."],
        ]),
        h1("9. Logging & Pemantauan"),
        *bullets(
            "Setiap request dicatat ke `backend/logs/app.log` dalam format JSON per baris: waktu, request_id, "
            "metode, path, status, durasi, user_id, peran.",
            "Error server dicatat lengkap (pesan, kode Prisma, stack) untuk pelacakan; setiap respons membawa "
            "header `X-Request-ID` untuk mencocokkan laporan pengguna dengan log.",
            "Endpoint `GET /api/health` untuk pemeriksaan hidup (uptime monitor); `npm run db:test` dan "
            "`npm run db:verify` untuk cek koneksi & struktur database.",
            "Disarankan: rotasi app.log (mis. logrotate/harian) agar ukuran berkas tidak terus membesar."),

        PageBreak(),
        h1("10. Backup & Pemulihan"),
        p("Data operasional berada di dua tempat: database PostgreSQL dan folder `backend/uploads/`. Keduanya "
          "harus dibackup bersamaan."),
        table([30, 100, 44], [
            ["Objek", "Cara backup", "Frekuensi disarankan"],
            ["Database", "pg_dump -Fc biro_umum_db > biro_umum_YYYYMMDD.dump (atau pgAdmin 4: Backup...)",
             "Harian + sebelum setiap migration/rilis"],
            ["Folder uploads", "Salin/arsipkan backend/uploads/ ke penyimpanan lain", "Harian"],
            ["Konfigurasi", "Simpan backend/.env di tempat aman (bukan di git)", "Setiap perubahan"],
            ["Kode sumber", "Repository git (commit & push rutin)", "Setiap perubahan"],
        ]),
        p("Pemulihan: buat database kosong, jalankan `pg_restore -d biro_umum_db berkas.dump`, kembalikan "
          "folder uploads, lalu verifikasi dengan `npx prisma migrate status` dan `npm run db:verify`. Simpan "
          "minimal 7 salinan harian dan uji pemulihan secara berkala."),
        h1("11. Prosedur Deployment"),
        *bullets(
            "1) Backup database dan folder uploads.",
            "2) Ambil kode terbaru, jalankan `npm install` di backend/ (otomatis `prisma generate`) dan "
            "frontend/.",
            "3) Terapkan skema: `npx prisma migrate deploy`; cek dengan `npx prisma migrate status`.",
            "4) Build frontend: `npm run build`, sajikan folder dist/ (fallback semua rute ke index.html).",
            "5) Restart backend (`npm start` via process manager); cek `GET /api/health`.",
            "6) Uji singkat: login, buka tiap menu, buat & batalkan satu booking uji.",
            "Database lama yang dibuat dari script pgAdmin: tandai baseline dengan "
            "`npx prisma migrate resolve --applied 0001_init` sebelum migrate deploy (lihat "
            "backend/docs/PRISMA_PRODUCTION.md)."),
        h1("12. Rekomendasi Pengembangan Infrastruktur"),
        *bullets(
            "Pasang reverse proxy (Nginx/IIS) dengan sertifikat TLS dan aktifkan TRUST_PROXY=true.",
            "Jadwalkan backup otomatis database + uploads dan simpan salinan di lokasi terpisah.",
            "Pindahkan berkas ke object storage bila backend dijalankan di lebih dari satu server; pindahkan "
            "rate limit ke Redis untuk multi-server.",
            "Tambahkan rotasi log dan pemantauan uptime pada /api/health.",
            "Batasi akses port 5432 hanya dari server aplikasi dan komputer admin (firewall)."),
    ]


DOKUMEN = {
    "aplikasi": ("Model_Aplikasi_Biro_Umum.pdf", "Model Aplikasi",
                 "Dokumen ini menjelaskan model aplikasi web internal Biro Umum & Rumah Tangga: tujuan sistem, "
                 "pengguna dan hak aksesnya, modul serta fitur, alur proses bisnis, struktur halaman, antarmuka "
                 "API, model data, dan aturan validasi. Seluruh isi disusun berdasarkan kode sumber aplikasi yang "
                 "berjalan saat ini.", isi_aplikasi),
    "infra": ("Model_Infrastruktur_Biro_Umum.pdf", "Model Infrastruktur",
              "Dokumen ini menjelaskan model infrastruktur aplikasi: topologi dan komponen sistem, teknologi yang "
              "digunakan, lingkungan pengembangan dan produksi, konfigurasi, database, penyimpanan berkas, "
              "jaringan, keamanan, pencatatan log, serta prosedur backup, pemulihan, dan deployment.", isi_infra),
}

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "_sumber")
    os.makedirs(out_dir, exist_ok=True)
    for key, (fname, judul, intro, body) in DOKUMEN.items():
        if which in ("all", key):
            path = os.path.join(out_dir, fname)
            build(path, judul, intro, body)
            print("ditulis:", path)
