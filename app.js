let currentOverlayImage = null;
let capturedShots = [];

// Configuración de la plantilla con formato 9:16 (ancho x alto proporcional)
let templateConfig = JSON.parse(localStorage.getItem('pb_last_template')) || {
  title: "¡Recuerdo de mi Evento!",
  bgColor: "#ffffff",
  textColor: "#000000",
  overlayData: null,
  photosPos: [
    { x: 40, y: 60, w: 520 },  // Foto 1
    { x: 40, y: 560, w: 520 }, // Foto 2
    { x: 40, y: 1060, w: 520 } // Foto 3
  ]
};

window.addEventListener('DOMContentLoaded', () => {
  initWebcam();
  syncInputsWithConfig();
  loadSavedOverlay();
  updateTemplatePreview();
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

  // Sincronizar selectores de posición de las 3 fotos
  const pos = templateConfig.photosPos;
  ['f1', 'f2', 'f3'].forEach((id, i) => {
    if (pos[i]) {
      document.getElementById(`${id}-x`).value = pos[i].x;
      document.getElementById(`${id}-y`).value = pos[i].y;
      document.getElementById(`${id}-w`).value = pos[i].w;
    }
  });
}

function updateTemplateConfig() {
  templateConfig.title = document.getElementById('tmpl-title-input').value || "";
  templateConfig.bgColor = document.getElementById('tmpl-bg-color').value;
  templateConfig.textColor = document.getElementById('tmpl-text-color').value;

  saveTemplateConfig();
  updateTemplatePreview();
}

function updatePhotoPos() {
  templateConfig.photosPos = [
    { x: parseInt(document.getElementById('f1-x').value), y: parseInt(document.getElementById('f1-y').value), w: parseInt(document.getElementById('f1-w').value) },
    { x: parseInt(document.getElementById('f2-x').value), y: parseInt(document.getElementById('f2-y').value), w: parseInt(document.getElementById('f2-w').value) },
    { x: parseInt(document.getElementById('f3-x').value), y: parseInt(document.getElementById('f3-y').value), w: parseInt(document.getElementById('f3-w').value) }
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

// RENDERIZADO DE 2 TIRAS 2x6" CON FOTOS EN 9:16
function drawLayout(canvas, photosArray) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = templateConfig.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStrip(ctx, 0, photosArray);   // Tira 1
  drawStrip(ctx, 600, photosArray); // Tira 2

  // Línea de corte
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

  for (let i = 0; i < 3; i++) {
    const pos = templateConfig.photosPos[i];
    const photoW = pos.w;
    const photoH = photoW * (16 / 9); // Calcular alto manteniendo formato 9:16
    const posX = offsetX + pos.x;
    const posY = pos.y;

    if (photosArray[i]) {
      ctx.drawImage(photosArray[i], posX, posY, photoW, photoH);
    } else {
      ctx.fillStyle = "#e0e0e0";
      ctx.fillRect(posX, posY, photoW, photoH);
      ctx.fillStyle = "#888888";
      ctx.font = "28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Foto ${i + 1} (9:16)`, posX + photoW / 2, posY + photoH / 2);
    }
  }

  // Banner inferior
  ctx.fillStyle = templateConfig.textColor;
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(templateConfig.title, offsetX + stripWidth / 2, 1650);

  if (currentOverlayImage) {
    ctx.drawImage(currentOverlayImage, offsetX, 0, stripWidth, 1800);
  }
}

// CÁMARA Y MODO KIOSCO
async function initWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: { ideal: 1080 }, height: { ideal: 1920 } }, 
      audio: false 
    });
    document.getElementById('webcam').srcObject = stream;
  } catch (err) {
    console.error("Acceso a la cámara denegado o no disponible:", err);
  }
}

async function startPhotoSession() {
  capturedShots = [];
  const btn = document.getElementById('start-session-btn');
  btn.disabled = true;

  for (let i = 1; i <= 3; i++) {
    await runCountdown(3);
    const img = captureFrame916();
    capturedShots.push(img);
  }

  btn.disabled = false;
  
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = 1200;
  finalCanvas.height = 1800;
  
  drawLayout(finalCanvas, capturedShots);
  
  const finalDataUrl = finalCanvas.toDataURL('image/jpeg', 0.95);
  savePhotoToStorage(finalDataUrl);
  alert("¡Sesión completada! La foto se guardó en la Galería.");
}

function runCountdown(seconds) {
  return new Promise(resolve => {
    const overlay = document.getElementById('countdown-overlay');
    overlay.style.display = 'block';
    let count = seconds;
    overlay.innerText = count;

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        overlay.innerText = count;
      } else {
        clearInterval(timer);
        overlay.style.display = 'none';
        resolve();
      }
    }, 1000);
  });
}

// CAPTURA RECORTADA A 9:16 VERTICAL
function captureFrame916() {
  const video = document.getElementById('webcam');
  const tempCanvas = document.createElement('canvas');
  
  const vw = video.videoWidth || 1080;
  const vh = video.videoHeight || 1920;

  // Recorte a relación 9:16
  let cropWidth = vw;
  let cropHeight = vw * (16 / 9);

  if (cropHeight > vh) {
    cropHeight = vh;
    cropWidth = vh * (9 / 16);
  }

  const cropX = (vw - cropWidth) / 2;
  const cropY = (vh - cropHeight) / 2;

  tempCanvas.width = cropWidth;
  tempCanvas.height = cropHeight;
  const ctx = tempCanvas.getContext('2d');

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
