# Kantinazo

Aplicación de escritorio para Windows que abre el HaxBall original (https://www.haxball.com/play)
en una interfaz propia en blanco y negro.

## Obtener el instalador (.exe)

El instalador no está compilado todavía: hay que generarlo en Windows una sola vez.
Dos caminos, ninguno pide escribir comandos:

**A. En la nube (no instalás nada).** Subí esta carpeta a un repositorio de GitHub, abrí la pestaña
*Actions*, elegí «Crear instalador de Kantinazo» y pulsá *Run workflow*. Al terminar, descargá
`Kantinazo-Setup` desde *Artifacts*: adentro está el `.exe`.

**B. En tu PC.** Instalá Node.js LTS (https://nodejs.org) y hacé doble clic en `CREAR-INSTALADOR.bat`.
El archivo hace todo solo y abre la carpeta `dist` con `Kantinazo-Setup-1.0.0.exe`.

## Instalar y usar

Doble clic en `Kantinazo-Setup-1.0.0.exe`. El instalador crea el acceso directo en el escritorio y en
el menú Inicio, y abre Kantinazo al terminar. El instalador incluye Electron y Node.js: quien lo use
no necesita instalar nada más.

## Qué está conectado realmente a HaxBall

| Función | Estado |
| --- | --- |
| Salas | Carga la lista oficial de `haxball.com/play` dentro de la app. |
| Jugar / partidas | Es el cliente oficial: físicas, equipos, chat y jugadores reales. |
| Entrar por enlace | Abre `https://www.haxball.com/play?c=...` en el cliente oficial. |
| Favoritos, ajustes | Locales, en `%APPDATA%/kantinazo`. |

## Limitaciones

- HaxBall no tiene API pública de salas: Kantinazo no puede mostrar su propia lista, contar jugadores, buscar ni filtrar. Lo hace el cliente oficial.
- Los favoritos son enlaces que pegás vos.
- El instalador no está firmado digitalmente: Windows SmartScreen puede mostrar un aviso («Más información» y «Ejecutar de todas formas»).

## Seguridad

Contexto aislado, sin Node ni preload en la vista de HaxBall, navegación limitada a `*.haxball.com`,
permisos denegados salvo pantalla completa, y canales IPC validados.
