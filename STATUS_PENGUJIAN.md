# Status pengujian · 5 November 2026

| Bagian | Hasil |
|---|---|
| Mesin simulasi dan adaptor data | 25 tes Node lolos |
| Sintaks JavaScript web | Lolos `npm run check` |
| HTML satu file | Sintaks JavaScript gabungan lolos |
| Referensi ID HTML dan aset lokal | Lolos pemeriksaan statis |
| JSON, manifest PWA dan XML Android | Lolos parse |
| Workflow CI, APK dan Pages | YAML berhasil dibaca parser |
| Interaksi/visual browser | Workflow CI disiapkan untuk 11 skenario desktop/390px dengan fixture pasar; lihat hasil run terkait |
| Akses API DEX Screener di aplikasi | Adaptor diuji dengan fixture; pengujian end-to-end di perangkat belum dilakukan |
| Akses repositori GitHub | Koneksi ke pemilik akun dan Finex sudah terbaca setelah aplikasi GitHub dipasang |
| Build dan lint Android | Dijalankan otomatis melalui workflow setelah source diunggah; status akhir dilihat pada run terkait |
| APK siap unduh/pasang | Belum dihasilkan |
| Publikasi GitHub Pages | Belum dijalankan |

File proyek memuat workflow CI, APK dan Pages. Ketersediaan kode sumber dan keberhasilan tes mesin tidak berarti APK sudah berhasil dibangun atau sudah lolos pengujian di ponsel. Status GitHub Actions pada commit yang digunakan menjadi rujukan hasil build.
