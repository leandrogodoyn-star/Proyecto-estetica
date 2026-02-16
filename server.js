
// ==========================================
// BACKEND - SERVIDOR PARA APP DE ESTÉTICA
// ==========================================

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DB_FILE = path.join(__dirname, 'appointments.json');

// ==========================================
// DB INIT
// ==========================================
async function initDatabase() {
    try {
        await fs.access(DB_FILE);
    } catch {
        await fs.writeFile(DB_FILE, JSON.stringify({ appointments: [] }, null, 2));
        console.log('Base de datos creada');
    }
}

// ==========================================
// DB FUNCTIONS
// ==========================================
async function getAppointments() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
        if (!parsed.appointments) parsed.appointments = [];
        return parsed;
    } catch {
        return { appointments: [] };
    }
}

async function saveAppointments(data) {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

// ==========================================
// API
// ==========================================

app.get('/api/appointments', async (req, res) => {
    try {
        const data = await getAppointments();
        res.json(data.appointments);
    } catch {
        res.status(500).json({ error: 'Error al obtener turnos' });
    }
});

app.post('/api/appointments', async (req, res) => {
    try {
        const { service, serviceName, servicePrice, date, time, name, phone, email, comments } = req.body;

        if (!service || !date || !time || !name || !phone) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        const data = await getAppointments();

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

        data.appointments.push(newAppointment);
        await saveAppointments(data);

        res.status(201).json({
            success: true,
            appointment: newAppointment
        });

    } catch (error) {
        res.status(500).json({ error: 'Error al crear turno' });
    }
});

app.get('/api/appointments/busy/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const data = await getAppointments();

        const busySlots = data.appointments
            .filter(a => a.date === date && a.status !== 'cancelado')
            .map(a => a.time);

        res.json({ busySlots });

    } catch {
        res.status(500).json({ error: 'Error al obtener horarios' });
    }
});

app.delete('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await getAppointments();

        const appointment = data.appointments.find(a => a.id === id);
        if (!appointment) return res.status(404).json({ error: 'No encontrado' });

        appointment.status = 'cancelado';
        await saveAppointments(data);

        res.json({ success: true });

    } catch {
        res.status(500).json({ error: 'Error al cancelar' });
    }
});

app.get('/api/appointments/today', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const data = await getAppointments();

        const list = data.appointments
            .filter(a => a.date === today && a.status === 'confirmado')
            .sort((a, b) => a.time.localeCompare(b.time));

        res.json(list);

    } catch {
        res.status(500).json({ error: 'Error' });
    }
});

// ==========================================
// PANEL ADMIN
// ==========================================

app.get('/admin', (req, res) => {
res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Panel</title>
<style>
body{font-family:sans-serif;background:#f5f5f5;padding:2rem}
.container{max-width:1100px;margin:auto}
table{width:100%;border-collapse:collapse;background:#fff}
th{background:#D4AF86;color:white;padding:10px}
td{padding:10px;border-bottom:1px solid #eee}
button{padding:6px 12px;background:#ff5252;color:white;border:none;border-radius:6px;cursor:pointer}
</style>
</head>
<body>

<div class="container">
<h2>Panel de Turnos</h2>

<button onclick="loadAppointments()">Actualizar</button>

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
<th></th>
</tr>
</thead>
<tbody id="list"></tbody>
</table>
</div>

<script>
async function loadAppointments(){
const res=await fetch('/api/appointments');
const data=await res.json();

const tbody=document.getElementById('list');

if(!data.length){
tbody.innerHTML='<tr><td colspan="8">Sin turnos</td></tr>';
return;
}

data.sort((a,b)=>{
if(a.date===b.date)return a.time.localeCompare(b.time);
return b.date.localeCompare(a.date);
});

tbody.innerHTML=data.map(function(a){
return '<tr>'+
'<td>'+formatDate(a.date)+'</td>'+
'<td>'+a.time+'</td>'+
'<td>'+a.name+'</td>'+
'<td>'+a.phone+'</td>'+
'<td>'+a.serviceName+'</td>'+
'<td>'+a.servicePrice+'</td>'+
'<td>'+a.status+'</td>'+
'<td>'+(a.status==='confirmado'
? '<button onclick="cancelAppointment(\\''+a.id+'\\')">Cancelar</button>'
: '-')+
'</td>'+
'</tr>';
}).join('');
}

async function cancelAppointment(id){
if(!confirm('Cancelar turno?'))return;
await fetch('/api/appointments/'+id,{method:'DELETE'});
loadAppointments();
}

function formatDate(d){
const date=new Date(d);
return date.toLocaleDateString('es-AR');
}

loadAppointments();
</script>

</body>
</html>
`);
});

// ==========================================
// START
// ==========================================
async function start(){
await initDatabase();
app.listen(PORT,()=>console.log("Servidor en http://localhost:"+PORT));
}
start();
