// ==========================================================================
// REPORTES.JS - PANEL DE REPORTES Y GESTIÓN DE ALUMNOS (SOLO ADMIN)
// Ubuntu Perú & Siemens Alliance Platform
// ==========================================================================

import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let dbInstance = null;
let currentAuthUser = null;
let currentUserRole = 'estudiante';
let cachedUsers = {}; // Mapa uid -> datos del usuario
let hasLoadedUsers = false;
let currentReportTab = 'courses'; // 'courses' | 'teachers'

// Inicializador del módulo
export function initReportsModule(db) {
    dbInstance = db;
}

// Asignar credenciales de usuario activo
export function setReportsUser(user, role) {
    currentAuthUser = user;
    currentUserRole = role ? role.toLowerCase().trim() : 'estudiante';
}

// Cargar todos los usuarios registrados desde Firestore ('usuarios' y fallback 'jugadores')
export async function loadUsersData(forceRefresh = false) {
    if (!dbInstance) return;
    if (hasLoadedUsers && !forceRefresh) return;

    try {
        const usersMap = {};

        // 1. Cargar desde la colección principal 'usuarios'
        try {
            const usersSnap = await getDocs(collection(dbInstance, 'usuarios'));
            usersSnap.forEach((docSnap) => {
                const data = docSnap.data();
                usersMap[docSnap.id] = {
                    uid: docSnap.id,
                    ...data
                };
            });
        } catch (err) {
            console.warn("Aviso al consultar colección 'usuarios':", err);
        }

        // 2. Fallback a 'jugadores' por compatibilidad con usuarios preexistentes
        try {
            const playersSnap = await getDocs(collection(dbInstance, 'jugadores'));
            playersSnap.forEach((docSnap) => {
                if (!usersMap[docSnap.id]) {
                    const data = docSnap.data();
                    usersMap[docSnap.id] = {
                        uid: docSnap.id,
                        ...data
                    };
                }
            });
        } catch (err) {
            // Ignorar si no existe
        }

        cachedUsers = usersMap;
        hasLoadedUsers = true;
    } catch (error) {
        console.error("Error cargando usuarios para reportes:", error);
    }
}

// Renderizado principal del panel de reportes
export async function renderReportsView() {
    const reportSection = document.getElementById('view-reports');
    if (!reportSection) return;

    // Protección estricta: Solo para administradores
    if (currentUserRole !== 'admin') {
        reportSection.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                <i class="fa-solid fa-shield-halved" style="font-size: 3rem; color: #ef4444; margin-bottom: 16px; display: block;"></i>
                <h3 style="color: var(--text-primary); font-size: 1.2rem; margin-bottom: 8px;">Acceso Restringido</h3>
                <p style="max-width: 440px; margin: 0 auto;">Esta sección de reportes está disponible únicamente para cuentas con perfil de Administrador.</p>
            </div>
        `;
        return;
    }

    const coursesList = window.getCoursesList ? window.getCoursesList() : [];

    // Mostrar loader ligero si aún no cargan usuarios
    const coursesContainer = document.getElementById('reportCoursesContainer');
    const teachersContainer = document.getElementById('reportTeachersContainer');
    if (!hasLoadedUsers && coursesContainer) {
        coursesContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--siemens-teal); margin-bottom: 12px; display: block;"></i>
                <p>Cargando información de estudiantes y cursos...</p>
            </div>
        `;
    }

    // Asegurar carga de usuarios
    await loadUsersData();

    // Poblar selector de docentes
    populateTeacherFilter(coursesList);

    // Calcular y renderizar métricas globales
    renderReportStats(coursesList);

    // Aplicar filtros y renderizar vistas activas
    filterReports();
}

