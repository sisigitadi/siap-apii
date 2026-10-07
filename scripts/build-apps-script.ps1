# ============================================================================
# build-apps-script.ps1
# ============================================================================
# Menggabungkan seluruh file gas/*.gs + aset gambar (logo & stempel) menjadi
# DUA file siap-tempel ke Apps Script:
#   apps-script/Backend.gs   -> seluruh logika backend (fix namespace otomatis)
#   apps-script/Aset.gs      -> logo & stempel sebagai base64
#
# Cara pakai:  .\scripts\build-apps-script.ps1
# ===========================================================================

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

$srcDir = 'gas'
$outDir = 'apps-script'
$asetSrc = 'Dokumen Sumber'

if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

# ---------------------------------------------------------------------------
# 1) Backend.gs: gabungkan file .gs, lalu ganti pola namespace `Modul.fn(...)`
#    menjadi pemanggilan global `fn(...)`. Di Apps Script semua fungsi .gs
#    berbagi scope global, jadi `Auth.login` TIDAK valid - harus `login(...)`.
# ---------------------------------------------------------------------------
$order = @('00-Konfig', 'Utils', 'Database', 'Auth', 'Surat', 'Keuangan', 'Divisi', 'Code', '99-TemplateSurat')

# Daftar nama fungsi global. Hanya pemanggilan `Modul.fn(` yang diganti, agar
# komentar / teks biasa yang mengandung titik tidak ikut rusak.
$fnNames = @(
  'hashPassword','login','logout','verifySession','me','getListPengguna',
  'createPengguna','updatePengguna','getAuditLogs',
  'initSchema','readAll','findOne','findMany','insert','updateRow','deleteRow',
  'nextSequence',
  'uuid','audit','formatRupiah','formatTanggal','toRoman','sanitizeUser','getDashboard',
  'getListSurat','createSurat','updateSurat','submitSurat','approveSurat',
  'rejectSurat','verifySurat','getPublishedSurat',
  'getSaldo','getListKeuangan','createVoucher','verifyVoucherBendahara',
  'verifyVoucherKetum','rejectVoucher','buildVoucherNumber',
  'getListDivisi','createSubmission','updateSubmission','ajukanSubmission',
  'approveSubmission','rejectSubmission','buildTrackingId',
  'siapkanFolderPdf_','siapkanTemplateSurat_','generateTemplateSurat',
  'getLogoBlob_','getStempelBlob_','urlVerifikasiSurat_','parSurat_'
)
$fnPattern = ($fnNames | ForEach-Object { [regex]::Escape($_) }) -join '|'
# Cocokkan `Modul.fn` baik saat dipanggil (`Auth.login(`) maupun saat
# direferensikan sebagai nilai (`handler: Auth.login`). Negative-lookbehind
# [\w.] mencegah match di tengah identifier (mis. `visibleSurat.filter`),
# dan negative-lookahead [\w] mencegah match parsial (mis. `Database.gs`).
$nsPattern = "(?<![\w.])(?:Auth|Database|Utils|Surat|Keuangan|Divisi)\.($fnPattern)(?![\w])"

$sb = New-Object System.Text.StringBuilder
$totalReplaced = 0
foreach ($name in $order) {
  $path = Join-Path $srcDir "$name.gs"
  if (-not (Test-Path $path)) { throw "File tidak ditemukan: $path" }
  $content = Get-Content $path -Raw -Encoding UTF8
  # Ganti `Auth.login(` -> `login(`, `Database.findOne(` -> `findOne(`, dst.
  $content = [regex]::Replace($content, $nsPattern, '$1')
  $totalReplaced += [regex]::Matches($content, $nsPattern).Count # sudah 0 setelah replace
  [void]$sb.AppendLine("/" + "*" * 76)
  [void]$sb.AppendLine(" * $name.gs")
  [void]$sb.AppendLine(" " + "*" * 77 + "/")
  [void]$sb.AppendLine($content.TrimEnd())
  [void]$sb.AppendLine()
}
$backend = $sb.ToString()
$backendChars = $backend.Length

$outBackend = Join-Path $outDir 'Backend.gs'
Set-Content -Path $outBackend -Value $backend -Encoding UTF8 -NoNewline
Write-Output "Namespace terganti: $totalReplaced referensi (0 = semua bersih)"



# ---------------------------------------------------------------------------
# 2) Aset.gs: encode logo & stempel sebagai base64. Diambil dari Dokumen Sumber
#    dan di-resize ke resolusi cetak yang cukup (lebar 360px / 450px @300dpi).
# ---------------------------------------------------------------------------
Add-Type -AssemblyName System.Drawing

