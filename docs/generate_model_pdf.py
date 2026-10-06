"""Generate Aplikasi Model & Infrastruktur Model PDFs (format diagram SPBE)."""
import sys
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.utils import simpleSplit

W, H = 1120, 630
OUT = sys.argv[1]
# argv[2] (opsional): nomor halaman pertama, dipakai saat digabung sebagai lampiran
PAGE0 = int(sys.argv[2]) if len(sys.argv) > 2 else 1
FONT, BOLD = "Helvetica", "Helvetica-Bold"
FS, LH, HEAD = 6.6, 10.5, 14
LINE = HexColor("#222222")
MUTED = HexColor("#444444")


def Y(t):
    return H - t


class Box:
    def __init__(self, x, y, w, h):
        self.x, self.y, self.w, self.h = x, y, w, h  # y = top (from top)

    @property
    def l(self): return (self.x, self.y + self.h / 2)
    @property
    def r(self): return (self.x + self.w, self.y + self.h / 2)
    @property
    def t(self): return (self.x + self.w / 2, self.y)
    @property
    def b(self): return (self.x + self.w / 2, self.y + self.h)
    def rat(self, f): return (self.x + self.w, self.y + self.h * f)
    def lat(self, f): return (self.x, self.y + self.h * f)


def box(c, x, y, w, title, items, min_h=0):
    """items: str -> bullet 'o'; (str, True/False) -> checkbox checked/unchecked."""
    lines = []
    for it in items:
        text, state = (it, None) if isinstance(it, str) else it
        wrapped = simpleSplit(text, FONT, FS, w - 20)
        for i, ln in enumerate(wrapped):
            lines.append((ln, state if i == 0 else "cont"))
    h = max(HEAD + len(lines) * LH + 6, min_h)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.setFillColor(white)
    c.rect(x, Y(y + h), w, h, stroke=1, fill=1)
    c.line(x, Y(y + HEAD), x + w, Y(y + HEAD))
    c.setFillColor(black)
    c.setFont(BOLD, FS)
    for i, tl in enumerate(simpleSplit(title, BOLD, FS, w - 6)[:1]):
        c.drawCentredString(x + w / 2, Y(y + 9.8), tl)
    c.setFont(FONT, FS)
    ty = y + HEAD + 8
    for ln, state in lines:
        mx = x + 6
        if state is None:
            c.circle(mx + 2, Y(ty - 2.3), 1.7, stroke=1, fill=0)
        elif state is True:
            c.rect(mx, Y(ty - 0.3), 4.4, 4.4, stroke=1, fill=1)
        elif state is False:
            c.rect(mx, Y(ty - 0.3), 4.4, 4.4, stroke=1, fill=0)
        c.drawString(x + 14, Y(ty), ln)
        ty += LH
    return Box(x, y, w, h)


def arrow(c, pts):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    p = c.beginPath()
    p.moveTo(pts[0][0], Y(pts[0][1]))
    for x, y in pts[1:]:
        p.lineTo(x, Y(y))
    c.drawPath(p, stroke=1, fill=0)
    (x1, y1), (x2, y2) = pts[-2], pts[-1]
    c.setFillColor(LINE)
    ah = c.beginPath()
    if x2 != x1:
        d = 1 if x2 > x1 else -1
        ah.moveTo(x2, Y(y2)); ah.lineTo(x2 - 5 * d, Y(y2) + 2.6); ah.lineTo(x2 - 5 * d, Y(y2) - 2.6)
    else:
        d = 1 if y2 > y1 else -1
        ah.moveTo(x2, Y(y2)); ah.lineTo(x2 - 2.6, Y(y2 - 5 * d)); ah.lineTo(x2 + 2.6, Y(y2 - 5 * d))
    ah.close()
    c.drawPath(ah, stroke=0, fill=1)


def elbow(c, a, b, mid=None):
    (x1, y1), (x2, y2) = a, b
    if abs(y1 - y2) < 0.5:
        arrow(c, [a, b]); return
    xm = mid if mid is not None else (x1 + x2) / 2
    arrow(c, [a, (xm, y1), (xm, y2), b])


