// ==========================================
// CURSOS.JS - GESTIÓN DE CURSOS Y MATERIALES
// Cero costo en Firebase (Técnica del Enlace)
// ==========================================

import { 
    collection, 
    addDoc, 
    doc, 
    updateDoc, 
    arrayUnion, 
    arrayRemove, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let coursesList = [];
let currentCategory = 'all';
let dbInstance = null;
let currentAuthUser = null;
let currentUserRole = 'estudiante';
let currentUserName = 'Usuario';

// Asignar datos del usuario activo desde index.html
export function setCursosUser(user, role, name) {
    currentAuthUser = user;
    currentUserRole = role ? role.toLowerCase().trim() : 'estudiante';
    currentUserName = name || 'Usuario';
    renderCourses();
}

// Inicializador del módulo con Firestore
export function initCursosModule(db) {
    dbInstance = db;
    
    // Escuchar cursos en tiempo real desde Firestore (Colección 'cursos')
    try {
        const cursosRef = collection(db, 'cursos');
        onSnapshot(cursosRef, (snapshot) => {
            const firestoreCourses = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                firestoreCourses.push({
                    id: docSnap.id,
                    activo: data.activo !== false, // Por defecto activo: true
                    inscritos: Array.isArray(data.inscritos) ? data.inscritos : [],
                    ...data
                });
            });

            coursesList = firestoreCourses;
            renderCourses();
        }, (error) => {
            console.warn("Aviso de Firestore (Cursos):", error);
            renderCourses();
        });
    } catch (err) {
        console.warn("No se pudo conectar a la colección 'cursos':", err);
        renderCourses();
    }
}

// Convertir cualquier URL de YouTube a URL embebible
function getYouTubeEmbedUrl(url) {
    if (!url) return null;
    let videoId = null;
    
    if (url.includes('youtube.com/watch?v=')) {
        videoId = url.split('watch?v=')[1]?.split('&')[0];
    } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0];
    } else if (url.includes('youtube.com/embed/')) {
        return url;
    }

    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

// Convertir URL de Google Slides, Google Drive PDF, Google Docs a URL embebible
function getEmbeddableDocumentUrl(url) {
    if (!url) return null;
    const cleanUrl = url.trim();
    
    // Google Slides (Presentaciones de Google)
    if (cleanUrl.includes('docs.google.com/presentation/d/')) {
        const match = cleanUrl.match(/presentation\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
        }
    }

    // Google Drive File / PDF / Vista previa
    if (cleanUrl.includes('drive.google.com/file/d/')) {
        const match = cleanUrl.match(/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://drive.google.com/file/d/${match[1]}/preview`;
        }
    }

    // Google Docs (Documentos de texto)
    if (cleanUrl.includes('docs.google.com/document/d/')) {
        const match = cleanUrl.match(/document\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://docs.google.com/document/d/${match[1]}/preview`;
        }
    }

    // Google Sheets (Hojas de cálculo)
    if (cleanUrl.includes('docs.google.com/spreadsheets/d/')) {
        const match = cleanUrl.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://docs.google.com/spreadsheets/d/${match[1]}/preview`;
        }
    }

    // Archivo PDF directo en internet
    if (cleanUrl.toLowerCase().endsWith('.pdf')) {
        return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(cleanUrl)}`;
    }

    return null;
}

// Convertir URL de GitHub / Colab a Raw URL de GitHub
function getGitHubRawUrl(url) {
    if (!url) return null;
    const cleanUrl = url.trim();

    // Caso 1: colab.research.google.com/github/USER/REPO/blob/BRANCH/FILE.ipynb
    if (cleanUrl.includes('colab.research.google.com/github/')) {
        const path = cleanUrl.split('colab.research.google.com/github/')[1];
        if (path) {
            const rawPath = path.replace('/blob/', '/');
            return `https://raw.githubusercontent.com/${rawPath}`;
        }
    }

    // Caso 2: github.com/USER/REPO/blob/BRANCH/FILE.ipynb
    if (cleanUrl.includes('github.com/') && cleanUrl.toLowerCase().endsWith('.ipynb')) {
        const path = cleanUrl.replace('https://github.com/', '').replace('http://github.com/', '');
        const rawPath = path.replace('/blob/', '/');
        return `https://raw.githubusercontent.com/${rawPath}`;
    }

    // Caso 3: raw.githubusercontent.com/...
    if (cleanUrl.includes('raw.githubusercontent.com/')) {
        return cleanUrl;
    }

    return null;
}

