# Multi Currency Dashboard

Dashboard kurs sederhana untuk memantau nilai tukar IDR terhadap beberapa mata uang utama, melihat perubahan historis, menghitung konversi nominal, dan membaca konteks berita terkait.

## Demo

- Live site: [multi-currency-dashboard.vercel.app](https://multi-currency-dashboard.vercel.app/)

## Tentang proyek

Project ini dibuat sebagai dashboard kurs ringan untuk kebutuhan pemantauan harian. Fokus utamanya adalah membantu pengguna melihat kurs aktif, perubahan dalam periode tertentu, hasil konversi nominal, dan ringkasan konteks yang lebih mudah dibaca dalam satu tampilan.

## Fitur utama

- Pantau kurs IDR terhadap AUD, USD, SGD, JPY, EUR, dan GBP.
- Pilih periode analisis 7, 14, atau 30 hari.
- Hitung konversi nominal dengan format angka lokal Indonesia.
- Lihat perubahan periode dan sinyal arah indikatif.
- Buka “Kurs lainnya” lewat horizontal swipe yang nyaman di mobile.
- Simpan pair favorit ke daftar pantauan.
- Baca berita terkait untuk menambah konteks pergerakan kurs.
- Gunakan light mode dan dark mode.

## Kenapa project ini dibuat

Banyak currency dashboard terasa terlalu padat atau terlalu teknis untuk kebutuhan cek cepat. Project ini dirancang agar tetap ringkas, mudah dipakai di mobile, dan fokus pada keputusan sederhana sehari-hari, terutama untuk kebutuhan pemantauan kurs pribadi.

## Tampilan utama

Dashboard ini terdiri dari beberapa blok utama:

- Atur mata uang & nominal.
- Hasil utama.
- Pergerakan kurs.
- Insight singkat.
- Kurs lainnya.
- Kurs tersimpan.
- Berita penggerak kurs.

## Tech stack

- HTML
- CSS
- JavaScript
- [Chart.js](https://www.chartjs.org/)
- [Frankfurter API](https://www.frankfurter.app/)
- Google News RSS

## Cara menjalankan project

Karena ini project statis, kamu bisa menjalankannya dengan sangat sederhana.

### Opsi 1 — buka langsung
1. Clone repository ini.
2. Buka file `index.html` di browser.

### Opsi 2 — pakai local server
Jika ingin development yang lebih rapi:

```bash
git clone https://github.com/RqMubarok/multi-currency-dashboard.git
cd multi-currency-dashboard
```

Lalu jalankan local server favoritmu, misalnya dengan VS Code Live Server.

## Struktur file

```bash
multi-currency-dashboard/
├── index.html
├── style.css
├── app.js
└── README.md
```

## Catatan

- Data kurs menggunakan sumber eksternal, jadi hasil tergantung ketersediaan API.
- Berita terkait diambil dari feed publik, sehingga hasil bisa berubah sewaktu-waktu.
- Daftar pantauan dan tema disimpan di browser pengguna.

## Pengembangan berikutnya

Beberapa ide pengembangan lanjutan:

- Tambah pilihan mata uang yang lebih banyak.
- Tambah range 3 bulan, 6 bulan, dan 1 tahun.
- Tambah alert kurs target.
- Tambah perbandingan beberapa pair sekaligus.
- Tambah insight yang lebih informatif tanpa terasa seperti prediksi pasar.
- Tambah fallback data atau caching agar tetap usable saat API lambat.

## Status project

Masih dalam tahap pengembangan dan iterasi UI/UX.

## Author

Dibuat oleh [RqMubarok](https://github.com/RqMubarok)

## License

Project ini menggunakan lisensi MIT.
