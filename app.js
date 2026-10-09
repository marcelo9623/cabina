// Registra Service Worker para garantizar la operabilidad sin internet
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('Error Service Worker:', err);
    });
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

cfg.stripMode = cfg.stripMode || 'duplicate';
if (!Array.isArray(cfg.frames) || !cfg.frames.length) {
  cfg.frames = JSON.parse(JSON.stringify(defaultFrames));
}

function apply() {
  for (const k of ['format', 'delay', 'photos', 'event', 'topText', 'bottomText', 'bg', 'fg']) {
    $(k).value = cfg[k];
  }
  $('stripMode').value = cfg.stripMode || 'duplicate';
  $('stripModeField').style.display = cfg.format === '2x6x2' ? 'block' : 'none';
  $('homeEvent').textContent = cfg.event || 'Toca para comenzar';
  if (cfg.frame) {
    let im = new Image();
    im.onload = () => {
      frame = im;
      renderDesignPreview();
    };
    im.src = cfg.frame;
  }
  renderFrameList();
  renderDesignPreview();
}

function saveCfg() {
  for (const k of ['format', 'delay', 'event', 'topText', 'bottomText', 'bg', 'fg']) {
    cfg[k] = $(k).value;
  }
  cfg.stripMode = $('stripMode').value;
  cfg.photos = 3;
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
    let d = document.createElement('i');
    d.className = 'dot ' + (i < shots.length ? 'done' : '');
    $('dots').appendChild(d);
    const t = $('thumb' + (i + 1));
    if (t) {
      t.classList.toggle('done', i < shots.length);
      t.innerHTML = i < shots.length 
        ? '<img alt="Foto ' + (i + 1) + ' capturada" src="' + shots[i] + '"><span>Foto ' + (i + 1) + '</span>' 
        : 'Foto ' + (i + 1);
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
    } catch (e) {
      return false;
    }
  }
  const live = $('homeVideo'), capture = $('video');
  if (live && live.srcObject !== stream) live.srcObject = stream;
  if (capture && capture.srcObject !== stream) capture.srcObject = stream;
  try {
    if (live) await live.play();
    if (capture) await capture.play();
  } catch (e) {}
  return true;
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function countdown(seconds, n) {
  $('captureStatus').textContent = 'Preparando Foto ' + n + ' de 3';
  for (let i = seconds; i > 0; i--) {
    $('count').style.display = 'flex';
    $('count').textContent = i;
    await wait(1000);
  }
  $('count').style.display = 'none';
  $('captureStatus').textContent = '¡FOTO ' + n + '!';
  await wait(120);
}

