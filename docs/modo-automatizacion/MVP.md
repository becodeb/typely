# Modo Automatización — especificación de producto del MVP

> `CLAUDE.md` prevalece ante cualquier contradicción con este documento.

## 1. Resumen

Modo Automatización ocupa el tercer orbe, hoy dormido, del selector de TYPELY.
Es un sandbox persistente de programación por bloques inspirado en el bucle de
mejora de *The Farmer Was Replaced*, adaptado a primaria.

El alumno programa su nave para recorrer un campo y cosechar cristales que
crecen solos. Puede avanzar con secuencias directas, pero descubre que memoria,
bucles y luego sensores permiten producir mucho más con menos intervención.

No reemplaza Code.org, Scratch ni Pilas Bloques: es un complemento donde los
conceptos que el alumno ya vio —o ve usar a un compañero— ofrecen una ventaja
económica inmediata.

## 2. Promesa y ciclo

> Programá la nave, mirala trabajar y encontrá una forma cada vez más
> inteligente de llenar tu colección de cristales.

```text
cristales crecen → armo/mejoro programa → ejecuto y observo
        ↑                                      ↓
compro mejoras ← cosecho y aumento producción ←┘
```

## 3. Principios no negociables

### Es juego, no clase

- Sin lecciones, exámenes, consignas largas ni tutorial obligatorio.
- El alumno puede progresar por fuerza bruta; programar mejor acelera el juego.
- La ayuda aparece solo al pedirla o como demostración visual breve.

### Eficiencia como consecuencia

`Repetir` no da un bonus artificial. Conviene porque la memoria es limitada,
extiende el trabajo autónomo de la nave y comprar muchas ranuras se encarece.
Cualquier solución que funcione es válida.

### Lectura mínima

- Bloques: dibujo, forma, color y animación; no etiquetas permanentes.
- Mejoras: ícono más vista previa animada.
- Solo se muestran números necesarios: saldo, precio, capacidad y producción.
- Todo ícono mantiene nombre accesible (`aria-label`) y ayuda bajo demanda.
- El significado nunca depende solamente del color.

### Revelado progresivo

No mostrar una tienda llena de candados. Cada categoría aparece cuando empieza
a ser útil, con una animación única y breve.

### Mundo persistente, intentos seguros

- Detener o terminar devuelve la nave al origen.
- Campo, crecimiento, cosechas y saldo no se reinician.
- Ejecutar y equivocarse nunca cuesta cristales.

## 4. Fantasía visual

El campo es una plataforma flotante de cristal dentro del cielo mágico de
TYPELY. La nave del alumno cosecha vetas que brotan del suelo.

### Cristales

- Al menos cuatro siluetas: punta alta, racimo, prisma y estrella mineral.
- Colores: turquesa, violeta, rosa, azul y dorado.
- En el MVP todas las variantes pueden valer lo mismo.
- Estados: brillo en suelo, brote, creciendo y listo.
- “Listo” se comunica por tamaño, destello y movimiento, no solo color.

### Assets

- Reutilizar `CharacterSkin` o las vistas direccionales de la nave existentes.
- Se permiten las gemas de Órbita como placeholders temporales.
- No modificar originales de `Images/` ni `Images-new/`.
- Evitar emojis como arte final, cajas blancas, dashboards y decoración genérica
  de “AI slop”. La interfaz debe sentirse parte de TYPELY.

## 5. Pantalla principal

Debe entrar completa en 1366×768 sin scroll.

```text
┌────────────────────────────────────────────────────────────┐
│ volver                           cristales   producción/min │
├──────────────────────────────────────┬─────────────────────┤
│ PALETA       PROGRAMA                │     CAMPO 2×2       │
│ [↑]          ┌───────────────┐       │   cristales+nave    │
│ [↶]          │       ↑       │       │                     │
│ [↷]          ├───────────────┤       ├─────────────────────┤
│ [cosechar]   │   cosechar    │       │ EJECUTAR / DETENER  │
│              ├───────────────┤       │                     │
│              │       ↷       │       │                     │
│              └───────────────┘       │                     │
├──────────────────────────────────────┴─────────────────────┤
│                       MEJORAS                              │
└────────────────────────────────────────────────────────────┘
```

