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
  let moveRecordByName = new Map();
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

  function priorityNumber(move){
    const raw = move?.priority;
    if (raw === '' || raw == null || raw === '-') return 0;
    const value = Number(String(raw).replace('+','').trim());
    return Number.isFinite(value) ? value : 0;
  }

  function priorityText(move){
    const value = priorityNumber(move);
    return value ? `우선도 ${value > 0 ? '+' : ''}${value}` : '';
  }

  function priorityMoveNameForElement(element){
    const row = element.closest?.('.opponent-move-row');
    const selected = row?.querySelector?.('.opp-move-select')?.value;
    if (selected && moveRecordByName.has(selected)) return selected;
    return findMoveName(element);
  }

  function decoratePriorityTags(root = document){
    root.querySelectorAll('.my-move-effect-card, .opponent-move-row').forEach(card => {
      const moveName = priorityMoveNameForElement(card);
      const move = moveRecordByName.get(moveName);
      const label = priorityText(move);
      const head = card.matches('.opponent-move-row')
        ? card.querySelector('.move-reference-detail .move-reference-head')
        : card.querySelector('.move-reference-head');
      if (!head) return;
      let tag = head.querySelector('.move-priority-badge');
      if (!label){
        tag?.remove();
        return;
      }
      if (!tag){
        tag = document.createElement('span');
        tag.className = 'move-priority-badge';
        head.appendChild(tag);
      }
      if (tag.textContent !== label) tag.textContent = label;
    });
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
      const nameElement = element.querySelector?.(".card-move-name");
      const moveName = String(nameElement?.textContent || element.textContent || "").trim();
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

      .search-combobox{position:relative;min-width:0;width:100%}
      .search-combobox .search-combobox-source{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;clip:rect(0 0 0 0)!important}
      .search-combobox-input{width:100%;min-width:0;box-sizing:border-box;padding-right:36px!important;background:#fff}
      .search-combobox.has-value .search-combobox-input{font-weight:800}
      .search-combobox-input.move-search-input{border-left:6px solid var(--selected-type-color,var(--line))!important}
      .search-combobox-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:24px;height:24px;padding:0;border:0;background:transparent;color:#71818b;font-size:14px;line-height:1;cursor:pointer;z-index:2}
      .search-combobox-list{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:1000;max-height:300px;overflow:auto;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 30px rgba(28,49,63,.16);padding:6px;display:none}
      .search-combobox.open .search-combobox-list{display:block}
      .search-combobox-option{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;text-align:left;border:0;background:transparent;border-radius:9px;padding:9px 10px;color:inherit;cursor:pointer}
      .search-combobox-option:hover,.search-combobox-option.active{background:#f2f6f8}
      .search-combobox-option-main{min-width:0;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .search-combobox-option-meta{display:flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end;color:#71818b;font-size:12px;flex:0 0 auto}
      .search-combobox-option-meta .mini-type{padding:2px 7px;border-radius:999px;background:color-mix(in srgb,var(--mini-type-color) 18%,#fff);color:color-mix(in srgb,var(--mini-type-color) 72%,#263238);font-weight:800}
      .search-combobox-empty{padding:12px 10px;color:#8998a1;font-size:13px}
      .move-priority-badge{display:inline-flex;align-items:center;width:max-content;flex:0 0 auto;padding:2px 7px!important;border:1px solid #ead18a!important;border-radius:999px!important;background:#fff4cf!important;color:#765200!important;font-size:11px!important;font-weight:800!important;line-height:1.25!important;white-space:nowrap}
      .opponent-identity-row>.search-combobox{min-width:0}
      .opponent-move-row>.search-combobox{min-width:0}
      @media(max-width:700px){
        .search-combobox-list{max-height:250px}
        .search-combobox-option{padding:10px 9px}
        .search-combobox-option-meta{font-size:11px}
      }
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


  function searchKey(value){
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("ko-KR")
      .replace(/[·•()\[\]{}._\-/\\]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
  }

  function sourceOptionRecords(select){
    return [...select.options]
      .filter(option => option.value)
      .map(option => ({
        value: option.value,
        label: String(option.textContent || "").trim()
      }));
  }

  function selectedOptionLabel(select){
    const option = select.options[select.selectedIndex];
    return option?.value ? String(option.textContent || "").trim() : "";
  }

  function pokemonMetaForOption(select, record){
    if (select.classList.contains("opp-pokemon")){
      const pokemonRecord = typeof pokemonCatalog !== "undefined"
        ? pokemonCatalog.find(item => item.id === record.value || item.name === record.label)
        : null;
      return {
        types: Array.isArray(pokemonRecord?.types) ? pokemonRecord.types : [],
        text: ""
      };
    }
    if (select.classList.contains("my-pokemon-select")){
      const owned = typeof pokemon !== "undefined"
        ? pokemon.find(item => item.id === record.value)
        : null;
      return {
        types: Array.isArray(owned?.types) ? owned.types : [],
        text: owned?.teraType ? `테라 ${owned.teraType}` : ""
      };
    }
    return {types:[], text:""};
  }

  function moveMetaForOption(record){
    const move = typeof moves !== "undefined"
      ? moves.find(item => item.name === record.value || item.name === record.label)
      : null;
    if (!move) return {types:[], text:"", priority:0};
    const bits = [move.category, move.power ? `위력 ${move.power}` : ""].filter(Boolean);
    return {types: move.type ? [move.type] : [], text: bits.join(" · "), priority:priorityNumber(move)};
  }

  function optionMeta(select, record){
    if (select.classList.contains("opp-move-select")) return moveMetaForOption(record);
    return pokemonMetaForOption(select, record);
  }

  function renderComboOption(button, select, record){
    const meta = optionMeta(select, record);
    const main = document.createElement("span");
    main.className = "search-combobox-option-main";
    main.textContent = record.label;
    button.appendChild(main);

    if (meta.types.length || meta.text || meta.priority){
      const aside = document.createElement("span");
      aside.className = "search-combobox-option-meta";
      meta.types.forEach(type => {
        const pill = document.createElement("span");
        pill.className = "mini-type";
        pill.textContent = type;
        pill.style.setProperty("--mini-type-color", TYPE_COLORS[type] || "#9aa7ad");
        aside.appendChild(pill);
      });
      if (meta.text){
        const text = document.createElement("span");
        text.textContent = meta.text;
        aside.appendChild(text);
      }
      if (meta.priority){
        const tag = document.createElement("span");
        tag.className = "move-priority-badge";
        tag.textContent = `우선도 ${meta.priority > 0 ? '+' : ''}${meta.priority}`;
        aside.appendChild(tag);
      }
      button.appendChild(aside);
    }
  }

  function updateComboMoveColor(wrapper, select){
    const input = wrapper.querySelector(".search-combobox-input");
    if (!input || !select.classList.contains("opp-move-select")) return;
    const type = moveTypeByName.get(select.value)
      || (typeof moves !== "undefined" ? moves.find(item => item.name === select.value)?.type : "");
    input.style.setProperty("--selected-type-color", TYPE_COLORS[type] || "var(--line)");
  }

  function enhanceSearchSelect(select){
    if (!select || select.dataset.searchComboboxBound === "true" || select.closest(".search-combobox")) return;
    const isMyPokemon = select.classList.contains("my-pokemon-select");
    const isOpponentPokemon = select.classList.contains("opp-pokemon");
    const isMove = select.classList.contains("opp-move-select");
    if (!isMyPokemon && !isOpponentPokemon && !isMove) return;

    const wrapper = document.createElement("div");
    wrapper.className = "search-combobox";
    const input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.className = `search-combobox-input${isMove ? " move-search-input" : ""}`;
    input.placeholder = isMove ? "기술 이름 검색" : isMyPokemon ? "내 포켓몬 검색" : "포켓몬 이름 검색";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "search-combobox-toggle";
    toggle.textContent = "▾";
    toggle.setAttribute("aria-label", "후보 목록 열기");
    toggle.tabIndex = -1;

    const list = document.createElement("div");
    list.className = "search-combobox-list";
    list.setAttribute("role", "listbox");

    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(input, toggle, list, select);
    select.classList.add("search-combobox-source");
    select.dataset.searchComboboxBound = "true";

    let activeIndex = -1;
    let shownRecords = [];

    function syncFromSelect(){
      input.value = selectedOptionLabel(select);
      wrapper.classList.toggle("has-value", Boolean(select.value));
      updateComboMoveColor(wrapper, select);
    }

    function closeList(){
      wrapper.classList.remove("open");
      input.setAttribute("aria-expanded", "false");
      activeIndex = -1;
    }

    function setActive(index){
      const buttons = [...list.querySelectorAll(".search-combobox-option")];
      if (!buttons.length){ activeIndex = -1; return; }
      activeIndex = ((index % buttons.length) + buttons.length) % buttons.length;
      buttons.forEach((button, idx) => button.classList.toggle("active", idx === activeIndex));
      buttons[activeIndex]?.scrollIntoView({block:"nearest"});
    }

    function choose(record){
      if (!record) return;
      select.value = record.value;
      syncFromSelect();
      closeList();
      select.dispatchEvent(new Event("change", {bubbles:true}));
      requestAnimationFrame(() => {
        syncFromSelect();
        input.focus({preventScroll:true});
        input.setSelectionRange?.(input.value.length, input.value.length);
      });
    }

    function filteredRecords(query){
      const all = sourceOptionRecords(select);
      const key = searchKey(query);
      if (!key) return all.slice(0, 60);
      const starts = [];
      const contains = [];
      all.forEach(record => {
        const labelKey = searchKey(record.label);
        const meta = optionMeta(select, record);
        const combined = searchKey(`${record.label} ${meta.types.join(" ")} ${meta.text}`);
        if (labelKey.startsWith(key)) starts.push(record);
        else if (combined.includes(key)) contains.push(record);
      });
      return [...starts, ...contains].slice(0, 60);
    }

    function renderList(query = input.value){
      shownRecords = filteredRecords(query);
      list.innerHTML = "";
      activeIndex = -1;
      if (!shownRecords.length){
        const empty = document.createElement("div");
        empty.className = "search-combobox-empty";
        empty.textContent = "일치하는 항목이 없어요.";
        list.appendChild(empty);
      } else {
        shownRecords.forEach((record, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "search-combobox-option";
          button.dataset.value = record.value;
          button.setAttribute("role", "option");
          renderComboOption(button, select, record);
          button.addEventListener("mousedown", event => event.preventDefault());
          button.addEventListener("click", () => choose(record));
          list.appendChild(button);
          if (index === 0) setActive(0);
        });
      }
      wrapper.classList.add("open");
      input.setAttribute("aria-expanded", "true");
    }

    input.addEventListener("focus", () => renderList(input.value === selectedOptionLabel(select) ? "" : input.value));
    input.addEventListener("click", () => renderList(input.value === selectedOptionLabel(select) ? "" : input.value));
    input.addEventListener("input", () => renderList(input.value));
    input.addEventListener("keydown", event => {
      if (event.key === "ArrowDown"){
        event.preventDefault();
        if (!wrapper.classList.contains("open")) renderList(input.value);
        setActive(activeIndex + 1);
      } else if (event.key === "ArrowUp"){
        event.preventDefault();
        if (!wrapper.classList.contains("open")) renderList(input.value);
        setActive(activeIndex - 1);
      } else if (event.key === "Enter"){
        if (!wrapper.classList.contains("open")) return;
        event.preventDefault();
        choose(shownRecords[Math.max(0, activeIndex)]);
      } else if (event.key === "Escape"){
        event.preventDefault();
        syncFromSelect();
        closeList();
      }
    });
    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (!wrapper.contains(document.activeElement)){
          const exact = sourceOptionRecords(select).find(record => searchKey(record.label) === searchKey(input.value));
          if (exact && exact.value !== select.value) choose(exact);
          else syncFromSelect();
          closeList();
        }
      }, 80);
    });
    toggle.addEventListener("mousedown", event => event.preventDefault());
    toggle.addEventListener("click", () => {
      if (wrapper.classList.contains("open")) closeList();
      else { input.focus(); renderList(""); }
    });
    select.addEventListener("change", syncFromSelect);
    syncFromSelect();
  }

  function enhanceBattleSearchSelects(){
    document.querySelectorAll(".my-pokemon-select, .opp-pokemon, .opp-move-select")
      .forEach(enhanceSearchSelect);
  }

  function enhanceBattlePage(){
    if (!document.querySelector(".battle-main")) return;
    injectBattleEnhancementStyles();
    ensureBattleMatchupButton();
    ensureOpponentTeraSelects();
    bindStableEvInputs();
    enhanceBattleSearchSelects();
  }

  function paint(){
    scheduled = false;
    colorTypeLabels();
    colorMoveCards();
    decoratePriorityTags();
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
      moveRecordByName = new Map(
        (moves || [])
          .filter(move => move?.name)
          .map(move => [String(move.name).trim(), move])
      );
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