function captureFrame() {
  const c = document.createElement('canvas');
  c.width = 1920;
  c.height = 1080;
  const v = $('video'), ctx = c.getContext('2d');
  const vw = v.videoWidth || 1920, vh = v.videoHeight || 1080;
  const srcRatio = vw / vh, target = 1920 / 1080;
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (srcRatio > target) {
    sw = Math.round(vh * target);
    sx = Math.round((vw - sw) / 2);
  } else if (srcRatio < target) {
    sh = Math.round(vw / target);
    sy = Math.round((vh - sh) / 2);
  }
  ctx.save();
  ctx.translate(1920, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(v, sx, sy, sw, sh, 0, 0, 1920, 1080);
  ctx.restore();
  return c.toDataURL('image/jpeg', .95);
}

async function take() {
  if (shots.length > 0) return;
  $('cancel').disabled = true;
  for (let n = 1; n <= 3; n++) {
    await countdown(+cfg.delay, n);
    await wait(35);
    const photo = captureFrame();
    shots.push(photo);
    dots();
    const f = $('flash');
    f.style.display = 'block';
    await wait(130);
    f.style.display = 'none';
    if (n < 3) await wait(350);
  }
  $('captureStatus').textContent = '¡Sesión terminada!';
  await wait(450);
  makeOutput();
  $('cancel').disabled = false;
}

function img(src) {
  return new Promise(res => {
    let im = new Image();
    im.onload = () => res(im);
    im.src = src;
  });
}

function outputSize() {
  return cfg.format === '2x6' ? { W: 600, H: 1800 } : { W: 1200, H: 1800 };
}

async function makeOutput() {
  const { W, H } = outputSize();
  $('out').width = W;
  $('out').height = H;
  const c = $('out'), x = c.getContext('2d');
  x.fillStyle = cfg.bg;
  x.fillRect(0, 0, W, H);
  const images = await Promise.all(shots.map(img));
  let frames = readFrameList();
  if (cfg.format === '2x6x2' && cfg.stripMode === 'duplicate' && frames.length >= 3) {
    frames = frames.slice(0, 3).concat(frames.slice(0, 3).map(f => ({ ...f, x: f.x + 50 })));
  }
  frames.forEach(f => drawFrame(x, f, W, H, images));
  if (frame) x.drawImage(frame, 0, 0, W, H);
  x.fillStyle = cfg.fg;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const pad = Math.round(H * .025);
  if (cfg.topText) {
    x.font = 'bold ' + Math.max(22, Math.round(H * .035)) + 'px Arial';
    x.fillText(cfg.topText, W / 2, pad + Math.round(H * .02), W * .92);
  }
  if (cfg.event) {
    x.font = 'bold ' + Math.max(18, Math.round(H * .025)) + 'px Arial';
    x.fillText(cfg.event, W / 2, H - pad - Math.round(H * .04), W * .92);
  } else if (cfg.bottomText) {
    x.font = 'bold ' + Math.max(16, Math.round(H * .022)) + 'px Arial';
    x.fillText(cfg.bottomText, W / 2, H - pad - Math.round(H * .04), W * .92);
  }
  show('result');
}

function drawFrame(x, f, W, H, ims) {
  const im = ims[(Math.max(1, Math.min(3, +f.photo || 1))) - 1];
  const px = W * f.x / 100, py = H * f.y / 100, pw = W * f.w / 100, ph = H * f.h / 100;
  x.save();
  x.beginPath();
  x.rect(px, py, pw, ph);
  x.clip();
  const ir = im.width / im.height, tr = pw / ph;
  let sw = im.width, sh = im.height;
  if (ir > tr) sw = im.height * tr;
  else sh = im.width / tr;
  const sx = (im.width - sw) / 2, sy = (im.height - sh) / 2;
  x.drawImage(im, sx, sy, sw, sh, px, py, pw, ph);
  x.restore();
}

function baseFrames() {
  if (cfg.format === '2x6x2') return JSON.parse(JSON.stringify(defaultFrames));
  if (cfg.format === '2x6') return [
    { photo: 1, x: 5, y: 7, w: 90, h: 25 },
    { photo: 2, x: 5, y: 37.5, w: 90, h: 25 },
    { photo: 3, x: 5, y: 68, w: 90, h: 25 }
  ];
  return [
    { photo: 1, x: 5, y: 7, w: 90, h: 25 },
    { photo: 2, x: 5, y: 37.5, w: 90, h: 25 },
    { photo: 3, x: 5, y: 68, w: 90, h: 25 }
  ];
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
  const list = $('frameList');
  if (!list) return;
  list.innerHTML = '';
  cfg.frames.forEach((f, i) => addFrameUI(f, i, list));
}

function addFrameUI(f, i, list = $('frameList')) {
  const d = document.createElement('div');
  d.className = 'frameItem';
  d.innerHTML = '<strong>Marco ' + (i + 1) + '</strong><div class="field"><label>Mostrar</label><select class="fp"><option value="1">Foto 1</option><option value="2">Foto 2</option><option value="3">Foto 3</option></select></div><div class="miniGrid"><input class="fx" type="number" min="0" max="100" step="0.5" placeholder="X %"><input class="fy" type="number" min="0" max="100" step="0.5" placeholder="Y %"><input class="fw" type="number" min="1" max="100" step="0.5" placeholder="Ancho %"><input class="fh" type="number" min="1" max="100" step="0.5" placeholder="Alto %"></div><button class="danger smallBtn removeFrame" style="margin-top:8px">Eliminar marco</button>';
  list.appendChild(d);
  d.querySelector('.fp').value = f.photo;
  d.querySelector('.fx').value = f.x;
  d.querySelector('.fy').value = f.y;
  d.querySelector('.fw').value = f.w;
  d.querySelector('.fh').value = f.h;
  d.querySelectorAll('input,select').forEach(el => {
    el.addEventListener('input', renderDesignPreview);
    el.addEventListener('change', renderDesignPreview);
  });
  d.querySelector('.removeFrame').onclick = () => {
    d.remove();
    renderDesignPreview();
  };
}

function renderDesignPreview() {
  const c = $('designPreview');
  if (!c) return;
  cfg.format = $('format').value;
  cfg.stripMode = $('stripMode').value;
  cfg.event = $('event').value;
  cfg.topText = $('topText').value;
  cfg.bottomText = $('bottomText').value;
  cfg.bg = $('bg').value;
  cfg.fg = $('fg').value;

  const { W, H } = outputSize();
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = cfg.bg;
  x.fillRect(0, 0, W, H);

  let previewFrames = readFrameList();
  if (cfg.format === '2x6x2' && cfg.stripMode === 'duplicate' && previewFrames.length >= 3) {
    previewFrames = previewFrames.slice(0, 3).concat(previewFrames.slice(0, 3).map(f => ({ ...f, x: f.x + 50 })));
  }

  function placeholderPhoto(n, px, py, pw, ph) {
    x.save();
    x.beginPath();
    x.rect(px, py, pw, ph);
    x.clip();
    const g = x.createLinearGradient(px, py, px + pw, py + ph);
    g.addColorStop(0, ['#426b86', '#765c8b', '#b86d70'][n - 1]);
    g.addColorStop(1, ['#d4b99b', '#b7c7d8', '#e7bd8e'][n - 1]);
    x.fillStyle = g;
    x.fillRect(px, py, pw, ph);
    x.fillStyle = 'rgba(15,25,35,.28)';
    x.beginPath();
    x.ellipse(px + pw * .5, py + ph * .8, pw * .34, ph * .22, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.85)';
    x.beginPath();
    x.arc(px + pw * .5, py + ph * .35, Math.min(pw, ph) * .13, 0, Math.PI * 2);
    x.fill();
    x.font = 'bold ' + Math.max(12, Math.round(pw * .075)) + 'px Arial';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#fff';
    x.shadowColor = '#0008';
    x.shadowBlur = 5;
    x.fillText('VISTA FOTO ' + n, px + pw / 2, py + ph * .66, pw * .9);
    x.restore();
  }

  previewFrames.forEach(f => {
    const px = W * f.x / 100, py = H * f.y / 100, pw = W * f.w / 100, ph = H * f.h / 100;
    const shot = shots[Number(f.photo) - 1];
    if (shot) {
      const im = new Image();
      im.onload = () => {
        const xx = c.getContext('2d');
        const ir = im.width / im.height, tr = pw / ph;
        let sw = im.width, sh = im.height;
        if (ir > tr) sw = im.height * tr;
        else sh = im.width / tr;
        xx.save();
        xx.beginPath();
        xx.rect(px, py, pw, ph);
        xx.clip();
        xx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, px, py, pw, ph);
        xx.restore();
        if (frame) xx.drawImage(frame, 0, 0, W, H);
      };
      im.src = shot;
    } else {
      placeholderPhoto(Math.max(1, Math.min(3, +f.photo || 1)), px, py, pw, ph);
    }
    x.strokeStyle = '#28a9ff';
    x.lineWidth = Math.max(2, W / 600);
    x.strokeRect(px, py, pw, ph);
  });

  if (frame) x.drawImage(frame, 0, 0, W, H);
  x.fillStyle = cfg.fg;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const pad = Math.round(H * .025);
  if (cfg.topText) {
    x.font = 'bold ' + Math.max(22, Math.round(H * .035)) + 'px Arial';
    x.fillText(cfg.topText, W / 2, pad + Math.round(H * .02), W * .92);
  }
  if (cfg.event) {
    x.font = 'bold ' + Math.max(18, Math.round(H * .025)) + 'px Arial';
    x.fillText(cfg.event, W / 2, H - pad - Math.round(H * .04), W * .92);
  } else if (cfg.bottomText) {
    x.font = 'bold ' + Math.max(16, Math.round(H * .022)) + 'px Arial';
    x.fillText(cfg.bottomText, W / 2, H - pad - Math.round(H * .04), W * .92);
  }
}

