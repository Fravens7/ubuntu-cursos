/* ═══════════════════════════════════════════════
   UBUNTU PERÚ x SIEMENS — APP LOGIC v2
   ═══════════════════════════════════════════════ */

const C = {
    teal: '#009999', tealLight: 'rgba(0,153,153,0.15)',
    green: '#2D7A4F', greenLight: 'rgba(45,122,79,0.15)',
    orange: '#D4842A', orangeLight: 'rgba(212,132,42,0.15)',
    maroon: '#6B2D3E', maroonLight: 'rgba(107,45,62,0.15)',
    yellow: '#E8A838', slate: '#1E2225',
};

let allCourses = [];
let allLiveClasses = [];

// 1. CARGA DESDE LA API (Corregido a la URL real)
async function cargarCursosDesdeAPI() {
    const API_URL = 'https://api.ubuntuafroperuana.org';
    const categoryLabels = { 'tecnologia': 'Tecnología', 'liderazgo': 'Liderazgo', 'derechos': 'Derechos Humanos', 'finanzas': 'Finanzas', 'salud': 'Salud', 'arte': 'Arte y Cultura' };
    const tagClasses = { 'tecnologia': 'tag-siemens', 'liderazgo': 'tag-green', 'derechos': 'tag-orange', 'finanzas': 'tag-maroon', 'salud': 'tag-green', 'arte': 'tag-orange' };

    try {
        const [coursesRes, liveRes] = await Promise.all([
            fetch(`${API_URL}/api/courses`),
            fetch(`${API_URL}/api/live-classes`).catch(() => ({ json: () => [] })) // Previene caída si falla el endpoint live
        ]);
        
        const dbCourses = await coursesRes.json();
        allLiveClasses = liveRes.ok ? await liveRes.json() : [];

        allCourses = dbCourses.map(c => {
            const isGeminiCourse = c.title.toLowerCase().includes('gemini');
            return {
                id: c.id,
                title: c.title,
                category: c.category,
                categoryLabel: categoryLabels[c.category] || c.category,
                instructor: c.instructor,
                image: c.image_url,
                rating: 4.8, reviews: 342, popular: true,
                enrolled: isGeminiCourse,
                progress: isGeminiCourse ? 20 : 0,
                lessons: `${(c.modules || []).length} módulos`,
                tagClass: tagClasses[c.category] || 'tag-siemens',
                rawModules: c.modules || [] // Guardamos los módulos reales para usarlos al hacer clic
            };
        });

        if (allCourses.length === 0) return mostrarMensajeVacio();
        
        actualizarEstadisticasDinamicas(dbCourses.length);
        initAllPages();
        renderizarClasesEnVivo();

    } catch (error) {
        console.error("Error al conectar:", error);
        mostrarMensajeError();
    }
}

