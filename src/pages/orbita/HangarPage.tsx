/* Probar es local; comprar y equipar siempre pasan por el servidor. */
import { ArrowLeft, Check, Sparkles, Rocket, Zap, Orbit, PawPrint } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gema } from "../../components/orbita/OrbitaIconos";
import { VistaPreviaTienda } from "../../components/orbita/VistaPreviaTienda";
import { MuestraEfecto } from "../../components/orbita/EfectosCosmeticos";
import { COSMETICOS, NOMBRE_RAREZA, SLOT_COSMETICO, type Cosmetico, type TipoCosmetico } from "../../data/orbitaCosmeticos";
import { navePorId } from "../../data/orbitaNaves";
import { mascotaPorId } from "../../data/orbitaMascotas";
import { useAuth } from "../../hooks/useAuth";
import { api, ApiError, type ArcadePerfil } from "../../utils/api";
import { actualizarPerfilLocal, hidratarPerfil, perfilLocal, sincronizaArcade } from "../../utils/orbita/arcade";
import { cristalesInfinitosDemo, tieneCristalesInfinitos } from "../../utils/orbita/desarrolloLocal";
import { isDemoMode } from "../../utils/storage";
import { FondoEspacio } from "./OrbitaHubPage";

const SECCIONES = [
  { id: "estela", nombre: "Estelas", Icono: Sparkles, descripcion: "Dejá tu huella entre las estrellas." },
  { id: "rayo", nombre: "Rayos", Icono: Zap, descripcion: "Un toque de energía en cada letra." },
  { id: "nave", nombre: "Naves", Icono: Rocket, descripcion: "Elegí tu compañera de vuelo." },
  { id: "impacto", nombre: "Impactos", Icono: Orbit, descripcion: "Celebrá cada palabra a tu manera." },
  { id: "mascota", nombre: "Mascotas", Icono: PawPrint, descripcion: "Compañeros de vuelo, solo por diversión. No dan ventajas." },
] as const;
type Articulo = Cosmetico & { serie?: boolean };
const SERIE: Record<TipoCosmetico, Articulo> = {
  estela: { id: "serie-estela", tipo: "estela", nombre: "Propulsión original", precio: 0, color: "#55dfff", serie: true, rareza: "comun", descripcion: "El brillo propio de los motores de tu nave." },
  rayo: { id: "serie-rayo", tipo: "rayo", nombre: "Rayo original", precio: 0, color: "#25c8df", serie: true, rareza: "comun", descripcion: "Un destello turquesa desde el cristal." },
  nave: { id: "serie-nave", tipo: "nave", nombre: "Nave de Órbita", precio: 0, color: "#54e8c6", serie: true, rareza: "comun", descripcion: "Tu nave original, siempre lista para despegar." },
  impacto: { id: "serie-impacto", tipo: "impacto", nombre: "Destello original", precio: 0, color: "#54e8c6", serie: true, rareza: "comun", descripcion: "Cuatro chispas para una palabra bien escrita." },
  mascota: { id: "serie-mascota", tipo: "mascota", nombre: "Sin mascota", precio: 0, color: "#54e8c6", serie: true, rareza: "comun", descripcion: "Volá por tu cuenta o elegí un compañero para acompañarte." },
};
const VACIO: ArcadePerfil["equipped"] = { trail: null, beam: null, ship: null, impact: null, pet: null };

function calidadArticulo(item: Articulo): string {
  return NOMBRE_RAREZA[item.rareza];
}

function MuestraArticulo({ item }: { item: Articulo }) {
  if (item.tipo === "nave") return <img className="orb-tienda-articulo__nave" src={navePorId(item.serie ? null : item.id).vistas.neutra.imagen} alt="" />;
  if (item.tipo === "mascota") {
    const mascota = mascotaPorId(item.id);
    return mascota ? <img className="orb-tienda-articulo__nave" src={mascota.imagen} alt="" />
      : <span className="orb-tienda-articulo__sin-mascota" aria-hidden="true"><PawPrint size={42} /></span>;
  }
  return <MuestraEfecto tipo={item.tipo} efecto={item.efecto ?? "color"} color={item.color} />;
}

