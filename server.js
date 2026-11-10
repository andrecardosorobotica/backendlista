
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();

// ==========================================================
// 1. CONFIGURAÇÕES DO SERVIDOR
// ==========================================================

// Endereço e chave do projeto Supabase.
// Configure essas informações nas Environment Variables da Vercel.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

// Verifica se as variáveis foram configuradas.
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY na Vercel."
  );
}

// Conexão com o Supabase.
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


// ==========================================================
// 2. CONFIGURAÇÃO DO CORS
// ==========================================================

// Domínios autorizados a acessar o backend.
const allowedOrigins = [
  "https://frontendlista.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

// Inclui também o domínio configurado na Vercel.
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(
    process.env.FRONTEND_URL.replace(/\/$/, "")
  );
}

// Configuração do CORS.
const corsOptions = {
  origin: function (origin, callback) {

    // Permite ferramentas sem Origin, como alguns testes de API.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error("Origem não autorizada pelo CORS: " + origin)
    );
  },

  methods: [
    "GET",
    "POST",
    "PATCH",
    "DELETE",
    "OPTIONS"
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization"
  ],

  optionsSuccessStatus: 204
};

// O CORS precisa ser configurado antes das rotas.
app.use(cors(corsOptions));

// Trata as requisições de preflight OPTIONS.
app.options(/.*/, cors(corsOptions));


// ==========================================================
// 3. MIDDLEWARES
// ==========================================================

// Permite receber dados em formato JSON.
app.use(express.json());

// Evita que respostas da API sejam armazenadas em cache.
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
// 4. ROTA PRINCIPAL DE TESTE
// ==========================================================

app.get("/", (req, res) => {
  res.json({
    message: "API da lista de tarefas funcionando!",
    status: "online"
  });
});


// ==========================================================
// 5. ROTA DE SAÚDE DO BACKEND
// ==========================================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    message: "Backend conectado e funcionando."
  });
});


// ==========================================================
// 6. LISTAR TODAS AS TAREFAS
// ==========================================================

// Método: GET
// Endereço: /api/tasks

app.get("/api/tasks", async (req, res) => {

  try {

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar tarefas:", error);

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
// 7. CADASTRAR UMA NOVA TAREFA
// ==========================================================

// Método: POST
// Endereço: /api/tasks
// Corpo: { "title": "Minha tarefa" }

app.post("/api/tasks", async (req, res) => {

  try {

    const { title } = req.body;

    // Validação do título.
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

    // Insere a tarefa no Supabase.
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

    return res.status(201).json(data);

  } catch (error) {

    console.error("Erro inesperado:", error);

    return res.status(500).json({
      error: "Erro interno do servidor."
    });

  }

});


// ==========================================================
// 8. ATUALIZAR UMA TAREFA
// ==========================================================

// Método: PATCH
// Endereço: /api/tasks/:id
// Corpo: { "completed": true }

app.patch("/api/tasks/:id", async (req, res) => {

  try {

    const { id } = req.params;
    const { completed } = req.body;

    // Verifica se o campo completed é booleano.
    if (typeof completed !== "boolean") {
      return res.status(400).json({
        error: "Informe true ou false para completed."
      });
    }

    // Atualiza a tarefa no banco.
    const { data, error } = await supabase
      .from("tasks")
      .update({
        completed: completed,
        updated_at: new Date().toISOString()
      })
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

    return res.status(200).json(data);

  } catch (error) {

    console.error("Erro inesperado:", error);

    return res.status(500).json({
      error: "Erro interno do servidor."
    });

  }

});


// ==========================================================
// 9. EXCLUIR UMA TAREFA
// ==========================================================

// Método: DELETE
// Endereço: /api/tasks/:id

app.delete("/api/tasks/:id", async (req, res) => {

  try {

    const { id } = req.params;

    // Exclui a tarefa do Supabase.
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

    // Resposta 204 não possui corpo.
    return res.status(204).send();

  } catch (error) {

    console.error("Erro inesperado:", error);

    return res.status(500).json({
      error: "Erro interno do servidor."
    });

  }

});


// ==========================================================
// 10. TRATAMENTO DE ERROS
// ==========================================================

app.use((err, req, res, next) => {

  console.error("Erro no servidor:", err);

  if (err.message?.startsWith("Origem não autorizada pelo CORS")) {
    return res.status(403).json({
      error: "Acesso bloqueado pelo CORS."
    });
  }

  return res.status(500).json({
    error: "Erro interno do servidor."
  });

});


// ==========================================================
// 11. EXPORTAÇÃO PARA A VERCEL
// ==========================================================

// A Vercel utiliza esta exportação para executar o Express.
export default app;


// Permite executar localmente com: node server.js
if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Servidor executando na porta ${PORT}`);
  });
}
