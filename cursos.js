// ==========================================
// CURSOS.JS - GESTIÓN DE CURSOS Y MATERIALES
// Cero costo en Firebase (Técnica del Enlace)
// ==========================================

import { 
    collection, 
    addDoc, 
    doc, 
    updateDoc, 
    deleteDoc,
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

// Validar si el usuario activo tiene permisos para editar, gestionar o eliminar un curso
export function canUserEditCourse(course) {
    if (!currentAuthUser) return false;
    if (currentUserRole === 'admin') return true;
    const isTeacher = (currentUserRole === 'profesor' || currentUserRole === 'docente' || currentUserRole === 'instructor' || currentUserRole === 'teacher');
    if (!isTeacher) return false;
    
    // Si el curso tiene autor asignado, verificar coincidencia con el UID o correo del usuario
    if (course && course.authorId) {
        return course.authorId === currentAuthUser.uid;
    }
    if (course && course.authorEmail && currentAuthUser.email) {
        return course.authorEmail === currentAuthUser.email;
    }
    
    // Cursos preexistentes sin autor solo pueden ser gestionados por admin
    return currentUserRole === 'admin';
}
window.canUserEditCourse = canUserEditCourse;

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

    // Configurar feedback dinámico para inputs de Canva
    setTimeout(() => {
        setupCanvaInputFeedback('courseWeekCanvaUrl');
        setupCanvaInputFeedback('weekInputCanvaUrl');
    }, 100);
}

// Configurar feedback en tiempo real para inputs de Canva
function setupCanvaInputFeedback(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('input', () => {
        const val = input.value.trim();
        const hintEl = input.nextElementSibling;
        if (!hintEl || hintEl.tagName !== 'SMALL') return;

        if (!val) {
            hintEl.innerHTML = '💡 Pega el enlace de tu diseño de Canva o el código de inserción (Compartir &gt; Más &gt; Insertar).';
            hintEl.style.color = 'var(--text-muted)';
        } else if (val.includes('canva.link/')) {
            hintEl.innerHTML = '⚠️ <strong>Enlace corto detectado:</strong> Para que se previsualice interactivamente aquí dentro, abre ese enlace en tu navegador y copia la URL completa (<code>canva.com/design/...</code>) o desde <em>Compartir &gt; Más &gt; Insertar</em>.';
            hintEl.style.color = 'var(--ubuntu-orange)';
        } else if (val.includes('canva.com/design/') || val.includes('<iframe')) {
            hintEl.innerHTML = '✅ <strong>¡Perfecto!</strong> Esta presentación de Canva se previsualizará interactivamente para tus alumnos.';
            hintEl.style.color = 'var(--ubuntu-green)';
        }
    });
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

// Convertir enlace o código de inserción de Canva a información embebible (0% egress vía iframe oficial)
export function getEmbeddableCanvaInfo(url) {
    if (!url) return null;
    let cleanUrl = url.trim();

    // Si el usuario pegó el código iframe completo de Canva
    if (cleanUrl.includes('<iframe')) {
        const srcMatch = cleanUrl.match(/src=["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
            cleanUrl = srcMatch[1].trim();
        }
    }

    // Caso 1: Enlace completo de diseño canva.com/design/...
    if (cleanUrl.includes('canva.com/design/')) {
        // Si ya incluye view?embed o watch?embed
        if (cleanUrl.includes('view?embed') || cleanUrl.includes('watch?embed')) {
            return {
                type: 'iframe',
                embedUrl: cleanUrl,
                directUrl: cleanUrl.replace('?embed', '').replace('&embed', ''),
                isEmbeddable: true
            };
        }

        // Extraer ID y posible hash de visualización
        // Formato: /design/DAHTEtNuW8Y/t-09vJfZhZw64L3fdrRJlQ/view o /edit o /watch
        const match = cleanUrl.match(/canva\.com\/design\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?/);
        if (match && match[1]) {
            const designId = match[1];
            const viewHash = match[2];

            let embedUrl = '';
            let directUrl = cleanUrl;

            if (viewHash && !['view', 'edit', 'watch', 'present'].includes(viewHash.toLowerCase())) {
                embedUrl = `https://www.canva.com/design/${designId}/${viewHash}/view?embed`;
                directUrl = `https://www.canva.com/design/${designId}/${viewHash}/view`;
            } else {
                embedUrl = `https://www.canva.com/design/${designId}/view?embed`;
                directUrl = `https://www.canva.com/design/${designId}/view`;
            }

            return {
                type: 'iframe',
                embedUrl,
                directUrl,
                isEmbeddable: true
            };
        }
    }

    // Caso 2: Enlace corto canva.link/XXXXX
    if (cleanUrl.includes('canva.link/')) {
        return {
            type: 'canva_notice',
            directUrl: cleanUrl,
            isEmbeddable: false
        };
    }

    return null;
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

    // Canva (Compatibilidad directa en caso de ser colocado en el campo de diapositivas)
    if (cleanUrl.includes('canva.com/design/')) {
        const canvaInfo = getEmbeddableCanvaInfo(cleanUrl);
        if (canvaInfo && canvaInfo.embedUrl) {
            return canvaInfo.embedUrl;
        }
    }

    // Archivo PDF directo en internet
    if (cleanUrl.toLowerCase().endsWith('.pdf')) {
        return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(cleanUrl)}`;
    }

    return null;
}

// Obtener URL oficial de descarga directa de documentos (0% Egress, servidores de Google)
export function getDownloadableDocumentUrl(url) {
    if (!url) return null;
    const cleanUrl = url.trim();

    // Google Slides -> Exportar directamente como PDF oficial
    if (cleanUrl.includes('docs.google.com/presentation/d/')) {
        const match = cleanUrl.match(/presentation\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://docs.google.com/presentation/d/${match[1]}/export/pdf`;
        }
    }

    // Google Drive File / PDF -> Descarga directa desde CDN de Google
    if (cleanUrl.includes('drive.google.com')) {
        const match = cleanUrl.match(/file\/d\/([a-zA-Z0-9_-]+)/) || cleanUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://drive.google.com/uc?export=download&id=${match[1]}`;
        }
    }

    // Google Sheets -> Exportar como Excel XLSX oficial
    if (cleanUrl.includes('docs.google.com/spreadsheets/d/')) {
        const match = cleanUrl.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
        }
    }

    // Google Docs -> Exportar como PDF oficial
    if (cleanUrl.includes('docs.google.com/document/d/')) {
        const match = cleanUrl.match(/document\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://docs.google.com/document/d/${match[1]}/export?format=pdf`;
        }
    }

    // Archivo PDF directo
    if (cleanUrl.toLowerCase().endsWith('.pdf')) {
        return cleanUrl;
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

// Resaltador de sintaxis Python estilo Google Colab / VS Code Dark
function highlightPythonCode(rawCode) {
    if (!rawCode) return '';
    
    // Escapar caracteres HTML básicos
    let text = rawCode
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const tokens = [];

    // 1. Strings (Comillas simples y dobles)
    text = text.replace(/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, (match) => {
        const id = `___STR_${tokens.length}___`;
        tokens.push({ id, html: `<span style="color: #ce9178;">${match}</span>` });
        return id;
    });

    // 2. Comentarios (# ...)
    text = text.replace(/(#[^\n]*)/g, (match) => {
        const id = `___COMM_${tokens.length}___`;
        tokens.push({ id, html: `<span style="color: #6a9955; font-style: italic;">${match}</span>` });
        return id;
    });

    // 3. Números (enteros y flotantes)
    text = text.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color: #b5cea8;">$1</span>');

    // 4. Palabras clave de Python
    const keywords = ['def', 'return', 'for', 'in', 'if', 'elif', 'else', 'while', 'break', 'continue', 'import', 'from', 'as', 'try', 'except', 'finally', 'with', 'class', 'lambda', 'yield', 'and', 'or', 'not', 'is', 'pass', 'raise'];
    const kwRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
    text = text.replace(kwRegex, '<span style="color: #c586c0; font-weight: 600;">$1</span>');

    // 5. Funciones integradas (Built-ins)
    const builtins = ['print', 'input', 'len', 'int', 'float', 'str', 'tuple', 'list', 'dict', 'set', 'range', 'sum', 'min', 'max', 'abs', 'round', 'enumerate', 'zip', 'map', 'filter', 'open', 'type', 'isinstance'];
    const biRegex = new RegExp(`\\b(${builtins.join('|')})\\b(?=\\s*\\()`, 'g');
    text = text.replace(biRegex, '<span style="color: #dcdcaa;">$1</span>');

    // 6. Nombres de funciones invocadas
    text = text.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, '<span style="color: #dcdcaa;">$1</span>');

    // Restaurar cadenas y comentarios
    tokens.forEach(t => {
        text = text.replace(t.id, t.html);
    });

    return text;
}

