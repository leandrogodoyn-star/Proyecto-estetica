// ======================================================
// SERVER PROFESIONAL — APP TURNOS ESTÉTICA
// Ready for Railway / Render / VPS
// ======================================================

const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// =======================
// CONFIG
// =======================

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

// security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// simple logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.url}`);
  next();
});

// =======================
// DATABASE FILE
// =======================

// Railway necesita /tmp
const DB_FILE = "/tmp/appointments.json";

// =======================
// DB INIT
// =======================

async function initDatabase() {
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify({ appointments: [] }, null, 2));
    console.log("DB creada");
  }
}

// =======================
// DB HELPERS
// =======================

async function readDB() {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { appointments: [] };
  }
}

async function writeDB(data) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

// =======================
// VALIDATOR
// =======================

function validateAppointment(body) {
  const required = ["service", "date", "time", "name", "phone"];
  for (let field of required) {
    if (!body[field]) return `Falta campo: ${field}`;
  }
  return null;
}

// =======================
// ROUTES API
// =======================
app.get("/", (req, res) => {
  res.send("Servidor funcionando correctamente 🚀");
});

// health check (Railway usa esto)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// obtener turnos
app.get("/api/appointments", async (req, res) => {
  const db = await readDB();
  res.json(db.appointments);
});

// crear turno
app.post("/api/appointments", async (req, res) => {
  const error = validateAppointment(req.body);
  if (error) return res.status(400).json({ error });

  const db = await readDB();

  const newAppointment = {
    id: Date.now().toString(),
    service: req.body.service,
    serviceName: req.body.serviceName || "",
    servicePrice: req.body.servicePrice || "",
    date: req.body.date,
    time: req.body.time,
    name: req.body.name,
    phone: req.body.phone,
    email: req.body.email || "",
    comments: req.body.comments || "",
    status: "confirmado",
    createdAt: new Date().toISOString(),
  };

  db.appointments.push(newAppointment);
  await writeDB(db);

  res.status(201).json({
    success: true,
    appointment: newAppointment,
  });
});

// horarios ocupados
app.get("/api/appointments/busy/:date", async (req, res) => {
  const db = await readDB();

  const busy = db.appointments
    .filter((a) => a.date === req.params.date && a.status !== "cancelado")
    .map((a) => a.time);

  res.json({ busySlots: busy });
});

// cancelar turno
app.delete("/api/appointments/:id", async (req, res) => {
  const db = await readDB();

  const appt = db.appointments.find((a) => a.id === req.params.id);
  if (!appt) return res.status(404).json({ error: "No encontrado" });

  appt.status = "cancelado";
  await writeDB(db);

  res.json({ success: true });
});

// turnos de hoy
app.get("/api/appointments/today", async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const db = await readDB();

  const list = db.appointments
    .filter((a) => a.date === today && a.status === "confirmado")
    .sort((a, b) => a.time.localeCompare(b.time));

  res.json(list);
});

// =======================
// PANEL ADMIN
// =======================

app.get("/admin", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Panel</title>
<style>
body{font-family:sans-serif;background:#f4f4f4;padding:20px}
table{width:100%;background:white;border-collapse:collapse}
th{background:#D4AF86;color:white;padding:10px}
td{padding:10px;border-bottom:1px solid #eee}
button{background:#ff5252;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer}
</style>
</head>
<body>

<h2>Turnos</h2>
<button onclick="load()">Actualizar</button>

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

<script>
async function load(){
const res=await fetch('/api/appointments');
const data=await res.json();
const tbody=document.getElementById('list');

if(!data.length){
tbody.innerHTML='<tr><td colspan="8">Sin turnos</td></tr>';
return;
}

tbody.innerHTML=data.map(a=>\`
<tr>
<td>\${new Date(a.date).toLocaleDateString()}</td>
<td>\${a.time}</td>
<td>\${a.name}</td>
<td>\${a.phone}</td>
<td>\${a.serviceName}</td>
<td>\${a.servicePrice}</td>
<td>\${a.status}</td>
<td>\${a.status==="confirmado"
?'<button onclick="cancel(\\''+a.id+'\\')">Cancelar</button>'
:'-'}</td>
</tr>\`).join('');
}

async function cancel(id){
if(!confirm("Cancelar turno?"))return;
await fetch("/api/appointments/"+id,{method:"DELETE"});
load();
}

load();
</script>
</body>
</html>
`);
});

// =======================
// ERROR HANDLER
// =======================

app.use((err, req, res, next) => {
  console.error("ERROR:", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

// =======================
// START SERVER
// =======================

async function start() {
  await initDatabase();

  app.listen(PORT, "0.0.0.0", () => {
    console.log("Servidor activo en puerto " + PORT);
  });
}

start();
