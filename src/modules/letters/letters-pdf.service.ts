import { Inject, Injectable, Logger } from '@nestjs/common';
import QRCode from 'qrcode';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { appConfigToken, type AppConfig } from '@/config/app.config';

export interface RenderableLetter {
  id: string;
  title: string;
  letter_number: string;
  sha256_hash: string;
  qr_verify_url: string;
  kop_config: {
    authority_text: string;
    sub_text: string;
    address?: string | null;
    contact_info?: string | null;
  };
  content_payload: {
    konsiderans?: Record<string, string[]>;
    body_text?: string;
    closing_text?: string;
  };
  signatories: {
    role_title: string;
    name: string;
    signature_url?: string | null;
    has_stamp?: boolean;
  }[];
}

@Injectable()
export class LettersPdfService {
  private readonly logger = new Logger(LettersPdfService.name);

  constructor(@Inject(appConfigToken) private readonly config: AppConfig) {}

  /**
   * Menghasilkan gambar QR Code (data URL PNG) yang merujuk ke halaman verifikasi
   * publik SHA-256 (DESIGN.md §8.1). Pakai errorCorrectionLevel 'H' supaya tetap
   * dapat dipindai walau ada stempel/logo di atasnya.
   */
  async generateQrDataUrl(verifyUrl: string): Promise<string> {
    return QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 240,
      color: { dark: '#0d1c2f', light: '#ffffff' },
    });
  }

  /**
   * Menghasilkan HTML otentik berformat A4 dengan Kop Surat Emas, Logo DPW,
   * stempel basah, tanda tangan, dan QR Code verifikasi SHA-256 (DESIGN.md §8.1).
   *
   * `qrDataUrl` opsional: bila disertakan, QR asli ditanam sebagai gambar;
   * bila tidak, ditampilkan penanda teks (mode pratinjau cepat tanpa render QR).
   */
  renderLetterHtml(letter: RenderableLetter, qrDataUrl?: string): string {
    const kop = letter.kop_config;
    const content = letter.content_payload;
    const signatories = letter.signatories;

    const konsideransHtml = content.konsiderans
      ? Object.entries(content.konsiderans)
          .map(
            ([key, items]) => `
          <div style="margin-bottom: 12px; display: flex;">
            <div style="width: 130px; font-weight: bold; text-transform: uppercase;">${key}</div>
            <div style="width: 20px;">:</div>
            <div style="flex: 1;">
              <ol style="margin: 0; padding-left: 20px;">
                ${items.map((item) => `<li style="margin-bottom: 4px;">${item}</li>`).join('')}
              </ol>
            </div>
          </div>
        `,
          )
          .join('')
      : '';

    const signatoriesHtml = signatories
      .map(
        (s) => `
        <div style="text-align: center; width: 220px; position: relative; margin: 10px;">
          <div style="font-size: 13px; font-weight: 600; min-height: 38px;">${s.role_title}</div>
          <div style="height: 70px; display: flex; align-items: center; justify-content: center; position: relative;">
            ${
              s.has_stamp
                ? `<div style="position: absolute; border: 2px solid rgba(27, 107, 81, 0.4); border-radius: 50%; width: 68px; height: 68px; display: flex; align-items: center; justify-content: center; color: #1b6b51; font-size: 8px; font-weight: bold; text-transform: uppercase; transform: rotate(-12deg);">
                    STEMPEL RESMI APII JABO
                   </div>`
                : ''
            }
            ${
              s.signature_url
                ? `<img src="${s.signature_url}" alt="Tanda tangan" style="max-height: 55px; z-index: 2;" />`
                : `<div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 20px; color: #0d1c2f; z-index: 2;">${s.name}</div>`
            }
          </div>
          <div style="font-size: 13px; font-weight: bold; text-decoration: underline; margin-top: 4px;">${s.name}</div>
        </div>
      `,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${letter.title} - ${letter.letter_number}</title>
  <style>
    @page { size: A4 portrait; margin: 20mm; }
    body {
      font-family: 'Times New Roman', Times, serif;
      color: #0d1c2f;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
      line-height: 1.5;
    }
    .header-kop {
      text-align: center;
      border-bottom: 3px double #004532;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .org-title {
      font-size: 17px;
      font-weight: bold;
      color: #004532;
      letter-spacing: 0.5px;
    }
    .sub-org-title {
      font-size: 14px;
      font-weight: bold;
      color: #1b6b51;
      margin-top: 2px;
    }
    .org-contact {
      font-size: 11px;
      color: #555555;
      margin-top: 4px;
    }
    .doc-number {
      text-align: center;
      margin-bottom: 24px;
    }
    .doc-number h2 {
      font-size: 15px;
      text-transform: uppercase;
      margin: 0;
      text-decoration: underline;
    }
    .doc-number p {
      font-size: 13px;
      margin: 4px 0 0 0;
    }
    .doc-body {
      font-size: 13px;
      text-align: justify;
      margin-bottom: 24px;
    }
    .footer-section {
      margin-top: 36px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .qr-box {
      border: 1px dashed #bec9c2;
      padding: 8px;
      text-align: center;
      width: 140px;
      background: #f8faf9;
      font-size: 10px;
    }
    .qr-box a {
      color: #004532;
      word-break: break-all;
      text-decoration: none;
      font-family: monospace;
    }
    .hash-text {
      font-family: monospace;
      font-size: 8px;
      color: #666;
      margin-top: 4px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="header-kop">
    <div class="org-title">${kop.authority_text}</div>
    <div class="sub-org-title">${kop.sub_text}</div>
    <div class="org-contact">${kop.address ?? 'Sekretariat Wilayah Jabodetabek'} | ${kop.contact_info ?? 'sekretariat@apii.sigitadi.id'}</div>
  </div>

  <div class="doc-number">
    <h2>${letter.title}</h2>
    <p>Nomor: ${letter.letter_number}</p>
  </div>

  <div class="doc-body">
    ${konsideransHtml}
    ${content.body_text ? `<p style="white-space: pre-wrap;">${content.body_text}</p>` : ''}
    ${content.closing_text ? `<p style="margin-top: 16px;">${content.closing_text}</p>` : ''}
  </div>

  <div class="footer-section">
    <div class="qr-box">
      <div style="font-weight: bold; margin-bottom: 4px;">Verifikasi Digital</div>
      <div style="padding: 6px; background: white; display: inline-block;">
        ${
          qrDataUrl
            ? `<img src="${qrDataUrl}" alt="QR Verifikasi SHA-256" style="width: 96px; height: 96px; display: block;" />`
            : `<span style="font-size: 11px;">[QR SHA-256]</span>`
        }
      </div>
      <div class="hash-text">${letter.sha256_hash.slice(0, 24)}...</div>
      <div style="margin-top: 4px;"><a href="${letter.qr_verify_url}" target="_blank">Cek Keaslian</a></div>
    </div>

    <div style="display: flex; flex-wrap: wrap; justify-content: flex-end;">
      ${signatoriesHtml}
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Path absolut tempat PDF final disimpan (storage lokal; lihat persistLetterPdf).
   * Format: `<cwd>/storage/pdfs/letters/<letterId>.pdf`.
   */
  pdfStoragePath(letterId: string): string {
    return join(process.cwd(), 'storage', 'pdfs', 'letters', `${letterId}.pdf`);
  }

  /**
   * Render HTML A4 menjadi PDF biner via Chromium headless (puppeteer-core +
   * @sparticuz/chromium — kombinasi yang kompatibel dengan Vercel, DESIGN.md §11.4.1).
   * QR Code asli ditanam sebelum konversi.
   */
  async renderLetterPdf(letter: RenderableLetter): Promise<Buffer> {
    const qrDataUrl = await this.generateQrDataUrl(letter.qr_verify_url);
    const html = this.renderLetterHtml(letter, qrDataUrl);

    // Lazy import: puppeteer-core & @sparticuz/chromium hanya ESM; dimuat
    // sekali saat render pertama (mempertahankan cold-start cepat & kompatibilitas CJS).
    const [{ default: puppeteer }, { default: chromium }] = await Promise.all([
      import('puppeteer-core'),
      import('@sparticuz/chromium'),
    ]);

    let browser;
    try {
      browser = await puppeteer.launch({
        args: [...chromium.args, '--hide-scrollbars', '--disable-font-subsetting'],
        defaultViewport: { width: 794, height: 1123 },
        executablePath: await this.resolveChromiumExecutable(chromium),
        headless: true,
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      // Beri waktu render font & gambar tanda tangan sebelum konversi PDF.
      await page.evaluate(() => document.fonts?.ready);
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        preferCSSPageSize: true,
      });
      return Buffer.from(pdf);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Resolusi binary Chromium yang portabel:
   * 1. Env `CHROME_EXECUTABLE_PATH` eksplisit (paling diandalkan),
   * 2. Instalasi Chrome/Edge lokal yang umum (Windows/macOS development),
   * 3. `@sparticuz/chromium` (Linux — Vercel/Lambda, binary di-download saat deploy).
   */
  private async resolveChromiumExecutable(chromium: {
    executablePath: () => Promise<string>;
  }): Promise<string> {
    if (this.config.CHROME_EXECUTABLE_PATH) {
      return this.config.CHROME_EXECUTABLE_PATH;
    }

    const platform = process.platform;
    const localCandidates: string[] = [];
    if (platform === 'win32') {
      const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files';
      const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
      localCandidates.push(
        `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
        `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
        `${programFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe`,
        `${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
      );
    } else if (platform === 'darwin') {
      localCandidates.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      );
    }

    for (const candidate of localCandidates) {
      try {
        await access(candidate);
        return candidate;
      } catch {
        // lanjut ke kandidat berikutnya
      }
    }

    // Fallback: @sparticuz/chromium (serverless Linux).
    return chromium.executablePath();
  }

  /**
   * Simpan PDF final ke storage lokal saat surat dirilis (FR-LETTER-09).
   * Mengembalikan URL publik (disajikan statis dari folder `storage`) bila berhasil,
   * atau `null` bila filesystem read-only (mis. serverless) — pemanggil tetap dapat
   * memanggil `renderLetterPdf` saat diminta.
   */
  async persistLetterPdf(letter: RenderableLetter): Promise<string | null> {
    try {
      const absolutePath = this.pdfStoragePath(letter.id);
      const pdf = await this.renderLetterPdf(letter);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, pdf);
      const publicUrl = `${this.config.FRONTEND_URL}/pdfs/letters/${letter.id}.pdf`;
      this.logger.log(`PDF final tersimpan: ${absolutePath}`);
      return publicUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Gagal menyimpan PDF final ke storage lokal (${message}); akan dirender on-demand.`);
      return null;
    }
  }
}
