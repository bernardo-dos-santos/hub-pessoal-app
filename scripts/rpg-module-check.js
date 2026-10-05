import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const formulaPath = path.join(projectRoot, "src", "modules", "rpg", "utils", "rpgFormula.ts");
const calculationsPath = path.join(projectRoot, "src", "modules", "rpg", "utils", "rpgCalculations.ts");
const combatModifiersPath = path.join(projectRoot, "src", "modules", "rpg", "utils", "rpgCombatModifiers.ts");
const servicePath = path.join(projectRoot, "src", "modules", "rpg", "services", "rpgCharacterService.ts");
const defaultDataPath = path.join(projectRoot, "src", "modules", "rpg", "data", "defaultRpgData.ts");
const moduleConfigPath = path.join(projectRoot, "src", "modules", "rpg", "module.config.ts");
const routesPath = path.join(projectRoot, "src", "modules", "rpg", "routes.ts");
const routesPagePath = path.join(projectRoot, "src", "modules", "rpg", "pages", "RpgRoutesPage.tsx");
const dashboardPagePath = path.join(projectRoot, "src", "modules", "rpg", "pages", "RpgDashboardPage.tsx");
const characterCardPath = path.join(projectRoot, "src", "modules", "rpg", "components", "RpgCharacterCard.tsx");
const characterComponentsDir = path.join(projectRoot, "src", "modules", "rpg", "components", "character");
const characterComponentPaths = [
  "RpgAbilityPreviewModal.tsx",
  "RpgCharacterHeader.tsx",
  "RpgCharacterTabs.tsx",
  "RpgDefenseFormulaEditor.tsx",
  "RpgEffectsList.tsx",
  "RpgMetricCard.tsx",
  "RpgNumberStepper.tsx",
  "RpgReviewCard.tsx",
  "RpgTrackerList.tsx",
  "rpgCharacterHelpers.ts",
].map((fileName) => path.join(characterComponentsDir, fileName));
const characterTabsDir = path.join(characterComponentsDir, "tabs");
const characterTabComponentPaths = [
  "RpgAbilitiesTab.tsx",
  "RpgAttributesTab.tsx",
  "RpgCombatModePanel.tsx",
  "RpgCombatTab.tsx",
  "RpgGeneralTab.tsx",
  "RpgInventoryTab.tsx",
  "RpgReviewTab.tsx",
  "RpgStoryTab.tsx",
].map((fileName) => path.join(characterTabsDir, fileName));
const characterCombatComponentsDir = path.join(characterComponentsDir, "combat");
const characterCombatComponentPaths = [
  "RpgDamageCalculator.tsx",
  "RpgFrioAmargoQuickToggles.tsx",
  "RpgQuickWeaponList.tsx",
  "RpgWeaponList.tsx",
].map((fileName) => path.join(characterCombatComponentsDir, fileName));
const pagePath = path.join(projectRoot, "src", "modules", "rpg", "pages", "RpgCharacterPage.tsx");
const appLayoutPath = path.join(projectRoot, "src", "app", "layout", "AppLayout.tsx");
const packageJsonPath = path.join(projectRoot, "package.json");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  evaluateFormula,
  rollFormula,
} = require(formulaPath);

const {
  applyAbilityPreview,
  calculateBernardoDefenseByLife,
  calculateDefense,
  createAbilityPreview,
  createRpgVariables,
  getReviewCount,
} = require(calculationsPath);

const {
  applyRpgDamageModifiers,
  getFrioAmargoActiveLevels,
  isFrioAmargoActiveTrackerBlocked,
} = require(combatModifiersPath);

const {
  defaultRpgCharacter,
  defaultRpgRulesProfile,
  rpgStorageKeys,
} = require(defaultDataPath);

const {
  rpgCharacterService,
} = require(servicePath);

const variables = createRpgVariables(defaultRpgCharacter);