// Convertir URL de Google Colab / GitHub / Miro a vista embebible
function getEmbeddableResourceUrl(url) {
    if (!url) return null;
    const cleanUrl = url.trim();
    const rawNotebookUrl = getGitHubRawUrl(cleanUrl);

    // 1. Google Colab / Jupyter Notebook (.ipynb) alojado en GitHub -> Renderizado Nativo Ultra Rápido (Cero errores 503)
    if (rawNotebookUrl) {
        return {
            type: 'notebook',
            title: 'Cuaderno Colab / Jupyter',
            icon: 'fa-brands fa-python',
            iconColor: '#38bdf8',
            rawUrl: rawNotebookUrl,
            directUrl: cleanUrl,
            actionLabel: 'Abrir y Ejecutar en Colab'
        };
    }

    // 2. Tablero de Miro
    if (cleanUrl.includes('miro.com/app/board/')) {
        const match = cleanUrl.match(/board\/([a-zA-Z0-9_=-]+)/);
        if (match && match[1]) {
            return {
                type: 'iframe',
                title: 'Pizarra Interactiva Miro',
                icon: 'fa-solid fa-chalkboard-user',
                iconColor: '#ffd02f',
                embedUrl: `https://miro.com/app/live-embed/${match[1]}/`,
                directUrl: cleanUrl,
                aspectRatio: '65%',
                actionLabel: 'Abrir en Miro'
            };
        }
    }

    // 3. Simulador Wokwi (Arduino / ESP32)
    if (cleanUrl.includes('wokwi.com/projects/')) {
        return {
            type: 'iframe',
            title: 'Simulador Wokwi',
            icon: 'fa-solid fa-microchip',
            iconColor: '#10b981',
            embedUrl: cleanUrl.includes('?') ? cleanUrl : `${cleanUrl}?view=preview`,
            directUrl: cleanUrl,
            aspectRatio: '65%',
            actionLabel: 'Abrir en Wokwi'
        };
    }

    return null;
}

