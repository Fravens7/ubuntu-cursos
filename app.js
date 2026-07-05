/* ═══════════════════════════════════════════════
   UBUNTU PERÚ — APP LOGIC
   ═══════════════════════════════════════════════ */

// ── Mock Data ──
const allCourses = [
    {
        id: 1,
        title: "Liderazgo Comunitario y Gestión Social",
        category: "liderazgo",
        categoryLabel: "Liderazgo",
        instructor: "Ana Quispe",
        rating: 4.9,
        reviews: 312,
        image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80",
        popular: true,
        enrolled: true,
        progress: 65,
        lessons: "8/12",
        tagClass: "tag-green"
    },
    {
        id: 2,
        title: "Derechos Humanos: Fundamentos y Práctica",
        category: "derechos",
        categoryLabel: "Derechos Humanos",
        instructor: "Carlos Mamani",
        rating: 4.8,
        reviews: 458,
        image: "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=600&q=80",
        popular: true,
        enrolled: true,
        progress: 100,
        lessons: "15/15",
        tagClass: "tag-maroon"
    },
    {
        id: 3,
        title: "Alfabetización Digital para Comunidades",
        category: "tecnologia",
        categoryLabel: "Tecnología",
        instructor: "Roberto Flores",
        rating: 4.7,
        reviews: 189,
        image: "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?auto=format&fit=crop&w=600&q=80",
        popular: false,
        enrolled: true,
        progress: 30,
        lessons: "4/14",
        tagClass: "tag-purple"
    },
    {
        id: 4,
        title: "Arte y Cultura Afroperuana",
        category: "arte",
        categoryLabel: "Arte y Cultura",
        instructor: "Lucía Mendoza",
        rating: 4.9,
        reviews: 267,
        image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80",
        popular: false,
        enrolled: false,
        progress: 0,
        lessons: "0/10",
        tagClass: "tag-orange"
    },
    {
        id: 5,
        title: "Salud Mental y Bienestar Comunitario",
        category: "salud",
        categoryLabel: "Salud",
        instructor: "Dr. Patricia Suárez",
        rating: 4.8,
        reviews: 341,
        image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=600&q=80",
        popular: true,
        enrolled: false,
        progress: 0,
        lessons: "0/12",
        tagClass: "tag-blue"
    },
    {
        id: 6,
        title: "Comunicación No Violenta",
        category: "liderazgo",
        categoryLabel: "Liderazgo",
        instructor: "María Torres",
        rating: 4.6,
        reviews: 156,
        image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=600&q=80",
        popular: false,
        enrolled: false,
        progress: 0,
        lessons: "0/8",
        tagClass: "tag-green"
    },
    {
        id: 7,
        title: "Emprendimiento Social",
        category: "liderazgo",
        categoryLabel: "Liderazgo",
        instructor: "Jorge Chávez",
        rating: 4.7,
        reviews: 203,
        image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=600&q=80",
        popular: false,
        enrolled: false,
        progress: 0,
        lessons: "0/11",
        tagClass: "tag-green"
    },
    {
        id: 8,
        title: "Derechos de la Mujer en el Perú",
        category: "derechos",
        categoryLabel: "Derechos Humanos",
        instructor: "Dra. Rosa Palacios",
        rating: 4.9,
        reviews: 387,
        image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=600&q=80",
        popular: true,
        enrolled: false,
        progress: 0,
        lessons: "0/13",
        tagClass: "tag-maroon"
    },
    {
        id: 9,
        title: "Introducción a la Programación",
        category: "tecnologia",
        categoryLabel: "Tecnología",
        instructor: "Luis Vargas",
        rating: 4.5,
        reviews: 124,
        image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80",
        popular: false,
        enrolled: false,
        progress: 0,
        lessons: "0/16",
        tagClass: "tag-purple"
    }
];

// ── Render functions ──

function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    let html = '';
    for (let i = 0; i < full; i++) html += '<i class="fa-solid fa-star"></i>';
    if (half) html += '<i class="fa-solid fa-star-half-stroke"></i>';
    return html;
}

function createCourseCard(course) {
    return `
        <div class="course-card" data-category="${course.category}">
            <div class="course-img">
                <img src="${course.image}" alt="${course.title}" loading="lazy">
                ${course.popular ? '<span class="course-badge">Popular</span>' : ''}
                <span class="course-free-badge"><i class="fa-solid fa-gift" style="margin-right:4px;"></i>Gratis</span>
            </div>
            <div class="course-body">
                <span class="course-category">${course.categoryLabel}</span>
                <h3 class="course-title">${course.title}</h3>
                <p class="course-instructor"><i class="fa-solid fa-chalkboard-user"></i> ${course.instructor}</p>
                <div class="course-rating">
                    <span class="stars">${renderStars(course.rating)}</span>
                    <span class="rating-num">${course.rating}</span>
                    <span class="rating-count">(${course.reviews})</span>
                </div>
                <div class="course-footer">
                    <span class="course-price">100% Gratuito</span>
                    <button class="course-enroll">${course.enrolled ? 'Continuar' : 'Inscribirme'}</button>
                </div>
            </div>
        </div>
    `;
}

