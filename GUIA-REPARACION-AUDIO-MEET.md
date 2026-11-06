# Guía Técnica y Registro de Pruebas: Reparación de Audio Bidireccional en Clases en Vivo (`meet.html`)

## 1. Reporte / Queja Inicial del Profesor (Caso Real en Clase de Inglés)

> **Contexto reportado:**
> Durante las sesiones en vivo (como la clase de Inglés), se presentaban fallos de **audio unidireccional** de forma intermitente pero crítica en la interfaz de [meet.html](file:///home/antigravity/Fravens7/ubuntu-cursos/meet.html):
> 1. **Caso A (El profesor no oye a los alumnos):** El profesor está en la reunión hablando con normalidad; los estudiantes sí lo escuchan perfectamente, pero cuando los estudiantes activan su micrófono para responder o participar, **el profesor no puede oírlos**.
> 2. **Caso B — Viceversa (Los alumnos no oyen al profesor):** Los estudiantes entran y hablan primero (o ya están conversando en la sala), el profesor sí los escucha, pero cuando el profesor enciende su micrófono (o entra con el micrófono ya activado desde la antesala), **los estudiantes no pueden oír al profesor**.

---

## 2. Diagnóstico Técnico: ¿Qué pasó exactamente?

Al reproducir el problema en **Google Chrome** con las cuentas reales de prueba (`profe1@gmail.com` y `test@gmail.com`), se detectaron **3 causas exactas** en la negociación WebRTC del navegador:

### Causa 1: Choque de canal `recvonly` al usar `pc.addTrack()` (El problema principal del Caso A y Viceversa)
- En el código anterior de [`syncOutgoingAudio`](file:///home/antigravity/Fravens7/ubuntu-cursos/meet.html#L2956-L3025), cuando alguien encendía su micrófono, se llamaba a `this.pc.addTrack(targetTrack, outStream)`.
- En **Google Chrome** (estándar *WebRTC Unified Plan*), `pc.addTrack()` busca el primer transceptor (`RTCRtpTransceiver`) de audio existente que no tenga pista local asignada (`sender.track === null`) y **lo reutiliza**.
- Cuando la **Persona A** hablaba primero, el servidor SFU (`clases.ubuntuafroperuana.org`) enviaba a la **Persona B** un canal de bajada en `mid: "0"` (`direction: "recvonly"`).
- Cuando la **Persona B** hacía clic en el botón de micrófono (`#btnCallMic`) para hablar después:
  - `pc.addTrack()` metía el micrófono de la Persona B dentro de ese mismo `mid: "0"` (que para el servidor era exclusivamente de bajada hacia B).
  - El servidor respondía manteniendo ese canal como solo bajada, por lo que el transceptor de la Persona B quedaba atrapado en `currentDirection: "recvonly"` y **enviaba `0` paquetes de audio (`outboundPackets: 0`)**.
- **Por eso ocurría en ambas direcciones:**
  - Si el **Profesor** hablaba primero y el **Estudiante** prendía su micro después → el micro del Estudiante quedaba en `outboundPackets: 0` (el Profesor no lo oía).
  - Si el **Estudiante** hablaba primero y el **Profesor** prendía su micro después → el micro del Profesor quedaba en `outboundPackets: 0` (los Estudiantes no lo oían).

### Causa 2: Omisión de `request-sync` al entrar desde la Antesala (Lobby) con el micrófono encendido
- En [`connectSignaling`](file:///home/antigravity/Fravens7/ubuntu-cursos/meet.html#L3095-L3112), había un `if / else` excluyente:
  - Si entrabas con el micrófono apagado, el navegador enviaba `{ type: 'request-sync' }` para recibir el audio de quienes ya estaban en la sala.
  - Pero si encendías el micrófono en la antesala (`#btnLobbyMic`) antes de pulsar **Unirse ahora** (`#btnJoinNow`), solo publicabas tu propio micrófono y **nunca enviabas `request-sync`**. Como resultado, todos te oían al entrar, pero tú no recibías el audio de quienes ya estaban hablando.

### Causa 3: Bloqueo de Autoplay (`<audio>.paused`) y `onunmute` en pistas entrantes
- Al recibir una pista de audio remota en [`initPeerConnection` (`pc.ontrack`)](file:///home/antigravity/Fravens7/ubuntu-cursos/meet.html#L3235-L3310), faltaba escuchar el evento `e.track.onunmute` (que sí existía para video) y reintentar `.play()` o activar un respaldo ligero en `AudioContext` si Chrome pausaba la etiqueta `<audio>` al entrar sin interacción previa.

---

## 3. Reparación en "Modo Pluma" (Ligera y sin impacto en el Servidor)

La solución fue diseñada bajo filosofía **Modo Pluma** (cero sobrecarga de CPU/RAM en el cliente y cero tráfico extra hacia el servidor SFU):

1. **Canal propio de subida con `addTransceiver(..., { direction: 'sendonly' })`**:
   - Se reemplazó `pc.addTrack` por `pc.addTransceiver(targetTrack, { direction: 'sendonly', streams: [outStream] })` una única vez por sesión.
   - Si el usuario apaga y vuelve a encender su micrófono 20 veces durante la clase, **no se crean nuevos canales ni se renegocia SDP con el servidor**: simplemente se usa `audioSender.replaceTrack(targetTrack)` / `replaceTrack(null)` sobre el canal ya abierto (`0` mensajes adicionales al servidor).
2. **Sincronización diferida (`_pendingInitialSync`) al entrar con micro activo**:
   - Si el profesor o alumno entra desde el Lobby con el micrófono ya encendido, publica su audio y, apenas recibe el `answer` del servidor, envía un único `{ type: 'request-sync' }` para escuchar a los demás.
3. **Desbloqueo automático de audio (`onunmute` + `fallbackGain` en `AudioContext` existente)**:
   - Reutiliza el mismo `AudioContext` que ya existía para el aro de voz del avatar, sin crear contextos nuevos ni abrir el micrófono físico de alumnos que están en silencio.

---

## 4. Comparativa: Antes vs. Después

| Situación en la Clase en Vivo | ❌ ANTES de la reparación | ✅ DESPUÉS de la reparación (Modo Pluma) |
| :--- | :--- | :--- |
| **1. Profesor habla primero y luego el Estudiante enciende su micrófono (`#btnCallMic`)** | El micrófono del estudiante se pegaba al `mid: "0"` (`recvonly`). `outboundPackets: 0`. **El profesor NO escuchaba al estudiante.** | El estudiante crea su propio canal `mid: "1"` (`sendonly`). `outboundPackets > 0`. **Ambos se escuchan claramente.** |
| **2. Estudiante habla primero y luego el Profesor enciende su micrófono (`#btnCallMic`)** | El micrófono del profesor se pegaba al `mid: "0"` (`recvonly`). `outboundPackets: 0`. **Los estudiantes NO escuchaban al profesor.** | El profesor crea su propio canal `mid: "1"` (`sendonly`). `outboundPackets > 0`. **Todos los estudiantes escuchan al profesor.** |
| **3. Profesor o Estudiante entra desde el Lobby con el micrófono ya activado (`#btnLobbyMic` -> `#btnJoinNow`)** | Publicaba su propio audio pero **omitía enviar `request-sync`**. No oía a quienes ya hablaban en la sala. | Publica su audio y al recibir el `answer` envía `request-sync` automáticamente. **Escucha y es escuchado desde el primer segundo.** |
| **4. Estudiante entra directo con micrófono apagado (solo oyente)** | `AudioContext` quedaba en `suspended` o `<audio>.paused: true` hasta que interactuara manualmente con el botón de desbloqueo. | Se reintenta reproducción en `e.track.onunmute` y en cualquier clic de interfaz, con respaldo directo en `AudioContext`. |
| **5. Apagar y encender el micrófono varias veces en clase** | Si había colisión de oferta (`rollback`), la pista local podía quedar sin republicarse. | Reutiliza el mismo `audioSender` con `replaceTrack()` sin renegociar con el servidor y re-sincroniza si hubo `rollback`. |

---

## 5. Registro de las 6 Pruebas Ejecutadas en el Navegador Google Chrome

Todas las pruebas se ejecutaron en instancias reales de **Google Chrome** interactuando con los botones de la interfaz de [meet.html](file:///home/antigravity/Fravens7/ubuntu-cursos/meet.html) usando las cuentas:
- **Profesor:** `profe1@gmail.com` (`admin1`)
- **Estudiante:** `test@gmail.com` (`admin2`)

| Prueba | Escenario probado en la interfaz de Chrome | Paquetes RTP Profesor | Paquetes RTP Estudiante | Nivel de Señal de Audio (RMS) | Estado Reproductor `<audio>` | Resultado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Prueba 1** | **Profesor activa micro en Lobby (`#btnLobbyMic`) y entra (`#btnJoinNow`)** mientras el Estudiante ya está en la sala | `98` enviados (`sendonly`) | `112` recibidos (`recvonly`) | Local Profe: `0.4558`<br>Remoto Estud: `0.0078` | `paused: false`<br>`audible: true` | **✅ PASÓ** |
| **Prueba 2** | **Estudiante enciende su micro en llamada (`#btnCallMic`)** mientras el Profesor ya está hablando *(Caso Queja 1)* | `230` enviados / `96` recibidos | `115` enviados / `244` recibidos | Remoto en Profe: `0.0078`<br>Remoto en Estud: `0.0057` | Ambos `paused: false`<br>`audible: true` | **✅ PASÓ** |
| **Prueba 3** | **Viceversa 1:** Profesor entra con micro apagado, **Estudiante habla primero**, y luego el **Profesor enciende su micro (`#btnCallMic`)** *(Caso Queja 2)* | `99` enviados / `171` recibidos | `190` enviados / `113` recibidos | Remoto en Profe: `0.0493`<br>Remoto en Estud: `0.4587` | Ambos `paused: false`<br>`audible: true` | **✅ PASÓ** |
| **Prueba 4** | **Viceversa 2:** **Estudiante ya está hablando** en la sala y el **Profesor entra desde el Lobby con el micro ya encendido** | `108` enviados / `107` recibidos | `211` enviados / `123` recibidos | Remoto en Profe: `0.0108`<br>Remoto en Estud: `0.4753` | Ambos `paused: false`<br>`audible: true` | **✅ PASÓ** |
| **Prueba 5** | **Profesor y Estudiante apagan y vuelven a encender sus micrófonos (`#btnCallMic`)** repetidamente en la sesión | `244` enviados / `283` recibidos | `346` enviados / `298` recibidos | Remoto en Profe: `0.3719`<br>Remoto en Estud: `0.0064` | Ambos `paused: false`<br>`audible: true` | **✅ PASÓ** |
| **Prueba 6** | **Profesor silencia a todos (`#btnMuteAllStudents`), desbloquea, Estudiante reactiva micro y Profesor abre Pizarra (`#btnCallWhiteboard`)** | `449` enviados / `488` recibidos | `483` enviados / `503` recibidos | Remoto en Profe: `0.0983`<br>Remoto en Estud: `0.1062` | Ambos `paused: false`<br>`audible: true` | **✅ PASÓ** |

---

## 6. Impacto en el Rendimiento del Servidor (`clases.ubuntuafroperuana.org`)

- **Impacto en CPU y Memoria del Servidor:** **0% de carga adicional.** El servidor Pion SFU ya está preparado para recibir un canal `sendonly` por participante que habla. De hecho, antes el cliente enviaba ofertas mal formadas reutilizando el `mid` de recepción del servidor, lo que obligaba al SFU a rechazar la dirección de subida.
- **Impacto en Red / Señalización WebSocket:** **Menor o igual que antes.** Al reutilizar `this.audioSender.replaceTrack(...)` cuando un usuario silencia o reactiva su micrófono, **no se envían nuevas ofertas SDP (`offer`/`answer`) al servidor** en cada mute/unmute, ahorrando procesamiento en el servidor durante toda la clase.
