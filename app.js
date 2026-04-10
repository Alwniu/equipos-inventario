// AÑADIDO: updateDoc importado
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, serverTimestamp, updateDoc 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { 
    getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

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

// Referencias DOM
const form = document.getElementById('equipment-form');
const tableBody = document.getElementById('table-body');
const submitBtn = document.getElementById('btn-submit');
const cancelEditBtn = document.getElementById('btn-cancel-edit');
const formTitle = document.getElementById('form-title');
const fileInput = document.getElementById('eq-image');
const datalist = document.getElementById('institution-list');

// Referencias Cámara
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photoPreview = document.getElementById('photo-preview');
const cameraContainer = document.getElementById('camera-container');
const previewContainer = document.getElementById('photo-preview-container');
const btnOpenCam = document.getElementById('btn-open-camera');
const btnTakePhoto = document.getElementById('btn-take-photo');
const btnCloseCam = document.getElementById('btn-close-camera');
const btnDiscardPhoto = document.getElementById('btn-discard-photo');

// Variables de Estado
let capturedBlob = null; 
let stream = null;
let editStatus = false; // Controla si estamos creando o editando
let idToEdit = '';      // Almacena el ID de Firestore que estamos editando
let currentImageUrl = null; // Almacena la URL de la imagen actual durante la edición
let equiposLocales = {}; // Guarda una copia rápida de los datos para rellenar el formulario

// ==========================================
// A. NAVEGACIÓN Y CÁMARA (Sin Cambios)
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

btnOpenCam.addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        video.srcObject = stream;
        cameraContainer.style.display = 'block';
        btnOpenCam.style.display = 'none';
        fileInput.style.display = 'none'; 
    } catch (err) { alert("No se pudo acceder a la cámara."); }
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
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
        capturedBlob = blob; photoPreview.src = URL.createObjectURL(blob);
        previewContainer.style.display = 'block'; stopCamera(); 
    }, 'image/jpeg', 0.85); 
});
btnDiscardPhoto.addEventListener('click', () => {
    capturedBlob = null; photoPreview.src = ""; previewContainer.style.display = 'none';
    fileInput.value = ""; // Limpiar input de archivo también
});
fileInput.addEventListener('change', () => {
    if(fileInput.files.length > 0 && capturedBlob) btnDiscardPhoto.click();
});

// ==========================================
// B. LÓGICA DE CANCELAR EDICIÓN
// ==========================================
const resetFormState = () => {
    form.reset();
    editStatus = false;
    idToEdit = '';
    currentImageUrl = null;
    formTitle.innerText = 'Captura de Datos Técnicos';
    submitBtn.innerText = 'Guardar en Inventario';
    cancelEditBtn.style.display = 'none';
    if(capturedBlob || fileInput.files.length > 0) btnDiscardPhoto.click();
};

cancelEditBtn.addEventListener('click', resetFormState);

// ==========================================
// C. CREAR O ACTUALIZAR (SUBMIT)
// ==========================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = 'Procesando...';
    submitBtn.disabled = true;

    const serial = document.getElementById('eq-serial').value;
    const institution = document.getElementById('eq-institution').value.trim();
    const status = document.getElementById('eq-status').value;
    const notes = document.getElementById('eq-notes').value;

    const fileToUpload = capturedBlob || fileInput.files[0];
    
    // Si estamos editando y NO subimos foto nueva, mantenemos la que ya tenía.
    let imageUrl = editStatus ? currentImageUrl : null;

    try {
        if (fileToUpload) {
            const extension = capturedBlob ? 'jpg' : fileToUpload.name.split('.').pop();
            const fileName = `equipo_${serial}_${Date.now()}.${extension}`;
            const imageRef = ref(storage, `inventario_imagenes/${fileName}`);
            const snapshot = await uploadBytes(imageRef, fileToUpload);
            imageUrl = await getDownloadURL(snapshot.ref); // Reemplaza la imagenUrl con la nueva
        }

        const dataToSave = {
            serial, institucion: institution, estado: status, diagnostico: notes, imagenUrl: imageUrl
        };

        if (!editStatus) {
            // CREAR NUEVO
            dataToSave.fechaRegistro = serverTimestamp();
            await addDoc(equiposCollection, dataToSave);
            alert("Equipo registrado exitosamente.");
        } else {
            // ACTUALIZAR EXISTENTE
            dataToSave.fechaActualizacion = serverTimestamp();
            await updateDoc(doc(db, "equipos", idToEdit), dataToSave);
            alert("Equipo actualizado correctamente.");
        }
        
        resetFormState();
        document.querySelector('.nav-btn[data-target="view-inventory"]').click();

    } catch (error) {
        console.error(error);
        alert("Hubo un error al guardar.");
    } finally {
        submitBtn.disabled = false;
        if(!editStatus) submitBtn.innerText = 'Guardar en Inventario';
    }
});

