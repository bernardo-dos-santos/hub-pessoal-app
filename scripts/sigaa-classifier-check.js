// Check do classificador de arquivos do SIGAA (scripts/lib/sigaaLinkClassifier.js).
//
// Esta lógica morava dentro do page.evaluate() do sigaa-sync.js — para verificar
// um caso era preciso ligar o Puppeteer, logar no SIGAA e navegar até a página de
// materiais. Minutos por rodada, e vermelho toda vez que o IFSC mexia no HTML.
// Extraída para função pura, a mesma verificação roda offline em milissegundos.
//
// Rode com: node scripts/sigaa-classifier-check.js

import assert from "node:assert/strict";
import {
  classifySigaaFiles,
  classifyLink,
  classifyTableRow,
} from "./lib/sigaaLinkClassifier.js";

// ─── Mini-runner ──────────────────────────────────────────────────────────────
//
// Os outros checks do repo usam assert solto: o primeiro que falha derruba o
// processo e esconde os demais. Envolver cada caso num try/catch já resolve —
// é o serviço principal que um Vitest da vida presta, em doze linhas.

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push({ name, message: err.message });
  }
}

// ─── Abordagem 1: linhas da tabela "Arquivos" ─────────────────────────────────

test("linha de tabela: extensão vem do nome real do arquivo (coluna Descrição)", () => {
  const file = classifyTableRow({
    title: "Aula 01 - Introdução",
    desc: "aula01_introducao.pdf",
    topic: "Unidade 1",
    onclick: "download(1234567)",
  });
  assert.equal(file.isPdf, true);
  assert.equal(file.title, "Aula 01 - Introdução");
  assert.equal(file.description, "aula01_introducao.pdf");
  assert.equal(file.url, null, "download da tabela é via onclick JSF, não por URL");
});

test("linha de tabela: .pptx não é PDF", () => {
  const file = classifyTableRow({ title: "Slides da aula", desc: "slides.pptx" });
  assert.equal(file.isPdf, false);
});

test("linha de tabela: sem extensão nenhuma, assume PDF", () => {
  // O Content-Type confirma na hora do download; assumir PDF é o palpite certo
  // porque é o que o SIGAA serve na esmagadora maioria dos casos.
  const file = classifyTableRow({ title: "Material complementar", desc: "" });
  assert.equal(file.isPdf, true);
});

test("linha de tabela: extensão no título vale quando a descrição está vazia", () => {
  const file = classifyTableRow({ title: "trabalho_final.docx", desc: "" });
  assert.equal(file.isPdf, false);
});

test("linha de tabela: cabeçalho da tabela não é material", () => {
  for (const header of ["Título", "Descrição", "Tópico de Aula", "Ação"]) {
    assert.equal(classifyTableRow({ title: header }), null, `"${header}" virou material`);
  }
});

test("linha de tabela: título vazio ou de 1 caractere não é material", () => {
  assert.equal(classifyTableRow({ title: "" }), null);
  assert.equal(classifyTableRow({ title: "x" }), null);
});

test("linha de tabela: título longo demais é popup/div capturado, não material", () => {
  assert.equal(classifyTableRow({ title: "a".repeat(201) }), null);
  assert.notEqual(classifyTableRow({ title: "a".repeat(200) }), null, "200 ainda é válido");
});

test("linha de tabela: id sai do onclick, ou do idArquivo da URL como segunda opção", () => {
  const porOnclick = classifyTableRow({ title: "Aula", onclick: "abrir(9876543)" });
  assert.ok(porOnclick.id.startsWith("9876543-"));

  const porHref = classifyTableRow({
    title: "Aula",
    onclick: "",
    dlHref: "https://sigaa.ifsc.edu.br/sigaa/verArquivo?idArquivo=555",
  });
  assert.ok(porHref.id.startsWith("555-"));
});

test("linha de tabela: id numérico repetido não colide entre linhas diferentes", () => {
  // O SIGAA reaproveita o mesmo id em linhas distintas. Se o id final fosse só o
  // número, uma aula sobrescreveria a outra no material_content do backend.
  const a = classifyTableRow({ title: "Aula 01", desc: "a.pdf", onclick: "dl(1234567)" });
  const b = classifyTableRow({ title: "Aula 02", desc: "b.pdf", onclick: "dl(1234567)" });
  assert.notEqual(a.id, b.id);
});

