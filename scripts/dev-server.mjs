/**
 * SIAP APII Enterprise v3.1.0
 * Lightweight Zero-Dependency Local Dev Server + Local GAS VM Bridge (/api)
 * Yayasan Apologet Islam Indonesia
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_GAS_PATH = path.join(ROOT_DIR, 'build', 'dist_Code.gs');
const MAX_API_BODY_BYTES = 12 * 1024 * 1024; // 12 MB for base64 file uploads

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
};

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function formatGasDate(dateInput, timeZone, pattern) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';

  // Support Asia/Jakarta / GMT+7 (UTC+7) deterministically regardless of host OS timezone
  const offsetHours = (!timeZone || /jakarta|gmt\+7|wib/i.test(String(timeZone))) ? 7 : 0;
  const shifted = new Date(date.getTime() + offsetHours * 3600 * 1000);

  const yyyy = String(shifted.getUTCFullYear());
  const yy = yyyy.slice(-2);
  const monthIdx = shifted.getUTCMonth();
  const MM = String(monthIdx + 1).padStart(2, '0');
  const MMMM = MONTHS_ID[monthIdx] || MM;
  const MMM = MMMM.slice(0, 3);
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  const HH = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  const ss = String(shifted.getUTCSeconds()).padStart(2, '0');
  const SSS = String(shifted.getUTCMilliseconds()).padStart(3, '0');

  return String(pattern || 'dd-MM-yyyy HH:mm:ss').replace(
    /yyyy|yy|MMMM|MMM|MM|dd|HH|mm|ss|SSS/g,
    (tok) => {
      switch (tok) {
        case 'yyyy': return yyyy;
        case 'yy': return yy;
        case 'MMMM': return MMMM;
        case 'MMM': return MMM;
        case 'MM': return MM;
        case 'dd': return dd;
        case 'HH': return HH;
        case 'mm': return mm;
        case 'ss': return ss;
        case 'SSS': return SSS;
        default: return tok;
      }
    }
  );
}

/**
 * Create an isolated, stateful Google Apps Script runtime mock inside Node vm
 */
