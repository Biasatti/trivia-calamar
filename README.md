# Trivia Calamar · Noche de Copas

Web móvil para el Club Atlético Platense. Lista para subir a un repositorio y publicar con GitHub Pages. No necesita compilarse ni instalar Node para funcionar.

**Estado de entrega:** demo funcional; conexión real a Supabase preparada, pero todavía sin configurar. No se recopilan datos reales hasta activar expresamente el modo `live`.

## 1. Publicar la demo en GitHub

1. Descomprimí el ZIP.
2. Creá un repositorio (por ejemplo, `trivia-calamar`).
3. Subí **el contenido de la carpeta `trivia-calamar`**: `docs`, `supabase`, `tests`, `README.md`, etc. No subas el ZIP sin descomprimir ni anides otra carpeta encima.
4. En el repositorio, abrí **Settings → Pages**.
5. Elegí **Deploy from a branch**, rama `main`, carpeta **`/docs`**, y guardá.
6. Esperá la publicación y abrí el enlace que muestra GitHub.

La demo permite jugar, ver el resultado, completar un formulario con datos ficticios y ver un ranking de ejemplo. No envía nombre, apellido ni mail a ningún servidor y no los persiste. Se borran al cerrar/recargar la página. GitHub sí puede generar sus registros técnicos de alojamiento.

La web abre desde QR, NFC o un enlace normal. Configurá el QR/NFC con la URL final publicada. No se entrega ningún QR con una URL ficticia.

## 2. Qué incluye

- Diseño marrón y blanco, con el escudo y la estrella extraídos de la presentación provista.
- Bienvenida, preguntas, resultado, registro y ranking.
- Banco de 35 preguntas corregidas para entenderse individualmente; Goyeneche en la pregunta 5.
- 10 preguntas por partida: 4 fáciles, 4 intermedias, 2 difíciles; preguntas y opciones en orden aleatorio.
- 10 puntos por acierto; máximo 100. El resultado y el tiempo se ven antes del registro.
- Registro con nombre, apellido y mail. Consentimiento de participación obligatorio; novedades opcionales.
- Ranking por puntaje descendente, tiempo exacto ascendente y orden de registro para empate total. Se muestran los primeros 50 y el puesto propio aunque sea inferior.
- Primera partida **registrada** por mail; volver a jugar no reemplaza el primer resultado.
- API que calcula el puntaje y el tiempo en PostgreSQL, sin aceptar un puntaje enviado por el navegador.
- Tablas privadas con RLS, acceso público limitado a funciones específicas. El ranking no devuelve mails ni apellidos completos.
- Recuperación de la partida en la misma pestaña durante 24 horas, en modo real.
- Aviso de privacidad con domicilio y correo de Platense; alojamiento pendiente de completar.
- Limpieza programable a los 90 días del evento y contactos de novedades separados.

## 3. Activar datos reales (Supabase)

Creá el proyecto en una cuenta controlada por Platense. Confirmá región/país de alojamiento y plan adecuado a la asistencia esperada. Este paquete no crea cuentas, contrata servicios ni habilita una base externa.

### Base de datos

En **SQL Editor**, ejecutá en este orden:

1. `supabase/01_schema.sql`: tablas privadas y funciones. Ejecutar una sola vez en un proyecto nuevo.
2. `supabase/02_questions.sql`: las 35 preguntas. Es reutilizable para actualizar el banco.
3. Habilitá la extensión **pg_cron** en **Database → Extensions**.
4. `supabase/03_retention.sql`: programa la limpieza horaria. Ejecutar una vez; verificar el job y sus ejecuciones. La eliminación se produce al cumplirse 90 días, en la próxima ejecución horaria. Si el servicio se pausa, el administrador debe restablecer el job y ejecutar la limpieza pendiente.
5. Completá y ejecutá las líneas indicadas en `supabase/04_launch.sql` con la fecha y hora **real de finalización** del evento y zona `-03:00`. No se incluyó una fecha supuesta.

El inicio de nuevas partidas cierra en esa fecha; el registro tiene una hora de gracia para partidas ya iniciadas. El esquema `trivia_private` NO debe añadirse a los esquemas expuestos en la Data API. Mantené expuesto `public` para las funciones RPC.

### Aviso y configuración

1. Completá el apartado 6 de `docs/privacidad.html`: proveedor, región, transferencias, registros técnicos y copias de seguridad. Confirmá el procedimiento con Socios y la revisión legal del club. Quitá los avisos de borrador solo una vez finalizada esa revisión.
2. Editá `docs/config.js`:

```js
window.TRIVIA_CONFIG = {
  mode: 'live',
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabasePublishableKey: 'TU-CLAVE-PUBLICABLE',
  privacyReady: true,
  privacyVersion: '2026-10-22-v1'
};
```

La URL y la clave **publishable** se obtienen en el panel del proyecto. Es normal que una clave publicable se vea en el navegador: la protección está en los permisos del servidor. **Nunca uses una clave `secret` o `service_role`, una contraseña de base de datos ni un token de administración.** No hace falta crear usuarios de Supabase Auth para los participantes.

Si cambiás el texto de consentimiento, actualizá su versión en el HTML, `config.js` y `trivia_private.settings.privacy_version`. Se conserva en cada registro.

