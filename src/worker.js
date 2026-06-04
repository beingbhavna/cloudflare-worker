/**
 * VSS Enterprises – Cloudflare Worker API
 * Database : Cloudflare D1  (SQLite)
 * Email    : Resend          (https://resend.com – free 3000/month)
 * Auth     : Web Crypto API  (HS256 JWT – built into Workers)
 */

// ─── CORS ────────────────────────────────────────────────────────────────────
function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin' : env.FRONTEND_URL || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

// ─── JWT (HS256 via Web Crypto) ───────────────────────────────────────────────
function b64url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromb64url(str) {
  return decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
}

async function getCryptoKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signJWT(payload, secret) {
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body    = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 86400 }));
  const data    = `${header}.${body}`;
  const key     = await getCryptoKey(secret);
  const sigBuf  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sig     = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
                    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${data}.${sig}`;
}

async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [header, body, sig] = parts;
  const data    = `${header}.${body}`;
  const key     = await getCryptoKey(secret);
  const sigBytes = Uint8Array.from(
    atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)
  );
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
  if (!valid) throw new Error('Invalid signature');
  const payload = JSON.parse(fromb64url(body));
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

// ─── Email Templates ──────────────────────────────────────────────────────────
function contactEmailHtml(d) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">🔔 नया संपर्क अनुरोध</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">VSS Enterprises – Contact Form</p>
    </div>
    <div style="padding:32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:10px 0;color:#555;width:140px;font-weight:bold;">👤 नाम</td>   <td style="padding:10px 0;color:#222;">${d.name}</td></tr>
        <tr><td style="padding:10px 0;color:#555;font-weight:bold;">📧 ईमेल</td>             <td style="padding:10px 0;color:#222;">${d.email}</td></tr>
        <tr><td style="padding:10px 0;color:#555;font-weight:bold;">📱 फोन</td>              <td style="padding:10px 0;color:#222;">${d.phone}</td></tr>
        <tr><td style="padding:10px 0;color:#555;font-weight:bold;">🔧 सेवा</td>             <td style="padding:10px 0;color:#222;">${d.service}</td></tr>
        <tr><td style="padding:10px 0;color:#555;font-weight:bold;vertical-align:top;">💬 संदेश</td><td style="padding:10px 0;color:#222;">${d.message}</td></tr>
      </table>
    </div>
    <div style="background:#f0f0ff;padding:16px 32px;font-size:12px;color:#888;text-align:center;">
      📍 VSS Enterprises | vss.electricsenterprises@gmail.com
    </div>
  </div>`;
}

function testimonialEmailHtml(d) {
  const stars = '⭐'.repeat(Number(d.rating));
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">⭐ नई प्रतिक्रिया / समीक्षा</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">VSS Enterprises – Testimonial</p>
    </div>
    <div style="padding:32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:10px 0;color:#555;width:180px;font-weight:bold;">👤 ग्राहक का नाम</td><td style="padding:10px 0;color:#222;">${d.customerName}</td></tr>
        <tr><td style="padding:10px 0;color:#555;font-weight:bold;">📧 ईमेल</td>                   <td style="padding:10px 0;color:#222;">${d.email}</td></tr>
        <tr><td style="padding:10px 0;color:#555;font-weight:bold;">🔧 सेवा</td>                   <td style="padding:10px 0;color:#222;">${d.service}</td></tr>
        <tr><td style="padding:10px 0;color:#555;font-weight:bold;">⭐ रेटिंग</td>                 <td style="padding:10px 0;color:#222;">${stars} (${d.rating}/5)</td></tr>
        <tr><td style="padding:10px 0;color:#555;font-weight:bold;vertical-align:top;">💬 समीक्षा</td><td style="padding:10px 0;color:#222;">${d.message}</td></tr>
      </table>
    </div>
    <div style="background:#f0f0ff;padding:16px 32px;font-size:12px;color:#888;text-align:center;">
      📍 VSS Enterprises | vss.electricsenterprises@gmail.com
    </div>
  </div>`;
}

function userConfirmationHtml(name) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">✅ Message Received!</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">VSS Enterprises</p>
    </div>
    <div style="padding:32px;color:#333;">
      <p>Dear <strong>${name}</strong>,</p>
      <p>Thank you for contacting us! We have received your message and will get back to you within <strong>24 hours</strong>.</p>
      <p>For urgent assistance, you can also reach us on WhatsApp: <strong>+91 9454445071</strong></p>
      <br>
      <p>Best regards,<br><strong>VSS Enterprises Team</strong></p>
    </div>
    <div style="background:#f0f0ff;padding:16px 32px;font-size:12px;color:#888;text-align:center;">
      📍 VSS Enterprises | vss.electricsenterprises@gmail.com
    </div>
  </div>`;
}

