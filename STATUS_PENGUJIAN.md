# Status pengujian · 5 November 2026

## Versi 1.1 — GMGN server dan APK pembuka panel

Mesin server memiliki 25 tes lokal/CI yang lolos. Pengujian menggunakan wallet/kunci sintetis dan transport tiruan; tidak ada transaksi GMGN sungguhan yang dikirim. Server belum dipasang dan belum memiliki API key produksi. Batas dana default nol.

| Pemeriksaan 1.1 | Hasil |
|---|---|
| Unit mesin simulasi | 25 lolos |
| Unit server GMGN | 25 lolos |
| Browser dasbor dan launcher | 13 skenario lolos |
| Browser panel server | 7 skenario lolos; screenshot seluler diperiksa |
| Build/lint APK 1.1 | Lolos |
| Image Docker dan Compose | Lolos |
| Koneksi akun GMGN dengan dana | Belum diuji/dikonfigurasi |
| Server aktif 24 jam | Belum dipasang; VPS belum tersedia |

Source: `8c6a4cbdd2f45b0c12d02c710676141dae477e03`.

- [Run APK 1.1](https://github.com/hengkihermawan56-max/Finex/actions/runs/41976483127)
- [Run server](https://github.com/hengkihermawan56-max/Finex/actions/runs/41976483151)
- [Run dasbor](https://github.com/hengkihermawan56-max/Finex/actions/runs/41976483099)

## Riwayat versi 1.0 — paper

| Bagian | Hasil |
|---|---|
| Mesin simulasi dan adaptor data | 25 tes Node lolos |
| Sintaks JavaScript web | Lolos `npm run check` |
| HTML satu file | Sintaks JavaScript gabungan lolos |
| Referensi ID HTML dan aset lokal | Lolos pemeriksaan statis |
| JSON, manifest PWA dan XML Android | Lolos parse |
| Workflow CI, APK dan Pages | YAML berhasil dibaca parser |
| Interaksi/visual browser | 11 skenario desktop/390px lolos, tanpa page error; screenshot desktop/seluler diperiksa |
| Akses API DEX Screener di aplikasi | Adaptor diuji dengan fixture; pengujian end-to-end di perangkat belum dilakukan |
| Akses repositori GitHub | Koneksi ke pemilik akun dan Finex sudah terbaca setelah aplikasi GitHub dipasang |
| Build dan lint Android | Berhasil pada run 41972318176, `assembleDebug` dan `lintDebug` |
| APK | `HENGKI-Solana-Desk-debug.apk`, 1.210.462 byte; checksum cocok dengan hasil workflow |
| Pemasangan pada HP fisik | Belum diuji; APK debug untuk pengujian pribadi |
| Publikasi GitHub Pages | Belum dijalankan |

File proyek memuat workflow CI, APK dan Pages. Ketersediaan kode sumber dan keberhasilan tes mesin tidak berarti APK sudah berhasil dibangun atau sudah lolos pengujian di ponsel. Status GitHub Actions pada commit yang digunakan menjadi rujukan hasil build.

Source APK: `06a14472e4235a7203bf13751d94cf7cdd7e8ead`.

SHA-256 APK: `0571d6322eabd4968a448c4cf68d20128e5be8cc447c6d2d1b836223d0ea3e41`.

- [Run Android](https://github.com/hengkihermawan56-max/Finex/actions/runs/41972318176)
- [Run pengujian](https://github.com/hengkihermawan56-max/Finex/actions/runs/41972318140)