test("linha de tabela: extensao nao-PDF real do SIGAA nao vira PDF", () => {
  // Casos tirados da saida do sync de 18/08, onde o backend respondeu
  // "Invalid PDF structure" para cada um destes por terem sido marcados isPdf.
  for (const desc of [
    "Musica - Consulta do Coracao.mp3",
    "Letra - Consulta do Coracao.txt",
    "Aula 01 - Mapa Mental.png",
    "Infografico - Arquitetura de Banco de Dados.png",
    "planilha.csv",
    "video-aula.mkv",
    "material.rar",
  ]) {
    const file = classifyTableRow({ title: "Material", desc });
    assert.equal(file.isPdf, false, `"${desc}" foi classificado como PDF`);
  }
});

test("titulo com sufixo que parece extensao mas nao e", () => {
  // A lista e explicita justamente para nao quebrar aqui: "complementar" termina
  // em "tar", "cap.10" tem ponto e numero. Nenhum dos dois e extensao.
  for (const title of ["Material complementar", "Lista de exercicios cap.10", "Revisao 2026.2"]) {
    const file = classifyTableRow({ title, desc: "" });
    assert.equal(file.isPdf, true, `"${title}" deixou de ser tratado como PDF`);
  }
});

// ─── Abordagem 2: links com texto ─────────────────────────────────────────────

test("link: arquivo .pdf com URL http real", () => {
  const file = classifyLink({
    text: "apostila.pdf",
    href: "https://sigaa.ifsc.edu.br/sigaa/verArquivo?idArquivo=42",
    rawHref: "/sigaa/verArquivo?idArquivo=42",
  });
  assert.equal(file.isPdf, true);
  assert.equal(file.url, "https://sigaa.ifsc.edu.br/sigaa/verArquivo?idArquivo=42");
  assert.ok(file.id.startsWith("42-"));
});

test("link: navegação da sidebar do AVA não é arquivo", () => {
  // Regressão real: usar href.includes('/ava/') como sinal de arquivo capturava
  // Principal, Plano de Ensino e o resto do menu como se fossem materiais.
  for (const text of ["Principal", "Plano de Ensino", "Turma Virtual"]) {
    const file = classifyLink({
      text,
      href: "https://sigaa.ifsc.edu.br/sigaa/ava/index.jsf",
      rawHref: "/sigaa/ava/index.jsf",
    });
    assert.equal(file, null, `"${text}" virou arquivo`);
  }
});

test("link: âncora e javascript: não viram arquivo por si só", () => {
  assert.equal(classifyLink({ text: "Voltar", href: "", rawHref: "#" }), null);
  assert.equal(classifyLink({ text: "Abrir", href: "", rawHref: "javascript:void(0)" }), null);
});

test("link: endpoint de download sem extensão no texto assume PDF", () => {
  const file = classifyLink({
    text: "Lista de exercícios 3",
    href: "https://sigaa.ifsc.edu.br/sigaa/verArquivo?idArquivo=77",
    rawHref: "/sigaa/verArquivo?idArquivo=77",
  });
  assert.equal(file.isPdf, true);
});

test("link: extensão explícita no texto vence o palpite do endpoint", () => {
  const file = classifyLink({
    text: "Gabarito.zip",
    href: "https://sigaa.ifsc.edu.br/sigaa/downloadArquivo?id=8",
    rawHref: "/sigaa/downloadArquivo?id=8",
  });
  assert.equal(file.isPdf, false, "endpoint sugeriu PDF, mas o nome diz .zip");
});

test("link: extensão no meio da URL conta (ex.: ?nome=slides.pdf)", () => {
  const file = classifyLink({
    text: "Slides da unidade 2",
    href: "https://sigaa.ifsc.edu.br/sigaa/download?nome=slides.pdf",
    rawHref: "/sigaa/download?nome=slides.pdf",
  });
  assert.notEqual(file, null);
  assert.equal(file.isPdf, true);
});

test("link: url fica nula quando o download é por JS, mesmo sendo arquivo", () => {
  const file = classifyLink({ text: "resumo.pdf", href: "", rawHref: "#" });
  assert.notEqual(file, null, "o texto termina em .pdf, então é arquivo");
  assert.equal(file.url, null, "sem URL navegável, o hub não tem o que baixar");
});

// ─── Pipeline completo ────────────────────────────────────────────────────────

