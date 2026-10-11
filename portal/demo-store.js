/**
 * demo-store.js — In-Memory Sandbox Data & Simulation Engine untuk SIAPII
 * ============================================================================
 * Menyediakan lingkungan simulasi UI/UX interaktif 100% aman:
 * - Data realistis (surat, kas, divisi, pendaftar, audit, settings).
 * - Aksi mutasi (POST) dieksekusi di memori tanpa memodifikasi database riil yayasan.
 * - Umpan balik edukatif langkah-demi-langkah sesuai tata kelola organisasi APII.
 * ============================================================================
 */
(function () {
  'use strict';

  var DemoStore = {
    initialized: false,
    data: {},

    /** Mengembalikan data simulasi ke kondisi awal */
    reset: function () {
      this.initialized = false;
      this.init();
      return true;
    },

    /** Inisialisasi basis data simulasi di memori. */
    init: function () {
      if (this.initialized) return;

      var now = new Date();
      var year = now.getFullYear();
      var dateStr = now.toISOString().slice(0, 10);

      this.data = {
        surat: [
          {
            id: 1,
            letter_number: '001/APII-JABO/SK/I/' + year,
            title: 'SK Penetapan Susunan Pengurus & Divisi Kerja DPW APII Jabodetabek 2026-2031',
            letter_type: 'SK',
            letter_type_label: 'Surat Keputusan (SK)',
            status: 'PUBLISHED',
            status_label: 'Diterbitkan',
            signer_name: 'Ustadz Muhammad Hanafi',
            signer_role: 'Ketua Umum',
            content: 'Menimbang dan memutuskan struktur dewan pengurus wilayah dan 4 divisi kerja APII Jabodetabek periode 2026-2031...',
            notes: 'Telah disahkan resmi dengan stempel dinas dan diarsipkan.',
            created_by: 'Sigit Adi Irianto',
            created_by_name: 'Sigit Adi Irianto (Sekretaris Umum)',
            tanggal: year + '-01-10',
            tanggal_surat: year + '-01-10',
            tanggal_label: '10 Jan ' + year,
            pdf_url: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=600',
            qr_verify_url: 'https://siapii.sigitadi.id/#/verifikasi?no=001-APII-JABO-SK'
          },
          {
            id: 2,
            letter_number: '004/APII-JABO/SK/X/' + year,
            title: 'SK Pembentukan Panitia Rapat Kerja Wilayah & Silaturahmi Akbar DPW',
            letter_type: 'SK',
            letter_type_label: 'Surat Keputusan (SK)',
            status: 'PENDING_APPROVAL',
            status_label: 'Menunggu Persetujuan',
            signer_name: 'Ustadz Muhammad Hanafi',
            signer_role: 'Ketua Umum',
            content: 'Membentuk kepanitiaan bersama 4 divisi kerja untuk pelaksanaan Rapat Kerja Wilayah ke-1 tahun 2026.',
            notes: 'Menunggu tanda tangan digital dan pengesahan Ketua Umum.',
            created_by: 'Sigit Adi Irianto',
            created_by_name: 'Sigit Adi Irianto (Sekretaris Umum)',
            tanggal: dateStr,
            tanggal_surat: dateStr,
            tanggal_label: '11 Okt ' + year
          },
          {
            id: 3,
            letter_number: '012/APII-JABO/UND/X/' + year,
            title: 'Undangan Rapat Pleno Koordinasi Program Kerja 4 Divisi Wilayah',
            letter_type: 'UNDANGAN',
            letter_type_label: 'Surat Undangan',
            status: 'PENDING_APPROVAL',
            status_label: 'Menunggu Persetujuan',
            signer_name: 'Sigit Adi Irianto',
            signer_role: 'Sekretaris Umum',
            content: 'Mengundang seluruh ketua dan anggota divisi untuk memaparkan rencana aksi triwulan ke-4 di Kantor Sekretariat APII.',
            notes: 'Draft naskah siap diajukan ke pimpinan wilayah.',
            created_by: 'Sigit Adi Irianto',
            created_by_name: 'Sigit Adi Irianto (Sekretaris Umum)',
            tanggal: dateStr,
            tanggal_surat: dateStr,
            tanggal_label: '11 Okt ' + year
          },
          {
            id: 4,
            letter_number: '005/APII-JABO/TUGAS/IX/' + year,
            title: 'Surat Tugas Delegasi Muktamar Nasional APII di Yogyakarta',
            letter_type: 'TUGAS',
            letter_type_label: 'Surat Tugas',
            status: 'PUBLISHED',
            status_label: 'Diterbitkan',
            signer_name: 'Ustadz Muhammad Hanafi',
            signer_role: 'Ketua Umum',
            content: 'Menugaskan pengurus harian DPW Jabodetabek untuk menghadiri dan mewakili wilayah dalam Muktamar Nasional.',
            notes: 'Selesai dilaksanakan dan laporan delegasi telah diserahkan.',
            created_by: 'Sigit Adi Irianto',
            created_by_name: 'Sigit Adi Irianto (Sekretaris Umum)',
            tanggal: year + '-09-25',
            tanggal_surat: year + '-09-25',
            tanggal_label: '25 Sep ' + year,
            pdf_url: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=600',
            qr_verify_url: 'https://siapii.sigitadi.id/#/verifikasi?no=005-APII-JABO-TUGAS'
          },
          {
            id: 5,
            letter_number: '003/APII-JABO/EDR/VIII/' + year,
            title: 'Surat Edaran Sosialisasi Program Wakaf Produktif & Pengembangan Bisnis',
            letter_type: 'EDARAN',
            letter_type_label: 'Surat Edaran',
            status: 'PUBLISHED',
            status_label: 'Diterbitkan',
            signer_name: 'Ustadz Muhammad Hanafi',
            signer_role: 'Ketua Umum',
            content: 'Himbauan kepada seluruh jajaran anggota yayasan mengenai partisipasi wakaf produktif fasilitas umat.',
            notes: 'Diterbitkan ke seluruh cabang.',
            created_by: 'Sigit Adi Irianto',
            created_by_name: 'Sigit Adi Irianto (Sekretaris Umum)',
            tanggal: year + '-08-15',
            tanggal_surat: year + '-08-15',
            tanggal_label: '15 Agu ' + year,
            pdf_url: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=600',
            qr_verify_url: 'https://siapii.sigitadi.id/#/verifikasi?no=003-APII-JABO-EDARAN'
          },
          {
            id: 6,
            letter_number: 'DRAFT-008/APII-JABO/X/' + year,
            title: 'Konsep Kerjasama Kemitraan Strategis Dakwah dengan Ormas Mitra',
            letter_type: 'SK',
            letter_type_label: 'Surat Keputusan (SK)',
            status: 'DRAFT',
            status_label: 'Draf',
            signer_name: 'Sigit Adi Irianto',
            signer_role: 'Sekretaris Umum',
            content: 'Naskah kesepahaman bersama pembinaan da\'i muda di wilayah Jabodetabek...',
            notes: 'Masih dalam penyusunan draf oleh sekretaris umum.',
            created_by: 'Sigit Adi Irianto',
            created_by_name: 'Sigit Adi Irianto (Sekretaris Umum)',
            tanggal: dateStr,
            tanggal_surat: dateStr,
            tanggal_label: '11 Okt ' + year
          }
        ],

        keuangan: [
          {
            id: 1,
            voucher_number: 'VOU-' + year + '-0001',
            type: 'MASUK',
            amount: 25000000,
            amount_label: 'Rp 25.000.000',
            description: 'Penerimaan Infaq & Donasi Pembangunan Gedung Dakwah Keumatan',
            account_code: 'KAS_BSI',
            account_label: 'Kas Operasional BSI',
            status: 'APPROVED',
            status_label: 'Disetujui',
            receipt_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500',
            tanggal: year + '-10-01',
            tanggal_label: '01 Okt ' + year,
            verified_by_bendahara: true,
            verified_by_ketum: true
          },
          {
            id: 2,
            voucher_number: 'VOU-' + year + '-0002',
            type: 'KELUAR',
            amount: 8500000,
            amount_label: 'Rp 8.500.000',
            description: 'Pengadaan Laptop Operasional & Perangkat Kesekretariatan DPW',
            account_code: 'KAS_BSI',
            account_label: 'Kas Operasional BSI',
            status: 'APPROVED',
            status_label: 'Disetujui',
            receipt_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500',
            tanggal: year + '-10-03',
            tanggal_label: '03 Okt ' + year,
            verified_by_bendahara: true,
            verified_by_ketum: true
          },
          {
            id: 3,
            voucher_number: 'VOU-' + year + '-0003',
            type: 'KELUAR',
            amount: 3250000,
            amount_label: 'Rp 3.250.000',
            description: 'Biaya Konsumsi & Logistik Rapat Pleno Koordinasi Program Kerja',
            account_code: 'BRANKAS',
            account_label: 'Brankas Tunai Sekretariat',
            status: 'VERIFIED_BY_BENDAHARA',
            status_label: 'Verifikasi Bendahara',
            receipt_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500',
            tanggal: year + '-10-07',
            tanggal_label: '07 Okt ' + year,
            verified_by_bendahara: true,
            verified_by_ketum: false
          },
          {
            id: 4,
            voucher_number: 'VOU-' + year + '-0004',
            type: 'MASUK',
            amount: 50000000,
            amount_label: 'Rp 50.000.000',
            description: 'Donasi Wakaf Produktif Pengadaan Ambulans Siaga Ummat',
            account_code: 'MANDIRI_WAKAF',
            account_label: 'Bank Mandiri Rekening Wakaf',
            status: 'APPROVED',
            status_label: 'Disetujui',
            receipt_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500',
            tanggal: year + '-10-05',
            tanggal_label: '05 Okt ' + year,
            verified_by_bendahara: true,
            verified_by_ketum: true
          },
          {
            id: 5,
            voucher_number: 'VOU-' + year + '-0005',
            type: 'KELUAR',
            amount: 1500000,
            amount_label: 'Rp 1.500.000',
            description: 'Biaya Percetakan Brosur & Spanduk Publikasi Divisi Humas',
            account_code: 'KAS_BSI',
            account_label: 'Kas Operasional BSI',
            status: 'PENDING',
            status_label: 'Menunggu Verifikasi',
            receipt_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500',
            tanggal: dateStr,
            tanggal_label: '11 Okt ' + year,
            verified_by_bendahara: false,
            verified_by_ketum: false
          }
        ],

        saldo: {
          total_masuk: 75000000,
          total_keluar: 13250000,
          saldo: 61750000,
          saldo_bsi: 16500000,
          saldo_brankas: 5250000,
          saldo_mandiri: 40000000
        },

        accounts: [
          { id: 'KAS_BSI', code: 'KAS_BSI', name: 'Kas Operasional BSI', number: '7123456789', bank: 'Bank Syariah Indonesia' },
          { id: 'BRANKAS', code: 'BRANKAS', name: 'Brankas Tunai Sekretariat', number: 'BRK-01', bank: 'Kas Fisik Kantor' },
          { id: 'MANDIRI_WAKAF', code: 'MANDIRI_WAKAF', name: 'Bank Mandiri Rekening Wakaf', number: '1370012345678', bank: 'Bank Mandiri' }
        ],

        divisi: [
          {
            id: 1,
            tracking_id: '#REQ-' + year + '-001',
            program_title: 'Silaturahmi Akbar Tokoh Masyarakat & Ormas Islam se-Jabodetabek',
            title: 'Silaturahmi Akbar Tokoh Masyarakat & Ormas Islam se-Jabodetabek',
            description: 'Konsolidasi dakwah keumatan mempertemukan 150 pimpinan ormas Islam, MUI, dan tokoh masyarakat wilayah Jabodetabek untuk penguatan jejaring kemitraan strategis.',
            division: 'DIV_HUMAS',
            division_label: 'Humas',
            division_name: 'Humas',
            budget_estimate: 12000000,
            budget_label: 'Rp 12.000.000',
            anggaran: 12000000,
            realisasi_anggaran: 0,
            realisasi_label: 'Rp 0',
            target_audience: '150 Tokoh Ormas & Ulama Wilayah',
            execution_date: year + '-11-15',
            tanggal_kegiatan: year + '-11-15',
            tanggal_label: '15 Nov ' + year,
            status: 'PELAKSANAAN',
            status_label: 'Pelaksanaan',
            lifecycle: 'PELAKSANAAN',
            created_by: 'Federico Fachrudin (Ketua Divisi Humas)',
            submitted_by_name: 'Federico Fachrudin (Ketua Divisi Humas)',
            lpj_summary: '',
            lpj_realisasi: 0,
            lpj_url: ''
          },
          {
            id: 2,
            tracking_id: '#REQ-' + year + '-002',
            program_title: 'Bootcamp Jurnalistik Dakwah & Pembuatan Konten Kreatif Medsos',
            title: 'Bootcamp Jurnalistik Dakwah & Pembuatan Konten Kreatif Medsos',
            description: 'Pelatihan intensif 2 hari untuk 50 da\'i muda dan pengelola media sosial masjid dalam memproduksi konten dakwah digital berkualitas tinggi dan anti hoaks.',
            division: 'DIV_SOSMED',
            division_label: 'Sosial Media',
            division_name: 'Sosial Media',
            budget_estimate: 7500000,
            budget_label: 'Rp 7.500.000',
            anggaran: 7500000,
            realisasi_anggaran: 0,
            realisasi_label: 'Rp 0',
            target_audience: '50 Da\'i Muda & Kreator Konten',
            execution_date: year + '-11-20',
            tanggal_kegiatan: year + '-11-20',
            tanggal_label: '20 Nov ' + year,
            status: 'AJUKAN',
            status_label: 'Diajukan',
            lifecycle: 'AJUKAN',
            created_by: 'Sri Maryati (Ketua Divisi Sosial Media)',
            submitted_by_name: 'Sri Maryati (Ketua Divisi Sosial Media)',
            lpj_summary: '',
            lpj_realisasi: 0,
            lpj_url: ''
          },
          {
            id: 3,
            tracking_id: '#REQ-' + year + '-003',
            program_title: 'Kajian Fiqih Kontemporer & Safari Dakwah Wilayah Triwulan III',
            title: 'Kajian Fiqih Kontemporer & Safari Dakwah Wilayah Triwulan III',
            description: 'Safari kajian bulanan keliling 5 wilayah penyangga dengan tema fiqih muamalah kontemporer dan literasi zakat-wakaf produktif bagi generasi muda.',
            division: 'DIV_DAKWAH',
            division_label: 'Dakwah & Pendidikan',
            division_name: 'Dakwah & Pendidikan',
            budget_estimate: 5000000,
            budget_label: 'Rp 5.000.000',
            anggaran: 5000000,
            realisasi_anggaran: 4850000,
            realisasi_label: 'Rp 4.850.000',
            target_audience: '120 Jamaah Masjid Wilayah',
            execution_date: year + '-09-10',
            tanggal_kegiatan: year + '-09-10',
            tanggal_label: '10 Sep ' + year,
            status: 'LPJ_SELESAI',
            status_label: 'LPJ Selesai',
            lifecycle: 'LPJ_SELESAI',
            created_by: 'Ahmad Daman Huri (Ketua Divisi Dakwah & Pendidikan)',
            submitted_by_name: 'Ahmad Daman Huri (Ketua Divisi Dakwah & Pendidikan)',
            lpj_summary: 'Kegiatan berjalan lancar dihadiri 120 peserta. Seluruh anggaran terealisasi akuntabel.',
            lpj_realisasi: 4850000,
            lpj_notes: 'Kegiatan terlaksana sukses di Aula Masjid Al-Ikhlas. Seluruh nota & kwitansi terlampir rapi dengan efisiensi sisa anggaran Rp 150.000 dikembalikan ke kas BSI.',
            lpj_url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600'
          },
          {
            id: 4,
            tracking_id: '#REQ-' + year + '-004',
            program_title: 'Inkubasi Unit Usaha Mandiri & Pengelolaan Wakaf Produktif Yayasan',
            title: 'Inkubasi Unit Usaha Mandiri & Pengelolaan Wakaf Produktif Yayasan',
            description: 'Pembinaan unit usaha mandiri dan pendampingan kemitraan strategis wakaf produktif untuk kemandirian ekonomi yayasan dan jamaah binaan.',
            division: 'DIV_INVESTASI',
            division_label: 'Pengembangan & Investasi Bisnis',
            division_name: 'Pengembangan & Investasi Bisnis',
            budget_estimate: 8500000,
            budget_label: 'Rp 8.500.000',
            anggaran: 8500000,
            realisasi_anggaran: 0,
            realisasi_label: 'Rp 0',
            target_audience: '50 Pelaku UMKM Komunitas Bina Da\'wah',
            execution_date: year + '-12-05',
            tanggal_kegiatan: year + '-12-05',
            tanggal_label: '05 Des ' + year,
            status: 'DISETUJUI',
            status_label: 'Disetujui',
            lifecycle: 'DISETUJUI',
            created_by: 'Novizal Andriyanto (Ketua Divisi Pengembangan & Bisnis)',
            submitted_by_name: 'Novizal Andriyanto (Ketua Divisi Pengembangan & Bisnis)',
            lpj_summary: '',
            lpj_realisasi: 0,
            lpj_url: ''
          },
          {
            id: 5,
            tracking_id: '#REQ-' + year + '-005',
            program_title: 'Standardisasi Kurikulum Pembinaan Da\'i Muda & Majelis Taklim',
            title: 'Standardisasi Kurikulum Pembinaan Da\'i Muda & Majelis Taklim',
            description: 'Penyusunan modul pelatihan dan standardisasi silabus pembinaan da\'i muda majelis taklim di wilayah DKI Jakarta, Bogor, Depok, Tangerang, dan Bekasi.',
            division: 'DIV_DAKWAH',
            division_label: 'Dakwah & Pendidikan',
            division_name: 'Dakwah & Pendidikan',
            budget_estimate: 4500000,
            budget_label: 'Rp 4.500.000',
            anggaran: 4500000,
            realisasi_anggaran: 0,
            realisasi_label: 'Rp 0',
            target_audience: '80 Da\'i & Pengelola Majelis Taklim',
            execution_date: year + '-12-20',
            tanggal_kegiatan: year + '-12-20',
            tanggal_label: '20 Des ' + year,
            status: 'DRAFT',
            status_label: 'Draf',
            lifecycle: 'DRAFT',
            created_by: 'Ahmad Daman Huri (Ketua Divisi Dakwah & Pendidikan)',
            submitted_by_name: 'Ahmad Daman Huri (Ketua Divisi Dakwah & Pendidikan)',
            lpj_summary: '',
            lpj_realisasi: 0,
            lpj_url: ''
          }
        ],

        pendaftar: [
          {
            id: 1,
            reg_number: 'REG-' + year + '-0001',
            registration_no: 'REG-' + year + '-0001',
            nama_lengkap: 'Ust. Muhammad Rofi\'i, Lc., M.Ag.',
            nik: '317101******0001',
            email: 'rofii.da\'i@gmail.com',
            telepon: '0812-1122-3344',
            whatsapp: '0812-1122-3344',
            alamat: 'Tebet, Jakarta Selatan',
            kota: 'Jakarta Selatan',
            status: 'DIVERIFIKASI_SEKRETARIS',
            status_label: 'Terverifikasi Sekretaris',
            created_at: year + '-10-02',
            tanggal_label: '02 Okt ' + year,
            ktp_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400',
            ktp_image_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400',
            selfie_image_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400'
          },
          {
            id: 2,
            reg_number: 'REG-' + year + '-0002',
            registration_no: 'REG-' + year + '-0002',
            nama_lengkap: 'dr. Fatimah Zahra, Sp.A.',
            nik: '327502******0002',
            email: 'fatimah.zahra.med@gmail.com',
            telepon: '0813-8877-6655',
            whatsapp: '0813-8877-6655',
            alamat: 'Bekasi Barat, Jawa Barat',
            kota: 'Bekasi',
            status: 'PENDING',
            status_label: 'Menunggu Verifikasi',
            created_at: year + '-10-08',
            tanggal_label: '08 Okt ' + year,
            ktp_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400',
            ktp_image_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400',
            selfie_image_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400'
          },
          {
            id: 3,
            reg_number: 'REG-' + year + '-0003',
            registration_no: 'REG-' + year + '-0003',
            nama_lengkap: 'H. Bambang Irawan, S.T., M.M.',
            nik: '367103******0003',
            email: 'bambang.irawan@gmail.com',
            telepon: '0818-5544-3322',
            whatsapp: '0818-5544-3322',
            alamat: 'BSD City, Tangerang Selatan',
            kota: 'Tangerang Selatan',
            status: 'DISETUJUI',
            status_label: 'Disetujui Ketua',
            created_at: year + '-09-18',
            tanggal_label: '18 Sep ' + year,
            ktp_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400',
            ktp_image_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400',
            selfie_image_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400'
          }
        ],

        audit_logs: [
          {
            id: 'LOG-001',
            action: 'LOGIN',
            actor_name: 'Ustadz Muhammad Hanafi (Ketua Umum)',
            details: 'Sesi login berhasil via portal pengurus.',
            ip_address: '182.253.12.44',
            created_at: dateStr + ' 08:30:15'
          },
          {
            id: 'LOG-002',
            action: 'APPROVE_SURAT',
            actor_name: 'Ustadz Muhammad Hanafi (Ketua Umum)',
            details: 'Pengesahan surat resmi SK-001/APII-JABO/I/' + year,
            ip_address: '182.253.12.44',
            created_at: dateStr + ' 08:45:00'
          },
          {
            id: 'LOG-003',
            action: 'CREATE_VOUCHER',
            actor_name: 'Sri Wati (Bendahara Umum)',
            details: 'Pencatatan voucher kas masuk donasi wakaf Rp 50.000.000',
            ip_address: '114.124.8.91',
            created_at: dateStr + ' 09:15:22'
          },
          {
            id: 'LOG-004',
            action: 'VERIFY_VOUCHER',
            actor_name: 'Sri Wati (Bendahara Umum)',
            details: 'Verifikasi kas tahap 1 untuk VOU-' + year + '-0003',
            ip_address: '114.124.8.91',
            created_at: dateStr + ' 09:20:10'
          },
          {
            id: 'LOG-005',
            action: 'SUBMIT_PROGRAM',
            actor_name: 'Federico Fachrudin (Ketua Divisi Humas)',
            details: 'Pengajuan proposal program silaturahmi akbar tokoh umat',
            ip_address: '36.85.190.11',
            created_at: dateStr + ' 10:05:40'
          }
        ],

        settings: {
          organization_name: 'Yayasan APII DPW Jabodetabek',
          legal_number: 'AHU-0012345.AH.01.04.Tahun 2024',
          office_address: 'Gedung Dakwah APII Lt. 3, Jl. Tebet Barat Raya No. 45, Jakarta Selatan',
          contact_phone: '0812-9988-7700',
          contact_email: 'sekretariat@apii-jabo.or.id',
          kop_url: 'logo.png',
          watermark_text: 'DOKUMEN RESMI APII JABODETABEK',
          active_period: '2026 - 2031'
        },

        editorial: {
          hero: {
            badge: 'Penerimaan Anggota Baru ' + year,
            headline: 'Keanggotaan & Kolaborasi Yayasan APII DPW Jabodetabek',
            subheadline: 'Wadah sinergi para ahli, akademisi, dan praktisi pengkaji Islam di Indonesia untuk riset, pemberdayaan, dan kemaslahatan umat.',
            cta_text: 'Info Dokumen & Keuangan Kas',
            cta_link: '#informasi'
          },
          profile: {
            show_section: true,
            ketua_name: 'Ustadz Muhammad Hanafi',
            ketua_title: 'Ketua DPW APII Jabodetabek',
            greeting: "Assalamu'alaikum Warahmatullahi Wabarakatuh. Selamat datang di portal resmi Dewan Pimpinan Wilayah Yayasan Apologet Islam Indonesia (APII) Jabodetabek. Sebagai organisasi yang bergerak di bidang sosial, kemasyarakatan, dan keagamaan, kami berkomitmen mengimplementasikan nilai Islam yang moderat, mentransfer ilmu pengetahuan, serta mempererat ukhuwah islamiah demi kemaslahatan bersama.",
            vision: 'Mengimplementasikan Islam sebagai Agama Rahmatan Lil Alamin',
            missions: [
              'Transfer Ilmu Pengetahuan bagi sesama umat.',
              'Mengoptimalkan digital dan internet sebagai sarana Dakwah.',
              'Dialog perbandingan agama secara online maupun offline.',
              'Bersinergi dengan Individu, Organisasi Islam, dan Instansi Pemerintah/Swasta guna mengukuhkan Ukhuwah Islamiah.'
            ]
          },
          bulletins_events: {
            show_section: true,
            section_title: 'Warta Kelembagaan & Agenda Kegiatan',
            section_subtitle: 'Maklumat resmi, siaran pers pimpinan, serta jadwal acara dan kajian DPW APII Jabodetabek.',
            bulletins: [
              {
                id: 'mak-1',
                title: 'Maklumat Dewan Pimpinan Wilayah tentang Pelaksanaan Dakwah Ramadhan 1447 H',
                category: 'Maklumat Resmi',
                date: year + '-03-01',
                summary: 'Instruksi kepada seluruh jajaran pengurus divisi dan anggota mengenai pedoman dakwah digital dan safari keumatan di 5 wilayah Jabodetabek.',
                link: ''
              }
            ],
            events: [
              {
                id: 'evt-1',
                title: 'Seminar Nasional Litbang: Metodologi Komparasi Agama Kontemporer',
                category: 'Kajian Ilmiah',
                date_str: 'Sabtu, 25 April ' + year,
                time_str: '09.00 - 12.00 WIB',
                location: 'Aula Pusat Dakwah APII & Live Zoom',
                speaker: 'Dewan Pakar APII & Akademisi Tamu',
                link: 'https://forms.gle/apii-seminar-2026',
                status: 'MENDATANG'
              }
            ]
          },
          contact: {
            address: 'Jl. Kramat Raya No. 45, Senen, Jakarta Pusat 10450',
            email: 'sekretariat@apii.sigitadi.id',
            whatsapp_helpdesk: '081288882026',
            service_hours: 'Senin - Sabtu, 08.30 - 16.30 WIB'
          },
          social: {
            youtube: 'https://youtube.com/@apii_official',
            instagram: 'https://instagram.com/apii_jabodetabek',
            whatsapp_channel: 'https://whatsapp.com/channel/apii-jabo',
            facebook: '',
            tiktok: ''
          },
          faqs: [
            {
              q: 'Siapa yang dapat mendaftar sebagai anggota APII DPW Jabodetabek?',
              a: 'Warga negara Indonesia beragama Islam yang berdomisili atau beraktivitas di wilayah Jakarta, Bogor, Depok, Tangerang, dan Bekasi, serta bersedia mematuhi AD/ART yayasan.'
            },
            {
              q: 'Apakah pendaftaran anggota dipungut biaya?',
              a: 'Tidak ada biaya pendaftaran. Keanggotaan terbuka dan bebas biaya administrasi registrasi.'
            },
            {
              q: 'Bagaimana perlindungan data pribadi saya dijamin?',
              a: 'Seluruh berkas pendaftaran diproteksi sesuai amanat UU PDP No. 27/2022. Unggahan foto KTP diberi cap digital langsung di peramban sebelum dikirim ke peladen.'
            }
          ]
        }
      };

      this.initialized = true;
    },

    /**
     * Mengambil data baca (GET) dari sandbox memori
     */
    get: function (action, payload, user) {
      this.init();
      var u = user || {};
      var role = u.role || 'KETUA';

      // Dukung akses langsung ke array koleksi data: DemoStore.get('surat') dll.
      if (this.data && this.data[action] !== undefined && !payload) {
        return this.data[action];
      }

      switch (action) {
        case 'getDashboard':
        case 'dashboard':
          return this.getDashboardData(role);

        case 'getListSurat':
        case 'surat':
          var q = ((payload && payload.q) || '').toLowerCase();
          var st = (payload && payload.status) || '';
          var sFiltered = this.data.surat.filter(function (it) {
            var matchQ = !q || (it.title.toLowerCase().indexOf(q) !== -1 || it.letter_number.toLowerCase().indexOf(q) !== -1);
            var matchSt = !st || it.status === st;
            return matchQ && matchSt;
          });
          return { items: sFiltered, total: sFiltered.length };

        case 'getListKeuangan':
          var kq = ((payload && payload.q) || '').toLowerCase();
          var kst = (payload && payload.status) || '';
          var kFiltered = this.data.keuangan.filter(function (it) {
            var matchQ = !kq || (it.description.toLowerCase().indexOf(kq) !== -1 || it.voucher_number.toLowerCase().indexOf(kq) !== -1);
            var matchSt = !kst || it.status === kst;
            return matchQ && matchSt;
          });
          return { items: kFiltered, total: kFiltered.length };

        case 'getSaldo':
          return this.data.saldo;

        case 'getAccounts':
          return this.data.accounts;

        case 'getListDivisi':
          var dq = ((payload && payload.q) || '').toLowerCase();
          var dst = (payload && payload.status) || '';
          var isDivisionRole = role === 'KETUA_DIVISI' || role === 'ANGGOTA_DIVISI';
          var isSuper = role === 'SUPERADMIN';
          var isKetua = role === 'KETUA';
          var dFiltered = this.data.divisi.filter(function (it) {
            var matchQ = !dq || (
              (it.program_title || it.title || '').toLowerCase().indexOf(dq) !== -1 ||
              (it.division_label || it.division_name || '').toLowerCase().indexOf(dq) !== -1 ||
              (it.tracking_id || '').toLowerCase().indexOf(dq) !== -1 ||
              (it.description || '').toLowerCase().indexOf(dq) !== -1
            );
            var matchSt = !dst || it.status === dst || it.lifecycle === dst;
            return matchQ && matchSt;
          }).map(function (it) {
            var item = Object.assign({}, it);
            item.can_edit = item.status === 'DRAFT' && (isDivisionRole || isSuper);
            item.can_submit = item.status === 'DRAFT' && (isDivisionRole || isSuper);
            item.can_start = item.status === 'DISETUJUI' && (isDivisionRole || isSuper || isKetua);
            item.can_lpj = (item.status === 'PELAKSANAAN' || item.status === 'DISETUJUI') && (isDivisionRole || isSuper);
            return item;
          });
          return { items: dFiltered, total: dFiltered.length };

        case 'getListPendaftar':
          var pq = ((payload && payload.q) || '').toLowerCase();
          var pst = (payload && payload.status) || '';
          var pFiltered = this.data.pendaftar.filter(function (it) {
            var matchQ = !pq || (it.nama_lengkap.toLowerCase().indexOf(pq) !== -1 || it.reg_number.toLowerCase().indexOf(pq) !== -1);
            var matchSt = !pst || it.status === pst;
            return matchQ && matchSt;
          });
          return { items: pFiltered, total: pFiltered.length };

        case 'getListPengguna':
          var userList = Object.keys(window.DEMO_USER_PROFILES || {}).filter(function (k) {
            return k !== 'superadmin';
          }).map(function (k, idx) {
            var p = window.DEMO_USER_PROFILES[k];
            if (!p || p.role === 'SUPERADMIN' || p.username === 'superadmin') return null;
            return {
              id: idx + 1,
              username: p.username,
              full_name: p.full_name,
              role: p.role,
              role_label: p.role_label,
              division: p.division,
              division_label: p.division_label,
              email: p.email,
              phone: p.phone,
              status: 'ACTIVE',
              is_active: 'TRUE'
            };
          }).filter(Boolean);
          return {
            users: userList,
            items: userList,
            total: userList.length
          };

        case 'getAuditLogs':
          return { items: this.data.audit_logs, total: this.data.audit_logs.length };

        case 'getSettings':
          return this.data.settings;

        case 'getEditorialContent':
          return { data: this.data.editorial, editorial: this.data.editorial, can_edit: true };

        default:
          return null;
      }
    },

    /**
     * Rakit paket data dashboard terintegrasi sesuai peran aktif
     */
    getDashboardData: function (role) {
      var actionItems = [];
      var year = new Date().getFullYear();

      if (role === 'KETUA') {
        actionItems = [
          {
            id: 2,
            module: 'surat',
            target_nav: 'surat',
            badge: 'Menunggu Persetujuan Ketua',
            badge_class: 'badge-PENDING_APPROVAL',
            subtitle: 'Surat Resmi SK-004',
            title: 'SK Pembentukan Panitia Rapat Kerja Wilayah & Silaturahmi Akbar DPW',
            detail: 'Naskah surat dinas telah disiapkan Sekretaris DPW. Buka pratinjau Kertas Virtual A4 (KOP & stempel) lalu sahkan naskah.',
            action_label: 'Tinjau & Setujui Surat'
          },
          {
            id: 3,
            module: 'keuangan',
            target_nav: 'keuangan',
            badge: 'Dual-Approval Kas Tahap 2',
            badge_class: 'badge-VERIFIED_BY_BENDAHARA',
            subtitle: 'Voucher Kas Keluar Rp 3.250.000',
            title: 'Biaya Konsumsi & Logistik Rapat Pleno Koordinasi Program Kerja',
            detail: 'Telah diverifikasi tahap 1 oleh Bendahara DPW. Memerlukan pengesahan Ketua DPW untuk pelepasan dana.',
            action_label: 'Sahkan Pengeluaran'
          },
          {
            id: 2,
            module: 'divisi',
            target_nav: 'divisi',
            badge: 'Usulan Program Divisi',
            badge_class: 'badge-AJUKAN',
            subtitle: 'Divisi Media Sosial (Rp 7.500.000)',
            title: 'Bootcamp Jurnalistik Dakwah & Pembuatan Konten Kreatif Medsos',
            detail: 'Proposal kegiatan diajukan ke pimpinan wilayah untuk otorisasi jadwal dan alokasi pagu anggaran.',
            action_label: 'Otorisasi Proposal'
          }
        ];
      } else if (role === 'SEKRETARIS') {
        actionItems = [
          {
            id: 2,
            module: 'pengaturan',
            target_nav: 'pengaturan',
            badge: 'Verifikasi Berkas UU PDP',
            badge_class: 'badge-PENDING',
            subtitle: 'Pendaftar REG-' + year + '-0002',
            title: 'dr. Fatimah Zahra, Sp.A. (Calon Anggota APII)',
            detail: 'Biodata & berkas foto KTP baru masuk dari formulir publik. Verifikasi identitas pemohon sesuai UU PDP No. 27/2022.',
            action_label: 'Verifikasi KTP'
          },
          {
            id: 3,
            module: 'surat',
            target_nav: 'surat',
            badge: 'Draft Naskah Dinas',
            badge_class: 'badge-DRAFT',
            subtitle: 'Undangan Pleno Wilayah',
            title: 'Undangan Rapat Pleno Koordinasi Program Kerja 7 Divisi Wilayah',
            detail: 'Nomor surat telah direservasi otomatis. Buka pratinjau naskah dan ajukan ke Ketua DPW.',
            action_label: 'Ajukan ke Ketua'
          }
        ];
      } else if (role === 'BENDAHARA') {
        actionItems = [
          {
            id: 5,
            module: 'keuangan',
            target_nav: 'keuangan',
            badge: 'Verifikasi Kas Tahap 1',
            badge_class: 'badge-PENDING',
            subtitle: 'Voucher Kas Keluar Rp 1.500.000',
            title: 'Biaya Percetakan Brosur & Spanduk Publikasi Divisi Humas',
            detail: 'Voucher kas baru dicatat. Periksa kelengkapan nota bukti transaksi sebelum verifikasi diteruskan ke Ketua DPW.',
            action_label: 'Verifikasi Bendahara'
          },
          {
            id: 1,
            module: 'keuangan',
            target_nav: 'keuangan',
            badge: 'Siap Cetak Kwitansi',
            badge_class: 'badge-APPROVED',
            subtitle: 'Kas Masuk Rp 25.000.000',
            title: 'Penerimaan Infaq & Donasi Pembangunan Gedung Dakwah Keumatan',
            detail: 'Transaksi telah disahkan. Klik Kwitansi untuk mencetak kwitansi resmi dengan terbilang Rupiah otomatis.',
            action_label: 'Cetak Kwitansi'
          }
        ];
      } else if (role === 'KETUA_DIVISI') {
        actionItems = [
          {
            id: 3,
            module: 'divisi',
            target_nav: 'divisi',
            badge: 'Kewajiban Serahkan LPJ',
            badge_class: 'badge-PELAKSANAAN',
            subtitle: 'Kegiatan Telah Terlaksana',
            title: 'Kajian Fiqih Kontemporer & Safari Dakwah Wilayah Triwulan III',
            detail: 'Kegiatan lapangan telah selesai. Segera unggah laporan pertanggungjawaban & rekapitulasi realisasi dana.',
            action_label: 'Serahkan LPJ'
          },
          {
            id: 1,
            module: 'divisi',
            target_nav: 'divisi',
            badge: 'Program Aktif Berjalan',
            badge_class: 'badge-DISETUJUI',
            subtitle: 'Pagu Anggaran Rp 12.000.000',
            title: 'Silaturahmi Akbar Tokoh Masyarakat & Ormas Islam se-Jabodetabek',
            detail: 'Proposal telah disetujui pimpinan wilayah. Divisi dapat mengeksekusi rangkaian agenda persiapan.',
            action_label: 'Pantau Stepper Program'
          }
        ];
      } else {
        // Pembina / Pengawas / Superadmin / Anggota Divisi
        actionItems = [
          {
            id: 1,
            module: 'surat',
            target_nav: 'surat',
            badge: 'Audit Arsip Dinas',
            badge_class: 'badge-PUBLISHED',
            subtitle: 'SK Nomor 001/APII-JABO/SK/I/' + year,
            title: 'SK Penetapan Susunan Pengurus DPW APII Jabodetabek Periode 2026-2031',
            detail: 'Telah terbit dengan stempel digital resmi yayasan. Siap diaudit kesesuaiannya dengan AD/ART organisasi.',
            action_label: 'Buka Arsip Surat'
          },
          {
            id: 4,
            module: 'keuangan',
            target_nav: 'keuangan',
            badge: 'Audit Akuntabilitas Kas',
            badge_class: 'badge-APPROVED',
            subtitle: 'Rekening Wakaf Mandiri',
            title: 'Donasi Wakaf Produktif Pengadaan Ambulans Siaga Ummat (Rp 50.000.000)',
            detail: 'Pencatatan kas masuk terotorisasi ganda (Dual-Approval) dengan lampiran nota transfer perbankan.',
            action_label: 'Audit Buku Kas'
          }
        ];
      }

      var counts = {
        surat_total: this.data.surat.length,
        surat_pending: this.data.surat.filter(function (s) { return s.status === 'PENDING_APPROVAL'; }).length,
        saldo: (this.data.saldo && this.data.saldo.saldo) || 54250000,
        total_masuk: (this.data.saldo && this.data.saldo.total_masuk) || 75000000,
        total_keluar: (this.data.saldo && this.data.saldo.total_keluar) || 20750000,
        keuangan_total: this.data.keuangan.length,
        keuangan_pending: this.data.keuangan.filter(function (k) { return k.status === 'PENDING' || k.status === 'VERIFIED_BY_BENDAHARA'; }).length,
        divisi_total: this.data.divisi.length,
        divisi_pending: this.data.divisi.filter(function (d) { return d.status === 'AJUKAN'; }).length,
        pengguna_total: Object.keys(window.DEMO_USER_PROFILES || {}).length || 8
      };

      var listSurat = this.data.surat.slice(0, 5);

      return {
        action_items: actionItems,
        counts: counts,
        stats: {
          surat_count: this.data.surat.length,
          kas_balance: 'Rp ' + Number(counts.saldo).toLocaleString('id-ID'),
          saldo_num: counts.saldo,
          pendaftar_count: this.data.pendaftar.length,
          program_count: this.data.divisi.length
        },
        lists: {
          surat_terbaru: listSurat
        },
        surat_terbaru: listSurat
      };
    },

    /**
     * Mutasi data simulasi di memori (intersepsi POST aman)
     */
    mutate: function (action, payload, user) {
      this.init();
      var u = user || {};
      var now = new Date();
      var year = now.getFullYear();
      var dateStr = now.toISOString().slice(0, 10);
      var timeStr = now.toTimeString().slice(0, 8);
      var result = { simulated: true, success: true };

      // Catat log audit in-memory untuk setiap aksi demo
      var logId = 'LOG-' + (this.data.audit_logs.length + 1).toString().padStart(3, '0');
      var logEntry = {
        id: logId,
        action: action.toUpperCase(),
        actor_name: (u.full_name || u.username || 'Demo User') + ' (' + (u.role_label || u.role || 'DEMO') + ')',
        details: 'Simulasi aksi: ' + action + ' via Sandbox Demo.',
        ip_address: '127.0.0.1 (Demo Sandbox)',
        created_at: dateStr + ' ' + timeStr
      };
      this.data.audit_logs.unshift(logEntry);

      switch (action) {
        case 'reserveLetterNumber':
          var nextNum = (this.data.surat.length + 1).toString().padStart(3, '0');
          var lType = (payload && payload.letter_type) || 'SK';
          var generatedNumber = nextNum + '/APII-JABO/' + lType + '/X/' + year;
          result.letter_number = generatedNumber;
          break;

        case 'createSurat':
        case 'updateSurat':
          var sId = payload && payload.id ? Number(payload.id) : (this.data.surat.length + 1);
          var sIndex = this.data.surat.findIndex(function (x) { return x.id === sId; });
          var newSurat = {
            id: sId,
            letter_number: (payload && payload.letter_number) || ('088/APII-JABO/SK/X/' + year),
            title: (payload && payload.title) || 'Surat Dinas Baru',
            letter_type: (payload && payload.letter_type) || 'SK',
            status: (payload && payload.status) || 'DRAFT',
            signer_name: (payload && payload.signer_name) || 'H. Ahmad Syahid, M.Pd.',
            signer_role: (payload && payload.signer_role) || 'Ketua DPW',
            content: (payload && payload.content) || 'Isi draft naskah dinas...',
            notes: (payload && payload.notes) || 'Disusun dalam mode simulasi demo.',
            created_by: u.full_name || 'Sekretaris DPW',
            tanggal: dateStr
          };
          if (sIndex !== -1) {
            this.data.surat[sIndex] = Object.assign(this.data.surat[sIndex], newSurat);
          } else {
            this.data.surat.unshift(newSurat);
          }
          result.surat = newSurat;
          break;

        case 'submitSurat':
          var subId = Number(payload && payload.id);
          var sSub = this.data.surat.find(function (x) { return x.id === subId; });
          if (sSub) {
            sSub.status = 'PENDING_APPROVAL';
            sSub.notes = 'Naskah telah diajukan ke Ketua DPW untuk persetujuan.';
          }
          break;

        case 'approveSurat':
        case 'surat_approve':
          var appId = Number(payload && payload.id);
          var sApp = this.data.surat.find(function (x) { return x.id === appId; });
          if (sApp) {
            sApp.status = 'PUBLISHED';
            sApp.notes = 'Naskah resmi telah disahkan oleh Ketua DPW dengan stempel dinas.';
          }
          break;

        case 'rejectSurat':
        case 'surat_reject':
          var rejId = Number(payload && payload.id);
          var sRej = this.data.surat.find(function (x) { return x.id === rejId; });
          if (sRej) {
            sRej.status = 'REJECTED';
            sRej.notes = 'Catatan revisi: ' + ((payload && payload.notes) || 'Perbaiki tata letak dan redaksi konsideran.');
          }
          break;

        case 'createVoucher':
          var vId = this.data.keuangan.length + 1;
          var vNum = 'VOU-' + year + '-' + vId.toString().padStart(4, '0');
          var vAmt = Number((payload && payload.amount) || 0);
          var vType = (payload && payload.type) || 'KELUAR';
          var newVoucher = {
            id: vId,
            voucher_number: vNum,
            type: vType,
            amount: vAmt,
            description: (payload && payload.description) || 'Transaksi Kas Demo',
            account_code: (payload && payload.account_code) || 'KAS_BSI',
            status: 'PENDING',
            receipt_url: (payload && payload.receipt_url) || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500',
            tanggal: dateStr,
            verified_by_bendahara: false,
            verified_by_ketum: false
          };
          this.data.keuangan.unshift(newVoucher);
          // Update kalkulasi saldo simulasi
          if (vType === 'MASUK') {
            this.data.saldo.total_masuk += vAmt;
            this.data.saldo.saldo += vAmt;
          } else {
            this.data.saldo.total_keluar += vAmt;
            this.data.saldo.saldo -= vAmt;
          }
          result.voucher = newVoucher;
          break;

        case 'verifyVoucherBendahara':
        case 'verifyVoucher':
        case 'voucher_verify':
          var vkId = Number(payload && payload.id);
          var vItem = this.data.keuangan.find(function (x) { return x.id === vkId; });
          if (vItem) {
            vItem.status = 'VERIFIED_BY_BENDAHARA';
            vItem.verified_by_bendahara = true;
          }
          break;

        case 'approveVoucherKetum':
        case 'approveVoucher':
        case 'voucher_approve':
          var vkAppId = Number(payload && payload.id);
          var vAppItem = this.data.keuangan.find(function (x) { return x.id === vkAppId; });
          if (vAppItem) {
            vAppItem.status = 'APPROVED';
            vAppItem.verified_by_ketum = true;
          }
          break;

        case 'createSubmission':
        case 'updateSubmission':
          var dId = payload && payload.id ? Number(payload.id) : (this.data.divisi.length + 1);
          var dIndex = this.data.divisi.findIndex(function (x) { return x.id === dId; });
          var bAmt = Number((payload && (payload.budget_estimate || payload.anggaran)) || 5000000);
          var divCode = (payload && payload.division) || 'DIV_HUMAS';
          var divName = (window.DIVISIONS && window.DIVISIONS[divCode]) || 'Hubungan Masyarakat';
          var pTitle = (payload && (payload.program_title || payload.title)) || 'Program Kerja Divisi Baru';
          var newProg = {
            id: dId,
            tracking_id: (payload && payload.tracking_id) || ('#REQ-' + year + '-' + String(dId).padStart(3, '0')),
            program_title: pTitle,
            title: pTitle,
            description: (payload && payload.description) || 'Rincian deskripsi program kerja divisi dalam mode simulasi.',
            division: divCode,
            division_label: divName,
            division_name: divName,
            budget_estimate: bAmt,
            budget_label: 'Rp ' + Number(bAmt).toLocaleString('id-ID'),
            anggaran: bAmt,
            realisasi_anggaran: 0,
            realisasi_label: 'Rp 0',
            target_audience: (payload && payload.target_audience) || '50 Peserta / Masyarakat',
            execution_date: (payload && payload.execution_date) || (payload && payload.tanggal_kegiatan) || dateStr,
            tanggal_kegiatan: (payload && payload.execution_date) || (payload && payload.tanggal_kegiatan) || dateStr,
            tanggal_label: '15 Nov ' + year,
            lifecycle: 'DRAFT',
            status: 'DRAFT',
            status_label: 'Draf',
            created_by: (u.full_name || 'Ketua Divisi') + ' (' + divName + ')',
            submitted_by_name: (u.full_name || 'Ketua Divisi') + ' (' + divName + ')',
            lpj_summary: '',
            lpj_realisasi: 0,
            lpj_url: ''
          };
          if (dIndex !== -1) {
            this.data.divisi[dIndex] = Object.assign(this.data.divisi[dIndex], newProg);
          } else {
            this.data.divisi.unshift(newProg);
          }
          result.program = newProg;
          break;

        case 'ajukanSubmission':
          var dSubId = Number(payload && payload.id);
          var dSubItem = this.data.divisi.find(function (x) { return x.id === dSubId; });
          if (dSubItem) {
            dSubItem.status = 'AJUKAN';
            dSubItem.status_label = 'Diajukan';
            dSubItem.lifecycle = 'AJUKAN';
          }
          break;

        case 'approveSubmission':
        case 'program_status':
          var dAppId = Number(payload && payload.id);
          var dAppItem = this.data.divisi.find(function (x) { return x.id === dAppId; });
          if (dAppItem) {
            var stVal = (payload && payload.status) || 'DISETUJUI';
            dAppItem.status = stVal;
            dAppItem.lifecycle = stVal;
            dAppItem.status_label = stVal === 'DITOLAK' ? 'Ditolak' : (stVal === 'PELAKSANAAN' ? 'Pelaksanaan' : 'Disetujui');
            if (payload && payload.rejection_notes) dAppItem.rejection_notes = payload.rejection_notes;
          }
          break;

        case 'startExecution':
        case 'startSubmission':
          var dStartId = Number(payload && payload.id);
          var dStartItem = this.data.divisi.find(function (x) { return x.id === dStartId; });
          if (dStartItem) {
            dStartItem.status = 'PELAKSANAAN';
            dStartItem.status_label = 'Pelaksanaan';
            dStartItem.lifecycle = 'PELAKSANAAN';
            dStartItem.started_at = dateStr;
          }
          break;

        case 'submitLPJ':
          var lpjId = Number(payload && payload.id);
          var lpjItem = this.data.divisi.find(function (x) { return x.id === lpjId; });
          if (lpjItem) {
            lpjItem.status = 'LPJ_SELESAI';
            lpjItem.status_label = 'LPJ Selesai';
            lpjItem.lifecycle = 'LPJ_SELESAI';
            var rAmt = Number((payload && (payload.realisasi_anggaran || payload.realisasi)) || lpjItem.budget_estimate || lpjItem.anggaran);
            lpjItem.realisasi_anggaran = rAmt;
            lpjItem.realisasi_label = 'Rp ' + Number(rAmt).toLocaleString('id-ID');
            lpjItem.lpj_notes = (payload && (payload.lpj_notes || payload.summary)) || 'Kegiatan selesai dilaksanakan secara akuntabel.';
            lpjItem.lpj_url = (payload && payload.lpj_url) || 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600';
          }
          break;

        case 'verifyPendaftarSekretaris':
          var prId = Number(payload && payload.id);
          var prItem = this.data.pendaftar.find(function (x) { return x.id === prId; });
          if (prItem) {
            prItem.status = 'DIVERIFIKASI_SEKRETARIS';
          }
          break;

        case 'approvePendaftarKetum':
          var prAppId = Number(payload && payload.id);
          var prAppItem = this.data.pendaftar.find(function (x) { return x.id === prAppId; });
          if (prAppItem) {
            prAppItem.status = 'DISETUJUI';
          }
          break;

        case 'exportPendaftar':
          var csv = 'Nomor Pendaftaran,Nama Lengkap,NIK,Email,Telepon,Status\n' +
            this.data.pendaftar.map(function (p) {
              return [p.reg_number, p.nama_lengkap, p.nik, p.email, p.telepon, p.status].join(',');
            }).join('\n');
          result.csv = csv;
          result.filename = 'Pendaftar_APII_Demo_' + dateStr + '.csv';
          break;

        case 'saveSettings':
          if (payload) {
            this.data.settings = Object.assign(this.data.settings, payload);
          }
          break;

        case 'saveEditorialContent':
          if (payload && payload.editorial) {
            this.data.editorial = Object.assign(this.data.editorial, payload.editorial);
          }
          break;

        default:
          break;
      }

      return result;
    },

    /**
     * Menyusun pesan notifikasi toast edukatif yang menerangkan logika yayasan
     */
    getExplanation: function (action, payload) {
      switch (action) {
        case 'approveSurat':
          return '🛡️ [Simulasi Pengesahan Surat] Naskah surat resmi berhasil disahkan oleh Ketua DPW! Status surat berubah menjadi DISETUJUI dengan stempel dinas & TTD digital. Data riil yayasan tetap aman dalam sandbox.';

        case 'submitSurat':
          return '🛡️ [Simulasi Pengajuan Surat] Draft naskah dinas berhasil diajukan ke antrean persetujuan Ketua DPW. Status kini: MENUNGGU PERSETUJUAN.';

        case 'reserveLetterNumber':
          return '🛡️ [Simulasi Penomoran Otomatis] Nomor surat dinas resmi berhasil direservasi sesuai urutan tata persuratan DPW Jabodetabek.';

        case 'createSurat':
        case 'updateSurat':
          return '🛡️ [Simulasi Draft Surat] Draft surat dinas berhasil disimpan di sandbox. Anda dapat membuka Pratinjau Kertas Virtual A4 untuk melihat tata letak resmi.';

        case 'createVoucher':
          return '🛡️ [Simulasi Pencatatan Kas] Voucher kas berhasil dicatat dengan status PENDING. Masuk antrean verifikasi Bendahara DPW (Dual-Approval Tahap 1).';

        case 'verifyVoucherBendahara':
        case 'verifyVoucher':
          return '🛡️ [Simulasi Dual-Approval Tahap 1] Voucher kas berhasil diverifikasi Bendahara. Antrean diteruskan ke Ketua DPW untuk pengesahan pencairan tahap 2.';

        case 'approveVoucherKetum':
        case 'approveVoucher':
          return '🛡️ [Simulasi Dual-Approval Tahap 2] Ketua DPW mengesahkan pengeluaran kas! Status voucher kini DISETUJUI dan kwitansi resmi siap dicetak.';

        case 'createSubmission':
        case 'updateSubmission':
          return '🛡️ [Simulasi Usulan Divisi] Proposal kegiatan divisi tersimpan. Klik "Ajukan Program" untuk meneruskannya ke pimpinan wilayah.';

        case 'ajukanSubmission':
          return '🛡️ [Simulasi Pengajuan Program] Usulan program kerja resmi diajukan ke Ketua DPW untuk otorisasi alokasi anggaran kegiatan.';

        case 'approveSubmission':
          return '🛡️ [Simulasi Otorisasi Anggaran] Program kerja divisi disetujui pimpinan wilayah! Siklus hidup kini masuk fase PELAKSANAAN.';

        case 'submitLPJ':
          return '🛡️ [Simulasi LPJ Akuntabel] Laporan Pertanggungjawaban (LPJ) berhasil diserahkan dengan realisasi dana. Siklus hidup kegiatan: LPJ SELESAI.';

        case 'verifyPendaftarSekretaris':
          return '🛡️ [Simulasi Verifikasi Anggota] Berkas KTP pemohon diverifikasi Sekretaris sesuai UU PDP No. 27/2022. Diteruskan ke Ketua DPW untuk pengesahan.';

        case 'approvePendaftarKetum':
          return '🛡️ [Simulasi Pengesahan Anggota] Calon anggota resmi disahkan menjadi anggota tetap DPW APII Jabodetabek.';

        case 'exportPendaftar':
          return '🛡️ [Simulasi Ekspor Data] File CSV pendaftar anggota baru berhasil diekspor dari sandbox simulasi.';

        case 'saveSettings':
          return '🛡️ [Simulasi Pengaturan] Konfigurasi identitas organisasi & tata kelola naskah dinas berhasil disimulasikan.';

        case 'saveEditorialContent':
          return '🛡️ [Simulasi Mini-CMS] Perubahan warta, maklumat, dan sambutan pimpinan berhasil diperbarui di sandbox konten portal.';

        default:
          return '🛡️ [Mode Demo Simulasi] Aksi "' + action + '" berhasil dicoba secara aman! UI/UX riil terasa penuh tanpa mengubah database riil yayasan.';
      }
    }
  };

  // Ekspos ke global window
  window.DemoStore = DemoStore;
})();
