import { useState } from "react";
import "./Asistente.css";

function Asistente({
  sql,
  crt,
  ar,
  error,
  resultado,
  baseDatos
}) {

  const [abierto, setAbierto] = useState(false);
  const [pregunta, setPregunta] = useState("");
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(false);

  const asistenteDisponible =
    baseDatos?.toLowerCase() === "ciclismo";

  const enviarPregunta = async () => {
    if (!pregunta.trim() || cargando) {
      return;
    }

    if (!asistenteDisponible) {
      return;
    }

    const preguntaActual = pregunta.trim();

    setPregunta("");

    setMensajes((anteriores) => [
      ...anteriores,
      {
        tipo: "usuario",
        texto: preguntaActual
      }
    ]);

    setCargando(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/asistente",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            pregunta: preguntaActual,

            contexto: {
              sql: sql || "",
              crt: crt || "",
              ar: ar || "",
              error: error || "",
              resultado: resultado || null,
              baseDatos: baseDatos || ""
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "No se ha podido obtener una respuesta"
        );
      }

      setMensajes((anteriores) => [
        ...anteriores,
        {
          tipo: "asistente",
          texto: data.respuesta
        }
      ]);

    } catch (err) {

      setMensajes((anteriores) => [
        ...anteriores,
        {
          tipo: "error",
          texto:
            err.message ||
            "Se ha producido un error al consultar el asistente."
        }
      ]);

    } finally {
      setCargando(false);
    }
  };

  const manejarTecla = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      enviarPregunta();
    }
  };

  return (
    <>
      <button
        className="asistente-boton-flotante"
        onClick={() => setAbierto(!abierto)}
        title="Asistente de CLAPINO"
      >
        IA
      </button>

      {abierto && (
        <div className="asistente-panel">

          <div className="asistente-header">
            <div>
              <h2>Asistente CLAPINO</h2>

              <span
                className={
                  asistenteDisponible
                    ? "asistente-disponible"
                    : "asistente-no-disponible"
                }
              >
                {asistenteDisponible
                  ? "BD: Ciclismo"
                  : "No disponible"}
              </span>
            </div>

            <button
              className="asistente-cerrar"
              onClick={() => setAbierto(false)}
            >
              ×
            </button>
          </div>

          {!asistenteDisponible ? (

            <div className="asistente-aviso">
              <p>
                El asistente está disponible
                únicamente cuando estás conectado
                a la base de datos de ciclismo.
              </p>
            </div>

          ) : (

            <>
              <div className="asistente-contexto">
                Contexto actual de CLAPINO
              </div>

              <div className="asistente-mensajes">

                {mensajes.length === 0 && (
                  <div className="asistente-bienvenida">
                    <p>
                      Puedes preguntarme sobre la
                      consulta o traducción con la
                      que estás trabajando.
                    </p>
                  </div>
                )}

                {mensajes.map((mensaje, index) => (
                  <div
                    key={index}
                    className={
                      `asistente-mensaje ${mensaje.tipo}`
                    }
                  >
                    <strong>
                      {mensaje.tipo === "usuario"
                        ? "Tú"
                        : mensaje.tipo === "error"
                          ? "Error"
                          : "Asistente"}
                    </strong>

                    <p>{mensaje.texto}</p>
                  </div>
                ))}

                {cargando && (
                  <div className="asistente-mensaje asistente">
                    <strong>Asistente</strong>
                    <p>Pensando...</p>
                  </div>
                )}

              </div>

              <div className="asistente-entrada">

                <textarea
                  value={pregunta}
                  onChange={(e) =>
                    setPregunta(e.target.value)
                  }
                  onKeyDown={manejarTecla}
                  placeholder="Pregunta sobre tu consulta..."
                  disabled={cargando}
                />

                <button
                  onClick={enviarPregunta}
                  disabled={
                    cargando ||
                    !pregunta.trim()
                  }
                >
                  Enviar
                </button>

              </div>
            </>
          )}

        </div>
      )}
    </>
  );
}

export default Asistente;