// Cargar y renderizar cuaderno Jupyter (.ipynb) nativamente en el navegador sin depender de servidores lentos
async function loadAndRenderNotebook(containerElement, rawUrl, directUrl) {
    if (!containerElement) return;

    containerElement.innerHTML = `
        <div style="text-align: center; padding: 32px 20px; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color);">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--siemens-teal); margin-bottom: 12px; display: block;"></i>
            <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">Cargando cuaderno interactivo de Python...</span>
        </div>
    `;

    try {
        const res = await fetch(rawUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const notebook = await res.json();
        
        let notebookHtml = `
            <div class="jupyter-notebook-viewer" style="background: #181a1b; border: 1px solid #2d3135; border-radius: 12px; overflow: hidden; margin-bottom: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,0.3);">
                <!-- Header del Cuaderno -->
                <div style="background: #22252a; padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #2d3135; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-brands fa-python" style="color: #38bdf8; font-size: 1.3rem;"></i>
                        <span style="font-weight: 700; font-size: 0.9rem; color: #f3f4f6;">Cuaderno de Ejercicios Python (.ipynb)</span>
                    </div>
                    <a href="${directUrl}" target="_blank" class="btn btn-sm" style="background: #e27d60; color: #fff; border: 0; font-size: 0.78rem; font-weight: 700; padding: 6px 14px; border-radius: 6px; display: flex; align-items: center; gap: 6px; text-decoration: none;" title="Abrir en Google Colab para ejecutar con GPU/CPU">
                        <i class="fa-solid fa-play"></i> Abrir y Ejecutar en Google Colab
                    </a>
                </div>
                
                <!-- Celdas del Cuaderno -->
                <div style="padding: 20px; max-height: 520px; overflow-y: auto; color: #d4d4d4;">
        `;

        if (Array.isArray(notebook.cells)) {
            notebook.cells.forEach((cell, idx) => {
                const sourceText = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
                
                if (cell.cell_type === 'markdown') {
                    // Renderizar Markdown limpio
                    const escaped = sourceText
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/^### (.*$)/gim, '<h3 style="color: #60a5fa; font-size: 1.05rem; margin: 14px 0 6px 0;">$1</h3>')
                        .replace(/^## (.*$)/gim, '<h2 style="color: #93c5fd; font-size: 1.18rem; margin: 16px 0 8px 0; font-weight: 700;">$1</h2>')
                        .replace(/^# (.*$)/gim, '<h1 style="color: #bfdbfe; font-size: 1.35rem; margin: 18px 0 10px 0;">$1</h1>')
                        .replace(/\*\*(.*?)\*\*/gim, '<strong style="color: #fff;">$1</strong>')
                        .replace(/`([^`]+)`/gim, '<code style="background: #27272a; color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-size: 0.85em;">$1</code>')
                        .replace(/\n/gim, '<br>');

                    notebookHtml += `
                        <div style="margin-bottom: 16px; line-height: 1.65; font-size: 0.92rem; color: #e5e7eb;">
                            ${escaped}
                        </div>
                    `;
                } else if (cell.cell_type === 'code') {
                    // Renderizar Celda de Código
                    const escapedCode = sourceText
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');

                    // Renderizar Outputs si existen
                    let outputHtml = '';
                    if (Array.isArray(cell.outputs) && cell.outputs.length > 0) {
                        cell.outputs.forEach(out => {
                            if (out.text) {
                                const outText = Array.isArray(out.text) ? out.text.join('') : out.text;
                                outputHtml += `<pre style="margin: 0; padding: 10px 14px; background: #131416; color: #a1a1aa; font-family: 'Consolas', 'Fira Code', monospace; font-size: 0.82rem; border-left: 3px solid var(--siemens-teal); white-space: pre-wrap; line-height: 1.5;">${outText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
                            }
                        });
                    }

                    const copyData = sourceText.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

                    notebookHtml += `
                        <div style="margin-bottom: 18px; border-radius: 8px; overflow: hidden; border: 1px solid #33383f; background: #111214;">
                            <div style="display: flex; justify-content: space-between; align-items: center; background: #1a1d21; padding: 6px 14px; border-bottom: 1px solid #272b30;">
                                <span style="font-size: 0.72rem; font-family: monospace; color: #71717a; font-weight: 600;">[ ${cell.execution_count ? cell.execution_count : ' '} ] In Python:</span>
                                <button type="button" onclick="navigator.clipboard.writeText(\`${copyData}\`); if(window.showToast) window.showToast('Código copiado al portapapeles', 'success');" style="background: transparent; border: 0; color: #a1a1aa; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 2px 6px;">
                                    <i class="fa-regular fa-copy"></i> Copiar Código
                                </button>
                            </div>
                            <pre style="margin: 0; padding: 14px; background: #111214; color: #38bdf8; font-family: 'Consolas', 'Fira Code', monospace; font-size: 0.88rem; line-height: 1.55; overflow-x: auto; white-space: pre;"><code>${escapedCode}</code></pre>
                            ${outputHtml ? `<div style="border-top: 1px solid #272b30; background: #131416;">${outputHtml}</div>` : ''}
                        </div>
                    `;
                }
            });
        }

        notebookHtml += `
                </div>
            </div>
        `;

        containerElement.innerHTML = notebookHtml;
    } catch (err) {
        console.warn("No se pudo cargar el cuaderno directamente, mostrando fallback:", err);
        containerElement.innerHTML = `
            <div style="background: linear-gradient(135deg, #1e293b, #0f172a); border: 1.5px solid var(--border-color); border-radius: 12px; padding: 28px 20px; text-align: center; margin-bottom: 20px;">
                <i class="fa-brands fa-python" style="font-size: 2.8rem; color: #38bdf8; margin-bottom: 12px; display: block;"></i>
                <h3 style="color: #fff; font-size: 1.1rem; margin-bottom: 8px;">Cuaderno de Google Colab / Jupyter</h3>
                <p style="color: var(--text-secondary); font-size: 0.85rem; max-width: 440px; margin: 0 auto 16px auto;">
                    Este laboratorio contiene ejercicios prácticos listos para ejecutarse en la nube con Google Colab.
                </p>
                <a href="${directUrl}" target="_blank" class="btn btn-orange" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 700; padding: 8px 20px; text-decoration: none;">
                    <i class="fa-solid fa-play"></i> Abrir y Ejecutar en Google Colab
                </a>
            </div>
        `;
    }
}

// Cambiar pestaña multimedia activa en el Aula Virtual
window.switchMediaTab = function(tabId, btn) {
    document.querySelectorAll('.media-tab-btn').forEach(b => {
        b.classList.remove('active-tab');
        b.style.background = 'var(--bg-body)';
        b.style.color = 'var(--text-secondary)';
        b.style.borderColor = 'var(--border-color)';
    });
    if (btn) {
        btn.classList.add('active-tab');
        btn.style.background = 'var(--siemens-teal)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--siemens-teal)';
    }
    document.querySelectorAll('.media-content-pane').forEach(pane => {
        pane.style.display = 'none';
    });
    const target = document.getElementById(`mediaPane_${tabId}`);
    if (target) target.style.display = 'block';
};

