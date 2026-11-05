# HENGKI Solana Desk

Dasbor **paper trading Solana** untuk Android dan browser, terinspirasi tampilan video yang diberikan Hengki. Modal awal virtual Rp1.000.000. Enam modul berbasis aturan, tanpa API key dan tanpa transaksi uang nyata.

- [Buka proyek, fitur dan pengujian](solana-desk/README.md)
- [Panduan GitHub dan instal Android](solana-desk/PANDUAN_ANDROID.md)
- [Analisis video referensi](solana-desk/ANALISIS_VIDEO.md)

Folder `solana-desk/` berisi aplikasi. Workflow `Solana - Build Android APK` membangun APK debug. Workflow `Solana - Publish web app` menerbitkan versi web jika dijalankan setelah Pages diaktifkan. Tidak ada kunci dompet, koneksi dompet, atau fungsi kirim transaksi blockchain.

Untuk mencoba tanpa server, buka `BUKA_DEMO.html` di browser yang mendukung JavaScript dan file lokal. File ini menggabungkan mesin yang sama dengan aset aplikasi dalam satu HTML. Fitur pemasangan PWA tersedia pada versi HTTPS, bukan pada file lokal. Jika browser Android membatasi file lokal, gunakan APK dari workflow atau versi GitHub Pages.

**Status v1.0.0:** build APK debug dan lint Android berhasil. Sebanyak 25 tes mesin dan 11 skenario integrasi browser desktop/seluler lolos. Pengujian data pasar menggunakan fixture; pemasangan pada HP fisik belum diuji.

- [Unduh artifact Android](https://github.com/hengkihermawan56-max/Finex/actions/runs/41972318176/artifacts/13391050002): ekstrak ZIP, kemudian pasang `HENGKI-Solana-Desk-debug.apk`.
- [Hasil build dan lint Android](https://github.com/hengkihermawan56-max/Finex/actions/runs/41972318176)
- [Hasil pengujian mesin dan browser](https://github.com/hengkihermawan56-max/Finex/actions/runs/41972318140)

APK merupakan aplikasi paper trading dengan saldo virtual, bukan pelaksana transaksi uang nyata. Ukuran APK 1.210.462 byte. Source build: `06a14472e4235a7203bf13751d94cf7cdd7e8ead`.