3. Subí los cambios a GitHub y verificá que Pages publique la nueva versión.
4. Probá dos partidas desde dos celulares reales, completá registros ficticios, revisá el ranking compartido y comprobá que el exportador muestre los datos. Eliminá las pruebas antes del evento.

Si la configuración está incompleta, el modo real muestra una pantalla de preparación; no simula registros exitosos.

## 4. Dónde se ven los nombres y mails

Quedan en `trivia_private.participants`, dentro del proyecto Supabase del club. Solo administradores autorizados acceden por el panel. Las consultas de `supabase/05_admin.sql` permiten exportar participantes a CSV y gestionar solicitudes de baja/supresión.

- `participants`: registros de trivia, puntajes, tiempo y consentimiento; 90 días desde el evento.
- `marketing_contacts`: exclusivamente personas que optaron por novedades; hasta la baja, con revisión periódica.
- `sessions`: token temporal y respuestas de juego; limpieza tras 24 horas.
- `questions`: banco de preguntas; sin datos personales.

No hay panel de administración público ni contraseña de administrador en la web. Las exportaciones tampoco deben subirse al repositorio. Las bajas de novedades se atienden por Socios y se aplican también a la herramienta usada para enviar mails. La web **no envía campañas ni correos automáticamente**.

Cuando un mail ya existe, se conserva el primer resultado y sus consentimientos originales; el nuevo formulario no modifica sus preferencias. Cambios de preferencias se tramitan por el canal del club.

## 5. Reglas y límites de esta versión

- Trivia recreativa, sin premios: el mail no se verifica mediante un enlace. La unicidad limita repeticiones casuales, pero no acredita identidad ni impide usar mails diferentes. Para una competencia con premios se requiere verificación de identidad y controles adicionales.
- El tiempo real lo registra el servidor desde que crea la primera pregunta hasta recibir la décima respuesta. Incluye latencia y eventuales interrupciones de conexión; el registro queda fuera. El reloj visible es orientativo y se sincroniza con las respuestas del servidor.
- Las respuestas no se revelan durante la partida. El banco de demo y los archivos de preguntas están incluidos en el repositorio: no se busca impedir que alguien estudie las respuestas. Ocultar un archivo no constituye protección competitiva.
- No funciona sin conexión en modo real. Reintentar una respuesta ya recibida no suma puntos dos veces.
- Hay un límite global de 300 inicios por minuto para moderar carga, no un sistema completo contra bots. Una difusión pública masiva requiere un control por cliente/CAPTCHA mediante una capa de servidor adicional. Ajustar capacidad antes del evento según concurrencia prevista.
- El borrado programado afecta la base activa. Hay que confirmar y documentar las copias de seguridad del proveedor y eliminar también los CSV exportados cuando corresponda.
- Esta configuración corresponde a un solo evento. Para otro evento, usar un proyecto nuevo o diseñar soporte multievento; no cambiar la fecha para conservar indebidamente datos anteriores.

## 6. Prueba local y mantenimiento

Para probar la web sin subirla, abrí una terminal dentro de la carpeta y ejecutá:

```sh
python3 -m http.server 8080 --directory docs
```

En Windows también podés usar `py -m http.server 8080 --directory docs`. Abrí `http://localhost:8080`. No abras `index.html` con doble clic: los módulos y la carga de preguntas requieren un servidor HTTP.

No hay dependencias externas en la web; las fuentes son del sistema. Node solo es necesario para las pruebas:

```sh
npm install
npm run check
npm test
```

Las pruebas de backend ejecutan las funciones SQL en PostgreSQL embebido (PGlite), con roles anónimos, y comprueban permisos, puntajes, idempotencia, registros duplicados, consentimiento y limpieza. No sustituyen la prueba final en Supabase: allí se deben verificar REST, permisos del proveedor, pg_cron, exportación y conexión móvil.

Para modificar preguntas, editar `docs/questions.json` y regenerar `supabase/02_questions.sql` con `python3 scripts/generate_seed.py`; luego ejecutar el SQL en el panel. Las partidas ya iniciadas conservan su propia copia de preguntas.

## 7. Estructura

| Archivo/carpeta | Uso |
| --- | --- |
| `docs/` | Sitio público que GitHub Pages publica. |
| `docs/config.js` | Modo demo/real y conexión publicable. |
| `docs/questions.json` | Banco de preguntas para demo. |
| `docs/privacidad.html` | Aviso del club para completar y validar. |
| `supabase/` | SQL de instalación, retención, activación y administración. |
| `scripts/` | Generación del banco SQL a partir del JSON. |
| `tests/` | Pruebas de lógica y de base de datos. |
| `VALIDACION.md` | Verificaciones y pendientes antes del evento. |

## Referencias técnicas

- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Funciones PostgreSQL/Supabase: https://supabase.com/docs/guides/database/functions
- Protección de datos en Supabase: https://supabase.com/docs/guides/database/secure-data
- Cron: https://supabase.com/docs/guides/database/extensions/pg_cron

El escudo pertenece al Club Atlético Platense y fue extraído de la presentación proporcionada para este evento. Confirmar su utilización institucional con el club.
