let activeEvent = null;
let currentOverlayImage = null;
let capturedShots = [];

let templateConfig = {
  title: "¡Recuerdo de mi Evento!",
  bgColor: "#ffffff",
  textColor: "#000000"
};

window.addEventListener('DOMContentLoaded', () => {
  loadEvents();
  initWebcam();
  updateTemplatePreview();
});

function showSection(sectionId) {
  document.querySelectorAll('main > section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(`sec-${sectionId}`).classList.add('active');
  if (sectionId === 'templates') updateTemplatePreview();
  if (sectionId === 'gallery') renderGallery();
}

function createEvent() {
  const input = document.getElementById('event-name-input');
  const name = input.value.trim();
  if (!name) return alert("Ingresa un nombre para el evento");

  const events = JSON.parse(localStorage.getItem('pb_events') || '[]');
  const newEvent = { id: Date.now(), name: name, date: new Date().toLocaleDateString() };
  events.push(newEvent);
  localStorage.setItem('pb_events', JSON.stringify(events));
  
  input.value = '';
  selectEvent(newEvent);
  loadEvents();
}

function loadEvents() {
  const events = JSON.parse(localStorage.getItem('pb_events') || '[]');
  const list = document.getElementById('events-list');
  list.innerHTML = '';
  
  events.forEach(ev => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span><strong>${ev.name}</strong> (${ev.date})</span>
      <button onclick='selectEvent(${JSON.stringify(ev)})'>${activeEvent?.id === ev.id ? 'Seleccionado' : 'Seleccionar'}</button>
    `;
    list.appendChild(li);
  });
}

function selectEvent(ev) {
  activeEvent = ev;
  alert(`Evento activo: ${ev.name}`);
  loadEvents();
}

function loadOverlay(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      currentOverlayImage = img;
      updateTemplatePreview();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function updateTemplatePreview() {
  templateConfig.title = document.getElementById('tmpl-title-input').value || "¡Recuerdo de mi Evento!";
  templateConfig.bgColor = document.getElementById('tmpl-bg-color').value;
  templateConfig.textColor = document.getElementById('tmpl-text-color').value;

  const canvas = document.getElementById('template-canvas');
  drawLayout(canvas, []);
}

function drawLayout(canvas, photosArray) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = templateConfig.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStrip(ctx, 0, photosArray);
  drawStrip(ctx, 600, photosArray);

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

  ctx.fillStyle = templateConfig.textColor;
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(templateConfig.title, offsetX + stripWidth / 2, 1550);

  if (currentOverlayImage) {
    ctx.drawImage(currentOverlayImage, offsetX, 0, stripWidth, 1800);
  }
}

async function initWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
    document.getElementById('webcam').srcObject = stream;
  } catch (err) {
    console.error("Acceso a la cámara denegado o no disponible:", err);
  }
}

async function startPhotoSession() {
  if (!activeEvent) return alert("Por favor, selecciona un evento activo antes de iniciar.");
  
  capturedShots = [];
  const btn = document.getElementById('start-session-btn');
  btn.disabled = true;

  for (let i = 1; i <= 3; i++) {
    await runCountdown(3);
    const img = captureFrame();
    capturedShots.push(img);
  }

  btn.disabled = false;
  
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

function savePhotoToStorage(dataUrl) {
  const storageKey = `pb_photos_${activeEvent.id}`;
  const existingPhotos = JSON.parse(localStorage.getItem(storageKey) || '[]');
  existingPhotos.push({ id: Date.now(), data: dataUrl });
  localStorage.setItem(storageKey, JSON.stringify(existingPhotos));
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';

  if (!activeEvent) {
    grid.innerHTML = '<p>Selecciona un evento para ver sus fotos.</p>';
    return;
  }

  const photos = JSON.parse(localStorage.getItem(`pb_photos_${activeEvent.id}`) || '[]');
  if (photos.length === 0) {
    grid.innerHTML = '<p>No hay fotos en este evento aún.</p>';
    return;
  }

  photos.forEach(p => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.innerHTML = `
      <img src="${p.data}" alt="Foto 4x6">
      <button onclick="printPhoto('${p.data}')">Imprimir / Guardar PNG</button>
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
          body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
          img { width: 100%; height: 100%; object-fit: contain; }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" onload="window.print(); window.close();">
      </body>
    </html>
  `);
}