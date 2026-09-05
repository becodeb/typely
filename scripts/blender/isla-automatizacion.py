# =====================================================================
# LA ISLA DEL MODO AUTOMATIZACIÓN — modelado y render procedural
# ---------------------------------------------------------------------
# Construye la plataforma flotante de N×N baldosas, la renderiza con la
# cámara isométrica del modo, y —esto es lo importante— EXPORTA UN JSON
# con el centro de cada baldosa en % de la imagen.
#
# Ese JSON es lo que evita el trabajo manual que hunde estos pipelines:
# nadie mide posiciones sobre un PNG con una regla, ni las vuelve a medir
# cuando el arte cambia. Blender sabe exactamente dónde está cada
# baldosa en 3D; que lo proyecte él y lo escriba es gratis, y no puede
# desviarse del render porque sale del mismo render.
#
# Cambiar N re-renderiza la isla y reescribe las coordenadas juntas. Por
# eso el campo puede crecer sin que nada se desalinee.
#
#   blender -b -P scripts/blender/isla-automatizacion.py -- \
#           --lado 2 --salida ./out --tamano 1400
# =====================================================================

import json
import math
import os
import random
import sys

import bpy
from mathutils import Vector

LADO = 2
SALIDA = os.path.join(os.path.expanduser("~"), "Downloads", "typely-render")
TAMANO = 1400
MARGEN = 1.18
ELEVACION = 30.0
AZIMUT = 45.0

# Geometría, en unidades de baldosa
ALTO_BALDOSA = 0.16
HUECO = 0.085           # separación entre baldosas: por ahí sale la veta de luz
ALTO_BASE = 0.55
RADIO_ZOCALO = 0.30

# Paleta — la misma del juego (CLAUDE.md §5), en lineal
PIEDRA = (0.70, 0.57, 0.93)
PIEDRA_LADO = (0.34, 0.25, 0.55)
ZOCALO = (0.84, 0.74, 0.98)
ZOCALO_INT = (0.66, 0.54, 0.87)
ROCA = (0.20, 0.14, 0.36)
VETA = (0.33, 0.91, 0.78)
MUSGO = (0.28, 0.60, 0.22)
MUSGO_CLARO = (0.44, 0.76, 0.30)
FLOR = (1.0, 0.96, 0.80)


def leer_args():
    global LADO, SALIDA, TAMANO, MARGEN
    if "--" not in sys.argv:
        return
    a = sys.argv[sys.argv.index("--") + 1:]
    p = dict(zip(a[::2], a[1::2]))
    LADO = int(p.get("--lado", LADO))
    SALIDA = p.get("--salida", SALIDA)
    TAMANO = int(p.get("--tamano", TAMANO))
    MARGEN = float(p.get("--margen", MARGEN))


def suavizar(ob):
    """Sombreado suave sólo donde el ángulo es chico, para que un cubo
    biselado tenga cantos blandos y caras planas. `use_auto_smooth`
    desapareció en Blender 4.1; el reemplazo es este operador."""
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(35))
    except (AttributeError, RuntimeError):
        bpy.ops.object.shade_smooth()


def material(nombre, color, emision=0.0, rugosidad=0.55):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rugosidad
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    if emision > 0:
        bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emision
    return m


def cubo(nombre, centro, escala, mat, bisel=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centro)
    ob = bpy.context.object
    ob.name = nombre
    ob.scale = escala
    bpy.ops.object.transform_apply(scale=True)
    if bisel:
        b = ob.modifiers.new("bisel", "BEVEL")
        b.width = bisel
        b.segments = 3
        b.limit_method = "ANGLE"
    suavizar(ob)
    ob.data.materials.append(mat)
    return ob