assert.equal(defaultRpgCharacter.name, "Bernardo", "Personagem ativo deve ser Bernardo");
assert.equal(defaultRpgCharacter.masterName, "Heitor", "Heitor deve ser mestre, nao personagem");
assert.equal(defaultRpgCharacter.resources.find((resource) => resource.id === "vida").current, 255, "Vida inicial deve vir das capturas");
assert.equal(defaultRpgCharacter.resources.find((resource) => resource.id === "sanidade").max, 40, "Sanidade maxima deve vir das capturas");
assert.equal(defaultRpgCharacter.resources.find((resource) => resource.id === "fadiga").current, 19, "Fadiga atual deve vir das capturas");
assert.equal(defaultRpgCharacter.attributes.find((attribute) => attribute.key === "forca").value, 6, "Forca deve vir das capturas");
assert.equal(defaultRpgCharacter.skills.find((skill) => skill.id === "ocultismo").value, 100, "Ocultismo deve vir das capturas");
assert.equal(calculateDefense(defaultRpgCharacter), 89, "Defesa deve somar base e bonus temporario");
assert.equal(getReviewCount(defaultRpgCharacter), 0, "Importacao autenticada do Quest Portal nao deve manter revisoes falsas");
assert.equal(defaultRpgCharacter.skills.find((skill) => skill.id === "medicina").value, 8, "Medicina deve vir do Quest Portal");
assert.equal(defaultRpgCharacter.skills.find((skill) => skill.id === "pontaria").category, "Conhecimentos", "Pontaria deve ficar no grupo do Quest Portal");
assert.deepEqual(rpgStorageKeys, {
  activeCharacter: "rpg.activeCharacter",
  characters: "rpg.characters",
  rulesProfile: "rpg.rulesProfile",
}, "Chaves de storage devem ficar isoladas no modulo RPG");

assert.equal(evaluateFormula("forca + luta", variables).value, 21, "Formula deve resolver variaveis do personagem");
assert.equal(evaluateFormula("6d12 + 5d8 + 3d4 + 6", variables).value, 75, "Formula deve calcular media de dados");
assert.equal(evaluateFormula("(vida - 39) / 2", variables).value, 108, "Formula deve suportar parenteses e divisao");
assert.equal(evaluateFormula("(vida > 193) * 6", variables).value, 6, "Formula deve suportar comparacao verdadeira como 1");
assert.equal(evaluateFormula("(vida < 103) * 152", variables).value, 0, "Formula deve suportar comparacao falsa como 0");
assert.equal(evaluateFormula("vida / 0", variables).ok, false, "Formula deve rejeitar divisao por zero");
assert.equal(evaluateFormula("window.alert(1)", variables).ok, false, "Formula nao deve executar JavaScript livre");
const roll = rollFormula("1d4 + 1", variables);
assert.equal(roll.ok, true, "Rolagem simples deve funcionar");
assert.equal(roll.value >= 2 && roll.value <= 5, true, "Rolagem deve ficar dentro do intervalo");

