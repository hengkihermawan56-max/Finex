# HENGKI Solana Desk · v1.0.0

Dasbor hitam/hijau yang mengikuti gagasan video referensi: saldo, grafik, radar token, enam modul, kontrol sesi dan manajemen risiko. Semua pembelian dan penjualan adalah **paper trading**. Tidak membutuhkan Termux, kunci API, seed phrase, deposit, atau dompet.

## Dua sumber data

| Mode | Harga | Saldo / transaksi | Koneksi internet |
|---|---|---|---|
| Demo | Token fiktif berakhiran `-D`, pergerakan bisa naik atau turun | Virtual | Tidak diperlukan setelah aplikasi dimuat |
| Harga pasar | Snapshot API publik DEX Screener | Virtual, terpisah dari Demo | Diperlukan |

Demo diperbarui tiap 4 detik. Harga pasar diminta tiap 15 detik saat aplikasi terbuka. Kandidat berasal dari **profil terbaru DEX Screener dan watchlist**, maksimal 30 alamat mint per siklus. Daftar ini tidak mencakup seluruh token baru Solana dan bukan pemindai langsung Pump.fun atau Raydium. Pemilihan pool memakai likuiditas tertinggi; posisi yang sudah dibuka tetap memakai pool masuknya.

Data harga gagal tidak pernah diganti otomatis dengan data fiktif. Beli baru dijeda saat permintaan pasar gagal. Posisi tanpa harga segar tetap ditandai memakai nilai terakhir. Waktu data menunjukkan waktu respons diterima perangkat, bukan waktu transaksi terakhir di blockchain; agregator juga dapat menyajikan cache.

## Enam modul

| Modul | Implementasi |
|---|---|
| Scout | Mengambil profil/watchlist dan snapshot pool, atau membuat harga fiktif di Demo |
| Filter | Likuiditas, volume, jumlah beli/jual, momentum, umur pool, FDV/likuiditas |
| Analyst | Skor strategi 0–100 dari aturan numerik yang dapat dibaca di `web/engine.js` |
| Executor | Mencatat beli/jual virtual, jumlah token, saldo dan biaya |
| Risk | Stop loss, take profit, trailing stop, batas rugi sesi, batas posisi dan cooldown |
| Journal | Riwayat keputusan, transaksi selesai dan ekspor CSV |

Keenam modul adalah fungsi perangkat lunak. Tidak ada panggilan ke Grok/OpenAI, model LLM atau enam agen AI independen. Skor bukan probabilitas kemenangan maupun penilaian keamanan token.

## Pengaturan awal

| Parameter | Nilai awal |
|---|---:|
| Modal virtual | Rp1.000.000 |
| USD/IDR | 16.000, **asumsi manual yang bisa diubah**, bukan kurs terkini |
| Alokasi per posisi | 8% ekuitas termasuk biaya masuk |
| Posisi bersamaan | 3 |
| Stop loss | 6% dari nilai bersih posisi |
| Take profit | 12% dari nilai bersih posisi |
| Trailing stop | Jarak 4%, aktif setelah puncak profit bersih ≥8% |
| Batas rugi sesi | 5% modal bersih; mengunci beli hingga sesi diatur ulang |
| Biaya simulasi | 0,3% per sisi |
| Slippage simulasi | 0,5% per sisi |
| Likuiditas minimal | USD50.000 |
| Volume 1h minimal | USD10.000 |
| Jumlah transaksi beli 5m minimal | 25 |
| Rasio beli minimal | 55% |
| Momentum 5m | 0,5–20% |
| Umur pool minimal | 30 menit |
| FDV/likuiditas maksimal | 50× |
| Skor minimal | 70 |
| Jeda beli ulang token | 5 menit |

Parameter ini adalah contoh untuk pengujian, belum hasil optimasi atau backtest. Jeda beli menghentikan entri baru; posisi tetap dipantau selama aplikasi terlihat dan terbuka. Aplikasi masuk latar belakang/ditutup menghentikan pemantauan. Kembali ke aplikasi selalu memerlukan perintah Mulai bot untuk membeli lagi. Mode lain tidak dipantau saat Anda berpindah sumber data.

Stop dievaluasi pada snapshot berikutnya, sehingga gap harga dapat membuat rugi melewati 6% atau batas sesi 5%. Biaya dan slippage adalah pendekatan konstan. Model belum menghitung kurva AMM, gas/priority fee, tips, MEV, sandwich, dampak order terhadap pool, likuiditas yang dapat dieksekusi, kegagalan swap, pajak token atau hambatan menjual.