$('begin').onclick = async () => {
  saveCfg();
  shots = [];
  dots();
  if (await camera()) {
    show('capture');
    take();
  } else {
    alert('No se pudo abrir la cámara. Permite el acceso a Cámara y abre la aplicación desde HTTPS.');
  }
};

$('cancel').onclick = () => {
  shots = [];
  dots();
  $('count').style.display = 'none';
  $('flash').style.display = 'none';
  $('captureStatus').textContent = 'Preparando sesión…';
  show('home');
  $('cancel').disabled = false;
};

$('again').onclick = () => {
  shots = [];
  dots();
  show('home');
};

$('adminBtn').onclick = () => {
  renderFrameList();
  renderDesignPreview();
  show('settings');
};

$('closeSettings').onclick = () => {
  saveCfg();
  show('home');
};

$('saveTemplate').onclick = () => {
  saveCfg();
  alert('Plantilla guardada en este dispositivo.');
};

$('exportConfig').onclick = () => {
  saveCfg();
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'emeve-plantilla.json';
  a.click();
  URL.revokeObjectURL(a.href);
};

$('importConfig').onclick = () => $('configFile').click();

$('configFile').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!imported || !Array.isArray(imported.frames)) throw new Error('Formato no válido');
    cfg = { ...cfg, ...imported };
    localStorage.setItem('emeveCfg', JSON.stringify(cfg));
    frame = null;
    if (cfg.frame) {
      const im = new Image();
      im.onload = () => {
        frame = im;
        apply();
      };
      im.onerror = () => {
        cfg.frame = null;
        apply();
      };
      im.src = cfg.frame;
    } else apply();
    alert('Configuración importada.');
  } catch (err) {
    alert('No se pudo importar. Usa un archivo JSON exportado desde Emeve Photobooth.');
  }
  e.target.value = '';
};

