let currentOverlayImage = null;
let capturedShots = [];
let lastGeneratedPhotoUrl = null;

let templateConfig = JSON.parse(localStorage.getItem('pb_last_template')) || {
  title: "¡Recuerdo de mi Evento!",
  bgColor: "#ffffff",
  textColor: "#000000",
  shotCount: 3,
  filter: "none",
  countdownSec: 5,
  shape: "rect",
  borderRadius: 20,
  overlayData: null,
  photosPos: [
    { x: 40, y: 60, w: 520, orient: "16:9" },
    { x: 40, y: 560, w: 520, orient: "16:9" },
    { x: 40, y: 1060, w: 520, orient: "16:9" }
  ]
};

window.addEventListener('DOMContentLoaded', () => {
  initWebcam();
  syncInputsWithConfig();
  loadSavedOverlay();
  updateTemplatePreview();

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.getElementById('sec-kiosk').classList.contains('active')) {
      const modalVisible = document.getElementById('result-modal').style.display === 'flex';
      if (!modalVisible && !document.getElementById('start-session-btn').disabled) {
        startPhotoSession();
      }
    }
  });
});

function showSection(sectionId) {
  document.querySelectorAll('main > section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(`sec-${sectionId}`).classList.add('active');
  if (sectionId === 'templates') updateTemplatePreview();
  if (sectionId === 'gallery') renderGallery();
}

function syncInputsWithConfig() {
  document.getElementById('tmpl-title-input').value = templateConfig.title || "";
  document.getElementById('tmpl-bg-color').value = templateConfig.bgColor || "#ffffff";
  document.getElementById('tmpl-text-color').value = templateConfig.textColor || "#000000";
  document.getElementById('tmpl-shot-count').value = templateConfig.shotCount || 3;
  document.getElementById('tmpl-filter-select').value = templateConfig.filter || "none";
  document.getElementById('tmpl-countdown-input').value = templateConfig.countdownSec || 5;
  document.getElementById('tmpl-shape-select').value = templateConfig.shape || "rect";
  document.getElementById('tmpl-border-radius').value = templateConfig.borderRadius || 20;

  const pos = templateConfig.photosPos;
  ['f1', 'f2', 'f3'].forEach((id, i) => {
    if (pos[i]) {
      document.getElementById(`${id}-x`).value = pos[i].x;
      document.getElementById(`${id}-y`).value = pos[i].y;
      document.getElementById(`${id}-w`).value = pos[i].w;
      document.getElementById(`${id}-orient`).value = pos[i].orient || "16:9";
    }
  });

  togglePhotoGroupsVisibility();
}

function togglePhotoGroupsVisibility() {
  const count = templateConfig.shotCount || 3;
  document.getElementById('group-f2').style.display = count >= 2 ? 'block' : 'none';
  document.getElementById('group-f3').style.display = count >= 3 ? 'block' : 'none';
  
  // Actualizar texto del botón Kiosco
  document.getElementById('start-session-btn').innerText = `Iniciar Sesión (${count} Foto${count > 1 ? 's' : ''})`;
}

function updateTemplateConfig() {
  templateConfig.title = document.getElementById('tmpl-title-input').value || "";
  templateConfig.bgColor = document.getElementById('tmpl-bg-color').value;
  templateConfig.textColor = document.getElementById('tmpl-text-color').value;
  templateConfig.shotCount = parseInt(document.getElementById('tmpl-shot-count').value) || 3;
  templateConfig.filter = document.getElementById('tmpl-filter-select').value;
  templateConfig.countdownSec = parseInt(document.getElementById('tmpl-countdown-input').value) || 5;
  templateConfig.shape = document.getElementById('tmpl-shape-select').value;
  templateConfig.borderRadius = parseInt(document.getElementById('tmpl-border-radius').value);

  document.getElementById('webcam').style.filter = templateConfig.filter;

  togglePhotoGroupsVisibility();
  saveTemplateConfig();
  updateTemplatePreview();
}

function updatePhotoPos() {
  templateConfig.photosPos = [
    {
      x: parseInt(document.getElementById('f1-x').value),
      y: parseInt(document.getElementById('f1-y').value),
      w: parseInt(document.getElementById('f1-w').value),
      orient: document.getElementById('f1-orient').value
    },
    {
      x: parseInt(document.getElementById('f2-x').value),
      y: parseInt(document.getElementById('f2-y').value),
      w: parseInt(document.getElementById('f2-w').value),
      orient: document.getElementById('f2-orient').value
    },
    {
      x: parseInt(document.getElementById('f3-x').value),
      y: parseInt(document.getElementById('f3-y').value),
      w: parseInt(document.getElementById('f3-w').value),
      orient: document.getElementById('f3-orient').value
    }
  ];

  saveTemplateConfig();
  updateTemplatePreview();
}

function saveTemplateConfig() {
  localStorage.setItem('pb_last_template', JSON.stringify(templateConfig));
}

function loadOverlay(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    templateConfig.overlayData = dataUrl;
    saveTemplateConfig();
    
    const img = new Image();
    img.onload = () => {
      currentOverlayImage = img;
      updateTemplatePreview();
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function loadSavedOverlay() {
  if (templateConfig.overlayData) {
    const img = new Image();
    img.onload = () => {
      currentOverlayImage = img;
      updateTemplatePreview();
    };
    img.src = templateConfig.overlayData;
  }
}

function clearOverlay() {
  templateConfig.overlayData = null;
  currentOverlayImage = null;
  document.getElementById('tmpl-overlay-input').value = "";
  saveTemplateConfig();
  updateTemplatePreview();
}

function updateTemplatePreview() {
  const canvas = document.getElementById('template-canvas');
  if (canvas) {
    drawLayout(canvas, []);
  }
}

// RENDERIZADO DEL LIENZO
function drawLayout(canvas, photosArray) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = templateConfig.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStrip(ctx, 0, photosArray);   // Tira 1
  drawStrip(ctx, 600, photosArray); // Tira 2

  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(600, 0);
  ctx.lineTo(600, 1800);
  ctx.strokeStyle = "#cccccc";
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawStrip(ctx, offsetX, photosArray) {
  const stripWidth = 600;
  const totalShots = templateConfig.shotCount || 3;

  for (let i = 0; i < totalShots; i++) {
    const pos = templateConfig.photosPos[i];
    const photoW = pos.w;
    const is916 = pos.orient === "9:16";
    const photoH = is916 ? photoW * (16 / 9) : photoW * (9 / 16);

    const posX = offsetX + pos.x;
    const posY = pos.y;

    ctx.save();
    ctx.beginPath();

    if (templateConfig.shape === 'rounded') {
      const r = templateConfig.borderRadius;
      ctx.roundRect(posX, posY, photoW, photoH, r);
    } else {
      ctx.rect(posX, posY, photoW, photoH);
    }
    ctx.clip();

    if (photosArray[i]) {
      ctx.drawImage(photosArray[i], posX, posY, photoW, photoH);
    } else {
      ctx.fillStyle = "#e0e0e0";
      ctx.fillRect(posX, posY, photoW, photoH);
      ctx.fillStyle = "#888888";
      ctx.font = "26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Foto ${i + 1} (${pos.orient})`, posX + photoW / 2, posY + photoH / 2);
    }
    ctx.restore();
  }

  ctx.fillStyle = templateConfig.textColor;
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(templateConfig.title, offsetX + stripWidth / 2, 1650);

  if (currentOverlayImage) {
    ctx.drawImage(currentOverlayImage, offsetX, 0, stripWidth, 1800);
  }
}

// CÁMARA Y CAPTURA
async function initWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, 
      audio: false 
    });
    const video = document.getElementById('webcam');
    video.srcObject = stream;
    video.style.filter = templateConfig.filter || "none";
  } catch (err) {
    console.error("Acceso a la cámara denegado o no disponible:", err);
  }
}

