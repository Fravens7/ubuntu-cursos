// ==========================================================================
// REPORTES.JS - PANEL DE REPORTES Y GESTIÓN DE ALUMNOS (SOLO ADMIN)
// Ubuntu Perú & Siemens Alliance Platform
// ==========================================================================

import { collection, getDocs, doc, updateDoc, deleteDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let dbInstance = null;
let currentAuthUser = null;
let currentUserRole = 'estudiante';
let cachedUsers = {}; // Mapa uid -> datos del usuario
let hasLoadedUsers = false;
let currentReportTab = 'students'; // 'students' | 'courses' | 'teachers'

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

        // 3. Fallback a 'users' por si existieran usuarios manuales previos
        try {
            const oldUsersSnap = await getDocs(collection(dbInstance, 'users'));
            oldUsersSnap.forEach((docSnap) => {
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
    const uniqueTeachersSet = new Set();

    courses.forEach(c => {
        const inscritos = Array.isArray(c.inscritos) ? c.inscritos : [];
        totalEnrollments += inscritos.length;
        if (c.instructor && c.instructor.trim()) {
            uniqueTeachersSet.add(c.instructor.trim());
        }
    });

    // Alumnos registrados reales en Firestore 'usuarios'
    const registeredStudentsCount = Object.values(cachedUsers).filter(u => {
        const r = (u.rol || 'estudiante').toLowerCase().trim();
        return r === 'estudiante' || r === 'alumno';
    }).length;

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
                <div class="report-stat-val">${registeredStudentsCount}</div>
                <div class="report-stat-lbl">Alumnos Registrados</div>
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

    renderAllStudentsReport(searchQuery);
    renderCoursesReport(courses, searchQuery, selectedTeacher);
    renderTeachersReport(courses, searchQuery, selectedTeacher);
}

// 0. Renderizar Directorio General de Todos los Alumnos
function renderAllStudentsReport(query) {
    const container = document.getElementById('reportAllStudentsContainer');
    if (!container) return;

    const courses = window.getCoursesList ? window.getCoursesList() : [];
    const allUsersList = Object.values(cachedUsers);

    // Filtrar usuarios con rol estudiante
    let students = allUsersList.filter(u => {
        const rol = (u.rol || 'estudiante').toLowerCase().trim();
        return rol === 'estudiante' || rol === 'alumno';
    });

    // Filtro por texto de búsqueda
    if (query) {
        students = students.filter(s => {
            const name = (s.nombreCompleto || `${s.nombre || ''} ${s.apellidos || ''}`).toLowerCase();
            const email = (s.email || '').toLowerCase();
            const edad = String(s.edad || '');
            return name.includes(query) || email.includes(query) || edad.includes(query);
        });
    }

    if (students.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 48px 20px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1.5px dashed var(--border-color); color: var(--text-muted);">
                <i class="fa-solid fa-users-slash" style="font-size: 2.2rem; color: var(--ubuntu-orange); margin-bottom: 12px; display: block;"></i>
                <h4 style="color: var(--text-primary); margin-bottom: 6px; font-size: 1.05rem;">No se encontraron estudiantes registrados</h4>
                <p style="font-size: 0.85rem; max-width: 400px; margin: 0 auto;">Intenta con otro término en el buscador o registra nuevos estudiantes desde la pestaña de inicio.</p>
            </div>
        `;
        return;
    }

    // Ordenar más recientes primero
    students.sort((a, b) => {
        const dateA = a.fechaRegistro ? new Date(a.fechaRegistro).getTime() : 0;
        const dateB = b.fechaRegistro ? new Date(b.fechaRegistro).getTime() : 0;
        return dateB - dateA;
    });

    container.innerHTML = `
        <div class="report-course-card" style="margin-bottom: 24px;">
            <div class="report-course-header">
                <div class="report-course-title-group">
                    <span class="course-badge" style="position: static; font-size: 0.72rem; padding: 3px 8px; background: rgba(0, 153, 153, 0.15); color: var(--siemens-teal);">
                        Directorio General
                    </span>
                    <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                        Todos los Alumnos Registrados (${students.length})
                    </h3>
                    <span class="report-badge-count">
                        <i class="fa-solid fa-graduation-cap"></i> ${students.length} ${students.length === 1 ? 'estudiante' : 'estudiantes'}
                    </span>
                </div>
                <div style="font-size: 0.82rem; color: var(--text-secondary);">
                    Lista completa de alumnos en Firestore (independientemente de si están inscritos o no en algún curso)
                </div>
            </div>

            <div class="report-table-wrapper">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width: 48px;">#</th>
                            <th>Estudiante</th>
                            <th>Correo Electrónico</th>
                            <th>Edad</th>
                            <th>Fecha de Registro</th>
                            <th>Cursos Inscritos</th>
                            <th style="width: 60px; text-align: center;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map((st, idx) => {
                            const name = st.nombreCompleto || `${st.nombre || ''} ${st.apellidos || ''}`.trim() || 'Estudiante';
                            const email = st.email || 'Sin correo registrado';
                            const initials = (name || 'E').substring(0, 1).toUpperCase();

                            let ageHtml = '';
                            if (st.edad !== undefined && st.edad !== null && st.edad !== '') {
                                ageHtml = `<span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(String(st.edad))} años</span>`;
                            } else {
                                ageHtml = `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">Sin edad (Previo)</span>`;
                            }

                            const regDate = st.fechaRegistro ? formatRegistrationDate(st.fechaRegistro) : 'Sin fecha';
                            const enrolledCourses = courses.filter(c => Array.isArray(c.inscritos) && c.inscritos.includes(st.uid));

                            return `
                                <tr>
                                    <td style="color: var(--text-muted); font-weight: 600;">${idx + 1}</td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(0, 153, 153, 0.12); color: var(--siemens-teal); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.82rem; flex-shrink: 0;">
                                                ${escapeHtml(initials)}
                                            </div>
                                            <div>
                                                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.92rem;">${escapeHtml(name)}</div>
                                                <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">UID: ${escapeHtml((st.uid || '').substring(0, 8))}...</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <a href="mailto:${escapeHtml(email)}" style="color: var(--siemens-teal); text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                                            <i class="fa-regular fa-envelope" style="font-size: 0.8rem;"></i> ${escapeHtml(email)}
                                        </a>
                                    </td>
                                    <td>${ageHtml}</td>
                                    <td style="color: var(--text-secondary); font-size: 0.82rem;">${escapeHtml(regDate)}</td>
                                    <td>
                                        ${enrolledCourses.length === 0 ? `
                                            <span style="font-size: 0.75rem; color: var(--text-muted); background: var(--bg-body); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--border-color);">
                                                Sin inscripciones aún
                                            </span>
                                        ` : `
                                            <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">
                                                <span class="report-badge-count" style="padding: 2px 8px; font-size: 0.75rem; background: rgba(16, 185, 129, 0.12); color: #059669; font-weight: 700;">
                                                    <i class="fa-solid fa-graduation-cap"></i> ${enrolledCourses.length} ${enrolledCourses.length === 1 ? 'curso' : 'cursos'}
                                                </span>
                                                <small style="color: var(--text-secondary); font-size: 0.75rem;" title="${escapeHtml(enrolledCourses.map(c => c.title).join(', '))}">
                                                    (${escapeHtml(enrolledCourses.map(c => c.title).slice(0, 2).join(', '))}${enrolledCourses.length > 2 ? '...' : ''})
                                                </small>
                                            </div>
                                        `}
                                    </td>
                                    <td style="text-align: center;">
                                        <button class="btn btn-outline-danger btn-sm" onclick="window.deleteStudent('${st.uid}', '${escapeAttr(name)}')" title="Eliminar estudiante de la plataforma" style="padding: 4px 9px; font-size: 0.82rem; border-radius: 6px;">
                                            <i class="fa-solid fa-trash-can"></i>
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
                                    <th style="width: 60px; text-align: center;">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${inscritos.map((uid, index) => {
                                    const student = cachedUsers[uid] || null;
                                    const hasProfile = Boolean(student);
                                    const isOrphaned = !hasProfile;

                                    const studentName = hasProfile 
                                        ? (student.nombreCompleto || `${student.nombre || ''} ${student.apellidos || ''}`.trim() || 'Estudiante')
                                        : `Alumno (ID: ${uid.substring(0, 8)}...)`;

                                    const studentEmail = hasProfile 
                                        ? (student.email || 'Sin correo registrado') 
                                        : 'Sin perfil en usuarios (UID previo)';

                                    // Distinguir claramente si tiene edad o si es un registro previo/sin campo
                                    let studentAgeHtml = '';
                                    if (hasProfile) {
                                        if (student.edad !== undefined && student.edad !== null && student.edad !== '') {
                                            studentAgeHtml = `<span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(String(student.edad))} años</span>`;
                                        } else {
                                            studentAgeHtml = `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;" title="Cuenta creada antes de solicitar edad en el registro">Sin edad (Previo)</span>`;
                                        }
                                    } else {
                                        studentAgeHtml = `<span style="color: var(--text-muted); font-size: 0.8rem;">— (Sin datos)</span>`;
                                    }

                                    const studentDate = hasProfile && student.fechaRegistro 
                                        ? formatRegistrationDate(student.fechaRegistro)
                                        : (hasProfile ? 'Sin fecha' : '—');

                                    return `
                                        <tr>
                                            <td style="color: var(--text-muted); font-weight: 600;">${index + 1}</td>
                                            <td>
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <div style="width: 28px; height: 28px; border-radius: 50%; background: ${isOrphaned ? 'rgba(239, 108, 0, 0.12)' : 'rgba(0, 153, 153, 0.12)'}; color: ${isOrphaned ? 'var(--ubuntu-orange)' : 'var(--siemens-teal)'}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; flex-shrink: 0;">
                                                        ${escapeHtml(studentName.substring(0, 1).toUpperCase())}
                                                    </div>
                                                    <div>
                                                        <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(studentName)}</span>
                                                        ${isOrphaned ? `
                                                            <span style="display: inline-block; background: rgba(239, 108, 0, 0.12); color: var(--ubuntu-orange); font-size: 0.68rem; font-weight: 700; padding: 1px 6px; border-radius: 4px; margin-left: 4px;" title="Este UID está inscrito en el curso pero no tiene ficha en la tabla 'usuarios' (cuenta previa de prueba o sin sincronizar)">
                                                                UID Previo
                                                            </span>
                                                        ` : ''}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                ${hasProfile && student.email ? `
                                                    <a href="mailto:${escapeHtml(studentEmail)}" style="color: var(--siemens-teal); text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                                                        <i class="fa-regular fa-envelope" style="font-size: 0.8rem;"></i> ${escapeHtml(studentEmail)}
                                                    </a>
                                                ` : `
                                                    <span style="color: var(--text-muted); font-size: 0.82rem; display: inline-flex; align-items: center; gap: 5px;" title="No tiene ficha en la tabla usuarios de Firestore">
                                                        <i class="fa-solid fa-triangle-exclamation" style="color: var(--ubuntu-orange); font-size: 0.75rem;"></i> ${escapeHtml(studentEmail)}
                                                    </span>
                                                `}
                                            </td>
                                            <td>${studentAgeHtml}</td>
                                            <td style="color: var(--text-secondary); font-size: 0.82rem;">${escapeHtml(studentDate)}</td>
                                            <td style="text-align: center;">
                                                <button class="btn btn-outline-danger btn-sm" onclick="window.removeStudentFromCourse('${course.id}', '${uid}', '${escapeAttr(studentName)}')" title="Remover de este curso" style="padding: 4px 9px; font-size: 0.82rem; border-radius: 6px;">
                                                    <i class="fa-solid fa-trash-can"></i>
                                                </button>
                                            </td>
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
    const tabStudentsBtn = document.getElementById('reportTabStudentsBtn');
    const tabCoursesBtn = document.getElementById('reportTabCoursesBtn');
    const tabTeachersBtn = document.getElementById('reportTabTeachersBtn');
    const studentsContainer = document.getElementById('reportAllStudentsContainer');
    const coursesContainer = document.getElementById('reportCoursesContainer');
    const teachersContainer = document.getElementById('reportTeachersContainer');
    const teacherFilterGroup = document.getElementById('reportTeacherFilterGroup');

    if (tabStudentsBtn) tabStudentsBtn.classList.toggle('active', tabName === 'students');
    if (tabCoursesBtn) tabCoursesBtn.classList.toggle('active', tabName === 'courses');
    if (tabTeachersBtn) tabTeachersBtn.classList.toggle('active', tabName === 'teachers');

    if (studentsContainer) studentsContainer.style.display = (tabName === 'students') ? 'block' : 'none';
    if (coursesContainer) coursesContainer.style.display = (tabName === 'courses') ? 'block' : 'none';
    if (teachersContainer) teachersContainer.style.display = (tabName === 'teachers') ? 'block' : 'none';

    // Mostrar el filtro de docente únicamente cuando corresponda
    if (teacherFilterGroup) {
        teacherFilterGroup.style.display = (tabName === 'students') ? 'none' : 'flex';
    }
}

// Depurar UIDs huérfanos de todos los cursos en Firestore
export async function cleanOrphanedStudents() {
    if (!dbInstance) {
        if (window.showToast) window.showToast('No hay conexión con la base de datos.', 'normal');
        return;
    }
    const courses = window.getCoursesList ? window.getCoursesList() : [];
    if (!courses || courses.length === 0) {
        if (window.showToast) window.showToast('No hay cursos para analizar.', 'normal');
        return;
    }

    // Asegurar los datos de usuarios más recientes
    await loadUsersData(true);

    let totalOrphans = 0;
    const coursesToClean = [];

    courses.forEach(c => {
        const inscritos = Array.isArray(c.inscritos) ? c.inscritos : [];
        const validInscritos = inscritos.filter(uid => Boolean(cachedUsers[uid]));
        const removed = inscritos.length - validInscritos.length;
        if (removed > 0) {
            totalOrphans += removed;
            coursesToClean.push({
                courseId: c.id,
                title: c.title,
                newInscritos: validInscritos,
                removedCount: removed
            });
        }
    });

    if (totalOrphans === 0) {
        if (window.showToast) window.showToast('¡No se encontraron UIDs huérfanos! Todos los alumnos inscritos tienen ficha válida en la tabla usuarios.', 'success');
        return;
    }

    const confirmMsg = `Se encontraron ${totalOrphans} inscripciones con "UID Previo" (cuentas antiguas o de prueba que no tienen ficha en la tabla 'usuarios').\n\n¿Deseas depurar y remover estos ${totalOrphans} registros de los cursos en Firestore automáticamente?`;
    if (!confirm(confirmMsg)) return;

    const btn = document.getElementById('btnCleanOrphans');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Depurando...';
    }

    try {
        for (const item of coursesToClean) {
            const courseRef = doc(dbInstance, 'cursos', item.courseId);
            await updateDoc(courseRef, {
                inscritos: item.newInscritos
            });
            // Reflejar localmente
            const localCourse = courses.find(c => c.id === item.courseId);
            if (localCourse) localCourse.inscritos = item.newInscritos;
        }

        if (window.showToast) {
            window.showToast(`¡Se depuraron exitosamente ${totalOrphans} UIDs huérfanos de los cursos!`, 'success');
        }

        await renderReportsView();
    } catch (err) {
        console.error("Error al depurar alumnos huérfanos:", err);
        if (window.showToast) window.showToast('Error al depurar en Firestore: ' + err.message, 'normal');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-broom"></i> Depurar UIDs Huérfanos';
        }
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

// Exportar directorio completo de alumnos a CSV para abrir en Excel
export function exportReportsCsv() {
    const courses = window.getCoursesList ? window.getCoursesList() : [];
    const allStudents = Object.values(cachedUsers).filter(u => {
        const r = (u.rol || 'estudiante').toLowerCase().trim();
        return r === 'estudiante' || r === 'alumno';
    });

    if (!allStudents || allStudents.length === 0) {
        if (window.showToast) window.showToast('No hay alumnos registrados para exportar.', 'normal');
        return;
    }

    // Cabecera CSV compatible con Excel (BOM UTF-8)
    let csv = '\uFEFF"Nombre Completo","Correo Electrónico","Edad","Fecha de Registro","Total Cursos Inscritos","Cursos Inscritos","UID Firestore"\n';

    allStudents.forEach(st => {
        const name = (st.nombreCompleto || `${st.nombre || ''} ${st.apellidos || ''}`.trim() || 'Estudiante').replace(/"/g, '""');
        const email = (st.email || 'Sin correo').replace(/"/g, '""');
        const edad = st.edad !== undefined && st.edad !== null && st.edad !== '' ? `${st.edad} años` : 'Sin edad (Previo)';
        const fecha = st.fechaRegistro ? formatRegistrationDate(st.fechaRegistro) : 'Sin fecha';
        const enrolled = courses.filter(c => Array.isArray(c.inscritos) && c.inscritos.includes(st.uid));
        const courseNames = enrolled.map(c => c.title).join('; ').replace(/"/g, '""');
        csv += `"${name}","${email}","${edad}","${fecha}","${enrolled.length}","${courseNames}","${st.uid || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `directorio_alumnos_ubuntu_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (window.showToast) {
        window.showToast('Directorio de alumnos descargado en CSV con éxito.', 'normal');
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

// Helper para escapar atributos HTML
function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;');
}

// 1. Eliminar permanentemente un estudiante de la plataforma (desde Directorio)
export async function deleteStudent(uid, studentName) {
    if (!dbInstance || !uid) return;

    const displayName = studentName || 'este estudiante';
    const ok = confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${displayName}"?\n\nSe borrará su ficha de Firestore y se desinscribirá de todos los cursos.`);
    if (!ok) return;

    try {
        // 1. Borrar documento en 'usuarios'
        try {
            await deleteDoc(doc(dbInstance, 'usuarios', uid));
        } catch (e) {
            console.warn("Aviso al borrar de 'usuarios':", e);
        }

        // 2. Borrar fallback si existiera en 'jugadores' o 'users'
        try { await deleteDoc(doc(dbInstance, 'jugadores', uid)); } catch (e) {}
        try { await deleteDoc(doc(dbInstance, 'users', uid)); } catch (e) {}

        // 3. Remover de todos los cursos en Firestore
        const courses = window.getCoursesList ? window.getCoursesList() : [];
        for (const c of courses) {
            if (Array.isArray(c.inscritos) && c.inscritos.includes(uid)) {
                const courseRef = doc(dbInstance, 'cursos', c.id);
                const updatedInscritos = c.inscritos.filter(id => id !== uid);
                await updateDoc(courseRef, { inscritos: updatedInscritos });
                c.inscritos = updatedInscritos;
            }
        }

        // 4. Actualizar caché local
        delete cachedUsers[uid];

        if (window.showToast) {
            window.showToast(`Estudiante "${displayName}" eliminado con éxito.`, 'success');
        }

        await renderReportsView();
    } catch (err) {
        console.error("Error al eliminar estudiante:", err);
        if (window.showToast) window.showToast('Error al eliminar: ' + err.message, 'normal');
    }
}

// 2. Remover un estudiante o UID huérfano de un curso específico
export async function removeStudentFromCourse(courseId, uid, studentName) {
    if (!dbInstance || !courseId || !uid) return;

    const displayName = studentName || `ID: ${uid.substring(0, 8)}...`;
    const ok = confirm(`¿Deseas desinscribir/eliminar a "${displayName}" de este curso?`);
    if (!ok) return;

    try {
        const courses = window.getCoursesList ? window.getCoursesList() : [];
        const course = courses.find(c => c.id === courseId);

        const courseRef = doc(dbInstance, 'cursos', courseId);
        if (course && Array.isArray(course.inscritos)) {
            const updatedInscritos = course.inscritos.filter(id => id !== uid);
            await updateDoc(courseRef, { inscritos: updatedInscritos });
            course.inscritos = updatedInscritos;
        } else {
            await updateDoc(courseRef, { inscritos: arrayRemove(uid) });
        }

        if (window.showToast) {
            window.showToast(`Alumno removido del curso exitosamente.`, 'success');
        }

        await renderReportsView();
    } catch (err) {
        console.error("Error al remover alumno del curso:", err);
        if (window.showToast) window.showToast('Error al remover alumno: ' + err.message, 'normal');
    }
}

// Exponer funciones globales a window
window.renderReportsView = renderReportsView;
window.filterReports = filterReports;
window.switchReportTab = switchReportTab;
window.refreshReportsData = refreshReportsData;
window.exportReportsCsv = exportReportsCsv;
window.deleteStudent = deleteStudent;
window.removeStudentFromCourse = removeStudentFromCourse;

// Suscripción automática a cambios de cursos si la sección de reportes está activa
window.onCoursesUpdatedForReports = () => {
    const reportSec = document.getElementById('view-reports');
    if (reportSec && reportSec.classList.contains('active')) {
        renderReportsView();
    }
};
