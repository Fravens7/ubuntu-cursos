/* ═══════════════════════════════════════════════
   UBUNTU PERÚ x SIEMENS — APP LOGIC v2
   Fully populated dummy data, live simulations,
   Chart.js dashboards, course rendering.
   ═══════════════════════════════════════════════ */

// ── COLORS ──
const C = {
    teal: '#009999',
    tealLight: 'rgba(0,153,153,0.15)',
    green: '#2D7A4F',
    greenLight: 'rgba(45,122,79,0.15)',
    orange: '#D4842A',
    orangeLight: 'rgba(212,132,42,0.15)',
    maroon: '#6B2D3E',
    maroonLight: 'rgba(107,45,62,0.15)',
    yellow: '#E8A838',
    slate: '#1E2225',
};

// ── MOCK DATA: ALL COURSES ──
const allCourses = [
    {
        id: 1, title: "Alfabetización Digital 4.0", category: "tecnologia", categoryLabel: "Tecnología",
        instructor: "Prof. Roberto Flores", rating: 4.8, reviews: 1342, popular: true, enrolled: true, progress: 40, lessons: "2/5 módulos",
        image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80",
        tagClass: "tag-siemens"
    },
    {
        id: 2, title: "Liderazgo Comunitario y Gestión Social", category: "liderazgo", categoryLabel: "Liderazgo",
        instructor: "Ana Quispe", rating: 4.9, reviews: 892, popular: true, enrolled: true, progress: 65, lessons: "8/12 lecciones",
        image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=600&q=80",
        tagClass: "tag-green"
    },
    {
        id: 3, title: "Derechos Humanos: Fundamentos y Práctica", category: "derechos", categoryLabel: "Derechos Humanos",
        instructor: "Carlos Mamani", rating: 4.8, reviews: 458, popular: false, enrolled: true, progress: 100, lessons: "15/15 lecciones",
        image: "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=600&q=80",
        tagClass: "tag-maroon"
    },
    {
        id: 4, title: "Inclusión Financiera para Comunidades", category: "finanzas", categoryLabel: "Finanzas",
        instructor: "Dr. Patricia Suárez", rating: 4.7, reviews: 341, popular: false, enrolled: true, progress: 15, lessons: "2/14 lecciones",
        image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=80",
        tagClass: "tag-orange"
    },
    {
        id: 5, title: "Arte y Cultura Afroperuana", category: "arte", categoryLabel: "Arte y Cultura",
        instructor: "Lucía Mendoza", rating: 4.9, reviews: 267, popular: true, enrolled: false, progress: 0, lessons: "0/10",
        image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80",
        tagClass: "tag-orange"
    },
    {
        id: 6, title: "Salud Mental y Bienestar Comunitario", category: "salud", categoryLabel: "Salud",
        instructor: "Dra. María Torres", rating: 4.8, reviews: 512, popular: true, enrolled: false, progress: 0, lessons: "0/12",
        image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=600&q=80",
        tagClass: "tag-green"
    },
    {
        id: 7, title: "Emprendimiento Social con IA", category: "tecnologia", categoryLabel: "Tecnología",
        instructor: "Jorge Chávez", rating: 4.7, reviews: 203, popular: false, enrolled: false, progress: 0, lessons: "0/11",
        image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=600&q=80",
        tagClass: "tag-siemens"
    },
    {
        id: 8, title: "Derechos de la Mujer en el Perú", category: "derechos", categoryLabel: "Derechos Humanos",
        instructor: "Dra. Rosa Palacios", rating: 4.9, reviews: 387, popular: true, enrolled: false, progress: 0, lessons: "0/13",
        image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=600&q=80",
        tagClass: "tag-maroon"
    },
    {
        id: 9, title: "Comunicación No Violenta", category: "liderazgo", categoryLabel: "Liderazgo",
        instructor: "Pedro García", rating: 4.6, reviews: 156, popular: false, enrolled: false, progress: 0, lessons: "0/8",
        image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=600&q=80",
        tagClass: "tag-green"
    },
];