async function startPhotoSession() {
  capturedShots = [];
  const btn = document.getElementById('start-session-btn');
  btn.disabled = true;

  const seconds = templateConfig.countdownSec || 5;
  const totalShots = templateConfig.shotCount || 3;

  for (let i = 1; i <= totalShots; i++) {
    await runCountdown(seconds, `Foto ${i}`);
    
    // Obtener la orientación configurada para esta foto en específico
    const currentOrient = templateConfig.photosPos[i - 1].orient;
    const img = captureFrameByOrientation(currentOrient);
    capturedShots.push(img);

    if (i < totalShots) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  btn.disabled = false;
  
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = 1200;
  finalCanvas.height = 1800;
  
  drawLayout(finalCanvas, capturedShots);
  
  lastGeneratedPhotoUrl = finalCanvas.toDataURL('image/jpeg', 0.95);
  savePhotoToStorage(lastGeneratedPhotoUrl);
  showResultModal(lastGeneratedPhotoUrl);
}

function runCountdown(seconds, label) {
  return new Promise(resolve => {
    const overlay = document.getElementById('countdown-overlay');
    overlay.style.display = 'block';
    let count = seconds;
    overlay.innerHTML = `<div>${label}</div><div style="font-size: 12rem">${count}</div>`;

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        overlay.innerHTML = `<div>${label}</div><div style="font-size: 12rem">${count}</div>`;
      } else {
        clearInterval(timer);
        overlay.style.display = 'none';
        resolve();
      }
    }, 1000);
  });
}

