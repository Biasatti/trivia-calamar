-- Habilitar pg_cron en Database > Extensions antes de ejecutar.
-- Ejecutar UNA VEZ. Consultar cron.job para evitar jobs duplicados.
-- Limpieza cada hora; los datos se eliminan a los 90 días en la próxima ejecución.
select cron.schedule('trivia-calamar-cleanup', '0 * * * *', 'select trivia_private.cleanup();');
-- Verificar ejecución: select * from cron.job_run_details order by start_time desc limit 10;