// Renderizar Cursos en el Catálogo
export function renderCourses() {
    const grid = document.getElementById('coursesGrid');
    const myGrid = document.getElementById('myCoursesGrid');
    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const isTeacher = (currentUserRole === 'profesor' || currentUserRole === 'docente' || currentUserRole === 'admin');
    const currentUserId = currentAuthUser ? currentAuthUser.uid : null;

    // Filtrar cursos para el catálogo:
    // Si es estudiante: solo cursos con activo !== false
    // Si es profesor: ve todos (los ocultos llevan etiqueta)
    let filtered = coursesList.filter(c => {
        const isVisible = isTeacher ? true : (c.activo !== false);
        const matchCategory = currentCategory === 'all' || c.category === currentCategory;
        const matchSearch = (c.title || '').toLowerCase().includes(searchQuery) ||
                            (c.instructor || '').toLowerCase().includes(searchQuery) ||
                            (c.category || '').toLowerCase().includes(searchQuery);
        return isVisible && matchCategory && matchSearch;
    });

    if (grid) {
        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1.5px dashed var(--border-color);">
                    <i class="fa-solid fa-graduation-cap" style="font-size: 2.5rem; margin-bottom: 12px; display: block; color: var(--siemens-teal);"></i>
                    <h3 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 6px;">
                        ${isTeacher ? 'No has publicado cursos aún' : 'No hay cursos disponibles por el momento'}
                    </h3>
                    <p style="font-size: 0.85rem; max-width: 420px; margin: 0 auto 16px auto;">
                        ${isTeacher ? 'Haz clic en el botón "Crear Curso" para subir tu primer curso con videos de YouTube y diapositivas de Google Drive.' : 'Vuelve pronto para explorar nuevos cursos o únete a las clases en vivo.'}
                    </p>
                    ${isTeacher ? `
                        <button class="btn btn-primary" onclick="openCreateCourseModal()">
                            <i class="fa-solid fa-plus"></i> Crear Mi Primer Curso
                        </button>` : ''}
                </div>`;
        } else {
            grid.innerHTML = filtered.map(course => {
                const isEnrolled = currentUserId && Array.isArray(course.inscritos) && course.inscritos.includes(currentUserId);
                const isHidden = course.activo === false;

                return `
                <div class="course-card ${isHidden ? 'is-hidden-course' : ''}" onclick="openCourseDetail('${course.id}')" style="${isHidden ? 'opacity: 0.7; border: 1.5px dashed #ef4444;' : ''}">
                    <div class="course-img-wrapper">
                        <div class="course-icon-bg">
                            <i class="fa-solid ${course.icon || 'fa-graduation-cap'}"></i>
                        </div>
                        <span class="course-badge">${course.category || 'General'}</span>
                        <span class="course-level-badge">${course.level || 'Principiante'}</span>
                        ${isHidden ? '<span style="position: absolute; bottom: 8px; left: 8px; background: #ef4444; color: #fff; font-size: 0.65rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.05em;"><i class="fa-solid fa-eye-slash"></i> OCULTO</span>' : ''}
                    </div>
                    <div class="course-body">
                        <div class="course-category">${course.category || ''} • ${course.duration || '20 horas'}</div>
                        <h3 class="course-title">${course.title}</h3>
                        <p class="course-desc">${course.description || 'Sin descripción disponible.'}</p>
                        <div class="course-meta">
                            <span><i class="fa-regular fa-user"></i> ${course.instructor || 'Profesor'}</span>
                        </div>
                        
                        <div class="course-footer" style="flex-wrap: wrap; gap: 8px;">
                            ${isTeacher ? `
                                <!-- ACCIONES DE PROFESOR: EDITAR Y OCULTAR -->
                                <div style="display: flex; gap: 6px; width: 100%; justify-content: space-between; align-items: center;">
                                    <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openEditCourseModal('${course.id}')" title="Editar información y enlaces del curso">
                                        <i class="fa-solid fa-pen-to-square"></i> Editar
                                    </button>
                                    <button class="btn btn-sm ${isHidden ? 'btn-green' : 'btn-outline'}" onclick="event.stopPropagation(); toggleHideCourse('${course.id}')" title="${isHidden ? 'Volver a mostrar en el catálogo' : 'Ocultar curso del catálogo'}">
                                        <i class="fa-solid ${isHidden ? 'fa-eye' : 'fa-eye-slash'}"></i> ${isHidden ? 'Reactivar' : 'Ocultar'}
                                    </button>
                                </div>
                            ` : `
                                <!-- ACCIÓN DE ESTUDIANTE: INSCRIBIRME -->
                                <span class="course-price">${course.price || 'Gratis'}</span>
                                <button class="btn btn-sm ${isEnrolled ? 'btn-green' : 'btn-outline'}" onclick="event.stopPropagation(); toggleEnroll('${course.id}')">
                                    ${isEnrolled ? '<i class="fa-solid fa-check"></i> Inscrito' : '<i class="fa-solid fa-plus"></i> Inscribirme'}
                                </button>
                            `}
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        }
    }

    // Renderizar Mis Cursos Inscritos (Para estudiantes y profesores)
    const myEnrolled = coursesList.filter(c => {
        if (!currentUserId) return false;
        return Array.isArray(c.inscritos) && c.inscritos.includes(currentUserId);
    });

    if (myGrid) {
        if (myEnrolled.length === 0) {
            myGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1.5px dashed var(--border-color);">
                    <i class="fa-solid fa-book-open-reader" style="font-size: 2.5rem; margin-bottom: 12px; display: block; color: var(--ubuntu-orange);"></i>
                    <h3 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 6px;">No tienes cursos inscritos aún</h3>
                    <p style="font-size: 0.85rem; max-width: 400px; margin: 0 auto 16px auto;">Explora nuestro catálogo de cursos especializados y presiona "Inscribirme" para empezar tu ruta de aprendizaje.</p>
                    <button class="btn btn-outline" onclick="switchView('view-courses', document.querySelectorAll('.nav-item')[0])">
                        <i class="fa-solid fa-compass"></i> Explorar Catálogo de Cursos
                    </button>
                </div>`;
        } else {
            myGrid.innerHTML = myEnrolled.map(course => `
                <div class="course-card" onclick="openCourseDetail('${course.id}')">
                    <div class="course-img-wrapper">
                        <div class="course-icon-bg" style="background: linear-gradient(135deg, #1E2225, var(--siemens-teal));">
                            <i class="fa-solid ${course.icon || 'fa-graduation-cap'}"></i>
                        </div>
                        <span class="course-badge">${course.category || 'General'}</span>
                    </div>
                    <div class="course-body">
                        <div class="course-category"><i class="fa-solid fa-circle-check" style="color: var(--ubuntu-green);"></i> Inscrito • Materiales Listos</div>
                        <h3 class="course-title">${course.title}</h3>
                        <p class="course-desc">${course.description || ''}</p>
                        <div class="course-footer">
                            <button class="btn btn-primary btn-sm" style="width: 100%; justify-content: center;" onclick="event.stopPropagation(); openCourseDetail('${course.id}')">
                                <i class="fa-solid fa-play"></i> Ingresar al Aula Virtual
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }
}

