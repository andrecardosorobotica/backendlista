
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();

// ==========================================================
// 1. CONFIGURAÇÕES
// ==========================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY na Vercel."
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ==========================================================
// 2. CONFIGURAÇÃO DO CORS
// ==========================================================

const allowedOrigins = [
  "https://frontendlista.vercel.app",
  "https://frontedlista.vercel.app",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

// Adiciona domínio adicional configurado na Vercel.
if (process.env.FRONTEND_URL) {
  const frontendUrl = process.env.FRONTEND_URL
    .replace(/\/$/, "");

  if (!allowedOrigins.includes(frontendUrl)) {
    allowedOrigins.push(frontendUrl);
  }
}

const corsOptions = {
  origin: function (origin, callback) {

    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.error("Origem bloqueada pelo CORS:", origin);

    return callback(
      new Error("Origem não autorizada pelo CORS.")
    );
  },

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS"
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "apikey"
  ],

  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// ==========================================================
// 3. MIDDLEWARES
// ==========================================================

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );

  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  next();
});

// ==========================================================
// 4. ROTA PRINCIPAL
// ==========================================================

app.get("/", (req, res) => {

  return res.status(200).json({
    message: "API da Lista de Tarefas funcionando!",
    status: "online",

    endpoints: {
      health: "GET /api/health",
      listar: "GET /api/tasks",
      consultar: "GET /api/tasks/:id",
      cadastrar: "POST /api/tasks",
      atualizar: "PUT /api/tasks/:id",
      concluir: "PATCH /api/tasks/:id",
      excluir: "DELETE /api/tasks/:id"
    }
  });

});

// ==========================================================
// 5. ROTA DE SAÚDE
// ==========================================================

app.get("/api/health", (req, res) => {

  return res.status(200).json({
    status: "online",
    message: "Backend conectado e funcionando.",
    timestamp: new Date().toISOString()
  });

});

// ==========================================================
// 6. LISTAR TODAS AS TAREFAS
// GET /api/tasks
// ==========================================================

app.get("/api/tasks", async (req, res) => {

  try {

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao listar tarefas:", error);

      return res.status(500).json({
        error: "Não foi possível carregar as tarefas."
      });
    }

    return res.status(200).json(data);

  } catch (error) {

    console.error("Erro inesperado:", error);

    return res.status(500).json({
      error: "Erro interno do servidor."
    });

  }

});

// ==========================================================
// 7. CONSULTAR UMA TAREFA PELO ID
// GET /api/tasks/:id
// ==========================================================

app.get("/api/tasks/:id", async (req, res) => {

  try {

    const { id } = req.params;

    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({
        error: "ID da tarefa inválido."
      });
    }

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Erro ao consultar tarefa:", error);

      return res.status(500).json({
        error: "Não foi possível consultar a tarefa."
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Tarefa não encontrada."
      });
    }

    return res.status(200).json(data);

  } catch (error) {

    console.error("Erro inesperado:", error);

    return res.status(500).json({
      error: "Erro interno do servidor."
    });

  }

});

// ==========================================================
// 8. CADASTRAR NOVA TAREFA
// POST /api/tasks
// Corpo: { "title": "Minha tarefa" }
// ==========================================================

