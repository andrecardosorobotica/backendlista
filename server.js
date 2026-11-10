// ============================================================
// 1. IMPORTAÇÕES
// ============================================================

// Express cria o servidor HTTP e organiza as rotas da API.
import express from "express";

import cors from "cors";

// dotenv carrega as variáveis guardadas no arquivo .env.
import "dotenv/config";

// createClient é a função oficial para conectar ao Supabase.
import { createClient } from "@supabase/supabase-js";

// path e fileURLToPath ajudam a localizar a pasta public
// independentemente do diretório em que o comando foi executado.
import path from "node:path";
import { fileURLToPath } from "node:url";

// ============================================================
// 2. CONFIGURAÇÕES INICIAIS
// ============================================================

const app = express();
const PORT = process.env.PORT || 3000;

// Descobre o caminho absoluto da pasta onde este arquivo está.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Confere se as configurações essenciais foram preenchidas.
// É melhor interromper a inicialização do que iniciar um servidor
// que falhará em todas as operações com o banco.
const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error(
    "Configuração ausente: preencha SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no arquivo .env."
  );
  process.exit(1);
}

// ============================================================
// 3. CONEXÃO COM O SUPABASE
// ============================================================

// O cliente é criado uma única vez e reutilizado nas rotas.
// A chave publishable tem permissões limitadas pelo RLS do banco.
// Como este exemplo não implementa login, as políticas SQL permitem
// acesso público à lista. Não use este modelo com dados privados.
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

// Autoriza a comunicação com o frontend.
// Inicialmente aceita qualquer origem para facilitar
// o primeiro deploy. Depois configuraremos o domínio exato.
app.use(cors({
    origin: process.env.FRONTEND_URL || "*"
}));

// Permite receber dados em formato JSON.
app.use(express.json());

// ============================================================
// 4. MIDDLEWARES
// ============================================================

// Permite que o Express interprete corpos JSON enviados pelo frontend.
// O limite evita receber requisições JSON excessivamente grandes.
app.use(express.json({ limit: "20kb" }));

// Entrega arquivos estáticos da pasta public, como index.html.
app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// 5. ROTA DE TESTE
// ============================================================

// GET /api/health permite verificar se o servidor está no ar.
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "API de tarefas funcionando." });
});

// ============================================================
// 6. LISTAR TAREFAS
// ============================================================

// GET /api/tasks
// Busca todas as tarefas e coloca as mais recentes primeiro.
app.get("/api/tasks", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, completed, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// 7. CRIAR UMA TAREFA
// ============================================================

// POST /api/tasks
// Espera um JSON no formato: { "title": "Estudar JavaScript" }
app.post("/api/tasks", async (req, res, next) => {
  try {
    // Confere e normaliza o título antes de enviar ao banco.
    const title = typeof req.body.title === "string"
      ? req.body.title.trim()
      : "";

    // Validação simples para impedir tarefas vazias ou muito longas.
    if (!title || title.length > 200) {
      return res.status(400).json({
        error: "Informe uma tarefa com até 200 caracteres."
      });
    }

    // Insere a tarefa. O banco gera id e datas automaticamente.
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title })
      .select()
      .single();

    if (error) throw error;

    // 201 significa que um novo registro foi criado.
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// 8. ATUALIZAR UMA TAREFA
// ============================================================

// PATCH /api/tasks/:id
// Pode receber { "title": "Novo título" },
// { "completed": true } ou os dois campos.
app.patch("/api/tasks/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = {};

    // Só aceita os campos que a aplicação permite alterar.
    // Isso impede que o cliente tente modificar id ou created_at.
    if (Object.hasOwn(req.body, "title")) {
      if (typeof req.body.title !== "string") {
        return res.status(400).json({ error: "O título deve ser texto." });
      }

      const title = req.body.title.trim();

      if (!title || title.length > 200) {
        return res.status(400).json({
          error: "O título deve ter entre 1 e 200 caracteres."
        });
      }

      updates.title = title;
    }

    if (Object.hasOwn(req.body, "completed")) {
      if (typeof req.body.completed !== "boolean") {
        return res.status(400).json({
          error: "O campo completed deve ser true ou false."
        });
      }

      updates.completed = req.body.completed;
    }

    // Não permite uma atualização sem nenhum campo válido.
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "Envie title e/ou completed para atualizar."
      });
    }

    // Atualiza a data de modificação junto com os campos enviados.
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;

    // Se o ID não existir, o Supabase não retorna uma linha.
    if (!data) {
      return res.status(404).json({ error: "Tarefa não encontrada." });
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// 9. EXCLUIR UMA TAREFA
// ============================================================

// DELETE /api/tasks/:id
// Remove do banco a tarefa cujo identificador foi informado.
app.delete("/api/tasks/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: "Tarefa não encontrada." });
    }

    // 204 indica sucesso sem conteúdo de resposta.
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================================
// 10. TRATAMENTO CENTRALIZADO DE ERROS
// ============================================================

// Qualquer erro encaminhado por next(error) chega aqui.
// O detalhe técnico fica no terminal; a resposta ao navegador
// é mais simples e não expõe configurações do servidor.
app.use((error, req, res, next) => {
  console.error("Erro na API:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "Ocorreu um erro interno ao processar sua solicitação."
  });
});

// ============================================================
// 11. INICIALIZAÇÃO DO SERVIDOR
// ============================================================

// Exporta a aplicação para a Vercel.
// A plataforma será responsável por executar o servidor.
export default app;