// Inscribirse / Cancelar Inscripción (Persistente en Firestore)
export async function toggleEnroll(id) {
    if (!currentAuthUser) {
        if (window.showToast) window.showToast('Debes iniciar sesión para inscribirte.', 'normal');
        return;
    }

    const course = coursesList.find(c => c.id === id);
    if (!course) return;

    const currentUserId = currentAuthUser.uid;
    const isEnrolled = Array.isArray(course.inscritos) && course.inscritos.includes(currentUserId);

    try {
        if (dbInstance) {
            const courseRef = doc(dbInstance, 'cursos', id);
            if (isEnrolled) {
                await updateDoc(courseRef, {
                    inscritos: arrayRemove(currentUserId)
                });
                if (window.showToast) window.showToast(`Has cancelado tu inscripción en "${course.title}".`);
            } else {
                await updateDoc(courseRef, {
                    inscritos: arrayUnion(currentUserId)
                });
                if (window.showToast) window.showToast(`¡Te has inscrito en "${course.title}"!`, 'success');
            }
        }
    } catch (error) {
        console.error("Error al actualizar inscripción:", error);
        // Fallback local
        if (isEnrolled) {
            course.inscritos = course.inscritos.filter(uid => uid !== currentUserId);
        } else {
            course.inscritos.push(currentUserId);
        }
        renderCourses();
    }
}

// Ocultar / Reactivar Curso (Soft Delete para Profesor)
export async function toggleHideCourse(id) {
    const course = coursesList.find(c => c.id === id);
    if (!course) return;

    const newActiveState = course.activo === false ? true : false;

    try {
        if (dbInstance) {
            const courseRef = doc(dbInstance, 'cursos', id);
            await updateDoc(courseRef, {
                activo: newActiveState
            });
        } else {
            course.activo = newActiveState;
            renderCourses();
        }

        if (window.showToast) {
            if (newActiveState) {
                window.showToast(`El curso "${course.title}" ahora es visible en el catálogo.`, 'success');
            } else {
                window.showToast(`El curso "${course.title}" ha sido ocultado del catálogo.`);
            }
        }
    } catch (error) {
        console.error("Error al cambiar estado del curso:", error);
        if (window.showToast) window.showToast("Error al modificar el estado del curso.");
    }
}