// Poblar desplegable de profesores disponibles
function populateTeacherFilter(courses) {
    const teacherSelect = document.getElementById('reportTeacherFilter');
    if (!teacherSelect) return;

    const currentSelected = teacherSelect.value;
    const teachersSet = new Set();

    courses.forEach(c => {
        const teacherName = (c.instructor || '').trim();
        if (teacherName) {
            teachersSet.add(teacherName);
        }
    });

    const sortedTeachers = Array.from(teachersSet).sort();

    teacherSelect.innerHTML = `
        <option value="all">Todos los Docentes (${sortedTeachers.length})</option>
        ${sortedTeachers.map(t => `<option value="${escapeHtml(t)}" ${t === currentSelected ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
    `;
}

// Renderizar tarjetas de métricas en la parte superior
function renderReportStats(courses) {
    const statsGrid = document.getElementById('reportStatsGrid');
    if (!statsGrid) return;

    let totalEnrollments = 0;
    const uniqueStudentsSet = new Set();
    const uniqueTeachersSet = new Set();

    courses.forEach(c => {
        const inscritos = Array.isArray(c.inscritos) ? c.inscritos : [];
        totalEnrollments += inscritos.length;
        inscritos.forEach(uid => uniqueStudentsSet.add(uid));
        if (c.instructor && c.instructor.trim()) {
            uniqueTeachersSet.add(c.instructor.trim());
        }
    });

    statsGrid.innerHTML = `
        <div class="report-stat-card">
            <div class="report-stat-icon" style="background: rgba(0, 153, 153, 0.12); color: var(--siemens-teal);">
                <i class="fa-solid fa-graduation-cap"></i>
            </div>
            <div class="report-stat-content">
                <div class="report-stat-val">${courses.length}</div>
                <div class="report-stat-lbl">Total de Cursos</div>
            </div>
        </div>

        <div class="report-stat-card">
            <div class="report-stat-icon" style="background: rgba(16, 185, 129, 0.12); color: var(--ubuntu-green);">
                <i class="fa-solid fa-user-check"></i>
            </div>
            <div class="report-stat-content">
                <div class="report-stat-val">${totalEnrollments}</div>
                <div class="report-stat-lbl">Inscripciones Totales</div>
            </div>
        </div>

        <div class="report-stat-card">
            <div class="report-stat-icon" style="background: rgba(239, 108, 0, 0.12); color: var(--ubuntu-orange);">
                <i class="fa-solid fa-users"></i>
            </div>
            <div class="report-stat-content">
                <div class="report-stat-val">${uniqueStudentsSet.size}</div>
                <div class="report-stat-lbl">Alumnos Únicos</div>
            </div>
        </div>

        <div class="report-stat-card">
            <div class="report-stat-icon" style="background: rgba(99, 102, 241, 0.12); color: #6366f1;">
                <i class="fa-solid fa-chalkboard-user"></i>
            </div>
            <div class="report-stat-content">
                <div class="report-stat-val">${uniqueTeachersSet.size}</div>
                <div class="report-stat-lbl">Docentes Registrados</div>
            </div>
        </div>
    `;
}

// Filtrar cursos y docentes según el buscador y el selector
export function filterReports() {
    const courses = window.getCoursesList ? window.getCoursesList() : [];
    const searchInput = document.getElementById('reportSearchInput');
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const teacherSelect = document.getElementById('reportTeacherFilter');
    const selectedTeacher = teacherSelect ? teacherSelect.value : 'all';

    renderCoursesReport(courses, searchQuery, selectedTeacher);
    renderTeachersReport(courses, searchQuery, selectedTeacher);
}

// 1. Renderizar lista de Cursos con sus alumnos inscritos
function renderCoursesReport(courses, query, teacherFilter) {
    const container = document.getElementById('reportCoursesContainer');
    if (!container) return;

    let filtered = courses.filter(c => {
        // Filtro por docente
        if (teacherFilter !== 'all') {
            const courseTeacher = (c.instructor || '').trim();
            if (courseTeacher !== teacherFilter) return false;
        }

        // Filtro por texto de búsqueda
        if (!query) return true;

        const titleMatch = (c.title || '').toLowerCase().includes(query);
        const categoryMatch = (c.category || '').toLowerCase().includes(query);
        const teacherMatch = (c.instructor || '').toLowerCase().includes(query);

        // Búsqueda en los alumnos inscritos de este curso
        const inscritos = Array.isArray(c.inscritos) ? c.inscritos : [];
        const studentMatch = inscritos.some(uid => {
            const u = cachedUsers[uid];
            if (!u) return false;
            const fullName = (u.nombreCompleto || `${u.nombre || ''} ${u.apellidos || ''}`).toLowerCase();
            const email = (u.email || '').toLowerCase();
            return fullName.includes(query) || email.includes(query);
        });

        return titleMatch || categoryMatch || teacherMatch || studentMatch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 48px 20px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1.5px dashed var(--border-color); color: var(--text-muted);">
                <i class="fa-solid fa-filter-circle-xmark" style="font-size: 2.2rem; color: var(--ubuntu-orange); margin-bottom: 12px; display: block;"></i>
                <h4 style="color: var(--text-primary); margin-bottom: 6px; font-size: 1.05rem;">No se encontraron cursos con los filtros aplicados</h4>
                <p style="font-size: 0.85rem; max-width: 400px; margin: 0 auto;">Intenta buscar con otros términos o selecciona "Todos los Docentes".</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(course => {
        const inscritos = Array.isArray(course.inscritos) ? course.inscritos : [];
        const isActive = course.activo !== false;

        return `
            <div class="report-course-card">
                <div class="report-course-header">
                    <div class="report-course-title-group">
                        <span class="course-badge" style="position: static; font-size: 0.72rem; padding: 3px 8px;">
                            ${escapeHtml(course.category || 'General')}
                        </span>
                        <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                            ${escapeHtml(course.title)}
                        </h3>
                        <span class="report-badge-count">
                            <i class="fa-solid fa-users"></i> ${inscritos.length} ${inscritos.length === 1 ? 'alumno inscrito' : 'alumnos inscritos'}
                        </span>
                    </div>

                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <span style="font-size: 0.82rem; color: var(--text-secondary);">
                            <i class="fa-solid fa-chalkboard-user" style="color: var(--siemens-teal);"></i> 
                            <strong>Docente:</strong> ${escapeHtml(course.instructor || 'No asignado')}
                        </span>
                        <span style="font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; ${isActive ? 'background: rgba(16, 185, 129, 0.12); color: #059669;' : 'background: rgba(239, 68, 68, 0.12); color: #dc2626;'}">
                            ${isActive ? '<i class="fa-solid fa-circle-check"></i> Activo' : '<i class="fa-solid fa-eye-slash"></i> Oculto'}
                        </span>
                        <button class="btn btn-outline btn-sm" onclick="openCourseDetail('${course.id}')" title="Ver aula virtual y contenido del curso" style="padding: 4px 10px; font-size: 0.78rem;">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Curso
                        </button>
                    </div>
                </div>

                <div class="report-table-wrapper">
                    ${inscritos.length === 0 ? `
                        <div style="padding: 24px 20px; text-align: center; color: var(--text-muted); font-size: 0.88rem;">
                            <i class="fa-regular fa-user" style="margin-right: 6px; color: var(--border-color);"></i>
                            Aún no hay alumnos inscritos en este curso.
                        </div>
                    ` : `
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th style="width: 48px;">#</th>
                                    <th>Estudiante</th>
                                    <th>Correo Electrónico</th>
                                    <th>Edad</th>
                                    <th>Fecha de Registro</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${inscritos.map((uid, index) => {
                                    const student = cachedUsers[uid] || null;
                                    const studentName = student 
                                        ? (student.nombreCompleto || `${student.nombre || ''} ${student.apellidos || ''}`.trim() || 'Estudiante')
                                        : `Alumno (ID: ${uid.substring(0, 8)}...)`;
                                    const studentEmail = student ? (student.email || 'Sin correo registrado') : 'Registrado en Firestore';
                                    const studentAge = student && student.edad ? `${student.edad} años` : '—';
                                    const studentDate = student && student.fechaRegistro 
                                        ? formatRegistrationDate(student.fechaRegistro)
                                        : '—';

                                    return `
                                        <tr>
                                            <td style="color: var(--text-muted); font-weight: 600;">${index + 1}</td>
                                            <td>
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(0, 153, 153, 0.12); color: var(--siemens-teal); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; flex-shrink: 0;">
                                                        ${escapeHtml(studentName.substring(0, 1).toUpperCase())}
                                                    </div>
                                                    <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(studentName)}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <a href="mailto:${escapeHtml(studentEmail)}" style="color: var(--siemens-teal); text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                                                    <i class="fa-regular fa-envelope" style="font-size: 0.8rem;"></i> ${escapeHtml(studentEmail)}
                                                </a>
                                            </td>
                                            <td style="color: var(--text-secondary);">${escapeHtml(studentAge)}</td>
                                            <td style="color: var(--text-secondary); font-size: 0.82rem;">${escapeHtml(studentDate)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

// 2. Renderizar Cursos Creados Agrupados por Nombre de Profesor
function renderTeachersReport(courses, query, teacherFilter) {
    const container = document.getElementById('reportTeachersContainer');
    if (!container) return;

    // Agrupar cursos por nombre de profesor
    const teacherGroups = {};

    courses.forEach(c => {
        const teacherName = (c.instructor || 'Docente sin asignar').trim();

        if (!teacherGroups[teacherName]) {
            teacherGroups[teacherName] = {
                name: teacherName,
                authorEmail: c.authorEmail || '',
                courses: [],
                totalStudents: 0
            };
        }

        const inscritos = Array.isArray(c.inscritos) ? c.inscritos : [];
        teacherGroups[teacherName].courses.push(c);
        teacherGroups[teacherName].totalStudents += inscritos.length;
        if (!teacherGroups[teacherName].authorEmail && c.authorEmail) {
            teacherGroups[teacherName].authorEmail = c.authorEmail;
        }
    });

    let teacherList = Object.values(teacherGroups);

    // Filtros
    if (teacherFilter !== 'all') {
        teacherList = teacherList.filter(t => t.name === teacherFilter);
    }

    if (query) {
        teacherList = teacherList.filter(t => {
            const nameMatch = t.name.toLowerCase().includes(query);
            const emailMatch = (t.authorEmail || '').toLowerCase().includes(query);
            const courseMatch = t.courses.some(c => (c.title || '').toLowerCase().includes(query));
            return nameMatch || emailMatch || courseMatch;
        });
    }

    if (teacherList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 48px 20px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1.5px dashed var(--border-color); color: var(--text-muted);">
                <i class="fa-solid fa-chalkboard-user" style="font-size: 2.2rem; color: #6366f1; margin-bottom: 12px; display: block;"></i>
                <h4 style="color: var(--text-primary); margin-bottom: 6px; font-size: 1.05rem;">No se encontraron docentes con los filtros aplicados</h4>
                <p style="font-size: 0.85rem; max-width: 400px; margin: 0 auto;">Verifica el nombre en el buscador o restablece el filtro.</p>
            </div>
        `;
        return;
    }

    // Ordenar docentes con más cursos primero
    teacherList.sort((a, b) => b.courses.length - a.courses.length);

    container.innerHTML = teacherList.map(t => {
        const initials = t.name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'DC';

        return `
            <div class="report-teacher-card">
                <div class="report-teacher-header">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div class="report-teacher-avatar">
                            ${escapeHtml(initials)}
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #ffffff;">
                                ${escapeHtml(t.name)}
                            </h3>
                            ${t.authorEmail ? `
                                <div style="font-size: 0.82rem; color: rgba(255, 255, 255, 0.7); margin-top: 2px;">
                                    <i class="fa-regular fa-envelope" style="margin-right: 4px;"></i> ${escapeHtml(t.authorEmail)}
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <span style="background: rgba(255, 255, 255, 0.15); color: #fff; padding: 5px 12px; border-radius: 999px; font-size: 0.82rem; font-weight: 700;">
                            <i class="fa-solid fa-layer-group" style="margin-right: 4px;"></i> ${t.courses.length} ${t.courses.length === 1 ? 'curso creado' : 'cursos creados'}
                        </span>
                        <span style="background: rgba(16, 185, 129, 0.25); color: #6ee7b7; padding: 5px 12px; border-radius: 999px; font-size: 0.82rem; font-weight: 700;">
                            <i class="fa-solid fa-users" style="margin-right: 4px;"></i> ${t.totalStudents} ${t.totalStudents === 1 ? 'alumno acumulado' : 'alumnos acumulados'}
                        </span>
                    </div>
                </div>

                <div class="report-table-wrapper">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th style="width: 48px;">#</th>
                                <th>Curso Creado</th>
                                <th>Categoría</th>
                                <th>Estado</th>
                                <th>Alumnos Inscritos</th>
                                <th style="text-align: right; width: 140px;">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${t.courses.map((course, idx) => {
                                const inscritos = Array.isArray(course.inscritos) ? course.inscritos : [];
                                const isActive = course.activo !== false;

                                return `
                                    <tr>
                                        <td style="color: var(--text-muted); font-weight: 600;">${idx + 1}</td>
                                        <td>
                                            <strong style="color: var(--text-primary); font-size: 0.9rem;">${escapeHtml(course.title)}</strong>
                                        </td>
                                        <td>
                                            <span class="course-badge" style="position: static; font-size: 0.72rem; padding: 2px 8px;">
                                                ${escapeHtml(course.category || 'General')}
                                            </span>
                                        </td>
                                        <td>
                                            <span style="font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; ${isActive ? 'background: rgba(16, 185, 129, 0.12); color: #059669;' : 'background: rgba(239, 68, 68, 0.12); color: #dc2626;'}">
                                                ${isActive ? 'Activo' : 'Oculto'}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="report-badge-count" style="padding: 2px 10px; font-size: 0.75rem;">
                                                <i class="fa-solid fa-user-check"></i> ${inscritos.length} alumnos
                                            </span>
                                        </td>
                                        <td style="text-align: right;">
                                            <button class="btn btn-outline btn-sm" onclick="openCourseDetail('${course.id}')" title="Ver aula virtual" style="padding: 4px 10px; font-size: 0.78rem;">
                                                <i class="fa-solid fa-play"></i> Aula Virtual
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');
}

// Alternar entre las pestañas internas del reporte
export function switchReportTab(tabName) {
    currentReportTab = tabName;
    const tabCoursesBtn = document.getElementById('reportTabCoursesBtn');
    const tabTeachersBtn = document.getElementById('reportTabTeachersBtn');
    const coursesContainer = document.getElementById('reportCoursesContainer');
    const teachersContainer = document.getElementById('reportTeachersContainer');

    if (tabName === 'courses') {
        if (tabCoursesBtn) tabCoursesBtn.classList.add('active');
        if (tabTeachersBtn) tabTeachersBtn.classList.remove('active');
        if (coursesContainer) coursesContainer.style.display = 'block';
        if (teachersContainer) teachersContainer.style.display = 'none';
    } else {
        if (tabCoursesBtn) tabCoursesBtn.classList.remove('active');
        if (tabTeachersBtn) tabTeachersBtn.classList.add('active');
        if (coursesContainer) coursesContainer.style.display = 'none';
        if (teachersContainer) teachersContainer.style.display = 'block';
    }
}

// Forzar actualización de datos desde Firestore
export async function refreshReportsData() {
    const btn = document.getElementById('btnRefreshReports');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Actualizando...';
    }

    try {
        await loadUsersData(true);
        await renderReportsView();
        if (window.showToast) {
            window.showToast('Reporte actualizado con los datos más recientes.', 'normal');
        }
    } catch (e) {
        console.error("Error al actualizar reporte:", e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Actualizar Reporte';
        }
    }
}

// Exportar datos a CSV para abrir en Excel
export function exportReportsCsv() {
    const courses = window.getCoursesList ? window.getCoursesList() : [];
    if (!courses || courses.length === 0) {
        if (window.showToast) window.showToast('No hay cursos para exportar.', 'normal');
        return;
    }

    // Cabecera CSV compatible con Excel (BOM UTF-8)
    let csv = '\uFEFF"Curso","Categoría","Docente","Estado Curso","ID Alumno","Nombre Alumno","Correo Alumno","Edad","Fecha Registro"\n';

    courses.forEach(c => {
        const inscritos = Array.isArray(c.inscritos) ? c.inscritos : [];
        const status = c.activo !== false ? 'Activo' : 'Oculto';
        const teacher = (c.instructor || 'Docente').replace(/"/g, '""');
        const title = (c.title || '').replace(/"/g, '""');
        const cat = (c.category || 'General').replace(/"/g, '""');

        if (inscritos.length === 0) {
            csv += `"${title}","${cat}","${teacher}","${status}","Sin inscritos","—","—","—","—"\n`;
        } else {
            inscritos.forEach(uid => {
                const u = cachedUsers[uid] || {};
                const name = (u.nombreCompleto || (u.nombre && u.apellidos ? `${u.nombre} ${u.apellidos}` : u.nombre) || 'Estudiante').replace(/"/g, '""');
                const email = (u.email || 'Sin correo').replace(/"/g, '""');
                const edad = u.edad || '—';
                const fecha = u.fechaRegistro ? formatRegistrationDate(u.fechaRegistro) : '—';
                csv += `"${title}","${cat}","${teacher}","${status}","${uid}","${name}","${email}","${edad}","${fecha}"\n`;
            });
        }
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_alumnos_ubuntu_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (window.showToast) {
        window.showToast('Reporte CSV descargado con éxito.', 'normal');
    }
}

// Formateador de fecha legible
function formatRegistrationDate(isoStr) {
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        return d.toLocaleDateString('es-PE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return isoStr;
    }
}

// Helper para sanitizar strings en HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Exponer funciones globales a window
window.renderReportsView = renderReportsView;
window.filterReports = filterReports;
window.switchReportTab = switchReportTab;
window.refreshReportsData = refreshReportsData;
window.exportReportsCsv = exportReportsCsv;

// Suscripción automática a cambios de cursos si la sección de reportes está activa
window.onCoursesUpdatedForReports = () => {
    const reportSec = document.getElementById('view-reports');
    if (reportSec && reportSec.classList.contains('active')) {
        renderReportsView();
    }
};
