
// ==========================================
// BACKEND - SERVIDOR PARA APP DE ESTÉTICA
// Node.js + Express + JSON Database
// ==========================================

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Carpeta para archivos estáticos

// Archivo de base de datos (JSON simple)
const DB_FILE = path.join(__dirname, 'appointments.json');

// ==========================================
// INICIALIZAR BASE DE DATOS
// ==========================================
async function initDatabase() {
    try {
        await fs.access(DB_FILE);
    } catch {
        // Si no existe, crear archivo vacío
        await fs.writeFile(DB_FILE, JSON.stringify({ appointments: [] }, null, 2));
        console.log('📁 Base de datos creada');
    }
}

// ==========================================
// LEER TODOS LOS TURNOS
// ==========================================
async function getAppointments() {
    const data = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(data);
}

// ==========================================
// GUARDAR TURNOS
// ==========================================
async function saveAppointments(data) {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

// ==========================================
// RUTAS DE LA API
// ==========================================

// 1. OBTENER TODOS LOS TURNOS (para el panel de admin)
app.get('/api/appointments', async (req, res) => {
    try {
        const data = await getAppointments();
        res.json(data.appointments);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener turnos' });
    }
});

// 2. CREAR NUEVO TURNO
app.post('/api/appointments', async (req, res) => {
    try {
        const { service, serviceName, servicePrice, date, time, name, phone, email, comments } = req.body;
        
        // Validar datos requeridos
        if (!service || !date || !time || !name || !phone) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }
        
        // Leer turnos existentes
        const data = await getAppointments();
        
        // Crear nuevo turno
        const newAppointment = {
            id: Date.now().toString(),
            service,
            serviceName,
            servicePrice,
            date,
            time,
            name,
            phone,
            email: email || '',
            comments: comments || '',
            status: 'confirmado',
            createdAt: new Date().toISOString()
        };
        
        // Agregar a la lista
        data.appointments.push(newAppointment);
        
        // Guardar
        await saveAppointments(data);
        
        console.log('✅ Nuevo turno creado:', newAppointment.id);
        res.status(201).json({ 
            success: true, 
            appointment: newAppointment,
            message: 'Turno agendado exitosamente'
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al crear turno' });
    }
});

// 3. OBTENER HORARIOS OCUPADOS PARA UNA FECHA
app.get('/api/appointments/busy/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const data = await getAppointments();
        
        // Filtrar turnos de esa fecha
        const busySlots = data.appointments
            .filter(apt => apt.date === date && apt.status !== 'cancelado')
            .map(apt => apt.time);
        
        res.json({ busySlots });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener horarios' });
    }
});

// 4. CANCELAR TURNO
app.delete('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await getAppointments();
        
        // Encontrar turno
        const appointment = data.appointments.find(apt => apt.id === id);
        
        if (!appointment) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        // Marcar como cancelado
        appointment.status = 'cancelado';
        
        // Guardar
        await saveAppointments(data);
        
        console.log('❌ Turno cancelado:', id);
        res.json({ success: true, message: 'Turno cancelado' });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al cancelar turno' });
    }
});

// 5. OBTENER TURNOS DEL DÍA (para ver la agenda diaria)
app.get('/api/appointments/today', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const data = await getAppointments();
        
        const todayAppointments = data.appointments
            .filter(apt => apt.date.startsWith(today) && apt.status === 'confirmado')
            .sort((a, b) => a.time.localeCompare(b.time));
        
        res.json(todayAppointments);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener turnos del día' });
    }
});

