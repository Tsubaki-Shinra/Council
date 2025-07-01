/**
 * payment-handler.js
 * Script central para gerenciar todo o fluxo de pagamento PIX.
 * Ele cria e controla dinamicamente todos os pop-ups e animações.
 */

// Função principal que será chamada em cada uma de suas páginas.
function initializePaymentFlow(productInfo, apiEndpoints, brandInfo) {

    /**
     * Esta função injeta o HTML dos pop-ups no corpo da página.
     * Isso mantém o arquivo index.html principal limpo.
     */
    function injectPopupHtml() {
        if (document.getElementById('pix-overlay')) return;

        const loadingOverlayHtml = `
            <div class="loading-progress-container">
                <div class="loading-header">
                    <img src="${brandInfo.logoUrl}" alt="${brandInfo.name} Logo" class="loading-logo" onerror="this.onerror=null;this.src='https://placehold.co/100x32/FE2C55/FFFFFF?text=LOGO';">
                    <h2>Aguarde, estamos processando...</h2>
                    <p>Sua segurança é nossa prioridade.</p>
                </div>
                <div class="progress-bar-container">
                    <div id="progress-bar" class="progress-bar"></div>
                </div>
                <ul id="loading-steps" class="loading-steps">
                    <li data-step="1"><div class="step-icon"></div><span>Verificando informações da sua conta...</span></li>
                    <li data-step="2"><div class="step-icon"></div><span>Estabelecendo conexão segura com o banco...</span></li>
                    <li data-step="3"><div class="step-icon"></div><span>Finalizando e gerando seu QR Code...</span></li>
                </ul>
            </div>`;

        const pixOverlayHtml = `<div class="pix-popup"></div>`;

        const prePixLoadingDiv = document.createElement('div');
        prePixLoadingDiv.id = 'pre-pix-loading-overlay';
        prePixLoadingDiv.innerHTML = loadingOverlayHtml;
        document.body.appendChild(prePixLoadingDiv);

        const pixOverlayDiv = document.createElement('div');
        pixOverlayDiv.id = 'pix-overlay';
        pixOverlayDiv.className = 'overlay';
        pixOverlayDiv.innerHTML = pixOverlayHtml;
        document.body.appendChild(pixOverlayDiv);
    }

    // --- Variáveis de Estado Globais ---
    let paymentCheckInterval, pixTimerInterval, countdownInterval, paidBtnTimer;
    let currentPixData = null;

    // --- Elementos do DOM ---
    let pixOverlay, pixPopup, prePixLoadingOverlay, progressBar;
    const ctaBtn = document.getElementById('cta-btn');

    // --- Funções Auxiliares ---
    const formatCurrency = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    // --- Funções de Overlay e Renderização ---
    function showOverlay(stateClass) {
        pixPopup.className = 'pix-popup ' + stateClass;
        document.body.classList.add('body-no-scroll');
        pixOverlay.classList.add('show');
    }

    function hideAllOverlays() {
        prePixLoadingOverlay.classList.remove('show');
        pixOverlay.classList.remove('show');
        document.body.classList.remove('body-no-scroll');
    }

    function renderPixScreen(pixData) {
        pixPopup.innerHTML = `
            <div class="pix-body">
                <div class="pix-popup-header">
                    <img src="${brandInfo.logoUrl}" alt="${brandInfo.name} Logo" class="pix-logo" onerror="this.style.display='none'">
                    <p class="pix-product-name">Você está pagando por:</p>
                    <h3 class="pix-product-title">${productInfo.name}</h3>
                    <p class="pix-amount">${formatCurrency(productInfo.priceInCents)}</p>
                </div>
                <p class="pix-instructions">1. Escaneie o QR Code abaixo:</p>
                <div id="qr-code-container"></div>
                <p class="pix-instructions">2. Ou copie o código para pagar:</p>
                <div class="pix-key-container">
                    <p id="pix-key-text">${pixData.pix_emv}</p>
                    <button id="copy-key-btn"><i data-lucide="copy"></i></button>
                </div>
                <div class="pix-footer">
                    <div class="pix-timer-container">
                        <i data-lucide="clock"></i>
                        <span>Este código expira em <strong id="pix-timer">${formatTime(15 * 60)}</strong></span>
                    </div>
                    <button id="paid-btn" disabled><i data-lucide="check-circle" class="icon"></i><span>Já Efetuei o Pagamento</span></button>
                </div>
            </div>`;
        lucide.createIcons();
        new QRCode(document.getElementById('qr-code-container'), { text: pixData.pix_emv, width: 200, height: 200, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
        startPixTimer();
        startPaidButtonDelay();
        document.getElementById('copy-key-btn').addEventListener('click', () => copyPixKey(pixData.pix_emv));
        document.getElementById('paid-btn').addEventListener('click', renderAwaitingPaymentScreen);
        showOverlay('pix-payment-screen');
    }

    function renderAwaitingPaymentScreen() {
        pixPopup.innerHTML = `
            <div class="pix-body" id="awaiting-payment-body">
                <img src="${brandInfo.logoUrl}" alt="${brandInfo.name} Logo" class="pix-logo" onerror="this.style.display='none'">
                <div id="awaiting-loader-container">
                     <svg class="await-timer-svg" viewBox="0 0 100 100"><circle class="awaiting-loader-bg" cx="50" cy="50" r="45"></circle><circle id="awaiting-loader-circle" class="awaiting-loader-circle" cx="50" cy="50" r="45"></circle></svg>
                     <span id="await-timer-text">${brandInfo.countdownSeconds}</span>
                </div>
                <h2 id="awaiting-title">Analisando Pagamento...</h2>
                <p id="awaiting-text">Estamos confirmando a transação. Por favor, aguarde e não feche esta tela.</p>
                <div id="did-not-pay-btn-container"><button id="did-not-pay-btn">Não efetuei o pagamento</button></div>
                <div id="timeout-content" style="display: none;"><button id="back-to-payment-btn"><i data-lucide="arrow-left" class="icon"></i><span>Voltar para o Pagamento</span></button></div>
            </div>`;
        lucide.createIcons();
        document.getElementById('did-not-pay-btn').addEventListener('click', () => { clearInterval(countdownInterval); renderPixScreen(currentPixData); });
        document.getElementById('back-to-payment-btn').addEventListener('click', () => { clearInterval(countdownInterval); renderPixScreen(currentPixData); });
        startAwaitingCountdown();
        showOverlay('awaiting-payment-screen');
    }

    function renderApprovedScreen() {
        clearInterval(paymentCheckInterval); clearInterval(pixTimerInterval); clearInterval(countdownInterval); clearTimeout(paidBtnTimer);
        pixPopup.innerHTML = `<div class="pix-body"><div class="approved-icon-container"><i data-lucide="check"></i></div><h2>Pagamento Aprovado!</h2><p>Seu acesso foi liberado. Estamos te redirecionando...</p><div class="loading-dots"><span></span><span></span><span></span></div></div>`;
        lucide.createIcons();
        showOverlay('approved-screen');
        setTimeout(() => { window.location.href = productInfo.nextPage; }, 3500);
    }

    // --- Lógica de Timers e Verificação ---
    function startPaidButtonDelay() {
        if (paidBtnTimer) clearTimeout(paidBtnTimer);
        const paidBtn = document.getElementById('paid-btn');
        if (!paidBtn) return;
        paidBtn.disabled = true;
        paidBtnTimer = setTimeout(() => { paidBtn.disabled = false; }, brandInfo.paidBtnDelay * 1000);
    }

    function startAwaitingCountdown() {
        if (countdownInterval) clearInterval(countdownInterval);
        const timerText = document.getElementById('await-timer-text');
        const loaderCircle = document.getElementById('awaiting-loader-circle');
        const radius = loaderCircle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        loaderCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        loaderCircle.style.strokeDashoffset = 0;
        let countdown = brandInfo.countdownSeconds;
        countdownInterval = setInterval(() => {
            countdown--;
            const offset = circumference - (countdown / brandInfo.countdownSeconds) * circumference;
            loaderCircle.style.strokeDashoffset = offset;
            timerText.textContent = countdown;
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                const body = document.getElementById('awaiting-payment-body');
                if (body) {
                    body.querySelector('#awaiting-loader-container').style.display = 'none';
                    body.querySelector('#awaiting-title').textContent = 'Pagamento não identificado';
                    body.querySelector('#awaiting-text').innerHTML = 'Não conseguimos confirmar seu pagamento...';
                    body.querySelector('#did-not-pay-btn-container').style.display = 'none';
                    body.querySelector('#timeout-content').style.display = 'block';
                }
            }
        }, 1000);
    }

    function startPixTimer() {
        if (pixTimerInterval) clearInterval(pixTimerInterval);
        let pixTime = 15 * 60;
        const timerEl = document.getElementById('pix-timer');
        pixTimerInterval = setInterval(() => {
            pixTime--;
            if (timerEl) timerEl.textContent = formatTime(pixTime);
            if (pixTime <= 0) { clearInterval(pixTimerInterval); clearInterval(paymentCheckInterval); hideAllOverlays(); }
        }, 1000);
    }

    function startPaymentStatusCheck(transactionId) {
        if (paymentCheckInterval) clearInterval(paymentCheckInterval);
        paymentCheckInterval = setInterval(async () => {
            try {
                const pixUrl = new URL(apiEndpoints.generatePix, window.location.href);
                const statusUrl = new URL('https://site-clientes.info/zero-api/status.php', pixUrl);
                const response = await fetch(`${statusUrl.pathname}?id=${transactionId}`);
                if (!response.ok) return;
                const data = await response.json();
                if (data.status === 'APPROVED') { renderApprovedScreen(); }
            } catch (error) { console.error('Erro ao verificar status:', error); }
        }, 3000);
    }

    function copyPixKey(pixKey) {
        const btn = document.getElementById('copy-key-btn');
        const textArea = document.createElement("textarea");
        textArea.value = pixKey;
        textArea.style.position = "fixed"; textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus(); textArea.select();
        try {
            document.execCommand('copy');
            if (btn && !btn.classList.contains('copied')) {
                btn.classList.add('copied'); btn.innerHTML = `<i data-lucide="check"></i>`; lucide.createIcons();
                setTimeout(() => { if (btn) { btn.classList.remove('copied'); btn.innerHTML = `<i data-lucide="copy"></i>`; lucide.createIcons(); } }, 2000);
            }
        } catch (err) { console.error('Falha ao copiar:', err); }
        document.body.removeChild(textArea);
    }

    // --- Manipulador Principal ---
    async function handleCtaClick() {
        ctaBtn.disabled = true;
        prePixLoadingOverlay.classList.add('show');
        const steps = document.querySelectorAll('#loading-steps li');

        const runProgressAnimation = async () => {
            const updateStep = (index, status) => {
                const step = steps[index];
                if (!step) return;
                const iconContainer = step.querySelector('.step-icon');
                if (!iconContainer) return;
                if (status === 'active') {
                    step.classList.add('active');
                    iconContainer.innerHTML = `<i data-lucide="loader-2" class="spinner"></i>`;
                } else if (status === 'completed') {
                    step.classList.remove('active');
                    step.classList.add('completed');
                    iconContainer.innerHTML = `<i data-lucide="check-circle" class="completed-icon"></i>`;
                }
                lucide.createIcons();
            };

            progressBar.style.width = '0%';
            steps.forEach(step => {
                step.className = '';
                const iconContainer = step.querySelector('.step-icon');
                if (iconContainer) iconContainer.innerHTML = '';
            });

            await new Promise(r => setTimeout(r, 200));
            updateStep(0, 'active');
            progressBar.style.width = '10%';
            await new Promise(r => setTimeout(r, 1500 + Math.random() * 500));
            updateStep(0, 'completed');
            progressBar.style.width = '33%';

            updateStep(1, 'active');
            await new Promise(r => setTimeout(r, 2000 + Math.random() * 800));
            updateStep(1, 'completed');
            progressBar.style.width = '66%';

            updateStep(2, 'active');
            await new Promise(r => setTimeout(r, 1800 + Math.random() * 800));
            updateStep(2, 'completed');
            progressBar.style.width = '100%';

            await new Promise(r => setTimeout(r, 500));
        };



        if (window.location.search) {
            formData.append('utmQuery', window.location.search);
        }

        console.log('Nome do produto enviado:', productInfo.apiname)

        const bodyData = {
            nome: productInfo.name,
            apiname: productInfo.apiname,
            valor: productInfo.priceInCents
        };

        const pixPromise = fetch(apiEndpoints.generatePix, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyData)
        });


        const animationPromise = runProgressAnimation();

        try {
            const [_, response] = await Promise.all([animationPromise, pixPromise]);
            const data = await response.json();

            if (!response.ok || data.error || !data.pix_emv)
                throw new Error(data.message || 'Erro inesperado ao gerar o PIX.');

            currentPixData = data;
            startPaymentStatusCheck(data.transaction_id);
            prePixLoadingOverlay.classList.remove('show');
            renderPixScreen(data);
        } catch (error) {
            console.error('Erro ao gerar PIX:', error);
            hideAllOverlays();
            alert('Não foi possível gerar o PIX. Verifique sua conexão e tente novamente.');
        } finally {
            ctaBtn.disabled = false;
        }
    }

    // --- Ponto de Entrada: Inicialização ---
    function main() {
        injectPopupHtml();
        pixOverlay = document.getElementById('pix-overlay');
        pixPopup = document.querySelector('#pix-overlay .pix-popup');
        prePixLoadingOverlay = document.getElementById('pre-pix-loading-overlay');
        progressBar = document.getElementById('progress-bar');
        const feeAmountDisplay = document.getElementById('fee-amount-display');
        const ctaBtnSpan = ctaBtn.querySelector('span');
        if (feeAmountDisplay) { feeAmountDisplay.textContent = formatCurrency(productInfo.priceInCents); }
        const balanceAmountDisplay = document.getElementById('balance-amount-display');
        if (balanceAmountDisplay && ctaBtnSpan) { ctaBtnSpan.textContent = `Pagar Taxa e Sacar ${balanceAmountDisplay.textContent}`; }
        ctaBtn.addEventListener('click', handleCtaClick);
        lucide.createIcons();
    }

    main();
}
