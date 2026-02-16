// ============================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// ============================================

// Definición de usuarios y roles
const USERS = {
    super: {
        password: 'admin123',
        role: 'Super Usuario',
        permissions: {
            canRegister: true,
            canViewRecords: true,
            canDownload: true
        }
    },
    admin: {
        password: 'admin123',
        role: 'Administrador',
        permissions: {
            canRegister: true,
            canViewRecords: true,
            canDownload: true
        }
    },
    operador: {
        password: 'operador123',
        role: 'Operador',
        permissions: {
            canRegister: true,
            canViewRecords: false,
            canDownload: false
        }
    }
};

// Usuario actual en sesión
let currentUser = null;

// Almacenamiento de registros en memoria (simula base de datos)
let deliveryRecords = [];

// Variables para las vistas previas de imágenes
let idEntregaBase64 = null;
let idRecepcionBase64 = null;

// ============================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Cargar registros del localStorage si existen
    loadRecordsFromStorage();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Actualizar fecha y hora cada segundo
    updateDateTime();
    setInterval(updateDateTime, 1000);
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Formulario de registro
    document.getElementById('deliveryForm').addEventListener('submit', handleDeliverySubmit);
    document.getElementById('clearFormBtn').addEventListener('click', clearForm);
    
    // Manejo de archivos de imagen
    document.getElementById('idEntrega').addEventListener('change', function(e) {
        handleImageUpload(e, 'previewEntrega', 'idEntrega');
    });
    
    document.getElementById('idRecepcion').addEventListener('change', function(e) {
        handleImageUpload(e, 'previewRecepcion', 'idRecepcion');
    });
    
    // Descargar Excel
    document.getElementById('downloadExcelBtn').addEventListener('click', downloadExcel);
    
    // Búsqueda
    document.getElementById('searchBtn').addEventListener('click', filterRecords);
    document.getElementById('clearSearchBtn').addEventListener('click', function() {
        document.getElementById('searchInput').value = '';
        displayRecords(deliveryRecords);
    });
    
    // Enter en búsqueda
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            filterRecords();
        }
    });
    
    // Modal de imágenes
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('imageModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
}

// ============================================
// AUTENTICACIÓN
// ============================================

function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    // Validar credenciales
    if (USERS[username] && USERS[username].password === password) {
        currentUser = {
            username: username,
            role: USERS[username].role,
            permissions: USERS[username].permissions
        };
        
        // Guardar sesión
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Mostrar pantalla principal
        showMainScreen();
    } else {
        errorDiv.textContent = '❌ Usuario o contraseña incorrectos';
        errorDiv.classList.add('show');
        
        setTimeout(() => {
            errorDiv.classList.remove('show');
        }, 3000);
    }
}

function handleLogout() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    
    // Limpiar formulario
    clearForm();
    
    // Volver a login
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('mainScreen').classList.remove('active');
    
    // Limpiar campos de login
    document.getElementById('loginForm').reset();
}

function showMainScreen() {
    // Ocultar login y mostrar pantalla principal
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('mainScreen').classList.add('active');
    
    // Actualizar información del usuario
    document.getElementById('userRole').textContent = `👤 ${currentUser.role}: ${currentUser.username}`;
    
    // Mostrar u ocultar secciones según permisos
    if (currentUser.permissions.canViewRecords) {
        document.getElementById('recordsSection').style.display = 'block';
        displayRecords(deliveryRecords);
    } else {
        document.getElementById('recordsSection').style.display = 'none';
    }
}

// ============================================
// MANEJO DE FECHA Y HORA
// ============================================

function updateDateTime() {
    const now = new Date();
    const dateTimeString = formatDateTime(now);
    const dateTimeInput = document.getElementById('fechaHora');
    if (dateTimeInput) {
        dateTimeInput.value = dateTimeString;
    }
}

function formatDateTime(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function getCurrentDate() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
}

function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// ============================================
// MANEJO DE IMÁGENES
// ============================================

