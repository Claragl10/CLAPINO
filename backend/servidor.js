const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const { createSqlAst } = require("./traductor/sqlAstParser");

const {
  sqlAstToRelationalTree
} = require("./traductor/relationalTreeBuilder");

const {
  crtToRelationalTree
} = require("./traductor/crtParser");

const { treeToAR } = require("./traductor/treeToAR");
const { treeToCRT } = require("./traductor/treeToCRT");

const app = express();

app.use(cors());
app.use(express.json());

function traducirErrorSQL(error) {
  const mensaje = error.message || "";

  if (mensaje.includes("You have an error in your SQL syntax")) {
    return "La consulta SQL contiene un error de sintaxis. Revisa la estructura de la consulta.";
  }

  if (mensaje.includes("Access denied")) {
    return "No se ha podido acceder a la base de datos. Revisa el usuario o la contraseña.";
  }

  if (mensaje.includes("Unknown database")) {
    return "La base de datos indicada no existe.";
  }

  if (mensaje.includes("ECONNREFUSED")) {
    return "No se ha podido conectar con el servidor MySQL. Revisa el host y el puerto.";
  }

  if (mensaje.includes("Unknown column")) {
    return "La consulta utiliza una columna que no existe en la base de datos.";
  }

  if (mensaje.includes("doesn't exist")) {
    return "La consulta utiliza una tabla que no existe en la base de datos.";
  }

  return "Se ha producido un error al ejecutar la consulta.";
}

function resolveDbConfig(dbConfig = {}) {
  let host = dbConfig.host;

  // Si estamos dentro de Docker y desde el frontend llega
  // localhost, usamos el nombre del servicio MySQL de Docker.
  if (
    process.env.DB_HOST &&
    (!host || host === "localhost" || host === "127.0.0.1")
  ) {
    host = process.env.DB_HOST;
  }

  return {
    host: host || process.env.DB_HOST || "localhost",
    port: Number(
      dbConfig.port ||
      process.env.DB_PORT ||
      3306
    ),
    user:
      dbConfig.user ||
      process.env.DB_USER ||
      "root",
    password:
      dbConfig.password ??
      process.env.DB_PASSWORD ??
      "",
    database:
      dbConfig.database ||
      process.env.DB_NAME ||
      "ciclismo"
  };
}

async function executeSQL(sql, dbConfig) {
  const config = resolveDbConfig(dbConfig);

  const connection = await mysql.createConnection(config);

  try {
    const [rows] = await connection.query(sql);

    return rows;
  } finally {
    await connection.end();
  }
}

app.get("/", (req, res) => {
  res.send("Backend de CLAPINO funcionando");
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "El frontend está conectado con el backend"
  });
});

app.post("/api/db/test", async (req, res) => {
  try {
    const config = resolveDbConfig(req.body);

    const connection = await mysql.createConnection(config);

    await connection.query("SELECT 1");

    await connection.end();

    res.json({
      ok: true,
      message: "Conexión correcta con MySQL"
    });
  } catch (error) {
    console.error(error);

    res.status(400).json({
      ok: false,
      error: traducirErrorSQL(error)
    });
  }
});

app.post("/execute-sql", async (req, res) => {
  try {
    const { sql, dbConfig } = req.body;

    if (!sql || !sql.trim()) {
      return res.status(400).json({
        error: "Debes escribir una consulta SQL"
      });
    }

    if (!dbConfig) {
      return res.status(400).json({
        error: "Primero debes conectar una base de datos"
      });
    }

    const cleanSql = sql.trim();
    
    if (!/^SELECT\b/i.test(cleanSql)) {
      return res.status(400).json({
        error: "Por seguridad, CLAPINO solo permite ejecutar consultas SELECT"
      });
    }

    const mysqlResult = await executeSQL(sql, dbConfig);

    res.json({
      database: dbConfig.database,
      sql,
      resultado: mysqlResult
    });
  } catch (error) {
    console.error(error);

    res.status(400).json({
      error: traducirErrorSQL(error)
    });
  }
});

app.post("/traducir-sql", (req, res) => {
  try {
    const { sql, outputType } = req.body;

    if (typeof sql !== "string" || !sql.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Debes enviar una consulta SQL"
      });
    }

    if (
      outputType !== "crt" &&
      outputType !== "ar"
    ) {
      return res.status(400).json({
        ok: false,
        error: "Debes indicar si quieres obtener CRT o AR"
      });
    }

    const sqlAst = createSqlAst(sql);

    console.dir(sqlAst.where, {
      depth: null
    });

    /*console.dir(sqlAst.from, {
      depth: null
    });*/

    const relationalTree =
      sqlAstToRelationalTree(sqlAst);

    if (outputType === "crt") {
      const crt = treeToCRT(relationalTree);

      return res.json({
        ok: true,
        sql: sql.trim(),
        crt
      });
    }

    const ar = treeToAR(relationalTree);

    return res.json({
      ok: true,
      sql: sql.trim(),
      ar
    });
  } catch (error) {
    console.error("Error al traducir SQL:", error);

    return res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

app.post("/traducir-crt", (req, res) => {
  try {
    const { crt } = req.body;

    if (
      typeof crt !== "string" ||
      !crt.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: "Debes enviar una consulta CRT"
      });
    }

    /*
     * Paso 1:
     * CRT → árbol relacional de CLAPINO.
     */
    const relationalTree =
      crtToRelationalTree(crt);

    /*
     * Paso 2:
     * Árbol relacional → AR.
     */
    const ar = treeToAR(relationalTree);

    return res.json({
      ok: true,
      crt: crt.trim(),
      relationalTree,
      ar
    });
  } catch (error) {
    console.error(
      "Error al traducir CRT:",
      error
    );

    return res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

app.listen(5000, () => {
  console.log("Servidor iniciado en http://localhost:5000");
});