# Modo Automatización — guía técnica de implementación

> Leer primero [`MVP.md`](MVP.md). `CLAUDE.md` prevalece ante cualquier
> contradicción.

## 1. Objetivo

Dar a la próxima IA contratos suficientes para implementar un juego real, no
una maqueta, sin duplicar estado entre React y las animaciones ni ejecutar código
arbitrario generado por bloques. Los números de balance son provisionales.

## 2. Integración prevista

- Activar el tercer orbe en `src/pages/orbita/ModosPage.tsx`.
- Extender el tipo de `src/components/orbita/Orbe.tsx` sin romper los existentes.
- Añadir una imagen propia o placeholder deliberado del mundo nuevo.
- Añadir ruta lazy `/automatizacion` dentro de la superficie de alumno.
- Proteger teléfono con `SoloEnComputadora`/`useEsCelular`; no duplicar el
  breakpoint.
- Reutilizar `CharacterSkin kind="ship"` y assets direccionales existentes.

Estructura orientativa:

```text
src/pages/automatizacion/AutomatizacionPage.tsx
src/components/automatizacion/{CampoCristales,EditorBloques,BarraMejoras}.tsx
src/data/automatizacion/{balance,bloques,mejoras}.ts
src/utils/automatizacion/{motor,programa,storage}.ts
public/assets/automatizacion/{cristales,interfaz}/
```

El motor y el AST deben vivir fuera de React; los nombres concretos pueden
adaptarse a patrones existentes.

## 3. Programa seguro

```ts
type ActionNode =
  | { id: string; type: "move_forward" }
  | { id: string; type: "turn_left" }
  | { id: string; type: "turn_right" }
  | { id: string; type: "harvest" };

type RepeatNode = {
  id: string;
  type: "repeat";
  times: number;
  body: ProgramNode[];
};

type ProgramNode = ActionNode | RepeatNode;
type Program = ProgramNode[];
```

- IDs estables para resaltar el bloque activo.
- JSON versionado y validado al cargar.
- Enteros, profundidad y cantidad de pasos acotados.
- Cada acción y contenedor cuenta para capacidad; también su contenido.
- El intérprete produce pasos y la UI los anima.
- Prohibido generar/evaluar JavaScript (`eval`, `Function`, scripts dinámicos).

## 4. Estado mínimo

```ts
type Direction = "north" | "east" | "south" | "west";
type ShipState = { row: number; col: number; direction: Direction };
type CrystalStage = 0 | 1 | 2 | 3;

type CellState = {
  stage: CrystalStage;
  variant: "spire" | "cluster" | "prism" | "star";
  nextGrowthAt: number;
};

type AutomationState = {
  schemaVersion: 1;
  ship: ShipState;
  cells: CellState[];
  balance: number;
  upgrades: Record<string, number>;
  revealed: string[];
  program: Program;
  bestRate: number;
  harvestEvents: number[];
  running: boolean;
};
```

`running` no se persiste. El snapshot cargado siempre inicia detenido en
`{ row: 1, col: 0, direction: "north" }`.

## 5. Relojes

No usar varios intervalos mutando React por separado. Separar:

- reloj de mundo: crecimiento por timestamps;
- ejecutor: una instrucción por vez;
- animador: representa una transición ya resuelta;
- persistencia: snapshot con debounce y tras eventos importantes.

Al ocultar la pestaña: detener corrida, congelar mundo y guardar. Al volver no
compensar tiempo oculto. Al desmontar limpiar listeners, intervalos y callbacks.

## 6. Contrato de ejecución

### Inicio

- No ejecutar programa vacío.
- Capturar copia inmutable y bloquear edición.
- Partir del origen mirando norte.
- Cambiar el botón a rojo inmediatamente.

### Paso

```ts
type StepEvent = {
  nodeId: string;
  kind: "move" | "turn" | "harvest" | "bump" | "empty_harvest";
  before: ShipState;
  after: ShipState;
  reward: number;
};
```

La UI no decide cosecha, saldo o colisión: solo anima el evento del motor.

### Fin o detención

- Cancelar con `AbortController` o token de corrida.
- Ignorar callbacks de corridas viejas.
- Limpiar bloque activo.
- Teletransportar y fijar nave en origen/norte.
- Mantener campo, saldo y crecimiento.
- Persistir snapshot estable.

Aunque no exista `Por siempre`, limitar profundidad, N, pasos expandidos y
duración. Alcanzar el límite termina como detención normal, sin modal técnico.

## 7. Editor

- Tap en paleta: insertar al final o dentro del destino activo.
- Tap en bloque colocado: quitar.
- Drag: reordenar, con alternativa de teclado.
- `Repetir`: cavidad y número; debe verse si el próximo bloque entra dentro.
- Un solo nivel de anidamiento expuesto en el MVP.
- Verificar capacidad antes de insertar.
- Durante ejecución no se edita.

No usar el aspecto por defecto de Blockly. Si se adopta como infraestructura,
personalizar renderer, toolbox y menús hasta que parezca TYPELY. Con este
vocabulario pequeño, un editor propio también es válido.

## 8. Balance centralizado

Ejemplo de forma, no valores finales:

```ts
export const AUTOMATION_BALANCE = {
  initialCapacity: 3,
  actionMs: 650,
  growthStageMs: 4_000,
  harvestValue: 1,
  maxExecutionSteps: 120,
  rateWindowMs: 60_000,
  repeatOptions: [2, 3, 4],
  upgrades: {
    capacity: { baseCost: 8, multiplier: 1.8 },
    movement: { baseCost: 16, multiplier: 2 },
    growth: { baseCost: 20, multiplier: 2.1 },
    repeat: { cost: 28 },
  },
} as const;
```