const frioAmargo = defaultRpgCharacter.abilities.find((ability) => ability.id === "frio-amargo");
assert.equal(frioAmargo.trackers.length >= 3, true, "Frio Amargo deve ter contadores de uso por nivel");
assert.equal(variables.frioAmargoEmUso1, 0, "Frio Amargo nivel 1 deve iniciar desligado");
assert.equal(variables.frioAmargoEmUso2, 0, "Frio Amargo nivel 2 deve iniciar desligado");
assert.equal(variables.frioAmargoEmUso3, 0, "Frio Amargo nivel 3 deve iniciar desligado");
const frioActiveCharacter = {
  ...defaultRpgCharacter,
  abilities: defaultRpgCharacter.abilities.map((ability) => (
    ability.id === "frio-amargo"
      ? {
        ...ability,
        trackers: ability.trackers.map((tracker) => (tracker.id === "em-uso-2" ? { ...tracker, used: 1 } : tracker)),
      }
      : ability
  )),
};
const frioActiveVariables = createRpgVariables(frioActiveCharacter);
assert.equal(frioActiveVariables.frioAmargoEmUso2, 1, "Toggle Em uso 2 deve virar variavel booleana");
assert.equal(getFrioAmargoActiveLevels(frioActiveCharacter).find((item) => item.level === 2).active, true, "Nivel ativo deve aparecer no helper de combate");
const modifiedWeaponFormula = applyRpgDamageModifiers(defaultRpgCharacter.weapons[0].damageFormula, frioActiveCharacter);
assert.equal(modifiedWeaponFormula.includes("frioAmargoEmUso2"), true, "Formula de dano deve receber Frio Amargo automaticamente");
assert.equal(evaluateFormula(modifiedWeaponFormula, frioActiveVariables).value, 98, "Frio Amargo ativo deve somar dano medio na formula");
const rascunhoDoMedo = defaultRpgCharacter.abilities.find((ability) => ability.id === "rascunho-do-medo");
assert.equal(rascunhoDoMedo.costs.length, 0, "Rascunho do Medo nao deve descontar custo do Bernardo");
assert.equal(rascunhoDoMedo.description.includes("Custo do aliado: 2 de fadiga."), true, "Rascunho do Medo deve indicar que o custo e do aliado");
assert.equal(createAbilityPreview(defaultRpgCharacter, rascunhoDoMedo).resourceChanges.length, 0, "Preview do Rascunho do Medo nao deve alterar recursos do Bernardo");
const vanguardaPreview = createAbilityPreview(
  defaultRpgCharacter,
  defaultRpgCharacter.abilities.find((ability) => ability.id === "vanguarda-instintiva"),
);
assert.equal(vanguardaPreview.resourceChanges[0].resourceId, "fadiga", "Preview deve listar recurso consumido");
assert.equal(vanguardaPreview.resourceChanges[0].next, 14, "Preview deve descontar custo medio da fadiga");
assert.equal(vanguardaPreview.effects.length, 1, "Preview deve listar efeito ativo previsto");
const afterVanguarda = applyAbilityPreview(defaultRpgCharacter, vanguardaPreview);
assert.equal(afterVanguarda.resources.find((resource) => resource.id === "fadiga").current, 14, "Aplicar habilidade deve descontar recurso");
assert.equal(afterVanguarda.activeEffects.length, 1, "Aplicar habilidade deve criar efeito ativo");

const alvorecerPreview = createAbilityPreview(
  defaultRpgCharacter,
  defaultRpgCharacter.abilities.find((ability) => ability.id === "alvorecer-do-fim"),
);
const afterAlvorecer = applyAbilityPreview(defaultRpgCharacter, alvorecerPreview);
assert.equal(
  afterAlvorecer.abilities.find((ability) => ability.id === "alvorecer-do-fim").trackers[0].used,
  1,
  "Aplicar habilidade deve incrementar contador de uso",
);