function handleImageUpload(event, previewId, inputType) {
    const file = event.target.files[0];
    const previewDiv = document.getElementById(previewId);
    
    if (file) {
        // Validar que sea una imagen
        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona un archivo de imagen válido');
            event.target.value = '';
            return;
        }
        
        // Crear FileReader para convertir a base64
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const base64String = e.target.result;
            
            // Guardar en variable global según el tipo
            if (inputType === 'idEntrega') {
                idEntregaBase64 = base64String;
            } else {
                idRecepcionBase64 = base64String;
            }
            
            // Mostrar vista previa
            previewDiv.innerHTML = `<img src="${base64String}" alt="Vista previa">`;
            previewDiv.classList.remove('empty');
        };
        
        reader.readAsDataURL(file);
    }
}

// ============================================
// MANEJO DEL FORMULARIO DE ENTREGA
// ============================================

function handleDeliverySubmit(e) {
    e.preventDefault();
    
    // Obtener valores del formulario
    const proveedor = document.getElementById('proveedor').value.trim();
    const supermercado = document.getElementById('supermercado').value.trim();
    const cantidad = parseInt(document.getElementById('cantidad').value);
    
    // Validar que las imágenes estén cargadas
    if (!idEntregaBase64 || !idRecepcionBase64) {
        showError('Por favor carga ambas fotos de identificación');
        return;
    }
    
    // Crear registro
    const record = {
        id: Date.now(), // ID único basado en timestamp
        fecha: getCurrentDate(),
        hora: getCurrentTime(),
        proveedor: proveedor,
        supermercado: supermercado,
        cantidad: cantidad,
        idEntregaBase64: idEntregaBase64,
        idRecepcionBase64: idRecepcionBase64,
        registradoPor: currentUser.username,
        timestamp: new Date().toISOString()
    };
    
    // Agregar al array de registros
    deliveryRecords.push(record);
    
    // Guardar en localStorage
    saveRecordsToStorage();
    
    // Mostrar mensaje de éxito
    showSuccess('✅ Registro guardado exitosamente');
    
    // Limpiar formulario
    setTimeout(() => {
        clearForm();
    }, 1500);
    
    // Actualizar tabla si el usuario puede verla
    if (currentUser.permissions.canViewRecords) {
        displayRecords(deliveryRecords);
    }
}

function clearForm() {
    document.getElementById('deliveryForm').reset();
    
    // Limpiar vistas previas
    document.getElementById('previewEntrega').innerHTML = '';
    document.getElementById('previewEntrega').classList.add('empty');
    document.getElementById('previewRecepcion').innerHTML = '';
    document.getElementById('previewRecepcion').classList.add('empty');
    
    // Limpiar variables de imágenes
    idEntregaBase64 = null;
    idRecepcionBase64 = null;
    
    // Ocultar mensajes
    document.getElementById('formSuccess').classList.remove('show');
}

function showError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    
    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 3000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('formSuccess');
    successDiv.textContent = message;
    successDiv.classList.add('show');
    
    setTimeout(() => {
        successDiv.classList.remove('show');
    }, 3000);
}

// ============================================
// ALMACENAMIENTO LOCAL
// ============================================

function saveRecordsToStorage() {
    try {
        localStorage.setItem('deliveryRecords', JSON.stringify(deliveryRecords));
    } catch (e) {
        console.error('Error al guardar en localStorage:', e);
        alert('Error al guardar los datos. El almacenamiento local puede estar lleno.');
    }
}