test("pipeline: tabela vem antes dos links e o mesmo material não duplica", () => {
  const files = classifySigaaFiles({
    rows: [{ title: "Aula 01", desc: "aula01.pdf", onclick: "dl(1111111)" }],
    links: [
      { text: "Aula 01", href: "https://x/arquivo?id=1", rawHref: "/arquivo?id=1" },
      { text: "Aula 02.pdf", href: "https://x/arquivo?id=2", rawHref: "/arquivo?id=2" },
    ],
  });
  assert.equal(files.length, 2, "Aula 01 apareceu na tabela e nos links — deve entrar uma vez só");
  assert.equal(files[0].title, "Aula 01");
  assert.equal(files[1].title, "Aula 02.pdf");
});

test("pipeline: página sem material nenhum devolve lista vazia", () => {
  const files = classifySigaaFiles({
    rows: [],
    links: [{ text: "Principal", href: "https://sigaa.ifsc.edu.br/sigaa/ava/index.jsf", rawHref: "/sigaa/ava/index.jsf" }],
  });
  assert.deepEqual(files, []);
});

test("pipeline: entrada vazia ou ausente não quebra", () => {
  assert.deepEqual(classifySigaaFiles(), []);
  assert.deepEqual(classifySigaaFiles({}), []);
});

test("Abordagem 2 cobre tudo que o fallback removido cobria", () => {
  // Existia um terceiro passe que só rodava com a lista vazia e aceitava textos
  // terminados em .pdf/.doc/.ppt/.zip — subconjunto do que a Abordagem 2 já
  // aceita, logo inalcançável. Este caso trava a conclusão: se algum dia a
  // Abordagem 2 parar de pegar um desses, isto fica vermelho e avisa antes de
  // alguém "consertar" reintroduzindo o passe morto.
  for (const text of ["a.pdf", "a.doc", "a.ppt", "a.zip", "A.PDF"]) {
    const files = classifySigaaFiles({ links: [{ text, href: "", rawHref: "#" }] });
    assert.equal(files.length, 1, `"${text}" não foi classificado pela Abordagem 2`);
  }
});

// ─── Telas de navegação não são material ──────────────────────────────────────
//
// Causa do bug "verificar extensão dos materiais importados pelo SIGAA":
// isFileByEndpoint usava href.includes('arquivo'), substring solta em qualquer
// posição da URL, então tela de listagem entrava na lista — e como não tem
// extensão conhecida no texto, era assumida PDF.

test("tela de listagem do JSF não vira material", () => {
  for (const href of [
    "https://sigaa.ifsc.edu.br/sigaa/ava/listarArquivos.jsf",
    "https://sigaa.ifsc.edu.br/sigaa/ava/arquivos.jsf",
    "https://sigaa.ifsc.edu.br/sigaa/portais/discente/discente.jsf?aba=p-arquivos",
  ]) {
    const file = classifyLink({ text: "Arquivos da turma", href, rawHref: href.replace(/^https?:\/\/[^/]+/, "") });
    assert.equal(file, null, `${href} entrou como material`);
  }
});

test("download real continua sendo pego depois do aperto", () => {
  // A regra ficou mais estrita; estes são os formatos que NÃO podem ter sumido
  // junto, senão o sync passa a perder material de verdade em silêncio.
  const casos = [
    "https://sigaa.ifsc.edu.br/sigaa/verArquivo?idArquivo=42",
    "https://sigaa.ifsc.edu.br/sigaa/downloadArquivo?id=8",
    "https://sigaa.ifsc.edu.br/sigaa/downloadFile?key=abc",
    "https://sigaa.ifsc.edu.br/sigaa/arquivo/1234",
    "https://sigaa.ifsc.edu.br/sigaa/ava/index.jsf?idArquivo=99",
  ];
  for (const href of casos) {
    const file = classifyLink({ text: "Lista de exercícios 3", href, rawHref: href.replace(/^https?:\/\/[^/]+/, "") });
    assert.notEqual(file, null, `${href} deixou de ser reconhecido como download`);
    assert.equal(file.isPdf, true, `${href} devia assumir PDF sem outra extensão no texto`);
  }
});

// ─── Resultado ────────────────────────────────────────────────────────────────

if (failures.length > 0) {
  console.error(`\nSIGAA classifier check: ${failures.length} de ${passed + failures.length} falharam\n`);
  for (const { name, message } of failures) {
    console.error(`  x ${name}`);
    console.error(`    ${message.split("\n")[0]}\n`);
  }
  process.exit(1);
}

console.log(`SIGAA classifier check passed (${passed} casos).`);
