// Variable global para controlar la instancia de Jitsi
let apiJitsi = null;

function abrirClaseVivo() {
    // 1. Cambiamos la vista a la pantalla de la clase en vivo
    document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
    document.getElementById('pantalla-clase-vivo').classList.add('activa');

    // 2. Configuramos los parámetros de la reunión
    const domain = 'meet.jit.si';
    const options = {
        roomName: 'ubuntu1231355', // Tu sala
        width: '100%',
        height: '100%',
        parentNode: document.querySelector('#contenedor-jitsi'),
        userInfo: {
            // Toma el nombre del jugador que ya está guardado en tu index
            displayName: jugadorActual 
        },
        configOverwrite: {
            // Entrar con cámara y micrófono apagados por defecto
            startWithAudioMuted: true,
            startWithVideoMuted: true,
            // 👇 ESTA ES LA LÍNEA MÁGICA PARA SALTAR LA PANTALLA PREVIA 👇
            prejoinPageEnabled: false 
        }
    };

    // 3. Inicializamos la API
    apiJitsi = new JitsiMeetExternalAPI(domain, options);
}

function cerrarClaseVivo() {
    // 1. Destruimos la instancia de Jitsi para liberar la cámara/micrófono
    if (apiJitsi) {
        apiJitsi.dispose();
        apiJitsi = null;
    }
    
    // 2. Volvemos al panel de cursos
    document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
    document.getElementById('pantalla-cursos').classList.add('activa');
    
    actualizarPantallaCursos();
}
