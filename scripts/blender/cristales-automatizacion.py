# =====================================================================
# LOS CRISTALES DEL MODO AUTOMATIZACIÓN — modelado y render procedural
# ---------------------------------------------------------------------
# ⚠ SUPERADO. Los cristales que se ven en el juego ya NO salen de acá:
#   los dibuja la misma IA que dibujó las islas, en un pliego sobre
#   verde (Images/automatizacion/cristales/hoja-verde.png) que corta
#   scripts/importar-cristales-verde.mjs. Este render daba cilindros con
#   brillo que, al lado de la piedra pintada, se leían como velas de
#   plástico. Queda como respaldo procedural y como documentación del
#   contrato (lienzo, ancla, encuadre). Por eso escribe por defecto a
#   Images/automatizacion/render-blender/ y no a render/: correrlo sin
#   --salida no pisa las piezas ilustradas.
#
# Cuatro siluetas × tres etapas = doce PNG con alfa, todos con la misma
# cámara que la isla y con el PUNTO DE APOYO en el mismo lugar del
# lienzo, así el juego los intercambia sin mover una coordenada.
#
# La etapa 0 (semilla) no se renderiza: es el zócalo vacío, que ya viene
# en la isla.
#
# Dos reglas de diseño hechas geometría, no color (MVP.md §4):
#   - "listo" se lee por TAMAÑO: el maduro es 3,5 veces el brote.
#   - "listo" también se lee por LUZ: sólo el maduro emite. Un chico que
#     no distingue el turquesa del violeta igual ve cuál está listo.
#
#   blender -b -P scripts/blender/cristales-automatizacion.py -- --salida ./out
# =====================================================================

import math
import os
import sys

import bpy
from mathutils import Vector

SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                      "Images", "automatizacion", "render-blender")
TAMANO = 512
ANCLA_Y = 0.75
ELEVACION = 30.0
AZIMUT = 45.0

# Una baldosa mide 1.0 en el mundo de la isla. El cristal maduro llega a
# ~1.15 de alto, que es lo que se vio bien en las maquetas: más alto
# tapaba la baldosa de atrás.
ALTURA_MADURO = 0.98
ESCALA_ETAPA = {"brote": 0.30, "creciendo": 0.62, "maduro": 1.0}

# Cada variante tiene su color. En el MVP todas valen lo mismo: el color
# es identidad visual, no valor (MVP.md §4).
VARIANTES = {
    "punta":    (0.09, 0.62, 0.80),   # turquesa
    "racimo":   (0.42, 0.24, 0.90),   # violeta
    "prisma":   (0.95, 0.36, 0.66),   # rosa
    "estrella": (1.00, 0.68, 0.14),   # dorado
}


def leer_args():
    global SALIDA, TAMANO
    if "--" not in sys.argv:
        return
    a = sys.argv[sys.argv.index("--") + 1:]
    p = dict(zip(a[::2], a[1::2]))
    SALIDA = p.get("--salida", SALIDA)
    TAMANO = int(p.get("--tamano", TAMANO))


def material_cristal(color, emision):
    m = bpy.data.materials.new("cristal")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = 0.16
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.9
    b.inputs["Emission Color"].default_value = (*[min(1.0, c * 1.05) for c in color], 1.0)
    b.inputs["Emission Strength"].default_value = emision
    return m


def punta(nombre, alto, radio, mat):
    """Un prisma hexagonal rematado en pirámide: la forma de cristal que
    ya usa la isla 1 del modo Aventura."""
    cuerpo_alto = alto * 0.72
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=radio, depth=cuerpo_alto,
                                        location=(0, 0, cuerpo_alto / 2))
    cuerpo = bpy.context.object
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=radio, radius2=0, depth=alto * 0.28,
                                    location=(0, 0, cuerpo_alto + alto * 0.14))
    punta_ob = bpy.context.object
    for ob in (cuerpo, punta_ob):
        ob.data.materials.append(mat)
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
    bpy.ops.object.select_all(action="DESELECT")
    cuerpo.select_set(True)
    punta_ob.select_set(True)
    bpy.context.view_layer.objects.active = cuerpo
    bpy.ops.object.join()
    cuerpo.name = nombre
    return cuerpo