export function HangarPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const sincroniza = sincronizaArcade(user?.role);
  const demoLocal = isDemoMode() && cristalesInfinitosDemo();
  const [perfil, setPerfil] = useState<ArcadePerfil | null>(null);
  const [equipo, setEquipo] = useState<ArcadePerfil["equipped"]>(VACIO);
  const [seccion, setSeccion] = useState<TipoCosmetico>("estela");
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  const [alias, setAlias] = useState("");
  const [editandoAlias, setEditandoAlias] = useState(false);
  useEffect(() => {
    let cancelado = false;
    setPerfil(null); setEquipo(VACIO); setMensaje("");
    void hidratarPerfil(user?.role).then(p => {
      if (!cancelado) { setPerfil(p); setEquipo({ ...VACIO, ...p?.equipped }); }
    });
    return () => { cancelado = true; };
  }, [user?.id, user?.role]);

  const slot = SLOT_COSMETICO[seccion];
  const articulos: Articulo[] = [SERIE[seccion], ...COSMETICOS.filter(c => c.tipo === seccion).sort((a, b) => a.precio - b.precio)];
  const elegido = articulos.find(a => a.id === equipo[slot]) ?? SERIE[seccion];
  const idElegido = elegido.serie ? null : elegido.id;
  const tiene = Boolean(elegido.serie || perfil?.owned.includes(elegido.id));
  const puesto = (perfil?.equipped[slot] ?? null) === idElegido;
  const infinitos = tieneCristalesInfinitos(perfil);
  const faltan = infinitos ? 0 : Math.max(0, elegido.precio - (perfil?.crystals ?? 0));
  const categoria = SECCIONES.find(s => s.id === seccion)!;

  async function accion() {
    if (bloqueo.current || (!sincroniza && !demoLocal)) return;
    bloqueo.current = true; setOcupado(true); setMensaje("");
    const item = elegido, destino = slot, id = idElegido;
    try {
      if (!tiene) {
        const res = demoLocal ? { balance: perfil?.crystals ?? 0 } : await api.buyArcadeItem(item.id);
        const owned = [...new Set([...(perfil?.owned ?? []), item.id])];
        actualizarPerfilLocal({ crystals: res.balance, owned });
        setPerfil(perfilLocal());
        setMensaje(`${item.nombre} ya está en tu colección. Ahora podés equiparlo.`);
      } else {
        if (!demoLocal) await api.equipArcadeItem(destino, id);
        const equipped = { ...VACIO, ...perfil?.equipped, [destino]: id };
        actualizarPerfilLocal({ equipped });
        setPerfil(p => p ? { ...p, equipped } : p);
        setMensaje(`${item.nombre}: equipado para tu próximo vuelo.`);
      }
    } catch (err) {
      setMensaje(err instanceof ApiError ? err.message : "No pudimos completar la operación. Volvé a intentar.");
      const p = await hidratarPerfil(user?.role);
      if (p) setPerfil(p);
    } finally { bloqueo.current = false; setOcupado(false); }
  }
  async function guardarAlias() {
    if (bloqueo.current || alias.trim().length < 3) return;
    bloqueo.current = true; setOcupado(true); setMensaje("");
    try {
      const res = await api.setArcadeAlias(alias.trim());
      actualizarPerfilLocal({ alias: res.alias });
      setPerfil(p => p ? { ...p, alias: res.alias } : p); setEditandoAlias(false);
    } catch (err) { setMensaje(err instanceof ApiError ? err.message : "No pudimos cambiar el alias."); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <main className="orb-tienda" aria-label="Tienda de Órbita">
    <FondoEspacio tinte="rgb(84, 130, 224)" fuerza={0.45} />
    <div className="orb-tienda__contenido">
      <header className="orb-tienda__cabecera">
        <button type="button" className="orb-boton-vidrio orb-boton--chico" onClick={() => navigate("/orbita")}><ArrowLeft size={18} /> Órbita</button>
        <div><span className="orb-tienda__kicker">TU PRÓXIMO VUELO, A TU ESTILO</span><h1>Tienda</h1></div>
        <span className="orb-pildora" aria-label={infinitos ? "Cristales infinitos" : `${perfil?.crystals ?? 0} cristales disponibles`}><Gema nombre="cristal" className="w-5 h-5" />{infinitos ? "∞" : (perfil?.crystals ?? 0).toLocaleString("es-AR")}</span>
      </header>
      <nav className="orb-tienda__secciones" aria-label="Secciones de la tienda">
        {SECCIONES.map(({ id, nombre, Icono }) => <button key={id} type="button" aria-pressed={seccion === id}
          onClick={() => { setSeccion(id); setMensaje(""); }}><Icono size={19} />{nombre}</button>)}
      </nav>
      <div className="orb-tienda__cuerpo">
        <section className="orb-tienda__probador orb-vidrio tarjeta-marca" aria-label="Probador">
          <div className="orb-tienda__probador-titulo"><span>Tu combinación</span><button type="button" onClick={() => setEquipo({ ...VACIO, ...perfil?.equipped })}>Ver mi equipo</button></div>
          <VistaPreviaTienda equipo={equipo} />
          <div className="orb-tienda__seleccion">
            <div className="orb-tienda__calidad"><span className="orb-tienda-articulo__nivel" data-rareza={elegido.rareza}>{calidadArticulo(elegido)}</span><span className="orb-tienda__kicker">{puesto ? "EQUIPADO" : "VISTA PREVIA"}</span></div>
            <h2>{elegido.nombre}</h2>
            <p>{elegido.descripcion ?? "Un nuevo color para acompañar tus vuelos."}</p>
            {!tiene && <strong className="orb-tienda__precio"><Gema nombre="cristal" className="w-5 h-5" />{elegido.precio.toLocaleString("es-AR")} cristales</strong>}
            {sincroniza || demoLocal ? <>
              <button type="button" className="orb-boton-primario" disabled={ocupado || (tiene ? puesto : faltan > 0)} onClick={() => void accion()}>
                {ocupado ? "Un momento…" : tiene ? puesto ? "Equipado" : "Equipar" : "Comprar"}
              </button>
              {!tiene && faltan > 0 && <small>Te faltan {faltan.toLocaleString("es-AR")} cristales. ¡Seguí volando!</small>}
            </> : <small>Podés probar todo. Para comprar, entrá con tu cuenta de alumno.</small>}
            <small>Solo cambia el aspecto. Tu habilidad sigue al mando.</small>
          </div>
        </section>
        <section className="orb-tienda__catalogo" aria-label={categoria.nombre}>
          <div className="orb-tienda__intro"><h2>{categoria.nombre}</h2><p>{categoria.descripcion}</p><small>Elegí un objeto para verlo en acción.</small></div>
          <div className="orb-tienda__articulos">
            {articulos.map(item => {
              const id = item.serie ? null : item.id;
              const comprado = item.serie || perfil?.owned.includes(item.id);
              const equipado = (perfil?.equipped[slot] ?? null) === id;
              return <button key={item.id} type="button" className="orb-tienda-articulo" data-rareza={item.rareza} aria-pressed={idElegido === id}
                aria-label={`Probar ${item.nombre}, ${calidadArticulo(item)}${equipado ? ", equipado" : comprado ? ", en tu colección" : `, ${item.precio} cristales`}`}
                onClick={() => { setEquipo(prev => ({ ...prev, [slot]: id })); setMensaje(""); }}>
                <span className="orb-tienda-articulo__nivel" data-rareza={item.rareza}>{calidadArticulo(item)}</span>
                <MuestraArticulo item={item} />
                <strong>{item.nombre}</strong>
                <span className="orb-tienda-articulo__estado">{equipado ? <><Check size={13} /> Equipado</> : comprado ? "En tu colección" : <><Gema nombre="cristal" className="w-4 h-4" />{item.precio.toLocaleString("es-AR")}</>}</span>
              </button>;
            })}
          </div>
        </section>
      </div>
      <p className="orb-tienda__mensaje" role="status" aria-live="polite">{mensaje}</p>
      {sincroniza && <details className="orb-tienda__piloto">
        <summary>Nombre de piloto · {perfil?.alias ?? "Elegir nombre"}</summary>
        {editandoAlias ? <form onSubmit={e => { e.preventDefault(); void guardarAlias(); }}>
          <label htmlFor="tienda-alias">Nombre de piloto</label><input id="tienda-alias" className="orb-campo" value={alias} onChange={e => setAlias(e.target.value)} minLength={3} maxLength={16} required />
          <button className="orb-boton-vidrio orb-boton--chico" disabled={ocupado}>Guardar</button>
        </form> : <button className="orb-boton-vidrio orb-boton--chico" onClick={() => { setAlias(perfil?.alias ?? ""); setEditandoAlias(true); }}>Cambiar nombre</button>}
      </details>}
    </div>
  </main>;
}
export default HangarPage;