// 2. LA MAGIA DEL CLIC: ABRIR EL CURSO
// 2. LA MAGIA DEL CLIC: ABRIR EL CURSO (Actualizado)
function abrirCurso(id) {
    const curso = allCourses.find(c => c.id === id);
    if (!curso) return;

    const pageAsync = document.getElementById('page-curso-async');
    
    // Cambiar Título e Instructor del encabezado principal
    pageAsync.querySelector('.page-title').textContent = curso.title;
    pageAsync.querySelector('.page-subtitle').textContent = `Impartido por ${curso.instructor} · ${curso.rawModules.length} módulos`;
    pageAsync.querySelector('.tag').textContent = curso.categoryLabel;
    pageAsync.querySelector('.tag').className = `tag ${curso.tagClass}`;

    const syllabusList = pageAsync.querySelector('.syllabus-list');
    const iframe = pageAsync.querySelector('.video-player-wrapper iframe');
    const videoTitle = pageAsync.querySelector('.video-info-main h2');
    const videoDesc = pageAsync.querySelector('.video-info-main p');
    const metaInstructor = pageAsync.querySelector('.video-meta-row .meta-item');
    
    if (curso.rawModules.length === 0) {
        syllabusList.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);">
            <i class="fa-solid fa-person-digging" style="font-size:2rem;margin-bottom:10px;"></i>
            <p>El instructor aún está construyendo los módulos.</p>
        </div>`;
        iframe.src = "";
        videoTitle.textContent = "Curso en construcción";
        videoDesc.textContent = "Pronto se agregarán las lecciones aquí.";
    } else {
        // Renderizar el temario (Módulos y Lecciones) y hacer las lecciones clickeables
        syllabusList.innerHTML = curso.rawModules.map((mod, index) => {
            const leccionesHTML = (mod.lessons || []).map((lesson) => {
                // Escapamos comillas por seguridad para el onclick
                const safeTitle = lesson.title.replace(/'/g, "\\'");
                const safeInst = curso.instructor.replace(/'/g, "\\'");
                return `
                <div style="padding: 10px 10px 10px 24px; font-size: 0.85rem; margin-top: 4px; cursor: pointer; color: var(--text-secondary); transition: 0.2s;" 
                     onmouseover="this.style.color='var(--siemens-teal)'" 
                     onmouseout="this.style.color='var(--text-secondary)'"
                     onclick="cambiarVideo('${lesson.youtube_id}', '${safeTitle}', '${safeInst}')">
                    <i class="fa-brands fa-youtube" style="color: #ef4444; margin-right: 4px;"></i> ${lesson.title}
                </div>`;
            }).join('');

            return `
            <div class="syllabus-item active" style="flex-direction: column; align-items: flex-start;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-folder-open item-icon" style="color: var(--siemens-teal);"></i>
                    <h4 style="margin:0; font-size: 0.9rem;">${index + 1}. ${mod.title}</h4>
                </div>
                <div style="width: 100%;">
                    ${leccionesHTML}
                </div>
            </div>`;
        }).join('');

        // ¡EL ARREGLO!: Cargar automáticamente la primera lección del primer módulo
        if (curso.rawModules[0].lessons && curso.rawModules[0].lessons.length > 0) {
            const primeraLeccion = curso.rawModules[0].lessons[0];
            cambiarVideo(primeraLeccion.youtube_id, primeraLeccion.title, curso.instructor);
        } else {
            videoTitle.textContent = "Sin lecciones";
            videoDesc.textContent = "Este módulo no tiene videos agregados.";
            iframe.src = "";
        }
    }

    setActivePage('curso-async');
}

// 2.1 Nueva función para actualizar el reproductor al hacer clic
window.cambiarVideo = function(youtubeId, tituloLeccion, instructor) {
    const pageAsync = document.getElementById('page-curso-async');
    const iframe = pageAsync.querySelector('.video-player-wrapper iframe');
    const videoTitle = pageAsync.querySelector('.video-info-main h2');
    const videoDesc = pageAsync.querySelector('.video-info-main p');
    const metaInstructor = pageAsync.querySelector('.video-meta-row .meta-item'); // Selecciona el primer badge de metadata

    // Inyecta el ID real de YouTube y limpia el "quemado"
    iframe.src = `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&autoplay=1`;
    
    // Actualiza los textos debajo del video
    videoTitle.textContent = tituloLeccion;
    videoDesc.textContent = "Disfruta de esta lección. Recuerda tomar notas y participar en la comunidad de Ubuntu Perú.";
    metaInstructor.innerHTML = `<i class="fa-solid fa-chalkboard-user"></i> ${instructor}`;
};

// 3. TARJETAS MODIFICADAS CON EVENTO ONCLICK
function createCourseCard(c) {
    return `
        <div class="course-card" onclick="abrirCurso(${c.id})">
            <div class="course-img">
                <img src="${c.image}" alt="${c.title}" onerror="this.src='https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80'">
                <span class="course-free-badge"><i class="fa-solid fa-gift"></i> Gratis</span>
            </div>
            <div class="course-body">
                <span class="course-category">${c.categoryLabel}</span>
                <h3 class="course-title">${c.title}</h3>
                <p class="course-instructor"><i class="fa-solid fa-chalkboard-user"></i> ${c.instructor}</p>
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
        <div class="my-course-item" onclick="abrirCurso(${c.id})" style="cursor:pointer;">
            <div class="my-course-thumb"><img src="${c.image}" onerror="this.src='https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80'"></div>
            <div class="my-course-info">
                <span class="tag ${c.tagClass}">${c.categoryLabel}</span>
                <h3>${c.title}</h3>
                <p>${c.instructor} · ${c.lessons}</p>
                <div class="progress-bar"><div class="progress-fill" style="width:${c.progress}%;"></div></div>
            </div>
        </div>`;
}

// 4. EL RESTO DE FUNCIONES (Sin cambios, solo copiadas)
function actualizarEstadisticasDinamicas(total) {
    document.querySelectorAll('.stat-number').forEach(s => { if(s.dataset.target === "24") s.dataset.target = total; });
}

function renderizarClasesEnVivo() {
    const c = document.querySelector('.events-row');
    if (!c || allLiveClasses.length === 0) return;
    const m = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    c.innerHTML = allLiveClasses.map((clase, i) => {
        const d = new Date(clase.scheduled_at || new Date());
        return `<div class="event-card" onclick="window.open('${clase.zoom_link}', '_blank')">
            <div class="event-date"><span class="event-day">${d.getDate()}</span><span class="event-month">${m[d.getMonth()]}</span></div>
            <div class="event-info"><h4 class="event-title">${clase.title}</h4><p class="event-meta">Zoom</p></div>
        </div>`;
    }).join('');
}

function mostrarMensajeVacio() {
    const msg = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;"><i class="fa-solid fa-book-open" style="font-size:3rem;color:#95a5a6;margin-bottom:16px;"></i><p>No hay cursos</p></div>`;
    if(document.getElementById('homeCoursesGrid')) document.getElementById('homeCoursesGrid').innerHTML = msg;
    if(document.getElementById('explorarContainer')) document.getElementById('explorarContainer').innerHTML = msg;
}