const localCharacter = rpgCharacterService.resetLocalData();
const characterId = localCharacter.id;
assert.equal(localCharacter.name, "Bernardo", "Reset local deve restaurar Bernardo");
assert.equal(rpgCharacterService.list().length, 1, "Reset local deve deixar so um personagem na lista");
assert.equal(rpgCharacterService.get(characterId).name, "Bernardo", "get(characterId) deve encontrar o Bernardo");
assert.equal(rpgCharacterService.get("inexistente"), null, "get de personagem inexistente deve retornar null");
assert.equal(rpgCharacterService.get(characterId).rulesProfile.id, defaultRpgRulesProfile.id, "Personagem do Bernardo deve manter seu proprio perfil de regras apos reset");
assert.equal(
  evaluateFormula(defaultRpgRulesProfile.defenseFormula, variables).value,
  89,
  "Formula original de referencia deve calcular 89 com vida cheia",
);
assert.equal(calculateBernardoDefenseByLife(255), 89, "Defesa por faixas deve calcular 89 com vida cheia");
assert.equal(calculateBernardoDefenseByLife(220), 104, "Defesa por faixas deve arredondar matematicamente");
assert.equal(calculateBernardoDefenseByLife(193), 115, "Defesa por faixas deve fechar a segunda faixa em 115");
assert.equal(calculateBernardoDefenseByLife(103), 235, "Defesa por faixas deve fechar a terceira faixa em 235");
assert.equal(calculateBernardoDefenseByLife(255, 5), 94, "Defesa por faixas deve somar bonus temporario");
assert.equal(calculateDefense(defaultRpgCharacter, defaultRpgRulesProfile), 89, "calculateDefense deve usar a regra legivel do Bernardo");
assert.equal(
  calculateDefense(defaultRpgCharacter, { ...defaultRpgRulesProfile, defenseFormula: `${defaultRpgRulesProfile.defenseFormula} + 10` }),
  99,
  "calculateDefense deve respeitar formula editada",
);
const incomingDamage = 120;
const currentDefense = evaluateFormula(defaultRpgRulesProfile.defenseFormula, variables).value;
const damageCaused = Math.max(0, incomingDamage - currentDefense);
assert.equal(damageCaused, 31, "Calculo de dano deve subtrair a defesa atual");
assert.equal(
  defaultRpgCharacter.resources.find((resource) => resource.id === "vida").current - damageCaused,
  224,
  "HP final deve descontar apenas o dano que passou da defesa",
);
const updatedResource = rpgCharacterService.updateResource(characterId, "vida", 999);
assert.equal(updatedResource.resources.find((resource) => resource.id === "vida").current, 255, "Service deve limitar recurso ao maximo");
const updatedResourceMax = rpgCharacterService.updateResourceMax(characterId, "sanidade", 30);
assert.equal(updatedResourceMax.resources.find((resource) => resource.id === "sanidade").max, 30, "Service deve permitir editar maximo do recurso");
const clampedResourceMax = rpgCharacterService.updateResourceMax(characterId, "vida", 200);
assert.equal(clampedResourceMax.resources.find((resource) => resource.id === "vida").current, 200, "Reduzir maximo deve limitar valor atual");
const trackedCharacter = rpgCharacterService.updateAbilityTracker(characterId, "frio-amargo", "em-uso-3", 1);
assert.equal(
  trackedCharacter.abilities.find((ability) => ability.id === "frio-amargo").trackers.find((tracker) => tracker.id === "em-uso-3").used,
  1,
  "Service deve alternar toggle de uso atual do Frio Amargo",
);
assert.equal(
  trackedCharacter.abilities.find((ability) => ability.id === "frio-amargo").trackers.find((tracker) => tracker.id === "nivel-3").used,
  1,
  "Ligar Em uso do Frio Amargo deve consumir 1 uso do nivel correspondente",
);
const untrackedCharacter = rpgCharacterService.updateAbilityTracker(characterId, "frio-amargo", "em-uso-3", 0);
assert.equal(
  untrackedCharacter.abilities.find((ability) => ability.id === "frio-amargo").trackers.find((tracker) => tracker.id === "nivel-3").used,
  1,
  "Desligar Em uso do Frio Amargo nao deve devolver o uso consumido",
);
const activeAgainCharacter = rpgCharacterService.updateAbilityTracker(characterId, "frio-amargo", "em-uso-2", 1);
assert.equal(
  activeAgainCharacter.abilities.find((ability) => ability.id === "frio-amargo").trackers.find((tracker) => tracker.id === "nivel-2").used,
  1,
  "Ligar outro nivel do Frio Amargo deve consumir o uso correto",
);
const clearedFrioCharacter = rpgCharacterService.clearFrioAmargoActiveUses(characterId);
assert.equal(
  clearedFrioCharacter.abilities.find((ability) => ability.id === "frio-amargo").trackers.find((tracker) => tracker.id === "em-uso-2").used,
  0,
  "Sair do modo combate deve limpar Em uso do Frio Amargo",
);
assert.equal(
  clearedFrioCharacter.abilities.find((ability) => ability.id === "frio-amargo").trackers.find((tracker) => tracker.id === "nivel-2").used,
  1,
  "Limpar Em uso nao deve apagar usos consumidos",
);
const exclusiveFrioOne = rpgCharacterService.updateAbilityTracker(characterId, "frio-amargo", "em-uso-1", 1);
assert.equal(
  exclusiveFrioOne.abilities.find((ability) => ability.id === "frio-amargo").trackers.find((tracker) => tracker.id === "em-uso-1").used,
  1,
  "Deve permitir ativar um nivel do Frio Amargo",
);
const exclusiveFrioTwo = rpgCharacterService.updateAbilityTracker(characterId, "frio-amargo", "em-uso-2", 1);
assert.equal(
  exclusiveFrioTwo.abilities.find((ability) => ability.id === "frio-amargo").trackers.find((tracker) => tracker.id === "em-uso-1").used,
  0,
  "Ativar outro nivel deve desligar o Em uso anterior",
);
assert.equal(
  exclusiveFrioTwo.abilities.find((ability) => ability.id === "frio-amargo").trackers.find((tracker) => tracker.id === "em-uso-2").used,
  1,
  "Ativar outro nivel deve manter apenas o novo Em uso ligado",
);
const exclusiveCleared = rpgCharacterService.clearFrioAmargoActiveUses(characterId);
const maxedFrioCharacter = rpgCharacterService.saveCharacter({
  ...exclusiveCleared,
  abilities: exclusiveCleared.abilities.map((ability) => (
    ability.id === "frio-amargo"
      ? {
        ...ability,
        trackers: ability.trackers.map((tracker) => (
          tracker.id === "nivel-2"
            ? { ...tracker, used: tracker.max }
            : tracker.id === "em-uso-2"
              ? { ...tracker, used: 0 }
              : tracker
        )),
      }
      : ability
  )),
});
const maxedFrio = maxedFrioCharacter.abilities.find((ability) => ability.id === "frio-amargo");
assert.equal(getFrioAmargoActiveLevels(maxedFrioCharacter).find((item) => item.level === 2).exhausted, true, "Nivel cheio deve aparecer como esgotado no helper");
assert.equal(isFrioAmargoActiveTrackerBlocked(maxedFrio, "em-uso-2"), true, "Em uso deve bloquear quando nivel correspondente esta cheio");
const blockedFrioCharacter = rpgCharacterService.updateAbilityTracker(characterId, "frio-amargo", "em-uso-2", 1);
assert.equal(
  blockedFrioCharacter.abilities.find((ability) => ability.id === "frio-amargo").trackers.find((tracker) => tracker.id === "em-uso-2").used,
  0,
  "Nao deve habilitar Em uso quando o nivel correspondente esta cheio",
);
const appliedAbility = rpgCharacterService.applyAbility(characterId, "vanguarda-instintiva");
assert.equal(appliedAbility.resources.find((resource) => resource.id === "fadiga").current, 14, "Service deve aplicar habilidade com preview");