- Editor grande a la izquierda; campo a la derecha.
- Botón principal inmediatamente debajo del campo.
- Tienda como franja compacta inferior.
- Cabecera solo con volver, saldo y producción reciente.
- Campo y editor son las dos superficies dominantes; no anidar tarjetas.

### Botón principal

- Detenido: grande, verde, ícono de reproducir.
- Ejecutando: misma posición/tamaño, rojo, ícono de detener.
- El rojo significa control inmediato, no error.
- Siempre visible y táctil.

## 6. Campo y simulación

### Estado inicial

- Cuadrícula 2×2.
- Nave abajo a la izquierda, mirando arriba.
- Al menos un cristal maduro y otro creciendo.
- Las vetas reaparecen solas; no existe `Plantar` en el MVP.

### Reloj del campo

El crecimiento continúa mientras el alumno edita, compra, espera o ejecuta. No
hay crecimiento/producción offline. Al ocultar la pestaña se pausa el mundo y
se reanuda sin compensar el tiempo ausente.

### Fin y detención

Al terminar o tocar detener:

1. cancelar instrucción y animación pendientes;
2. teletransportar brevemente la nave al origen;
3. devolver orientación hacia arriba;
4. volver el botón a verde;
5. conservar cristales, edades y saldo.

El regreso no es una instrucción programable ni debe parecer un movimiento por
el tablero.

### Acciones inútiles

- Avanzar contra un borde: rebote corto, consume acción y continúa.
- Cosechar sin cristal maduro: consume acción y no recompensa.
- Sin modales ni palabra “ERROR”; el desperdicio debe verse.

Estas ineficiencias crean luego la necesidad natural de sensores.

## 7. Bloques

### Edición

- Tocar en paleta agrega al próximo espacio libre.
- Tocar un bloque colocado lo quita.
- Arrastrar reordena, pero nunca es la única forma de editar.
- Editor bloqueado mientras corre el programa.
- Bloque activo iluminado en sincronía con la nave.
- Si no hay capacidad, vibran las ranuras y brilla la mejora de memoria.

### Capacidad

- Inicial provisional: 3 bloques.
- Representar con chips, ranuras o luces.
- Cada acción y cada contenedor `Repetir` ocupan una unidad; también cuentan sus
  bloques interiores.

### Bloques iniciales

| ID interno | Dibujo | Efecto |
| --- | --- | --- |
| `move_forward` | flecha recta | avanza según la orientación |
| `turn_left` | flecha curva izquierda | gira 90° |
| `turn_right` | flecha curva derecha | gira 90° |
| `harvest` | tenaza/láser tomando cristal | cosecha la casilla actual |

Los IDs y nombres no aparecen en la experiencia normal.

### Primer desbloqueo lógico: `Repetir N`

Es obligatorio en el MVP: sin él no se valida la hipótesis del juego.

- Contenedor con flecha circular y número grande.
- Empieza en 2; el número permite elegir entre pocas opciones visuales.
- Acepta acciones dentro de una cavidad evidente.
- El contenedor pulsa en cada vuelta y se ilumina la acción interna.
- Un solo nivel de anidamiento en el MVP.
- Fuera del MVP: `Por siempre`, sensores, condiciones, funciones y variables.

## 8. Economía y mejoras

### Moneda y medición

Una moneda: cristales cosechados. Mostrar temprano cristales por minuto porque
es el espejo de la eficiencia. Calcularlo como tasa reciente, animar mejoras y
guardar récord personal. No usar riqueza histórica como única comparación.

### Tienda progresiva

Orden inicial de aparición:

1. **Capacidad** — chip/ranuras con `+1`.
2. **Velocidad de nave** — nave con estelas.
3. **Crecimiento** — cristal junto a reloj.
4. **Nuevos bloques** — caja/pieza; contiene `Repetir`.
5. **Estadísticas** — gráfico; se desbloquea, no se compra.

Reglas:

- Una categoría nueva por vez; no cinco candados iniciales.
- Precio = ícono de cristal + número.
- Compra con consecuencia visual inmediata.
- Saldo insuficiente: pulso que conecta precio y contador, sin modal.
- Capacidad siempre comprable, pero cada nivel se encarece.
- Velocidades ayudan, pero un buen programa debe vencer a uno malo con mejoras
  físicas.

