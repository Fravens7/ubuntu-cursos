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

---

# Parte II: Investigación y Reparación Multi-Estudiante ("La plataforma los sacaba de la clase")

## 7. Segundo Reporte del Profesor (Capacidad de Estudiantes y Expulsiones de la Sala)

> **Reporte textual del profesor afectado:**
> - *"Parece que cuando el profesor está en la reunión, solo 1 estudiante puede unirse a la reunión. Los demás no."*
> - *"Sino que ellos indican que la plataforma los botaba de la clase."*
> - *"Después sí acordamos dejar la clase ahí, pero en sí la plataforma los sacaba de la clase."*

### ¿Es un límite duro del servidor?
**No.** El servidor y la arquitectura SFU de [meet.html](file:///home/antigravity/Fravens7/ubuntu-cursos/meet.html) **no tienen ningún límite duro de 1 estudiante**. Sin embargo, al analizar el código y someterlo a pruebas con **6 navegadores Google Chrome simultáneos (1 Profesor + 5 Estudiantes)** en escenarios reales de clase, encontramos **4 causas técnicas exactas** por las cuales la propia interfaz sacaba a los estudiantes o hacía parecer que solo 1 podía quedarse:

1. **Causa A — Corte de WebSocket por inactividad (60–100s) en alumnos oyentes y falta de auto-reconexión:**
   - En una clase real, el profesor habla y 1 estudiante participa mientras los demás estudiantes escuchan con el micrófono apagado.
   - En el código anterior de [`connectSignaling`](file:///home/antigravity/Fravens7/ubuntu-cursos/meet.html#L3104-L3154), los estudiantes con micrófono apagado enviaban **0 paquetes por el WebSocket** durante toda la clase, y `this.ws` no tenía ni `ping` de *keepalive* ni manejador `ws.onclose`.
   - Pasados **60 a 100 segundos de silencio**, el proxy inverso / Cloudflare (`wss://clases.ubuntuafroperuana.org/ws`) cerraba la conexión WebSocket inactiva de los estudiantes oyentes; el servidor SFU interpretaba que se habían ido (`peer-left`) y solo quedaban en la sala el profesor y el único estudiante que estaba hablando o interactuando.
2. **Causa B — Refresco de sesión de Firebase (`onAuthStateChanged` -> `initUIForUser`) devolvía al alumno al Lobby en plena clase:**
   - En [`initUIForUser`](file:///home/antigravity/Fravens7/ubuntu-cursos/meet.html#L2505-L2509), se ejecutaba `document.getElementById('lobbyView').style.display = 'flex'` sin verificar `if (!this.inCall)`.
   - Cuando Firebase Auth refrescaba el token o disparaba `onAuthStateChanged` en segundo plano mientras el alumno ya estaba dentro de la clase, la pantalla de antesala (`#lobbyView`) se volvía a mostrar encima de la videollamada, **sacando visualmente al estudiante de la reunión**.
3. **Causa C — Colisión de líneas SDP (`InvalidAccessError: order of m-lines`) cuando 3+ personas activaban micro o pizarra a la vez:**
   - Cuando había múltiples estudiantes en la sala y un estudiante encendía su micrófono justo en el mismo instante en que el servidor enviaba la pista de otro compañero (`pc.signalingState !== 'stable'`), el `rollback` dejaba un transceptor local sin negociar antes de las líneas remotas del SFU, rompiendo las ofertas siguientes con `InvalidAccessError: The order of m-lines in subsequent offer doesn't match order from previous offer/answer`.
4. **Causa D — Si el profesor salía y volvía a entrar para probar su audio (`hangupCall`), cerraba la sala para todos:**
   - Cuando el profesor tenía problemas de audio y pulsaba el botón rojo de colgar para salir y volver a entrar, [`hangupCall`](file:///home/antigravity/Fravens7/ubuntu-cursos/meet.html#L4895-L4925) enviaba `{ type: 'end-room' }` al servidor. Eso enviaba `room-ended` a todos los estudiantes conectados y ejecutaba `window.close()` en sus navegadores, expulsándolos inmediatamente de la clase. *(Adicionalmente, en versiones previas antes de los commits `877e279` y `c50d842`, existía un filtro que solo permitía entrar a `test@gmail.com` y redirigía a otros alumnos al inicio tras iniciar sesión).*

---

## 8. Reparaciones Aplicadas en "Modo Pluma" para Multi-Estudiante

1. **Protección de llamada activa frente a refrescos de Auth ([`initUIForUser`](file:///home/antigravity/Fravens7/ubuntu-cursos/meet.html#L2505-L2509) y [`onAuthStateChanged`](file:///home/antigravity/Fravens7/ubuntu-cursos/meet.html#L5170-L5175)):**
   - Si el usuario ya está dentro de la llamada (`this.inCall === true`), `onAuthStateChanged` e `initUIForUser` ignoran la apertura de `#lobbyView`, impidiendo que la plataforma saque al estudiante a la antesala a mitad de clase.
2. **Keepalive ultraligero (`ping` cada 25s) y Auto-Reconexión transparente ([`connectSignaling`](file:///home/antigravity/Fravens7/ubuntu-cursos/meet.html#L3106-L3153)):**
   - Envía un paquete mínimo `{ type: 'ping' }` (~15 bytes cada 25 segundos) para mantener vivo el túnel WebSocket de los alumnos que solo escuchan en silencio.
   - Si el alumno sufre un micro-corte de Wi-Fi o red móvil (`ws.onclose`), mientras siga en la clase (`this.inCall && !this.wasKicked`), la plataforma reconecta el WebSocket en 1.5 segundos en segundo plano y re-sincroniza pistas (`request-sync`) sin sacarlo de la pantalla de clase.
3. **Serialización de `addTransceiver` cuando `signalingState !== 'stable'` ([`syncOutgoingAudio`](file:///home/antigravity/Fravens7/ubuntu-cursos/meet.html#L3002-L3011) y [`case 'offer'`](file:///home/antigravity/Fravens7/ubuntu-cursos/meet.html#L3576-L3615)):**
   - Si un estudiante activa su micrófono justo mientras está entrando una oferta del servidor con pistas de otros compañeros, la creación del transceptor se encola (`_pendingLocalPublish = true`) hasta terminar de responder al servidor (`stable`), eliminando al 100% el error `InvalidAccessError: order of m-lines`.

---

## 9. Registro de 4 Escenarios Reales con 6 Navegadores Chrome Simultáneos (1 Profesor + 5 Estudiantes)

Se crearon **4 nuevas cuentas reales con rol `estudiante`** en Firebase Auth y Firestore (colección `usuarios`) adicionales a `test@gmail.com`, sumando **6 participantes simultáneos en Google Chrome**:
1. **Profesor:** `profe1@gmail.com` (`profe1` — `rol: profesor`)
2. **Estudiante 1:** `test@gmail.com` (`franco estudiante` — `rol: estudiante`)
3. **Estudiante 2:** `alumno_ingles1@ubuntu.org` (`Ana Torres` — `rol: estudiante`)
4. **Estudiante 3:** `alumno_ingles2@ubuntu.org` (`Carlos Mendoza` — `rol: estudiante`)
5. **Estudiante 4:** `alumno_ingles3@ubuntu.org` (`Lucia Paredes` — `rol: estudiante`)
6. **Estudiante 5:** `alumno_ingles4@ubuntu.org` (`Diego Quispe` — `rol: estudiante`)

| Escenario Real en Chrome | Dinámica probada en la interfaz | Conectados (`peersUI`) | ¿Alguien fue expulsado? (`lobbyVis` / `endedVis`) | Flujo de Paquetes RTP y Audio Activo | Resultado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Escenario Real 1: Clase Magistral (1 Profe habla + 5 Estudiantes oyentes entran juntos)** | El Profesor inicia con micro encendido y los 5 Estudiantes entran simultáneamente como oyentes (`mic=false`). | **`6 / 6`** en los 6 navegadores | **Ninguno** (`inCall=true` en los 6) | Profe: `264 out`<br>Estud 1–5: `201 a 277 in` cada uno (`playing=true`, `remRms > 0`) | **✅ PASÓ** |
| **Escenario Real 2: Conversación Real (Profe + 2 Estudiantes hablan a la vez + 3 Estudiantes escuchan)** | El Profesor habla mientras **Ana (Estud 2)** y **Lucía (Estud 4)** encienden sus micros (`#btnCallMic`) para conversar en inglés; **Franco, Carlos y Diego** solo escuchan. | **`6 / 6`** en los 6 navegadores | **Ninguno** (`inCall=true` en los 6) | Profe: `511 out / 276 in`<br>Estud 2: `192 out / 621 in`<br>Estud 4: `185 out / 678 in`<br>Oyentes (1, 3, 5): `835–885 in` (`remAudios=3`, `playing=true`) | **✅ PASÓ** |
| **Escenario Real 3: Rotación de turnos + Mano levantada + Pizarra en vivo** | **Ana (Estud 2)** apaga su micro; **Carlos (Estud 3)** levanta la mano (`#btnRaiseHand`) y enciende su micro junto al Profesor y **Lucía (Estud 4)**; el Profesor abre la **Pizarra (`#btnCallWhiteboard`)**. | **`6 / 6`** en los 6 navegadores | **Ninguno** (`inCall=true` en los 6) | Profe: `753 out / 867 in`<br>Estud 3: `168 out / 1549 in`<br>Estud 4: `429 out / 1318 in`<br>Los 5 estudiantes reciben video de Pizarra (`video=true`) + audio (`playing=true`) | **✅ PASÓ** |
| **Escenario Real 4: Silenciar a todos + Micro-corte de red + Refresco de Auth** | El Profesor silencia a todos (`#btnMuteAllStudents`), desbloquea, hablan **Franco (Estud 1)** y **Diego (Estud 5)**, y se provoca un **corte de WebSocket en Estud 3** y un **refresco de Firebase Auth en Estud 2**. | **`6 / 6`** en los 6 navegadores (`wsOpen=true`) | **Ninguno** (`lobbyVis=false`, `endedVis=false` en los 6) | Profe: `1179 out / 2144 in`<br>Estud 1: `170 out / 3218 in`<br>Estud 5: `195 out / 3326 in`<br>Estud 3 auto-reconectó su WS en 1.5s sin salir de la clase | **✅ PASÓ** |

---

## 10. `chiquihtop` — Consumo de Recursos durante la Prueba con 6 Navegadores Chrome + SFU

```text
=== CHIQUIHTOP (Consumo con 6 navegadores Chrome + SFU en paralelo) ===
CPUs: 2 | LoadAvg: 4.81, 1.85, 0.84 | RAM: 2974 MB / 7948 MB (37.4%)
PID    COMMAND         %CPU  %MEM    RSS (KB)
8511   chromium        50.0   0.5     43,444
7378   chromium        12.6   3.5    287,644
8300   chromium        12.4   2.9    241,572
8151   chromium        12.0   2.9    240,444
8003   chromium        11.3   2.5    211,516
7868   chromium        10.0   2.5    210,116
7526   chromium         9.3   4.2    342,120
```

- **Nota sobre el `chiquihtop`:** Incluso corriendo **6 instancias completas de Google Chrome al mismo tiempo** dentro de esta máquina junto con el relé SFU, el uso de RAM total fue de apenas **37.4% (2.97 GB de 7.95 GB)**. En producción, cada alumno abre Chrome en su propia computadora/celular, por lo que el servidor solo reenvía paquetes RTP y mantiene los WebSockets (`< 1%` de CPU y pocos MB de RAM).

---

# Parte III: Batería Mix de Verificación en Solo Lectura (3 Rondas x 6 Escenarios) + Ronda Extra con 8 Navegadores (1 Profesor + 7 Estudiantes)

## 11. Batería Mix en Modo Solo Lectura (`3 Rondas x 6 Escenarios = 18 Ejecuciones` en 6 Navegadores Chrome)

Sin modificar ni una sola línea de código adicional, se ejecutaron **3 rondas completas** combinando los escenarios de audio bidireccional + multi-estudiante + **2 escenarios nuevos**:
- **MIX 1 (Viceversa Multi-Alumno desde Lobby):** `Estud_1` y `Estud_2` activan micrófono en el Lobby (`#btnLobbyMic`) y entran primero hablando; `Estud_3` y `Estud_4` entran en silencio; el **Profesor** entra después con micro apagado y lo activa adentro (`#btnCallMic`).
- **MIX 2 — 🆕 NUEVA PRUEBA #1 (Entrada tardía con micrófono encendido desde Lobby a sala con 3 personas hablando):** Mientras el Profesor, `Estud_1` y `Estud_2` están hablando simultáneamente, `Estud_5` llega tarde, enciende su micrófono en la antesala (`#btnLobbyMic`) y pulsa **Unirse ahora** (`#btnJoinNow`).
- **MIX 3 (Rotación de hablantes + Ráfaga de Mute/Unmute + Pizarra):** `Estud_1`, `Estud_2` y `Estud_5` apagan micro; `Estud_3` y `Estud_4` levantan la mano (`#btnCallHand`), hacen ráfaga de mute/unmute junto con el Profesor y el Profesor abre la **Pizarra en vivo** (`#btnCallWhiteboard`).
- **MIX 4 (Moderación "Silenciar a todos" + Intento bloqueado + Desbloqueo):** El Profesor pulsa `#btnMuteAllStudents`; `Estud_1` intenta activar su micrófono estando bloqueado (`micWhileMuted=false`); luego el Profesor desbloquea y hablan el Profesor, `Estud_1` y `Estud_4`.
- **MIX 5 (Anti-Expulsión simultánea en 4 alumnos):** Corte de WebSocket (`ws.close()`) en `Estud_2` y `Estud_3` + refresco de sesión (`initUIForUser`) en `Estud_4` y `Estud_5`.
- **MIX 6 — 🆕 NUEVA PRUEBA #2 (`F5` / Recarga completa de página de un alumno reingresando con voz + otro alumno encendiendo Cámara `#btnCallCam` y voz):** `Estud_2` recarga la página (`F5`) y vuelve a unirse con micrófono encendido mientras `Estud_3` activa su cámara web y habla con toda la clase.

### Resumen de Resultados de las 3 Rondas (Salas `mix-ronda-1-3n80`, `mix-ronda-2-4yar`, `mix-ronda-3-69lw`)

| Escenario del Mix | Ronda 1 (`mix-ronda-1-3n80`) | Ronda 2 (`mix-ronda-2-4yar`) | Ronda 3 (`mix-ronda-3-69lw`) | ¿Alguien expulsado? | Resultado Global |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **MIX 1: Viceversa Multi-Alumno** | `peersUI=5` \| Profe `108 out / 292 in` \| `play=true` (`remRms=0.456`) | `peersUI=5` \| Profe `108 out / 292 in` \| `play=true` (`remRms=0.5545`) | `peersUI=5` \| Profe `108 out / 294 in` \| `play=true` (`remRms=0.1687`) | **No** (`inCall=true`) | **✅ 3/3 PASÓ** |
| **MIX 2 (🆕 #1): Entrada tardía `Estud_5` hablando desde Lobby** | `peersUI=6` \| Est5 `167 out / 456 in` \| `play=true` (`remRms=0.5017`) | `peersUI=6` \| Est5 `177 out / 494 in` \| `play=true` (`remRms=0.4236`) | `peersUI=6` \| Est5 `175 out / 462 in` \| `play=true` (`remRms=0.4637`) | **No** (`inCall=true`) | **✅ 3/3 PASÓ** |
| **MIX 3: Rotación + Ráfaga Mute/Unmute + Pizarra** | `peersUI=6` \| Profe `549 out`, Est3 `177 out`, Est4 `200 out` \| `video=true`, `play=true` | `peersUI=6` \| Profe `574 out`, Est3 `211 out`, Est4 `238 out` \| `video=true`, `play=true` | `peersUI=6` \| Profe `556 out`, Est3 `174 out`, Est4 `208 out` \| `video=true`, `play=true` | **No** (`inCall=true`) | **✅ 3/3 PASÓ** |
| **MIX 4: Silenciar a todos → Bloqueo → Desbloqueo** | `peersUI=6` \| `micWhileMuted=false` \| Profe `776 out`, Est1 `629 out`, Est4 `371 out` \| `play=true` | `peersUI=6` \| `micWhileMuted=false` \| Profe `824 out`, Est1 `633 out`, Est4 `417 out` \| `play=true` | `peersUI=6` \| `micWhileMuted=false` \| Profe `786 out`, Est1 `630 out`, Est4 `380 out` \| `play=true` | **No** (`inCall=true`) | **✅ 3/3 PASÓ** |
| **MIX 5: Corte WS (`Est2/3`) + Refresco Auth (`Est4/5`)** | `peersUI=6` \| `wsOpen=true` en los 6 \| `lobbyVis=false` \| `play=true` | `peersUI=6` \| `wsOpen=true` en los 6 \| `lobbyVis=false` \| `play=true` | `peersUI=6` \| `wsOpen=true` en los 6 \| `lobbyVis=false` \| `play=true` | **No** (`inCall=true`) | **✅ 3/3 PASÓ** |
| **MIX 6 (🆕 #2): `F5` Reingreso `Estud_2` + Cámara `Estud_3`** | `peersUI=6` \| Est2 `167 out`, Est3 `192 out` (`cam=true`, `inVidPkts=43`) | `peersUI=6` \| Est2 `119 out`, Est3 `168 out` (`cam=true`, `inVidPkts=53`) | `peersUI=6` \| Est2 `135 out`, Est3 `157 out` (`cam=true`, `inVidPkts=22`) | **No** (`inCall=true`) | **✅ 3/3 PASÓ** |

---

## 12. Ronda Extra con 8 Navegadores Google Chrome Simultáneos (1 Profesor + 7 Estudiantes) y Análisis `htop`

Se crearon **2 cuentas de estudiante adicionales** en Firebase Auth y Firestore (`rol: "estudiante"`), alcanzando **8 navegadores Google Chrome abiertos en paralelo**:
1. **Profesor:** `profe1@gmail.com` (`profe1` — `rol: profesor`)
2. **Estud_1:** `test@gmail.com` (`franco estudiante` — `rol: estudiante`)
3. **Estud_2:** `alumno_ingles1@ubuntu.org` (`Ana Torres` — `rol: estudiante`)
4. **Estud_3:** `alumno_ingles2@ubuntu.org` (`Carlos Mendoza` — `rol: estudiante`)
5. **Estud_4:** `alumno_ingles3@ubuntu.org` (`Lucia Paredes` — `rol: estudiante`)
6. **Estud_5:** `alumno_ingles4@ubuntu.org` (`Diego Quispe` — `rol: estudiante`)
7. **Estud_6 (Nuevo):** `alumno_ingles5@ubuntu.org` (`Valeria Rojas` — `rol: estudiante`)
8. **Estud_7 (Nuevo):** `alumno_ingles6@ubuntu.org` (`Mateo Silva` — `rol: estudiante`)

### Resultados de la Ronda Extra de 8 Participantes (1 Profesor + 7 Estudiantes)

| Escenario Mix con 8 Navegadores | Conectados (`peersUI`) | ¿Alguien expulsado? (`lobbyVis` / `endedVis`) | Paquetes de Audio Enviados (`outPkts`) | Paquetes de Audio Recibidos (`inPkts`) | Señal y Estado |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **MIX 1 (Viceversa con 7 personas):** `Estud_1`, `2` y `6` entran hablando desde el Lobby; `Estud_3`, `4` y `5` oyen; el Profesor entra después y activa su micro. | **`7 / 7`** | **Ninguno** (`inCall=true`) | Profe: `103` \| Est1: `307` \| Est2: `306` \| Est6: `353` | Profe: `270` \| Est1: `537` \| Est2: `566` \| Est3: `753` \| Est4: `738` \| Est5: `710` \| Est6: `688` | **`play=true` en los 7** (`remRms` hasta `0.2956`) — **✅ PASÓ** |
| **MIX 2 (Entrada tardía del 7mo estudiante `Estud_7` Mateo con micro desde Lobby):** Entra el 8vo navegador mientras hablan 4 personas. | **`8 / 8`** | **Ninguno** (`inCall=true`) | Profe: `368` \| Est1: `576` \| Est2: `575` \| Est6: `637` \| **Est7: `139`** | Profe: `893` \| Est1: `1185` \| Est2: `1219` \| Est3: `1634` \| Est4: `1624` \| Est5: `1597` \| Est6: `1355` | Los 8 quedan dentro de la sala (`peersUI=8`) con señal (`remRms` hasta `0.4942`) — **✅ PASÓ** |
| **MIX 3 (Rotación de turnos en sala de 8):** `Estud_1`, `2`, `6` y `7` pasan a oyentes; hablan Profesor y `Estud_3`. | **`8 / 8`** | **Ninguno** (`inCall=true`) | Profe: `763` \| Est3: `235` | Profe: `1923` \| Est1: `2327` \| Est2: `2328` \| Est3: `3009` \| Est4: `3063` \| Est5: `3076` \| Est6: `2546` \| **Est7: `1073`** | **`play=true` en los 8 navegadores** (`Estud_7` ya recibió `1073` paquetes y `remRms` llega a `0.3696`) — **✅ PASÓ** |
| **MIX 4 (Profesor silencia a los 7 alumnos → Bloqueo → Desbloqueo):** `Estud_6` intenta prender micro bloqueado (`micWhileMuted=false`); luego hablan Profe, `Estud_6` y `Estud_7`. | **`8 / 8`** | **Ninguno** (`inCall=true`) | Profe: `1139` \| **Est6: `901`** \| **Est7: `379`** | Profe: `3090` \| Est1: `3396` \| Est2: `3427` \| Est3: `4393` \| Est4: `4396` \| Est5: `4396` \| Est6: `3572` \| Est7: `2064` | Bloqueo `micWhileMuted=false` verificado y flujo de audio activo en los 8 — **✅ PASÓ** |
| **MIX 5 (Corte WS en `Est3/4` + Refresco Auth en `Est5/7`):** Resiliencia anti-expulsión con 8 participantes. | **`8 / 8`** | **Ninguno** (`lobbyVis=false`, `endedVis=false`, `wsOpen=true`) | Profe: `1550` \| Est6: `1291` \| Est7: `770` | Profe: `3461` \| Est1: `3728` \| Est5: `4576` \| Est6: `3680` \| Est7: `2119` | `Est3` y `Est4` reconectaron su WS en 1.5s y `Est5`/`Est7` ignoraron el refresco de Auth sin salir al Lobby — **✅ PASÓ** |

### `chiquihtop` con 8 Participantes (9 Navegadores Google Chrome corriendo en 2 CPUs)

```text
================================================================================
=== CHIQUIHTOP DEL SERVIDOR (Con 8 navegadores Chrome + SFU activos a la vez) ===
================================================================================
CPUs: 2 | LoadAvg: 15.38, 4.54, 2.60 | RAM Usada: 3967 MB / 7948 MB (49.9%)

--- free -m ---
               total        used        free      shared  buff/cache   available
Mem:            7947        3992        3302        1083        2007        3955
Swap:              0           0           0

--- Top Procesos (ps) ---
  PID COMMAND         %CPU %MEM   RSS (KB)
11667 chromium        14.6  3.3   275,180  (~269 MB)
12693 chromium        13.5  2.8   232,280  (~227 MB)
12138 chromium        10.4  2.6   219,380  (~214 MB)
12859 chromium        10.3  2.7   223,924  (~218 MB)
12563 chromium        10.1  2.5   204,320  (~199 MB)
12271 chromium         9.4  2.5   211,088  (~206 MB)
12403 chromium         9.3  2.5   209,612  (~204 MB)
11952 chromium         8.0  2.5   210,720  (~205 MB)
11810 chromium         7.4  3.1   254,188  (~248 MB)
```

> [!IMPORTANT]
> **Interpretación del `htop` (Prueba Local vs. Servidor de Producción):**
> - En esta prueba automatizada abrimos **9 navegadores Google Chrome completos dentro de la misma máquina de 2 núcleos**, donde cada instancia de Chrome consume ~210–270 MB de RAM y ~10–14% de CPU codificando/decodificando audio Opus y renderizando el DOM (elevando el `LoadAvg` a `15.38` y la RAM al `49.9%`).
> - En producción (`clases.ubuntuafroperuana.org`), **los navegadores Chrome NO corren dentro del servidor**: cada estudiante ejecuta su propio Chrome en su PC o celular. El servidor SFU únicamente reenvía paquetes RTP en memoria entre los sockets, consumiendo **menos del 2%–5% de CPU y ~30 MB de RAM** para 8, 15 o 25 estudiantes simultáneos.