Objetivos del primer balance:

- primera interacción entendible en menos de un minuto;
- primera compra dentro de una sesión corta;
- `Repetir` aparece temprano y mejora visiblemente la producción;
- memoria adicional sirve, pero se encarece.

Revelado inicial sugerido: capacidad → movimiento → crecimiento → nuevos
bloques (`Repetir`) → estadísticas. Todos los umbrales viven en configuración.

## 9. Producción reciente

- Registrar timestamps solo de cosechas válidas.
- Podar eventos anteriores a la ventana configurada.
- Derivar y normalizar cristales/minuto.
- No contar saldo inicial, compras ni recompensas externas.
- Evitar que una única cosecha infle el récord sin muestra suficiente.

## 10. Persistencia

Los componentes no llaman directamente a `localStorage`:

```ts
interface AutomationRepository {
  load(userKey: string): PersistedAutomationState | null;
  save(userKey: string, state: PersistedAutomationState): void;
  reset(userKey: string): void;
}
```

- Clave versionada, por ejemplo `edutic_automation_v1`.
- Separar usuario y demo; demo nunca toca API.
- Validar/migrar o descartar snapshots inválidos.
- Nunca almacenar identidad, contraseña o token.
- Guardar después de compra, edición y final; debounce para crecimiento.
- Sync real entre dispositivos requiere endpoints/migración posteriores.

## 11. Estilos y responsive

- Prefijo propio `.auto-*`; no cambiar `glass-surface` global.
- Escena inmersiva, no dashboard.
- El borde gradiente de misión sigue reservado a los niveles.
- Sin scroll en estado inicial a 1366×768.
- Verificar 1366×768, 1440×900 y 375×812 (guarda de teléfono).
- Tablet horizontal solo si mantiene targets táctiles adecuados.
- Respetar `prefers-reduced-motion`.

## 12. Cortes de implementación

### A — motor

AST, validación, movimiento/giro/rebote/cosecha, crecimiento, ejecutor cancelable,
producción y repositorio local.

### B — juego integrado

Ruta/orbe, campo 2×2, nave, paleta, tres espacios, ejecutar/detener, saldo y tasa.

### C — economía que valida la idea

Capacidad, movimiento, crecimiento, revelado, compra/uso de `Repetir` y récord.

### D — terminación

Assets prioritarios, sonido, feedback, accesibilidad, responsive y QA. Cada corte
debe ser jugable; no esperar arte definitivo para validar el motor.

## 13. Criterios de aceptación

### Nave y campo

- [ ] Inicia abajo a la izquierda mirando arriba.
- [ ] Gira exactamente 90° y avanza según orientación.
- [ ] El borde rebota/no-op y el programa continúa.
- [ ] Solo cristal maduro recompensa y la veta vuelve a etapa 0.
- [ ] Las vetas crecen con el programa detenido.
- [ ] Detener/terminar devuelve nave y orientación sin alterar campo/saldo.

### Editor y ejecución

- [ ] Los cuatro bloques se reconocen por dibujo.
- [ ] Tap agrega/quita; touch y mouse pueden reordenar.
- [ ] Capacidad nunca se supera.
- [ ] Bloque activo se resalta; no se edita durante ejecución.
- [ ] `Repetir N` ejecuta su cuerpo exactamente N veces.
- [ ] Detener es inmediato y no deja callbacks ni timers huérfanos.

### Economía

- [ ] Saldo/tasa responden solo a cosecha válida.
- [ ] Comprar descuenta una vez, persiste y produce efecto visible.
- [ ] Categorías aparecen progresivamente.
- [ ] `Repetir` supera claramente una secuencia corta con igual capacidad.
- [ ] Recargar conserva estado pero no reanuda corrida vieja.

### Integración y calidad

- [ ] Tercer orbe entra al modo; Aventura y Órbita no cambian.
- [ ] Solo alumnos y demo acceden; teléfono no entra por URL directa.
- [ ] Demo no escribe en backend.
- [ ] `npm run build` pasa sin errores.
- [ ] Sin warnings nuevos relevantes ni recursos sin limpiar.
- [ ] Verificado responsive y sin tocar originales de imágenes.

## 14. Casos manuales imprescindibles

1. Programa vacío no inicia.
2. Avanzar desde origen sube a la celda superior izquierda.
3. Cuatro giros recuperan orientación.
4. Borde rebota y continúa con el bloque siguiente.
5. Cosecha madura suma y reinicia; inmadura no.
6. Detener durante animación impide callback tardío.
7. Salir durante ejecución limpia recursos y guarda estable.
8. Campo crece mientras se edita.
9. Ocultar pestaña no genera progreso.
10. Capacidad completa rechaza inserción y señala memoria.
11. `Repetir 3` con dos acciones produce seis eventos internos.
12. Recarga restaura programa/economía con nave en origen.
13. Demo realiza cero escrituras de backend.
14. URL directa en teléfono muestra la guarda correspondiente.

## 15. Preguntas para playtesting

Duración de acción/crecimiento, precios, momento de `Repetir`, ventana de tasa,
posición izquierda/derecha del campo, intensidad del onboarding y si tap para
quitar causa errores. Resolverlas ajustando configuración y componentes
acotados, nunca acoplándolas al motor.