## 9. Primer ingreso sin tutorial

1. Una veta madura brilla en el origen.
2. `Cosechar` pulsa una vez.
3. Al tocarlo ocupa la primera ranura.
4. El botón verde se ilumina.
5. Ejecutar cosecha, suma saldo y reinicia la veta.
6. Luego madura una veta delante y `Avanzar` pulsa una vez.

Sin bocadillos ni bloqueo de exploración. Si el jugador hace otra acción válida,
el onboarding se adapta o desaparece.

## 10. Accesibilidad y sonido

- Sonidos distintos para agregar, ejecutar, girar, cosechar, comprar, chocar y
  detener; nunca como única señal.
- Respetar opción global de sonido y `prefers-reduced-motion`.
- Áreas táctiles de al menos 44×44 px.
- Todos los controles operables con teclado y foco visible.
- Sin información esencial exclusiva de hover.
- Pulsación larga o foco puede mostrar/leer el nombre corto de un ícono.

## 11. Persistencia

Persistir localmente por alumno:

- saldo y mejoras;
- categorías reveladas y capacidad;
- desbloqueo de `Repetir`;
- programa JSON versionado;
- etapa/edad de cada veta;
- récord de producción;
- onboarding visto.

No guardar una ejecución activa: al reingresar, nave en origen y programa
detenido. Demo nunca llama a la API. Para cuentas reales el primer MVP puede ser
local detrás de una interfaz de almacenamiento; esto no autoriza fallback local
de autenticación.

## 12. Competencia entre pares

La visión posterior incluye producción reciente y récord semanal dentro del
grupo, visitar campos y compartir/remixar programas. Nunca ranking global de
menores ni riqueza histórica como métrica principal.

El backend social queda fuera del primer MVP. Primero validar que el alumno:

1. construye y ejecuta sin leer;
2. relaciona programa con producción;
3. percibe el salto de `Repetir`;
4. quiere volver a optimizar.

## 13. Dispositivos y navegación

- Entrada desde el tercer orbe de `/modos`.
- Ruta sugerida: `/automatizacion`.
- Solo rol alumno, incluido demo.
- Chromebook/PC jugable; tablet horizontal como objetivo secundario.
- Teléfono no jugable: usar la única guarda responsive existente.
- Volver conserva estado y lleva a `/modos`.

## 14. Alcance del MVP

Incluye:

- tercer orbe activo y pantalla inmersiva;
- nave real, campo 2×2 y cuatro variantes de cristal;
- cuatro etapas de crecimiento;
- cuatro bloques iniciales con íconos;
- capacidad limitada, tap, quitar y reordenar;
- ejecutar, resaltar, detener y volver al origen;
- saldo, tasa reciente y récord;
- capacidad, movimiento, crecimiento y revelado progresivo;
- compra y uso de `Repetir N`;
- persistencia local abstraída;
- accesibilidad y reducción de movimiento.

No incluye:

- selector de temas o campo mayor;
- plantar, sensores, condiciones, `Por siempre`, funciones o variables;
- producción offline;
- ranking/visitas/remix con backend;
- cosméticos, nuevas monedas o misiones lineales;
- arte definitivo obligatorio.

## 15. Parámetros de playtesting

Centralizar, no dispersar por componentes:

- duración de acción y crecimiento;
- valor de cosecha;
- capacidad inicial;
- precios y curvas;
- umbrales de revelado;
- multiplicadores de velocidad;
- opciones de N;
- ventana de producción;
- máximo de instrucciones.

Quien implemente elige valores iniciales razonables. No son diseño cerrado.

## 16. Preguntas de prueba

- ¿Agrega, quita y reordena sin explicación?
- ¿Lee la orientación y predice una secuencia?
- ¿Encuentra detener mientras la nave se mueve?
- ¿Entiende que vuelve al origen sin reiniciar el campo?
- ¿Comprende una compra mirando su consecuencia?
- ¿Percibe el cambio en producción?
- ¿Descubre para qué sirve `Repetir`?
- ¿Puede recuperarse de un programa malo solo?
- ¿Todo cabe y se entiende en 1366×768?

La prueba central no es preguntar qué es un bucle: es comprobar si decide usarlo
porque reconoce que ahorra trabajo y aumenta la producción.

