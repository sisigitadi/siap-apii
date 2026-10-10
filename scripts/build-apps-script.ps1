# ============================================================================
# build-apps-script.ps1
# ============================================================================
# Menggabungkan tiap file gas/*.gs + aset gambar (logo & stempel) menjadi
# file-file siap-tempel ke Apps Script (semua JANGAN diedit manual):
#   apps-script/<Modul>.gs -> satu file per modul backend (fix namespace otomatis)
#   apps-script/AsetLogo.gs / AsetStempel.gs -> logo & stempel sebagai base64
#
# Mengapa per-modul, bukan satu Backend.gs: Apps Script membatasi ukuran tiap
# file .gs; backend gabungan sudah tembus 250.000 karakter. Tiap modul sumber
# diemit apa adanya (urutan tetap, logika tetap satu scope global), jadi
# pemecahan ini murni pembagian file tanpa perubahan perilaku.
#
# Cara pakai:  .\scripts\build-apps-script.ps1
# ===========================================================================

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

$srcDir = 'gas'
$outDir = 'apps-script'
$asetSrc = 'Dokumen Sumber'

if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

# File .gs / .json yang boleh ada di apps-script setelah build. Yang lain
# (termasuk Backend.gs peninggalan build lama) dihapus agar tidak ada file basi
# terbawa saat seluruh folder diunggah ke editor Apps Script.
# Versi.gs = berkas versi bundel yang dilaporkan endpoint `ping`; dihasilkan
# langkah 2c di bawah (bukan dari gas/), jadi ikut dipertahankan.
$keepFiles = @('appsscript.json', 'AsetLogo.gs', 'AsetStempel.gs', 'Versi.gs')

# ---------------------------------------------------------------------------
# 0) Pra-pemeriksaan: setiap `handler: Modul.fn` di tabel ROUTES harus terdaftar
#    di daftar putih di bawah. Tanpa ini, build gagal setengah jalan dengan
#    pesan "referensi namespace yang belum diganti" (penyebab silent failure
#    lampau: route loginDemo hilang dari bundle produksi).
# ---------------------------------------------------------------------------
$check = Start-Process -FilePath 'node' -ArgumentList 'scripts/validate-routes-whitelist.mjs' -NoNewWindow -Wait -PassThru
if ($check.ExitCode -ne 0) {
  Write-Host 'PRA-PERIKSAAN ROUTES GAGAL: perbaiki daftar putih $fnNames sebelum build.' -ForegroundColor Red
  exit 1
}

# ---------------------------------------------------------------------------
# 1) Modul backend: tiap file gas/*.gs diemit ke apps-script/<Modul>.gs dengan
#    pola namespace `Modul.fn(...)` diganti menjadi pemanggilan global `fn(...)`.
#    Di Apps Script semua fungsi .gs berbagi scope global, jadi `Auth.login`
#    TIDAK valid - harus `login(...)`.
# ---------------------------------------------------------------------------
# src = nama file sumber di gas/ (tanpa .gs); out = nama file output.
# 99-TemplateSurat diberi nama TemplateSuratDocs.gs agar tidak tabrakan dengan
# TemplateSurat.gs (master template) - isinya generator Google Docs + Drive.
$order = @(
  @{ src = '00-Konfig';        out = 'Konfig.gs' },
  @{ src = 'Utils';            out = 'Utils.gs' },
  @{ src = 'Editorial';        out = 'Editorial.gs' },
  @{ src = 'Pengaturan';       out = 'Pengaturan.gs' },
  @{ src = 'Database';         out = 'Database.gs' },
  @{ src = 'Auth';             out = 'Auth.gs' },
  @{ src = 'Surat';            out = 'Surat.gs' },
  @{ src = 'Keuangan';         out = 'Keuangan.gs' },
  @{ src = 'Divisi';           out = 'Divisi.gs' },
  @{ src = 'TemplateSurat';    out = 'TemplateSurat.gs' },
  @{ src = '99-TemplateSurat'; out = 'TemplateSuratDocs.gs' },
  @{ src = 'Visitor';          out = 'Visitor.gs' },
  @{ src = 'Code';             out = 'Code.gs' }
)

