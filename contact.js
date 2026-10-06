const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');
const submit = form.querySelector('button[type="submit"]');
const language = document.documentElement.lang === 'it' ? 'it' : 'en';
const messages = {
  en: {
    required: 'Please fill in this field.', email: 'Please enter a valid email address.',
    invalid: 'Please check this field.', sending: 'Sending…', send: 'Send message',
    success: 'Thank you. Your message has been submitted.',
    error: 'We couldn’t send your message. Please try again or email info@findpattern.it.',
    unavailable: 'The form is not available yet. Please email info@findpattern.it.',
    network: 'We couldn’t confirm the send. Your message is still here. Please check your connection before trying again.',
    limit: 'Too many requests. Please try again later or email info@findpattern.it.'
  },
  it: {
    required: 'Compila questo campo.', email: 'Inserisci un indirizzo email valido.',
    invalid: 'Controlla questo campo.', sending: 'Invio in corso…', send: 'Invia messaggio',
    success: 'Grazie. Il tuo messaggio è stato inoltrato.',
    error: 'Non è stato possibile inviare il messaggio. Riprova oppure scrivi a info@findpattern.it.',
    unavailable: 'Il modulo non è ancora disponibile. Scrivi a info@findpattern.it.',
    network: 'Non è stato possibile confermare l’invio. Il messaggio è ancora qui. Controlla la connessione prima di riprovare.',
    limit: 'Troppe richieste. Riprova più tardi oppure scrivi a info@findpattern.it.'
  }
}[language];
let pending = false;
form.addEventListener('invalid', (event) => {
  const field = event.target;
  field.setCustomValidity('');
  if (field.validity.valueMissing) field.setCustomValidity(messages.required);
  else if (field.validity.typeMismatch) field.setCustomValidity(messages.email);
  else if (!field.validity.valid) field.setCustomValidity(messages.invalid);
}, true);
form.addEventListener('input', (event) => event.target.setCustomValidity?.(''));
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (pending || !form.reportValidity()) return;
  const endpoint = form.getAttribute('action');
  if (!/^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(endpoint || '')) {
    status.textContent = messages.unavailable;
    return;
  }
  const fields = new FormData(form);
  if (fields.get('_gotcha')) { status.textContent = messages.error; return; }
  for (const name of ['name', 'message']) {
    if (!String(fields.get(name) || '').trim()) {
      const field = form.elements.namedItem(name);
      field.setCustomValidity(messages.required);
      field.reportValidity();
      return;
    }
  }
  pending = true;
  submit.disabled = true;
  submit.textContent = messages.sending;
  form.setAttribute('aria-busy', 'true');
  status.textContent = '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: {'Accept': 'application/json'},
      body: fields, signal: controller.signal
    });
    if (!response.ok) {
      status.textContent = response.status === 429 ? messages.limit : messages.error;
      return;
    }
    // A JSON acknowledgment avoids treating an HTML challenge or redirect as success.
    const result = await response.json();
    if (!result || result.errors || result.error || result.ok === false) {
      status.textContent = messages.error;
      return;
    }
    status.textContent = messages.success;
    form.reset();
  } catch {
    status.textContent = messages.network;
  } finally {
    clearTimeout(timer);
    pending = false;
    submit.disabled = false;
    submit.textContent = messages.send;
    form.removeAttribute('aria-busy');
  }
});