const createdAbilityCharacter = rpgCharacterService.createAbility(characterId, {
  category: "other",
  title: "Habilidade de teste",
  description: "Descricao de teste",
});
const createdAbility = createdAbilityCharacter.abilities.find((ability) => ability.title === "Habilidade de teste");
assert.equal(createdAbility.formulas.length, 0, "Habilidade criada deve nascer sem formulas");
const afterDeleteAbility = rpgCharacterService.deleteAbility(characterId, createdAbility.id);
assert.equal(afterDeleteAbility.abilities.some((ability) => ability.id === createdAbility.id), false, "Excluir habilidade deve remove-la da lista");

const createdItemCharacter = rpgCharacterService.addInventoryItem(characterId, { name: "Item de teste", quantity: 2 });
const createdItem = createdItemCharacter.inventory.find((item) => item.name === "Item de teste");
assert.equal(createdItem.quantity, 2, "Item criado deve manter a quantidade informada");
const afterUpdateItem = rpgCharacterService.updateInventoryItem(characterId, createdItem.id, { quantity: 5 });
assert.equal(afterUpdateItem.inventory.find((item) => item.id === createdItem.id).quantity, 5, "Atualizar item deve mudar a quantidade");
const afterDeleteItem = rpgCharacterService.deleteInventoryItem(characterId, createdItem.id);
assert.equal(afterDeleteItem.inventory.some((item) => item.id === createdItem.id), false, "Excluir item deve remove-lo do inventario");