// ─── Resend Email Sender ──────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, env }) {
  if (!env.RESEND_API_KEY) {
    console.warn('⚠️  RESEND_API_KEY not set – skipping email');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method : 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type' : 'application/json',
    },
    body: JSON.stringify({
      from   : 'VSS Enterprises <onboarding@resend.dev>',
      to     : Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('❌ Resend error:', err);
  } else {
    console.log('📧 Email sent to', to);
  }
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

// GET /api/health
async function handleHealth(env, cors) {
  return json({ status: 'ok', service: 'VSS Enterprises API', database: 'Cloudflare D1' }, 200, cors);
}

// POST /api/contact
async function handleContact(request, env, cors) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ success: false, message: 'Invalid JSON.' }, 400, cors);

  const { name, email, phone, service, message } = body;
  if (!name || !email || !phone || !service || !message)
    return json({ success: false, message: 'All fields are required.' }, 400, cors);

  // Save to D1
  await env.DB.prepare(
    'INSERT INTO contacts (name, email, phone, service, message) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, email, phone, service, message).run();

  // Email admin in Hindi
  await sendEmail({
    to      : env.ADMIN_EMAIL,
    subject : '🔔 नया संपर्क अनुरोध – VSS Enterprises',
    html    : contactEmailHtml({ name, email, phone, service, message }),
    env,
  });

  // Confirmation to user in English
  await sendEmail({
    to      : email,
    subject : 'We received your message – VSS Enterprises',
    html    : userConfirmationHtml(name),
    env,
  });

  return json({ success: true, message: 'Thank you! Your message has been received. We will contact you soon!' }, 200, cors);
}

// POST /api/feedback
async function handleFeedback(request, env, cors) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ success: false, message: 'Invalid JSON.' }, 400, cors);

  const { customerName, email, service, rating, message } = body;
  if (!customerName || !email || !service || !rating || !message)
    return json({ success: false, message: 'All fields are required.' }, 400, cors);

  await env.DB.prepare(
    'INSERT INTO testimonials (customer_name, email, service, rating, message) VALUES (?, ?, ?, ?, ?)'
  ).bind(customerName, email, service, Number(rating), message).run();

  await sendEmail({
    to      : env.ADMIN_EMAIL,
    subject : '⭐ नई प्रतिक्रिया प्राप्त हुई – VSS Enterprises',
    html    : testimonialEmailHtml({ customerName, email, service, rating, message }),
    env,
  });

  return json({ success: true, message: 'Thank you for your feedback!' }, 200, cors);
}

// POST /api/testimonial
async function handleTestimonial(request, env, cors) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ success: false, message: 'Invalid JSON.' }, 400, cors);

  const { customerName, email, service, rating, message } = body;
  if (!customerName || !email || !service || !rating || !message)
    return json({ success: false, message: 'All fields are required.' }, 400, cors);

  const result = await env.DB.prepare(
    'INSERT INTO testimonials (customer_name, email, service, rating, message) VALUES (?, ?, ?, ?, ?)'
  ).bind(customerName, email, service, Number(rating), message).run();

  await sendEmail({
    to      : env.ADMIN_EMAIL,
    subject : '⭐ नई समीक्षा प्राप्त हुई – VSS Enterprises',
    html    : testimonialEmailHtml({ customerName, email, service, rating, message }),
    env,
  });

  return json({
    success : true,
    message : 'Thank you! Your testimonial has been submitted and is now visible to all customers.',
    data    : { id: result.meta?.last_row_id, customerName, service, rating }
  }, 200, cors);
}

// GET /api/testimonials
async function handleGetTestimonials(env, cors) {
  const { results } = await env.DB.prepare(
    'SELECT id, customer_name AS customerName, service, rating, message, created_at AS date FROM testimonials ORDER BY created_at DESC'
  ).all();

  return json({ success: true, data: results }, 200, cors);
}

// POST /api/login
async function handleLogin(request, env, cors) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ message: 'Invalid JSON.' }, 400, cors);

  const { email, password } = body;
  const adminEmail    = env.ADMIN_EMAIL;
  const adminPassword = env.ADMIN_PASSWORD;

  if (email !== adminEmail)
    return json({ message: 'Invalid email.' }, 401, cors);
  if (password !== adminPassword)
    return json({ message: 'Wrong password.' }, 401, cors);

  const secret = env.JWT_SECRET || 'vss_secret_key';
  const token  = await signJWT({ email }, secret);

  return json({ token }, 200, cors);
}

// ─── Main Fetch Handler ───────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const cors   = corsHeaders(env);
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      // ── Routes ──────────────────────────────────────────────────────────────
      if (path === '/api/health'       && method === 'GET')  return handleHealth(env, cors);
      if (path === '/api/contact'      && method === 'POST') return handleContact(request, env, cors);
      if (path === '/api/feedback'     && method === 'POST') return handleFeedback(request, env, cors);
      if (path === '/api/testimonial'  && method === 'POST') return handleTestimonial(request, env, cors);
      if (path === '/api/testimonials' && method === 'GET')  return handleGetTestimonials(env, cors);
      if (path === '/api/login'        && method === 'POST') return handleLogin(request, env, cors);

      return json({ success: false, message: 'Route not found.' }, 404, cors);

    } catch (err) {
      console.error('Worker error:', err.message);
      return json({ success: false, message: 'Internal server error.' }, 500, cors);
    }
  }
};