// Abrir Modal para Editar Curso
export function openEditCourseModal(id) {
    const course = coursesList.find(c => c.id === id);
    if (!course) return;

    document.getElementById('editCourseId').value = course.id;
    document.getElementById('editCourseTitle').value = course.title || '';
    document.getElementById('editCourseCategory').value = course.category || 'IA';
    document.getElementById('editCourseLevel').value = course.level || 'Principiante';
    document.getElementById('editCourseInstructor').value = course.instructor || currentUserName;
    document.getElementById('editCourseDuration').value = course.duration || '20 horas';
    document.getElementById('editCourseDescription').value = course.description || '';
    document.getElementById('editCourseIcon').value = course.icon || 'fa-graduation-cap';
    document.getElementById('editCourseVideoUrl').value = course.videoUrl || '';
    document.getElementById('editCoursePdfUrl').value = course.pdfUrl || '';
    document.getElementById('editCourseResourceUrl').value = course.resourceUrl || '';

    const modal = document.getElementById('editCourseModal');
    if (modal) modal.classList.add('active');
}

// Guardar Cambios de Edición en Firestore
export async function handleSaveEditCourse(e) {
    e.preventDefault();

    const id = document.getElementById('editCourseId').value;
    const title = document.getElementById('editCourseTitle').value.trim();
    const category = document.getElementById('editCourseCategory').value;
    const level = document.getElementById('editCourseLevel').value;
    const instructor = document.getElementById('editCourseInstructor').value.trim();
    const duration = document.getElementById('editCourseDuration').value.trim() || '20 horas';
    const description = document.getElementById('editCourseDescription').value.trim();
    const icon = document.getElementById('editCourseIcon').value || 'fa-graduation-cap';
    const videoUrl = document.getElementById('editCourseVideoUrl').value.trim();
    const pdfUrl = document.getElementById('editCoursePdfUrl').value.trim();
    const resourceUrl = document.getElementById('editCourseResourceUrl').value.trim();

    const updatedData = {
        title,
        category,
        level,
        instructor,
        duration,
        description,
        icon,
        videoUrl,
        pdfUrl,
        resourceUrl,
        updatedAt: new Date().toISOString()
    };

    try {
        if (dbInstance) {
            const courseRef = doc(dbInstance, 'cursos', id);
            await updateDoc(courseRef, updatedData);
        } else {
            const course = coursesList.find(c => c.id === id);
            if (course) Object.assign(course, updatedData);
            renderCourses();
        }

        if (window.closeModal) window.closeModal('editCourseModal');
        if (window.showToast) window.showToast(`¡Curso "${title}" actualizado con éxito!`, 'success');
    } catch (error) {
        console.error("Error al guardar edición en Firestore:", error);
        if (window.showToast) window.showToast("Error al guardar los cambios.");
    }
}

