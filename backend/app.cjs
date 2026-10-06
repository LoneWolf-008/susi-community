// Startup file untuk Passenger / cPanel "Setup Node.js App". Passenger memuat startup file lewat
// require(), sedangkan backend ini ES module ("type": "module"), sehingga require('./server.js')
// gagal dengan ERR_REQUIRE_ESM. Pembungkus CommonJS ini memuatnya lewat import() dinamis.
// Passenger mengambil alih listen() pertama di server.js ke socket miliknya (port diabaikan).
import('./server.js').catch((err) => {
  console.error('[startup] gagal memuat server.js:', err);
  process.exit(1);
});
