// ==========================================
// CURSOS.JS - GESTIÓN DE CURSOS Y MATERIALES
// Cero costo en Firebase (Técnica del Enlace)
// ==========================================

import { collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Dataset inicial base para catálogo
const initialCoursesData = [
    {
        id: "base-1",
        title: "Inteligencia Artificial & Deep Learning Aplicado",
        category: "IA",
        level: "Intermedio",
        instructor: "Dra. Elena Rivera",
        duration: "32 horas",
        description: "Aprende redes neuronales convolucionales, transformers y creación de modelos predictivos con PyTorch.",
        rating: 4.9,
        reviews: 184,
        icon: "fa-brain",
        enrolled: true,
        price: "Gratis",
        videoUrl: "https://www.youtube.com/watch?v=aircAruvnKk",
        pdfUrl: "https://drive.google.com",
        resourceUrl: "https://colab.research.google.com"
    },
    {
        id: "base-2",
        title: "Matemáticas y Álgebra Lineal para Machine Learning",
        category: "Matemáticas",
        level: "Principiante",
        instructor: "Dr. Manuel Rojas",
        duration: "24 horas",
        description: "Vectores, matrices, cálculo multivariable y optimización matemática orientada a algoritmos inteligentes.",
        rating: 4.8,
        reviews: 95,
        icon: "fa-calculator",
        enrolled: true,
        price: "Gratis",
        videoUrl: "https://www.youtube.com/watch?v=fNk_zzaMoSs",
        pdfUrl: "https://drive.google.com",
        resourceUrl: "https://github.com"
    },
    {
        id: "base-3",
        title: "Desarrollo Web Full Stack con Node.js & React",
        category: "Programación",
        level: "Intermedio",
        instructor: "Ing. Carlos Mendoza",
        duration: "40 horas",
        description: "Crea aplicaciones modernas escalables con arquitectura REST, bases de datos PostgreSQL y frontend reactivo.",
        rating: 4.9,
        reviews: 240,
        icon: "fa-code",
        enrolled: false,
        price: "Gratis",
        videoUrl: "",
        pdfUrl: "",
        resourceUrl: "https://github.com"
    },
    {
        id: "base-4",
        title: "Robótica Industrial y Control de Automatización Siemens",
        category: "Ingeniería",
        level: "Avanzado",
        instructor: "Ing. Klaus Schmidt",
        duration: "28 horas",
        description: "Programación de PLCs Siemens S7-1200/1500, TIA Portal y protocolos industriales Profinet.",
        rating: 5.0,
        reviews: 78,
        icon: "fa-robot",
        enrolled: false,
        price: "Certificado Siemens",
        videoUrl: "",
        pdfUrl: "https://drive.google.com",
        resourceUrl: ""
    }
];

let coursesList = [...initialCoursesData];
let currentCategory = 'all';
let dbInstance = null;

// Inicializador del módulo con Firestore
export function initCursosModule(db) {
    dbInstance = db;
    
    // Escuchar cursos en tiempo real desde Firestore (Colección 'cursos')
    try {
        const cursosRef = collection(db, 'cursos');
        onSnapshot(cursosRef, (snapshot) => {
            const firestoreCourses = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                firestoreCourses.push({
                    id: doc.id,
                    ...data
                });
            });

            // Combinar los de Firestore primero + los iniciales que no colisionen
            coursesList = [...firestoreCourses, ...initialCoursesData.filter(ic => !firestoreCourses.some(fc => fc.id === ic.id))];
            renderCourses();
        }, (error) => {
            console.warn("Aviso de Firestore (Cursos): usando datos locales:", error);
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

// Renderizar Cursos en el Catálogo
export function renderCourses() {
    const grid = document.getElementById('coursesGrid');
    const myGrid = document.getElementById('myCoursesGrid');
    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filtered = coursesList.filter(c => {
        const matchCategory = currentCategory === 'all' || c.category === currentCategory;
        const matchSearch = (c.title || '').toLowerCase().includes(searchQuery) ||
                            (c.instructor || '').toLowerCase().includes(searchQuery) ||
                            (c.category || '').toLowerCase().includes(searchQuery);
        return matchCategory && matchSearch;
    });

    if (grid) {
        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                    <i class="fa-solid fa-search" style="font-size: 2rem; margin-bottom: 12px; display: block;"></i>
                    No se encontraron cursos con los filtros seleccionados.
                </div>`;
        } else {
            grid.innerHTML = filtered.map(course => `
                <div class="course-card" onclick="openCourseDetail('${course.id}')">
                    <div class="course-img-wrapper">
                        <div class="course-icon-bg">
                            <i class="fa-solid ${course.icon || 'fa-graduation-cap'}"></i>
                        </div>
                        <span class="course-badge">${course.category}</span>
                        <span class="course-level-badge">${course.level}</span>
                    </div>
                    <div class="course-body">
                        <div class="course-category">${course.category} • ${course.duration || '20 horas'}</div>
                        <h3 class="course-title">${course.title}</h3>
                        <p class="course-desc">${course.description || 'Sin descripción disponible.'}</p>
                        <div class="course-meta">
                            <span><i class="fa-regular fa-user"></i> ${course.instructor}</span>
                        </div>
                        <div class="course-rating">
                            <span class="stars">★★★★★</span>
                            <span class="rating-num">${course.rating || 5.0}</span>
                            <span class="rating-count">(${course.reviews || 1})</span>
                        </div>
                        <div class="course-footer">
                            <span class="course-price">${course.price || 'Gratis'}</span>
                            <button class="btn btn-sm ${course.enrolled ? 'btn-green' : 'btn-outline'}" onclick="event.stopPropagation(); toggleEnroll('${course.id}')">
                                ${course.enrolled ? '<i class="fa-solid fa-check"></i> Inscrito' : '<i class="fa-solid fa-plus"></i> Inscribirme'}
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    // Renderizar Mis Cursos Inscritos
    const myEnrolled = coursesList.filter(c => c.enrolled);
    if (myGrid) {
        if (myEnrolled.length === 0) {
            myGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                    No tienes cursos inscritos aún. ¡Explora el catálogo e inscríbete para empezar a aprender!
                </div>`;
        } else {
            myGrid.innerHTML = myEnrolled.map(course => `
                <div class="course-card" onclick="openCourseDetail('${course.id}')">
                    <div class="course-img-wrapper">
                        <div class="course-icon-bg" style="background: linear-gradient(135deg, #1E2225, var(--siemens-teal));">
                            <i class="fa-solid ${course.icon || 'fa-graduation-cap'}"></i>
                        </div>
                        <span class="course-badge">${course.category}</span>
                    </div>
                    <div class="course-body">
                        <div class="course-category">En Progreso • Materiales Disponibles</div>
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

// Inscribirse / Cancelar Inscripción
export function toggleEnroll(id) {
    const course = coursesList.find(c => c.id === id);
    if (course) {
        course.enrolled = !course.enrolled;
        renderCourses();
        if (window.showToast) {
            if (course.enrolled) {
                window.showToast(`¡Te has inscrito en "${course.title}"!`, 'success');
            } else {
                window.showToast(`Has cancelado tu inscripción en "${course.title}".`);
            }
        }
    }
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

// Abrir Aula Virtual / Detalle del Curso (Modal con Video YouTube, PDF y Recursos)
export function openCourseDetail(id) {
    const course = coursesList.find(c => c.id === id);
    if (!course) return;

    const modal = document.getElementById('courseDetailModal');
    if (!modal) return;

    document.getElementById('detailCourseTitle').textContent = course.title;
    document.getElementById('detailCourseCategory').textContent = `${course.category} • Nivel ${course.level}`;
    document.getElementById('detailCourseInstructor').innerHTML = `<i class="fa-regular fa-user"></i> Instructor: <strong>${course.instructor}</strong> • Duración: ${course.duration || '20 horas'}`;
    document.getElementById('detailCourseDesc').textContent = course.description || 'Sin descripción adicional.';

    const videoContainer = document.getElementById('detailVideoContainer');
    const videoEmbedUrl = getYouTubeEmbedUrl(course.videoUrl);
    const docEmbedUrl = getEmbeddableDocumentUrl(course.pdfUrl);

    // Contenido multimedia interactivo (Video y/o Diapositivas)
    if (videoEmbedUrl && docEmbedUrl) {
        // AMBOS PRESENTES: Renderizar pestañas para alternar entre video y diapositivas
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
        // SOLO DIAPOSITIVAS / DOCUMENTO (Google Slides / Google Drive PDF)
        videoContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <span style="font-weight: 700; font-size: 0.85rem; color: var(--siemens-teal); display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-file-powerpoint" style="color: var(--ubuntu-orange);"></i> Diapositivas Interactivas
                </span>
                <a href="${course.pdfUrl}" target="_blank" class="btn btn-outline btn-sm" style="padding: 4px 10px; font-size: 0.75rem;" title="Abrir en pestaña completa de Google Drive">
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
        // Enlace de video no embebible (ej: link crudo de Drive)
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

    // Botón Inscribirse / Estado
    const btnEnroll = document.getElementById('detailBtnEnroll');
    if (btnEnroll) {
        btnEnroll.className = `btn ${course.enrolled ? 'btn-green' : 'btn-primary'}`;
        btnEnroll.innerHTML = course.enrolled ? '<i class="fa-solid fa-check"></i> Ya estás inscrito' : '<i class="fa-solid fa-plus"></i> Inscribirme a este Curso';
        btnEnroll.onclick = () => {
            toggleEnroll(course.id);
            openCourseDetail(course.id);
        };
    }

    modal.classList.add('active');
}

// Guardar nuevo curso en Firestore (Cero consumo de Storage con Técnica del Enlace)
export async function handleCreateCourse(e) {
    e.preventDefault();

    const title = document.getElementById('courseTitle').value.trim();
    const category = document.getElementById('courseCategory').value;
    const level = document.getElementById('courseLevel').value;
    const instructor = (document.getElementById('courseInstructor') && document.getElementById('courseInstructor').value.trim()) || 'Profesor';
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
        enrolled: false,
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
        newCourseData.id = 'local-' + Date.now();
        coursesList.unshift(newCourseData);
        renderCourses();
        if (window.closeModal) window.closeModal('createCourseModal');
        if (window.showToast) {
            window.showToast(`¡Curso "${title}" publicado localmente!`, 'success');
        }
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
window.setCategoryFilter = setCategoryFilter;
window.filterCourses = filterCourses;