def label(c, x, y, text, size=6.2, bold=True):
    c.setFillColor(black)
    c.setFont(BOLD if bold else FONT, size)
    c.drawString(x, Y(y), text)


def hexagon(c, cx, cy, r, color):
    import math
    c.setFillColor(color)
    p = c.beginPath()
    for i in range(6):
        a = math.radians(60 * i)
        px, py = cx + r * math.cos(a), cy + r * math.sin(a)
        (p.moveTo if i == 0 else p.lineTo)(px, py)
    p.close()
    c.drawPath(p, stroke=0, fill=1)


def frame(c, title, page):
    c.setFillColor(white)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(black)
    c.setFont(BOLD, 20)
    c.drawString(40, Y(52), title)
    tw = c.stringWidth(title, BOLD, 20)
    c.setLineWidth(1.2)
    c.setStrokeColor(black)
    c.line(40, Y(56), 40 + tw, Y(56))
    c.setFont(FONT, 7)
    c.setFillColor(MUTED)
    c.drawString(40, 18, ("Lampiran  |  " if PAGE0 > 1 else "") + "Aplikasi Layanan Biro Umum & Rumah Tangga  |  Kementerian Ketenagakerjaan")
    hexagon(c, W - 58, 118, 25, HexColor("#D48BE0"))
    hexagon(c, W - 72, 66, 29, HexColor("#EE4435"))
    c.setFillColor(MUTED)
    c.setFont(FONT, 10)
    c.drawRightString(W - 18, 16, ("Halaman " if PAGE0 > 1 else "") + str(PAGE0 + page - 1))


def paragraph(c, x, y, w, text, size=10.5, lead=15):
    c.setFont(FONT, size)
    c.setFillColor(black)
    for ln in simpleSplit(text, FONT, size, w):
        c.drawString(x, Y(y), ln)
        y += lead
    return y