const secondCharacter = rpgCharacterService.create({ name: "Personagem de teste" });
assert.equal(rpgCharacterService.list().length, 2, "Criar personagem deve adiciona-lo a lista");
assert.equal(secondCharacter.inventory.length, 0, "Personagem novo deve nascer sem inventario");
assert.equal(secondCharacter.abilities.length, 0, "Personagem novo deve nascer sem habilidades");
assert.equal(
  secondCharacter.attributes.length,
  defaultRpgCharacter.attributes.length,
  "Personagem novo deve ter a mesma estrutura de atributos do Bernardo",
);
assert.notEqual(
  secondCharacter.rulesProfile.id,
  defaultRpgRulesProfile.id,
  "Personagem novo NAO deve herdar a formula de defesa exclusiva do Bernardo",
);
assert.equal(
  secondCharacter.rulesProfile.defenseFormula,
  "defesaBase + bonusDefesaTemporario",
  "Personagem novo deve nascer com formula de defesa neutra",
);
assert.equal(
  calculateDefense(secondCharacter, secondCharacter.rulesProfile),
  0,
  "Personagem em branco deve ter defesa 0, nao o resultado da formula do Bernardo",
);
const removed = rpgCharacterService.remove(secondCharacter.id);
assert.equal(removed, true, "Remover personagem deve retornar true");
assert.equal(rpgCharacterService.list().length, 1, "Lista deve voltar a ter so o Bernardo apos remover o segundo personagem");

const moduleConfigSource = fs.readFileSync(moduleConfigPath, "utf8");
const routesSource = fs.readFileSync(routesPath, "utf8");
const routesPageSource = fs.readFileSync(routesPagePath, "utf8");
const dashboardPageSource = fs.readFileSync(dashboardPagePath, "utf8");
const characterCardSource = fs.readFileSync(characterCardPath, "utf8");
const pageSource = fs.readFileSync(pagePath, "utf8");
const appLayoutSource = fs.readFileSync(appLayoutPath, "utf8");
const packageJsonSource = fs.readFileSync(packageJsonPath, "utf8");
const characterComponentSources = Object.fromEntries(
  characterComponentPaths.map((componentPath) => {
    assert.equal(fs.existsSync(componentPath), true, `Componente auxiliar deve existir: ${path.basename(componentPath)}`);
    return [path.basename(componentPath), fs.readFileSync(componentPath, "utf8")];
  }),
);
const characterTabComponentSources = Object.fromEntries(
  characterTabComponentPaths.map((componentPath) => {
    assert.equal(fs.existsSync(componentPath), true, `Componente de aba deve existir: ${path.basename(componentPath)}`);
    return [path.basename(componentPath), fs.readFileSync(componentPath, "utf8")];
  }),
);
const characterCombatComponentSources = Object.fromEntries(
  characterCombatComponentPaths.map((componentPath) => {
    assert.equal(fs.existsSync(componentPath), true, `Componente de combate deve existir: ${path.basename(componentPath)}`);
    return [path.basename(componentPath), fs.readFileSync(componentPath, "utf8")];
  }),
);

assert.equal(moduleConfigSource.includes("status: 'active'"), true, "RPG deve estar ativo");
assert.equal(moduleConfigSource.includes("showInHome: true"), true, "RPG deve aparecer na Home");
assert.equal(moduleConfigSource.includes("supportsBackup: true"), true, "RPG deve declarar suporte a backup local");

