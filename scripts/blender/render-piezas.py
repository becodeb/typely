# =====================================================================
# RENDER DE PIEZAS DEL MODO AUTOMATIZACIÓN
# ---------------------------------------------------------------------
# Arma la escena de render — cámara ortográfica isométrica, luces y
# gestión de color — y saca las cuatro orientaciones de un objeto con la
# nave/el cristal girando y la CÁMARA QUIETA.
#
# Que la cámara no se mueva no es un detalle: es lo que hace que las
# cuatro vistas compartan luz y perspectiva exactas. Si en vez de girar
# el objeto uno mueve la cámara alrededor, las sombras cambian de lado y
# la pieza "salta" cuando el juego intercambia una vista por otra.
#
# La otra regla que impone este script es el PUNTO DE APOYO: el punto del
# suelo del objeto cae siempre en (ancho/2, alto*0.75) de la imagen. Esa
# coordenada significa "el centro de la baldosa", así que cualquier pieza
# renderizada con este script se puede intercambiar por otra sin tocar
# una sola posición en el código del juego.
#
# CÓMO USARLO
#   a) Desde Blender: abrí el .blend, pestaña Scripting, Open → este
#      archivo, y Run. Usa los AJUSTES de abajo tal como están.
#   b) Sin interfaz, y ahí se le pueden pasar argumentos:
#      blender -b modelo.blend -P scripts/blender/render-piezas.py -- \
#              --nombre nave --tamano 768 --rotaciones north,east,south,west
#
# Todo lo que va después de "--" es para el script; Blender ignora eso.
# =====================================================================

import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

# --------------------------------------------------------------------
# AJUSTES (los valores por defecto; los argumentos los pisan)
# --------------------------------------------------------------------
NOMBRE = "nave"           # "nave", "punta-maduro", "campo-2x2", …
SALIDA = os.path.join(os.path.expanduser("~"), "Downloads", "typely-render")

TAMANO = 768              # lienzo cuadrado. Cristales: 512.
ANCLA_Y = 0.75            # el punto de apoyo cae a esta altura del lienzo
MARGEN = 1.30             # aire alrededor del objeto (1.0 = justo)

ELEVACION = 30.0          # grados sobre el horizonte. Isométrica del juego.
AZIMUT = 45.0             # rotación de la cámara alrededor del objeto

# Nombre → giro en Z. La nave mira al norte a 0°.
ROTACIONES = {"north": 0, "east": 90, "south": 180, "west": 270}
GIRO_DE = {"north": 0, "east": 90, "south": 180, "west": 270, "": 0}

# Corrección para modelos que no vienen mirando al norte. El .blend sale
# del generador con el frente donde quiso, y no hay motivo para pedirle a
# nadie que rote el modelo a mano: se corrige acá y las cuatro vistas
# salen bien de una.
GIRO_BASE = 0.0


def leer_argumentos():
    """Lee lo que venga después de `--`. Sin argumentos no toca nada, así
    que correrlo desde la pestaña Scripting sigue funcionando igual."""
    global NOMBRE, SALIDA, TAMANO, ANCLA_Y, MARGEN, ELEVACION, AZIMUT, ROTACIONES, GIRO_BASE
    if "--" not in sys.argv:
        return
    args = sys.argv[sys.argv.index("--") + 1:]
    pares = dict(zip(args[::2], args[1::2]))
    NOMBRE = pares.get("--nombre", NOMBRE)
    SALIDA = pares.get("--salida", SALIDA)
    TAMANO = int(pares.get("--tamano", TAMANO))
    ANCLA_Y = float(pares.get("--ancla", ANCLA_Y))
    MARGEN = float(pares.get("--margen", MARGEN))
    ELEVACION = float(pares.get("--elevacion", ELEVACION))
    AZIMUT = float(pares.get("--azimut", AZIMUT))
    GIRO_BASE = float(pares.get("--giro-base", GIRO_BASE))
    if "--rotaciones" in pares:
        claves = [c.strip() for c in pares["--rotaciones"].split(",")]
        ROTACIONES = {c: GIRO_DE.get(c, 0) for c in claves}
    # --pasos N: N vistas repartidas en la vuelta entera, nombradas por su
    # ángulo (nave-r000, nave-r022, … nave-r337 con 16). Es lo que permite
    # que la nave GIRE en pantalla en vez de saltar de una vista a otra:
    # el juego tiene un ángulo continuo y elige la vista más cercana.
    # 0° sigue siendo el norte, 90° el este: los cuatro rumbos de siempre
    # son un caso particular (r000, r090, r180, r270).
    # El nombre trunca el ángulo (22.5 → r022): truncar da lo mismo en
    # Python y en JavaScript, redondear no (Python redondea .5 al par).
    if "--pasos" in pares:
        n = int(pares["--pasos"])
        ROTACIONES = {f"r{int(i * 360 / n):03d}": i * 360 / n for i in range(n)}