# ------------------------------------------------------------------ APLIKASI
def aplikasi_model(c):
    frame(c, "Aplikasi Model", 1)
    top = 96
    # section dividers
    c.setStrokeColor(HexColor("#999999")); c.setLineWidth(0.6)
    c.line(186, Y(top - 8), 186, Y(560))
    c.line(800, Y(top - 8), 800, Y(560))
    c.line(186, Y(440), 1060, Y(440))
    label(c, 30, top, "LAYANAN")
    label(c, 195, top, "APLIKASI")
    label(c, 810, top, "INFRASTRUKTUR")
    label(c, 195, 456, "DATA")
    label(c, 810, 456, "KEAMANAN")

    # LAYANAN
    L = 30; LW = 145
    kat = box(c, L, 110, LW, "KATEGORI LAYANAN", [
        ("Layanan Publik", True), ("Layanan Administrasi Pemerintahan", True)])
    pub = box(c, L, 176, LW, "KATEGORI PUBLIK", [
        "Informasi jadwal & ketersediaan ruang rapat (landing page)",
        "Layar kiosk jadwal rapat (/jadwal-rapat)"])
    adm = box(c, L, 262, LW, "KATEGORI ADM. PEMERINTAH", [
        "Pemeliharaan fasilitas", "Pengadaan barang/jasa",
        "Kendaraan dinas (aset BMN)", "Booking ruang rapat",
        "Manajemen akun & akses", "Mode maintenance menu"])

    # APLIKASI col A
    A = 196; AW = 138
    pengguna = box(c, A, 110, AW, "PENGGUNA PUBLIK", [
        "Pengunjung landing page", "Layar kiosk ruang rapat", "Tanpa login (read-only)"])
    pse = box(c, A, 196, AW, "PEMANFAATAN PSE", [("Sudah", False), ("Belum", False)])
    user = box(c, A, 250, AW, "DAFTAR USER PEMERINTAH", [
        "Admin", "Kabag", "PIC", "Karyawan"])

    # col B
    B = 350; BW = 128
    ppub = box(c, B, 110, BW, "PLATFORM PUBLIK", [
        ("Web based", True), ("Mobile", False), ("On-premise", False)])
    ks = box(c, B, 196, BW, "KODE SUMBER", [("Tertutup", True), ("Terbuka", False)])
    padm = box(c, B, 262, BW, "PLATFORM ADM. PEMERINTAH", [
        ("Web based (responsif PC/HP)", True), ("Mobile", False), ("On-premise", False)])

    # col C
    C = 494; CW = 132
    arsi = box(c, C, 130, CW, "MODEL ARSITEKTUR", [
        ("Monolith (SPA + REST API)", True), ("SOA", False), ("Microservices", False)])
    bhs = box(c, C, 214, CW, "BAHASA PEMROGRAMAN", [
        ("Python", False), ("C#/C++", False), ("JavaScript (Node.js)", True),
        ("PHP", False), ("Go (Golang)", False), ("Java", False), ("Lainnya: SQL", True)])

    # col D
    D = 644; DW = 142
    integ = box(c, D, 130, DW, "METODE INTEGRASI", [
        ("Direct API (REST JSON + SSE)", True), ("SPLP", False), ("Tidak terintegrasi", False)])
    fw = box(c, D, 214, DW, "FRAMEWORK", [
        ("CodeIgniter", False), ("Laravel", False), ("AngularJS", False),
        ("ReactJS 18 (Vite)", True), ("Flutter", False), ("Django", False),
        ("Lainnya: Express.js 4, Prisma ORM", True)])

    # INFRASTRUKTUR
    I = 812
    dbms = box(c, I, 200, 118, "DB MANAGEMENT SYSTEM", [
        ("Relational DBMS (PostgreSQL)", True), ("Document DBMS (JSON, XML, MongoDB)", False),
        ("Columnar DBMS", False)])
    sa = box(c, 945, 110, 150, "SERVER APLIKASI", [
        ("On-premise", False), ("Server internal", False), ("Server PDN", False),
        ("Third party cloud", False),
        "Backend Node.js/Express :4000", "Frontend statis (build Vite)"])
    sd = box(c, 945, 290, 150, "SERVER DATA", [
        ("On-premise", False), ("Server internal", False), ("Server PDN", False),
        ("Third party cloud", False),
        "PostgreSQL :5432 (biro_umum_db)", "Berkas: backend/uploads"])

    # DATA
    di = box(c, 196, 468, 150, "DATA INPUT DIRECT", [
        "Permintaan pemeliharaan & pengadaan", "Data kendaraan & service",
        "Booking ruang rapat", "Akun pengguna (registrasi)"])
    dint = box(c, 196, 540, 150, "DATA INPUT INTEGRASI", [
        "Tidak ada (login hanya email & kata sandi)"])
    dp = box(c, 380, 468, 170, "DATA PRODUK LAYANAN", [
        "Dokumen HPS, invoice & BAST (PDF)", "Foto kendaraan, BPKB, STNK",
        "Invoice service kendaraan", "Jadwal ruang rapat & nomor surat"])
    pd = box(c, 585, 468, 150, "PUBLIKASI DATA", [
        ("Direct download (export Excel)", True), ("Infografis", False),
        ("Dashboard", True), "Jadwal rapat publik (real-time)"])

    kam = box(c, 812, 468, 200, "PERANGKAT KEAMANAN", [
        "Firewall / reverse proxy HTTPS (disarankan)",
        "Enkripsi: hash bcrypt, JWT HS256, TLS",
        "Manajemen identitas & akses: RBAC 4 role",
        "Rate limit login & API, CORS, header CSP",
        "Monitoring: log aplikasi (logs/app.log)"])

    # ARROWS -- layanan -> aplikasi
    jx = 184
    for b_ in (kat, pub, adm):
        c.line(b_.r[0], Y(b_.r[1]), jx, Y(b_.r[1]))
    c.line(jx, Y(kat.r[1]), jx, Y(adm.r[1]))
    arrow(c, [(jx, pse.l[1]), pse.l])
    elbow(c, pengguna.r, ppub.l)
    elbow(c, user.r, padm.l)
    arrow(c, [ppub.b, ks.t])
    arrow(c, [padm.t, ks.b])
    arrow(c, [pse.r, ks.l])
    elbow(c, ks.r, arsi.l, mid=486)
    elbow(c, ks.r, bhs.l, mid=486)
    arrow(c, [arsi.r, integ.l])
    arrow(c, [bhs.r, fw.l])
    elbow(c, integ.r, dbms.lat(0.3), mid=796)
    elbow(c, fw.r, dbms.lat(0.7), mid=796)
    arrow(c, [(dbms.t[0], dbms.y), (dbms.t[0], sa.y + 30), (sa.x, sa.y + 30)])
    arrow(c, [(dbms.b[0], dbms.b[1]), (dbms.b[0], sd.y + 30), (sd.x, sd.y + 30)])
    # data flow
    arrow(c, [di.r, (dp.x, di.r[1])])
    elbow(c, dint.r, dp.lat(0.8), mid=364)
    arrow(c, [dp.r, (pd.x, dp.r[1])])

    c.setFont(FONT, 6.4); c.setFillColor(MUTED)
    c.drawString(196, 30, "Keterangan:  kotak terisi = digunakan  |  kotak kosong = tidak digunakan / belum ditetapkan  |  o = rincian komponen")


