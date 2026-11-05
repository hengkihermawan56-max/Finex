# Analisis video referensi

Sumber: `WhatsApp Video 2026-11-05 at 11.03.50.mp4`, durasi sekitar 59 detik, tampilan vertikal 576 × 1250. Analisis dilakukan terhadap cuplikan tampilan; kode pembuat video, log server dan transaksi blockchain tidak disertakan.

## Hal yang terlihat

| Unsur | Tampilan pada video | Implementasi proyek |
|---|---|---|
| Identitas | “Grok Bot”, Solana memes, strict RM, paper | Identitas HENGKI Solana Desk, mode paper ditampilkan jelas |
| Modal dan ekuitas | Teks modal USD30, angka ekuitas dan persentase profit | Saldo virtual Rp1 juta, profit bersih dan modal masuk bersih |
| Grafik | Kurva ekuitas meningkat pada cuplikan | Grafik dari saldo kas dan nilai posisi, dapat turun maupun naik |
| Kontrol | Turbo, Deposit, Withdraw, Pause, Reset | Mulai/jeda beli, perubahan modal virtual, sesi baru dan pengaturan |
| Modul | Label “6 agents”; Scout, Filter, Analyst, Executor dan Risk terlihat | Enam modul aturan: kelima fungsi tersebut ditambah Journal |
| Risiko | Teks ukuran posisi 8%, stop −6%, trailing | Parameter alokasi, stop, target, trailing, batas rugi sesi dan cooldown |
| Sumber token | Teks Pump.fun/Raydium pada modul | Profil terbaru DEX Screener + watchlist; jangkauan sumber ditulis sesuai implementasi |

Label keenam pada video tidak terbaca jelas di cuplikan yang diperiksa. Modul Journal pada proyek adalah pilihan implementasi untuk pencatatan, bukan klaim reproduksi label asli.

## Makna kenaikan saldo

Pada beberapa cuplikan angka meningkat dari sekitar USD33 menjadi sekitar USD864, dengan teks modal USD30 dan profit sekitar 2.779%. Video sendiri menampilkan label **paper**, sehingga angka tersebut tidak membuktikan keuntungan uang nyata. Jam pada ponsel juga berubah; durasi file video tidak membuktikan lamanya sesi trading aslinya.

Video tidak memperlihatkan alamat dompet, hash transaksi beli/jual, bukti penarikan, detail fill, biaya, likuiditas yang dapat dieksekusi atau histori kerugian. Dari tampilan saja tidak dapat dipastikan apakah data berasal dari harga sungguhan, simulasi acak, pemutaran ulang, atau log yang dipercepat. Tidak ada dasar untuk menjanjikan hasil, win rate atau kecepatan profit yang sama.

Nama “Grok” dan label “agents” juga tidak cukup membuktikan penggunaan Grok maupun enam model AI berbeda. Sistem serupa dapat dibuat sebagai satu aplikasi dengan enam modul fungsi. Proyek ini menampilkan pendekatan tersebut secara terbuka dan tidak memerlukan biaya LLM.

## Bagian yang dibuat

Versi awal mengutamakan pengujian: UI seluler/desktop, dua sumber harga yang terpisah, simulasi beli-jual, biaya dua sisi, jurnal, batas risiko, penyimpanan lokal, ekspor, proyek Android dan workflow GitHub. Pergerakan Demo dapat menghasilkan kerugian dan tidak dipaksa naik.

Trading uang nyata, penandatanganan dompet, verifikasi keamanan kontrak dan layanan bot 24 jam belum termasuk. Menambahkannya memerlukan implementasi dan pengujian tersendiri, bukan sekadar mengubah label “paper” menjadi “live”.

## Peran GitHub

GitHub menyimpan source dan riwayat perubahan. Actions menguji mesin dan membangun APK. Pages dapat menayangkan aplikasi web. Mesin paper berjalan di perangkat selama aplikasi terbuka; repo GitHub bukan server trading berkelanjutan.

Sumber teknis: [API DEX Screener](https://docs.dexscreener.com/api/reference), [GitHub Actions artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
