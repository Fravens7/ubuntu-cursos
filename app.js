/* ═══════════════════════════════════════════════
   UBUNTU PERÚ x SIEMENS — APP LOGIC & DUMMY DATA
   ═══════════════════════════════════════════════ */

// ── NAVIGATION & UI STATE ──

function setActivePage(pageName) {
    // Update Sidebar Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });

    // Toggle Pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('active', page.id === `page-${pageName}`);
    });

    // Scroll top
    document.querySelector('.content-area').scrollTop = 0;

    // Specific logic per page
    if (pageName === 'dashboard') {
        initDashboardCharts();
    } else if (pageName === 'curso-live') {
        startLiveChatSimulation();
    } else {
        stopLiveChatSimulation();
    }

    closeSidebar();
}

// Event Listeners for Nav
document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        setActivePage(link.dataset.page);
    });
});

// Mobile Sidebar
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');
const menuBtn = document.getElementById('mobileMenuBtn');

function openSidebar() {
    sidebar.classList.add('open');
    overlay.style.display = 'block';
}

function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.style.display = 'none';
}

menuBtn.addEventListener('click', openSidebar);
overlay.addEventListener('click', closeSidebar);


// ── DASHBOARD (GOBERNANZA) - CHART.JS LOGIC ──
let chartsInitialized = false;
const siemensTeal = '#009999';
const ubuntuGreen = '#2D7A4F';
const ubuntuOrange = '#D4842A';
const ubuntuMaroon = '#6B2D3E';

function initDashboardCharts() {
    if (chartsInitialized) return;
    
    // 1. Chart: Retención y Finalización (Bar Chart)
    const ctxRetention = document.getElementById('retentionChart').getContext('2d');
    new Chart(ctxRetention, {
        type: 'bar',
        data: {
            labels: ['Alfabetización Digital', 'Liderazgo', 'Pre Beca 18', 'Derechos Humanos', 'Inclusión Financiera'],
            datasets: [
                {
                    label: 'Tasa de Retención (%)',
                    data: [92, 85, 95, 78, 88],
                    backgroundColor: siemensTeal,
                    borderRadius: 4
                },
                {
                    label: 'Tasa de Finalización (%)',
                    data: [85, 75, 90, 65, 80],
                    backgroundColor: ubuntuGreen,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });

    // 2. Chart: Competencias Pre vs Post (Radar Chart)
    const ctxCompetency = document.getElementById('competencyChart').getContext('2d');
    new Chart(ctxCompetency, {
        type: 'radar',
        data: {
            labels: ['Tecnológicas', 'Blandas', 'Lógico-Matemáticas', 'Comunicación', 'Liderazgo'],
            datasets: [
                {
                    label: 'Pre-Test',
                    data: [35, 50, 40, 45, 60],
                    backgroundColor: 'rgba(107, 45, 62, 0.2)', // Maroon transparent
                    borderColor: ubuntuMaroon,
                    pointBackgroundColor: ubuntuMaroon
                },
                {
                    label: 'Post-Test (Logro)',
                    data: [85, 90, 80, 88, 95],
                    backgroundColor: 'rgba(0, 153, 153, 0.3)', // Teal transparent
                    borderColor: siemensTeal,
                    pointBackgroundColor: siemensTeal
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { r: { min: 0, max: 100 } }
        }
    });

    // 3. Chart: Impacto LATAM (Doughnut Chart for users distribution)
    const ctxLatam = document.getElementById('latamChart').getContext('2d');
    new Chart(ctxLatam, {
        type: 'doughnut',
        data: {
            labels: ['Perú', 'Colombia', 'Ecuador', 'Bolivia', 'Chile'],
            datasets: [{
                data: [850, 245, 153, 85, 45],
                backgroundColor: [
                    siemensTeal,
                    ubuntuGreen,
                    ubuntuOrange,
                    ubuntuMaroon,
                    '#E8A838' // Yellow
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right' }
            }
        }
    });

    chartsInitialized = true;
}


// ── LIVE CLASS SIMULATION (CHAT) ──
let chatInterval;
const dummyNames = ["Ana", "Luis", "María", "Jorge", "Carla", "Pedro", "Lucía", "Diego"];
const dummyMessages = [
    "¡Excelente explicación profesor!",
    "¿Podría repetir la parte de la fórmula cuadrática?",
    "Entendido, gracias.",
    "Tengo una duda con el ejercicio 3.",
    "Todo claro hasta ahora.",
    "Saludos desde Arequipa 👋",
    "¿Esta clase quedará grabada?",
    "Yo usé esa fórmula en un proyecto de física."
];

function startLiveChatSimulation() {
    const chatContainer = document.getElementById('chatMessages');
    
    // Clear and add initial message
    chatContainer.innerHTML = `
        <div class="chat-msg system">
            <span class="chat-text">Bienvenido al programa Pre Beca 18. La clase está siendo grabada.</span>
        </div>
    `;

    // Simulate incoming messages every 3-6 seconds
    chatInterval = setInterval(() => {
        const randomName = dummyNames[Math.floor(Math.random() * dummyNames.length)];
        const randomMsg = dummyMessages[Math.floor(Math.random() * dummyMessages.length)];
        const initials = randomName.substring(0, 2).toUpperCase();
        
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const msgHTML = `
            <div class="chat-msg">
                <div class="chat-avatar">${initials}</div>
                <div class="chat-content">
                    <div class="chat-user">${randomName} <span class="chat-time">${timeStr}</span></div>
                    <div class="chat-text">${randomMsg}</div>
                </div>
            </div>
        `;
        
        chatContainer.insertAdjacentHTML('beforeend', msgHTML);
        
        // Auto-scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;

    }, Math.random() * 3000 + 3000);
}

function stopLiveChatSimulation() {
    clearInterval(chatInterval);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    // Optionally trigger animations or setup dummy courses for "Mis Cursos"
    // Since this is a UI prototype focused on the new views, we leave the basic navigation working.
});