// ==========================================
// PANEL DE ADMINISTRACIÓN (HTML)
// ==========================================
app.get('/admin', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel de Administración - Bella Estética</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f5f5;
            padding: 2rem;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            color: #2c2c2c;
            margin-bottom: 2rem;
            font-size: 2rem;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #D4AF86;
            margin-bottom: 0.5rem;
        }
        .stat-label {
            color: #666;
            font-size: 0.9rem;
        }
        .appointments {
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th {
            background: #D4AF86;
            color: white;
            padding: 1rem;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 1rem;
            border-bottom: 1px solid #f0f0f0;
        }
        tr:hover {
            background: #fafafa;
        }
        .status {
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        .status.confirmado {
            background: #e8f5e9;
            color: #2e7d32;
        }
        .status.cancelado {
            background: #ffebee;
            color: #c62828;
        }
        .btn-cancel {
            background: #ff5252;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
        }
        .btn-cancel:hover {
            background: #ff1744;
        }
        .refresh-btn {
            background: #D4AF86;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
            margin-bottom: 1rem;
        }
        .refresh-btn:hover {
            background: #c9a075;
        }
        .empty-state {
            padding: 3rem;
            text-align: center;
            color: #999;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 Panel de Administración - Bella Estética</h1>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value" id="total-appointments">0</div>
                <div class="stat-label">Total de Turnos</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="today-appointments">0</div>
                <div class="stat-label">Turnos Hoy</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="confirmed-appointments">0</div>
                <div class="stat-label">Confirmados</div>
            </div>
        </div>

        <button class="refresh-btn" onclick="loadAppointments()">🔄 Actualizar</button>

        <div class="appointments">
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Cliente</th>
                        <th>Teléfono</th>
                        <th>Servicio</th>
                        <th>Precio</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="appointments-list">
                    <tr>
                        <td colspan="8" class="empty-state">Cargando turnos...</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <script>
        async function loadAppointments() {
            try {
                const response = await fetch('/api/appointments');
                const appointments = await response.json();
                
                // Actualizar estadísticas
                const today = new Date().toISOString().split('T')[0];
                const todayAppointments = appointments.filter(apt => 
                    apt.date.startsWith(today) && apt.status === 'confirmado'
                );
                const confirmedAppointments = appointments.filter(apt => 
                    apt.status === 'confirmado'
                );
                
                document.getElementById('total-appointments').textContent = appointments.length;
                document.getElementById('today-appointments').textContent = todayAppointments.length;
                document.getElementById('confirmed-appointments').textContent = confirmedAppointments.length;
                
                // Renderizar tabla
                const tbody = document.getElementById('appointments-list');
                
                if (appointments.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay turnos agendados</td></tr>';
                    return;
                }
                
                // Ordenar por fecha y hora
                appointments.sort((a, b) => {
                    if (a.date === b.date) {
                        return a.time.localeCompare(b.time);
                    }
                    return b.date.localeCompare(a.date);
                });
                
                tbody.innerHTML = appointments.map(apt => \`
                    <tr>
                        <td>\${formatDate(apt.date)}</td>
                        <td><strong>\${apt.time}</strong></td>
                        <td>\${apt.name}</td>
                        <td>\${apt.phone}</td>
                        <td>\${apt.serviceName}</td>
                        <td><strong>\${apt.servicePrice}</strong></td>
                        <td><span class="status \${apt.status}">\${apt.status}</span></td>
                        <td>
                            \${apt.status === 'confirmado' ? 
                                \`<button class="btn-cancel" onclick="cancelAppointment('\${apt.id}')">Cancelar</button>\` : 
                                '-'
                            }
                        </td>
                    </tr>
                \`).join('');
                
            } catch (error) {
                console.error('Error:', error);
                alert('Error al cargar los turnos');
            }
        }
        
        async function cancelAppointment(id) {
            if (!confirm('¿Seguro que quieres cancelar este turno?')) {
                return;
            }
            
            try {
                const response = await fetch(\`/api/appointments/\${id}\`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    alert('Turno cancelado exitosamente');
                    loadAppointments();
                } else {
                    alert('Error al cancelar turno');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al cancelar turno');
            }
        }
        
        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('es-AR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
            });
        }
        
        // Cargar turnos al iniciar
        loadAppointments();
        
        // Auto-actualizar cada 30 segundos
        setInterval(loadAppointments, 30000);
    </script>
</body>
</html>
    `);
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log('🚀 Servidor iniciado');
        console.log(\`📱 App: http://localhost:\${PORT}\`);
        console.log(\`👨‍💼 Admin: http://localhost:\${PORT}/admin\`);
        console.log('');
        console.log('Presiona Ctrl+C para detener el servidor');
    });
});