def cilindro(nombre, centro, radio, alto, mat, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(radius=radio, depth=alto, location=centro, vertices=vertices)
    ob = bpy.context.object
    ob.name = nombre
    b = ob.modifiers.new("bisel", "BEVEL")
    b.width = 0.012
    b.segments = 2
    suavizar(ob)
    ob.data.materials.append(mat)
    return ob


def esfera(nombre, centro, radio, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=radio, subdivisions=2, location=centro)
    ob = bpy.context.object
    ob.name = nombre
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(mat)
    return ob


def construir():
    """Devuelve (centros_3d, alto_top). Los centros son el punto de la
    superficie de cada baldosa donde se apoya el cristal."""
    mat_piedra = material("piedra", PIEDRA, rugosidad=0.62)
    mat_lado = material("piedra_lado", PIEDRA_LADO, rugosidad=0.70)
    mat_zocalo = material("zocalo", ZOCALO, rugosidad=0.50)
    mat_zocalo_int = material("zocalo_int", ZOCALO_INT, rugosidad=0.55)
    mat_roca = material("roca", ROCA, rugosidad=0.85)
    mat_veta = material("veta", VETA, emision=1.35)
    mat_musgo = material("musgo", MUSGO, rugosidad=0.85)
    mat_musgo2 = material("musgo2", MUSGO_CLARO, rugosidad=0.85)
    mat_flor = material("flor", FLOR, rugosidad=0.4)

    n = LADO
    mitad = n / 2.0

    # Base: el bloque de piedra sobre el que se apoyan las baldosas.
    cubo("base", (0, 0, -ALTO_BASE / 2 - 0.03), (n - 0.04, n - 0.04, ALTO_BASE), mat_lado, bisel=0.05)

    # La veta: barras emisivas EXACTAMENTE en las juntas entre baldosas.
    # Antes era una losa emisiva debajo de todo, y se desbordaba por el
    # perímetro entero: la isla quedaba con un halo blanco alrededor en
    # vez de una cruz de luz entre las baldosas.
    largo = n - 0.08
    for i in range(1, n):
        d = -n / 2.0 + i
        cubo(f"veta_v_{i}", (d, 0, ALTO_BALDOSA * 0.42),
             (HUECO * 0.85, largo, ALTO_BALDOSA * 0.55), mat_veta, bisel=0)
        cubo(f"veta_h_{i}", (0, d, ALTO_BALDOSA * 0.42),
             (largo, HUECO * 0.85, ALTO_BALDOSA * 0.55), mat_veta, bisel=0)

    # Roca de abajo: varios trozos girados, cada vez más chicos, para que
    # la isla termine en punta irregular y no en un cubo apilado.
    rr = random.Random(3)
    z = -ALTO_BASE - 0.28
    ancho = n * 0.86
    for k in range(4):
        ob = cubo(f"roca{k}", (rr.uniform(-0.12, 0.12) * n, rr.uniform(-0.12, 0.12) * n, z),
                  (ancho, ancho * rr.uniform(0.85, 1.0), 0.62), mat_roca, bisel=0.14)
        ob.rotation_euler = (math.radians(rr.uniform(-7, 7)),
                             math.radians(rr.uniform(-7, 7)),
                             math.radians(rr.uniform(-25, 25)))
        z -= 0.42
        ancho *= 0.66

    centros = []
    for fila in range(n):
        for col in range(n):
            # fila 0 arriba (norte) → y positivo
            x = -mitad + 0.5 + col
            y = mitad - 0.5 - fila
            lado_util = 1.0 - HUECO
            cubo(f"baldosa_{fila}_{col}", (x, y, ALTO_BALDOSA / 2),
                 (lado_util, lado_util, ALTO_BALDOSA), mat_piedra, bisel=0.035)
            z = ALTO_BALDOSA
            cilindro(f"zocalo_{fila}_{col}", (x, y, z + 0.025), RADIO_ZOCALO, 0.05, mat_zocalo)
            cilindro(f"zocalo_int_{fila}_{col}", (x, y, z + 0.052), RADIO_ZOCALO * 0.68, 0.02, mat_zocalo_int)
            centros.append((fila, col, Vector((x, y, z + 0.06))))

    # Musgo en el borde exterior: matas irregulares, no un collar parejo.
    rnd = random.Random(7)
    borde = []
    pasos = max(10, n * 9)
    for i in range(pasos):
        t = i / pasos
        for lado_i in range(4):
            if lado_i == 0:   p = Vector((-mitad + t * n, mitad, 0))
            elif lado_i == 1: p = Vector((mitad, mitad - t * n, 0))
            elif lado_i == 2: p = Vector((mitad - t * n, -mitad, 0))
            else:             p = Vector((-mitad, -mitad + t * n, 0))
            borde.append(p)
    for i, p in enumerate(borde):
        if rnd.random() > 0.55:
            continue
        for _ in range(rnd.randint(2, 4)):
            d = Vector((rnd.uniform(-0.09, 0.09), rnd.uniform(-0.09, 0.09), rnd.uniform(-0.04, 0.06)))
            esfera(f"musgo_{i}", p + d + Vector((0, 0, ALTO_BALDOSA * 0.75)),
                   rnd.uniform(0.042, 0.088), mat_musgo if rnd.random() < 0.6 else mat_musgo2)
        if rnd.random() < 0.22:
            esfera(f"flor_{i}", p + Vector((rnd.uniform(-0.06, 0.06), rnd.uniform(-0.06, 0.06), ALTO_BALDOSA * 0.9)),
                   0.03, mat_flor)
        # enredadera colgando por la cara lateral
        if rnd.random() < 0.16:
            largo = rnd.uniform(0.35, 0.95)
            pasos_v = int(largo / 0.09)
            for k in range(pasos_v):
                esfera(f"vid_{i}_{k}",
                       p + Vector((rnd.uniform(-0.03, 0.03), rnd.uniform(-0.03, 0.03), -0.09 * k)),
                       rnd.uniform(0.035, 0.06), mat_musgo2 if k % 2 else mat_musgo)

    return centros


def escena_render():
    e = bpy.context.scene
    e.render.resolution_x = TAMANO
    e.render.resolution_y = TAMANO
    e.render.film_transparent = True
    e.render.image_settings.file_format = "PNG"
    e.render.image_settings.color_mode = "RGBA"
    e.view_settings.view_transform = "Standard"
    e.view_settings.look = "None"
    for motor in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            e.render.engine = motor
            break
        except TypeError:
            continue
    if hasattr(e, "eevee"):
        for attr, val in (("use_bloom", True), ("bloom_intensity", 0.045), ("taa_render_samples", 96)):
            if hasattr(e.eevee, attr):
                setattr(e.eevee, attr, val)

    def sol(nombre, energia, color, rot):
        luz = bpy.data.lights.new(nombre, type="SUN")
        luz.energy = energia
        luz.color = color
        luz.angle = math.radians(28)
        ob = bpy.data.objects.new(nombre, luz)
        ob.rotation_euler = [math.radians(a) for a in rot]
        e.collection.objects.link(ob)

    # Luz cálida arriba-izquierda, relleno frío, contra: la luz del arte.
    sol("clave", 3.4, (1.0, 0.96, 0.90), (52, 0, 38))
    sol("relleno", 0.9, (0.80, 0.87, 1.0), (66, 0, -108))
    sol("contra", 1.1, (0.94, 0.93, 1.0), (118, 0, 194))

    mundo = bpy.data.worlds.new("mundo")
    e.world = mundo
    mundo.use_nodes = True
    fondo = mundo.node_tree.nodes.get("Background")
    fondo.inputs[0].default_value = (0.74, 0.78, 0.92, 1.0)
    fondo.inputs[1].default_value = 0.38
    return e


def main():
    leer_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    centros = construir()
    e = escena_render()

    n = LADO
    radio = math.sqrt(2) * (n / 2.0) + 0.35
    datos = bpy.data.cameras.new("camara")
    datos.type = "ORTHO"
    datos.ortho_scale = radio * 2 * MARGEN
    cam = bpy.data.objects.new("camara", datos)
    e.collection.objects.link(cam)
    e.camera = cam

    el, az = math.radians(ELEVACION), math.radians(AZIMUT)
    direccion = Vector((math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el)))
    giro = direccion.to_track_quat("Z", "Y")
    # Mira al centro de la cara superior; la isla entra entera y centrada.
    cam.location = Vector((0, 0, 0)) + direccion * (radio * 8)
    cam.rotation_euler = giro.to_euler()
    bpy.context.view_layer.update()

    os.makedirs(SALIDA, exist_ok=True)
    base = f"campo-{n}x{n}"
    e.render.filepath = os.path.join(SALIDA, base + ".png")
    bpy.ops.render.render(write_still=True)

    # --- las coordenadas, proyectadas desde el mismo render -----------
    from bpy_extras.object_utils import world_to_camera_view
    baldosas = []
    for fila, col, punto in centros:
        p = world_to_camera_view(e, cam, punto)
        baldosas.append({
            "fila": fila,
            "col": col,
            "x": round(p.x * 100, 3),          # % del ancho de la imagen
            "y": round((1 - p.y) * 100, 3),    # % del alto, desde arriba
        })

    # Cuánto mide una baldosa en la imagen: sirve para escalar cristales
    # y la nave sin que nadie tenga que adivinar un tamaño.
    p0 = world_to_camera_view(e, cam, Vector((-n / 2 + 0.5, n / 2 - 0.5, ALTO_BALDOSA)))
    p1 = world_to_camera_view(e, cam, Vector((-n / 2 + 1.5, n / 2 - 0.5, ALTO_BALDOSA)))
    paso = math.hypot((p1.x - p0.x) * 100, (p1.y - p0.y) * 100) if n > 1 else 100.0 / MARGEN

    meta = {
        "lado": n,
        "imagen": base + ".webp",
        "tamano": TAMANO,
        "elevacion": ELEVACION,
        "azimut": AZIMUT,
        "pasoBaldosa": round(paso, 3),
        # Píxeles por unidad de mundo. Es lo que permite apoyar sobre la
        # isla un cristal renderizado aparte, con su escala correcta y sin
        # que nadie tenga que ajustarla a ojo: los dos renders declaran
        # esta cifra y el juego divide una por la otra.
        "pxPorUnidad": round(TAMANO / datos.ortho_scale, 4),
        "baldosas": baldosas,
    }
    with open(os.path.join(SALIDA, base + ".json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"[isla] {base}.png + {base}.json  ({len(baldosas)} baldosas, paso {paso:.2f}%)")


main()