function createMyCourseItem(course) {
    const statusText = course.progress === 100 ? 'Completado ✓' : `Progreso: ${course.progress}%`;
    const btnText = course.progress === 100 ? 'Revisar' : 'Continuar';
    const btnClass = course.progress === 100 ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm';

    return `
        <div class="my-course-item">
            <div class="my-course-thumb">
                <img src="${course.image}" alt="${course.title}" loading="lazy">
            </div>
            <div class="my-course-info">
                <span class="tag ${course.tagClass}">${course.categoryLabel}</span>
                <h3>${course.title}</h3>
                <p>${course.instructor} · ${course.lessons} Lecciones</p>
                <div class="progress-info">
                    <span class="progress-text">${statusText}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${course.progress}%; ${course.progress === 100 ? 'background: var(--ubuntu-orange);' : ''}"></div>
                </div>
            </div>
            <div class="my-course-actions">
                <button class="${btnClass}">
                    <i class="fa-solid fa-${course.progress === 100 ? 'eye' : 'play'}"></i>
                    <span>${btnText}</span>
                </button>
            </div>
        </div>
    `;
}


// ── Initialize pages ──

function initHomePage() {
    const container = document.getElementById('cursosContainer');
    // Show 3 recommended (non-enrolled) courses on home
    const recommended = allCourses.filter(c => !c.enrolled).slice(0, 3);
    container.innerHTML = recommended.map(createCourseCard).join('');
}

function initMyCoursesPage() {
    const container = document.getElementById('myCoursesContainer');
    const enrolled = allCourses.filter(c => c.enrolled);
    container.innerHTML = enrolled.map(createMyCourseItem).join('');
}

function initExplorarPage() {
    const container = document.getElementById('explorarContainer');
    container.innerHTML = allCourses.map(createCourseCard).join('');
}


// ── Navigation ──

function setActivePage(pageName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('active', page.id === `page-${pageName}`);
    });

    // Scroll to top
    document.querySelector('.content-area').scrollTop = 0;

    // Close mobile sidebar
    closeSidebar();
}

document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        setActivePage(link.dataset.page);
    });
});


// ── Mobile sidebar ──

const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');
const menuBtn = document.getElementById('mobileMenuBtn');

function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

menuBtn.addEventListener('click', openSidebar);
overlay.addEventListener('click', closeSidebar);


// ── Filter chips (Explorar page) ──

document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const filter = chip.dataset.filter;
        const container = document.getElementById('explorarContainer');
        const filtered = filter === 'todos'
            ? allCourses
            : allCourses.filter(c => c.category === filter);

        container.innerHTML = filtered.map(createCourseCard).join('');

        // Re-trigger animation
        container.querySelectorAll('.course-card').forEach((card, i) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(12px)';
            setTimeout(() => {
                card.style.transition = 'all 0.35s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, i * 60);
        });
    });
});


// ── Stat counter animation ──

function animateCounters() {
    document.querySelectorAll('.stat-number').forEach(el => {
        const target = parseInt(el.dataset.target);
        const duration = 1200;
        const start = performance.now();

        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out quad
            const ease = 1 - (1 - progress) * (1 - progress);
            el.textContent = Math.round(target * ease);
            if (progress < 1) requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
    });
}


// ── Search ──

const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();

    if (query.length > 0) {
        // Switch to explorar page and filter
        setActivePage('explorar');

        // Reset filter chips
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        document.querySelector('.filter-chip[data-filter="todos"]').classList.add('active');

        const container = document.getElementById('explorarContainer');
        const filtered = allCourses.filter(c =>
            c.title.toLowerCase().includes(query) ||
            c.categoryLabel.toLowerCase().includes(query) ||
            c.instructor.toLowerCase().includes(query)
        );
        container.innerHTML = filtered.length > 0
            ? filtered.map(createCourseCard).join('')
            : '<p style="color: var(--text-muted); grid-column: 1 / -1; text-align: center; padding: 40px;">No se encontraron cursos para tu búsqueda.</p>';
    }
});


// ── Notification mock ──

const notifBtn = document.getElementById('notifBtn');
notifBtn.addEventListener('click', () => {
    const badge = notifBtn.querySelector('.badge');
    if (badge) {
        badge.style.transform = 'scale(0)';
        setTimeout(() => badge.remove(), 200);
    }
    alert('🔔 Notificaciones:\n\n• Nuevo taller disponible: Comunicación No Violenta\n• Tu certificado de Derechos Humanos está listo');
});


// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
    initHomePage();
    initMyCoursesPage();
    initExplorarPage();
    animateCounters();
});
