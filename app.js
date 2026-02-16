// ============================================
// CONFIGURACIÓN GOOGLE SHEETS API
// ============================================

let API_KEY = '';
let CLIENT_ID = '';
let SPREADSHEET_ID = '';
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// ============================================
// USUARIOS Y ROLES
// ============================================

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

let currentUser = null;
let deliveryRecords = [];
let idEntregaBase64 = null;
let idRecepcionBase64 = null;

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    checkConfiguration();
    setupEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 1000);
});

function checkConfiguration() {
    const config = localStorage.getItem('googleSheetsConfig');
    
    if (config) {
        const parsed = JSON.parse(config);
        API_KEY = parsed.apiKey;
        CLIENT_ID = parsed.clientId;
        SPREADSHEET_ID = parsed.spreadsheetId;
        
        // Mostrar pantalla de login
        document.getElementById('setupScreen').classList.remove('active');
        document.getElementById('loginScreen').classList.add('active');
        
        // Inicializar Google API
        gapiLoaded();
        gisLoaded();
    } else {
        // Mostrar pantalla de configuración
        document.getElementById('setupScreen').classList.add('active');
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Configuración
    document.getElementById('setupForm').addEventListener('submit', handleSetup);
    
    // Reconfigurar
    const reconfigBtn = document.getElementById('reconfigBtn');
    if (reconfigBtn) {
        reconfigBtn.addEventListener('click', function() {
            localStorage.removeItem('googleSheetsConfig');
            location.reload();
        });
    }
    
    // Login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Formulario
    document.getElementById('deliveryForm').addEventListener('submit', handleDeliverySubmit);
    document.getElementById('clearFormBtn').addEventListener('click', clearForm);
    
    // Imágenes
    document.getElementById('idEntrega').addEventListener('change', function(e) {
        handleImageUpload(e, 'previewEntrega', 'idEntrega');
    });
    
    document.getElementById('idRecepcion').addEventListener('change', function(e) {
        handleImageUpload(e, 'previewRecepcion', 'idRecepcion');
    });
    
    // Botones de acciones
    const downloadBtn = document.getElementById('downloadExcelBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if (downloadBtn) downloadBtn.addEventListener('click', downloadExcel);
    if (refreshBtn) refreshBtn.addEventListener('click', loadRecordsFromSheet);
    if (searchBtn) searchBtn.addEventListener('click', filterRecords);
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            document.getElementById('searchInput').value = '';
            displayRecords(deliveryRecords);
        });
    }
    
    // Modal
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('imageModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
}

// ============================================
// CONFIGURACIÓN INICIAL
// ============================================

function handleSetup(e) {
    e.preventDefault();
    
    const apiKey = document.getElementById('apiKey').value.trim();
    const clientId = document.getElementById('clientId').value.trim();
    const spreadsheetId = document.getElementById('spreadsheetId').value.trim();
    
    const config = {
        apiKey: apiKey,
        clientId: clientId,
        spreadsheetId: spreadsheetId
    };
    
    localStorage.setItem('googleSheetsConfig', JSON.stringify(config));
    
    alert('✅ Configuración guardada. Recargando...');
    location.reload();
}

// ============================================
// GOOGLE API INITIALIZATION
// ============================================

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        console.log('✅ GAPI inicializado');
    } catch (error) {
        console.error('Error inicializando GAPI:', error);
    }
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // Se define en requestSignIn
    });
    gisInited = true;
    console.log('✅ GIS inicializado');
}

function requestSignIn(callback) {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        if (callback) callback();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
}

// ============================================
// AUTENTICACIÓN
// ============================================

function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    if (USERS[username] && USERS[username].password === password) {
        currentUser = {
            username: username,
            role: USERS[username].role,
            permissions: USERS[username].permissions
        };
        
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Autorizar Google Sheets
        requestSignIn(() => {
            showMainScreen();
            if (currentUser.permissions.canViewRecords) {
                loadRecordsFromSheet();
            }
        });
    } else {
        errorDiv.textContent = '❌ Usuario o contraseña incorrectos';
        errorDiv.classList.add('show');
        setTimeout(() => errorDiv.classList.remove('show'), 3000);
    }
}

