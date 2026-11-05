# Panduan GitHub → APK Android

## Tambahan versi 1.1: panel server GMGN

Tombol **Panel server GMGN · Uang nyata** membuka panel HTTPS pada server Anda. Simpan alamat domain server pada dialog tersebut, lalu pilih **Buka panel server**. API key/private PEM dikonfigurasi langsung pada server, bukan pada APK. Dasbor saldo dan tombol Mulai bot di APK tetap merupakan simulasi.

Bot uang nyata berjalan otomatis pada server terpisah setelah pemilik menyiapkan [GMGN Live](../gmgn-live/README.md), menetapkan batas SOL dan mengaktifkannya di panel. Tanpa server dan akses API yang sesuai, APK tidak dapat melakukan trading uang nyata.

Jika Android menolak pembaruan karena kunci debug build berbeda, ekspor jurnal simulasi sebelum menghapus versi lama dan memasang APK baru.

Proyek ini membuat aplikasi simulasi yang dapat dijalankan tanpa Termux dan tanpa kunci API.

## A. Jika kode sudah ada di GitHub

1. Buka repositori tempat proyek diunggah, lalu tab **Actions**.
2. Pilih workflow **Solana - Build Android APK**.
3. Jika belum berjalan, pilih **Run workflow**, pilih branch yang memuat proyek, lalu jalankan.
4. Tunggu seluruh tahap menjadi hijau. Durasi bergantung antrean GitHub dan unduhan dependensi.
5. Buka hasil run. Pada bagian **Artifacts**, unduh **HENGKI-Solana-Desk-Android**. GitHub mengunduhnya sebagai ZIP.
6. Ekstrak ZIP di Android. Di dalamnya ada `HENGKI-Solana-Desk-debug.apk` dan `SHA256SUMS.txt`.
7. Buka APK. Jika Android meminta, izinkan pemasangan dari browser/aplikasi pengelola file yang digunakan. Setelah terpasang, buka **HENGKI Solana Desk**.

APK debug ditujukan untuk uji pribadi. Aplikasi hanya meminta akses internet. Artefak disimpan workflow selama 30 hari; jalankan workflow lagi jika kedaluwarsa.

**Jika workflow gagal:** buka tahap merah dan lihat pesannya. Belum ada APK berhasil jika tahap build/lint tidak hijau. File sumber ZIP bukan file APK.

## B. Jika menerima arsip proyek

1. Ekstrak `HENGKI_Solana_Desk_GitHub.zip`.
2. Isi repositori harus memuat `README.md`, folder `solana-desk/` dan folder `.github/workflows/` pada tingkat paling atas. Jangan mengunggah ZIP sebagai satu file lalu mengharapkan GitHub mengekstraknya.
3. Perhatikan folder `.github` dapat tersembunyi di beberapa aplikasi Android. Tanpa file YAML di folder tersebut, tab Actions tidak akan menyediakan workflow.
4. Unggah semua file dan pertahankan struktur folder. Untuk GitHub melalui browser HP, unggah folder `solana-desk` beserta isinya melalui **Add file → Upload files** bila pemilih file mendukung folder. Jika tidak, cara paling andal adalah GitHub Codespaces atau git pada komputer/Termux; pengguna tidak perlu Termux untuk menjalankan APK setelah build.
5. Jika perlu, salin ketiga file YAML secara terpisah melalui **Add file → Create new file**. Masukkan path lengkap `.github/workflows/solana-android.yml`, `.github/workflows/solana-ci.yml` dan `.github/workflows/solana-pages.yml`; salin isinya dari arsip.
6. Commit perubahan. Push proyek memicu pemeriksaan dan build APK. Lanjutkan bagian A.

Dengan git pada komputer yang telah terautentikasi:

```bash
git clone https://github.com/USERNAME/REPOSITORY.git
```

Salin isi arsip ke folder clone tanpa menghapus berkas yang sudah ada. Lalu dari folder repository:

```bash
git add README.md solana-desk .github/workflows/solana-android.yml .github/workflows/solana-ci.yml .github/workflows/solana-pages.yml
git commit -m "Add HENGKI Solana paper trading desk"
git push
```

Ganti `USERNAME/REPOSITORY` dengan repo tujuan. Kredensial GitHub hanya dimasukkan ke alur login GitHub; tidak ke source aplikasi.

## C. Jalur browser / PWA

1. Pada repositori, buka **Settings → Pages → Source → GitHub Actions**.
2. Buka Actions, jalankan **Solana - Publish web app**.
3. Setelah hijau, buka URL yang ditampilkan workflow. Jangan menganggap suatu URL sudah aktif sebelum deploy berhasil.
4. Buka URL tersebut di Chrome Android. Gunakan menu **Instal aplikasi** atau **Tambahkan ke layar utama**, jika ditawarkan Chrome.

GitHub Pages memerlukan paket/visibilitas repo yang mendukung fitur tersebut. Versi web bersifat publik sesuai konfigurasi Pages. Jangan menaruh kunci atau informasi rahasia dalam folder `web/`.

## D. Menggunakan aplikasi

1. Mulai di **Demo**; tekan **Mulai bot**. Saldo awal Rp1 juta adalah virtual. Angka dapat naik atau turun.
2. Lihat Scout → Filter → Analyst → Executor → Risk → Journal. Bot dapat tidak membeli ketika tidak ada token yang lolos aturan.
3. Untuk melihat token sungguhan, pilih **Harga pasar**. Transaksinya tetap simulasi. Data mode Demo dan Harga pasar berbeda dan tidak digabung.
4. Pengaturan dapat mengubah modal, kurs referensi manual, batas risiko, biaya dan watchlist alamat mint. Menyimpan pengaturan membuat sesi baru untuk mode tersebut.
5. **Jeda beli baru** menghentikan entri; posisi yang ada tetap dipantau selama aplikasi terbuka. Tutup posisi secara manual lewat tombol **Tutup** dengan harga segar.
6. Ekspor jurnal CSV sebelum mengatur ulang sesi atau uninstall.

Pembaruan pasar bisa gagal karena internet, batas API, kebijakan CORS atau cache layanan. Aplikasi menampilkan pesan, menjeda beli dan mempertahankan harga terakhir. Tidak ada perpindahan diam-diam ke harga demo.

Aplikasi perlu terlihat dan terbuka untuk memantau posisi. GitHub menyimpan kode, membangun APK dan menayangkan aplikasi; GitHub Actions tidak dipakai sebagai bot yang berjalan 24 jam. Pengoperasian 24 jam memerlukan layanan backend terpisah yang belum termasuk versi ini.
