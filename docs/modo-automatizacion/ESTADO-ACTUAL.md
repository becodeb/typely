# Vivero — estado actual

Traspaso de la sesión del 8 de septiembre de 2026. Este documento registra
lo implementado y lo pendiente; `CLAUDE.md` sigue siendo el rulebook.

## Implementado en esta sesión

- [x] Indicadores de crecimiento, tiempo restante, estado «lista» e inspector
  de la baldosa, incluida la detención por falta de espacio entre estrellas.
- [x] Preparar tierra (`clear`) desde 3×3 deja la baldosa vacía sin recompensa.
  Chispas y cuarzos se pueden replantar gratis para recuperar un campo sin saldo.
- [x] Primer cuarzo maduro garantizado al ampliar a 2×2, delante del muelle.
- [x] Ajustes iniciales: ciclo de chispa de 6 segundos, Repetir cuesta
  8 chispas y Si cuesta 3 cuarzos.
- [x] Objetivo visible y tienda más legible, con catálogo de mejoras.
- [x] Nombres de bloques y gráficos SVG para flechas y Repetir.
- [x] Deshacer y rehacer hasta 50 versiones; alcanza solo al editor,
  no revierte el campo, las cosechas ni las compras.
- [x] Pausar, reanudar y ejecutar un paso; el mundo queda congelado en pausa.
- [x] Ocultar la pestaña pausa la ejecución.
- [x] Exportación e importación de copias JSON con validación.
- [x] Métricas básicas por corrida y guía de uso.

## Verificación

- [x] `node scripts/probar-automatizacion.mjs`: **105/105 pruebas pasan**.
  Incluye recuperación gratuita, primer prisma alcanzable, motivos de rechazo,
  crecimiento consistente y compras al tope sin gasto.
- [ ] Build general: lo verifica el agente principal antes del cierre.
- [ ] QA avanzada de arrastre y recorrido por todas las eras.

## Pendiente — no considerar resuelto

- [ ] Expansión ilustrada a 5×5 y segunda nave.
- [ ] Sincronización de cuenta, backend y progreso visible para docentes.
- [ ] Desafíos, contenido final, cosméticos y audio.
- [ ] Comparación de versiones durante el mismo tiempo de ejecución.
- [ ] Trazas completas de las decisiones de los sensores.

## Límites del traspaso

- Trabajo actual en la rama `fix/lienzo-ajustes`; no se realizó despliegue.
- Preservar el arte original de `Images/` y `Images-new/`.
- En móvil sigue vigente el guard `SoloEnComputadora`.
- Los documentos originales no se modificaron en este traspaso; revisar su
  contenido contra el código antes de usarlos como descripción del estado actual.
