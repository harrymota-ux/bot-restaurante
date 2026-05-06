require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ADMIN = process.env.ADMIN_WHATSAPP;

const MENU = `🍽️ *Bienvenido al Restaurante Don Pepe*

Escribe el número del plato que deseas:

🥗 *Entradas*
  1. Ensalada César - RD$250
  2. Sopa del día - RD$180

🍔 *Platos Principales*
  3. Pollo a la plancha - RD$450
  4. Res guisada - RD$500
  5. Pasta Alfredo - RD$380

🍰 *Postres*
  6. Flan de vainilla - RD$150
  7. Brownie con helado - RD$200

🥤 *Bebidas*
  8. Jugo natural - RD$120
  9. Refresco - RD$80
  10. Agua - RD$60

_Escribe los números separados por coma_
_Ej: 3, 5, 9_`;

const BIENVENIDA = `👋 ¡Hola! Bienvenido a *Restaurante Don Pepe* 🍽️

¿En qué te podemos ayudar?

1️⃣ Ver el *Menú*
2️⃣ Hacer un *Pedido*
3️⃣ Consultar *Horarios*
4️⃣ Hablar con un *Agente*`;

const HORARIOS = `🕐 *Nuestros Horarios*

📅 Lunes a Viernes: 11:00 AM - 10:00 PM
📅 Sábados: 11:00 AM - 11:00 PM
📅 Domingos: 12:00 PM - 9:00 PM

📍 Dirección: Calle Principal #123, Santiago`;

// Estado de conversaciones
const sesiones = {};

// ── Enviar mensaje ───────────────────────────
async function enviarMensaje(telefono, texto) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: telefono,
      type: 'text',
      text: { body: texto }
    },
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
}

// ── Notificar al dueño ───────────────────────
async function notificarDueno(cliente, pedido) {
  const hora = new Date().toLocaleTimeString('es-DO', {
    timeZone: 'America/Santo_Domingo'
  });
  await enviarMensaje(
    ADMIN,
    `🛎️ *NUEVO PEDIDO*\n\n` +
    `👤 Cliente: ${cliente}\n` +
    `📋 Pedido: ${pedido}\n` +
    `🕐 Hora: ${hora}`
  );
}

// ── Verificación del Webhook (Meta lo requiere) ──
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ── Recibir mensajes ─────────────────────────
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Meta requiere respuesta inmediata

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const mensajeObj = value?.messages?.[0];

    if (!mensajeObj) return;

    const cliente = mensajeObj.from;
    const texto = mensajeObj.text?.body?.trim() || '';
    const msg = texto.toLowerCase();

    if (!sesiones[cliente]) sesiones[cliente] = { estado: 'inicio' };
    const sesion = sesiones[cliente];

    // ── Lógica del bot ──
    if (msg.includes('hola') || msg.includes('buenas') || msg === 'inicio' || msg === '0') {
      await enviarMensaje(cliente, BIENVENIDA);
      sesion.estado = 'inicio';

    } else if (msg === '1' || msg.includes('menu') || msg.includes('menú')) {
      await enviarMensaje(cliente, MENU);
      sesion.estado = 'viendo_menu';

    } else if (msg === '2' || msg.includes('pedido')) {
      await enviarMensaje(cliente, MENU + '\n\n_Escribe los números de lo que deseas 👆_');
      sesion.estado = 'esperando_pedido';

    } else if (sesion.estado === 'esperando_pedido' || sesion.estado === 'viendo_menu') {
      await notificarDueno(cliente, texto);
      await enviarMensaje(cliente,
        `✅ *¡Pedido recibido!*\n\n` +
        `📋 Tu pedido: *${texto}*\n\n` +
        `⏱️ Tiempo estimado: 20-30 minutos\n` +
        `📞 Te contactaremos si hay alguna duda.\n\n` +
        `¡Gracias por preferirnos! 🙏`
      );
      sesion.estado = 'inicio';

    } else if (msg === '3' || msg.includes('horario')) {
      await enviarMensaje(cliente, HORARIOS);

    } else if (msg === '4' || msg.includes('agente')) {
      await enviarMensaje(cliente,
        `👤 En un momento un agente te atenderá.\n` +
        `También puedes llamarnos al 📞 *809-XXX-XXXX*`
      );

    } else {
      await enviarMensaje(cliente, BIENVENIDA);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
});

// ── Iniciar servidor ─────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Bot corriendo en puerto ${PORT}`);
});