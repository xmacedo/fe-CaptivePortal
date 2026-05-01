const TERMS_VERSION = 'v1.0';
const MAC_QUERY_KEYS = ['id', 'mac', 'client_mac', 'clientMac', 'station_mac'];
const IP_QUERY_KEYS = ['ip', 'client_ip', 'userip'];

const form = document.getElementById('guest-form');
const statusElement = document.getElementById('status');
const submitButton = document.getElementById('submit-button');
const deviceInfoElement = document.getElementById('device-info');

let autoMacAddress = null;
let autoIpAddress = null;

function setStatus(type, message) {
    statusElement.className = `status ${type}`;
    statusElement.textContent = message;
}

function normalizeMac(value) {
    if (!value) return null;
    const cleaned = value.trim().replace(/-/g, ':').toUpperCase();
    return cleaned.length ? cleaned : null;
}

function getFromQuery(keys) {
    const params = new URLSearchParams(window.location.search);
    for (const key of keys) {
        const value = params.get(key);
        if (value) return value;
    }
    return null;
}

async function detectIpAddress() {
    const fromQuery = getFromQuery(IP_QUERY_KEYS);
    if (fromQuery) return fromQuery;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const response = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) return null;
        const data = await response.json();
        return data?.ip || null;
    } catch {
        return null;
    }
}

function applyPortugueseValidationMessages() {
    const requiredFields = form.querySelectorAll('input[required]');
    requiredFields.forEach((field) => {
        field.addEventListener('invalid', () => {
            if (field.validity.valueMissing) {
                field.setCustomValidity('Este campo é obrigatório.');
            } else {
                field.setCustomValidity('Verifique o valor informado.');
            }
        });

        field.addEventListener('input', () => field.setCustomValidity(''));
    });
}

function updateDeviceInfo() {
    if (autoMacAddress && autoIpAddress) {
        deviceInfoElement.textContent = `Dispositivo identificado automaticamente (MAC e IP).`;
        deviceInfoElement.classList.add('show');
        return;
    }

    if (autoMacAddress && !autoIpAddress) {
        deviceInfoElement.textContent = `MAC identificado automaticamente. IP será preenchido quando disponível.`;
        deviceInfoElement.classList.add('show');
        return;
    }

    if (!autoMacAddress) {
        deviceInfoElement.textContent = `Não foi possível identificar o MAC automaticamente pelos parâmetros da URL.`;
        // deviceInfoElement.classList.add('show');
    }
}

async function bootstrapContext() {
    autoMacAddress = normalizeMac(getFromQuery(MAC_QUERY_KEYS));
    autoIpAddress = await detectIpAddress();
    updateDeviceInfo();
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
        setStatus('error', 'Revise os campos obrigatórios e tente novamente.');
        form.reportValidity();
        return;
    }

    if (!autoMacAddress) {
        setStatus('error', 'MAC Address não identificado automaticamente. Abra o portal pelo link de redirecionamento do controlador Wi‑Fi.');
        return;
    }

    const payload = {
        fullName: form.fullName.value.trim(),
        email: form.email.value.trim() || null,
        phone: form.phone.value.trim() || null,
        macAddress: autoMacAddress,
        ipAddress: autoIpAddress,
        termsVersion: TERMS_VERSION,
        acceptedTerms: form.acceptedTerms.checked
    };

    submitButton.disabled = true;
    setStatus('success', 'Enviando cadastro...');

    try {
        const response = await fetch('https://fut-suave-captive-portal-972a99c1c8d2.herokuapp.com/api/guest/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(data?.message || 'Não foi possível concluir o cadastro.');
        }

        setStatus('success', data?.message || 'Cadastro realizado com sucesso.');
        if (data?.redirectUrl) {
            setTimeout(() => { window.location.href = data.redirectUrl; }, 1200);
        }
    } catch (error) {
        setStatus('error', error.message || 'Erro inesperado ao registrar o acesso.');
    } finally {
        submitButton.disabled = false;
    }
});

applyPortugueseValidationMessages();
bootstrapContext();