// ── RENDER HELPERS ──
function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    let s = '';
    for (let i = 0; i < full; i++) s += '<i class="fa-solid fa-star"></i>';
    if (half) s += '<i class="fa-solid fa-star-half-stroke"></i>';
    return s;
}

function createCourseCard(c) {
    return `
        <div class="course-card" data-category="${c.category}">
            <div class="course-img">
                <img src="${c.image}" alt="${c.title}" loading="lazy">
                ${c.popular ? '<span class="course-badge">Popular</span>' : ''}
                <span class="course-free-badge"><i class="fa-solid fa-gift" style="margin-right:3px;"></i>Gratis</span>
            </div>
            <div class="course-body">
                <span class="course-category">${c.categoryLabel}</span>
                <h3 class="course-title">${c.title}</h3>
                <p class="course-instructor"><i class="fa-solid fa-chalkboard-user"></i> ${c.instructor}</p>
                <div class="course-rating">
                    <span class="stars">${renderStars(c.rating)}</span>
                    <span class="rating-num">${c.rating}</span>
                    <span class="rating-count">(${c.reviews.toLocaleString()})</span>
                </div>
                <div class="course-footer">
                    <span class="course-price">100% Gratuito</span>
                    <button class="course-enroll">${c.enrolled ? 'Continuar' : 'Inscribirme'} →</button>
                </div>
            </div>
        </div>`;
}

function createMyCourseItem(c) {
    const done = c.progress === 100;
    return `
        <div class="my-course-item">
            <div class="my-course-thumb"><img src="${c.image}" alt="${c.title}" loading="lazy"></div>
            <div class="my-course-info">
                <span class="tag ${c.tagClass}">${c.categoryLabel}</span>
                <h3>${c.title}</h3>
                <p>${c.instructor} · ${c.lessons}</p>
                <div class="progress-info">
                    <span class="progress-text">${done ? 'Completado ✓' : 'Progreso: ' + c.progress + '%'}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${c.progress}%;${done ? 'background:var(--ubuntu-green);' : ''}"></div>
                </div>
            </div>
            <div class="my-course-actions">
                <button class="btn ${done ? 'btn-outline' : 'btn-primary'} btn-sm">
                    <i class="fa-solid fa-${done ? 'eye' : 'play'}"></i> ${done ? 'Revisar' : 'Continuar'}
                </button>
            </div>
        </div>`;
}


// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
function setActivePage(pageName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });
    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('active', page.id === `page-${pageName}`);
    });
    document.querySelector('.content-area').scrollTop = 0;

    if (pageName === 'dashboard') initDashboardCharts();
    if (pageName === 'curso-live') startLiveChatSimulation();
    else stopLiveChatSimulation();
    if (pageName === 'progreso') initWeeklyChart();

    closeSidebar();
}

document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        setActivePage(link.dataset.page);
    });
});

// Sidebar mobile
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');
const menuBtn = document.getElementById('mobileMenuBtn');
function openSidebar() { sidebar.classList.add('open'); overlay.classList.add('active'); }
function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('active'); }
menuBtn.addEventListener('click', openSidebar);
overlay.addEventListener('click', closeSidebar);


// ═══════════════════════════════════════════════
// INIT PAGES WITH DUMMY DATA
// ═══════════════════════════════════════════════
function initAllPages() {
    // Home — 3 recommended non-enrolled
    const homeGrid = document.getElementById('homeCoursesGrid');
    if (homeGrid) homeGrid.innerHTML = allCourses.filter(c => !c.enrolled).slice(0, 3).map(createCourseCard).join('');

    // My Courses — enrolled
    const myCourses = document.getElementById('myCoursesContainer');
    if (myCourses) myCourses.innerHTML = allCourses.filter(c => c.enrolled).map(createMyCourseItem).join('');

    // Explorar — all + filters
    initExplorar();

    // Stat counters animation
    animateCounters();
}