# ------------------------------------------------------------ INFRASTRUKTUR
def infra_server(c):
    frame(c, "Infrastruktur Model", 1)
    y = paragraph(c, 40, 96, 900,
        "Infrastruktur Model, menjelaskan mengenai kerangka kerja yang mencakup semua komponen teknologi dan "
        "sumber daya yang diperlukan untuk mendukung pelaksanaan layanan Aplikasi Layanan Biro Umum & Rumah Tangga "
        "secara digital.")
    c.setFont(FONT, 11.5)
    c.drawString(40, Y(y + 10), "a. Model Infrastruktur Pusat Data/Pusat Komputasi/Komputasi Awan/Server")
    label(c, 60, y + 32, "INFRASTRUCTURE MODEL - SERVER")
    t = y + 42
    adm = box(c, 60, t, 200, "LAYANAN ADM. PEMERINTAH", [
        "Layanan pemeliharaan fasilitas", "Layanan pengadaan barang/jasa",
        "Layanan kendaraan dinas (BMN)", "Layanan booking ruang rapat",
        "Layanan akun & akses pengguna"])
    pub = box(c, 60, adm.y + adm.h + 8, 200, "LAYANAN PUBLIK", [
        "Landing page jadwal ruang rapat", "Layar kiosk jadwal rapat (read-only)"])
    ds = box(c, 320, t + 22, 210, "DATA YANG DISIMPAN", [
        "DB. Pengguna (users)", "DB. Pemeliharaan", "DB. Pengadaan",
        "DB. Kendaraan & riwayat service", "DB. Ruang rapat (booking)",
        "DB. Mode maintenance", "Berkas upload (PDF & foto)", "Log aplikasi (app.log)"])
    ap = box(c, 590, t + 22, 250, "APLIKASI YANG DIJALANKAN", [
        "Aplikasi Layanan Biro Umum (frontend React SPA)",
        "Backend REST API Node.js + Express (:4000)",
        "Prisma ORM (query & migrasi database)",
        "PostgreSQL (biro_umum_db, :5432)",
        "pgAdmin 4 (administrasi database)"])
    jx = 290
    c.setStrokeColor(LINE); c.setLineWidth(0.8)
    c.line(adm.r[0], Y(adm.r[1]), jx, Y(adm.r[1]))
    c.line(pub.r[0], Y(pub.r[1]), jx, Y(pub.r[1]))
    c.line(jx, Y(adm.r[1]), jx, Y(pub.r[1]))
    arrow(c, [(jx, ds.l[1]), ds.l])
    arrow(c, [ds.r, (ap.x, ds.r[1])])
    bottom = max(pub.y + pub.h, ds.y + ds.h, ap.y + ap.h) + 12
    box(c, 60, bottom, 780, "DUKUNGAN KEAMANAN", [
        "Operating system server diperbarui berkala (patch keamanan)",
        "Web security: header CSP & X-Frame-Options, CORS dikunci ke FRONTEND_URL, rate limiting, validasi input & tanda tangan berkas",
        "Firewall: hanya port HTTPS (443) yang dibuka ke pengguna; port 4000 & 5432 hanya jaringan internal",
        "VPN untuk akses administrasi server & database dari luar kantor (disarankan)",
        "Autentikasi JWT HS256 + role (RBAC), password di-hash bcrypt, secret di .env (tidak masuk repository)"])
    c.setFont(FONT, 7.5); c.setFillColor(MUTED)
    c.drawCentredString(450, 44, "Format Surat Edaran Bersama (SEB) 3 K/L")


