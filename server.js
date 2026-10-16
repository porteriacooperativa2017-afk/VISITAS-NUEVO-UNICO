const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const app = express();

const DATA_FILE = path.join(__dirname, 'data', 'visitas.json');
let visitasCache = [];

function ensureDataFile() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, '[]', 'utf8');
    }
}

function cargarVisitasDesdeDisco() {
    try {
        ensureDataFile();
        const contenido = fs.readFileSync(DATA_FILE, 'utf8');
        const datos = JSON.parse(contenido);
        return Array.isArray(datos) ? datos : [];
    } catch (error) {
        console.warn('No se pudo leer el archivo de visitas, se usará un estado vacío.', error);
        return [];
    }
}

function guardarVisitasEnDisco() {
    try {
        ensureDataFile();
        fs.writeFileSync(DATA_FILE, JSON.stringify(visitasCache, null, 2), 'utf8');
    } catch (error) {
        console.warn('No se pudo persistir la lista de visitas.', error);
    }
}

visitasCache = cargarVisitasDesdeDisco();

// Configuración del Puerto
const PORT = process.env.PORT || 3000;

// URL del Apps Script publicado; se puede reemplazar por la generada al publicar el script.
const GOOGLE_SHEETS_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbw6QX8F7aXJXQm0Ug0ZJMSkutMbJh_GiesgRYbu2ElRTinCbK6nZ2CJ0jMauWksOKEG/exec";

function normalizarVisitaDesdeGoogle(item) {
    const fecha = item.Timestamp || item.timestamp || item.fecha || new Date().toISOString();
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fecha: new Date(fecha).toISOString(),
        fechaTexto: new Date(fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }),
        datosPersonales: item['Datos Personales'] || item.datosPersonales || '',
        empresa: item.Empresa || item.empresa || '',
        codigoFarmacia: item['Código de Farmacia'] || item['CODIGO DE FARMACIA'] || item.codigoFarmacia || '',
        sector: item.Sector || item.sector || '',
        anfitrion: item['Anfitrión'] || item.anfitrion || '',
        observaciones: item.Observaciones || item.observaciones || 'SIN OBSERVACIONES',
        modoEvento: String(item['Modo Evento'] || item.modoEvento || '').toUpperCase() === 'SI'
    };
}

async function cargarVisitasDesdeGoogle() {
    try {
        if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL.includes('YOUR_DEPLOYMENT_ID')) {
            return [];
        }
        const response = await axios.get(GOOGLE_SHEETS_URL, { timeout: 8000 });
        const data = response.data;
        const lista = Array.isArray(data) ? data : [];
        return lista.map(normalizarVisitaDesdeGoogle).filter((visita) => visita.datosPersonales || visita.empresa || visita.sector);
    } catch (error) {
        console.warn('No se pudieron leer las visitas desde Google Apps Script.', error.message);
        return [];
    }
}

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- RUTA PRINCIPAL DE REGISTRO ---
app.post('/api/registro', async (req, res) => {
    const datos = req.body;

    try {
        const payload = {
            datosPersonales: datos.datosPersonales || '',
            empresa: datos.empresa || '',
            codigoFarmacia: datos.codigoFarmacia || '',
            sector: datos.sector || '',
            anfitrion: datos.anfitrion || '',
            observaciones: datos.observaciones || 'SIN OBSERVACIONES',
            modoEvento: Boolean(datos.modoEvento)
        };

        try {
            await axios.post(GOOGLE_SHEETS_URL, JSON.stringify(payload), {
                headers: { 'Content-Type': 'application/json' },
                maxRedirects: 5,
                timeout: 8000
            });
            console.log('Registro enviado al endpoint de Google Sheets.');
        } catch (googleError) {
            console.warn('No se pudo enviar a Google Sheets, se preservará el registro localmente.', googleError.message);
        }

        const visita = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fecha: new Date().toISOString(),
            fechaTexto: new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }),
            datosPersonales: payload.datosPersonales,
            empresa: payload.empresa,
            codigoFarmacia: payload.codigoFarmacia,
            sector: payload.sector,
            anfitrion: payload.anfitrion,
            observaciones: payload.observaciones,
            modoEvento: payload.modoEvento
        };

        visitasCache.unshift(visita);
        guardarVisitasEnDisco();

        const visitasDesdeGoogle = await cargarVisitasDesdeGoogle();
        if (visitasDesdeGoogle.length) {
            visitasCache = visitasDesdeGoogle;
            guardarVisitasEnDisco();
        }

        let lineaEmpresa = "";
        if (datos.empresa && datos.empresa.trim() !== "" && datos.empresa.toUpperCase() !== "PARTICULAR") {
            lineaEmpresa = `\n🏢 *Empresa:* ${datos.empresa}`;
        }

        const mensaje = `*NUEVO INGRESO REGISTRADO*
👤 *Visita:* ${datos.datosPersonales}${lineaEmpresa}
🚪 *Sector:* ${datos.sector || ""}
👤 *Anfitrión:* ${datos.anfitrion || ""}
📝 *Obs:* ${datos.observaciones || "Sin observaciones"}`;

        console.log("--- MENSAJE FINAL PARA WHATSAPP ---");
        console.log(mensaje);

        res.status(200).json({ success: true, message: "OK", visita });

    } catch (error) {
        console.error("Error al procesar el registro:", error);
        res.status(500).json({ success: false, message: "Error interno" });
    }
});

app.get('/api/visitas', async (req, res) => {
    try {
        const visitasDesdeGoogle = await cargarVisitasDesdeGoogle();
        if (visitasDesdeGoogle.length) {
            visitasCache = visitasDesdeGoogle;
            guardarVisitasEnDisco();
        }
    } catch (error) {
        console.warn('No se pudo sincronizar desde Google.', error.message);
    }
    res.json(visitasCache);
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});