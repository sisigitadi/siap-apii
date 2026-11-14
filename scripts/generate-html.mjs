/**
 * SIAP APII - generate-html.mjs
 * Markdown-to-HTML Executive Guide Generator with Print/PDF Layout & Embedded Diagrams
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const mdPath = path.resolve('PANDUAN_EKSEKUTIF_DAN_FITUR_SIAP_APII.md');
const htmlPath = path.resolve('PANDUAN_EKSEKUTIF_DAN_FITUR_SIAP_APII.html');
const diagDir = path.resolve('assets/diagrams');

function getBase64Img(filename) {
  const fullPath = path.join(diagDir, filename);
  if (!fs.existsSync(fullPath)) return '';
  const buf = fs.readFileSync(fullPath);
  const isJpeg = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8;
  const mime = isJpeg ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

const DIAGRAM_CATALOG = {
  'diagram_1_transformasi_sistem.png': 'Bagan 1: Transformasi Tata Kelola dari Pola Manual ke Sistem Terpadu SIAP APII',
  'diagram_2_arsitektur_dwi_portal.png': 'Bagan 2: Arsitektur Dwi-Portal (Portal Publik Adaptif & Portal Pengurus Private SPA)',
  'diagram_3_federasi_dpp_dpw.png': 'Bagan 3: Standar Mutu Seragam Nasional dipadukan Otonomi Kustomisasi Lokal DPW',
  'diagram_4_alur_persuratan_dinas.png': 'Bagan 4: Alur Persuratan Dinas dari Draf A4, TTD & Stempel Otomatis, hingga Verifikasi QR',
  'diagram_5_alur_keuangan_kas.png': 'Bagan 5: Alur Dual-Approval Kas Keluar & Pencetakan Kwitansi Dual-Slip',
  'diagram_6_alur_pendaftaran_kta.png': 'Bagan 6: Alur Pendaftaran Anggota Online, Watermark KTP UU PDP & KTA Standar CR80',
  'diagram_7_17_inovasi_dakwah.png': 'Bagan 7: Klaster 17 Inovasi Strategis Tata Kelola Dakwah SIAP APII'
};

function stripDecorativeGlyphs(text) {
  return String(text || '')
    // Remove variation selectors, ZWJ, and Unicode pictographic emojis
    .replace(/[\uFE0E\uFE0F\u200D]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    // Replace em-dash and horizontal bar with clean ASCII hyphen
    .replace(/[\u2014\u2015]/g, ' - ')
    // Collapse excess spaces left behind after stripping leading emojis in bullets
    .replace(/^\s{2,}(?=\*\*|\S)/gm, (m) => (m.length >= 4 ? m : ' '))
    .replace(/ {2,}(?=\*\*)/g, ' ');
}

function normalizeMarkdownArtifacts(text) {
  return stripDecorativeGlyphs(text)
    // Convert LaTeX inline symbols found in executive markdown
    .replace(/\$\\rightarrow\$/g, '->')
    .replace(/\$(\d+)\\%\$/g, '$1%')
    .replace(/\\([.:_|\!\[\]()\-+])/g, '$1');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEmphasis(escaped) {
  // Parse **bold** first while allowing nested *italic* spans inside bold text
  return escaped
    .replace(/\*\*((?:[^*]|\*(?!\*))+?)\*\*/g, (_, inner) => {
      const parsedInner = inner.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
      return `<strong>${parsedInner}</strong>`;
    })
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
}

function renderInline(rawText) {
  let text = normalizeMarkdownArtifacts(rawText);

  // Preserve explicit <br/> tags used inside markdown table cells
  const BR_TOKEN = '@@BR_TOKEN@@';
  text = text.replace(/<br\s*\/?>/gi, BR_TOKEN);

  // Extract inline code spans first so inner markdown characters aren't parsed
  const codeSpans = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    const idx = codeSpans.length;
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `@@CODE_${idx}@@`;
  });

  // Extract markdown links [label](url)
  const linkSpans = [];
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
    const idx = linkSpans.length;
    const safeUrl = escapeHtml(url);
    const safeLabel = formatEmphasis(escapeHtml(label));
    linkSpans.push(`<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`);
    return `@@LINK_${idx}@@`;
  });

  // Escape remaining raw HTML and apply bold/italic + arrow formatting
  text = formatEmphasis(escapeHtml(text));

  // Restore links, code spans, and <br/>
  text = text.replace(/@@LINK_(\d+)@@/g, (_, idx) => linkSpans[Number(idx)] || '');
  text = text.replace(/@@CODE_(\d+)@@/g, (_, idx) => codeSpans[Number(idx)] || '');
  text = text.replace(new RegExp(BR_TOKEN, 'g'), '<br/>');
  text = text.replace(/-&gt;/g, '&rarr;');

  return text.trim();
}

function renderVectorDiagram2() {
  const publikItems = [
    'Warta Maklumat & Risalah Dakwah',
    'Kalender Safari Dakwah & Kajian',
    'Pendaftaran Anggota (100% Gratis)',
    'Pusat Verifikasi Dokumen & KTA (QR)',
    'Kanal Infaq & Rekening Resmi',
    'Konsultasi Syubhat Rahasia',
    'Peta Sebaran Dakwah Geo-Hub'
  ];
  const portalItems = [
    'Workspace 1: Dashboard Eksekutif',
    'Workspace 2: Persuratan & SK A4',
    'Workspace 3: Surat Masuk & Disposisi',
    'Workspace 4: Kas 4 Kantong & Kwitansi',
    'Workspace 5: Program 7 Divisi Kerja',
    'Workspace 6: Keanggotaan & KTA CR80',
    'Workspace 7: Siaga Advokasi LBH APII',
    'Workspace 8: Muallaf Care & Aset QR',
    'Workspace 9: Maktabah Dalil & Risalah',
    'Workspace 10: IAM 8 Peran & Drive Vault'
  ];

  return `
  <div class="vdiag vdiag-arch">
    <div class="vdiag-root">Sistem Informasi SIAP APII</div>
    <div class="vdiag-branch-bar"><span></span><span></span></div>
    <div class="vdiag-two-col">
      <div class="vdiag-zone">
        <div class="vdiag-zone-head">
          <strong>1. PORTAL PUBLIK ADAPTIF</strong>
          <span>Masyarakat &amp; Calon Anggota (Etalase &amp; Pelayanan Umat)</span>
        </div>
        <ul class="vdiag-chip-list">
          ${publikItems.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
        </ul>
      </div>
      <div class="vdiag-zone">
        <div class="vdiag-zone-head vdiag-zone-head-dark">
          <strong>2. PORTAL PENGURUS</strong>
          <span>Private SPA Pengurus (Dapur Tata Kelola Administrasi)</span>
        </div>
        <ul class="vdiag-chip-list vdiag-chip-grid-2">
          ${portalItems.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
        </ul>
      </div>
    </div>
  </div>`;
}

