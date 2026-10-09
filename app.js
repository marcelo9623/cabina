let currentOverlayImage = null;
let capturedShots = [];

// Cargar o establecer plantilla predeterminada por defecto
let templateConfig = JSON.parse(localStorage.getItem('pb_last_template')) || {
  title: "¡Recuerdo de mi Evento!",
  bgColor: "#ffffff",
  textColor: "#000000",
  overlayData: null
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

// SINCRONIZAR CAMPOS DEL FORMULARIO CON LA CONFIGURACIÓN GUARDADA
function syncInputsWithConfig() {
  document.getElementById('tmpl-title-input').value = templateConfig.title || "";
  document.getElementById('tmpl-bg-color').value = templateConfig.bgColor || "#ffffff";
  document.getElementById('tmpl-text-color').value = templateConfig.textColor || "#000000";
}

function updateTemplateConfig() {
  templateConfig.title = document.getElementById('tmpl-title-input').value || "";
  templateConfig.bgColor = document.getElementById('tmpl-bg-color').value;
  templateConfig.textColor = document.getElementById('tmpl-text-color').value;

  saveTemplateConfig();
  updateTemplatePreview();
}

function saveTemplateConfig() {
  localStorage.setItem('pb_last_template', JSON.stringify(templateConfig));
}

// GESTIÓN DEL MARCO / OVERLAY PNG
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

// DIBUJAR 2 TIRAS 2x6" EN HOJA 4x6" (1200x1800 px)
function drawLayout(canvas, photosArray) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = templateConfig.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Tira 1 (Izquierda: 0px - 600px) y Tira 2 (Derecha: 600px - 1200px)
  drawStrip(ctx, 0, photosArray);
  drawStrip(ctx, 600, photosArray);

  // Línea punteada de corte
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
  const photoW = 520;
  ctx.fillStyle = templateConfig.bgColor;

  const photoPositionsY = [60, 520, 980];

  for (let i = 0; i < 3; i++) {
    const posY = photoPositionsY[i];
    const posX = offsetX + (stripWidth - photoW) / 2;

    if (photosArray[i]) {
      ctx.drawImage(photosArray[i], posX, posY, photoW, 390);
    } else {
      ctx.fillStyle = "#e0e0e0";
      ctx.fillRect(posX, posY, photoW, 390);
      ctx.fillStyle = "#888888";
      ctx.font = "30px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Foto ${i + 1}`, posX + photoW / 2, posY + 200);
    }
  }

  // Banner o Título inferior
  ctx.fillStyle = templateConfig.textColor;
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(templateConfig.title, offsetX + stripWidth / 2, 1550);

  // Marco PNG superpuesto
  if (currentOverlayImage) {
    ctx.drawImage(currentOverlayImage, offsetX, 0, stripWidth, 1800);
  }
}

// CÁMARA Y MODO KIOSCO
async function initWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
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
    const img = captureFrame();
    capturedShots.push(img);
  }

  btn.disabled = false;
  
  // Procesar tira final con la última plantilla configurada
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = 1200;
  finalCanvas.height = 1800;
  
  drawLayout(finalCanvas, capturedShots);
  
  const finalDataUrl = finalCanvas.toDataURL('image/jpeg', 0.95);
  savePhotoToStorage(finalDataUrl);
  alert("¡Sesión completada! Foto guardada exitosamente en la Galería.");
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

function captureFrame() {
  const video = document.getElementById('webcam');
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = video.videoWidth || 1280;
  tempCanvas.height = video.videoHeight || 720;
  const ctx = tempCanvas.getContext('2d');
  
  ctx.translate(tempCanvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
  
  const img = new Image();
  img.src = tempCanvas.toDataURL('image/jpeg');
  return img;
}

// GUARDADO OFFLINE E IMPRESIÓN
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
