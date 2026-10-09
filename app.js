// Registro de Service Worker para uso Offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error:', err));
  });
}

const $ = id => document.getElementById(id);
let stream = null, shots = [], frame = null;

const defaultFrames = [
  { photo: 1, x: 1.5, y: 7, w: 47, h: 25 },
  { photo: 2, x: 1.5, y: 37.5, w: 47, h: 25 },
  { photo: 3, x: 1.5, y: 68, w: 47, h: 25 },
  { photo: 1, x: 51.5, y: 7, w: 47, h: 25 },
  { photo: 2, x: 51.5, y: 37.5, w: 47, h: 25 },
  { photo: 3, x: 51.5, y: 68, w: 47, h: 25 }
];

let cfg = JSON.parse(localStorage.getItem('emeveCfg') || 'null') || {
  format: '2x6x2',
  stripMode: 'duplicate',
  delay: 3,
  photos: 3,
  event: '',
  topText: 'EMEVE PHOTOBOOTH',
  bottomText: 'No hacemos eventos, creamos experiencias',
  bg: '#ffffff',
  fg: '#111111',
  frame: null,
  frames: defaultFrames
};

// Pestañas del Modal
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.tab).classList.add('active');
  };
});

function apply() {
  ['format', 'delay', 'event', 'topText', 'bottomText', 'bg', 'fg'].forEach(k => { if($(k)) $(k).value = cfg[k]; });$('stripMode').value = cfg.stripMode || 'duplicate';
  $('stripModeField').style.display = cfg.format === '2x6x2' ? 'block' : 'none';$('homeEvent').textContent = cfg.event || 'Toca para comenzar';
  if (cfg.frame) {
    let im = new Image();
    im.onload = () => { frame = im; renderDesignPreview(); };
    im.src = cfg.frame;
  }
  renderFrameList();
  renderDesignPreview();
}

function saveCfg() {
  ['format', 'delay', 'event', 'topText', 'bottomText', 'bg', 'fg'].forEach(k => { if($(k)) cfg[k] =$(k).value; });
  cfg.stripMode = $('stripMode').value;
  cfg.frames = readFrameList();
  cfg.frame = frame ? frame.src : null;
  localStorage.setItem('emeveCfg', JSON.stringify(cfg));
  $('homeEvent').textContent = cfg.event || 'Toca para comenzar';
}

function show(id) {
  document.querySelectorAll('.screen').forEach(x => x.classList.remove('active'));
  $(id).classList.add('active');
}

function dots() {
  $('dots').innerHTML = '';
  for (let i = 0; i < 3; i++) {
    let d = document.createElement('div');
    d.className = 'dot ' + (i < shots.length ? 'done' : '');
    $('dots').appendChild(d);
    const t = $('thumb' + (i + 1));
    if (t) {
      t.classList.toggle('done', i < shots.length);
      t.innerHTML = i < shots.length ? `<img src="${shots[i]}">` : `<span>${i + 1}</span>`;
    }
  }
}

async function camera() {
  if (!stream) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
    } catch (e) { return false; }
  }
  $('homeVideo').srcObject = stream;
  $('video').srcObject = stream;
  return true;
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function countdown(seconds, n) {
  $('captureStatus').textContent = `Foto ${n} de 3 en camino…`;
  for (let i = seconds; i > 0; i--) {
    $('count').style.display = 'flex';$('count').textContent = i;
    await wait(1000);
  }
  $('count').style.display = 'none';
}

function captureFrame() {
  const c = document.createElement('canvas');
  c.width = 1920; c.height = 1080;
  const v = $('video'), ctx = c.getContext('2d');
  ctx.save();
  ctx.translate(1920, 0); ctx.scale(-1, 1);
  ctx.drawImage(v, 0, 0, 1920, 1080);
  ctx.restore();
  return c.toDataURL('image/jpeg', .95);
}

async function take() {
  if (shots.length > 0) return;
  for (let n = 1; n <= 3; n++) {
    await countdown(+cfg.delay, n);
    const photo = captureFrame();
    shots.push(photo);
    dots();
    $('flash').style.display = 'block';
    await wait(100);
    $('flash').style.display = 'none';
    if (n < 3) await wait(400);
  }
  $('captureStatus').textContent = '¡Procesando imágenes!';
  await wait(300);
  makeOutput();
}