function renderVectorDiagram5() {
  return `
  <div class="vdiag vdiag-flow">
    <div class="vdiag-step-row">
      <div class="vdiag-node vdiag-node-primary">
        <strong>Pengajuan Permohonan Kas Keluar</strong>
        <span>Pengusul / Divisi input permohonan &amp; lampirkan Nota / RAB</span>
      </div>
    </div>
    <div class="vdiag-arrow-down">&#8595;</div>
    <div class="vdiag-decision-row">
      <div class="vdiag-node vdiag-node-gate">
        <strong>Tahap 1: Verifikasi Bendahara</strong>
        <span>Cek keabsahan nota belanja &amp; saldo Kantong Syar'i</span>
      </div>
      <div class="vdiag-branch-right">
        <span class="vdiag-edge-label vdiag-edge-reject">Ditolak / Nota Tidak Sah &rarr;</span>
        <div class="vdiag-node vdiag-node-reject">
          <strong>Status REJECTED</strong>
          <span>Uang Tidak Keluar</span>
        </div>
      </div>
    </div>
    <div class="vdiag-arrow-down"><span>Lolos Pemeriksaan</span> &#8595;</div>
    <div class="vdiag-decision-row">
      <div class="vdiag-node vdiag-node-gate">
        <strong>Tahap 2: Pengesahan Ketua Umum/Wilayah</strong>
        <span>Ketum memeriksa urgensi &amp; kelayakan pencairan</span>
      </div>
      <div class="vdiag-branch-right">
        <span class="vdiag-edge-label vdiag-edge-reject">Ditolak Ketum &rarr;</span>
        <div class="vdiag-node vdiag-node-reject">
          <strong>Status REJECTED</strong>
          <span>Uang Tidak Keluar</span>
        </div>
      </div>
    </div>
    <div class="vdiag-arrow-down"><span>Disetujui Ketum</span> &#8595;</div>
    <div class="vdiag-step-row">
      <div class="vdiag-node vdiag-node-ok">
        <strong>Status APPROVED (Sah Terbit Nomor BKK)</strong>
        <span>Otorisasi ganda terpenuhi</span>
      </div>
    </div>
    <div class="vdiag-arrow-split"><span>&#8601;</span><span>&#8600;</span></div>
    <div class="vdiag-split-two">
      <div class="vdiag-node vdiag-node-sub">
        <strong>Saldo Kas Otomatis Terpotong</strong>
        <span>Tercatat pada Buku Kas Kantong Syar'i</span>
      </div>
      <div class="vdiag-node vdiag-node-sub">
        <strong>Cetak Kwitansi Dual-Slip</strong>
        <span>30% Bonggol Kasir : 70% Lembar Penerima / Donatur</span>
      </div>
    </div>
  </div>`;
}

function renderVectorDiagram6() {
  const steps = [
    ['1', 'Calon Anggota Buka Form', 'Akses portal publik via HP (apologetislamindonesia.org)'],
    ['2', 'Watermark KTP Otomatis', 'Mesin HP menimpa cap: VERIFIKASI KTA APII - AMAN UU PDP'],
    ['3', 'Formulir Terkirim', 'Pendaftaran 100% Bebas Biaya / Gratis'],
    ['4', 'Verifikasi Sekretaris', 'Tahap 1: Memeriksa pasfoto & identitas KTP'],
    ['5', 'Pengesahan Ketua', 'Sahkan anggota & terbitkan NIA Nasional'],
    ['6', 'KTA Digital CR80 Terbit', 'Depan: Identitas 5 Thn; Belakang: Kode Etik & QR Resmi']
  ];

  return `
  <div class="vdiag vdiag-kta">
    <div class="vdiag-kta-grid">
      ${steps
        .map(
          ([num, title, desc], idx) => `
        <div class="vdiag-kta-step${idx === 5 ? ' vdiag-kta-step-final' : ''}">
          <div class="vdiag-kta-badge">Langkah ${num}</div>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(desc)}</span>
        </div>`
        )
        .join('')}
    </div>
  </div>`;
}

