## 📋 Deskripsi Perubahan
<!-- Jelaskan secara singkat tujuan PR ini dan perubahan apa saja yang dibuat -->

## 🔗 Referensi Kebutuhan
- Kategori: [FR / Bugfix / Refactoring / Infrastructure]
- Terkait dengan PRD/DESIGN.md: [Misal: FR-AUTH-01, FR-FIN-02, DESIGN §5.3]

---

## 🛡️ Checklist Definition of Done (PROJECT_RULES.md)

Pastikan semua kriteria berikut terpenuhi sebelum meminta review:

- [ ] **TypeScript & Linting**: Kode lulus `npm run lint` tanpa error dan tanpa `any` liar.
- [ ] **Kompilasi & Build**: Lulus `npm run build` tanpa peringatan kompilasi.
- [ ] **Validasi Skema & Migrasi**: Jika ada perubahan Prisma schema:
  - [ ] Migrasi bersifat *backward compatible* (expand-and-contract).
  - [ ] Lulus validasi urutan dependensi `npm run migrate:validate`.
- [ ] **Pengujian Otomatis**:
  - [ ] Unit tests baru/diperbarui (`npm test`).
  - [ ] E2E tests mencakup alur baru (`npm run test:e2e`).
- [ ] **Isolasi Divisi & RBAC**:
  - [ ] Akses lintas divisi terisolasi dengan `@UseGuards(DivisionGuard)` jika relevan.
  - [ ] Penolakan akses menghasilkan audit event `CROSS_DIVISION_DENIED`.
- [ ] **Audit Trail & Keamanan**:
  - [ ] Aksi mutasi penting (persuratan, keuangan, approval) tercatat di `audit_logs` dan `EventsBusService`.
  - [ ] Response API mengikuti format envelope standar `{ success, code, data, meta }`.
- [ ] **Dokumentasi**:
  - [ ] OpenAPI di-export ulang jika ada perubahan endpoint (`npm run openapi:export`).
  - [ ] Dokumen terkait diperbarui (`docs/DESIGN.md` / `docs/deploy.md` jika relevan).
