const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');
const bcrypt = require('bcryptjs');
const logger = require('./logger');

// Hash/cek kata sandi (bcryptjs cost 12) makan ~300 ms CPU per login. Kalau dijalankan di thread
// utama Node, puluhan login bersamaan (jam masuk kantor) membuat SEMUA request lain ikut tertahan.
// Di sini pekerjaan itu dibagi ke beberapa worker thread (memakai core CPU lain), jadi API tetap
// responsif selama lonjakan login. Gagal membuat worker -> kembali ke bcryptjs di thread utama.
const SIZE = Math.max(1, Math.min(4, (os.availableParallelism ? os.availableParallelism() : os.cpus().length) - 1));
const WORKER_FILE = path.join(__dirname, 'passwordWorker.js');

const workers = []; // { worker, busy }
const queue = []; // { op, args, resolve, reject }
const pending = new Map(); // id -> { resolve, reject, slot }
let nextId = 1;
let disabled = false;

function spawn() {
  const slot = { worker: new Worker(WORKER_FILE), busy: false };
  slot.worker.unref(); // jangan menahan proses tetap hidup saat shutdown
  slot.worker.on('message', ({ id, result, error }) => {
    const task = pending.get(id);
    pending.delete(id);
    slot.busy = false;
    if (task) (error ? task.reject(new Error(error)) : task.resolve(result));
    drain();
  });
  let failed = false;
  const fail = (err) => {
    if (failed) return; // 'error' biasanya disusul 'exit' -> cukup sekali
    failed = true;
    const i = workers.indexOf(slot);
    if (i >= 0) workers.splice(i, 1);
    for (const [id, task] of pending) if (task.slot === slot) { pending.delete(id); task.reject(err); }
    logger.error('Worker kata sandi berhenti, dibuat ulang', { error: err });
    try { workers.push(spawn()); } catch (e) { disabled = true; }
    drain();
  };
  slot.worker.on('error', fail);
  slot.worker.on('exit', (code) => { if (code !== 0) fail(new Error(`Worker exit ${code}`)); });
  return slot;
}

try {
  for (let i = 0; i < SIZE; i += 1) workers.push(spawn());
} catch (err) {
  disabled = true;
  logger.error('Worker kata sandi tidak bisa dibuat, memakai thread utama', { error: err });
}

function drain() {
  for (const slot of workers) {
    if (!queue.length) return;
    if (slot.busy) continue;
    const { op, args, resolve, reject } = queue.shift();
    const id = nextId++;
    slot.busy = true;
    pending.set(id, { resolve, reject, slot });
    slot.worker.postMessage({ id, op, args });
  }
}

function run(op, args) {
  if (disabled || !workers.length) return op === 'hash' ? bcrypt.hash(...args) : bcrypt.compare(...args);
  return new Promise((resolve, reject) => {
    queue.push({ op, args, resolve, reject });
    drain();
  });
}

module.exports = {
  hash: (password, rounds) => run('hash', [password, rounds]),
  compare: (password, hash) => run('compare', [password, hash]),
};