function initExplorar() {
    const container = document.getElementById('explorarContainer');
    const filterBar = document.getElementById('filterBar');
    if (!container || !filterBar) return;

    // Build filter chips
    const categories = ['todos', ...new Set(allCourses.map(c => c.category))];
    const labels = { todos: 'Todos', tecnologia: 'Tecnología', liderazgo: 'Liderazgo', derechos: 'Derechos Humanos', finanzas: 'Finanzas', arte: 'Arte y Cultura', salud: 'Salud' };
    filterBar.innerHTML = categories.map((cat, i) =>
        `<button class="filter-chip ${i === 0 ? 'active' : ''}" data-filter="${cat}">${labels[cat] || cat}</button>`
    ).join('');

    // Render all
    container.innerHTML = allCourses.map(createCourseCard).join('');

    // Filter click
    filterBar.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            filterBar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const f = chip.dataset.filter;
            const filtered = f === 'todos' ? allCourses : allCourses.filter(c => c.category === f);
            container.innerHTML = filtered.map(createCourseCard).join('');
            // Stagger animation
            container.querySelectorAll('.course-card').forEach((card, i) => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(12px)';
                setTimeout(() => { card.style.transition = 'all 0.3s ease'; card.style.opacity = '1'; card.style.transform = 'translateY(0)'; }, i * 60);
            });
        });
    });
}


// ═══════════════════════════════════════════════
// STAT COUNTER ANIMATION
// ═══════════════════════════════════════════════
function animateCounters() {
    document.querySelectorAll('.stat-number').forEach(el => {
        const target = parseInt(el.dataset.target);
        const duration = 1500;
        const start = performance.now();
        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - (1 - progress) * (1 - progress);
            el.textContent = Math.round(target * ease).toLocaleString();
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    });
}


// ═══════════════════════════════════════════════
// DASHBOARD CHARTS (Chart.js)
// ═══════════════════════════════════════════════
let chartsInit = false;

function initDashboardCharts() {
    if (chartsInit) return;
    chartsInit = true;

    Chart.defaults.font.family = 'Inter';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#5a6b7c';

    // 1. Retention & Completion (Bar)
    new Chart(document.getElementById('retentionChart'), {
        type: 'bar',
        data: {
            labels: ['Alfab. Digital', 'Liderazgo', 'Pre Beca 18', 'DD.HH.', 'Incl. Financiera', 'Salud Mental'],
            datasets: [
                { label: 'Retención (%)', data: [92, 85, 95, 88, 82, 90], backgroundColor: C.teal, borderRadius: 4 },
                { label: 'Finalización (%)', data: [85, 75, 90, 80, 68, 78], backgroundColor: C.green, borderRadius: 4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } }, scales: { y: { beginAtZero: true, max: 100 } } }
    });

    // 2. Competencies Radar
    new Chart(document.getElementById('competencyChart'), {
        type: 'radar',
        data: {
            labels: ['Tecnológicas', 'Blandas', 'Lógico-Mat.', 'Comunicación', 'Liderazgo', 'Financieras'],
            datasets: [
                { label: 'Pre-Test', data: [35, 50, 40, 45, 55, 30], backgroundColor: C.maroonLight, borderColor: C.maroon, pointBackgroundColor: C.maroon, borderWidth: 2 },
                { label: 'Post-Test', data: [82, 88, 78, 85, 92, 75], backgroundColor: C.tealLight, borderColor: C.teal, pointBackgroundColor: C.teal, borderWidth: 2 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100, ticks: { stepSize: 20 } } }, plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } } }
    });

    // 3. Enrollment Trend (Line)
    new Chart(document.getElementById('enrollmentTrendChart'), {
        type: 'line',
        data: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'],
            datasets: [
                { label: 'Inscripciones', data: [320, 485, 610, 750, 920, 1100, 1248], borderColor: C.teal, backgroundColor: C.tealLight, fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: C.teal },
                { label: 'Completaron curso', data: [45, 120, 210, 340, 510, 720, 892], borderColor: C.green, backgroundColor: C.greenLight, fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: C.green }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } }, scales: { y: { beginAtZero: true } } }
    });

    // 4. LATAM Distribution (Doughnut)
    new Chart(document.getElementById('latamChart'), {
        type: 'doughnut',
        data: {
            labels: ['🇵🇪 Perú', '🇨🇴 Colombia', '🇪🇨 Ecuador', '🇧🇴 Bolivia', '🇨🇱 Chile'],
            datasets: [{ data: [850, 245, 153, 85, 45], backgroundColor: [C.teal, C.green, C.orange, C.maroon, C.yellow], borderWidth: 0, hoverOffset: 8 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { boxWidth: 14, padding: 16 } } } }
    });
}