assert.equal(routesSource.includes("path: 'rpg/*'"), true, "Rota RPG deve usar wildcard 'rpg/*'");
assert.equal(routesSource.includes("element: RpgRoutesPage"), true, "Rota RPG deve apontar para RpgRoutesPage");

assert.equal(routesPageSource.includes("<RpgDashboardPage />"), true, "RpgRoutesPage deve conter RpgDashboardPage");
assert.equal(routesPageSource.includes("<RpgCharacterPage />"), true, "RpgRoutesPage deve conter RpgCharacterPage");
assert.equal(routesPageSource.includes("path=\"personagem/:characterId\""), true, "RpgRoutesPage deve ter rota dinamica para o personagem");
assert.equal(routesPageSource.includes("path=\"campanhas\""), true, "RpgRoutesPage deve ter rota de campanhas");
assert.equal(routesPageSource.includes("path=\"campanhas/:campaignId\""), true, "RpgRoutesPage deve ter rota de detalhe de campanha");

assert.equal(appLayoutSource.includes("isRpgRoute"), false, "AppLayout nao deve conter logica isRpgRoute");
assert.equal(appLayoutSource.includes("pathname.startsWith('/rpg')"), false, "AppLayout nao deve conter check de rota /rpg");
assert.equal(appLayoutSource.includes("id=\"app-layout-root\""), true, "AppLayout deve ter id para o shell do modulo");

assert.equal(dashboardPageSource.includes("<RpgCharacterCard"), true, "RpgDashboardPage deve renderizar RpgCharacterCard");

assert.equal(characterCardSource.includes("to={`personagem/${character.id}`}"), true, "RpgCharacterCard deve linkar por characterId dinamico");