function mostrarMensajeError() {
    const msg = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;"><i class="fa-solid fa-wifi" style="font-size:3rem;color:#95a5a6;margin-bottom:16px;"></i><p>Error de conexión</p></div>`;
    if(document.getElementById('homeCoursesGrid')) document.getElementById('homeCoursesGrid').innerHTML = msg;
}

function setActivePage(pageName) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.page === pageName));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${pageName}`));
    document.querySelector('.content-area').scrollTop = 0;
    if (pageName === 'dashboard') initDashboardCharts();
    if (pageName === 'progreso') initWeeklyChart();
    closeSidebar();
}

document.querySelectorAll('[data-page]').forEach(l => {
    l.addEventListener('click', e => { e.preventDefault(); setActivePage(l.dataset.page); });
});

const sidebar = document.getElementById('sidebar'), overlay = document.getElementById('sidebarOverlay');
document.getElementById('mobileMenuBtn').addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('active'); });
overlay.addEventListener('click', closeSidebar);
function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('active'); }

function initAllPages() {
    if(document.getElementById('homeCoursesGrid')) document.getElementById('homeCoursesGrid').innerHTML = allCourses.filter(c => !c.enrolled).slice(0, 3).map(createCourseCard).join('');
    if(document.getElementById('myCoursesContainer')) document.getElementById('myCoursesContainer').innerHTML = allCourses.filter(c => c.enrolled).map(createMyCourseItem).join('');
    initExplorar(); animateCounters();
}

function initExplorar() {
    const cont = document.getElementById('explorarContainer'), fb = document.getElementById('filterBar');
    if (!cont || !fb) return;
    cont.innerHTML = allCourses.map(createCourseCard).join('');
}

function animateCounters() {
    document.querySelectorAll('.stat-number').forEach(el => {
        const target = parseInt(el.dataset.target), start = performance.now();
        function update(now) {
            const p = Math.min((now - start) / 1500, 1);
            el.textContent = Math.round(target * (1 - (1 - p) * (1 - p))).toLocaleString();
            if (p < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    });
}

function initDashboardCharts() {} // Mantenlo vacío si no usas los gráficos por ahora
function initWeeklyChart() {}

document.addEventListener('DOMContentLoaded', cargarCursosDesdeAPI);