**Verifikasi keamanan on-chain belum diterapkan:** mint authority, freeze authority, pemilik terbesar, konsentrasi holder, Token-2022 transfer hooks/fees, penguncian LP, blacklist dan honeypot. Tidak adanya hasil pemeriksaan tidak berarti token aman.

## Menjalankan web di komputer

Memerlukan Node.js 20 atau lebih baru, tanpa paket npm eksternal.

```bash
cd solana-desk
npm run check
npm test
npm start
```

Buka `http://127.0.0.1:4173`. Jangan membuka `index.html` langsung dengan `file://`, karena browser membatasi modul JavaScript pada origin tersebut.

## GitHub, APK dan PWA

Lihat [PANDUAN_ANDROID.md](PANDUAN_ANDROID.md). Workflow APK memakai JDK 17, Gradle 8.11.1, AGP 8.9.2 dan SDK 35. Aplikasi Android minimal Android 8.0, dengan Android System WebView yang mendukung JavaScript modern. Aplikasi tidak memerlukan server untuk mesin simulasi; mode Harga pasar mengakses API publik melalui internet.

Shell Android memakai `WebViewAssetLoader` dengan origin HTTPS lokal. Akses file umum dinonaktifkan. Satu antarmuka JavaScript terbatas menawarkan penyimpanan teks CSV lewat dialog file Android; tidak membuka kunci dompet, perintah sistem atau akses file arbitrer. Izin Android yang diminta hanya internet.

Workflow APK menghasilkan **APK debug untuk uji pribadi**, bukan rilis Play Store. Setiap runner dapat menggunakan kunci debug berbeda; memasang ulang build lain mungkin memerlukan uninstall, yang menghapus sesi lokal. Ekspor jurnal sebelum uninstall. Produksi memerlukan keystore rilis yang dikelola terpisah.

Versi PWA membutuhkan origin HTTPS/GitHub Pages agar dapat dipasang dari Chrome. Service worker hanya menyimpan aset aplikasi sendiri, tidak menyimpan respons API pasar. Versi web hanya diterbitkan lewat workflow manual, setelah Pages dikonfigurasi. Folder `web/` adalah satu-satunya sumber yang dipublikasikan.

## Pencatatan dan penyimpanan

Ekuitas adalah kas ditambah estimasi hasil likuidasi posisi setelah biaya/slippage keluar. Profit dihitung terhadap total modal masuk bersih; menambah modal tidak menciptakan profit. Saldo direkonsiliasi saat sesi dipulihkan. Sesi yang rusak ditolak dan tidak otomatis ditimpa sampai pengguna memilih sesi baru.

Sesi hanya disimpan lokal pada perangkat/browser, tanpa sinkronisasi lintas perangkat. Grafik menyimpan 600 observasi terbaru; tampilan menggunakan maksimal 160 titik dan sumbu otomatis. Jurnal keputusan menyimpan 1.000 kejadian terbaru. **Daftar transaksi selesai disimpan utuh** dan seluruhnya dapat diekspor CSV. Jika penyimpanan penuh/tidak tersedia, aplikasi memberi pesan; ekspor jurnal sebelum menutupnya. Grafik dan angka bukan bukti transaksi di blockchain.

## Validasi

25 tes Node meliputi:

- rekonsiliasi saldo, biaya dua sisi dan hasil rugi pada harga yang tidak berubah;
- posisi maksimal, alokasi kas, stop loss, take profit, trailing dan penguncian rugi sesi;
- harga lama, harga dari pool lain, mode lain dan respons API yang gagal;
- pemisahan mode, pemulihan dalam keadaan dijeda dan perubahan modal;
- normalisasi data hilang, sumber Demo, pemilihan pool dan CSV aman dari formula injection.

`npm run check` memeriksa sintaks JavaScript. Build, lint Android dan APK harus diverifikasi oleh workflow GitHub sebelum APK dianggap siap. Tes adaptor menggunakan respons fixture; hasilnya bukan bukti bahwa akses internet/API pada setiap perangkat sudah berhasil.

Pemeriksaan statis HTML, tautan aset lokal, JSON, XML Android dan tiga workflow YAML lolos. Workflow CI juga menjalankan 11 skenario integrasi browser dengan Playwright 1.57.0 pada desktop dan lebar seluler 390px. Pemeriksaan tersebut memakai fixture pasar. Hasil CI, build/lint Android dan APK dilihat dari run GitHub terkait; keberadaan source saja tidak berarti build sudah berhasil. Pengujian pemasangan di ponsel fisik perlu dilakukan setelah APK tersedia.

## Sumber teknis

- [DEX Screener API](https://docs.dexscreener.com/api/reference)
- [Android: Load in-app content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [Kompatibilitas AGP 8.9](https://developer.android.com/build/releases/agp-8-9-0-release-notes)
- [GitHub Actions artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