// ==========================================
// D. LECTURA, TABLA Y FILTROS
// ==========================================
const searchInput = document.getElementById('search-input');
const filterInstitution = document.getElementById('filter-institution');
const filterStatus = document.getElementById('filter-status');

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
        // La condición del filtro de estados permite que "Todos los estados" ("") muestre todo lo de una institución seleccionada.
        const matchesStat = statFilter === "" || textStat === statFilter; 

        if (matchesSearch && matchesInst && matchesStat) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
};

searchInput.addEventListener('keyup', applyFilters);
filterInstitution.addEventListener('change', applyFilters);
filterStatus.addEventListener('change', applyFilters);

onSnapshot(equiposCollection, (querySnapshot) => {
    tableBody.innerHTML = ''; 
    const institucionesUnicas = new Set();
    equiposLocales = {}; // Limpiar la caché local
    
    querySnapshot.forEach((documento) => {
        const equipo = documento.data();
        const id = documento.id;
        
        // Guardar copia local para edición rápida
        equiposLocales[id] = equipo;

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
                <div class="action-buttons">
                    <button type="button" class="btn-warning btn-edit" data-id="${id}">Editar</button>
                    <button type="button" class="btn-danger btn-delete" data-id="${id}">Eliminar</button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    // --- Llenar los Selects y el Datalist ---
    const currentInstSelection = filterInstitution.value; 
    filterInstitution.innerHTML = '<option value="">Todas las Instituciones</option>';
    datalist.innerHTML = ''; // Limpiar el datalist del formulario
    
    Array.from(institucionesUnicas).sort().forEach(inst => {
        // Llenar filtro de búsqueda
        const optionFilter = document.createElement('option');
        optionFilter.value = inst;
        optionFilter.textContent = inst;
        filterInstitution.appendChild(optionFilter);

        // Llenar el auto-completado del formulario (Datalist)
        const optionData = document.createElement('option');
        optionData.value = inst;
        datalist.appendChild(optionData);
    });
    
    filterInstitution.value = currentInstSelection; 
    applyFilters();

    // --- Eventos de Eliminar ---
    const deleteButtons = document.querySelectorAll('.btn-delete');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idDoc = e.target.getAttribute('data-id');
            if(confirm('¿Confirmas la eliminación de este registro de la base de datos?')) {
                await deleteDoc(doc(db, "equipos", idDoc));
            }
        });
    });

    // --- Eventos de Editar ---
    const editButtons = document.querySelectorAll('.btn-edit');
    editButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // 1. Cambiar a la pestaña de formulario
            document.querySelector('.nav-btn[data-target="view-register"]').click();
            
            // 2. Obtener datos locales y llenar form
            const idDoc = e.target.getAttribute('data-id');
            const data = equiposLocales[idDoc];

            document.getElementById('eq-serial').value = data.serial;
            document.getElementById('eq-institution').value = data.institucion;
            document.getElementById('eq-status').value = data.estado;
            document.getElementById('eq-notes').value = data.diagnostico || '';

            // 3. Cambiar estado a Edición
            editStatus = true;
            idToEdit = idDoc;
            currentImageUrl = data.imagenUrl || null;
            
            // 4. Cambiar UI
            formTitle.innerText = `Editando Equipo: ${data.serial}`;
            submitBtn.innerText = 'Actualizar Equipo';
            cancelEditBtn.style.display = 'block';
            
            // Subir la pantalla hacia arriba si estás en móvil
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
});