app.post("/api/tasks", async (req, res) => {

  try {

    const { title } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      return res.status(400).json({
        error: "Informe um título válido para a tarefa."
      });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({
        error: "O título deve ter no máximo 200 caracteres."
      });
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert([
        {
          title: title.trim(),
          completed: false
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Erro ao cadastrar tarefa:", error);

      return res.status(500).json({
        error: "Não foi possível cadastrar a tarefa."
      });
    }

    return res.status(201).json({
      message: "Tarefa cadastrada com sucesso!",
      task: data
    });

  } catch (error) {

    console.error("Erro inesperado:", error);

    return res.status(500).json({
      error: "Erro interno do servidor."
    });

  }

});

// ==========================================================
// 9. ATUALIZAR TAREFA COMPLETA
// PUT /api/tasks/:id
// Corpo: { "title": "Novo título", "completed": true }
// ==========================================================

app.put("/api/tasks/:id", async (req, res) => {

  try {

    const { id } = req.params;
    const { title, completed } = req.body;

    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({
        error: "ID da tarefa inválido."
      });
    }

    const updates = {};

    // Atualização do título.
    if (title !== undefined) {

      if (
        typeof title !== "string" ||
        !title.trim()
      ) {
        return res.status(400).json({
          error: "O título não pode ficar vazio."
        });
      }

      if (title.trim().length > 200) {
        return res.status(400).json({
          error: "O título deve ter no máximo 200 caracteres."
        });
      }

      updates.title = title.trim();

    }

    // Atualização do status.
    if (completed !== undefined) {

      if (typeof completed !== "boolean") {
        return res.status(400).json({
          error: "O campo completed deve ser booleano."
        });
      }

      updates.completed = completed;

    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "Informe pelo menos um campo para atualizar."
      });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Erro ao atualizar tarefa:", error);

      return res.status(500).json({
        error: "Não foi possível atualizar a tarefa."
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Tarefa não encontrada."
      });
    }

    return res.status(200).json({
      message: "Tarefa atualizada com sucesso!",
      task: data
    });

  } catch (error) {

    console.error("Erro inesperado:", error);

    return res.status(500).json({
      error: "Erro interno do servidor."
    });

  }

});

// ==========================================================
// 10. CONCLUIR OU REABRIR TAREFA
// PATCH /api/tasks/:id
// Corpo: { "completed": true }
// ==========================================================

app.patch("/api/tasks/:id", async (req, res) => {

  try {

    const { id } = req.params;
    const { completed } = req.body;

    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({
        error: "ID da tarefa inválido."
      });
    }

    if (typeof completed !== "boolean") {
      return res.status(400).json({
        error: "Informe true ou false para completed."
      });
    }

    const { data, error } = await supabase
      .from("tasks")
      .update({
        completed,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Erro ao alterar status:", error);

      return res.status(500).json({
        error: "Não foi possível alterar o status da tarefa."
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Tarefa não encontrada."
      });
    }

    return res.status(200).json({
      message: "Status atualizado com sucesso!",
      task: data
    });

  } catch (error) {

    console.error("Erro inesperado:", error);

    return res.status(500).json({
      error: "Erro interno do servidor."
    });

  }

});

// ==========================================================
// 11. EXCLUIR TAREFA
// DELETE /api/tasks/:id
// ==========================================================

app.delete("/api/tasks/:id", async (req, res) => {

  try {

    const { id } = req.params;

    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({
        error: "ID da tarefa inválido."
      });
    }

    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Erro ao excluir tarefa:", error);

      return res.status(500).json({
        error: "Não foi possível excluir a tarefa."
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Tarefa não encontrada."
      });
    }

    return res.status(204).send();

  } catch (error) {

    console.error("Erro inesperado:", error);

    return res.status(500).json({
      error: "Erro interno do servidor."
    });

  }

});

// ==========================================================
// 12. TRATAMENTO DE ROTAS NÃO ENCONTRADAS
// ==========================================================

app.use((req, res) => {

  return res.status(404).json({
    error: "Rota não encontrada.",
    path: req.originalUrl
  });

});

// ==========================================================
// 13. TRATAMENTO GLOBAL DE ERROS
// ==========================================================

app.use((err, req, res, next) => {

  console.error("Erro no servidor:", err);

  if (
    err.message?.startsWith(
      "Origem não autorizada pelo CORS"
    )
  ) {
    return res.status(403).json({
      error: "Acesso bloqueado pelo CORS."
    });
  }

  return res.status(500).json({
    error: "Erro interno do servidor."
  });

});

// ==========================================================
// 14. EXPORTAÇÃO E EXECUÇÃO
// ==========================================================

// Vercel utiliza a exportação do Express.
export default app;

// Execução local.
if (process.env.VERCEL !== "1") {

  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {

    console.log("----------------------------------");
    console.log("API DE LISTA DE TAREFAS ONLINE");
    console.log(`Servidor: http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
    console.log(`Tasks: http://localhost:${PORT}/api/tasks`);
    console.log("----------------------------------");

  });

}