function createGasVmRuntime(distCode) {
  const sheetsMap = new Map();
  const scriptProps = new Map();
  const logs = [];
  let lockDepth = 0;

  // Virtual Drive Vault state tracking folders, files, and access levels
  const driveFolders = new Map();
  const driveFiles = new Map();
  let idCounter = 1;
  const nextDriveId = (prefix) => `${prefix}-${Date.now().toString(36)}-${idCounter++}`;

  const DriveAccess = {
    ANYONE: 'ANYONE',
    ANYONE_WITH_LINK: 'ANYONE_WITH_LINK',
    DOMAIN: 'DOMAIN',
    DOMAIN_WITH_LINK: 'DOMAIN_WITH_LINK',
    PRIVATE: 'PRIVATE'
  };

  const DrivePermission = {
    VIEW: 'VIEW',
    EDIT: 'EDIT',
    COMMENT: 'COMMENT',
    OWNER: 'OWNER',
    NONE: 'NONE'
  };

  function makeIterator(items) {
    let idx = 0;
    return {
      hasNext: () => idx < items.length,
      next: () => items[idx++]
    };
  }

  function createMockFile(folderId, name, bytes, mimeType) {
    const fileId = nextDriveId('file');
    const now = new Date();
    const byteArr = Array.isArray(bytes) ? bytes : Array.from(Buffer.from(String(bytes || ''), 'utf8'));
    const record = {
      id: fileId,
      folderId,
      name: String(name || 'untitled'),
      mimeType: String(mimeType || 'application/octet-stream'),
      bytes: byteArr,
      size: byteArr.length,
      createdAt: now,
      updatedAt: now,
      trashed: false,
      trashedAt: null,
      access: DriveAccess.PRIVATE,
      permission: DrivePermission.NONE,
      sharingHistory: []
    };
    driveFiles.set(fileId, record);

    const api = {
      getId: () => record.id,
      getName: () => record.name,
      setName: (n) => { record.name = String(n); return api; },
      getMimeType: () => record.mimeType,
      getSize: () => record.size,
      getDateCreated: () => record.createdAt,
      getLastUpdated: () => record.updatedAt,
      getUrl: () => `http://localhost/local-drive/file/${record.id}`,
      getDownloadUrl: () => `http://localhost/local-drive/download/${record.id}`,
      setSharing: (accessType, permissionType) => {
        record.access = accessType;
        record.permission = permissionType;
        record.sharingHistory.push({
          access: accessType,
          permission: permissionType,
          at: new Date().toISOString()
        });
        return api;
      },
      getSharingAccess: () => record.access,
      getSharingPermission: () => record.permission,
      setTrashed: (flag) => {
        record.trashed = Boolean(flag);
        record.trashedAt = record.trashed ? new Date() : null;
        return api;
      },
      isTrashed: () => record.trashed,
      getBlob: () => ({
        getBytes: () => record.bytes.slice(),
        getDataAsString: () => Buffer.from(record.bytes).toString('utf8'),
        getContentType: () => record.mimeType,
        getName: () => record.name
      })
    };
    record._api = api;
    return api;
  }

  function createMockFolder(parentId, name) {
    const folderId = nextDriveId('fld');
    const record = {
      id: folderId,
      parentId: parentId || null,
      name: String(name || 'Folder'),
      createdAt: new Date(),
      trashed: false,
      access: DriveAccess.PRIVATE,
      permission: DrivePermission.NONE
    };
    driveFolders.set(folderId, record);

    const api = {
      getId: () => record.id,
      getName: () => record.name,
      getUrl: () => `http://localhost/local-drive/folder/${record.id}`,
      createFolder: (subName) => createMockFolder(record.id, subName),
      getFolders: () => {
        const children = [];
        for (const f of driveFolders.values()) {
          if (f.parentId === record.id && !f.trashed) children.push(f._api);
        }
        return makeIterator(children);
      },
      getFoldersByName: (subName) => {
        const matches = [];
        for (const f of driveFolders.values()) {
          if (f.parentId === record.id && !f.trashed && f.name === String(subName)) {
            matches.push(f._api);
          }
        }
        return makeIterator(matches);
      },
      createFile: (blobOrName, content, mimeType) => {
        if (blobOrName && typeof blobOrName.getBytes === 'function') {
          return createMockFile(
            record.id,
            blobOrName.getName(),
            blobOrName.getBytes(),
            blobOrName.getContentType()
          );
        }
        return createMockFile(record.id, blobOrName, content || '', mimeType || 'text/plain');
      },
      getFiles: () => {
        const items = [];
        for (const file of driveFiles.values()) {
          if (file.folderId === record.id && !file.trashed) items.push(file._api);
        }
        return makeIterator(items);
      },
      getFilesByName: (fileName) => {
        const items = [];
        for (const file of driveFiles.values()) {
          if (file.folderId === record.id && !file.trashed && file.name === String(fileName)) {
            items.push(file._api);
          }
        }
        return makeIterator(items);
      },
      setSharing: (accessType, permissionType) => {
        record.access = accessType;
        record.permission = permissionType;
        return api;
      },
      getSharingAccess: () => record.access,
      getSharingPermission: () => record.permission,
      setTrashed: (flag) => { record.trashed = Boolean(flag); return api; },
      isTrashed: () => record.trashed
    };
    record._api = api;
    return api;
  }

  const rootFolder = createMockFolder(null, 'MY_DRIVE_ROOT');

  const DriveApp = {
    Access: DriveAccess,
    Permission: DrivePermission,
    getRootFolder: () => rootFolder,
    createFolder: (name) => createMockFolder(rootFolder.getId(), name),
    getFolderById: (id) => {
      const found = driveFolders.get(id);
      if (!found) throw new Error(`Folder with ID "${id}" not found`);
      return found._api;
    },
    getFileById: (id) => {
      const found = driveFiles.get(id);
      if (!found) throw new Error(`File with ID "${id}" not found`);
      return found._api;
    },
    getFoldersByName: (name) => {
      const matches = [];
      for (const f of driveFolders.values()) {
        if (!f.trashed && f.name === String(name)) matches.push(f._api);
      }
      return makeIterator(matches);
    },
    getFiles: () => {
      const items = [];
      for (const file of driveFiles.values()) {
        if (!file.trashed) items.push(file._api);
      }
      return makeIterator(items);
    },
    getStorageUsed: () => {
      let total = 0;
      for (const file of driveFiles.values()) {
        total += file.size || 0;
      }
      return total;
    },
    getStorageLimit: () => 15 * 1024 * 1024 * 1024 // 15 GB default Google Workspace quota
  };

  function createMockSheet(sheetName) {
    const rows = [];

    function makeRange(row, col, numRows = 1, numCols = 1) {
      if (row < 1 || col < 1) {
        throw new Error(`Invalid range coordinates (${row}, ${col}) on ${sheetName}`);
      }
      const rangeApi = {
        getValues: () => {
          const out = [];
          for (let r = 0; r < numRows; r++) {
            const rowData = rows[row - 1 + r] || [];
            const line = [];
            for (let c = 0; c < numCols; c++) {
              const val = rowData[col - 1 + c];
              line.push(val === undefined ? '' : val);
            }
            out.push(line);
          }
          return out;
        },
        getDisplayValues: () => {
          const out = [];
          for (let r = 0; r < numRows; r++) {
            const rowData = rows[row - 1 + r] || [];
            const line = [];
            for (let c = 0; c < numCols; c++) {
              const val = rowData[col - 1 + c];
              if (val instanceof Date) {
                line.push(formatGasDate(val, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss'));
              } else if (val === null || val === undefined) {
                line.push('');
              } else {
                line.push(String(val));
              }
            }
            out.push(line);
          }
          return out;
        },
        getValue: () => rangeApi.getValues()[0]?.[0] ?? '',
        getDisplayValue: () => rangeApi.getDisplayValues()[0]?.[0] ?? '',
        setValues: (matrix) => {
          for (let r = 0; r < matrix.length; r++) {
            const rIdx = row - 1 + r;
            while (rows.length <= rIdx) rows.push([]);
            const targetRow = rows[rIdx];
            for (let c = 0; c < matrix[r].length; c++) {
              const cIdx = col - 1 + c;
              while (targetRow.length < cIdx) targetRow.push('');
              targetRow[cIdx] = matrix[r][c];
            }
          }
          return rangeApi;
        },
        setValue: (val) => rangeApi.setValues([[val]]),
        setBackground: () => rangeApi,
        setFontColor: () => rangeApi,
        setFontWeight: () => rangeApi,
        setHorizontalAlignment: () => rangeApi,
        setVerticalAlignment: () => rangeApi,
        setWrap: () => rangeApi,
        setNumberFormat: () => rangeApi
      };
      return rangeApi;
    }

    return {
      getName: () => sheetName,
      getLastRow: () => rows.length,
      getLastColumn: () => rows.reduce((max, r) => Math.max(max, r.length), 0),
      appendRow: (arr) => {
        rows.push(Array.isArray(arr) ? arr.slice() : []);
      },
      getRange: (row, col, numRows, numCols) => makeRange(row, col, numRows || 1, numCols || 1),
      deleteRow: (rowIndex) => {
        if (rowIndex >= 1 && rowIndex <= rows.length) {
          rows.splice(rowIndex - 1, 1);
        }
      },
      setFrozenRows: () => {},
      clear: () => { rows.length = 0; },
      _dumpRows: () => rows
    };
  }

  const mockSpreadsheet = {
    getSheetByName: (name) => sheetsMap.get(name) || null,
    insertSheet: (name) => {
      const sheet = createMockSheet(name);
      sheetsMap.set(name, sheet);
      return sheet;
    },
    getSheets: () => Array.from(sheetsMap.values())
  };

  const SpreadsheetApp = {
    getActiveSpreadsheet: () => mockSpreadsheet,
    flush: () => {}
  };

  const LockService = {
    getScriptLock: () => ({
      waitLock: () => { lockDepth++; return true; },
      tryLock: () => { lockDepth++; return true; },
      hasLock: () => lockDepth > 0,
      releaseLock: () => { if (lockDepth > 0) lockDepth--; }
    })
  };

  const Utilities = {
    DigestAlgorithm: {
      SHA_256: 'sha256',
      SHA_512: 'sha512',
      MD5: 'md5'
    },
    Charset: {
      UTF_8: 'utf8',
      US_ASCII: 'ascii'
    },
    computeDigest: (algorithm, value) => {
      const algo = String(algorithm || 'sha256').toLowerCase().replace('_', '');
      const nodeAlgo = algo === 'sha512' ? 'sha512' : algo === 'md5' ? 'md5' : 'sha256';
      const buf = crypto.createHash(nodeAlgo).update(String(value ?? ''), 'utf8').digest();
      // GAS computeDigest returns signed byte array (-128..127)
      return Array.from(buf, (b) => (b > 127 ? b - 256 : b));
    },
    getUuid: () => crypto.randomUUID(),
    formatDate: (date, timeZone, format) => formatGasDate(date, timeZone, format),
    base64Decode: (base64Str) => {
      const buf = Buffer.from(String(base64Str || ''), 'base64');
      return Array.from(buf);
    },
    base64Encode: (data) => {
      if (Array.isArray(data)) {
        return Buffer.from(data.map((b) => (b < 0 ? b + 256 : b))).toString('base64');
      }
      return Buffer.from(String(data || ''), 'utf8').toString('base64');
    },
    newBlob: (data, contentType, name) => {
      const bytes = Array.isArray(data)
        ? data
        : Array.from(Buffer.from(String(data || ''), 'utf8'));
      return {
        getBytes: () => bytes.slice(),
        getDataAsString: () => Buffer.from(bytes).toString('utf8'),
        getContentType: () => contentType || 'application/octet-stream',
        getName: () => name || 'blob'
      };
    }
  };

  const ContentService = {
    MimeType: {
      JSON: 'application/json; charset=utf-8',
      TEXT: 'text/plain; charset=utf-8',
      JAVASCRIPT: 'application/javascript; charset=utf-8',
      XML: 'application/xml; charset=utf-8'
    },
    createTextOutput: (content) => {
      let mime = 'text/plain; charset=utf-8';
      const text = content === undefined || content === null ? '' : String(content);
      const output = {
        setMimeType: (m) => { mime = m; return output; },
        getMimeType: () => mime,
        getContent: () => text
      };
      return output;
    }
  };

  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => (scriptProps.has(k) ? scriptProps.get(k) : null),
      setProperty: (k, v) => { scriptProps.set(k, String(v)); },
      deleteProperty: (k) => { scriptProps.delete(k); },
      getProperties: () => Object.fromEntries(scriptProps.entries())
    })
  };

  const Logger = {
    log: (msg) => {
      const entry = `[${new Date().toISOString()}] ${String(msg)}`;
      logs.push(entry);
      if (logs.length > 300) logs.shift();
    },
    getLog: () => logs.join('\n'),
    clear: () => { logs.length = 0; }
  };

  const Session = {
    getScriptTimeZone: () => 'Asia/Jakarta',
    getActiveUser: () => ({ getEmail: () => 'local-dev@apologetislamindonesia.or.id' })
  };

  const sandbox = {
    SpreadsheetApp,
    Utilities,
    LockService,
    ContentService,
    DriveApp,
    PropertiesService,
    Logger,
    Session,
    console,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent
  };

  const context = vm.createContext(sandbox);
  vm.runInContext(distCode, context, { filename: 'build/dist_Code.gs' });

  // Run idempotent setup() so all 28 tables and seed rows are ready on first API request
  if (typeof context.setup === 'function') {
    context.setup();
  }

  return {
    context,
    sheetsMap,
    driveFiles,
    driveFolders,
    logs
  };
}

