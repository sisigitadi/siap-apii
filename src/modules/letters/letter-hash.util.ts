/**
 * Utilitas integritas dokumen surat resmi (FR-LETTER-05 & DESIGN.md §6.3).
 *
 * Algoritma SHA-256 kanonik DIJAGA TETAP SAMA di seluruh aplikasi: modul surat,
 * prisma/seed.ts, dan turunannya wajib memakai fungsi di file ini supaya sebuah
 * dokumen selalu menghasilkan sidik jari yang identik walau dihitung ulang.
 */

/** Field yang dihitung sebagai sidik jari integritas dokumen. */
export interface LetterHashPayload {
  letter_number: string;
  title: string;
  letter_type: string;
  content_payload: unknown;
  kop_config: unknown;
  signatories: unknown;
}

/**
 * Serialisasi kanonik rekursif: urutkan key setiap objek (termasuk nested)
 * secara abjad supaya SHA-256 stabil walau driver/Postgres jsonb menyusun ulang
 * urutan key (FR-LETTER-05 — integritas harus diverifikasi setelah round-trip DB).
 * Array dipertahankan urutannya (urutan penandatangan & konsiderans bermakna).
 */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(record[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Hitung sidik jari SHA-256 (heksadesimal 64 karakter) dari payload kanonik.
 * Parameter hash di-inject agar mudah diuji tanpa memanggil Node crypto langsung.
 */
export function computeLetterHash(
  payload: LetterHashPayload,
  hashImpl: (data: string) => string,
): string {
  return hashImpl(JSON.stringify(canonicalize(payload)));
}