assert.equal(pageSource.includes("RpgCharacterHeader"), true, "Ficha deve usar header extraido");
assert.equal(pageSource.includes("RpgCharacterTabs"), true, "Ficha deve usar abas extraidas");
assert.equal(pageSource.includes("RpgAbilityPreviewModal"), true, "Ficha deve exigir preview extraido antes de aplicar habilidade");
assert.equal(pageSource.includes("RpgGeneralTab"), true, "Ficha deve usar aba Geral extraida");
assert.equal(pageSource.includes("RpgAttributesTab"), true, "Ficha deve usar aba Atributos extraida");
assert.equal(pageSource.includes("RpgCombatTab"), true, "Ficha deve usar aba Combate extraida");
assert.equal(pageSource.includes("RpgAbilitiesTab"), true, "Ficha deve usar aba Habilidades extraida");
assert.equal(pageSource.includes("RpgInventoryTab"), true, "Ficha deve usar aba Inventario extraida");
assert.equal(pageSource.includes("RpgStoryTab"), true, "Ficha deve usar aba Historia extraida");
assert.equal(pageSource.includes("RpgReviewTab"), true, "Ficha deve usar aba Revisao extraida");
assert.equal(characterTabComponentSources["RpgGeneralTab.tsx"].includes("RpgResourceCard"), true, "Aba Geral deve preservar barras e controles de recurso");
assert.equal(characterTabComponentSources["RpgGeneralTab.tsx"].includes("RpgMetricCard"), true, "Aba Geral deve usar card de metrica extraido");
assert.equal(characterTabComponentSources["RpgAttributesTab.tsx"].includes("RpgNumberStepper"), true, "Aba Atributos deve usar stepper extraido");
assert.equal(characterTabComponentSources["RpgAbilitiesTab.tsx"].includes("RpgTrackerList"), true, "Aba Habilidades deve usar tracker extraido");
assert.equal(characterTabComponentSources["RpgGeneralTab.tsx"].includes("RpgEffectsList"), true, "Aba Geral deve usar lista de efeitos extraida");
assert.equal(characterTabComponentSources["RpgGeneralTab.tsx"].includes("RpgDefenseFormulaEditor"), true, "Aba Geral deve usar editor de formula extraido");
assert.equal(characterTabComponentSources["RpgReviewTab.tsx"].includes("RpgReviewCard"), true, "Aba Revisao deve usar card de revisao extraido");
assert.equal(characterTabComponentSources["RpgGeneralTab.tsx"].includes("Modo Combate"), true, "Aba Geral deve ainda conter Modo Combate");
assert.equal(characterTabComponentSources["RpgCombatTab.tsx"].includes("RpgDamageCalculator"), true, "Aba Combate deve usar calculadora de dano extraida");
assert.equal(characterTabComponentSources["RpgCombatTab.tsx"].includes("RpgWeaponList"), true, "Aba Combate deve usar lista de armas extraida");
assert.equal(characterTabComponentSources["RpgCombatModePanel.tsx"].includes("RpgDamageCalculator"), true, "Painel de combate deve usar calculadora de dano extraida");
assert.equal(characterTabComponentSources["RpgCombatModePanel.tsx"].includes("RpgQuickWeaponList"), true, "Painel de combate deve usar lista rapida de armas extraida");
assert.equal(characterTabComponentSources["RpgCombatModePanel.tsx"].includes("RpgFrioAmargoQuickToggles"), true, "Painel de combate deve preservar atalhos do Frio Amargo");
assert.equal(characterCombatComponentSources["RpgDamageCalculator.tsx"].includes("dano recebido"), true, "Calculadora de dano deve preservar texto da formula");
assert.equal(characterCombatComponentSources["RpgFrioAmargoQuickToggles.tsx"].includes("Frio Amargo"), true, "Toggle rapido deve ainda conter Frio Amargo");
assert.equal(characterCombatComponentSources["RpgWeaponList.tsx"].includes("Media normal"), true, "Lista de armas deve preservar medias exibidas");
assert.equal(characterCombatComponentSources["RpgQuickWeaponList.tsx"].includes("Ataques principais"), true, "Lista rapida deve preservar ataques principais");
assert.equal(characterComponentSources["RpgEffectsList.tsx"].includes("rpgCharacterService"), false, "RpgEffectsList nao deve chamar service diretamente");
assert.equal(characterComponentSources["RpgEffectsList.tsx"].includes("onRemoveEffect"), true, "RpgEffectsList deve receber callback de remocao");
assert.equal(characterComponentSources["RpgDefenseFormulaEditor.tsx"].includes("evaluateFormula"), true, "RpgDefenseFormulaEditor pode avaliar formula");
assert.equal(characterComponentSources["RpgDefenseFormulaEditor.tsx"].includes("rpgCharacterService"), false, "RpgDefenseFormulaEditor nao deve salvar por service");
assert.equal(characterComponentSources["RpgTrackerList.tsx"].includes("isFrioAmargoActiveTrackerBlocked"), true, "RpgTrackerList deve preservar bloqueio do Frio Amargo");
for (const [fileName, source] of Object.entries(characterTabComponentSources)) {
  assert.equal(source.includes("rpgCharacterService"), false, `${fileName} nao deve chamar service diretamente`);
  assert.equal(source.includes("localStorage"), false, `${fileName} nao deve acessar localStorage diretamente`);
  assert.equal(source.includes("storageAdapter"), false, `${fileName} nao deve acessar storageAdapter diretamente`);
}
for (const [fileName, source] of Object.entries(characterCombatComponentSources)) {
  assert.equal(source.includes("rpgCharacterService"), false, `${fileName} nao deve chamar service diretamente`);
  assert.equal(source.includes("localStorage"), false, `${fileName} nao deve acessar localStorage diretamente`);
  assert.equal(source.includes("storageAdapter"), false, `${fileName} nao deve acessar storageAdapter diretamente`);
}

assert.equal(packageJsonSource.includes("\"test:rpg\""), true, "package.json deve expor test:rpg");

console.log("RPG module check passed.");