// ═══════════════════════════════════════════════
// PROGRESS PAGE — Weekly Hours Chart
// ═══════════════════════════════════════════════
let weeklyChartInit = false;
function initWeeklyChart() {
    if (weeklyChartInit) return;
    weeklyChartInit = true;
    const ctx = document.getElementById('weeklyHoursChart');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
            datasets: [{ label: 'Horas de estudio', data: [1.5, 2, 1, 2.5, 1.8, 3, 0], backgroundColor: C.teal, borderRadius: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, max: 4, ticks: { callback: v => v + 'h' } } }
        }
    });
}


// ═══════════════════════════════════════════════
// LIVE CLASS CHAT SIMULATION
// ═══════════════════════════════════════════════
let chatInterval = null;
let liveTimerInterval = null;
let liveSeconds = 4530; // Start at ~1h15m

const chatUsers = [
    { name: "Ana R.", initials: "AR", color: C.teal },
    { name: "Luis M.", initials: "LM", color: C.green },
    { name: "María C.", initials: "MC", color: C.orange },
    { name: "Jorge P.", initials: "JP", color: C.maroon },
    { name: "Carla S.", initials: "CS", color: "#7c3aed" },
    { name: "Pedro G.", initials: "PG", color: C.slate },
    { name: "Lucía V.", initials: "LV", color: "#e11d48" },
    { name: "Diego T.", initials: "DT", color: "#0284c7" },
    { name: "Rosa H.", initials: "RH", color: C.yellow },
    { name: "Sofía A.", initials: "SA", color: "#059669" },
];

const chatMessages = [
    "¡Excelente explicación profesora! 👏",
    "¿Podría repetir la parte de la fórmula cuadrática?",
    "Todo claro hasta ahora, gracias.",
    "Tengo una duda con el ejercicio 3.",
    "Saludos desde Arequipa 🇵🇪",
    "¿Esta clase queda grabada?",
    "Yo usé esa fórmula en un proyecto de física",
    "Muy buena clase, como siempre 🙌",
    "Conectándome desde Bogotá 🇨🇴",
    "¿El examen es la próxima semana?",
    "Profe, ¿puede poner otro ejemplo por favor?",
    "Primera vez que entiendo esto jaja",
    "Saludos desde Lima 💪",
    "¿Podemos tener los slides después?",
    "Excelente programa Pre Beca 18 🎓",
    "Me encanta esta plataforma",
    "¿A qué hora es la siguiente sesión?",
    "Conectándome desde Quito 🇪🇨",
    "Gracias por la beca, esto cambia vidas ❤️",
    "¿Alguien formó grupo de estudio?",
];