$('addFrame').onclick = () => {
  addFrameUI({ photo: 1, x: 10, y: 10, w: 30, h: 20 });
  renderDesignPreview();
};

$('format').onchange = () => {
  cfg.format = $('format').value;
  cfg.frames = baseFrames();
  $('stripModeField').style.display = cfg.format === '2x6x2' ? 'block' : 'none';
  renderFrameList();
  renderDesignPreview();
};

$('stripMode').onchange = () => {
  cfg.stripMode = $('stripMode').value;
  renderDesignPreview();
};

['bg', 'fg', 'topText', 'bottomText', 'event'].forEach(id => $(id).oninput = () => {
  cfg[id] = $(id).value;
  renderDesignPreview();
});

$('frame').onchange = e => {
  let f = e.target.files[0];
  if (!f) return;
  let r = new FileReader();
  r.onload = () => {
    let im = new Image();
    im.onload = () => {
      frame = im;
      cfg.frame = r.result;
      renderDesignPreview();
    };
    im.src = r.result;
  };
  r.readAsDataURL(f);
};

$('clearFrame').onclick = () => {
  frame = null;
  cfg.frame = null;
  saveCfg();
  $('frame').value = '';
  renderDesignPreview();
};

$('save').onclick = () => {
  let a = document.createElement('a');
  a.download = 'EMEVE-' + (cfg.event || 'PHOTOBOOTH').trim().replace(/[^a-z0-9áéíóúñ_-]+/gi, '-') + '.jpg';
  a.href = $('out').toDataURL('image/jpeg', .95);
  a.click();
};

$('print').onclick = () => {
  let w = window.open('', '_blank');
  if (!w) {
    alert('Permite ventanas emergentes para imprimir.');
    return;
  }
  const strip = cfg.format === '2x6';
  const pw = strip ? '2in' : '4in', ph = '6in';
  w.document.write('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Imprimir Emeve</title><style>@page{size:' + pw + ' ' + ph + ';margin:0}html,body{margin:0;padding:0;width:' + pw + ';height:' + ph + '}img{display:block;width:' + pw + ';height:' + ph + ';object-fit:fill}</style></head><body><img src="' + $('out').toDataURL('image/jpeg', .95) + '"><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>');
  w.document.close();
};

apply();
dots();

window.addEventListener('load', () => {
  camera().catch(() => {});
});
