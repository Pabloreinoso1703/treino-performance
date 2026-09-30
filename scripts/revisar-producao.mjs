#!/usr/bin/env node
/**
 * Revisão somente-leitura do Firestore de produção (treino-performance-pablo).
 *
 * Criado na Sessão 3.28, a pedido do Pablo: ele quer que eu (Claude) consiga
 * ler a aba "Análise > registros anteriores" (e o histórico de treino_sessions)
 * diretamente do banco de produção, sem precisar que ele mande print/pedido
 * manual toda vez.
 *
 * Usa firebase-admin com uma Service Account dedicada, criada no Google Cloud
 * Console com o papel "Cloud Datastore Viewer" (roles/datastore.viewer) —
 * essa role é SOMENTE LEITURA. Este script nunca escreve nada no Firestore
 * (nenhuma chamada .set/.update/.delete existe aqui de propósito — reforça a
 * Regra 5 do CLAUDE.md: toda escrita continua passando pelo app, nunca por
 * aqui).
 *
 * Uso:
 *   node revisar-producao.mjs <caminho-da-chave.json> [dias=7]
 *
 * Saída: um resumo em texto (stdout) com as sessões de treino e os registros
 * do Apple Watch dos últimos N dias — pensado pra eu ler e comparar com o
 * plano (PLANO/objetivos no index.html e no CLAUDE.md/MEMORY.md), não pra
 * decidir nada sozinho sem contexto.
 */

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const keyPath = process.argv[2];
const dias = parseInt(process.argv[3] || "7", 10);

if (!keyPath) {
  console.error("Uso: node revisar-producao.mjs <caminho-da-chave.json> [dias=7]");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

function isoDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const desde = isoDaysAgo(dias);

async function main() {
  console.log(`=== Revisão de produção — últimos ${dias} dias (desde ${desde}) ===\n`);

  const sessionsSnap = await db
    .collection("treino_sessions")
    .where("data", ">=", desde)
    .orderBy("data", "desc")
    .get();

  console.log(`--- treino_sessions (${sessionsSnap.size} registro(s)) ---`);
  sessionsSnap.forEach((doc) => {
    const s = doc.data();
    console.log(
      `${s.data} · ${s.tipoTreino || "?"} · ${
        Array.isArray(s.exercicios) ? s.exercicios.length : "?"
      } exercício(s)`
    );
  });

  const watchSnap = await db
    .collection("treino_watch")
    .where("data", ">=", desde)
    .orderBy("data", "desc")
    .get();

  console.log(`\n--- treino_watch (${watchSnap.size} registro(s)) ---`);
  watchSnap.forEach((doc) => {
    const w = doc.data();
    console.log(
      `${w.data} · ${w.tipoAtividade || "?"} · dur ${w.duracao || "?"}min · FC méd ${
        w.fcMedia || "—"
      } · RPE ${w.rpe || "—"}${w.semWatch ? " (sem Watch)" : ""}`
    );
  });

  console.log("\n(fim — nenhuma escrita foi feita, este script é somente leitura)");
}

main().catch((err) => {
  console.error("Erro ao ler o Firestore:", err.message);
  process.exit(1);
});