function Convert-ImageToBase64($srcPath, $width, $asJpeg, $flattenWhite) {
  $img = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath).Path)
  try {
    $ratio = $width / $img.Width
    $h = [int]([Math]::Round($img.Height * $ratio))
    $bmp = New-Object System.Drawing.Bitmap($width, $h)
    try {
      $bmp.SetResolution(300, 300)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        # Stempel asli transparan (32bpp ARGB) menghasilkan PNG sangat besar.
        # Karena dokumen berlatar putih, flatten ke putih lalu simpan JPEG.
        if ($flattenWhite) { $g.Clear([System.Drawing.Color]::White) }
        $g.DrawImage($img, 0, 0, $width, $h)
      } finally { $g.Dispose() }
      $ms = New-Object System.IO.MemoryStream
      try {
        if ($asJpeg) {
          $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
                   Where-Object { $_.MimeType -eq 'image/jpeg' }
          $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
          $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
            [System.Drawing.Imaging.Encoder]::Quality, [long]88)
          $bmp.Save($ms, $codec, $ep)
        } else {
          $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        return [Convert]::ToBase64String($ms.ToArray())
      } finally { $ms.Dispose() }
    } finally { $bmp.Dispose() }
  } finally { $img.Dispose() }
}

$logoPath = Join-Path $asetSrc 'Logo DPW Jabodetabek 1.jpg'
$stempelPath = Join-Path $asetSrc 'Stempel APII Jabo.png'
foreach ($p in @($logoPath, $stempelPath)) {
  if (-not (Test-Path $p)) { throw "Aset tidak ditemukan: $p" }
}

# Logo: 300px JPEG (sudah tanpa transparan). Stempel: 400px JPEG flatten putih.
$logoB64 = Convert-ImageToBase64 $logoPath 300 $true $false
$stempelB64 = Convert-ImageToBase64 $stempelPath 400 $true $true

$asetLogo = @"
/**
 * ============================================================================
 * AsetLogo.gs - Logo Lembaga (jangan diedit manual)
 * ============================================================================
 * Dibangkitkan oleh scripts/build-apps-script.ps1 dari:
 *   Dokumen Sumber/Logo DPW Jabodetabek 1.jpg  (300px JPEG)
 * Dipakai oleh 99-TemplateSurat.gs (getLogoBlob_) untuk kop surat.
 * ==========================================================================*/

var LOGO_BASE64 = '$logoB64';
"@

$asetStempel = @"
/**
 * ============================================================================
 * AsetStempel.gs - Stempel Resmi (jangan diedit manual)
 * ============================================================================
 * Dibangkitkan oleh scripts/build-apps-script.ps1 dari:
 *   Dokumen Sumber/Stempel APII Jabo.png  (400px JPEG, latar putih)
 * Stempel asli transparan; karena dokumen berlatar putih, dirender ke JPEG
 * agar ukuran base64 jauh lebih kecil. Dipakai oleh getStempelBlob_().
 * ==========================================================================*/

var STEMPEL_BASE64 = '$stempelB64';
"@

# Pecah aset ke 2 file agar masing-masing jauh di bawah batas ukuran file AS.
$outLogo = Join-Path $outDir 'AsetLogo.gs'
$outStempel = Join-Path $outDir 'AsetStempel.gs'
Set-Content -Path $outLogo -Value $asetLogo -Encoding UTF8 -NoNewline
Set-Content -Path $outStempel -Value $asetStempel -Encoding UTF8 -NoNewline

# ---------------------------------------------------------------------------
# 3) Ringkasan & cek kasar.
# ---------------------------------------------------------------------------
$logoChars = $asetLogo.Length
$stempelChars = $asetStempel.Length
Write-Output "Backend.gs     : $backendChars karakter"
Write-Output "AsetLogo.gs    : $logoChars karakter"
Write-Output "AsetStempel.gs : $stempelChars karakter"
Write-Output "Total          : $($backendChars + $logoChars + $stempelChars) karakter"
foreach ($c in @(@($backendChars, 'Backend.gs'), @($logoChars, 'AsetLogo.gs'), @($stempelChars, 'AsetStempel.gs'))) {
  if ($c[0] -gt 90000) { Write-Warning "$($c[1]) mendekati batas ukuran file Apps Script!" }
}
Write-Output "Selesai -> $outBackend , $outLogo , $outStempel"
