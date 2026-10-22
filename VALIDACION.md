# Verificación de entrega

Fecha: 22 de octubre de 2026.

## Verificado

- JavaScript válido: `npm run check`.
- Cinco pruebas automatizadas aprobadas: `npm test`.
- Banco: 35 preguntas, cuatro opciones válidas, sin preguntas duplicadas, Goyeneche incluido.
- Muestreo: 100 partidas con diez preguntas únicas y distribución 4/4/2.
- PostgreSQL embebido (PGlite): instalación de esquema y preguntas, permisos del rol anónimo, registro bloqueado sin consentimiento, puntaje calculado por servidor, respuesta repetida idempotente, primer resultado por mail, ranking sin mail/apellido completo y limpieza de datos a 90 días conservando solo contactos autorizados.
- Navegador: partida demo completa, puntaje antes del formulario, registro ficticio sin aceptar novedades y acceso al ranking.
- Diseño móvil: vista de 390 px, pregunta y respuestas legibles, sin desbordamiento horizontal.
- Recuperación preparada para modo real; token en sessionStorage, sin datos personales persistidos en el navegador.

## Pendiente de configuración real

- Crear/configurar el proyecto Supabase del club y su región.
- Probar las funciones mediante la API REST real y dos celulares después de conectar.
- Activar y verificar pg_cron. La prueba local ejecutó la función de limpieza, no el planificador de Supabase.
- Definir la fecha/hora de fin del evento y completar el aviso de alojamiento y backups.
- Probar concurrencia con el volumen esperado de asistentes y la conexión del salón.
- Atender bajas/exportaciones con acceso administrativo autorizado y eliminar datos de prueba.

No se desplegó la web ni se conectó una base externa. El paquete inicia en modo demo.