# Daftar nama fungsi global. Hanya pemanggilan `Modul.fn(` yang diganti, agar
# komentar / teks biasa yang mengandung titik tidak ikut rusak.
$fnNames = @(
  'hashPassword','login','loginDemo','logout','verifySession','me','getListPengguna',
  'createPengguna','updatePengguna','getAuditLogs',
  'registerAnggota','getListPendaftar','verifyPendaftarSekretaris','approvePendaftarKetum','rejectPendaftar',
  'exportPendaftar','saveUploadToDrive_',
  'initSchema','readAll','findOne','findMany','insert','updateRow','deleteRow',
  'nextSequence','seedDefaultAccounts_','seedDefaultSettings_',
  'uuid','audit','formatRupiah','formatTanggal','toRoman','sanitizeUser','getDashboard',
  'terbilang','getSettingValue_','setSettingValue_','getSettings','saveSettings','getPublicSettings','uploadKopImage','testDriveStorage',
  'defaultEditorialContent_','normalizeEditorialContent_','getEditorialContent_','editorialStr_','editorialUrl_','editorialBool_',
  'editorialChangedSections_','editorialHistoryRows_','editorialHistoryList_','recordEditorialRevision_',
  'editorialFmtStamp_',
  'trimEditorialHistory_','getEditorialRevision_','editorialActionOf_',
  'editorialExportFilename_','editorialCounts_','editorialExportFile_','parseEditorialImport_',
  'getEditorialHistory','getEditorialRevision','restoreEditorialRevision',
  'exportEditorialContent','importEditorialContent',
  'escHtml_',
  'createDriveFolder','moveDriveFolder','resetDriveStorage',
  'getListSurat','createSurat','updateSurat','submitSurat','approveSurat',
  'rejectSurat','verifySurat','getPublishedSurat','reserveLetterNumber','getLetterTypesMap_',
  'getSaldo','getListKeuangan','createVoucher','updateVoucherReceipt','verifyVoucherBendahara',
  'verifyVoucherKetum','rejectVoucher','buildVoucherNumber','getAccountLabels_','getAccounts','saveAccount','deleteAccount','getPublicAccounts',
  'getListDivisi','createSubmission','updateSubmission','ajukanSubmission',
  'approveSubmission','rejectSubmission','startExecution','submitLPJ','buildTrackingId',
  'siapkanFolderPdf_','siapkanTemplateSurat_','generateTemplateSurat',
  'getLogoBlob_','getStempelBlob_','urlVerifikasiSurat_','parSurat_',
  # Template surat (TemplateSurat.gs)
  'getLetterTemplates','saveLetterTemplate','deleteLetterTemplate','getDefaultTemplate_',
  'siapkanFolderTemplatePdf_','defaultTemplateFields_','validateTemplateFields_',
  'renderTemplatePdf_','validasiTemplateId_','kopSettingT_','tulisKopSuratT_',
  'tulisFooterSuratT_','tulisBlokT_','tulisBlokTtdT_','parSuratT_',
  # Pengunjung (Visitor.gs)
  'trackVisitor','getVisitors','detectDevice_','detectOS_','detectBrowser_',
  # Router & RBAC per-aksi (Code.gs)
  'getPermissionsMap','resetUserPermissions','setup','seedDemoUsers',
  'roleDefaultPermissions_','effectivePermissions_','hasPermission_'
)
$fnPattern = ($fnNames | ForEach-Object { [regex]::Escape($_) }) -join '|'
# Cocokkan `Modul.fn` baik saat dipanggil (`Auth.login(`) maupun saat
# direferensikan sebagai nilai (`handler: Auth.login`). Negative-lookbehind
# [\w.] mencegah match di tengah identifier (mis. `visibleSurat.filter`),
# dan negative-lookahead [\w] mencegah match parsial (mis. `Database.gs`).
$nsPattern = "(?<![\w.])(?:Auth|Database|Utils|Surat|Keuangan|Divisi|Visitor|Editorial|Pengaturan)\.($fnPattern)(?![\w])"

$totalReplaced = 0
$sizes = @{}
foreach ($entry in $order) {
  $path = Join-Path $srcDir ($entry.src + '.gs')
  if (-not (Test-Path $path)) { throw "File tidak ditemukan: $path" }
  $content = Get-Content $path -Raw -Encoding UTF8
  # Hitung sebelum diganti
  $totalReplaced += [regex]::Matches($content, $nsPattern).Count
  # Ganti `Auth.login(` -> `login(`, `Database.findOne(` -> `findOne(`, dst.
  $content = [regex]::Replace($content, $nsPattern, '$1')
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine('/' + '*' * 76)
  [void]$sb.AppendLine(' * ' + $entry.out + ' - dibangkitkan otomatis; JANGAN diedit manual.')
  [void]$sb.AppendLine(' * Sumber: ' + $srcDir + '/' + $entry.src + '.gs (scripts/build-apps-script.ps1)')
  [void]$sb.AppendLine(' ' + '*' * 77 + '/')
  [void]$sb.AppendLine($content.TrimEnd())
  [void]$sb.AppendLine()
  $out = Join-Path $outDir $entry.out
  Set-Content -Path $out -Value $sb.ToString() -Encoding UTF8 -NoNewline
  $sizes[$entry.out] = $sb.ToString().Length
  $keepFiles += $entry.out
}

