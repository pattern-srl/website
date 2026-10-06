const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');
const submit = form.querySelector('button[type="submit"]');
let pending = false;
let lastPayload = '';
let requestId = '';
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (pending || !form.reportValidity()) return;
  const fields = Object.fromEntries(new FormData(form));
  const payload = JSON.stringify(fields);
  if (payload !== lastPayload) { requestId = crypto.randomUUID(); lastPayload = payload; }
  pending = true;
  submit.disabled = true;
  submit.textContent = 'Sending…';
  form.setAttribute('aria-busy', 'true');
  status.textContent = '';
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Idempotency-Key': requestId},
      body: payload,
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error(result.error || 'We couldn’t send your message. Please try again or email info@findpattern.it.');
    status.textContent = 'Thank you. Your message has been sent to Pattern.';
    form.reset();
    lastPayload = '';
  } catch (error) {
    status.textContent = error.name === 'TimeoutError' || error instanceof TypeError
      ? 'We couldn’t confirm the send. Please try again; your message is still here.'
      : error.message;
  } finally {
    pending = false;
    submit.disabled = false;
    submit.textContent = 'Send message';
    form.removeAttribute('aria-busy');
  }
});
