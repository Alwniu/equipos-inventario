import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { 
    getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

// 1. Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC52ULCBzpCyR81y7xFom1K9u_eLwuJepE",
    authDomain: "cayapa-heroica-monagas.firebaseapp.com",
    projectId: "cayapa-heroica-monagas",
    storageBucket: "cayapa-heroica-monagas.firebasestorage.app",
    messagingSenderId: "837043214858",
    appId: "1:837043214858:web:610b4576995184c2e1ddf3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const equiposCollection = collection(db, "equipos");

// 2. Referencias al DOM
const form = document.getElementById('equipment-form');
const tableBody = document.getElementById('table-body');
const submitBtn = form.querySelector('button[type="submit"]');
const fileInput = document.getElementById('eq-image');

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photoPreview = document.getElementById('photo-preview');
const cameraContainer = document.getElementById('camera-container');
const previewContainer = document.getElementById('photo-preview-container');
const btnOpenCam = document.getElementById('btn-open-camera');
const btnTakePhoto = document.getElementById('btn-take-photo');
const btnCloseCam = document.getElementById('btn-close-camera');
const btnDiscardPhoto = document.getElementById('btn-discard-photo');

let capturedBlob = null; 
let stream = null;

// ==========================================
// A. NAVEGACIÓN DEL DASHBOARD (TABS)
// ==========================================
const navButtons = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view-section');

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        navButtons.forEach(b => b.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-target')).classList.add('active');
    });
});

// ==========================================
// B. CÁMARA Y ARCHIVOS
// ==========================================
btnOpenCam.addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        video.srcObject = stream;
        cameraContainer.style.display = 'block';
        btnOpenCam.style.display = 'none';
        fileInput.style.display = 'none'; 
    } catch (err) {
        alert("No se pudo acceder a la cámara. Verifica los permisos.");
    }
});

const stopCamera = () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    cameraContainer.style.display = 'none';
    btnOpenCam.style.display = 'block';
    fileInput.style.display = 'block';
};

btnCloseCam.addEventListener('click', stopCamera);

btnTakePhoto.addEventListener('click', () => {
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
        capturedBlob = blob;
        photoPreview.src = URL.createObjectURL(blob);
        previewContainer.style.display = 'block';
        stopCamera(); 
    }, 'image/jpeg', 0.85); 
});

btnDiscardPhoto.addEventListener('click', () => {
    capturedBlob = null;
    photoPreview.src = "";
    previewContainer.style.display = 'none';
});

fileInput.addEventListener('change', () => {
    if(fileInput.files.length > 0 && capturedBlob) btnDiscardPhoto.click();
});

// ==========================================
// C. GUARDADO EN FIREBASE
// ==========================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = 'Subiendo y Guardando...';
    submitBtn.disabled = true;

    const serial = document.getElementById('eq-serial').value;
    const institution = document.getElementById('eq-institution').value.trim(); // Trim para evitar espacios fantasma en los filtros
    const status = document.getElementById('eq-status').value;
    const notes = document.getElementById('eq-notes').value;

    const fileToUpload = capturedBlob || fileInput.files[0];
    let imageUrl = null;

    try {
        if (fileToUpload) {
            const extension = capturedBlob ? 'jpg' : fileToUpload.name.split('.').pop();
            const fileName = `equipo_${serial}_${Date.now()}.${extension}`;
            const imageRef = ref(storage, `inventario_imagenes/${fileName}`);
            const snapshot = await uploadBytes(imageRef, fileToUpload);
            imageUrl = await getDownloadURL(snapshot.ref);
        }

        await addDoc(equiposCollection, {
            serial, institucion: institution, estado: status, diagnostico: notes,
            imagenUrl: imageUrl, fechaRegistro: serverTimestamp()
        });
        
        form.reset();
        if(capturedBlob) btnDiscardPhoto.click();
        
        // Redirigir a la vista de inventario tras guardar
        document.querySelector('.nav-btn[data-target="view-inventory"]').click();

    } catch (error) {
        console.error("Error al procesar: ", error);
        alert("Hubo un error al guardar.");
    } finally {
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
    }
});

// ==========================================
// D. LECTURA, TABLA Y FILTROS EN TIEMPO REAL
// ==========================================
const searchInput = document.getElementById('search-input');
const filterInstitution = document.getElementById('filter-institution');
const filterStatus = document.getElementById('filter-status');

// Función que aplica los 3 filtros a la vez
const applyFilters = () => {
    const term = searchInput.value.toLowerCase();
    const instFilter = filterInstitution.value.toLowerCase();
    const statFilter = filterStatus.value.toLowerCase();
    
    const rows = tableBody.querySelectorAll('tr');

    rows.forEach(row => {
        const textSerial = row.cells[1].innerText.toLowerCase();
        const textInst = row.cells[2].innerText.toLowerCase();
        const textStat = row.cells[3].innerText.toLowerCase();
        const textDiag = row.cells[4].innerText.toLowerCase();

        const matchesSearch = textSerial.includes(term) || textDiag.includes(term);
        const matchesInst = instFilter === "" || textInst === instFilter;
        const matchesStat = statFilter === "" || textStat === statFilter; // Igualdad exacta para el estado

        if (matchesSearch && matchesInst && matchesStat) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
};

// Listeners de los filtros
searchInput.addEventListener('keyup', applyFilters);
filterInstitution.addEventListener('change', applyFilters);
filterStatus.addEventListener('change', applyFilters);

// Listener principal de la Base de Datos
onSnapshot(equiposCollection, (querySnapshot) => {
    tableBody.innerHTML = ''; 
    const institucionesUnicas = new Set();
    
    querySnapshot.forEach((documento) => {
        const equipo = documento.data();
        const id = documento.id;

        if(equipo.institucion) institucionesUnicas.add(equipo.institucion);

        const imageContent = equipo.imagenUrl 
            ? `<a href="${equipo.imagenUrl}" target="_blank"><img src="${equipo.imagenUrl}" class="img-thumbnail" alt="Foto"></a>` 
            : `<span style="font-size: 0.8em; color: var(--text-secondary);">Sin foto</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${imageContent}</td>
            <td><strong>${equipo.serial}</strong></td>
            <td>${equipo.institucion}</td>
            <td><span class="badge status-${equipo.estado}">${equipo.estado}</span></td>
            <td>${equipo.diagnostico || 'N/A'}</td>
            <td>
                <button class="btn-danger" data-id="${id}">Eliminar</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    // Actualizar dinámicamente las opciones del select de instituciones
    const currentInstSelection = filterInstitution.value; 
    filterInstitution.innerHTML = '<option value="">Todas las Instituciones</option>';
    
    Array.from(institucionesUnicas).sort().forEach(inst => {
        const option = document.createElement('option');
        option.value = inst;
        option.textContent = inst;
        filterInstitution.appendChild(option);
    });
    
    filterInstitution.value = currentInstSelection; 

    // Aplicar los filtros actuales a la nueva data recibida
    applyFilters();

    // Eventos de eliminación
    const deleteButtons = document.querySelectorAll('.btn-danger');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idDoc = e.target.getAttribute('data-id');
            if(confirm('¿Confirmas la eliminación de este registro de la base de datos?')) {
                try {
                    await deleteDoc(doc(db, "equipos", idDoc));
                } catch (error) {
                    console.error("Error al eliminar:", error);
                }
            }
        });
    });
});