# --------------------------------------------------------------------
def mallas_visibles():
    return [ob for ob in bpy.context.scene.objects
            if ob.type == "MESH" and not ob.hide_render]


def caja(objs):
    """Bounding box mundial de todos los objetos, en coordenadas de mundo."""
    puntos = []
    for ob in objs:
        for esquina in ob.bound_box:
            puntos.append(ob.matrix_world @ Vector(esquina))
    if not puntos:
        raise RuntimeError("No hay ninguna malla visible en la escena.")
    minimo = Vector((min(p.x for p in puntos), min(p.y for p in puntos), min(p.z for p in puntos)))
    maximo = Vector((max(p.x for p in puntos), max(p.y for p in puntos), max(p.z for p in puntos)))
    return minimo, maximo


def limpiar(prefijo):
    for ob in [o for o in bpy.data.objects if o.name.startswith(prefijo)]:
        bpy.data.objects.remove(ob, do_unlink=True)


def sol(nombre, energia, color, rot):
    luz = bpy.data.lights.new(nombre, type="SUN")
    luz.energy = energia
    luz.color = color
    # Un sol con ángulo grande da sombras blandas, que es el look del juego.
    luz.angle = math.radians(25)
    ob = bpy.data.objects.new(nombre, luz)
    ob.rotation_euler = [math.radians(a) for a in rot]
    bpy.context.scene.collection.objects.link(ob)
    return ob