function startLiveChatSimulation() {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    // Seed initial messages
    container.innerHTML = '';
    const seedMessages = [
        { system: true, text: "Bienvenido al programa Pre Beca 18. La clase está siendo grabada." },
        { user: chatUsers[0], text: "¡Hola a todos! Lista para la clase 📚" },
        { user: chatUsers[3], text: "Buenos días desde Cusco" },
        { user: chatUsers[1], text: "¿Hoy vemos ecuaciones cuadráticas verdad?" },
        { system: true, text: "Prof. Ana Ramírez se ha unido como presentadora." },
        { user: chatUsers[4], text: "Si, el módulo 3 del programa Pre Beca 18 🙌" },
        { user: chatUsers[7], text: "Conectándome desde Medellín 🇨🇴" },
        { user: chatUsers[2], text: "¡Excelente! Gracias profesora por empezar puntual" },
    ];

    seedMessages.forEach(m => {
        if (m.system) {
            container.innerHTML += `<div class="chat-msg system"><span class="chat-text">${m.text}</span></div>`;
        } else {
            container.innerHTML += buildChatMsg(m.user, m.text, formatTime(new Date(Date.now() - Math.random() * 3600000)));
        }
    });
    container.scrollTop = container.scrollHeight;

    // Stream new messages
    chatInterval = setInterval(() => {
        const user = chatUsers[Math.floor(Math.random() * chatUsers.length)];
        const msg = chatMessages[Math.floor(Math.random() * chatMessages.length)];
        container.insertAdjacentHTML('beforeend', buildChatMsg(user, msg, formatTime(new Date())));
        container.scrollTop = container.scrollHeight;
    }, 2500 + Math.random() * 3000);

    // Timer
    liveTimerInterval = setInterval(() => {
        liveSeconds++;
        const h = Math.floor(liveSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((liveSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (liveSeconds % 60).toString().padStart(2, '0');
        const timerEl = document.getElementById('liveTimer');
        if (timerEl) timerEl.textContent = `${h}:${m}:${s}`;
    }, 1000);

    // Viewer count fluctuation
    let viewers = 1245;
    setInterval(() => {
        viewers += Math.floor(Math.random() * 7) - 2;
        const el = document.getElementById('liveViewerCount');
        if (el) el.textContent = viewers.toLocaleString();
    }, 5000);
}

function stopLiveChatSimulation() {
    clearInterval(chatInterval);
    clearInterval(liveTimerInterval);
    chatInterval = null;
    liveTimerInterval = null;
}

function buildChatMsg(user, text, time) {
    return `<div class="chat-msg">
        <div class="chat-avatar" style="background:${user.color};">${user.initials}</div>
        <div class="chat-content">
            <div class="chat-user">${user.name} <span class="chat-time">${time}</span></div>
            <div class="chat-text">${text}</div>
        </div>
    </div>`;
}

function formatTime(d) {
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

// Chat send button
document.getElementById('chatSendBtn')?.addEventListener('click', sendChatMessage);
document.getElementById('chatInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatMessage(); });

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const container = document.getElementById('chatMessages');
    if (!input || !container || !input.value.trim()) return;
    const me = { name: "Tú", initials: "CA", color: C.teal };
    container.insertAdjacentHTML('beforeend', buildChatMsg(me, input.value.trim(), formatTime(new Date())));
    input.value = '';
    container.scrollTop = container.scrollHeight;
}


// ═══════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        if (q.length > 1) {
            setActivePage('explorar');
            // Reset filters
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            document.querySelector('.filter-chip[data-filter="todos"]')?.classList.add('active');
            const container = document.getElementById('explorarContainer');
            const filtered = allCourses.filter(c =>
                c.title.toLowerCase().includes(q) || c.categoryLabel.toLowerCase().includes(q) || c.instructor.toLowerCase().includes(q)
            );
            container.innerHTML = filtered.length > 0
                ? filtered.map(createCourseCard).join('')
                : '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:60px 20px;font-size:1rem;">No se encontraron cursos para "<strong>' + q + '</strong>"</p>';
        }
    });
}


// ═══════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════
document.getElementById('notifBtn')?.addEventListener('click', function() {
    const badge = this.querySelector('.badge');
    if (badge) { badge.style.transform = 'scale(0)'; badge.style.transition = '0.2s ease'; setTimeout(() => badge.remove(), 200); }
    alert('🔔 Notificaciones:\n\n• Pre Beca 18: Clase en vivo en 30 min\n• Tu certificado de DD.HH. está listo\n• Nuevo curso: Emprendimiento Social con IA');
});


// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', initAllPages);