function handleLogout() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
    }
    
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    clearForm();
    
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('mainScreen').classList.remove('active');
    document.getElementById('loginForm').reset();
}

function showMainScreen() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('mainScreen').classList.add('active');
    
    document.getElementById('userRole').textContent = `👤 ${currentUser.role}: ${currentUser.username}`;
    
    if (currentUser.permissions.canViewRecords) {
        document.getElementById('recordsSection').style.display = 'block';
    } else {
        document.getElementById('recordsSection').style.display = 'none';
    }
}

// ============================================
// FECHA Y HORA
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
        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona un archivo de imagen válido');
            event.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            // Para Google Sheets, truncamos el base64 para no exceder límites
            const base64String = e.target.result;
            const truncatedBase64 = base64String.substring(0, 50000); // Límite de caracteres
            
            if (inputType === 'idEntrega') {
                idEntregaBase64 = truncatedBase64;
            } else {
                idRecepcionBase64 = truncatedBase64;
            }
            
            previewDiv.innerHTML = `<img src="${base64String}" alt="Vista previa">`;
            previewDiv.classList.remove('empty');
        };
        reader.readAsDataURL(file);
    }
}

// ============================================
// GOOGLE SHEETS - GUARDAR
// ============================================

async function handleDeliverySubmit(e) {
    e.preventDefault();
    
    const proveedor = document.getElementById('proveedor').value.trim();
    const supermercado = document.getElementById('supermercado').value.trim();
    const cantidad = parseInt(document.getElementById('cantidad').value);
    
    if (!idEntregaBase64 || !idRecepcionBase64) {
        showError('Por favor carga ambas fotos de identificación');
        return;
    }
    
    showLoading('Guardando en Google Sheets...');
    
    try {
        const values = [[
            getCurrentDate(),
            getCurrentTime(),
            proveedor,
            supermercado,
            cantidad,
            idEntregaBase64,
            idRecepcionBase64
        ]];
        
        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:G',
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });
        
        hideLoading();
        showSuccess('✅ Registro guardado en Google Sheets exitosamente');
        updateSyncStatus('synced');
        
        setTimeout(() => {
            clearForm();
            if (currentUser.permissions.canViewRecords) {
                loadRecordsFromSheet();
            }
        }, 1500);
        
    } catch (error) {
        hideLoading();
        console.error('Error guardando en Google Sheets:', error);
        showError('❌ Error al guardar en Google Sheets: ' + error.message);
        updateSyncStatus('error');
    }
}

// ============================================
// GOOGLE SHEETS - LEER
// ============================================

async function loadRecordsFromSheet() {
    showLoading('Cargando registros...');
    updateSyncStatus('syncing');
    
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:G',
        });
        
        const rows = response.result.values;
        deliveryRecords = [];
        
        if (rows && rows.length > 1) {
            // Saltar la primera fila (encabezados)
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                deliveryRecords.push({
                    id: i,
                    fecha: row[0] || '',
                    hora: row[1] || '',
                    proveedor: row[2] || '',
                    supermercado: row[3] || '',
                    cantidad: row[4] || 0,
                    idEntregaBase64: row[5] || '',
                    idRecepcionBase64: row[6] || ''
                });
            }
        }
        
        displayRecords(deliveryRecords);
        hideLoading();
        updateSyncStatus('synced');
        
    } catch (error) {
        hideLoading();
        console.error('Error leyendo Google Sheets:', error);
        showError('❌ Error al cargar registros: ' + error.message);
        updateSyncStatus('error');
    }
}

// ============================================
// UI HELPERS
// ============================================