# Verifikasi tidak ada namespace tertinggal (kecuali referensi file *.gs).
# Hanya PEMANGGILAN `Modul.fn(` dan referensi handler `handler: Modul.fn` yang
# diperiksa, agar komentar/teks biasa yang menyebut namespace (mis. komentar
# "pengganti Auth.esc sisi frontend") tidak memicu alarm palsu.
$allBackend = ($order | ForEach-Object { Get-Content (Join-Path $outDir $_.out) -Raw -Encoding UTF8 }) -join "`r`n"
$unreplaced = @(
  [regex]::Matches($allBackend, '(?<![\w.])(?:Auth|Database|Utils|Surat|Keuangan|Divisi|Visitor|Editorial|Pengaturan)\.(?!gs\b)[a-zA-Z0-9_]+\s*\(')
) + @(
  [regex]::Matches($allBackend, 'handler:\s*(?:Auth|Database|Utils|Surat|Keuangan|Divisi|Visitor|Editorial|Pengaturan)\.[a-zA-Z0-9_]+')
)
if ($unreplaced.Count -gt 0) {
  $bad = ($unreplaced | ForEach-Object { $_.Value } | Select-Object -Unique) -join ', '
  throw "Ditemukan referensi namespace yang belum diganti di apps-script/*.gs: $bad"
}

Write-Output "Namespace terganti: $totalReplaced referensi (semua bersih, 0 namespace tertinggal)"




# ---------------------------------------------------------------------------
# 1b) Buang output lama yang tak lagi dihasilkan build. Backend.gs peninggalan
#     build sebelumnya HARUS dihapus: isinya kini tersebar di beberapa file,
#     dan bila tetap ada, fungsi ganda akan membuat editor Apps Script
#     menggunakan salinan yang usang (atau menolak unggahan).
# ---------------------------------------------------------------------------
foreach ($old in (Get-ChildItem -Path $outDir -File | Where-Object { $_.Name -notin $keepFiles })) {
  if ($old.Name -eq 'Backend.gs') {
    Write-Warning 'Menghapus apps-script/Backend.gs (lama) - kini tiap modul punya file .gs sendiri.'
  } else {
    Write-Warning "Menghapus output basi: apps-script/$($old.Name)"
  }
  Remove-Item $old.FullName -Force
}

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
# 2b) Manifest Apps Script (appsscript.json)
#     WAJIB ikut dalam folder unggahan: `clasp push` menolak jalan bila manifest
#     tidak ada. Disalin apa adanya dari gas/appsscript.json (sumber acuan),
#     sehingga pengaturan timeZone/webapp tidak berubah saat rilis.
# ---------------------------------------------------------------------------
$manifestSrc = Join-Path $srcDir 'appsscript.json'
if (-not (Test-Path $manifestSrc)) { throw "Manifest tidak ditemukan: $manifestSrc" }
$manifestOut = Join-Path $outDir 'appsscript.json'
Copy-Item -Path $manifestSrc -Destination $manifestOut -Force
Write-Output "Manifest            : appsscript.json disalin ke $outDir"

# ---------------------------------------------------------------------------
# 2c) Info versi bundel (apps-script/Versi.gs)
#     Endpoint `ping` melaporkan versi dari berkas ini, BUKAN dari angka yang
#     ditulis manual di kode (penyebab laporan basi seperti "2.0.0" selagi
#     rilisnya sudah belasan). `version` dibaca dari package.json; `release`
#     (nomor Versi Apps Script) dicap scripts/deploy-gas.mjs tepat sebelum
#     push, karena hanya di sana nomor itu diketahui. Build murni = release null
#     supaya tidak ada nomor rilis yang diklaim tanpa dasar.
# ---------------------------------------------------------------------------
$stamp = Start-Process -FilePath 'node' -ArgumentList 'scripts/stamp-build-info.mjs' -NoNewWindow -Wait -PassThru
if ($stamp.ExitCode -ne 0) {
  Write-Host 'GAGAL mencetak apps-script/Versi.gs (info versi untuk endpoint ping).' -ForegroundColor Red
  exit 1
}
$versiPath = Join-Path $outDir 'Versi.gs'
if (-not (Test-Path $versiPath)) { throw "Berkas info versi tidak dihasilkan: $versiPath" }
Write-Output "Info versi          : Versi.gs (version dari package.json, release dicap saat deploy)"

# ---------------------------------------------------------------------------
# 3) Ringkasan & cek kasar.
# ---------------------------------------------------------------------------
$logoChars = $asetLogo.Length
$stempelChars = $asetStempel.Length
$sizes['AsetLogo.gs'] = $logoChars
$sizes['AsetStempel.gs'] = $stempelChars
$sizes['Versi.gs'] = (Get-Content $versiPath -Raw).Length

Write-Output ''
Write-Output 'Output apps-script/ (semua JANGAN diedit manual):'
$totalChars = 0
foreach ($k in ($sizes.Keys | Sort-Object)) {
  Write-Output ("  {0,-20} {1,9} karakter" -f $k, $sizes[$k])
  $totalChars += $sizes[$k]
  if ($sizes[$k] -gt 90000) { Write-Warning "$k mendekati batas ukuran file Apps Script!" }
}
Write-Output ("  {0,-20} {1,9} karakter" -f '---------', '---------')
Write-Output "  Total                $totalChars karakter (+ manifest appsscript.json)"
Write-Output "Selesai -> $outDir (ambil semua file .gs + appsscript.json saat unggah)"