def infra_network(c):
    frame(c, "Infrastruktur Model", 2)
    c.setFont(FONT, 11.5); c.setFillColor(black)
    c.drawString(40, Y(92), "b. Model Infrastruktur Jaringan")
    label(c, 60, 114, "INFRASTRUCTURE MODEL - JARINGAN")
    t = 124
    eko = box(c, 60, t, 200, "EKOSISTEM YANG DIDUKUNG", [
        "Jaringan intra kantor (LAN/Wi-Fi)", "Internet (HTTPS)",
        "Data center / server aplikasi instansi", "Layanan eksternal: SMTP (opsional)"])
    awal = box(c, 300, t, 200, "POIN AWAL", [
        "Browser pegawai (PC / HP)", "Layar kiosk dekat ruang rapat",
        "Pengunjung landing page", "Akses poin: Wi-Fi / LAN kantor"])
    akhir = box(c, 540, t, 220, "POIN AKHIR", [
        "Data center: server aplikasi (frontend + API :4000)",
        "Server database PostgreSQL (:5432)",
        "Penyimpanan berkas backend/uploads",
        "Server SMTP (opsional)"])
    arrow(c, [eko.r, (awal.x, eko.r[1])])
    arrow(c, [awal.r, (akhir.x, awal.r[1])])
    nb = max(eko.y + eko.h, awal.y + awal.h, akhir.y + akhir.h) + 12
    box(c, 60, nb, 700, "DUKUNGAN KEAMANAN", [
        "Firewall (hanya port 443 terbuka untuk pengguna)",
        "Rate limiting aplikasi: 5 percobaan login/menit/IP, 180 request/menit (IDS jaringan disarankan)",
        "Enkripsi lalu lintas HTTPS/TLS melalui reverse proxy",
        "Autentikasi: email & password + JWT"])

    c.setFont(FONT, 11.5); c.setFillColor(black)
    c.drawString(40, Y(300), "c. Model Infrastruktur Sistem Penghubung Layanan")
    label(c, 60, 322, "INFRASTRUCTURE MODEL - SISTEM PENGHUBUNG")
    t = 332
    get = box(c, 60, t, 170, "GET APP", [
        "Frontend React SPA (browser)", "Halaman publik & kiosk", "Halaman reset kata sandi"])
    gw = box(c, 270, t, 200, "API GATEWAY PROTOCOL", [
        "Transport Layer Security (HTTPS)", "Otorisasi: token JWT Bearer + role",
        "REST JSON /api/* & SSE real-time", "Batas ukuran body & rate limit"])
    portal = box(c, 510, t, 150, "PORTAL PENGEMBANG", [
        ("Ada", False), ("Tidak ada", True)])
    post = box(c, 700, t, 200, "POST APP", [
        "Backend API Express (8 modul route)", "Database PostgreSQL via Prisma",
        "Server SMTP (email reset password)"])
    arrow(c, [get.r, (gw.x, get.r[1])])
    elbow(c, gw.r, portal.l)
    elbow(c, portal.r, post.l)


if OUT.endswith("aplikasi.pdf"):
    cv = canvas.Canvas(OUT, pagesize=(W, H))
    cv.setTitle("Aplikasi Model - Biro Umum & Rumah Tangga")
    aplikasi_model(cv); cv.showPage(); cv.save()
else:
    cv = canvas.Canvas(OUT, pagesize=(W, H))
    cv.setTitle("Infrastruktur Model - Biro Umum & Rumah Tangga")
    infra_server(cv); cv.showPage()
    infra_network(cv); cv.showPage(); cv.save()