function showLoading(message) {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('p');
    text.textContent = message;
    overlay.classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

function updateSyncStatus(status) {
    const syncStatus = document.getElementById('syncStatus');
    if (!syncStatus) return;
    
    syncStatus.classList.remove('syncing', 'error');
    
    if (status === 'syncing') {
        syncStatus.classList.add('syncing');
        syncStatus.innerHTML = '<span class="sync-icon">🔄</span> Sincronizando...';
    } else if (status === 'synced') {
        syncStatus.innerHTML = '<span class="sync-icon">✅</span> Sincronizado';
    } else if (status === 'error') {
        syncStatus.classList.add('error');
        syncStatus.innerHTML = '<span class="sync-icon">❌</span> Error de sincronización';
    }
}

function clearForm() {
    document.getElementById('deliveryForm').reset();
    document.getElementById('previewEntrega').innerHTML = '';
    document.getElementById('previewEntrega').classList.add('empty');
    document.getElementById('previewRecepcion').innerHTML = '';
    document.getElementById('previewRecepcion').classList.add('empty');
    idEntregaBase64 = null;
    idRecepcionBase64 = null;
    document.getElementById('formSuccess').classList.remove('show');
}

function showError(message) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
        setTimeout(() => errorDiv.classList.remove('show'), 5000);
    }
}

function showSuccess(message) {
    const successDiv = document.getElementById('formSuccess');
    successDiv.textContent = message;
    successDiv.classList.add('show');
    setTimeout(() => successDiv.classList.remove('show'), 3000);
}

// ============================================
// VISUALIZACIÓN
// ============================================

function displayRecords(records) {
    const tbody = document.getElementById('recordsBody');
    const noRecordsDiv = document.getElementById('noRecords');
    
    tbody.innerHTML = '';
    
    if (records.length === 0) {
        noRecordsDiv.classList.add('show');
        return;
    }
    
    noRecordsDiv.classList.remove('show');
    
    const sortedRecords = [...records].reverse();
    
    sortedRecords.forEach(record => {
        const row = document.createElement('tr');
        
        const img1 = record.idEntregaBase64 ? 
            `<img src="${record.idEntregaBase64}" class="image-thumb" alt="ID Entrega" onclick="showImageModal('${record.idEntregaBase64}')">` : 
            'Sin imagen';
            
        const img2 = record.idRecepcionBase64 ? 
            `<img src="${record.idRecepcionBase64}" class="image-thumb" alt="ID Recepción" onclick="showImageModal('${record.idRecepcionBase64}')">` : 
            'Sin imagen';
        
        row.innerHTML = `
            <td>${record.fecha}</td>
            <td>${record.hora}</td>
            <td>${record.proveedor}</td>
            <td>${record.supermercado}</td>
            <td>${record.cantidad}</td>
            <td>${img1}</td>
            <td>${img2}</td>
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
// MODAL
// ============================================

function showImageModal(imageSrc) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    modal.classList.add('show');
    modalImg.src = imageSrc;
}

function closeModal() {
    document.getElementById('imageModal').classList.remove('show');
}

window.showImageModal = showImageModal;

// ============================================
// EXPORTAR EXCEL
// ============================================

function downloadExcel() {
    if (deliveryRecords.length === 0) {
        alert('No hay registros para exportar');
        return;
    }
    
    const excelData = deliveryRecords.map(record => ({
        'Fecha': record.fecha,
        'Hora': record.hora,
        'Proveedor': record.proveedor,
        'Supermercado': record.supermercado,
        'Cantidad': record.cantidad,
        'ID_Entrega_Base64': record.idEntregaBase64,
        'ID_Recepcion_Base64': record.idRecepcionBase64
    }));
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    const colWidths = [
        { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, 
        { wch: 10 }, { wch: 30 }, { wch: 30 }
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, 'Registros');
    
    const fileName = `control_canastillas_${getCurrentDate().replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    showSuccess(`📥 Excel descargado: ${fileName}`);
}

// ============================================
// CONSOLA
// ============================================

console.log('🛒 Sistema de Control de Canastillas - Cloud Edition');
console.log('☁️ Integrado con Google Sheets API');
console.log('='.repeat(50));