function outputSize() {
  return cfg.format === '2x6' ? { W: 600, H: 1800 } : { W: 1200, H: 1800 };
}

async function makeOutput() {
  const { W, H } = outputSize();
  const c = $('out'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = cfg.bg; x.fillRect(0, 0, W, H);

  const images = await Promise.all(shots.map(src => new Promise(res => {
    let im = new Image(); im.onload = () => res(im); im.src = src;
  })));

  let frames = readFrameList();
  if (cfg.format === '2x6x2' && cfg.stripMode === 'duplicate' && frames.length >= 3) {
    frames = frames.slice(0, 3).concat(frames.slice(0, 3).map(f => ({ ...f, x: f.x + 50 })));
  }

  frames.forEach(f => {
    const im = images[(Math.max(1, Math.min(3, +f.photo || 1))) - 1];
    const px = W * f.x / 100, py = H * f.y / 100, pw = W * f.w / 100, ph = H * f.h / 100;
    x.drawImage(im, px, py, pw, ph);
  });

  if (frame) x.drawImage(frame, 0, 0, W, H);
  x.fillStyle = cfg.fg; x.textAlign = 'center';
  if (cfg.topText) { x.font = 'bold 40px Arial'; x.fillText(cfg.topText, W / 2, 60); }
  if (cfg.event) { x.font = 'bold 30px Arial'; x.fillText(cfg.event, W / 2, H - 40); }
  show('result');
}

function readFrameList() {
  const nodes = [...document.querySelectorAll('.frameItem')];
  return nodes.length ? nodes.map(n => ({
    photo: +n.querySelector('.fp').value,
    x: +n.querySelector('.fx').value,
    y: +n.querySelector('.fy').value,
    w: +n.querySelector('.fw').value,
    h: +n.querySelector('.fh').value
  })) : cfg.frames;
}

function renderFrameList() {
  const list = $('frameList'); if (!list) return;
  list.innerHTML = '';
  cfg.frames.forEach((f, i) => {
    const d = document.createElement('div');
    d.className = 'frameItem mt-2';
    d.innerHTML = `<span>Marco ${i+1}:</span> 
      <select class="fp"><option value="1">Foto 1</option><option value="2">Foto 2</option><option value="3">Foto 3</option></select>
      <input class="fx" type="number" value="${f.x}" style="width:60px"> %X
      <input class="fy" type="number" value="${f.y}" style="width:60px"> %Y
      <input class="fw" type="number" value="${f.w}" style="width:60px"> %W
      <input class="fh" type="number" value="${f.h}" style="width:60px"> %H`;
    list.appendChild(d);
    d.querySelector('.fp').value = f.photo;
  });
}

function renderDesignPreview() {
  const c = $('designPreview'); if (!c) return;
  const { W, H } = outputSize(); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = $('bg').value; x.fillRect(0, 0, W, H);
}

// Botones e Interacciones
$('begin').onclick = async () => {
  saveCfg(); shots = []; dots();
  if (await camera()) { show('capture'); take(); }
  else alert('Asegúrate de permitir acceso a la cámara.');
};

$('cancel').onclick = () => { shots = []; dots(); show('home'); };
$('again').onclick = () => { shots = []; dots(); show('home'); };$('adminBtn').onclick = () => { renderFrameList(); renderDesignPreview(); show('settings'); };
$('closeSettings').onclick = () => { saveCfg(); show('home'); };$('saveTemplate').onclick = () => { saveCfg(); alert('Ajustes guardados'); show('home'); };

$('save').onclick = () => {
  let a = document.createElement('a');
  a.download = `EMEVE-${cfg.event || 'PHOTOBOOTH'}.jpg`;
  a.href = $('out').toDataURL('image/jpeg', .95);
  a.click();
};

$('print').onclick = () => window.print();

apply(); dots();
window.addEventListener('load', () => camera().catch(() => {}));
