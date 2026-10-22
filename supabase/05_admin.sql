-- CONSULTAS SOLO PARA SQL EDITOR. No exponer estas consultas con la API.
-- Exportar el resultado como CSV desde el panel de Supabase.
-- Ante nombres que empiezan con signos de fórmula, anteponer apóstrofo para Excel.
select
 case when first_name ~ '^[=+@-]' then chr(39)||first_name else first_name end as nombre,
 case when last_name ~ '^[=+@-]' then chr(39)||last_name else last_name end as apellido,
 case when email ~ '^[=+@-]' then chr(39)||email else email end as mail,
 score as puntaje, elapsed_ms as tiempo_ms, registered_at as fecha,
 marketing as acepto_novedades, privacy_version as version_aviso, consent_at as consentimiento
from trivia_private.participants order by registered_at;

-- Enviar novedades SOLAMENTE a marketing_contacts. Incluye las bajas aplicadas.
-- select * from trivia_private.marketing_contacts order by consent_at;

-- BAJA DE NOVEDADES: reemplazar el mail y ejecutar solo esta sentencia seleccionada.
-- delete from trivia_private.marketing_contacts where email=lower('persona@ejemplo.com');
-- update trivia_private.participants set marketing=false where email=lower('persona@ejemplo.com');

-- SUPRESIÓN COMPLETA: verificar identidad por el circuito del club, luego seleccionar:
-- begin;
-- delete from trivia_private.sessions where participant_id in
-- (select id from trivia_private.participants where email=lower('persona@ejemplo.com'));
-- delete from trivia_private.participants where email=lower('persona@ejemplo.com');
-- delete from trivia_private.marketing_contacts where email=lower('persona@ejemplo.com');
-- commit;
