# Automatización — Lienzo Specification

## Purpose

Modo Automatización's block editor becomes a free 2D canvas: only the chain
hanging off a fixed green START block executes; every other stack (loose or a
`Mi rutina` definition) sits on the canvas without running. This spec defines
canvas connectivity, grab/cut/attach mechanics, whole-canvas capacity, the
three visual states, delete affordances, pan/zoom, and keyboard editing.

## Requirements

### Requirement: START-chain execution
Only the stack of nodes connected to the green START block SHALL execute.
Loose stacks and `def` (`Mi rutina`) stacks MUST NOT run on their own.

#### Scenario: Loose stack never runs
- GIVEN a loose stack containing a `Hacer A` node, not connected to START
- WHEN the program runs
- THEN that `Hacer A` node never executes

#### Scenario: Loose definition is still callable
- GIVEN a `Mi rutina A` definition sitting loose on the canvas
- AND a `Hacer A` node on the green START chain
- WHEN the program runs
- THEN the interpreter finds and runs rutina A's body

### Requirement: Grab carries the chain below
Grabbing a block MUST carry that block and every block chained below it in
its stack as one unit. Blocks above the grabbed node MUST remain in place.

#### Scenario: Grab mid-stack
- GIVEN a stack `[A, B, C, D]` on the canvas
- WHEN the player grabs block `C`
- THEN blocks `C` and `D` move together as the grabbed chain
- AND blocks `A` and `B` stay in their original stack, unmoved

### Requirement: Whole-canvas capacity
Capacity used SHALL count every block on the canvas: the green chain, every
`def` stack, and every loose stack. Capacity used is no longer equivalent to
"capacity that runs" (deliberate behaviour change from the pre-canvas model).

#### Scenario: Routine call is cheaper than three copies
- GIVEN `Mi rutina A` has a body costing 4 capacity units
- AND the green chain calls `Hacer A` three times
- WHEN capacity is computed
- THEN the cost is `1 + 4` (the definition, once) `+ 3` (three calls) = 8
- AND three inlined copies of the same 4-unit body would cost 12

#### Scenario: Capacity at maximum blocks further placement
- GIVEN the canvas (green chain + all `def`s + all loose stacks) is at maximum capacity
- WHEN the player looks at the palette or the memory indicator
- THEN palette blocks render grey and the memory dots render red
- AND no further block can be taken from the palette

### Requirement: Visual states are distinct and non-colliding
Loose stacks MUST render dimmed. `def` stacks MUST render at full colour,
distinguished by hat shape, never dimmed. Capacity-full grey MUST read as "no
room right now," visibly different from the app-wide locked grey used
elsewhere in the product (CLAUDE.md §6.4, §12). Persistent dim MUST remain
visually distinct from the existing transient mid-drag lift state.

#### Scenario: Loose stack renders dimmed, not grey
- GIVEN a loose stack not connected to START
- WHEN it renders on the canvas
- THEN it appears dimmed
- AND it does not use the grey styling reserved for capacity-full or locked content

#### Scenario: Definition always full colour
- GIVEN a `Mi rutina A` definition stack on the canvas
- WHEN it renders, connected or not
- THEN it appears at full colour with its hat shape
- AND it is never dimmed

### Requirement: Two delete affordances remove the whole grabbed chain
The canvas SHALL provide a bin control in the bottom-left corner (minimum
44px touch target, CLAUDE.md §6.5) that does not collide with the existing
top-left "Volver" control, and SHALL treat a drop onto the left-hand palette
area as delete. Both MUST delete the entire grabbed chain, not just the
grabbed node.

#### Scenario: Bin deletes the whole chain
- GIVEN a grabbed chain of 3 blocks
- WHEN the player drops it on the bin
- THEN all 3 blocks are removed from the canvas

#### Scenario: Palette-drop deletes the whole chain
- GIVEN a grabbed chain of 2 blocks
- WHEN the player drops it anywhere over the palette's bounding rect
- THEN both blocks are removed from the canvas

### Requirement: No destination while dragging places a new loose stack
Dropping a grabbed chain where it hits neither a valid stack destination,
the bin, nor the palette SHALL place it as a new loose stack at the drop
location. It MUST NOT delete the chain. (Previously the fallback of dropping
outside the notebook meant deletion; this is a deliberate inversion.)

#### Scenario: Drop on empty canvas creates a loose stack
- GIVEN a grabbed chain
- WHEN the player releases it over empty canvas space, not the bin, not the palette
- THEN a new loose stack appears at that location holding the grabbed chain
- AND no block is deleted

### Requirement: Depth check covers the tallest element of a chain
`cabeA` (fits-at) SHALL generalize from checking a single node to checking
whether the tallest element of a grabbed chain fits at the target depth.
`maxProfundidad = 2` continues to bound every container (`Repetir`, `Si`,
`Si/sino`, `Mientras`, `Por siempre`, `Mi rutina`).

#### Scenario: Tallest element of a chain is checked
- GIVEN a grabbed chain where one block is a `Repetir` containing a `Si` (height 2)
- WHEN the chain is offered a destination at nesting depth 1
- THEN the destination is rejected because `1 + 2 > 2`, even though other blocks in the chain would fit alone

### Requirement: Canvas pan and zoom viewport
The canvas SHALL provide its own pan+zoom viewport reusing the transform
pattern from `IslandDetailPage` (CLAUDE.md §6.1, §6.2): a dedicated
transform layer separate from any entrance-animated element, a HUD rendered
through a portal so it is never magnified, and `getBoundingClientRect()`
continuing to resolve correct coordinates. Touch on empty canvas SHALL pan;
touch on a block SHALL drag. The existing three-column layout MUST survive
and the field panel MUST NOT shrink.

#### Scenario: Touch disambiguates pan from drag
- GIVEN a touch Chromebook
- WHEN the player touches empty canvas space and drags
- THEN the canvas pans
- WHEN the player touches a block and drags
- THEN that block (and its chain) is grabbed and moved

### Requirement: Fixed START anchor with recenter
The green START block SHALL have a fixed anchor point on the canvas plus a
recenter affordance that returns the viewport to it.

#### Scenario: Recenter returns to START
- GIVEN the player has panned away from START
- WHEN the player activates the recenter affordance
- THEN the viewport returns to show the START block at its anchor

### Requirement: Keyboard reordering
Keyboard reordering (`desplazarNodo`) SHALL continue to move a block up or
down within its own stack. Cross-stack keyboard movement (moving a block
from one stack to another via keyboard) MUST be specified as a defined
behaviour of this capability, even though its delivery may land in a later
implementation slice.

#### Scenario: Keyboard move stays within a stack
- GIVEN a block in the middle of a stack
- WHEN the player uses the keyboard shortcut to move it up
- THEN it swaps position with its immediate predecessor in the same stack

#### Scenario: Keyboard move across stacks is a defined operation
- GIVEN a block at the top or bottom edge of its stack
- AND an adjacent stack exists within keyboard-navigable range
- WHEN the player issues the cross-stack move command
- THEN the block (and its chain below it) detaches from its current stack and attaches to the adjacent stack at the corresponding edge
