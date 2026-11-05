# HENGKI GMGN Live Server · 1.1.0

Implementasi bot **otomatis penuh pada server 24 jam**, khusus chain Solana dan integrasi resmi GMGN OpenAPI. APK menyediakan akses ke panel server; proses trading tidak bergantung pada HP tetap terbuka. Mesin memakai aturan numerik, tanpa model LLM.

**Status:** source implementasi dan pengujian disediakan. Server belum dipasang, akun API belum dikonfigurasi, dan transaksi uang nyata belum diuji. Build/test yang lolos tidak membuktikan integrasi berbayar atau transaksi nyata telah berhasil.

## Yang diperlukan sebelum pengoperasian

- VPS Linux dengan IPv4 keluar tetap, domain HTTPS, Node.js 22 atau Docker Compose. GitHub Actions dipakai untuk build/test, bukan untuk menyimpan kunci atau menjadi bot 24 jam.
- Akun GMGN dan wallet yang akan dipakai khusus untuk bot.
- GMGN API key yang terikat pada wallet dan public key Ed25519 yang benar. Sesuaikan whitelist IPv4 server di GMGN. Kunci Ed25519 ini adalah kunci otorisasi API, bukan seed phrase dompet Solana.
- Paket API yang mengizinkan trade/quote. Dokumentasi CLI resmi menyatakan endpoint swap/quote berbobot 10, sedangkan bucket Free berkapasitas 5; paket Free tidak dapat menjalankan endpoint tersebut. Periksa biaya dan ketentuan terbaru di GMGN sebelum berlangganan.
- Batas pembelian sesi, nominal beli per token dan batas rugi dalam **SOL**, ditentukan sendiri. Nilai awal ketiganya nol sehingga bot tidak dapat diaktifkan.

Tidak ada VPS, paket API atau deposit yang dibeli otomatis oleh proyek ini. Jangan mengirim API key, private PEM, password VPS, seed phrase atau token admin melalui chat/GitHub.

## Batas fungsional

Bot membaca tren 5 menit GMGN atau watchlist alamat mint, memeriksa data pasar dan risiko, memverifikasi mint melalui RPC Solana, memeriksa quote beli serta quote jual kembali, lalu mengirim swap resmi yang ditandatangani dengan Ed25519. Hanya satu posisi bot pada satu waktu. Posisi yang sebelumnya sudah dimiliki wallet tidak dibeli lagi oleh bot.

Pemeriksaan masuk mencakup likuiditas, volume 1 jam, momentum 5 menit, arus volume beli/jual, umur token, konsentrasi Top10, indikator rug/wash trading, serta pencabutan mint/freeze authority. Data yang hilang tidak dianggap aman. Token-2022/transfer-hook ditolak pada versi awal; hanya mint Token Program klasik yang diterima. Kelulusan pemeriksaan tetap tidak menjamin token aman atau dapat dijual.

Beli menyertakan TP/SL GMGN. Pembuatan strategi di GMGN bersifat best-effort; jika ID strategi tidak dikembalikan setelah pembelian terkonfirmasi, server menjeda beli dan berupaya menjual dengan quote segar. Jika quote/jalur jual tidak tersedia, penutupan tidak dijamin. Stop loss, batas rugi dan slippage bukan batas kerugian mutlak.

`budgetSol` adalah **batas total nominal pembelian kumulatif per sesi**, bukan sekadar saldo minimal. Nominal yang sudah dijual tidak otomatis boleh dibelikan ulang. Pengiriman gagal/tidak jelas tetap memakai reservasi sampai ditinjau. Biaya dan rent account dapat menambah biaya di luar nominal beli; siapkan `reserveSol` terpisah. Biaya GMGN, DEX/launchpad, priority, tip dan jaringan mengikuti layanan terkait.

Tidak ada penarikan dana, transfer ke wallet lain, token launch, multi-wallet, copy trade atau endpoint untuk mengirim perintah sistem. Tidak ada profit/win rate fiktif: panel menampilkan saldo SOL dari RPC, quote posisi dan bukti pesanan. Saldo/valuasi sesi dapat terpengaruh setoran, penarikan dan perdagangan di luar bot. Gunakan wallet khusus dan hentikan/reka ulang sesi jika ada mutasi eksternal.

## Menyiapkan di VPS

Lakukan langkah berikut pada server milik Anda. Contoh domain bukan domain yang sudah dibuat.

```bash
git clone https://github.com/hengkihermawan56-max/Finex.git
cd Finex/gmgn-live
node scripts/setup.mjs
```

Setup menghasilkan file **pada server**, tidak menampilkan nilai rahasia dan tidak menimpa kunci yang sudah ada:

| File | Penggunaan |
|---|---|
| `secrets/gmgn-public.pem` | Public key untuk diunggah ke GMGN; salin seluruh BEGIN/END |
| `secrets/gmgn-private.pem` | Private key penandatangan; tetap pada server, permission 0600 |
| `secrets/gmgn-api-key.txt` | Isi API key GMGN melalui editor SSH lokal pada server |
| `secrets/admin-token.txt` | Token login panel server, bukan API key GMGN |
| `config.json` | Wallet publik dan batas operasi yang Anda tentukan |
| `.env` | Domain, alamat RPC dan saklar izin pengiriman nyata |

