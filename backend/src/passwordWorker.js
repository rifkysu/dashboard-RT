// Dijalankan di worker thread oleh src/password.js -- jangan di-require langsung.
const { parentPort } = require('worker_threads');
const bcrypt = require('bcryptjs');

parentPort.on('message', ({ id, op, args }) => {
  try {
    const result = op === 'hash' ? bcrypt.hashSync(args[0], args[1]) : bcrypt.compareSync(args[0], args[1]);
    parentPort.postMessage({ id, result });
  } catch (err) {
    parentPort.postMessage({ id, error: err.message || String(err) });
  }
});