function captureFrameByOrientation(orient) {
  const video = document.getElementById('webcam');
  const tempCanvas = document.createElement('canvas');
  
  const vw = video.videoWidth || 1920;
  const vh = video.videoHeight || 1080;

  const is916 = orient === "9:16";
  const ratio = is916 ? (9 / 16) : (16 / 9);

  let cropWidth = vw;
  let cropHeight = vw / ratio;

  if (cropHeight > vh) {
    cropHeight = vh;
    cropWidth = vh * ratio;
  }

  const cropX = (vw - cropWidth) / 2;
  const cropY = (vh - cropHeight) / 2;

  tempCanvas.width = cropWidth;
  tempCanvas.height = cropHeight;
  const ctx = tempCanvas.getContext('2d');

  ctx.filter = templateConfig.filter || "none";

  ctx.translate(tempCanvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  const img = new Image();
  img.src = tempCanvas.toDataURL('image/jpeg');
  return img;
}

function savePhotoToStorage(dataUrl) {
  const existingPhotos = JSON.parse(localStorage.getItem('pb_photos_gallery') || '[]');
  existingPhotos.push({ id: Date.now(), data: dataUrl, date: new Date().toLocaleString() });
  localStorage.setItem('pb_photos_gallery', JSON.stringify(existingPhotos));
}

function showResultModal(dataUrl) {
  document.getElementById('result-preview-img').src = dataUrl;
  document.getElementById('result-modal').style.display = 'flex';
}

function closeResultModal() {
  document.getElementById('result-modal').style.display = 'none';
}

function printCurrentPhoto() {
  if (!lastGeneratedPhotoUrl) return;
  printPhoto(lastGeneratedPhotoUrl);
}

async function shareCurrentPhoto() {
  if (!lastGeneratedPhotoUrl) return;

  try {
    const blob = await (await fetch(lastGeneratedPhotoUrl)).blob();
    const file = new File([blob], `fotocabina_${Date.now()}.jpg`, { type: 'image/jpeg' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'Mi Tira de Fotos',
        text: '¡Mira mi foto tomada en la cabina!',
        files: [file]
      });
    } else {
      const a = document.createElement('a');
      a.href = lastGeneratedPhotoUrl;
      a.download = `fotocabina_${Date.now()}.jpg`;
      a.click();
    }
  } catch (err) {
    console.error("Error al compartir:", err);
  }
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';

  const photos = JSON.parse(localStorage.getItem('pb_photos_gallery') || '[]');
  if (photos.length === 0) {
    grid.innerHTML = '<p>No hay fotos tomadas aún.</p>';
    return;
  }

  photos.reverse().forEach(p => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.innerHTML = `
      <img src="${p.data}" alt="Foto 4x6">
      <small>${p.date}</small>
      <button onclick="printPhoto('${p.data}')">Imprimir / Descargar</button>
    `;
    grid.appendChild(item);
  });
}

function printPhoto(dataUrl) {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Imprimir Foto 4x6</title>
        <style>
          @page { size: 4in 6in; margin: 0; }
          body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #000; }
          img { width: 100%; height: 100%; object-fit: contain; }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" onload="window.print(); window.close();">
      </body>
    </html>
  `);
}
