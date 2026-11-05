# HENGKI Solana Desk / GMGN Live

Repositori berisi dasbor simulasi Android dan implementasi server trading otomatis GMGN. Semua keputusan memakai aturan numerik yang dapat diperiksa di source.

| Bagian | Fungsi | Uang nyata |
|---|---|---|
| `solana-desk/` | Simulasi di Android/browser, modal virtual awal Rp1 juta | Tidak |
| `gmgn-live/` | Bot server 24 jam melalui GMGN OpenAPI, dengan panel HTTPS | Dapat mengirim transaksi setelah pemilik mengonfigurasi dan mengaktifkannya |

**Versi 1.1 menambahkan server GMGN dan tombol pembuka panel server pada APK.** Instal APK saja tidak mengaktifkan trading. Server belum dipasang, akses API belum dikonfigurasi, dan transaksi uang nyata belum diuji. Batas belanja, nominal beli dan batas rugi default nol; seluruh pengujian otomatis memakai fixture.

- [Panduan server GMGN dan pengamanan kredensial](gmgn-live/README.md)

**Build versi 1.1 berhasil:** APK/lint Android, 25 tes server, 25 tes simulasi, 7 skenario panel server, 13 skenario web/launcher, image Docker dan validasi Compose lolos. Semua pengujian transaksi memakai fixture; belum ada pengoperasian GMGN dengan dana nyata.

- [Build APK 1.1 dan artifact unduhan](https://github.com/hengkihermawan56-max/Finex/actions/runs/41976483127)
- [Pengujian server, panel dan image](https://github.com/hengkihermawan56-max/Finex/actions/runs/41976483151)
- [Pengujian dasbor dan launcher Android](https://github.com/hengkihermawan56-max/Finex/actions/runs/41976483099)

Source build 1.1: `8c6a4cbdd2f45b0c12d02c710676141dae477e03`. SHA-256 APK: `dd5c72f5927043ed6eb86744c64108c6b27e2d0f23015e4029fe5aecb4a3b273`.

- [Buka proyek, fitur dan pengujian](solana-desk/README.md)
- [Panduan GitHub dan instal Android](solana-desk/PANDUAN_ANDROID.md)
- [Analisis video referensi](solana-desk/ANALISIS_VIDEO.md)

Workflow `Solana - Build Android APK` membangun APK debug. `GMGN - Server tests and image` menguji server serta image Docker. API key dan private PEM hanya disimpan pada server operator, tidak pada APK atau GitHub. Workflow Pages hanya memublikasikan folder web simulasi.

Untuk mencoba tanpa server, buka `BUKA_DEMO.html` di browser yang mendukung JavaScript dan file lokal. File ini menggabungkan mesin yang sama dengan aset aplikasi dalam satu HTML. Fitur pemasangan PWA tersedia pada versi HTTPS, bukan pada file lokal. Jika browser Android membatasi file lokal, gunakan APK dari workflow atau versi GitHub Pages.

**Riwayat v1.0.0 (paper):** build APK debug dan lint Android berhasil. Sebanyak 25 tes mesin dan 11 skenario integrasi browser desktop/seluler lolos. Pengujian data pasar menggunakan fixture; pemasangan pada HP fisik belum diuji.

- [Unduh artifact Android](https://github.com/hengkihermawan56-max/Finex/actions/runs/41972318176/artifacts/13391050002): ekstrak ZIP, kemudian pasang `HENGKI-Solana-Desk-debug.apk`.
- [Hasil build dan lint Android](https://github.com/hengkihermawan56-max/Finex/actions/runs/41972318176)
- [Hasil pengujian mesin dan browser](https://github.com/hengkihermawan56-max/Finex/actions/runs/41972318140)

APK merupakan aplikasi paper trading dengan saldo virtual, bukan pelaksana transaksi uang nyata. Ukuran APK 1.210.462 byte. Source build: `06a14472e4235a7203bf13751d94cf7cdd7e8ead`.
