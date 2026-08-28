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

// Cambiar pestaña multimedia entre Video y Diapositivas
window.switchMediaTab = function(tabName, btn) {
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
    const videoPane = document.getElementById('mediaPaneVideo');
    const docPane = document.getElementById('mediaPaneDoc');
    if (videoPane) videoPane.style.display = (tabName === 'video') ? 'block' : 'none';
    if (docPane) docPane.style.display = (tabName === 'doc') ? 'block' : 'none';
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

    // Contenido multimedia interactivo (Video y/o Diapositivas)
    if (videoEmbedUrl && docEmbedUrl) {
        // AMBOS PRESENTES: Pestañas interactivas
        videoContainer.innerHTML = `
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <button type="button" class="btn btn-sm media-tab-btn" onclick="switchMediaTab('video', this)" style="background: var(--siemens-teal); color: #fff; border: 1.5px solid var(--siemens-teal); border-radius: 20px;">
                    <i class="fa-brands fa-youtube" style="color: #ff4d4d;"></i> Video de Clase
                </button>
                <button type="button" class="btn btn-sm media-tab-btn" onclick="switchMediaTab('doc', this)" style="background: var(--bg-body); color: var(--text-secondary); border: 1.5px solid var(--border-color); border-radius: 20px;">
                    <i class="fa-solid fa-file-powerpoint" style="color: var(--ubuntu-orange);"></i> Diapositivas / Material
                </button>
            </div>
            <div id="mediaPaneVideo" style="display: block; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; margin-bottom: 20px; box-shadow: var(--shadow-md); border: 1px solid var(--border-color);">
                <iframe src="${videoEmbedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
            <div id="mediaPaneDoc" style="display: none; position: relative; padding-bottom: 58%; height: 0; overflow: hidden; border-radius: 12px; margin-bottom: 20px; box-shadow: var(--shadow-md); border: 1px solid var(--border-color);">
                <iframe src="${docEmbedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>
            </div>
        `;
        videoContainer.style.display = 'block';
    } else if (docEmbedUrl) {
        // SOLO DIAPOSITIVAS / PRESENTACIÓN DE GOOGLE SLIDES / PDF
        videoContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <span style="font-weight: 700; font-size: 0.85rem; color: var(--siemens-teal); display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-file-powerpoint" style="color: var(--ubuntu-orange);"></i> Diapositivas Interactivas
                </span>
                <a href="${course.pdfUrl}" target="_blank" class="btn btn-outline btn-sm" style="padding: 4px 10px; font-size: 0.75rem;" title="Abrir en pestaña completa">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Pantalla Completa
                </a>
            </div>
            <div style="position: relative; padding-bottom: 58%; height: 0; overflow: hidden; border-radius: 12px; margin-bottom: 20px; box-shadow: var(--shadow-md); border: 1px solid var(--border-color);">
                <iframe src="${docEmbedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>
            </div>`;
        videoContainer.style.display = 'block';
    } else if (videoEmbedUrl) {
        // SOLO VIDEO DE YOUTUBE
        videoContainer.innerHTML = `
            <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; margin-bottom: 20px; box-shadow: var(--shadow-md); border: 1px solid var(--border-color);">
                <iframe src="${videoEmbedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>`;
        videoContainer.style.display = 'block';
    } else if (course.videoUrl) {
        // Enlace no embebible
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

    // Botón PDF / Diapositivas (Enlace externo)
    const btnPdf = document.getElementById('detailBtnPdf');
    if (btnPdf) {
        if (course.pdfUrl) {
            btnPdf.href = course.pdfUrl;
            btnPdf.style.display = 'inline-flex';
        } else {
            btnPdf.style.display = 'none';
        }
    }

    // Botón Recursos / Colab / GitHub
    const btnResource = document.getElementById('detailBtnResource');
    if (btnResource) {
        if (course.resourceUrl) {
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