Buka [GMGN Agent API](https://gmgn.ai/ai), pilih wallet, unggah public PEM, buat API key dan whitelist IPv4 server. Pembuatan akun, persetujuan layanan, pembayaran dan pengisian dana dilakukan oleh pemilik akun. Tidak ada langkah dalam proyek ini yang membutuhkan private key dompet/seed phrase disalin ke APK.

Edit `config.json` dan `.env` di server. Jangan menaruh nilai rahasia di file contoh atau commit. `BOT_DOMAIN` harus menunjuk A-record ke IPv4 VPS, dan port 80/443 harus dapat dijangkau agar Caddy menerbitkan sertifikat HTTPS. Untuk UID/GID selain 1000, sesuaikan `BOT_UID`/`BOT_GID` dengan pemilik direktori `secrets` dan `data`.

```bash
docker compose up -d --build
docker compose ps
```

Awalnya `ALLOW_REAL_TRADING=false`; ini melarang pengiriman swap. Panel dapat dibuka setelah konfigurasi dasar dan HTTPS siap, tetapi pembelian tidak dapat diaktifkan. Untuk mengizinkan eksekusi, pemilik akun harus meninjau wallet/batas dan mengubah saklar di server menjadi:

```dotenv
ALLOW_REAL_TRADING=I_ACCEPT_REAL_TRADING
```

Lalu jalankan `docker compose up -d`. Masuk ke `https://DOMAIN_ANDA` menggunakan token admin server, periksa kembali alamat wallet dan nominal SOL, tekan **Aktifkan beli otomatis**, lalu ketik `START_REAL_TRADING`. Aktivasi ini mengizinkan pembelian/penjualan tanpa persetujuan tiap transaksi. Jangan lakukan tahap aktivasi sebelum Anda memahami dan menyetujui batas yang tampil.

## Ketahanan pesanan

Sebelum swap, intent dan reservasi disimpan atomik serta di-fsync ke disk. Tidak ada kirim ulang POST otomatis. Respons timeout/meragukan tetap pending dan menghentikan beli; jika ID pesanan tersedia, server hanya melakukan pembacaan status. Jika ID tidak didapat, operator harus memeriksa GMGN dan memasukkan ID yang sesuai untuk rekonsiliasi. Jangan menghapus state untuk mencoba lagi.

Setelah restart, beli baru selalu dijeda. Pesanan/posisi lama tetap dibaca dan, jika izin eksekusi server aktif, keluar berdasarkan aturan posisi dapat tetap dijalankan. `flock` pada volume data mencegah dua instance bot memakai ledger yang sama. Jangan menjalankan salinan lain pada volume terpisah dengan wallet/API key yang sama.

Jeda beli hanya menghentikan entri baru. Pesanan yang telah dikirim dan TP/SL yang sudah berada di GMGN tetap bisa berjalan. Saldo token yang berubah di luar bot menghentikan entri dan meminta operator meninjau GMGN. Penanganan posisi dan strategi perlu direkonsiliasi sebelum memulai sesi baru.

Jika harus memulai sesi baru: jeda beli, pastikan seluruh posisi/pending/strategi di GMGN telah diselesaikan, hentikan container bot, arsipkan file `data/state.json` secara aman, lalu tinjau konfigurasi baru. Tidak ada tombol web yang diam-diam mengatur ulang batas belanja sesi.

## Pengamanan dan operasi

Panel memakai HTTPS, session cookie HttpOnly/SameSite, CSRF dan pengecekan Origin. API key/private PEM dipasang read-only sebagai secret, tidak disertakan image Docker atau APK. Container bot berjalan sebagai user non-root dengan filesystem utama read-only. API client menggunakan host resmi tetap `https://openapi.gmgn.ai`, IPv4, timeout, serta cooldown 429 tanpa mengulang permintaan trading.

Pastikan jam VPS disinkronkan: autentikasi GMGN memakai timestamp detik dengan toleransi singkat. Kunci dan data tetap harus dicadangkan secara terenkripsi di tempat yang Anda kendalikan. Server/panel ini belum diaudit pihak ketiga dan belum diuji menggunakan akun GMGN berisi dana. Jalankan pengujian akses baca dan lakukan pengujian uang nyata terkecil yang Anda putuskan sendiri sebelum menambah penggunaan.

## Pengujian lokal

```bash
npm run check
npm test
```

Tes memakai kunci sintetis dan respons fixture; tidak mengirim swap sungguhan. Pengujian mencakup penandatanganan, batas dana, quote/receipt, journal sebelum POST, timeout tanpa duplikasi, restart, RPC mint, penyimpanan gagal, HTTP autentikasi dan CSRF.

## Referensi resmi

- [GMGN Agent API](https://docs.gmgn.ai/index/gmgn-agent-api)
- [Membuat pasangan kunci](https://docs.gmgn.ai/index/generate-public-key)
- [CLI dan protokol GMGN](https://github.com/GMGNAI/gmgn-skills/tree/main/src)
- [Dokumentasi penggunaan/rate limit](https://github.com/GMGNAI/gmgn-skills/blob/main/docs/cli-usage.md)
- [Biaya GMGN](https://docs.gmgn.ai/index/gmgn-fees-settings)
- [Solana RPC: token accounts](https://solana.com/docs/rpc/http/gettokenaccountsbyowner)