let cachedGasRuntime = null;
let cachedGasMtimeMs = 0;

function getGasRuntime() {
  if (!fs.existsSync(DIST_GAS_PATH)) {
    return null;
  }
  const stat = fs.statSync(DIST_GAS_PATH);
  if (!cachedGasRuntime || stat.mtimeMs !== cachedGasMtimeMs) {
    const code = fs.readFileSync(DIST_GAS_PATH, 'utf8');
    cachedGasRuntime = createGasVmRuntime(code);
    cachedGasMtimeMs = stat.mtimeMs;
    console.log(`[GAS-VM] Loaded build/dist_Code.gs (${cachedGasRuntime.sheetsMap.size} sheets initialized)`);
  }
  return cachedGasRuntime;
}

function sendJson(res, statusCode, obj) {
  const payload = JSON.stringify(obj);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

function handleApiBridge(req, res, parsedUrl) {
  let runtime;
  try {
    runtime = getGasRuntime();
  } catch (err) {
    console.error('[GAS-VM] Init error:', err);
    sendJson(res, 500, { ok: false, error: 'Gagal memuat build/dist_Code.gs: ' + err.message });
    return;
  }

  if (!runtime) {
    sendJson(res, 503, {
      ok: false,
      error: 'build/dist_Code.gs belum tersedia. Jalankan "npm run build:gas" terlebih dahulu.'
    });
    return;
  }

  const params = Object.fromEntries(parsedUrl.searchParams.entries());
  const multiParams = {};
  for (const [k, v] of parsedUrl.searchParams.entries()) {
    if (!multiParams[k]) multiParams[k] = [];
    multiParams[k].push(v);
  }

  if (req.method === 'GET') {
    try {
      const output = runtime.context.doGet({ parameter: params, parameters: multiParams });
      const body = output && typeof output.getContent === 'function'
        ? output.getContent()
        : JSON.stringify(output);
      const mime = output && typeof output.getMimeType === 'function'
        ? output.getMimeType()
        : 'application/json; charset=utf-8';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
      res.end(body);
    } catch (err) {
      console.error('[GAS-VM] doGet error:', err);
      sendJson(res, 500, { ok: false, error: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    const chunks = [];
    let totalBytes = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_API_BODY_BYTES) {
        aborted = true;
        sendJson(res, 413, { ok: false, error: 'Payload terlalu besar (> 12 MB).' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (aborted) return;
      const rawBody = Buffer.concat(chunks).toString('utf8');
      try {
        const output = runtime.context.doPost({
          parameter: params,
          parameters: multiParams,
          postData: {
            contents: rawBody,
            length: rawBody.length,
            type: req.headers['content-type'] || 'application/json'
          }
        });
        const body = output && typeof output.getContent === 'function'
          ? output.getContent()
          : JSON.stringify(output);
        const mime = output && typeof output.getMimeType === 'function'
          ? output.getMimeType()
          : 'application/json; charset=utf-8';
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
        res.end(body);
      } catch (err) {
        console.error('[GAS-VM] doPost error:', err);
        sendJson(res, 500, { ok: false, error: err.message });
      }
    });
    return;
  }

  sendJson(res, 405, { ok: false, error: `Method ${req.method} tidak didukung pada /api.` });
}

function getFilePath(requestUrl) {
  const parsed = new URL(requestUrl, 'http://localhost');
  const pathname = decodeURIComponent(parsed.pathname);

  if (pathname === '/' || pathname === '') {
    return path.join(ROOT_DIR, 'public', 'index.html');
  }
  if (pathname === '/portal/') {
    return path.join(ROOT_DIR, 'portal', 'index.html');
  }
  if (pathname === '/public/') {
    return path.join(ROOT_DIR, 'public', 'index.html');
  }

  // Prevent path traversal
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(ROOT_DIR, safePath);

  if (fs.existsSync(fullPath)) {
    if (fs.statSync(fullPath).isDirectory()) {
      const candidateIndex = path.join(fullPath, 'index.html');
      if (fs.existsSync(candidateIndex)) {
        return candidateIndex;
      }
    }
    return fullPath;
  }

  // Root-level public SPA assets fallback (./config.js, ./app.js, ./sw.js, etc. when loaded via http://localhost:PORT/)
  const firstSegment = safePath.replace(/^[\/\\]+/, '').split(/[\/\\]/)[0].toLowerCase();
  const reservedTopDirs = ['portal', 'apps-script', 'build', 'scripts', 'docs', '.git', 'node_modules'];
  if (!reservedTopDirs.includes(firstSegment)) {
    const publicFallbackPath = path.join(ROOT_DIR, 'public', safePath);
    if (fs.existsSync(publicFallbackPath)) {
      if (fs.statSync(publicFallbackPath).isDirectory()) {
        const candidateIndex = path.join(publicFallbackPath, 'index.html');
        if (fs.existsSync(candidateIndex)) {
          return candidateIndex;
        }
      }
      return publicFallbackPath;
    }
  }

  return fullPath;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // [T-03] Trailing-slash 302 redirect so relative ./assets resolve properly
  if (pathname === '/portal' || pathname === '/public') {
    const location = `${pathname}/${parsedUrl.search}`;
    res.writeHead(302, { Location: location });
    res.end();
    return;
  }

  // [T-05] Local /api GAS VM Bridge (GET /api & POST /api)
  if (pathname === '/api' || pathname === '/api/') {
    handleApiBridge(req, res, parsedUrl);
    return;
  }

  // [T-04] All dynamic ?dpw=<slug> parameters pass directly to /public/index.html SPA
  const filePath = getFilePath(req.url);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="id">
        <head><meta charset="utf-8"><title>404 Not Found - SIAP APII</title></head>
        <body style="font-family:sans-serif;padding:40px;text-align:center;background:#f7f9fb;color:#191c1e">
          <h1 style="color:#003527">404 - Halaman Tidak Ditemukan</h1>
          <p>Berkas yang Anda tuju tidak ditemukan di server lokal SIAP APII.</p>
          <div style="margin-top:20px;">
            <a href="/" style="display:inline-block;padding:10px 20px;background:#003527;color:white;text-decoration:none;border-radius:8px;">Kembali ke Beranda Resmi APII</a>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

const DEFAULT_PORT = Number(process.env.PORT) || 3000;

function startServer(port) {
  server.listen(port, '0.0.0.0', () => {
    console.log('\n=============================================================');
    console.log('  SIAP APII ENTERPRISE v3.1.0 - LIVE DEV SERVER RUNNING');
    console.log('  Yayasan Apologet Islam Indonesia');
    console.log('=============================================================');
    console.log(`  -> Portal Publik          : http://localhost:${port}/`);
    console.log(`  -> Portal Pengurus (SPA)  : http://localhost:${port}/portal/`);
    console.log(`  -> Dynamic DPW Route      : http://localhost:${port}/?dpw=jabo (dan slug DPW dinamis lainnya)`);
    console.log(`  -> Local GAS VM Bridge    : http://localhost:${port}/api`);
    console.log('-------------------------------------------------------------');
    console.log('  * Auto-Demo + Local GAS VM Bridge siap digunakan.');
    console.log('  * Tekan Ctrl+C untuk menghentikan server.');
    console.log('=============================================================\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[WARN] Port ${port} sedang digunakan, mencoba port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('[ERROR] Gagal menjalankan server:', err);
    }
  });
}

startServer(DEFAULT_PORT);