def construir(variante, mat):
    piezas = []
    if variante == "punta":
        piezas.append(punta("p", ALTURA_MADURO, 0.185, mat))

    elif variante == "racimo":
        for dx, dy, h, r in ((0, 0, 1.0, 0.15), (-0.17, 0.07, 0.64, 0.115), (0.16, -0.09, 0.5, 0.10)):
            ob = punta(f"r{h}", ALTURA_MADURO * h, r, mat)
            ob.location = (dx, dy, 0)
            ob.rotation_euler = (math.radians(dy * 40), math.radians(-dx * 40), 0)
            piezas.append(ob)

    elif variante == "prisma":
        # Bajo y ancho, tumbado: contrasta con la punta alta de un vistazo.
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.30, location=(0, 0, 0.30))
        ob = bpy.context.object
        ob.scale = (1.0, 0.85, ALTURA_MADURO * 0.72 / 0.6)
        bpy.ops.object.transform_apply(scale=True)
        ob.data.materials.append(mat)
        piezas.append(ob)

    elif variante == "estrella":
        # Púas radiales: la silueta más "mineral" de las cuatro.
        for i in range(5):
            ang = math.radians(i * 72)
            ob = punta(f"e{i}", ALTURA_MADURO * (0.58 if i else 0.95), 0.105, mat)
            ob.location = (math.cos(ang) * 0.11 * (i > 0), math.sin(ang) * 0.11 * (i > 0), 0)
            if i:
                ob.rotation_euler = (math.radians(math.sin(ang) * 34), math.radians(-math.cos(ang) * 34), 0)
            piezas.append(ob)

    bpy.ops.object.select_all(action="DESELECT")
    for ob in piezas:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = piezas[0]
    if len(piezas) > 1:
        bpy.ops.object.join()
    ob = bpy.context.object
    bpy.ops.object.shade_smooth()
    # Bisel finito: le da el filo de caramelo en vez de canto de plástico.
    b = ob.modifiers.new("bisel", "BEVEL")
    b.width = 0.008
    b.segments = 2
    return ob


def escena():
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

    def sol(nombre, energia, color, rot):
        luz = bpy.data.lights.new(nombre, type="SUN")
        luz.energy = energia
        luz.color = color
        luz.angle = math.radians(24)
        ob = bpy.data.objects.new(nombre, luz)
        ob.rotation_euler = [math.radians(a) for a in rot]
        e.collection.objects.link(ob)

    sol("clave", 1.9, (1.0, 0.96, 0.90), (52, 0, 38))
    sol("relleno", 1.0, (0.80, 0.87, 1.0), (66, 0, -108))
    sol("contra", 1.1, (0.94, 0.93, 1.0), (118, 0, 194))

    mundo = bpy.data.worlds.new("mundo")
    e.world = mundo
    mundo.use_nodes = True
    f = mundo.node_tree.nodes.get("Background")
    f.inputs[0].default_value = (0.74, 0.78, 0.92, 1.0)
    f.inputs[1].default_value = 0.30
    return e


def main():
    leer_args()
    os.makedirs(SALIDA, exist_ok=True)

    for variante, color in VARIANTES.items():
        for etapa, escala in ESCALA_ETAPA.items():
            bpy.ops.wm.read_factory_settings(use_empty=True)
            e = escena()
            # Sólo el maduro emite: "listo" se lee por luz además de por tamaño.
            mat = material_cristal(color, 0.42 if etapa == "maduro" else 0.10)
            ob = construir(variante, mat)
            ob.scale = (escala, escala, escala)
            bpy.ops.object.transform_apply(scale=True)
            bpy.context.view_layer.update()

            # El encuadre es SIEMPRE el del cristal maduro, no el de esta
            # etapa: si cada etapa se encuadrara sola, el brote saldría
            # gigante y el juego lo dibujaría del tamaño del maduro.
            radio = ALTURA_MADURO * 0.46
            datos = bpy.data.cameras.new("cam")
            datos.type = "ORTHO"
            datos.ortho_scale = radio * 2 * 1.25
            cam = bpy.data.objects.new("cam", datos)
            e.collection.objects.link(cam)
            e.camera = cam

            el, az = math.radians(ELEVACION), math.radians(AZIMUT)
            d = Vector((math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el)))
            giro = d.to_track_quat("Z", "Y")
            apoyo = Vector((0, 0, 0))
            cam.location = apoyo + d * 20
            cam.rotation_euler = giro.to_euler()
            cam.location += (giro @ Vector((0, 1, 0))) * ((ANCLA_Y - 0.5) * datos.ortho_scale)
            bpy.context.view_layer.update()

            nombre = f"{variante}-{etapa}"
            e.render.filepath = os.path.join(SALIDA, nombre + ".png")
            bpy.ops.render.render(write_still=True)
            print(f"[cristal] {nombre}")

    from bpy_extras.object_utils import world_to_camera_view
    escena_final = bpy.context.scene
    cam_final = escena_final.camera
    p = world_to_camera_view(escena_final, cam_final, Vector((0, 0, 0)))
    print(f"[cristal] apoyo -> ({p.x*TAMANO:.1f}, {(1-p.y)*TAMANO:.1f}) "
          f"| esperado ({TAMANO/2:.1f}, {TAMANO*ANCLA_Y:.1f})")

    import json
    meta = {
        "tamano": TAMANO,
        "anclaX": 0.5,
        "anclaY": ANCLA_Y,
        "pxPorUnidad": round(TAMANO / cam_final.data.ortho_scale, 4),
        "variantes": list(VARIANTES.keys()),
        "etapas": list(ESCALA_ETAPA.keys()),
    }
    with open(os.path.join(SALIDA, "cristales.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print("[cristal] cristales.json escrito")


main()