# --------------------------------------------------------------------
def main():
    leer_argumentos()
    escena = bpy.context.scene
    objs = mallas_visibles()
    minimo, maximo = caja(objs)

    centro = (minimo + maximo) / 2
    # El punto de apoyo: el centro de la base, sobre el que la pieza se
    # posa (o sobre el que flota, en el caso de la nave).
    apoyo = Vector((centro.x, centro.y, minimo.z))
    radio = max((Vector(p) - centro).length
                for p in [minimo, maximo,
                          Vector((minimo.x, maximo.y, minimo.z)),
                          Vector((maximo.x, minimo.y, maximo.z))])

    # ---------------- render ----------------
    escena.render.resolution_x = TAMANO
    escena.render.resolution_y = TAMANO
    escena.render.resolution_percentage = 100
    escena.render.film_transparent = True          # PNG con alfa real
    escena.render.image_settings.file_format = "PNG"
    escena.render.image_settings.color_mode = "RGBA"
    escena.render.image_settings.color_depth = "8"

    # Filmic/AgX lavan los pasteles y el resultado deja de pegar con el
    # resto del arte del juego. Standard es obligatorio para este estilo.
    escena.view_settings.view_transform = "Standard"
    escena.view_settings.look = "None"

    for motor in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            escena.render.engine = motor
            break
        except TypeError:
            continue

    # ---------------- luces ----------------
    limpiar("AUTO_luz")
    # Clave, cálida, desde arriba a la izquierda — la luz del arte existente.
    sol("AUTO_luz_clave", 3.2, (1.0, 0.96, 0.89), (55, 0, 35))
    # Relleno frío y suave desde la derecha: levanta las sombras sin aplanar.
    sol("AUTO_luz_relleno", 1.1, (0.82, 0.88, 1.0), (65, 0, -110))
    # Contra, desde atrás: despega la pieza del fondo transparente.
    sol("AUTO_luz_contra", 1.8, (0.95, 0.93, 1.0), (115, 0, 190))

    mundo = escena.world or bpy.data.worlds.new("AUTO_mundo")
    escena.world = mundo
    mundo.use_nodes = True
    fondo = mundo.node_tree.nodes.get("Background")
    if fondo:
        fondo.inputs[0].default_value = (0.78, 0.80, 0.88, 1.0)
        fondo.inputs[1].default_value = 0.55

    # ---------------- cámara ----------------
    limpiar("AUTO_camara")
    datos = bpy.data.cameras.new("AUTO_camara")
    datos.type = "ORTHO"
    datos.ortho_scale = radio * 2 * MARGEN
    cam = bpy.data.objects.new("AUTO_camara", datos)
    escena.collection.objects.link(cam)
    escena.camera = cam

    el = math.radians(ELEVACION)
    az = math.radians(AZIMUT)
    direccion = Vector((math.cos(el) * math.sin(az),
                        -math.cos(el) * math.cos(az),
                        math.sin(el)))
    # Ortográfica: la distancia no cambia el encuadre, solo evita recortes.
    giro_cam = direccion.to_track_quat("Z", "Y")
    cam.location = apoyo + direccion * (radio * 6)
    cam.rotation_euler = giro_cam.to_euler()

    # El apoyo tiene que caer a ANCLA_Y del lienzo, no al medio. Con una
    # cámara ortográfica eso es correr la cámara por su propio eje "arriba":
    # subirla un cuarto de cuadro deja el objeto un cuarto más abajo.
    #
    # El vector "arriba" sale del cuaternión y NO de `cam.matrix_world`:
    # acabamos de asignar la rotación y el grafo de dependencias todavía
    # no la propagó, así que `matrix_world` devolvería la identidad y el
    # desplazamiento saldría en la dirección equivocada. Costó un render
    # descubrirlo — por eso abajo el script verifica y lo dice.
    arriba = giro_cam @ Vector((0, 1, 0))
    cam.location += arriba * ((ANCLA_Y - 0.5) * datos.ortho_scale)

    bpy.context.view_layer.update()

    # Verificación: el script se controla a sí mismo y lo dice.
    from bpy_extras.object_utils import world_to_camera_view
    p = world_to_camera_view(escena, cam, apoyo)
    px, py = p.x * TAMANO, (1 - p.y) * TAMANO
    print(f"[automatizacion] punto de apoyo -> ({px:.1f}, {py:.1f}) "
          f"| esperado ({TAMANO/2:.1f}, {TAMANO*ANCLA_Y:.1f})")

    # ---------------- render de cada orientación ----------------
    os.makedirs(SALIDA, exist_ok=True)
    originales = {ob: ob.matrix_world.copy() for ob in objs}
    eje = Matrix.Translation(apoyo)
    eje_inv = Matrix.Translation(-apoyo)

    for sufijo, grados in ROTACIONES.items():
        giro = eje @ Matrix.Rotation(math.radians(grados + GIRO_BASE), 4, "Z") @ eje_inv
        for ob, m0 in originales.items():
            ob.matrix_world = giro @ m0
        bpy.context.view_layer.update()

        archivo = NOMBRE + (("-" + sufijo) if sufijo else "")
        escena.render.filepath = os.path.join(SALIDA, archivo + ".png")
        bpy.ops.render.render(write_still=True)
        print("[automatizacion] escrito:", escena.render.filepath)

    # Deja el modelo como estaba: el script no guarda el .blend, pero
    # tampoco lo deja girado por si después seguís trabajando.
    for ob, m0 in originales.items():
        ob.matrix_world = m0
    bpy.context.view_layer.update()
    print("[automatizacion] listo ->", SALIDA)


main()