function renderVectorDiagram7() {
  const clusters = [
    {
      title: '1. Perlindungan & Hukum',
      items: [
        'LBH Siaga Advokasi Dai',
        'Anti-Leak Dynamic Watermarking',
        'Radar Tabayyun Counter-Framing'
      ]
    },
    {
      title: '2. Tata Kelola & Syariah',
      items: [
        'Benteng 4 Kantong Fiqih Kas',
        'Auto-Closing Rekonsiliasi Bulanan',
        'One-Click Decree Generator SK',
        'Penanggalan Hijriah Otomatis',
        'Risalah Musyawarah Digital'
      ]
    },
    {
      title: '3. Penguatan Dai & Kader',
      items: [
        'KTA Digital CR80 Lisensi 1, 2, 3',
        'Maktabah Dalil Apologetika',
        'Presensi Scan QR KTA Acara',
        'Pelacak Aset Logistik Dakwah'
      ]
    },
    {
      title: '4. Pelayanan Umat & Publik',
      items: [
        'Kanal Konsultasi Aqidah Rahasia',
        'Modul Muallaf Care & E-Sertifikat',
        'Infaq Tematik Crowdfunding',
        'Peta Sebaran Dakwah Geo-Hub',
        'PWA Aplikasi Layar HP Ringan'
      ]
    }
  ];

  return `
  <div class="vdiag vdiag-clusters">
    <div class="vdiag-root">17 Inovasi Dakwah Unggulan APII</div>
    <div class="vdiag-cluster-grid">
      ${clusters
        .map(
          (c) => `
        <div class="vdiag-cluster-box">
          <div class="vdiag-cluster-title">${escapeHtml(c.title)}</div>
          <ul class="vdiag-chip-list">
            ${c.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>`
        )
        .join('')}
    </div>
  </div>`;
}

function renderDiagramCard(filename, captionOverride = '') {
  const caption = captionOverride || DIAGRAM_CATALOG[filename] || filename;
  const vectorRenderers = {
    'diagram_2_arsitektur_dwi_portal.png': renderVectorDiagram2,
    'diagram_5_alur_keuangan_kas.png': renderVectorDiagram5,
    'diagram_6_alur_pendaftaran_kta.png': renderVectorDiagram6,
    'diagram_7_17_inovasi_dakwah.png': renderVectorDiagram7
  };

  if (vectorRenderers[filename]) {
    return [
      '<div class="diagram-card diagram-card-vector">',
      vectorRenderers[filename](),
      `  <div class="diagram-caption">${escapeHtml(caption)}</div>`,
      '</div>'
    ].join('\n');
  }

  const b64 = getBase64Img(filename);
  if (!b64) {
    return `<div class="diagram-card"><div class="diagram-caption">${escapeHtml(caption)}</div></div>`;
  }
  return [
    '<div class="diagram-card">',
    `  <img src="${b64}" alt="${escapeHtml(caption)}">`,
    `  <div class="diagram-caption">${escapeHtml(caption)}</div>`,
    '</div>'
  ].join('\n');
}

function renderAsciiRelayCard(rawCodeText) {
  const innerLines = rawCodeText
    .split('\n')
    .map((l) => l.replace(/^[┌┐└┘│─\s]+/, '').replace(/[│─\s]+$/, '').trimEnd())
    .filter((l, idx, arr) => {
      if (idx === 0 || idx === arr.length - 1) return Boolean(l);
      return true;
    });

  const titleLine = innerLines.find((l) => /TUGAS BERHASIL/i.test(l)) || 'TUGAS BERHASIL DISELESAIKAN!';
  const subtitleLine = innerLines.find((l) => /Lanjutkan estafet/i.test(l)) || '';
  const targetLine = innerLines.find((l) => /^Tujuan:/i.test(l)) || '';
  const msgHeaderIdx = innerLines.findIndex((l) => /^Pesan Siap Kirim:/i.test(l));
  const actionLine = innerLines.find((l) => l.includes('[') && l.includes(']')) || '';

  const messageLines = [];
  if (msgHeaderIdx !== -1) {
    for (let k = msgHeaderIdx + 1; k < innerLines.length; k++) {
      const line = innerLines[k];
      if (!line || (line.includes('[') && line.includes(']'))) break;
      messageLines.push(line);
    }
  }

  const buttons = [...actionLine.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
  const msgHtml = messageLines
    .map((line) => {
      if (/^https?:\/\//i.test(line)) {
        const safe = escapeHtml(line);
        return `<a href="${safe}" target="_blank" rel="noopener noreferrer"><code>${safe}</code></a>`;
      }
      return escapeHtml(line);
    })
    .join('<br/>');

  return [
    '<div class="relay-card">',
    '  <div class="relay-card-head">',
    `    <div class="relay-card-title">${escapeHtml(titleLine)}</div>`,
    subtitleLine ? `    <div class="relay-card-sub">${escapeHtml(subtitleLine)}</div>` : '',
    '  </div>',
    '  <div class="relay-card-body">',
    targetLine ? `    <div class="relay-meta"><strong>${escapeHtml(targetLine.split(':')[0])}:</strong> ${escapeHtml(targetLine.slice(targetLine.indexOf(':') + 1).trim())}</div>` : '',
    '    <div class="relay-msg-label">Pesan Siap Kirim:</div>',
    `    <div class="relay-msg-bubble">${msgHtml}</div>`,
    '  </div>',
    buttons.length
      ? `  <div class="relay-actions">${buttons
          .map((btn, idx) => `<span class="relay-btn${idx === 0 ? ' relay-btn-primary' : ''}">${escapeHtml(btn)}</span>`)
          .join('')}</div>`
      : '',
    '</div>'
  ]
    .filter(Boolean)
    .join('\n');
}

function slugifyHeading(text) {
  return normalizeMarkdownArtifacts(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line) {
  return /^\s*\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(line);
}

function parseMarkdownToHtml(markdownText) {
  const lines = markdownText.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  const tocEntries = [];
  let i = 0;
  let embeddedDiagrams = 0;
  let headingCount = 0;
  let passedIntroDivider = false;
  let insertedToc = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed === '&nbsp;') {
      i++;
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      if (!passedIntroDivider) {
        passedIntroDivider = true;
        blocks.push('<hr class="hero-divider" />');
      } else {
        blocks.push('<hr class="section-divider" />');
      }
      i++;
      continue;
    }

    const fenceMatch = trimmed.match(/^```(\w*)/);
    if (fenceMatch) {
      const lang = (fenceMatch[1] || '').toLowerCase();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(stripDecorativeGlyphs(lines[i]));
        i++;
      }
      if (i < lines.length) i++;

      const rawCode = codeLines.join('\n').trimEnd();
      if (lang === 'mermaid') {
        blocks.push(
          `<details class="mermaid-source"><summary>Spesifikasi Alur Diagram (${escapeHtml(lang)})</summary><pre><code>${escapeHtml(rawCode)}</code></pre></details>`
        );
      } else if (rawCode.includes('TUGAS BERHASIL DISELESAIKAN') && rawCode.includes('┌')) {
        blocks.push(renderAsciiRelayCard(rawCode));
      } else {
        blocks.push(`<pre class="code-block"><code>${escapeHtml(rawCode)}</code></pre>`);
      }
      continue;
    }

    const diagMatch = trimmed.match(/assets\/diagrams\/(diagram_\d+_[a-z0-9_]+\.png)/i);
    if (diagMatch) {
      const filename = diagMatch[1];
      const altMatch = trimmed.match(/!\[([^\]]*)\]/);
      const caption = DIAGRAM_CATALOG[filename] || (altMatch ? normalizeMarkdownArtifacts(altMatch[1]) : filename);
      blocks.push(renderDiagramCard(filename, caption));
      embeddedDiagrams++;
      i++;
      continue;
    }

    if (trimmed.includes('1VR_3fTnl39-MTEkLOd_I_7wF5zkXxAVE') || trimmed.includes('1VR\\_3fTnl39-MTEkLOd\\_I\\_7wF5zkXxAVE')) {
      blocks.push(renderDiagramCard('diagram_1_transformasi_sistem.png'));
      embeddedDiagrams++;
      i++;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const rawTitle = headingMatch[2].trim();
      const slug = slugifyHeading(rawTitle);
      const cleanTitle = normalizeMarkdownArtifacts(rawTitle);

      if (level === 2) {
        const isFirstChapter = /^\d+\.\s+/.test(cleanTitle) && tocEntries.length === 0;
        if (isFirstChapter && !insertedToc) {
          blocks.push('@@TOC_PLACEHOLDER@@');
          insertedToc = true;
        }
        if (/^\d+\.\s+/.test(cleanTitle)) {
          tocEntries.push({ slug, title: cleanTitle });
        }
        const extraClass = isFirstChapter ? ' class="page-break-before-print"' : '';
        blocks.push(`<h2 id="${escapeHtml(slug)}"${extraClass}>${renderInline(rawTitle)}</h2>`);
      } else if (level === 3 && !passedIntroDivider) {
        blocks.push(`<p class="hero-subtitle" id="${escapeHtml(slug)}">${renderInline(rawTitle)}</p>`);
      } else {
        blocks.push(`<h${level} id="${escapeHtml(slug)}">${renderInline(rawTitle)}</h${level}>`);
      }

      headingCount++;
      i++;
      continue;
    }

    if (trimmed.startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseTableRow(lines[i]);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }

      const thead = `<thead><tr>${headers.map((h) => `<th>${renderInline(h)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${r.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      blocks.push(`<div class="table-wrap"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    if (/^(\s*)(\d+\.|[-*])\s+/.test(line)) {
      const listResult = parseListBlock(lines, i);
      blocks.push(listResult.html);
      i = listResult.nextIndex;
      continue;
    }

    const paraLines = [];
    while (i < lines.length) {
      const curr = lines[i];
      const currTrim = curr.trim();
      if (
        !currTrim ||
        currTrim === '&nbsp;' ||
        /^-{3,}$/.test(currTrim) ||
        /^```/.test(currTrim) ||
        /^#{1,4}\s+/.test(currTrim) ||
        /^(\s*)(\d+\.|[-*])\s+/.test(curr) ||
        /assets\/diagrams\/diagram_/i.test(currTrim) ||
        currTrim.includes('1VR_3fTnl39-MTEkLOd_I_7wF5zkXxAVE') ||
        currTrim.includes('1VR\\_3fTnl39-MTEkLOd\\_I\\_7wF5zkXxAVE') ||
        (currTrim.startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
      ) {
        break;
      }
      paraLines.push(curr);
      i++;
    }

    const joined = paraLines
      .map((l, idx) => {
        const hasHardBreak = /  $/.test(l) && idx < paraLines.length - 1;
        return renderInline(l.trim()) + (hasHardBreak ? '<br/>' : '');
      })
      .join('\n');

    if (joined.trim()) {
      const isClosingMeta = joined.includes('Dokumen Resmi Penjelasan Sistem');
      const isHeroMeta = !passedIntroDivider;
      if (isClosingMeta) {
        blocks.push(`<div class="closing-block"><p>${joined}</p></div>`);
      } else if (isHeroMeta) {
        blocks.push(`<p class="hero-meta">${joined}</p>`);
      } else {
        blocks.push(`<p>${joined}</p>`);
      }
    }
  }

  const tocHtml = tocEntries.length
    ? [
        '<nav class="toc-card" aria-label="Daftar Isi">',
        '  <div class="toc-header">',
        '    <div class="toc-title">DAFTAR ISI EKSEKUTIF</div>',
        '    <div class="toc-col-label">HALAMAN</div>',
        '  </div>',
        '  <div class="toc-list">',
        tocEntries
          .map(
            (entry) =>
              `    <a class="toc-item" href="#${escapeHtml(entry.slug)}"><span class="toc-label">${escapeHtml(entry.title)}</span><span class="toc-dots" aria-hidden="true"></span><span class="toc-page">@@TOC_PAGE:${escapeHtml(entry.slug)}@@</span></a>`
          )
          .join('\n'),
        '  </div>',
        '</nav>'
      ].join('\n')
    : '';

  const html = blocks.join('\n\n').replace('@@TOC_PLACEHOLDER@@', tocHtml);

  return {
    html,
    tocEntries,
    embeddedDiagrams,
    headingCount
  };
}

function parseListBlock(lines, startIndex, baseIndent = 0) {
  const firstMatch = lines[startIndex].match(/^(\s*)(\d+\.|[-*])\s+(.*)$/);
  const listTag = /^\d+\./.test(firstMatch[2]) ? 'ol' : 'ul';
  const items = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      break;
    }

    const itemMatch = line.match(/^(\s*)(\d+\.|[-*])\s+(.*)$/);
    if (!itemMatch) {
      break;
    }

    const indent = itemMatch[1].length;
    const marker = itemMatch[2];
    const currentTag = /^\d+\./.test(marker) ? 'ol' : 'ul';

    if (indent < baseIndent) {
      break;
    }
    if (indent > baseIndent) {
      if (items.length > 0) {
        const nested = parseListBlock(lines, i, indent);
        items[items.length - 1].nested.push(nested.html);
        i = nested.nextIndex;
        continue;
      }
    }
    if (indent === baseIndent && currentTag !== listTag) {
      break;
    }

    const parts = [renderInline(itemMatch[3])];
    i++;

    while (i < lines.length) {
      const nextLine = lines[i];
      if (!nextLine.trim()) break;
      const nextItem = nextLine.match(/^(\s*)(\d+\.|[-*])\s+/);
      if (nextItem) {
        if (nextItem[1].length > indent) {
          const nested = parseListBlock(lines, i, nextItem[1].length);
          parts.push(nested.html);
          i = nested.nextIndex;
          continue;
        }
        break;
      }
      if (/^\s+/.test(nextLine)) {
        parts.push('<br/>' + renderInline(nextLine.trim()));
        i++;
      } else {
        break;
      }
    }

    items.push({ parts, nested: [] });
  }

  const liHtml = items
    .map((item) => `<li>${item.parts.join('\n')}${item.nested.join('\n')}</li>`)
    .join('\n');

  return {
    html: `<${listTag}>\n${liHtml}\n</${listTag}>`,
    nextIndex: i
  };
}

/** Wrap body markup in the full styled HTML/print template. */
function buildDocumentHtml(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PANDUAN EKSEKUTIF &amp; PENJELASAN SISTEM SIAP APII</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 14mm 18mm 14mm;
      @top-left {
        content: "SIAP APII v3.0.0";
        font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
        font-size: 7.5pt;
        font-weight: 700;
        color: #065f46;
        letter-spacing: 0.04em;
        border-bottom: 0.5pt solid #cbd5e1;
        padding-bottom: 4pt;
        margin-bottom: 6pt;
      }
      @top-center {
        content: "\\00a0";
        font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
        font-size: 7.5pt;
        border-bottom: 0.5pt solid #cbd5e1;
        padding-bottom: 4pt;
        margin-bottom: 6pt;
      }
      @top-right {
        content: "Panduan Eksekutif & Penjelasan Sistem";
        font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
        font-size: 7.5pt;
        color: #64748b;
        border-bottom: 0.5pt solid #cbd5e1;
        padding-bottom: 4pt;
        margin-bottom: 6pt;
      }
      @bottom-center {
        content: "Halaman " counter(page) " / " counter(pages);
        font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
        font-size: 7.5pt;
        font-weight: 600;
        color: #475569;
        padding-top: 4pt;
      }
    }
    @page :first {
      margin-top: 14mm;
      @top-left { content: ""; border: none; }
      @top-center { content: ""; border: none; }
      @top-right { content: ""; border: none; }
    }

    * {
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.62;
      color: #1e293b;
      background-color: #f8fafc;
      margin: 0;
      padding: 28px 16px;
    }
    .container {
      max-width: 920px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px 44px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);
      border: 1px solid #e2e8f0;
    }
    .header-tag {
      background: #ecfdf5;
      color: #065f46;
      padding: 5px 12px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11.5px;
      letter-spacing: 0.05em;
      display: inline-block;
      margin-bottom: 12px;
      border: 1px solid #a7f3d0;
    }
    h1 {
      color: #064e3b;
      font-size: 24px;
      line-height: 1.28;
      margin: 0 0 10px 0;
      border-bottom: 2.5px solid #064e3b;
      padding-bottom: 10px;
      text-wrap: balance;
    }
    .hero-subtitle {
      font-size: 15.5px;
      font-weight: 700;
      color: #0f172a;
      margin: 8px 0 10px 0;
      line-height: 1.4;
      text-wrap: balance;
    }
    .hero-meta {
      margin: 4px 0;
      font-size: 13.5px;
      color: #334155;
      background: #f8fafc;
      border-left: 3px solid #065f46;
      padding: 6px 12px;
      border-radius: 0 6px 6px 0;
    }
    h2 {
      color: #064e3b;
      font-size: 19px;
      line-height: 1.32;
      margin-top: 28px;
      margin-bottom: 10px;
      border-left: 4px solid #b45309;
      padding-left: 12px;
      text-wrap: balance;
    }
    h3 {
      color: #0f172a;
      font-size: 16px;
      line-height: 1.35;
      margin-top: 20px;
      margin-bottom: 8px;
      text-wrap: balance;
    }
    h4 {
      color: #064e3b;
      font-size: 14.5px;
      line-height: 1.35;
      margin-top: 16px;
      margin-bottom: 5px;
    }
    p, li {
      font-size: 14px;
      color: #334155;
    }
    p {
      margin: 0 0 10px 0;
    }
    ul, ol {
      margin: 6px 0 12px 0;
      padding-left: 22px;
    }
    li {
      margin-bottom: 5px;
    }
    a {
      color: #065f46;
      text-decoration: underline;
      overflow-wrap: anywhere;
    }
    code {
      font-family: 'Consolas', 'Courier New', ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.88em;
      background: #f1f5f9;
      color: #0f172a;
      padding: 1px 5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    hr {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 22px 0;
    }

    /* Executive TOC */
    .toc-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-top: 3px solid #064e3b;
      border-radius: 8px;
      padding: 14px 18px;
      margin: 18px 0 22px 0;
    }
    .toc-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .toc-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #064e3b;
      margin-bottom: 0;
    }
    .toc-col-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #64748b;
      flex-shrink: 0;
    }
    .toc-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .toc-item {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      font-size: 12.5px;
      color: #1e293b;
      text-decoration: none;
      padding: 2px 0;
      line-height: 1.38;
    }
    .toc-label {
      flex: 0 1 auto;
    }
    .toc-dots {
      flex: 1 0 16px;
      border-bottom: 1px dotted #94a3b8;
      margin-bottom: 4px;
    }
    .toc-page {
      flex: 0 0 auto;
      min-width: 44px;
      text-align: right;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #065f46;
      white-space: nowrap;
    }
    .toc-item:hover {
      color: #065f46;
    }
    .toc-item:hover .toc-label {
      text-decoration: underline;
    }

    /* Diagram Cards */
    .diagram-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 14px;
      margin: 16px 0;
      text-align: center;
    }
    .diagram-card img {
      max-width: 100%;
      width: auto;
      height: auto;
      border-radius: 4px;
      display: block;
      margin: 0 auto;
    }
    .diagram-caption {
      font-size: 12px;
      color: #475569;
      margin-top: 10px;
      font-weight: 600;
    }

    /* Native Vector Diagrams */
    .vdiag {
      text-align: left;
      color: #1e293b;
    }
    .vdiag-root {
      background: #064e3b;
      color: #ffffff;
      font-weight: 700;
      font-size: 12.5px;
      text-align: center;
      padding: 8px 14px;
      border-radius: 6px;
      max-width: 340px;
      margin: 0 auto;
    }
    .vdiag-branch-bar {
      height: 14px;
      width: 56%;
      margin: 0 auto;
      border-top: 1.5px solid #64748b;
      border-left: 1.5px solid #64748b;
      border-right: 1.5px solid #64748b;
      position: relative;
    }
    .vdiag-branch-bar::before {
      content: "";
      position: absolute;
      left: 50%;
      top: -10px;
      height: 10px;
      border-left: 1.5px solid #64748b;
    }
    .vdiag-two-col {
      display: grid;
      grid-template-columns: 1fr 1.25fr;
      gap: 12px;
      margin-top: 2px;
    }
    .vdiag-zone {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      padding: 10px;
    }
    .vdiag-zone-head {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 5px;
      padding: 7px 9px;
      margin-bottom: 8px;
    }
    .vdiag-zone-head-dark {
      background: #eff6ff;
      border-color: #bfdbfe;
    }
    .vdiag-zone-head strong {
      display: block;
      font-size: 11.5px;
      color: #064e3b;
    }
    .vdiag-zone-head-dark strong {
      color: #1e3a8a;
    }
    .vdiag-zone-head span {
      display: block;
      font-size: 10.5px;
      color: #475569;
    }
    .vdiag-chip-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 5px;
    }
    .vdiag-chip-grid-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .vdiag-chip-list li {
      margin: 0;
      font-size: 11px;
      line-height: 1.3;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #065f46;
      border-radius: 4px;
      padding: 5px 7px;
      color: #1e293b;
    }

    /* Vector Diagram 5 (Dual-Approval Flow) */
    .vdiag-flow {
      max-width: 680px;
      margin: 0 auto;
    }
    .vdiag-step-row {
      display: flex;
      justify-content: center;
    }
    .vdiag-node {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 11px;
      font-size: 11px;
      line-height: 1.35;
      text-align: center;
    }
    .vdiag-node strong {
      display: block;
      font-size: 11.5px;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .vdiag-node span {
      display: block;
      color: #475569;
      font-size: 10.5px;
    }
    .vdiag-node-primary {
      background: #eff6ff;
      border-color: #93c5fd;
      min-width: 320px;
    }
    .vdiag-node-gate {
      background: #fefce8;
      border-color: #fde047;
      border-left: 4px solid #b45309;
      flex: 1.25;
      text-align: left;
    }
    .vdiag-decision-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .vdiag-branch-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }
    .vdiag-edge-label {
      font-size: 10px;
      font-weight: 600;
      color: #991b1b;
      white-space: nowrap;
    }
    .vdiag-node-reject {
      background: #fef2f2;
      border-color: #fca5a5;
      flex: 1;
    }
    .vdiag-node-reject strong {
      color: #991b1b;
    }
    .vdiag-node-ok {
      background: #ecfdf5;
      border-color: #6ee7b7;
      border-left: 4px solid #065f46;
      min-width: 320px;
    }
    .vdiag-node-ok strong {
      color: #064e3b;
    }
    .vdiag-arrow-down {
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      color: #065f46;
      margin: 4px 0;
    }
    .vdiag-arrow-down span {
      font-size: 10px;
      font-weight: 600;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      padding: 1px 7px;
      border-radius: 10px;
      margin-right: 4px;
    }
    .vdiag-arrow-split {
      display: flex;
      justify-content: space-around;
      max-width: 340px;
      margin: 3px auto;
      font-size: 15px;
      font-weight: 700;
      color: #065f46;
    }
    .vdiag-split-two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .vdiag-node-sub {
      background: #ffffff;
      border-color: #a7f3d0;
    }

    /* Vector Diagram 6 (KTA Steps) */
    .vdiag-kta-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 9px;
    }
    .vdiag-kta-step {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-top: 3px solid #065f46;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 11px;
      line-height: 1.35;
    }
    .vdiag-kta-step-final {
      background: #ecfdf5;
      border-color: #6ee7b7;
      border-top-color: #b45309;
    }
    .vdiag-kta-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      color: #065f46;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 4px;
      padding: 1px 6px;
      margin-bottom: 4px;
    }
    .vdiag-kta-step strong {
      display: block;
      font-size: 11.5px;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .vdiag-kta-step span {
      display: block;
      font-size: 10.5px;
      color: #475569;
    }

    /* Vector Diagram 7 (17 Innovations 2x2 Clusters) */
    .vdiag-cluster-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 10px;
    }
    .vdiag-cluster-box {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      padding: 9px 10px;
    }
    .vdiag-cluster-title {
      font-size: 11.5px;
      font-weight: 700;
      color: #064e3b;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 4px;
      padding: 4px 8px;
      margin-bottom: 7px;
    }

    /* Tables */
    .table-wrap {
      width: 100%;
      overflow-x: auto;
      margin: 14px 0 18px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
      line-height: 1.45;
    }
    th {
      background-color: #064e3b;
      color: #ffffff;
      font-weight: 600;
    }
    th:nth-child(1) { width: 18%; }
    th:nth-child(2) { width: 23%; }
    th:nth-child(3) { width: 29%; }
    th:nth-child(4) { width: 30%; }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    /* Smart WhatsApp Relay Card */
    .relay-card {
      background: #ffffff;
      border: 1px solid #a7f3d0;
      border-radius: 9px;
      overflow: hidden;
      margin: 14px 0 16px 0;
      box-shadow: 0 2px 8px rgba(6, 78, 59, 0.06);
    }
    .relay-card-head {
      background: #ecfdf5;
      border-bottom: 1px solid #a7f3d0;
      padding: 10px 14px;
    }
    .relay-card-title {
      font-size: 12.5px;
      font-weight: 800;
      color: #065f46;
      letter-spacing: 0.03em;
    }
    .relay-card-sub {
      font-size: 12px;
      color: #047857;
      margin-top: 2px;
    }
    .relay-card-body {
      padding: 12px 14px;
      font-size: 13px;
      color: #1e293b;
    }
    .relay-meta {
      margin-bottom: 8px;
    }
    .relay-msg-label {
      font-size: 11.5px;
      font-weight: 700;
      color: #475569;
      margin-bottom: 5px;
    }
    .relay-msg-bubble {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 3px solid #16a34a;
      border-radius: 6px;
      padding: 9px 12px;
      font-size: 12.5px;
      line-height: 1.5;
      color: #0f172a;
    }
    .relay-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0 14px 12px 14px;
    }
    .relay-btn {
      font-size: 11.5px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 5px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #334155;
    }
    .relay-btn-primary {
      background: #065f46;
      border-color: #064e3b;
      color: #ffffff;
    }

    pre.code-block, details.mermaid-source pre {
      background: #f8fafc;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      padding: 12px 14px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 12px;
      line-height: 1.45;
      font-family: 'Consolas', 'Courier New', ui-monospace, monospace;
    }
    pre.code-block code, details.mermaid-source pre code {
      background: transparent;
      color: inherit;
      padding: 0;
      border: none;
    }
    details.mermaid-source {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 14px;
      margin: 12px 0 18px 0;
    }
    details.mermaid-source summary {
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: #064e3b;
    }
    .closing-block {
      margin-top: 12px;
    }
    .footer-bar {
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid #cbd5e1;
      text-align: center;
      font-size: 12px;
      color: #475569;
    }

    @media (max-width: 700px) {
      .container {
        padding: 22px 16px;
      }
      .vdiag-two-col, .vdiag-cluster-grid, .vdiag-kta-grid, .vdiag-chip-grid-2 {
        grid-template-columns: 1fr;
      }
      .vdiag-decision-row {
        flex-direction: column;
        align-items: stretch;
      }
    }

    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        background: #ffffff;
        padding: 0;
        font-size: 9.8pt;
        line-height: 1.52;
      }
      .container {
        box-shadow: none;
        border: none;
        border-radius: 0;
        padding: 0;
        max-width: 100%;
      }
      h1 {
        font-size: 18pt;
        margin-bottom: 6pt;
        padding-bottom: 6pt;
      }
      .hero-subtitle {
        font-size: 11pt;
        margin: 6pt 0 8pt 0;
      }
      .hero-meta {
        font-size: 9pt;
        padding: 4pt 8pt;
        margin: 3pt 0;
      }
      h2 {
        font-size: 13pt;
        margin-top: 16pt;
        margin-bottom: 7pt;
        break-after: avoid;
        page-break-after: avoid;
      }
      h2.page-break-before-print {
        break-before: page;
        page-break-before: always;
        margin-top: 0;
      }
      h3 {
        font-size: 11pt;
        margin-top: 13pt;
        margin-bottom: 5pt;
        break-after: avoid;
        page-break-after: avoid;
      }
      h4 {
        font-size: 10pt;
        margin-top: 10pt;
        margin-bottom: 3pt;
        break-after: avoid;
        page-break-after: avoid;
      }
      h1, h2, h3, h4,
      h2 + p, h3 + p, h4 + p {
        break-after: avoid;
        page-break-after: avoid;
      }
      p, li {
        font-size: 9.6pt;
        line-height: 1.5;
        orphans: 3;
        widows: 3;
      }
      li:not(:has(ul)):not(:has(ol)) {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      ul ul, ol ol, ul ol, ol ul {
        break-before: avoid;
        page-break-before: avoid;
      }
      hr.section-divider {
        display: none;
      }
      hr.hero-divider {
        margin: 10pt 0;
      }
      .toc-card, .diagram-card, .relay-card, .closing-block, .footer-bar, tr, pre.code-block {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .toc-card {
        padding: 10pt 12pt;
        margin: 12pt 0 0 0;
      }
      .toc-item {
        font-size: 8.6pt;
      }
      .toc-page {
        min-width: 34pt;
      }
      .diagram-card {
        padding: 10pt;
        margin: 10pt 0 12pt 0;
      }
      .diagram-card img {
        max-height: 125mm;
        width: auto;
        max-width: 100%;
      }
      .diagram-caption {
        font-size: 8.5pt;
        margin-top: 6pt;
      }
      .table-wrap {
        overflow: visible;
        margin: 8pt 0 12pt 0;
      }
      thead {
        display: table-header-group;
      }
      th, td {
        font-size: 8.6pt;
        padding: 5pt 7pt;
        line-height: 1.38;
      }
      code {
        font-size: 8.4pt;
      }
      details.mermaid-source {
        display: none;
      }
    }
  </style>
</head>
<body>
<div class="container">
  <div class="header-tag">YAYASAN APOLOGET ISLAM INDONESIA (APII)</div>
  ${bodyHtml}
  <div class="footer-bar">
    Dihasilkan otomatis dari <code>PANDUAN_EKSEKUTIF_DAN_FITUR_SIAP_APII.md</code> oleh SIAP APII Docs Generator
  </div>
</div>
</body>
</html>`;
}

/** Locate an installed Chromium/Edge binary for headless PDF pagination lookup. */
function findBrowserBinary() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : '',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);

  return candidates.find((p) => fs.existsSync(p)) || null;
}

/** Parse Chromium Skia PDF objects to map named #slug destinations to 1-based page numbers. */
function extractPdfTocPages(pdfBuffer) {
  const pdf = pdfBuffer.toString('latin1');
  const objs = new Map();
  const objRe = /(\d+)\s+0\s+obj\b([\s\S]*?)\bendobj/g;
  let m;
  while ((m = objRe.exec(pdf)) !== null) {
    objs.set(m[1], m[2]);
  }

  const catalog = [...objs.values()].find((v) => /\/Type\s*\/Catalog\b/.test(v));
  if (!catalog) return null;

  const pagesMatch = catalog.match(/\/Pages\s+(\d+)\s+0\s+R/);
  if (!pagesMatch) return null;

  const pageIds = [];
  function walkPages(id) {
    const body = objs.get(id) || '';
    if (/\/Type\s*\/Pages\b/.test(body)) {
      const kidsBlock = body.match(/\/Kids\s*\[([\s\S]*?)\]/);
      if (!kidsBlock) return;
      const refRe = /(\d+)\s+0\s+R/g;
      let rm;
      while ((rm = refRe.exec(kidsBlock[1])) !== null) {
        walkPages(rm[1]);
      }
      return;
    }
    pageIds.push(id);
  }
  walkPages(pagesMatch[1]);

  if (!pageIds.length) return null;
  const pageNumByObj = new Map(pageIds.map((id, idx) => [id, idx + 1]));
  const pageMap = new Map();

  const directDests = catalog.match(/\/Dests\s+(\d+)\s+0\s+R/);
  if (directDests && objs.has(directDests[1])) {
    const destsBody = objs.get(directDests[1]);
    const entryRe = /\/([A-Za-z0-9._-]+)\s*\[\s*(\d+)\s+0\s+R\b/g;
    let dm;
    while ((dm = entryRe.exec(destsBody)) !== null) {
      const pageNum = pageNumByObj.get(dm[2]);
      if (pageNum) pageMap.set(dm[1], pageNum);
    }
  }

  return { totalPages: pageIds.length, pageMap };
}

/** Print HTML via headless Chromium to resolve exact A4 printed page numbers for TOC entries. */
function measurePdfPagination(browserPath, htmlContent) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'siap-apii-toc-'));
  const tmpHtmlPath = path.join(tmpDir, 'doc.html');
  const tmpPdfPath = path.join(tmpDir, 'doc.pdf');
  const userDataDir = path.join(tmpDir, 'chrome-profile');
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(tmpHtmlPath, htmlContent, 'utf8');
    execFileSync(
      browserPath,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        `--user-data-dir=${userDataDir}`,
        '--no-pdf-header-footer',
        `--print-to-pdf=${tmpPdfPath}`,
        pathToFileURL(tmpHtmlPath).href
      ],
      { stdio: 'ignore', timeout: 30000 }
    );
    if (!fs.existsSync(tmpPdfPath)) return null;
    return extractPdfTocPages(fs.readFileSync(tmpPdfPath));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** Fill TOC page-number tokens using either a resolved pageMap or fixed-width placeholder. */
function applyTocPages(bodyHtml, pageMap, fallbackLabel = 'Hal. 00') {
  return bodyHtml.replace(/@@TOC_PAGE:([a-z0-9._-]+)@@/gi, (_, slug) => {
    const pageNum = pageMap?.get(slug);
    return pageNum ? `Hal. ${pageNum}` : fallbackLabel;
  });
}

function mapsEqual(a, b) {
  if (!a || !b || a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

const mdRaw = fs.readFileSync(mdPath, 'utf8');
const parsed = parseMarkdownToHtml(mdRaw);

// Final safety strip on generated body to guarantee zero decorative emojis or em-dashes
const cleanBodyTemplate = stripDecorativeGlyphs(parsed.html);
const browserPath = parsed.tocEntries.length ? findBrowserBinary() : null;

let resolved = null;
if (browserPath) {
  let prevMap = null;
  for (let pass = 0; pass < 2; pass++) {
    const candidateBody = applyTocPages(cleanBodyTemplate, prevMap, 'Hal. 00');
    const measured = measurePdfPagination(browserPath, buildDocumentHtml(candidateBody));
    if (!measured || !measured.pageMap.size) break;
    resolved = measured;
    if (prevMap && mapsEqual(prevMap, measured.pageMap)) break;
    prevMap = measured.pageMap;
  }
}

const finalBodyHtml = applyTocPages(cleanBodyTemplate, resolved?.pageMap, '-');
const html = buildDocumentHtml(finalBodyHtml);

fs.writeFileSync(htmlPath, html, 'utf8');
const syncSummary = resolved
  ? `, TOC synced to ${resolved.totalPages} PDF pages (${resolved.pageMap.size}/${parsed.tocEntries.length} chapters)`
  : '';
console.log(
  `Successfully generated PANDUAN_EKSEKUTIF_DAN_FITUR_SIAP_APII.html from markdown (${mdRaw.length} md bytes -> ${html.length} html bytes, ${parsed.headingCount} headings, ${parsed.embeddedDiagrams} diagrams${syncSummary})`
);
