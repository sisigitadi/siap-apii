import { Injectable } from '@nestjs/common';
export interface RenderableLetter {
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
  /**
   * Menghasilkan HTML otentik berformat A4 dengan Kop Surat Emas, Logo DPW,
   * stempel basah, tanda tangan, dan QR Code verifikasi SHA-256 (DESIGN.md §8.1).
   */
  renderLetterHtml(letter: RenderableLetter): string {
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
        <span style="font-size: 11px;">[QR SHA-256]</span>
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
}
