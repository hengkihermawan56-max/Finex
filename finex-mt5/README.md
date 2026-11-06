# HENGKI Finex MT5 Bot — v0.1 source preview

EA MQL5 untuk akun Finex melalui MetaTrader 5 desktop/VPS Windows. Bukan APK dan bukan bot GMGN. Tidak membutuhkan OpenAI API atau password dalam source. Belum dikompilasi di MetaEditor, belum backtest/forward test dan belum siap dana nyata. Tidak ada klaim profit.

## Aturan
- Entry ketika EMA 9 melintasi EMA 21 pada dua candle M5 yang telah tutup, dikonfirmasi EMA20/50 M15.
- SL 2 ATR14; TP 1,5 kali jarak SL. Satu posisi per simbol; posisi manual dan pending order juga memblokir entry.
- Risiko default 0,25% equity/order. Bila lot minimum broker melebihi anggaran, entry dilewati. Tidak ada martingale, grid atau penambahan posisi rugi.
- Spread maksimum default 100 **point**, bukan pip; sesuaikan digit dan kondisi simbol broker.
- Penurunan equity 2% dari snapshot awal hari waktu server memblokir entry baru hingga hari berikutnya. Snapshot pertama dibuat ketika EA mulai menerima tick pada hari itu; bukan saldo tengah malam jika terminal mati. Status disimpan di global variables terminal, bukan pada server atau terminal lain.
- Daily halt tidak menutup posisi. SL/TP tetap mengelola posisi. Gap, slippage dan komisi dapat membuat rugi aktual melebihi perhitungan. Deposit/withdrawal memengaruhi equity gate.
- Jalankan SATU instance per simbol pada SATU terminal; jangan menjalankan salinan akun yang sama pada terminal lain. Gunakan Magic default yang sama agar gate equity bersama.
- Tidak ada filter berita, trailing stop atau klaim optimasi untuk XAUUSD. Strategi hanyalah baseline yang harus divalidasi.

## Instal dan uji
1. MT5 desktop login akun **demo Finex**. Buka File → Open Data Folder → MQL5 → Experts; salin HengkiFinex.mq5.
2. Buka MetaEditor (F4), buka file, F7. Wajib 0 error; file EX5 baru tersedia setelah kompilasi. Source ini belum dikompilasi oleh pembuat.
3. Strategy Tester: pilih EA dan simbol broker, model Every tick based on real ticks, periode minimal 6–12 bulan termasuk spread/komisi broker. Set EnableOrders=true; AllowRealAccount=false. Pastikan chart/data M5 dan M15 tersedia.
4. Uji forward demo setidaknya 2–4 minggu. Periksa Journal untuk penolakan order, volume, SL/TP dan duplikasi. Bandingkan hasil di periode di luar periode optimasi; jangan menilai hanya winrate.
5. Pada demo, pasang EA di satu chart; EnableOrders=true dan aktifkan Algo Trading. Default EnableOrders=false hanya mencatat sinyal.
6. Jalankan terminal terus menerus pada PC/VPS Windows. HP Android dipakai memantau akun melalui MT5; EA ini tidak berjalan langsung di aplikasi Android/Termux. Jangan kirim password trading ke chat atau simpan di GitHub.

Akun real diblokir secara default oleh AllowRealAccount=false. Jangan mengubahnya sebelum kompilasi dan pengujian demo selesai. Bot belum dihubungkan ke akun apa pun dan tidak ada order nyata yang dikirim.

## Pemeriksaan wajib di MT5
- BUY/SELL hanya dari candle tutup; tidak langsung entry saat pemasangan/restart.
- Lot minimum melebihi risk budget → tidak entry.
- Posisi/pending order yang ada → tidak entry.
- Spread berlebih atau izin Algo Trading mati → tidak entry.
- Daily halt tetap aktif setelah restart terminal; reset pada hari server berikutnya.
- Order ditolak/timed out → tidak retry candle yang sama; lihat retcode pada Journal.
- Validasi simbol, volume step, stops level, margin, biaya dan slippage pada server Finex demo.

Referensi resmi:
- https://finex.co.id/helpcenter/trading/bagaimana-cara-memulai-trading
- https://www.metatrader5.com/en/terminal/help/algotrading/autotrading
- https://www.metatrader5.com/en/terminal/help/algotrading/trade_robots_indicators