function loadRecordsFromStorage() {
    try {
        const stored = localStorage.getItem('deliveryRecords');
        if (stored) {
            deliveryRecords = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error al cargar desde localStorage:', e);
        deliveryRecords = [];
    }
}

// ============================================
// VISUALIZACIÓN DE REGISTROS
// ============================================

function displayRecords(records) {
    const tbody = document.getElementById('recordsBody');
    const noRecordsDiv = document.getElementById('noRecords');
    
    // Limpiar tabla
    tbody.innerHTML = '';
    
    if (records.length === 0) {
        noRecordsDiv.classList.add('show');
        return;
    }
    
    noRecordsDiv.classList.remove('show');
    
    // Mostrar registros en orden inverso (más recientes primero)
    const sortedRecords = [...records].reverse();
    
    sortedRecords.forEach(record => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${record.fecha}</td>
            <td>${record.hora}</td>
            <td>${record.proveedor}</td>
            <td>${record.supermercado}</td>
            <td>${record.cantidad}</td>
            <td>
                <img src="${record.idEntregaBase64}" 
                     class="image-thumb" 
                     alt="ID Entrega"
                     onclick="showImageModal('${record.idEntregaBase64}')">
            </td>
            <td>
                <img src="${record.idRecepcionBase64}" 
                     class="image-thumb" 
                     alt="ID Recepción"
                     onclick="showImageModal('${record.idRecepcionBase64}')">
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function filterRecords() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (!searchTerm) {
        displayRecords(deliveryRecords);
        return;
    }
    
    const filtered = deliveryRecords.filter(record => {
        return record.proveedor.toLowerCase().includes(searchTerm) ||
               record.supermercado.toLowerCase().includes(searchTerm);
    });
    
    displayRecords(filtered);
}

// ============================================
// MODAL DE IMÁGENES
// ============================================

function showImageModal(imageSrc) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    
    modal.classList.add('show');
    modalImg.src = imageSrc;
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.remove('show');
}

// ============================================
// EXPORTACIÓN A EXCEL
// ============================================

function downloadExcel() {
    if (deliveryRecords.length === 0) {
        alert('No hay registros para exportar');
        return;
    }
    
    // Preparar datos para Excel
    const excelData = deliveryRecords.map(record => ({
        'Fecha': record.fecha,
        'Hora': record.hora,
        'Proveedor': record.proveedor,
        'Supermercado': record.supermercado,
        'Cantidad': record.cantidad,
        'ID_Entrega_Base64': record.idEntregaBase64,
        'ID_Recepcion_Base64': record.idRecepcionBase64
    }));
    
    // Crear libro de Excel
    const wb = XLSX.utils.book_new();
    
    // Crear hoja de cálculo
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Ajustar ancho de columnas
    const colWidths = [
        { wch: 12 },  // Fecha
        { wch: 10 },  // Hora
        { wch: 20 },  // Proveedor
        { wch: 20 },  // Supermercado
        { wch: 10 },  // Cantidad
        { wch: 30 },  // ID Entrega
        { wch: 30 }   // ID Recepción
    ];
    ws['!cols'] = colWidths;
    
    // Agregar hoja al libro
    XLSX.utils.book_append_sheet(wb, ws, 'Registros');
    
    // Generar archivo y descargar
    const fileName = `control_canastillas_${getCurrentDate().replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    // Mostrar confirmación
    showSuccess(`📥 Excel descargado: ${fileName}`);
}

// ============================================
// FUNCIONES GLOBALES (para onclick en HTML)
// ============================================

// Hacer la función disponible globalmente
window.showImageModal = showImageModal;

// ============================================
// VERIFICAR SESIÓN AL CARGAR
// ============================================

// Verificar si hay sesión guardada
window.addEventListener('load', function() {
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainScreen();
    }
});

// ============================================
// PREVENIR PÉRDIDA DE DATOS
// ============================================

window.addEventListener('beforeunload', function(e) {
    // Verificar si hay un formulario con datos sin guardar
    const form = document.getElementById('deliveryForm');
    const formData = new FormData(form);
    let hasData = false;
    
    for (let value of formData.values()) {
        if (value) {
            hasData = true;
            break;
        }
    }
    
    if (hasData) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ============================================
// CONSOLA DE DESARROLLO
// ============================================

console.log('🛒 Sistema de Control de Canastillas - Inicializado');
console.log('📊 Registros cargados:', deliveryRecords.length);
console.log('='.repeat(50));
console.log('Usuarios disponibles:');
console.log('- Super Usuario: super / admin123');
console.log('- Administrador: admin / admin123');
console.log('- Operador: operador / operador123');
console.log('='.repeat(50));
