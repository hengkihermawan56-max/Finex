# HENGKI Solana Desk

Dasbor **paper trading Solana** untuk Android dan browser, terinspirasi tampilan video yang diberikan Hengki. Modal awal virtual Rp1.000.000. Enam modul berbasis aturan, tanpa API key dan tanpa transaksi uang nyata.

- [Buka proyek, fitur dan pengujian](solana-desk/README.md)
- [Panduan GitHub dan instal Android](solana-desk/PANDUAN_ANDROID.md)
- [Analisis video referensi](solana-desk/ANALISIS_VIDEO.md)

Folder `solana-desk/` berisi aplikasi. Workflow `Solana - Build Android APK` membangun APK debug. Workflow `Solana - Publish web app` menerbitkan versi web jika dijalankan setelah Pages diaktifkan. Tidak ada kunci dompet, koneksi dompet, atau fungsi kirim transaksi blockchain.

Untuk mencoba tanpa server, buka `BUKA_DEMO.html` di browser yang mendukung JavaScript dan file lokal. File ini menggabungkan mesin yang sama dengan aset aplikasi dalam satu HTML. Fitur pemasangan PWA tersedia pada versi HTTPS, bukan pada file lokal. Jika browser Android membatasi file lokal, gunakan APK dari workflow atau versi GitHub Pages.

**Status versi pertama:** aplikasi web, mesin simulasi dan proyek Android disediakan. Hasil uji dan keterbatasan ada di README proyek. APK dapat disebut berhasil dibuat hanya setelah workflow Android selesai hijau.
