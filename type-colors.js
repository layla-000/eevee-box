(() => {
  const TYPE_COLORS = Object.freeze({
    노말:"#9FA19F",
    비행:"#81B9EF",
    땅:"#915121",
    바위:"#AFA981",
    고스트:"#704170",
    불꽃:"#E62829",
    물:"#2980EF",
    풀:"#3FA129",
    전기:"#FAC000",
    에스퍼:"#EF4179",
    얼음:"#3DCEF3",
    페어리:"#EF70EF",
    독:"#9141CB",
    강철:"#60A1B8",
    드래곤:"#5060E1",
    격투:"#FF8000",
    벌레:"#91A119",
    악:"#624D4E"
  });

  const TYPE_NAMES = Object.keys(TYPE_COLORS);
  let moveTypeByName = new Map();
  let scheduled = false;

  function normalize(value){
    return String(value || "")
      .replace(/^테라\s*/u, "")
      .replace(/\s+/gu, " ")
      .trim();
  }

  function exactTypeFromText(value){
    const text = normalize(value);
    return TYPE_NAMES.find(type => text === type) || "";
  }

  function typeInText(value){
    const text = normalize(value);
    return TYPE_NAMES.find(type =>
      text === type ||
      text.startsWith(`${type} `) ||
      text.endsWith(` ${type}`) ||
      text.includes(`· ${type}`) ||
      text.includes(`${type} ·`)
    ) || "";
  }

  function setTypeColor(element, type, className = "type-colored"){
    if (!element || !TYPE_COLORS[type]) return;
    element.classList.add(className);
    element.dataset.type = type;
    element.style.setProperty("--type-color", TYPE_COLORS[type]);
  }

  function colorTypeLabels(root = document){
    const selectors = [
      ".badge",
      ".type-pill",
      ".tera-pill",
      ".move-meta span",
      ".move-reference-head span"
    ];

    root.querySelectorAll(selectors.join(",")).forEach(element => {
      const type = exactTypeFromText(element.textContent) || typeInText(element.textContent);
      if (type) setTypeColor(element, type);
    });
  }

  function findMoveName(element){
    const candidates = [
      element.dataset.move,
      element.querySelector("strong")?.textContent,
      element.querySelector(".move-name")?.textContent,
      element.textContent
    ];

    for (const candidate of candidates){
      const text = String(candidate || "").trim();
      if (moveTypeByName.has(text)) return text;

      for (const name of moveTypeByName.keys()){
        if (text === name || text.startsWith(`${name}\n`) || text.startsWith(`${name} `)){
          return name;
        }
      }
    }
    return "";
  }

  function colorMoveCards(root = document){
    const cardSelectors = [
      ".move-slot",
      ".move-row",
      ".my-move-effect-card",
      ".opponent-move-row",
      ".move-reference-detail"
    ];

    root.querySelectorAll(cardSelectors.join(",")).forEach(element => {
      const moveName = findMoveName(element);
      const type = moveTypeByName.get(moveName);
      if (!type) return;
      setTypeColor(element, type, "move-type-card");
    });

    root.querySelectorAll(".moves li, .preview-moves span").forEach(element => {
      const moveName = String(element.textContent || "").trim();
      const type = moveTypeByName.get(moveName);
      if (!type) return;
      setTypeColor(element, type, "move-type-name");
    });
  }

  function colorMoveSelect(select){
    const moveName = select.value;
    const type = moveTypeByName.get(moveName);
    select.classList.add("type-aware-select");
    select.style.setProperty(
      "--selected-type-color",
      type ? TYPE_COLORS[type] : "var(--line)"
    );
  }

  function bindMoveSelects(root = document){
    root.querySelectorAll(
      ".opp-move-select, #moveSelects select, select[data-move-select]"
    ).forEach(select => {
      if (!select.dataset.typeColorBound){
        select.dataset.typeColorBound = "true";
        select.addEventListener("change", () => {
          colorMoveSelect(select);
          schedulePaint();
        });
      }
      colorMoveSelect(select);
    });
  }


  // Battle Box enhancements: matchup shortcut, stable EV input, opponent Tera type.
  function injectBattleEnhancementStyles(){
    if (document.getElementById("battleEnhancementStyles")) return;
    const style = document.createElement("style");
    style.id = "battleEnhancementStyles";
    style.textContent = `
      .battle-title-row{flex-wrap:wrap}
      .battle-matchup-button{background:#fff!important;color:#526A78!important;border-color:rgba(255,255,255,.72)!important}
      .opponent-tera-row{display:grid;grid-template-columns:54px minmax(0,1fr);gap:10px;align-items:center}
      .opponent-tera-row .opponent-reference-label{align-self:center}
      .opp-tera-select{width:100%;min-width:0;border-left:6px solid var(--selected-type-color,var(--line))!important;font-weight:800}
      .opp-tera-select.has-tera{background:color-mix(in srgb,var(--selected-type-color) 12%,#fff)!important}
      @media(max-width:700px){.opponent-tera-row{grid-template-columns:48px minmax(0,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function ensureBattleMatchupButton(){
    const titleRow = document.querySelector(".battle-title-row");
    if (!titleRow || titleRow.querySelector(".battle-matchup-button")) return;
    const button = document.createElement("a");
    button.className = "battle-home-button battle-matchup-button";
    button.href = "./types.html";
    button.textContent = "상성표";
    titleRow.appendChild(button);
  }

  function applyTeraSelectColor(select){
    const type = normalize(select.value);
    select.classList.toggle("has-tera", Boolean(TYPE_COLORS[type]));
    select.style.setProperty("--selected-type-color", TYPE_COLORS[type] || "var(--line)");
  }

  function opponentRecordForSlot(slot){
    const slots = [...document.querySelectorAll("#opponentTeam .battle-slot")];
    const index = slots.indexOf(slot);
    if (index < 0 || typeof battle === "undefined") return null;
    return {record:battle.opponentTeam?.[index], index};
  }

  function ensureOpponentTeraSelects(){
    document.querySelectorAll("#opponentTeam .opponent-slot").forEach(slot => {
      const found = opponentRecordForSlot(slot);
      if (!found?.record) return;
      let row = slot.querySelector(".opponent-tera-row");
      if (!row){
        row = document.createElement("div");
        row.className = "opponent-reference-row opponent-tera-row";
        row.innerHTML = `<span class="opponent-reference-label">테라</span><select class="opp-tera-select type-aware-select" aria-label="상대 포켓몬 테라스탈 타입"><option value="">테라스탈 없음</option>${TYPE_NAMES.map(type => `<option value="${type}" style="color:${TYPE_COLORS[type]};font-weight:700">${type}</option>`).join("")}</select>`;
        const compactForm = slot.querySelector(".opponent-compact-form");
        const stats = slot.querySelector(".opponent-stats-panel");
        if (compactForm && stats) compactForm.insertBefore(row, stats);
        else compactForm?.appendChild(row);
      }
      const select = row.querySelector(".opp-tera-select");
      if (!select) return;
      const current = String(found.record.teraType || "");
      if (select.value !== current) select.value = current;
      if (!select.dataset.teraBound){
        select.dataset.teraBound = "true";
        select.addEventListener("change", () => {
          const latest = opponentRecordForSlot(slot);
          if (!latest?.record) return;
          latest.record.teraType = select.value;
          applyTeraSelectColor(select);
          if (typeof persistLocal === "function") persistLocal();
          if (typeof renderTeamAnalysis === "function") renderTeamAnalysis();
        });
      }
      applyTeraSelectColor(select);
    });
  }

  function updateOpponentStatUI(input, record){
    const panel = input.closest(".opponent-stats-panel");
    const rowWrap = input.closest(".opponent-stat-row-wrap");
    if (!panel || !rowWrap || !record?.stats) return;
    const key = rowWrap.dataset.stat;
    const stat = record.stats[key];
    if (!stat) return;
    const value = input.value === "" ? 0 : Math.max(0, Math.min(252, Math.floor(Number(input.value) || 0)));
    stat.ev = value;
    const final = typeof calculateBattleStat === "function"
      ? calculateBattleStat(key, stat.base, value, record.level)
      : 0;
    const finalEl = rowWrap.querySelector(".opp-final-stat");
    if (finalEl) finalEl.textContent = String(final);
    const bar = rowWrap.querySelector(".opponent-stat-bar > span");
    if (bar) bar.style.width = `${Math.min(100, Math.max(4, final / 3.2))}%`;
    const used = Object.values(record.stats).reduce((sum, item) => sum + (Number(item?.ev) || 0), 0);
    const remaining = 510 - used;
    const total = panel.querySelector(".opp-ev-total");
    if (total){
      total.textContent = `${used} / 510 EV · 남음 ${remaining}`;
      total.classList.toggle("over", remaining < 0);
    }
    const warning = panel.querySelector(".opp-ev-warning");
    if (warning) warning.hidden = remaining >= 0;
  }

  function bindStableEvInputs(){
    if (document.documentElement.dataset.stableEvBound) return;
    document.documentElement.dataset.stableEvBound = "true";
    document.addEventListener("input", event => {
      const input = event.target.closest?.(".opp-stat-ev");
      if (!input) return;
      event.stopImmediatePropagation();
      const slot = input.closest(".opponent-slot");
      const found = opponentRecordForSlot(slot);
      if (!found?.record) return;
      updateOpponentStatUI(input, found.record);
      if (typeof persistLocal === "function") persistLocal();
    }, true);
    document.addEventListener("blur", event => {
      const input = event.target.closest?.(".opp-stat-ev");
      if (!input) return;
      const slot = input.closest(".opponent-slot");
      const found = opponentRecordForSlot(slot);
      if (!found?.record) return;
      const value = Math.max(0, Math.min(252, Math.floor(Number(input.value) || 0)));
      input.value = String(value);
      updateOpponentStatUI(input, found.record);
      if (typeof persistLocal === "function") persistLocal();
    }, true);
  }

  function enhanceBattlePage(){
    if (!document.querySelector(".battle-main")) return;
    injectBattleEnhancementStyles();
    ensureBattleMatchupButton();
    ensureOpponentTeraSelects();
    bindStableEvInputs();
  }

  function paint(){
    scheduled = false;
    colorTypeLabels();
    colorMoveCards();
    bindMoveSelects();
    enhanceBattlePage();
  }

  function schedulePaint(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(paint);
  }

  async function loadMoves(){
    try {
      if (!window.EeveeBackend?.listMoves) {
        throw new Error("Supabase 기술 마스터 API가 아직 준비되지 않았어요.");
      }
      const moves = await window.EeveeBackend.listMoves();
      moveTypeByName = new Map(
        (moves || [])
          .filter(move => move?.name && TYPE_COLORS[move?.type])
          .map(move => [String(move.name).trim(), move.type])
      );
    } catch (error){
      console.warn("기술 타입 색상 데이터를 불러오지 못했어요.", error);
    }
    schedulePaint();
  }

  const observer = new MutationObserver(schedulePaint);

  function initialize(){
    observer.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true
    });
    schedulePaint();
    loadMoves();
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initialize, {once:true});
  } else {
    initialize();
  }

  window.EeveeBoxTypeColors = {
    colors: TYPE_COLORS,
    repaint: schedulePaint
  };
})();