// Almacén seguro de celdas para copiado sin errores de sintaxis
window.__notebookCells = window.__notebookCells || {};
window.copyNotebookCell = function(cellKey) {
    const code = window.__notebookCells ? window.__notebookCells[cellKey] : null;
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            if (window.showToast) window.showToast('Código copiado al portapapeles', 'success');
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = code;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            if (window.showToast) window.showToast('Código copiado al portapapeles', 'success');
        });
    }
};

// Cargar y renderizar cuaderno Jupyter (.ipynb) nativamente con diseño Google Colab
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
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <a href="${rawUrl}" target="_blank" download class="btn btn-outline btn-sm" style="background: rgba(255, 255, 255, 0.08); color: #f3f4f6; border: 1px solid rgba(255, 255, 255, 0.2); font-size: 0.78rem; font-weight: 600; padding: 6px 12px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none;" title="Descargar archivo de ejercicios .ipynb">
                            <i class="fa-solid fa-download" style="color: var(--ubuntu-green);"></i> Descargar Material
                        </a>
                        <a href="${directUrl}" target="_blank" class="btn btn-sm" style="background: #e27d60; color: #fff; border: 0; font-size: 0.78rem; font-weight: 700; padding: 6px 14px; border-radius: 6px; display: flex; align-items: center; gap: 6px; text-decoration: none;" title="Abrir en Google Colab para ejecutar con GPU/CPU">
                            <i class="fa-solid fa-play"></i> Abrir y Ejecutar en Google Colab
                        </a>
                    </div>
                </div>
                
                <!-- Celdas del Cuaderno -->
                <div style="padding: 20px; max-height: 520px; overflow-y: auto; color: #d4d4d4;">
        `;

        if (Array.isArray(notebook.cells)) {
            notebook.cells.forEach((cell, idx) => {
                const sourceText = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
                const cellKey = `cell_${Date.now()}_${idx}`;
                window.__notebookCells[cellKey] = sourceText;
                
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
                    // Resaltado de sintaxis estilo Google Colab
                    const highlightedCode = highlightPythonCode(sourceText);

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

                    notebookHtml += `
                        <div style="margin-bottom: 18px; border-radius: 8px; overflow: hidden; border: 1px solid #33383f; background: #111214;">
                            <div style="display: flex; justify-content: space-between; align-items: center; background: #1a1d21; padding: 6px 14px; border-bottom: 1px solid #272b30;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: #272b30; color: #38bdf8; font-size: 0.65rem;">
                                        <i class="fa-solid fa-play" style="margin-left: 1px;"></i>
                                    </span>
                                    <span style="font-size: 0.72rem; font-family: monospace; color: #71717a; font-weight: 600;">[ ${cell.execution_count ? cell.execution_count : ' '} ] In Python:</span>
                                </div>
                                <button type="button" onclick="copyNotebookCell('${cellKey}')" style="background: transparent; border: 0; color: #a1a1aa; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 2px 6px;">
                                    <i class="fa-regular fa-copy"></i> Copiar Código
                                </button>
                            </div>
                            <pre style="margin: 0; padding: 14px; background: #111214; color: #d4d4d4; font-family: 'Consolas', 'Fira Code', monospace; font-size: 0.88rem; line-height: 1.55; overflow-x: auto; white-space: pre;"><code>${highlightedCode}</code></pre>
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

    // Filtrar cursos:
    // Si es profesor: solo sus propios cursos (impartidos por él)
    // Si es estudiante: cursos activos del catálogo general
    let filtered = coursesList.filter(c => {
        if (isTeacher) {
            // Solo cursos creados por el profesor autenticado
            const isOwnCourse = (currentUserId && c.authorId === currentUserId) ||
                                (currentAuthUser && currentAuthUser.email && c.authorEmail === currentAuthUser.email);
            if (!isOwnCourse) return false;
        } else {
            if (c.activo === false) return false;
        }

        const matchCategory = currentCategory === 'all' || c.category === currentCategory;
        const matchSearch = (c.title || '').toLowerCase().includes(searchQuery) ||
                            (c.instructor || '').toLowerCase().includes(searchQuery) ||
                            (c.category || '').toLowerCase().includes(searchQuery);
        return matchCategory && matchSearch;
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
                const canEdit = canUserEditCourse(course);

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
                        ${course.description ? `<p class="course-desc">${course.description}</p>` : ''}
                        <div class="course-meta">
                            <span><i class="fa-regular fa-user"></i> ${course.instructor || 'Profesor'}</span>
                        </div>
                        
                        <div class="course-footer" style="flex-wrap: wrap; gap: 8px;">
                            ${canEdit ? `
                                <!-- ACCIONES DE AUTOR/PROFESOR: EDITAR, OCULTAR Y ELIMINAR -->
                                <div style="display: flex; gap: 6px; width: 100%; justify-content: space-between; align-items: center;">
                                    <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openEditCourseModal('${course.id}')" title="Editar información del curso">
                                        <i class="fa-solid fa-pen-to-square"></i> Editar
                                    </button>
                                    <button class="btn btn-sm ${isHidden ? 'btn-green' : 'btn-outline'}" onclick="event.stopPropagation(); toggleHideCourse('${course.id}')" title="${isHidden ? 'Volver a mostrar en el catálogo' : 'Ocultar curso del catálogo'}">
                                        <i class="fa-solid ${isHidden ? 'fa-eye' : 'fa-eye-slash'}"></i> ${isHidden ? 'Reactivar' : 'Ocultar'}
                                    </button>
                                    <button class="btn btn-outline-danger btn-sm" onclick="event.stopPropagation(); deleteCourse('${course.id}')" title="Eliminar curso permanentemente">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                </div>
                            ` : `
                                <!-- ACCIÓN DE ESTUDIANTE / OBSERVADOR: INSCRIBIRME -->
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

    if (!canUserEditCourse(course)) {
        if (window.showToast) window.showToast("No tienes permisos para modificar el estado de este curso.");
        return;
    }

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
    } catch (error) {
        console.error("Error al cambiar estado del curso:", error);
        if (window.showToast) window.showToast("Error al modificar el estado del curso.");
    }
}

// Eliminar Curso de Firestore y del Catálogo
export async function deleteCourse(id) {
    const course = coursesList.find(c => c.id === id);
    if (!course) return;

    if (!canUserEditCourse(course)) {
        if (window.showToast) window.showToast("No tienes permisos para eliminar este curso.");
        return;
    }

    const confirmed = confirm(`¿Estás seguro de que deseas eliminar permanentemente el curso "${course.title}"?\n\nEsta acción no se puede deshacer.`);
    if (!confirmed) return;

    try {
        if (dbInstance) {
            const courseRef = doc(dbInstance, 'cursos', id);
            await deleteDoc(courseRef);
        } else {
            coursesList = coursesList.filter(c => c.id !== id);
            renderCourses();
        }

        if (window.closeModal) {
            window.closeModal('editCourseModal');
            window.closeModal('courseDetailModal');
        }

        if (window.showToast) {
            window.showToast(`El curso "${course.title}" ha sido eliminado.`, 'normal');
        }
    } catch (error) {
        console.error("Error al eliminar curso de Firestore:", error);
        if (window.showToast) {
            window.showToast("Error al eliminar el curso.");
        }
    }
}

// Abrir Modal para Editar Curso
export function openEditCourseModal(id) {
    const course = coursesList.find(c => c.id === id);
    if (!course) return;

    if (!canUserEditCourse(course)) {
        if (window.showToast) window.showToast('No tienes permisos para editar este curso.', 'normal');
        return;
    }

    document.getElementById('editCourseId').value = course.id;
    document.getElementById('editCourseTitle').value = course.title || '';
    document.getElementById('editCourseCategory').value = course.category || 'IA';
    document.getElementById('editCourseLevel').value = course.level || 'Principiante';
    document.getElementById('editCourseDuration').value = course.duration || '20 horas';
    document.getElementById('editCourseDescription').value = course.description || '';

    const modal = document.getElementById('editCourseModal');
    if (modal) modal.classList.add('active');
}

// Guardar Cambios de Edición en Firestore
export async function handleSaveEditCourse(e) {
    e.preventDefault();

    const id = document.getElementById('editCourseId').value;
    const course = coursesList.find(c => c.id === id);
    if (!course || !canUserEditCourse(course)) {
        if (window.showToast) window.showToast("No tienes permisos para editar este curso.");
        return;
    }

    const title = document.getElementById('editCourseTitle').value.trim();
    const category = document.getElementById('editCourseCategory').value;
    const level = document.getElementById('editCourseLevel').value;
    const duration = document.getElementById('editCourseDuration').value.trim() || '20 horas';
    const description = document.getElementById('editCourseDescription').value.trim();

    // Auto-asignar icono según categoría
    const categoryIcons = {
        'IA': 'fa-brain',
        'Matemáticas': 'fa-calculator',
        'Programación': 'fa-code',
        'Ingeniería': 'fa-robot',
        'Ciberseguridad': 'fa-shield-halved',
        'Cloud': 'fa-cloud'
    };
    const icon = categoryIcons[category] || course.icon || 'fa-graduation-cap';

    const updatedData = {
        title,
        category,
        level,
        duration,
        description,
        icon,
        updatedAt: new Date().toISOString()
    };

    try {
        if (dbInstance) {
            const courseRef = doc(dbInstance, 'cursos', id);
            await updateDoc(courseRef, updatedData);
        } else {
            Object.assign(course, updatedData);
            renderCourses();
        }

        if (window.closeModal) window.closeModal('editCourseModal');
        if (window.showToast) window.showToast(`¡Curso "${title}" actualizado con éxito!`, 'success');
    } catch (error) {
        console.error("Error al guardar edición en Firestore:", error);
        if (window.showToast) window.showToast("Error al guardar los cambios.");
    }
}

// Estado de semana activa por curso
let activeWeekIdByCourse = {};

// Renderizar aviso amigable para enlaces de Canva no embebibles directamente (como canva.link)
function renderCanvaNoticeHtml(directUrl, isAuthor = false) {
    return `
        <div style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 12px; padding: 28px 20px; text-align: center; margin-bottom: 20px; box-shadow: var(--shadow-sm);">
            <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(0, 196, 204, 0.12); color: #00c4cc; display: inline-flex; align-items: center; justify-content: center; font-size: 1.8rem; margin-bottom: 12px;">
                <i class="fa-solid fa-palette"></i>
            </div>
            <h4 style="margin-bottom: 8px; color: var(--text-primary); font-size: 1.05rem;">Presentación en Canva</h4>
            <p style="font-size: 0.85rem; color: var(--text-secondary); max-width: 480px; margin: 0 auto 16px auto; line-height: 1.5;">
                Esta presentación fue vinculada mediante un enlace de Canva. Puedes abrirla directamente para visualizarla o proyectarla a pantalla completa.
            </p>
            <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                <a href="${directUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="background: #00c4cc; border-color: #00c4cc; color: #fff; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir Diapositivas en Canva
                </a>
            </div>
            ${isAuthor ? `
                <div style="margin-top: 18px; padding: 12px 16px; background: rgba(239, 108, 0, 0.08); border-left: 3px solid var(--ubuntu-orange); border-radius: 8px; text-align: left; font-size: 0.78rem; color: var(--text-secondary); max-width: 520px; margin-left: auto; margin-right: auto; line-height: 1.4;">
                    <strong style="color: var(--ubuntu-orange); display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                        <i class="fa-solid fa-lightbulb"></i> ¿Deseas previsualizarla aquí dentro sin salir?
                    </strong>
                    Abre tu enlace en el navegador y copia la dirección completa que aparece en la barra superior (que empieza por <code>canva.com/design/...</code>) o en Canva ve a <strong>Compartir &gt; Más &gt; Insertar</strong> y pega ese enlace al editar esta semana.
                </div>
            ` : ''}
        </div>
    `;
}

// Renderizador multimedia reusable (Video YouTube/Drive, Diapositivas/PDF, Canva y Colab)
function renderCourseMedia(videoContainer, videoUrl, pdfUrl, resourceUrl, canvaUrl = null, isAuthor = false) {
    if (!videoContainer) return;

    const videoEmbedUrl = getYouTubeEmbedUrl(videoUrl);
    
    // Verificar si el campo pdfUrl o canvaUrl contiene un enlace de Canva
    const isPdfCanva = pdfUrl && (pdfUrl.includes('canva.com') || pdfUrl.includes('canva.link'));
    const docEmbedUrl = isPdfCanva ? null : getEmbeddableDocumentUrl(pdfUrl);
    
    const effectiveCanva = canvaUrl || (isPdfCanva ? pdfUrl : null);
    const canvaInfo = getEmbeddableCanvaInfo(effectiveCanva);
    const resourceInfo = getEmbeddableResourceUrl(resourceUrl);

    const mediaList = [];
    if (videoEmbedUrl) {
        mediaList.push({
            id: 'video',
            type: 'iframe',
            title: 'Video de Clase',
            icon: 'fa-brands fa-youtube',
            iconColor: '#ff4d4d',
            embedUrl: videoEmbedUrl,
            directUrl: videoUrl,
            aspectRatio: '56.25%',
            actionLabel: 'Ver en YouTube'
        });
    }
    if (docEmbedUrl) {
        const downloadUrl = getDownloadableDocumentUrl(pdfUrl);
        mediaList.push({
            id: 'doc',
            type: 'iframe',
            title: 'Diapositivas / PDF',
            icon: 'fa-solid fa-file-powerpoint',
            iconColor: 'var(--ubuntu-orange)',
            embedUrl: docEmbedUrl,
            directUrl: pdfUrl,
            downloadUrl: downloadUrl,
            aspectRatio: '58%',
            actionLabel: 'Pantalla Completa'
        });
    }
    if (canvaInfo) {
        if (canvaInfo.type === 'iframe') {
            mediaList.push({
                id: 'canva',
                type: 'iframe',
                title: 'Presentación Canva',
                icon: 'fa-solid fa-palette',
                iconColor: '#00c4cc',
                embedUrl: canvaInfo.embedUrl,
                directUrl: canvaInfo.directUrl,
                aspectRatio: '56.25%',
                actionLabel: 'Ver en Canva'
            });
        } else if (canvaInfo.type === 'canva_notice') {
            mediaList.push({
                id: 'canva',
                type: 'canva_notice',
                title: 'Presentación Canva',
                icon: 'fa-solid fa-palette',
                iconColor: '#00c4cc',
                directUrl: canvaInfo.directUrl,
                aspectRatio: 'auto',
                actionLabel: 'Abrir en Canva'
            });
        }
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
            downloadUrl: resourceInfo.rawUrl || null,
            aspectRatio: resourceInfo.aspectRatio || '68%',
            actionLabel: resourceInfo.actionLabel
        });
    }

    if (mediaList.length > 1) {
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
                    ` : m.type === 'canva_notice' ? `
                        ${renderCanvaNoticeHtml(m.directUrl, isAuthor)}
                    ` : `
                        <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 6px; gap: 8px; flex-wrap: wrap;">
                            ${m.downloadUrl ? `
                                <a href="${m.downloadUrl}" target="_blank" download class="btn btn-outline btn-sm" style="padding: 4px 10px; font-size: 0.75rem; border-color: var(--border-color); color: var(--text-primary); display: inline-flex; align-items: center; gap: 5px;" title="Descargar material en tu computadora">
                                    <i class="fa-solid fa-download" style="color: var(--ubuntu-green);"></i> Descargar Material
                                </a>
                            ` : ''}
                            <a href="${m.directUrl}" target="_blank" class="btn btn-outline btn-sm" style="padding: 4px 10px; font-size: 0.75rem;" title="${m.actionLabel}">
                                <i class="fa-solid fa-arrow-up-right-from-square"></i> ${m.actionLabel}
                            </a>
                        </div>
                        <div style="position: relative; padding-bottom: ${m.aspectRatio}; height: 0; overflow: hidden; border-radius: 12px; margin-bottom: 20px; box-shadow: var(--shadow-md); border: 1px solid var(--border-color);">
                            <iframe src="${m.embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>
                        </div>
                    `}
                </div>
            `).join('')}
        `;
        videoContainer.style.display = 'block';

        mediaList.forEach(m => {
            if (m.type === 'notebook') {
                const nbContainer = document.getElementById(`notebookView_${m.id}`);
                if (nbContainer) loadAndRenderNotebook(nbContainer, m.rawUrl, m.directUrl);
            }
        });
    } else if (mediaList.length === 1) {
        const item = mediaList[0];
        if (item.type === 'notebook') {
            videoContainer.innerHTML = `<div id="notebookView_single"></div>`;
            videoContainer.style.display = 'block';
            loadAndRenderNotebook(document.getElementById('notebookView_single'), item.rawUrl, item.directUrl);
        } else if (item.type === 'canva_notice') {
            videoContainer.innerHTML = renderCanvaNoticeHtml(item.directUrl, isAuthor);
            videoContainer.style.display = 'block';
        } else {
            videoContainer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                    <span style="font-weight: 700; font-size: 0.85rem; color: var(--siemens-teal); display: flex; align-items: center; gap: 6px;">
                        <i class="${item.icon}" style="color: ${item.iconColor};"></i> ${item.title}
                    </span>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        ${item.downloadUrl ? `
                            <a href="${item.downloadUrl}" target="_blank" download class="btn btn-outline btn-sm" style="padding: 4px 10px; font-size: 0.75rem; border-color: var(--border-color); color: var(--text-primary); display: inline-flex; align-items: center; gap: 5px;" title="Descargar material en tu computadora">
                                <i class="fa-solid fa-download" style="color: var(--ubuntu-green);"></i> Descargar Material
                            </a>
                        ` : ''}
                        <a href="${item.directUrl}" target="_blank" class="btn btn-outline btn-sm" style="padding: 4px 10px; font-size: 0.75rem;" title="${item.actionLabel}">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> ${item.actionLabel}
                        </a>
                    </div>
                </div>
                <div style="position: relative; padding-bottom: ${item.aspectRatio}; height: 0; overflow: hidden; border-radius: 12px; margin-bottom: 20px; box-shadow: var(--shadow-md); border: 1px solid var(--border-color);">
                    <iframe src="${item.embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>
                </div>
            `;
            videoContainer.style.display = 'block';
        }
    } else if (videoUrl) {
        videoContainer.innerHTML = `
            <div style="margin-bottom: 16px;">
                <a href="${videoUrl}" target="_blank" class="btn btn-orange" style="width: 100%; justify-content: center;">
                    <i class="fa-solid fa-play"></i> Ver Grabación de Clase (Google Drive / Enlace)
                </a>
            </div>`;
        videoContainer.style.display = 'block';
    } else {
        videoContainer.innerHTML = '';
        videoContainer.style.display = 'none';
    }
}

// Configurar botones del pie del modal
function setupModalButtons(course, isAuthor, isEnrolled) {
    const docEmbedUrl = getEmbeddableDocumentUrl(course.pdfUrl);
    const resourceInfo = getEmbeddableResourceUrl(course.resourceUrl);

    const btnPdf = document.getElementById('detailBtnPdf');
    if (btnPdf) {
        if (course.pdfUrl && !docEmbedUrl) {
            btnPdf.href = course.pdfUrl;
            btnPdf.style.display = 'inline-flex';
        } else {
            btnPdf.style.display = 'none';
        }
    }

    const btnResource = document.getElementById('detailBtnResource');
    if (btnResource) {
        if (course.resourceUrl && !resourceInfo) {
            btnResource.href = course.resourceUrl;
            btnResource.style.display = 'inline-flex';
        } else {
            btnResource.style.display = 'none';
        }
    }

    const btnCanva = document.getElementById('detailBtnCanva');
    if (btnCanva) {
        const canvaInfo = getEmbeddableCanvaInfo(course.canvaUrl);
        if (course.canvaUrl) {
            btnCanva.href = (canvaInfo && canvaInfo.directUrl) ? canvaInfo.directUrl : course.canvaUrl;
            btnCanva.style.display = 'inline-flex';
        } else {
            btnCanva.style.display = 'none';
        }
    }

    const btnEnroll = document.getElementById('detailBtnEnroll');
    const btnDelete = document.getElementById('detailBtnDelete');

    if (btnDelete) {
        if (isAuthor) {
            btnDelete.style.display = 'inline-flex';
            btnDelete.onclick = () => {
                deleteCourse(course.id);
            };
        } else {
            btnDelete.style.display = 'none';
        }
    }

    if (btnEnroll) {
        if (isAuthor) {
            btnEnroll.className = 'btn btn-outline';
            btnEnroll.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar Información General';
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
}

// Abrir Aula Virtual / Detalle del Curso (Con soporte por Semanas)
export function openCourseDetail(id) {
    const course = coursesList.find(c => c.id === id);
    if (!course) return;

    const modal = document.getElementById('courseDetailModal');
    if (!modal) return;

    const isAuthor = canUserEditCourse(course);
    const currentUserId = currentAuthUser ? currentAuthUser.uid : null;
    const isEnrolled = currentUserId && Array.isArray(course.inscritos) && course.inscritos.includes(currentUserId);

    document.getElementById('detailCourseTitle').textContent = course.title;
    document.getElementById('detailCourseCategory').textContent = `${course.category || 'Curso'} • Nivel ${course.level || 'Principiante'}`;
    document.getElementById('detailCourseInstructor').innerHTML = `<i class="fa-regular fa-user"></i> Instructor: <strong>${course.instructor}</strong> • Duración: ${course.duration || '20 horas'}`;
    document.getElementById('detailCourseDesc').textContent = course.description || '';

    const weeksNavEl = document.getElementById('detailWeeksNav');
    const weekHeaderEl = document.getElementById('detailWeekHeader');
    const videoContainer = document.getElementById('detailVideoContainer');

    const hasWeeks = Array.isArray(course.semanas) && course.semanas.length > 0;

    if (hasWeeks) {
        const allWeeks = course.semanas;
        const availableWeeks = isAuthor ? allWeeks : allWeeks.filter(w => w.visible !== false);

        if (availableWeeks.length === 0) {
            if (weeksNavEl) weeksNavEl.innerHTML = '';
            if (weekHeaderEl) weekHeaderEl.innerHTML = '';
            videoContainer.style.display = 'block';
            videoContainer.innerHTML = `
                <div class="week-empty-state">
                    <i class="fa-solid fa-clock"></i>
                    <h4 style="color: var(--text-primary); margin-bottom: 6px;">Próximamente disponible</h4>
                    <p style="font-size: 0.85rem; max-width: 400px; margin: 0 auto;">El profesor aún está preparando las semanas de este curso. ¡Vuelve pronto!</p>
                </div>
            `;
            setupModalButtons(course, isAuthor, isEnrolled);
            modal.classList.add('active');
            return;
        }

        let activeWeekId = activeWeekIdByCourse[course.id];
        let activeWeek = availableWeeks.find(w => w.id === activeWeekId);
        if (!activeWeek) {
            activeWeek = availableWeeks[0];
            activeWeekIdByCourse[course.id] = activeWeek.id;
        }

        // Renderizar barra de navegación de semanas (Píldoras)
        if (weeksNavEl) {
            weeksNavEl.innerHTML = `
                <div class="weeks-nav-container">
                    ${availableWeeks.map((w, idx) => {
                        const isActive = w.id === activeWeek.id;
                        const isHidden = w.visible === false;
                        return `
                            <button type="button" class="week-tab-btn ${isActive ? 'active' : ''} ${isHidden ? 'is-hidden' : ''}" onclick="window.selectWeekTab('${course.id}', '${w.id}')">
                                <i class="fa-solid ${isActive ? 'fa-folder-open' : 'fa-folder'}"></i>
                                <span>Semana ${w.numero || (idx + 1)}</span>
                                ${isAuthor && isHidden ? '<i class="fa-solid fa-eye-slash" title="Oculta para alumnos" style="font-size: 0.7rem; margin-left: 2px;"></i>' : ''}
                            </button>
                        `;
                    }).join('')}
                    ${isAuthor ? `
                        <button type="button" class="btn-add-week" onclick="window.openWeekModal('${course.id}')" title="Agregar nueva semana al curso">
                            <i class="fa-solid fa-plus"></i> Nueva Semana
                        </button>
                    ` : ''}
                </div>
            `;
        }

        // Renderizar cabecera de la semana activa
        if (weekHeaderEl) {
            const isWeekHidden = activeWeek.visible === false;
            // Limpiar redundancia si el título guardado incluye "Semana X:" para no duplicar con el subtítulo
            let cleanWeekTitle = (activeWeek.titulo || '').trim();
            cleanWeekTitle = cleanWeekTitle.replace(/^Semana\s*\d+\s*[:\-–—]?\s*/i, '');
            if (!cleanWeekTitle) {
                cleanWeekTitle = activeWeek.titulo || `Tema de la Semana ${activeWeek.numero || 1}`;
            }

            weekHeaderEl.innerHTML = `
                <div class="week-header-card">
                    <div class="week-header-info">
                        <span class="week-subtitle-text"><i class="fa-regular fa-calendar-check"></i> Semana ${activeWeek.numero || 1} del curso</span>
                        <span class="week-title-text">${cleanWeekTitle}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        ${activeWeek.meetUrl ? `
                            <a href="${activeWeek.meetUrl}" target="_blank" rel="noopener" class="btn-week-meet">
                                <i class="fa-solid fa-video"></i> Entrar a Clase en Vivo
                            </a>
                        ` : ''}
                        ${isAuthor ? `
                            <div class="teacher-actions-bar">
                                <button type="button" class="badge-visibility ${isWeekHidden ? 'hidden' : 'published'}" onclick="window.toggleWeekVisibility('${course.id}', '${activeWeek.id}')" title="${isWeekHidden ? 'Clic para publicar a los alumnos' : 'Clic para ocultar a los alumnos'}">
                                    <i class="fa-solid ${isWeekHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
                                    <span>${isWeekHidden ? 'Oculta (Borrador)' : 'Publicada'}</span>
                                </button>
                                <button type="button" class="btn-icon-action" onclick="window.openWeekModal('${course.id}', '${activeWeek.id}')" title="Editar contenido de esta semana">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                                <button type="button" class="btn-icon-action danger" onclick="window.deleteWeek('${course.id}', '${activeWeek.id}')" title="Eliminar esta semana">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>

                ${activeWeek.anuncio && activeWeek.anuncio.trim() ? `
                    <div class="week-announcement-banner" style="background: rgba(239, 108, 0, 0.08); border: 1.5px solid rgba(239, 108, 0, 0.35); border-left: 5px solid var(--ubuntu-orange); border-radius: 12px; padding: 14px 18px; margin-bottom: 18px; display: flex; align-items: flex-start; gap: 14px; box-shadow: var(--shadow-sm);">
                        <div style="background: var(--ubuntu-orange); color: #ffffff; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 1rem; margin-top: 1px; box-shadow: 0 2px 6px rgba(239, 108, 0, 0.3);">
                            <i class="fa-solid fa-bullhorn"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; gap: 8px;">
                                <strong style="color: var(--ubuntu-orange); font-size: 0.84rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
                                    Aviso del Docente
                                </strong>
                                ${isAuthor ? `
                                    <button type="button" onclick="window.openWeekModal('${course.id}', '${activeWeek.id}')" style="background: none; border: none; color: var(--text-muted); font-size: 0.74rem; cursor: pointer; text-decoration: underline; padding: 0;" title="Editar o borrar este anuncio">
                                        <i class="fa-solid fa-pen-to-square"></i> Editar aviso
                                    </button>
                                ` : ''}
                            </div>
                            <p style="margin: 0; font-size: 0.88rem; color: var(--text-primary); line-height: 1.55; white-space: pre-wrap; word-break: break-word;">${activeWeek.anuncio.trim()}</p>
                        </div>
                    </div>
                ` : ''}
            `;
        }

        // Renderizar multimedia de la semana activa
        const hasMedia = activeWeek.videoUrl || activeWeek.materialUrl || activeWeek.canvaUrl;
        if (hasMedia) {
            renderCourseMedia(videoContainer, activeWeek.videoUrl, activeWeek.materialUrl, null, activeWeek.canvaUrl, isAuthor);
        } else {
            videoContainer.style.display = 'block';
            videoContainer.innerHTML = `
                <div class="week-empty-state">
                    <i class="fa-solid ${isAuthor ? 'fa-folder-plus' : 'fa-folder-open'}"></i>
                    <h4 style="color: var(--text-primary); margin-bottom: 6px;">Sin materiales aún</h4>
                    <p style="font-size: 0.85rem; max-width: 420px; margin: 0 auto 12px auto;">
                        ${isAuthor ? 'Esta semana no tiene videos ni presentaciones cargadas. Haz clic en el botón para agregar el enlace de YouTube, Drive o Canva.' : 'El profesor aún no ha cargado los materiales de esta semana.'}
                    </p>
                    ${isAuthor ? `
                        <button type="button" class="btn btn-sm btn-primary" onclick="window.openWeekModal('${course.id}', '${activeWeek.id}')">
                            <i class="fa-solid fa-plus"></i> Cargar Materiales a esta Semana
                        </button>
                    ` : ''}
                </div>
            `;
        }

    } else {
        // Modo retrocompatibilidad (Cursos sin array de semanas)
        if (weeksNavEl) {
            if (isAuthor) {
                weeksNavEl.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0, 153, 153, 0.08); border: 1.5px dashed var(--siemens-teal); border-radius: 12px; padding: 12px 18px; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <strong style="color: var(--siemens-teal); font-size: 0.88rem; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-layer-group"></i> Estructura por Semanas
                            </strong>
                            <span style="font-size: 0.78rem; color: var(--text-secondary);">Convierte este curso para organizarlo por Semana 1, Semana 2 y publicar progresivamente.</span>
                        </div>
                        <button type="button" class="btn btn-sm btn-primary" onclick="window.convertCourseToWeeks('${course.id}')">
                            <i class="fa-solid fa-plus"></i> Activar Organización por Semanas
                        </button>
                    </div>
                `;
            } else {
                weeksNavEl.innerHTML = '';
            }
        }
        if (weekHeaderEl) weekHeaderEl.innerHTML = '';

        renderCourseMedia(videoContainer, course.videoUrl, course.pdfUrl, course.resourceUrl, course.canvaUrl, isAuthor);
    }

    setupModalButtons(course, isAuthor, isEnrolled);
    modal.classList.add('active');
}

// Seleccionar pestaña de semana
export function selectWeekTab(courseId, weekId) {
    activeWeekIdByCourse[courseId] = weekId;
    openCourseDetail(courseId);
}

// Abrir Modal para Crear o Editar Semana
export function openWeekModal(courseId, weekId = null) {
    const course = coursesList.find(c => c.id === courseId);
    if (!course) return;

    if (!canUserEditCourse(course)) {
        if (window.showToast) window.showToast('No tienes permisos para modificar las semanas de este curso.', 'normal');
        return;
    }

    const modal = document.getElementById('weekEditModal');
    if (!modal) return;

    document.getElementById('weekEditCourseId').value = courseId;
    document.getElementById('weekEditWeekId').value = weekId || '';

    const currentWeeks = Array.isArray(course.semanas) ? course.semanas : [];

    if (weekId) {
        const week = currentWeeks.find(w => w.id === weekId);
        if (week) {
            document.getElementById('weekModalTitle').textContent = `Editar Semana ${week.numero || ''}`;
            document.getElementById('weekInputTitle').value = week.titulo || '';
            document.getElementById('weekInputMeetUrl').value = week.meetUrl || '';
            document.getElementById('weekInputVideoUrl').value = week.videoUrl || '';
            document.getElementById('weekInputMaterialUrl').value = week.materialUrl || '';
            if (document.getElementById('weekInputCanvaUrl')) {
                document.getElementById('weekInputCanvaUrl').value = week.canvaUrl || '';
                document.getElementById('weekInputCanvaUrl').dispatchEvent(new Event('input'));
            }
            if (document.getElementById('weekInputNotice')) {
                document.getElementById('weekInputNotice').value = week.anuncio || '';
            }
            if (window.toggleWeekNotice) {
                window.toggleWeekNotice(Boolean(week.anuncio && week.anuncio.trim()));
            }
            document.getElementById('weekInputVisible').checked = week.visible !== false;
        }
    } else {
        const nextNum = currentWeeks.length + 1;
        document.getElementById('weekModalTitle').textContent = `Nueva Semana (Semana ${nextNum})`;
        document.getElementById('weekInputTitle').value = '';
        document.getElementById('weekInputTitle').placeholder = 'Ej: Introducción o tema principal';
        document.getElementById('weekInputMeetUrl').value = '';
        document.getElementById('weekInputVideoUrl').value = '';
        document.getElementById('weekInputMaterialUrl').value = '';
        if (document.getElementById('weekInputCanvaUrl')) {
            document.getElementById('weekInputCanvaUrl').value = '';
            document.getElementById('weekInputCanvaUrl').dispatchEvent(new Event('input'));
        }
        if (document.getElementById('weekInputNotice')) {
            document.getElementById('weekInputNotice').value = '';
        }
        if (window.toggleWeekNotice) {
            window.toggleWeekNotice(false);
        }
        document.getElementById('weekInputVisible').checked = true;
    }

    modal.classList.add('active');
}

// Guardar Semana (Crear o Actualizar en Firestore con 1 sola escritura)
export async function saveWeekForm(e) {
    e.preventDefault();

    const courseId = document.getElementById('weekEditCourseId').value;
    const course = coursesList.find(c => c.id === courseId);
    if (!course || !canUserEditCourse(course)) {
        if (window.showToast) window.showToast("No tienes permisos para guardar semanas en este curso.");
        return;
    }

    const weekId = document.getElementById('weekEditWeekId').value;
    const title = document.getElementById('weekInputTitle').value.trim();
    const meetUrl = document.getElementById('weekInputMeetUrl').value.trim();
    const videoUrl = document.getElementById('weekInputVideoUrl').value.trim();
    const materialUrl = document.getElementById('weekInputMaterialUrl').value.trim();
    const canvaUrl = document.getElementById('weekInputCanvaUrl') ? document.getElementById('weekInputCanvaUrl').value.trim() : '';
    const anuncio = document.getElementById('weekInputNotice') ? document.getElementById('weekInputNotice').value.trim() : '';
    const visible = document.getElementById('weekInputVisible').checked;

    let semanas = Array.isArray(course.semanas) ? [...course.semanas] : [];

    if (weekId) {
        const idx = semanas.findIndex(w => w.id === weekId);
        if (idx !== -1) {
            semanas[idx] = {
                ...semanas[idx],
                titulo: title,
                meetUrl,
                videoUrl,
                materialUrl,
                canvaUrl,
                anuncio,
                visible
            };
        }
    } else {
        const newWeek = {
            id: 'sem_' + Date.now(),
            numero: semanas.length + 1,
            titulo: title,
            meetUrl,
            videoUrl,
            materialUrl,
            canvaUrl,
            anuncio,
            visible
        };
        semanas.push(newWeek);
        activeWeekIdByCourse[courseId] = newWeek.id;
    }

    try {
        if (dbInstance) {
            const courseRef = doc(dbInstance, 'cursos', courseId);
            await updateDoc(courseRef, { semanas });
        } else {
            course.semanas = semanas;
        }

        if (window.closeModal) window.closeModal('weekEditModal');
        if (window.showToast) window.showToast(`¡Semana guardada con éxito!`, 'success');
        openCourseDetail(courseId);
    } catch (error) {
        console.error("Error guardando semana en Firestore:", error);
        if (window.showToast) window.showToast("Error al guardar la semana.");
    }
}

// Alternar visibilidad de una semana (Publicada / Oculta)
export async function toggleWeekVisibility(courseId, weekId) {
    const course = coursesList.find(c => c.id === courseId);
    if (!course || !Array.isArray(course.semanas) || !canUserEditCourse(course)) {
        if (window.showToast) window.showToast("No tienes permisos para modificar esta semana.");
        return;
    }

    const semanas = [...course.semanas];
    const week = semanas.find(w => w.id === weekId);
    if (!week) return;

    week.visible = !week.visible;

    try {
        if (dbInstance) {
            const courseRef = doc(dbInstance, 'cursos', courseId);
            await updateDoc(courseRef, { semanas });
        }
        if (window.showToast) {
            window.showToast(week.visible ? `Semana publicada (visible para alumnos)` : `Semana oculta en borrador`, 'normal');
        }
        openCourseDetail(courseId);
    } catch (error) {
        console.error("Error al alternar visibilidad de semana:", error);
        if (window.showToast) window.showToast("Error al cambiar visibilidad.");
    }
}

// Eliminar semana
export async function deleteWeek(courseId, weekId) {
    const course = coursesList.find(c => c.id === courseId);
    if (!course || !Array.isArray(course.semanas) || !canUserEditCourse(course)) {
        if (window.showToast) window.showToast("No tienes permisos para eliminar semanas de este curso.");
        return;
    }

    const week = course.semanas.find(w => w.id === weekId);
    if (!week) return;

    const confirmed = confirm(`¿Eliminar la "${week.titulo || 'Semana'}" y sus materiales?`);
    if (!confirmed) return;

    const semanas = course.semanas.filter(w => w.id !== weekId);
    semanas.forEach((w, idx) => { w.numero = idx + 1; });

    if (activeWeekIdByCourse[courseId] === weekId) {
        activeWeekIdByCourse[courseId] = semanas[0]?.id || null;
    }

    try {
        if (dbInstance) {
            const courseRef = doc(dbInstance, 'cursos', courseId);
            await updateDoc(courseRef, { semanas });
        } else {
            course.semanas = semanas;
        }

        if (window.showToast) window.showToast(`Semana eliminada`, 'normal');
        openCourseDetail(courseId);
    } catch (error) {
        console.error("Error al eliminar semana:", error);
        if (window.showToast) window.showToast("Error al eliminar la semana.");
    }
}

// Convertir curso antiguo a estructura de semanas
export async function convertCourseToWeeks(courseId) {
    const course = coursesList.find(c => c.id === courseId);
    if (!course || !canUserEditCourse(course)) {
        if (window.showToast) window.showToast("No tienes permisos para modificar este curso.");
        return;
    }

    const initialWeek = {
        id: 'sem_' + Date.now(),
        numero: 1,
        titulo: `Introducción a ${course.title || 'la materia'}`,
        meetUrl: '',
        videoUrl: course.videoUrl || '',
        materialUrl: course.pdfUrl || course.resourceUrl || '',
        canvaUrl: course.canvaUrl || '',
        visible: true
    };

    try {
        if (dbInstance) {
            const courseRef = doc(dbInstance, 'cursos', courseId);
            await updateDoc(courseRef, { semanas: [initialWeek] });
        } else {
            course.semanas = [initialWeek];
        }

        activeWeekIdByCourse[courseId] = initialWeek.id;
        if (window.showToast) window.showToast(`¡Curso organizado en semanas! Ahora puedes agregar más semanas.`, 'success');
        openCourseDetail(courseId);
    } catch (error) {
        console.error("Error convirtiendo curso a semanas:", error);
        if (window.showToast) window.showToast("Error al organizar el curso.");
    }
}

// Guardar nuevo curso en Firestore (Cero consumo de Storage con Técnica del Enlace y Autoría Automática)
export async function handleCreateCourse(e) {
    e.preventDefault();

    const title = document.getElementById('courseTitle').value.trim();
    const category = document.getElementById('courseCategory').value;
    const level = document.getElementById('courseLevel').value;
    const duration = (document.getElementById('courseDuration') && document.getElementById('courseDuration').value.trim()) || '20 horas';
    const description = (document.getElementById('courseDescription') && document.getElementById('courseDescription').value.trim()) || '';
    
    // Materiales directos de la Semana 1
    const weekVideoUrl = document.getElementById('courseWeekVideoUrl') ? document.getElementById('courseWeekVideoUrl').value.trim() : '';
    const weekMaterialUrl = document.getElementById('courseWeekMaterialUrl') ? document.getElementById('courseWeekMaterialUrl').value.trim() : '';
    const weekCanvaUrl = document.getElementById('courseWeekCanvaUrl') ? document.getElementById('courseWeekCanvaUrl').value.trim() : '';
    const weekNotice = document.getElementById('courseWeekNotice') ? document.getElementById('courseWeekNotice').value.trim() : '';

    // Autoría real vinculada a la cuenta activa
    const instructor = currentUserName || 'Docente';
    const authorId = currentAuthUser ? currentAuthUser.uid : null;
    const authorEmail = currentAuthUser ? currentAuthUser.email : null;

    // Asignación automática de icono temático según categoría
    const categoryIcons = {
        'IA': 'fa-brain',
        'Matemáticas': 'fa-calculator',
        'Programación': 'fa-code',
        'Ingeniería': 'fa-robot',
        'Ciberseguridad': 'fa-shield-halved',
        'Cloud': 'fa-cloud'
    };
    const icon = categoryIcons[category] || 'fa-graduation-cap';

    // Inicializar con la primera semana ya equipada con sus materiales y posible aviso
    const initialWeek = {
        id: 'sem_' + Date.now(),
        numero: 1,
        titulo: `Introducción a ${title}`,
        meetUrl: '',
        videoUrl: weekVideoUrl,
        materialUrl: weekMaterialUrl,
        canvaUrl: weekCanvaUrl,
        anuncio: weekNotice,
        visible: true
    };

    const newCourseData = {
        title,
        category,
        level,
        instructor,
        authorId,
        authorEmail,
        duration,
        description,
        icon,
        semanas: [initialWeek],
        rating: 5.0,
        reviews: 1,
        inscritos: [],
        activo: true,
        price: "Gratis",
        createdAt: new Date().toISOString()
    };

    try {
        let createdCourseId = null;

        if (dbInstance) {
            const docRef = await addDoc(collection(dbInstance, 'cursos'), newCourseData);
            createdCourseId = docRef.id;
            newCourseData.id = createdCourseId;
            if (!coursesList.some(c => c.id === createdCourseId)) {
                coursesList.unshift(newCourseData);
            }
        } else {
            createdCourseId = 'local-' + Date.now();
            newCourseData.id = createdCourseId;
            coursesList.unshift(newCourseData);
        }

        renderCourses();

        if (window.closeModal) window.closeModal('createCourseModal');
        document.getElementById('createCourseForm').reset();
        if (window.toggleCourseDesc) window.toggleCourseDesc(false);
        if (window.toggleWeek1Notice) window.toggleWeek1Notice(false);

        if (window.showToast) {
            window.showToast(`¡Curso "${title}" creado con éxito! Abriendo aula virtual...`, 'success');
        }

        // Apertura inmediata del Aula Virtual del curso creado sin tener que buscarlo
        if (createdCourseId) {
            setTimeout(() => {
                openCourseDetail(createdCourseId);
            }, 250);
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
window.deleteCourse = deleteCourse;
window.setCategoryFilter = setCategoryFilter;
window.filterCourses = filterCourses;
window.selectWeekTab = selectWeekTab;
window.openWeekModal = openWeekModal;
window.saveWeekForm = saveWeekForm;
window.toggleWeekVisibility = toggleWeekVisibility;
window.deleteWeek = deleteWeek;
window.convertCourseToWeeks = convertCourseToWeeks;