// Abrir Aula Virtual / Detalle del Curso (Modal con Video YouTube, PDF y Recursos)
export function openCourseDetail(id) {
    const course = coursesList.find(c => c.id === id);
    if (!course) return;

    const modal = document.getElementById('courseDetailModal');
    if (!modal) return;

    const isTeacher = (currentUserRole === 'profesor' || currentUserRole === 'docente' || currentUserRole === 'admin');
    const currentUserId = currentAuthUser ? currentAuthUser.uid : null;
    const isEnrolled = currentUserId && Array.isArray(course.inscritos) && course.inscritos.includes(currentUserId);

    document.getElementById('detailCourseTitle').textContent = course.title;
    document.getElementById('detailCourseCategory').textContent = `${course.category || 'Curso'} • Nivel ${course.level || 'Principiante'}`;
    document.getElementById('detailCourseInstructor').innerHTML = `<i class="fa-regular fa-user"></i> Instructor: <strong>${course.instructor}</strong> • Duración: ${course.duration || '20 horas'}`;
    document.getElementById('detailCourseDesc').textContent = course.description || 'Sin descripción adicional.';

    const videoContainer = document.getElementById('detailVideoContainer');
    const videoEmbedUrl = getYouTubeEmbedUrl(course.videoUrl);
    const docEmbedUrl = getEmbeddableDocumentUrl(course.pdfUrl);
    const resourceInfo = getEmbeddableResourceUrl(course.resourceUrl);

    const mediaList = [];
    if (videoEmbedUrl) {
        mediaList.push({
            id: 'video',
            type: 'iframe',
            title: 'Video de Clase',
            icon: 'fa-brands fa-youtube',
            iconColor: '#ff4d4d',
            embedUrl: videoEmbedUrl,
            directUrl: course.videoUrl,
            aspectRatio: '56.25%',
            actionLabel: 'Ver en YouTube'
        });
    }
    if (docEmbedUrl) {
        mediaList.push({
            id: 'doc',
            type: 'iframe',
            title: 'Diapositivas / PDF',
            icon: 'fa-solid fa-file-powerpoint',
            iconColor: 'var(--ubuntu-orange)',
            embedUrl: docEmbedUrl,
            directUrl: course.pdfUrl,
            aspectRatio: '58%',
            actionLabel: 'Pantalla Completa'
        });
    }
    if (resourceInfo) {
        mediaList.push({
            id: 'resource',
            type: resourceInfo.type,
            title: resourceInfo.title,
            icon: resourceInfo.icon,
            iconColor: resourceInfo.iconColor || 'var(--siemens-teal)',
            rawUrl: resourceInfo.rawUrl,
            embedUrl: resourceInfo.embedUrl,
            directUrl: resourceInfo.directUrl,
            aspectRatio: resourceInfo.aspectRatio || '68%',
            actionLabel: resourceInfo.actionLabel
        });
    }

    if (mediaList.length > 1) {
        // MÚLTIPLES MATERIALES: Pestañas para alternar entre Video, Diapositivas y Colab
        videoContainer.innerHTML = `
            <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
                ${mediaList.map((m, idx) => `
                    <button type="button" class="btn btn-sm media-tab-btn ${idx === 0 ? 'active-tab' : ''}" onclick="switchMediaTab('${m.id}', this)" style="background: ${idx === 0 ? 'var(--siemens-teal)' : 'var(--bg-body)'}; color: ${idx === 0 ? '#fff' : 'var(--text-secondary)'}; border: 1.5px solid ${idx === 0 ? 'var(--siemens-teal)' : 'var(--border-color)'}; border-radius: 20px;">
                        <i class="${m.icon}" style="color: ${idx === 0 ? '#fff' : m.iconColor};"></i> ${m.title}
                    </button>
                `).join('')}
            </div>
            ${mediaList.map((m, idx) => `
                <div id="mediaPane_${m.id}" class="media-content-pane" style="display: ${idx === 0 ? 'block' : 'none'};">
                    ${m.type === 'notebook' ? `
                        <div id="notebookView_${m.id}"></div>
                    ` : `
                        <div style="display: flex; justify-content: flex-end; margin-bottom: 6px;">
                            <a href="${m.directUrl}" target="_blank" class="btn btn-outline btn-sm" style="padding: 4px 10px; font-size: 0.75rem;" title="${m.actionLabel}">
                                <i class="fa-solid fa-arrow-up-right-from-square"></i> ${m.actionLabel}
                            </a>
                        </div>
                        <div style="position: relative; padding-bottom: ${m.aspectRatio}; height: 0; overflow: hidden; border-radius: 12px; margin-bottom: 20px; box-shadow: var(--shadow-md); border: 1px solid var(--border-color);">
                            <iframe src="${m.embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>
                        </div>
                    `}
                </div>
            `).join('')}
        `;
        videoContainer.style.display = 'block';

        // Cargar cuadernos Jupyter asíncronamente
        mediaList.forEach(m => {
            if (m.type === 'notebook') {
                const nbContainer = document.getElementById(`notebookView_${m.id}`);
                if (nbContainer) loadAndRenderNotebook(nbContainer, m.rawUrl, m.directUrl);
            }
        });
    } else if (mediaList.length === 1) {
        // UN SOLO MATERIAL INTERACTIVO
        const item = mediaList[0];
        if (item.type === 'notebook') {
            videoContainer.innerHTML = `<div id="notebookView_single"></div>`;
            videoContainer.style.display = 'block';
            loadAndRenderNotebook(document.getElementById('notebookView_single'), item.rawUrl, item.directUrl);
        } else {
            videoContainer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 700; font-size: 0.85rem; color: var(--siemens-teal); display: flex; align-items: center; gap: 6px;">
                        <i class="${item.icon}" style="color: ${item.iconColor};"></i> ${item.title}
                    </span>
                    <a href="${item.directUrl}" target="_blank" class="btn btn-outline btn-sm" style="padding: 4px 10px; font-size: 0.75rem;" title="${item.actionLabel}">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> ${item.actionLabel}
                    </a>
                </div>
                <div style="position: relative; padding-bottom: ${item.aspectRatio}; height: 0; overflow: hidden; border-radius: 12px; margin-bottom: 20px; box-shadow: var(--shadow-md); border: 1px solid var(--border-color);">
                    <iframe src="${item.embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>
                </div>
            `;
            videoContainer.style.display = 'block';
        }
    } else if (course.videoUrl) {
        // Video no embebible
        videoContainer.innerHTML = `
            <div style="margin-bottom: 16px;">
                <a href="${course.videoUrl}" target="_blank" class="btn btn-orange" style="width: 100%; justify-content: center;">
                    <i class="fa-solid fa-play"></i> Ver Grabación de Clase (Google Drive / Enlace)
                </a>
            </div>`;
        videoContainer.style.display = 'block';
    } else {
        videoContainer.innerHTML = '';
        videoContainer.style.display = 'none';
    }

    // Botón PDF / Diapositivas (Enlace externo inferior)
    const btnPdf = document.getElementById('detailBtnPdf');
    if (btnPdf) {
        if (course.pdfUrl && !docEmbedUrl) {
            btnPdf.href = course.pdfUrl;
            btnPdf.style.display = 'inline-flex';
        } else {
            btnPdf.style.display = 'none';
        }
    }

    // Botón Recursos / Colab / GitHub (Enlace externo inferior)
    const btnResource = document.getElementById('detailBtnResource');
    if (btnResource) {
        if (course.resourceUrl && !resourceInfo) {
            btnResource.href = course.resourceUrl;
            btnResource.style.display = 'inline-flex';
        } else {
            btnResource.style.display = 'none';
        }
    }

    // Botón Inscribirse / Estado en Modal
    const btnEnroll = document.getElementById('detailBtnEnroll');
    if (btnEnroll) {
        if (isTeacher) {
            btnEnroll.className = 'btn btn-outline';
            btnEnroll.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar este Curso';
            btnEnroll.onclick = () => {
                window.closeModal('courseDetailModal');
                openEditCourseModal(course.id);
            };
        } else {
            btnEnroll.className = `btn ${isEnrolled ? 'btn-green' : 'btn-primary'}`;
            btnEnroll.innerHTML = isEnrolled ? '<i class="fa-solid fa-check"></i> Ya estás inscrito' : '<i class="fa-solid fa-plus"></i> Inscribirme a este Curso';
            btnEnroll.onclick = () => {
                toggleEnroll(course.id);
            };
        }
    }

    modal.classList.add('active');
}

// Guardar nuevo curso en Firestore (Cero consumo de Storage con Técnica del Enlace)
export async function handleCreateCourse(e) {
    e.preventDefault();

    const title = document.getElementById('courseTitle').value.trim();
    const category = document.getElementById('courseCategory').value;
    const level = document.getElementById('courseLevel').value;
    const instructor = (document.getElementById('courseInstructor') && document.getElementById('courseInstructor').value.trim()) || currentUserName;
    const duration = document.getElementById('courseDuration').value.trim() || '20 horas';
    const description = document.getElementById('courseDescription').value.trim();
    const icon = document.getElementById('courseIcon').value || 'fa-graduation-cap';
    
    // Enlaces de la Técnica del Enlace
    const videoUrl = document.getElementById('courseVideoUrl') ? document.getElementById('courseVideoUrl').value.trim() : '';
    const pdfUrl = document.getElementById('coursePdfUrl') ? document.getElementById('coursePdfUrl').value.trim() : '';
    const resourceUrl = document.getElementById('courseResourceUrl') ? document.getElementById('courseResourceUrl').value.trim() : '';

    const newCourseData = {
        title,
        category,
        level,
        instructor,
        duration,
        description,
        icon,
        videoUrl,
        pdfUrl,
        resourceUrl,
        rating: 5.0,
        reviews: 1,
        inscritos: [],
        activo: true,
        price: "Gratis",
        createdAt: new Date().toISOString()
    };

    try {
        if (dbInstance) {
            await addDoc(collection(dbInstance, 'cursos'), newCourseData);
        } else {
            newCourseData.id = 'local-' + Date.now();
            coursesList.unshift(newCourseData);
            renderCourses();
        }

        if (window.closeModal) window.closeModal('createCourseModal');
        document.getElementById('createCourseForm').reset();

        if (window.showToast) {
            window.showToast(`¡Curso "${title}" publicado con sus materiales!`, 'success');
        }
    } catch (error) {
        console.error("Error guardando curso en Firestore:", error);
        if (window.showToast) window.showToast(`Error al publicar el curso en la base de datos.`);
    }
}

// Filtros de categoría y búsqueda
export function setCategoryFilter(category, btn) {
    currentCategory = category;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderCourses();
}

export function filterCourses() {
    renderCourses();
}

// Exponer funciones a window para eventos HTML
window.renderCourses = renderCourses;
window.toggleEnroll = toggleEnroll;
window.openCourseDetail = openCourseDetail;
window.handleCreateCourse = handleCreateCourse;
window.openEditCourseModal = openEditCourseModal;
window.handleSaveEditCourse = handleSaveEditCourse;
window.toggleHideCourse = toggleHideCourse;
window.setCategoryFilter = setCategoryFilter;
window.filterCourses = filterCourses;
