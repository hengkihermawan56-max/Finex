# Menyiapkan server GMGN dari HP

Status saat panduan dibuat: APK dan source server tersedia; VPS belum dibuat, akun API belum terhubung, dan transaksi sungguhan belum diuji. Membuka APK tidak otomatis mengaktifkan bot.

## 1. Membuka akun VPS

Buka [DigitalOcean](https://cloud.digitalocean.com/) melalui browser HP, lalu daftar atau login. Verifikasi email, akun dan metode pembayaran dilakukan sendiri oleh pemilik akun. Jika tampilan terlalu sempit, gunakan mode situs desktop pada browser.

Untuk persiapan awal, gunakan pilihan berikut saat membuka **Create → Droplet**:

| Pengaturan | Pilihan awal |
|---|---|
| Region | Singapore, jika tersedia pada akun |
| Image | Ubuntu 24.04 LTS x64 |
| Jenis | Basic, Regular CPU |
| Ukuran | 1 vCPU, RAM 1 GiB, SSD 25 GiB |
| Harga dasar tercantum | US$6/bulan; periksa estimasi akhir pada akun |
| Public network | IPv4 publik diperlukan |
| Jumlah | 1 Droplet |
| Nama | `hengki-gmgn` |

Ukuran tersebut merupakan usulan awal untuk backend ringan ini; pemakaian sumber daya perlu dipantau setelah pemasangan. Jika dibutuhkan, opsi 2 GiB/1 vCPU tercantum US$12/bulan. Harga diperiksa pada halaman resmi tanggal 5 November 2026 dan dapat berubah. Paket Basic pada tabel ini berbeda dari v5 yang memakai perhitungan sumber daya terpisah.

Jangan menambahkan layanan berbayar yang tidak diperlukan. Biaya di atas belum mencakup pajak, biaya tambahan sesuai pemakaian/opsi akun, domain, paket API GMGN, biaya transaksi, atau modal trading. Periksa ringkasan tagihan sebelum menekan tombol pembuatan server.

Simpan password, SSH private key, kode verifikasi dan data pembayaran sendiri. Saat meminta bantuan melalui tangkapan layar, tutupi seluruh nilai rahasia tersebut. Halaman konfigurasi paket sebelum server dibuat cukup untuk memeriksa pilihan dan biaya.

## 2. Memasang backend

Sesudah VPS tersedia, gunakan konsol server dari dashboard penyedia atau akses SSH yang Anda kendalikan. Siapkan Docker Compose, sinkronisasi waktu, dan akses web HTTPS. Detail teknis proyek ada di [panduan backend](gmgn-live/README.md).

Backend membutuhkan nama domain atau subdomain yang Anda kendalikan. A-record harus menunjuk ke IPv4 VPS. Port 80/443 digunakan untuk penerbitan sertifikat dan panel HTTPS; akses administrasi server perlu dibatasi sesuai pengaturan akun Anda.

Kunci API, private PEM dan token panel dibuat/disimpan di VPS. Jangan menaruhnya di GitHub atau mengirimkannya melalui chat. Backend dipasang dengan `ALLOW_REAL_TRADING=false`, sehingga tahap pemasangan tidak mengirim swap.

Periksa bahwa UID/GID proses Docker sesuai dengan pemilik folder `secrets` dan `data`. Jangan menggunakan akun root di dalam container bot untuk mengatasi kesalahan permission. Ikuti pengaturan `BOT_UID`/`BOT_GID` pada panduan backend.

## 3. Menghubungkan GMGN

Buka [API Management GMGN](https://gmgn.ai/ai) pada akun Anda. Setelah pasangan kunci dibuat di VPS, unggah **public key** `gmgn-public.pem` dan gunakan wallet khusus bot. Public key ini berbeda dari private key/seed phrase dompet.

API key harus sesuai dengan wallet dan public key yang dipakai server. Terapkan whitelist IPv4 server jika tersedia/disyaratkan akun. Isi API key langsung melalui akses server pribadi. Jangan mengirim API key atau private PEM dalam tangkapan layar.

Periksa apakah paket API Anda mendukung quote dan swap sebelum membeli layanan lain. Paket Free pada dokumentasi CLI yang dirujuk proyek tidak cukup untuk endpoint tersebut. Biaya langganan dan akses aktual harus diperiksa pada akun GMGN; tidak ada biaya API yang diasumsikan sudah termasuk dalam VPS.

## 4. Memeriksa sebelum aktivasi

Sesudah panel HTTPS dapat dibuka, periksa login, alamat wallet, akses API baca, saldo dari RPC dan status server. Ini belum membuktikan transaksi sungguhan berhasil. Pengujian GitHub sebelumnya menggunakan data fixture, bukan wallet berisi dana.

Pemilik akun menentukan tiga nilai awal dalam SOL: batas pembelian sesi (`budgetSol`), nominal per pembelian (`orderSol`), dan batas rugi (`maxLossSol`). Ketiganya default nol. Siapkan juga cadangan biaya jaringan. Saldo wallet bukan izin otomatis untuk membelanjakan seluruh dana.

Aktivasi otomatis membutuhkan perubahan saklar di VPS menjadi `ALLOW_REAL_TRADING=I_ACCEPT_REAL_TRADING` serta konfirmasi `START_REAL_TRADING` pada panel. Lakukan hanya setelah meninjau wallet dan batas yang tampil. Pengisian dana dan pengujian transaksi pertama dilakukan oleh pemilik akun dengan nominal yang diputuskan sendiri.

Setelah aktif, transaksi dapat berjalan tanpa konfirmasi setiap order. Stop loss tidak menjamin posisi dapat ditutup atau kerugian terbatas pada angka tertentu. Token dapat kehilangan likuiditas atau tidak bisa dijual.

## 5. Membuka dari APK dan memantau

Pada APK versi 1.1, pilih **Panel server GMGN · Uang nyata**, masukkan alamat HTTPS VPS Anda, lalu buka panel. HP dapat dipakai sebagai pengendali; proses bot berjalan di VPS.

Periksa status, pending order, posisi dan pemakaian VPS secara berkala. Restart server selalu menjeda pembelian baru. Tombol jeda pembelian tidak otomatis membatalkan order/TP/SL yang sudah berada di GMGN. Rincian rekonsiliasi dan pencadangan ada pada panduan backend.

## Referensi resmi

- [Harga Basic Droplets](https://www.digitalocean.com/pricing/droplets)
- [Membuat Droplet](https://docs.digitalocean.com/products/droplets/how-to/create/)
- [Konsol browser Droplet](https://docs.digitalocean.com/products/droplets/how-to/connect-with-console/)
- [Memasang Docker Engine di Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [GMGN Agent API](https://docs.gmgn.ai/index/gmgn-agent-api)
- [Dokumentasi CLI dan rate limit GMGN](https://github.com/GMGNAI/gmgn-skills/blob/main/docs/cli-usage.md)
