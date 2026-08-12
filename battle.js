const CONFIG = window.EEVEE_BOX_CONFIG || {};
const POKEMON_KEY = 'EEVEE_BOX_DATA_V1';
const BATTLE_KEY = 'EEVEE_BOX_BATTLE_V1';
const BATTLE_SAVES_KEY = 'EEVEE_BOX_BATTLE_SAVES_V2';

let pokemon = [];
let pokemonCatalog = [];
let abilities = [];
let items = [];
let moves = [];
let baseStatsByName = {};
let battle;
let battleSaves = [];
let activeBattleId = '';

const $ = selector => document.querySelector(selector);
const toast = $('#toast');
const HOUSE_STAT_BONUS = 14;
const STAT_DEFS = [
  ['hp','HP'], ['attack','공격'], ['defense','방어'],
  ['spAttack','특공'], ['spDefense','특방'], ['speed','스피드']
];
function normalizedStats(record){
  const source = record?.stats || {};
  return Object.fromEntries(STAT_DEFS.map(([key]) => [key, {
    base: Math.max(0, Number(source[key]?.base) || 0),
    ev: Math.max(0, Math.min(252, Number(source[key]?.ev) || 0))
  }]));
}
function battleStatsPanel(record){
  const stats = normalizedStats(record);
  const used = STAT_DEFS.reduce((sum,[key]) => sum + stats[key].ev, 0);
  return `<section class="stats-panel battle-stats-panel">
    <div class="stats-panel-title"><span>능력치</span><small>${used} / 510 EV</small></div>
    ${STAT_DEFS.map(([key,label]) => {
      const base = stats[key].base;
      const ev = stats[key].ev;
      const level = Math.max(1, Math.min(100, Math.floor(Number(record.level) || 1)));
      const evPart = Math.floor(ev / 4);
      const scaled = Math.floor(((base * 2) + evPart) * level / 100);
      const current = (key === 'hp' ? scaled + level + 10 : scaled + 5) + HOUSE_STAT_BONUS;
      const width = Math.min(100, current / 300 * 100);
      return `<div class="stat-display-row"><span class="stat-label">${label}</span><span class="stat-equation"><b>${base}</b><i>+${ev} EV</i><em>→</em><strong>${current}</strong></span><span class="stat-bar"><span style="width:${width}%"></span></span></div>`;
    }).join('')}
  </section>`;
}

function emptyBattle(){
  return {
    id: '',
    title: '',
    myTeam: ['', '', ''],
    opponentTeam: [emptyOpponent(), emptyOpponent(), emptyOpponent()],
    notes: '',
    updatedAt: ''
  };
}

function emptyOpponent(){
  return {
    catalogId:'',
    name:'',
    level:'',
    types:'',
    ability:'',
    item:'',
    stats: normalizedStats({}),
    moves:['', '', '', '']
  };
}

battle = emptyBattle();

function say(message){
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function setSync(ok, text){
  $('#syncDot').classList.toggle('online', ok);
  $('#syncText').textContent = text || (ok ? '웹 동기화' : '로컬 모드');
}

async function api(action, payload = {}){
  if (!window.EeveeBackend) throw new Error('Supabase backend missing');
  return window.EeveeBackend.api(action, payload);
}

async function load(){
  setSync(false, '불러오는 중');

  [pokemonCatalog, abilities, items, moves, baseStatsByName] = await Promise.all([
    fetch('pokemon-catalog.json').then(response => {
      if (!response.ok) throw new Error(`pokemon-catalog.json ${response.status}`);
      return response.json();
    }),
    fetch('abilities.json').then(response => {
      if (!response.ok) throw new Error(`abilities.json ${response.status}`);
      return response.json();
    }),
    fetch('items.json').then(response => {
      if (!response.ok) throw new Error(`items.json ${response.status}`);
      return response.json();
    }),
    fetch('moves.json').then(response => {
      if (!response.ok) throw new Error(`moves.json ${response.status}`);
      return response.json();
    }),
    fetch('pokemon-base-stats-by-name.json').then(response => {
      if (!response.ok) throw new Error(`pokemon-base-stats-by-name.json ${response.status}`);
      return response.json();
    })
  ]);

  pokemonCatalog.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  abilities.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  items.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  moves.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const localPokemon = JSON.parse(localStorage.getItem(POKEMON_KEY) || 'null');
  if (Array.isArray(localPokemon)) {
    pokemon = localPokemon;
  } else {
    pokemon = await fetch('pokemon-data.json').then(r => r.json());
  }

  const localBattle = JSON.parse(localStorage.getItem(BATTLE_KEY) || 'null');
  const localSaves = JSON.parse(localStorage.getItem(BATTLE_SAVES_KEY) || '[]');
  if (localBattle) {
    battle = normalizeBattle(localBattle);
    activeBattleId = battle.id || '';
  }
  if (Array.isArray(localSaves)) battleSaves = localSaves.map(normalizeBattle);

  if (CONFIG.apiEndpoint){
    try {
      const [pokemonResult, battleResult] = await Promise.all([
        api('get_all'),
        api('list_battles')
      ]);
      if (pokemonResult.records?.length) pokemon = pokemonResult.records;
      battleSaves = Array.isArray(battleResult.battles)
        ? battleResult.battles.map(normalizeBattle)
        : [];

      // Supabase 첫 연결 시 이 브라우저에 남아 있던 저장본도 한 번 옮겨요.
      if (!battleSaves.length && Array.isArray(localSaves) && localSaves.length){
        const migrated = [];
        for (const saved of localSaves.map(normalizeBattle)){
          if (!saved.id) saved.id = makeBattleId();
          const result = await api('save_battle', {battle:saved});
          migrated.push(normalizeBattle(result.battle || saved));
        }
        battleSaves = migrated.sort((a,b) => Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0));
      }

      // 이 기기에 작업 중인 초안이 없으면 가장 최근의 클라우드 저장본을 열어요.
      if (!localBattle && battleSaves.length){
        battle = normalizeBattle(battleSaves[0]);
        activeBattleId = battle.id || '';
      }

      localStorage.setItem(POKEMON_KEY, JSON.stringify(pokemon));
      localStorage.setItem(BATTLE_KEY, JSON.stringify(battle));
      localStorage.setItem(BATTLE_SAVES_KEY, JSON.stringify(battleSaves));
      setSync(true, '클라우드 동기화');
    } catch (error){
      console.warn(error);
      setSync(false, '오프라인 · 로컬 캐시');
    }
  } else {
    setSync(false);
  }

  render();
}

function normalizeBattle(value){
  const result = emptyBattle();
  return {
    ...result,
    ...value,
    myTeam: [...(value.myTeam || []), '', '', ''].slice(0,3),
    opponentTeam: [...(value.opponentTeam || []), emptyOpponent(), emptyOpponent(), emptyOpponent()]
      .slice(0,3)
      .map(item => {
        const normalized = {...emptyOpponent(), ...(item || {})};
        if (typeof normalized.moves === 'string'){
          normalized.moves = normalized.moves
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);
        }
        normalized.stats = normalizedStats(normalized);
        normalized.moves = [...(normalized.moves || []), '', '', '', ''].slice(0,4);
        return normalized;
      })
  };
}

function render(){
  $('#battleTitle').value = battle.title || '';
  $('#battleNotes').value = battle.notes || '';

  renderMyTeam();
  renderOpponentTeam();
  renderBattleSaves();
  updateCounts();
}

function renderMyTeam(){
  const container = $('#myTeam');
  container.innerHTML = '';

  for (let index = 0; index < 3; index += 1){
    const fragment = $('#mySlotTemplate').content.cloneNode(true);
    const slot = fragment.querySelector('.battle-slot');
    slot.dataset.index = index;
    fragment.querySelector('.slot-number').textContent = index + 1;

    const select = fragment.querySelector('.my-pokemon-select');
    select.innerHTML = [
      '<option value="">선택 안 함</option>',
      ...pokemon
        .slice()
        .sort((a,b) => (a.order || 999) - (b.order || 999))
        .map(record => `<option value="${escapeHtml(record.id)}">${escapeHtml(record.nickname || record.species)} · ${escapeHtml(record.species)} · Lv.${Number(record.level || 1)}</option>`)
    ].join('');
    select.value = battle.myTeam[index] || '';
    select.addEventListener('change', () => {
      battle.myTeam[index] = select.value;
      updateMyPreview(slot, select.value);
      persistLocal();
      updateCounts();
    });

    container.appendChild(fragment);
    updateMyPreview(container.lastElementChild, select.value);
  }
}

function updateMyPreview(slot, id){
  const preview = slot.querySelector('.selected-pokemon-preview');
  const record = pokemon.find(item => item.id === id);
  if (!record){
    preview.className = 'selected-pokemon-preview empty';
    preview.textContent = '포켓몬을 선택하세요.';
    return;
  }

  const currentMoves = (record.currentMoves || []).filter(Boolean);
  const abilityRecord = abilities.find(item => item.name === record.ability);
  const itemRecord = items.find(item => item.name === record.heldItem);

  preview.className = 'selected-pokemon-preview';
  preview.innerHTML = `
    <div class="preview-title">
      <strong>${escapeHtml(record.nickname || record.species)}</strong>
      <span>Lv.${Number(record.level || 1)}</span>
    </div>
    <div class="preview-species">${escapeHtml(record.species || '')}</div>
    <div class="preview-tags">
      ${(record.types || []).map(type => `<span class="type-pill">${escapeHtml(type)}</span>`).join('')}
      ${record.teraType ? `<span class="tera-pill">테라 ${escapeHtml(record.teraType)}</span>` : ''}
    </div>

    ${battleStatsPanel(record)}

    <div class="my-reference-block">
      <div class="my-reference-title">특성 · ${escapeHtml(record.ability || '없음')}</div>
      <div class="my-reference-effect">${escapeHtml(abilityRecord?.description || record.abilityEffect || '효과 정보 없음')}</div>
    </div>

    <div class="my-reference-block">
      <div class="my-reference-title">도구 · ${escapeHtml(record.heldItem || '없음')}</div>
      <div class="my-reference-effect">${escapeHtml(itemRecord?.description || '효과 정보 없음')}</div>
      ${itemRecord ? `<small>${escapeHtml([itemRecord.price, itemRecord.limit].filter(Boolean).join(' · '))}</small>` : ''}
    </div>

    <div class="my-move-effects">
      ${currentMoves.length
        ? currentMoves.map(moveName => {
            const move = moves.find(item => item.name === moveName);
            if (!move){
              return `
                <div class="my-move-effect-card">
                  <div class="my-move-effect-head"><strong>${escapeHtml(moveName)}</strong></div>
                  <div class="my-reference-effect">효과 정보 없음</div>
                </div>
              `;
            }

            const stats = [
              move.type,
              move.category,
              `위력 ${move.power || '-'}`,
              `명중 ${move.accuracy || '-'}`,
              `PP ${move.pp || '-'}`
            ];

            return `
              <div class="my-move-effect-card">
                <div class="my-move-effect-head">
                  <strong>${escapeHtml(moveName)}</strong>
                  <div class="move-reference-head">
                    ${stats.map(value => `<span>${escapeHtml(value)}</span>`).join('')}
                  </div>
                </div>
                <div class="my-reference-effect">${escapeHtml(move.description || '효과 정보 없음')}</div>
                ${move.target ? `<small>대상 ${escapeHtml(move.target)}</small>` : ''}
              </div>
            `;
          }).join('')
        : '<div class="my-reference-effect">현재 기술 없음</div>'
      }
    </div>
  `;
}

function applySpeciesBaseStats(record, speciesName){
  const source = baseStatsByName?.[speciesName]?.stats || {};
  const previous = normalizedStats(record);
  record.stats = Object.fromEntries(STAT_DEFS.map(([key]) => [key, {
    base: Math.max(0, Number(source[key]) || 0),
    ev: previous[key].ev
  }]));
}

function calculateBattleStat(key, base, ev, level){
  const safeLevel = Math.max(1, Math.min(100, Math.floor(Number(level) || 1)));
  const safeBase = Math.max(0, Number(base) || 0);
  const safeEv = Math.max(0, Math.min(252, Math.floor(Number(ev) || 0)));
  const scaled = Math.floor(((safeBase * 2) + Math.floor(safeEv / 4)) * safeLevel / 100);
  return (key === 'hp' ? scaled + safeLevel + 10 : scaled + 5) + HOUSE_STAT_BONUS;
}

function renderOpponentStatsPanel(container, record, selectedPokemon){
  if (!selectedPokemon){
    container.className = 'opponent-stats-panel empty-auto-field';
    container.textContent = '포켓몬을 선택하면 기본 능력치가 표시돼요.';
    return;
  }

  const source = baseStatsByName?.[selectedPokemon.name]?.stats || {};
  if (!record.stats || STAT_DEFS.some(([key]) => Number(record.stats?.[key]?.base) !== Number(source[key] || 0))){
    applySpeciesBaseStats(record, selectedPokemon.name);
  }
  const stats = normalizedStats(record);
  record.stats = stats;
  const used = STAT_DEFS.reduce((sum,[key]) => sum + stats[key].ev, 0);
  const remaining = 510 - used;

  container.className = 'opponent-stats-panel';
  container.innerHTML = `
    <div class="opponent-stats-head">
      <strong>능력치</strong>
      <span class="opp-ev-total ${remaining < 0 ? 'over' : ''}">${used} / 510 EV · 남음 ${remaining}</span>
    </div>
    <div class="opponent-stat-columns"><span>능력치</span><span>기본</span><span>노력치</span><span>최종</span></div>
    ${STAT_DEFS.map(([key,label]) => `
      <div class="opponent-stat-row" data-stat="${key}">
        <strong>${label}</strong>
        <span class="opp-base-stat">${stats[key].base}</span>
        <input class="opp-stat-ev" type="number" min="0" max="252" step="4" value="${stats[key].ev}" aria-label="${label} 노력치" />
        <span class="opp-final-stat">${calculateBattleStat(key, stats[key].base, stats[key].ev, record.level)}</span>
      </div>
    `).join('')}
    <p class="opp-ev-warning"${remaining >= 0 ? ' hidden' : ''}>노력치 총합은 510을 넘을 수 없어요.</p>
    <small class="house-rule-note">최종 능력치에는 하우스룰 +${HOUSE_STAT_BONUS}가 적용돼요.</small>
  `;

  container.querySelectorAll('.opp-stat-ev').forEach(input => {
    input.addEventListener('input', () => {
      const row = input.closest('.opponent-stat-row');
      const key = row.dataset.stat;
      let value = Math.max(0, Math.min(252, Math.floor(Number(input.value) || 0)));
      input.value = value;
      record.stats[key].ev = value;
      renderOpponentStatsPanel(container, record, selectedPokemon);
      persistLocal();
    });
  });
}

function renderOpponentTeam(){
  const container = $('#opponentTeam');
  container.innerHTML = '';

  for (let index = 0; index < 3; index += 1){
    const fragment = $('#opponentSlotTemplate').content.cloneNode(true);
    fragment.querySelector('.slot-number').textContent = index + 1;
    const record = battle.opponentTeam[index];

    const pokemonSelect = fragment.querySelector('.opp-pokemon');
    const levelInput = fragment.querySelector('.opp-level');
    const typesDisplay = fragment.querySelector('.opp-types-display');
    const abilitySelect = fragment.querySelector('.opp-ability');
    const itemSelect = fragment.querySelector('.opp-item');
    const abilityDetail = fragment.querySelector('.opp-ability-detail');
    const itemDetail = fragment.querySelector('.opp-item-detail');
    const statsPanel = fragment.querySelector('.opponent-stats-panel');

    fillPokemonCatalogSelect(pokemonSelect, record.catalogId, record.name);

    const selectedPokemon = findCatalogPokemon(record.catalogId, record.name);
    if (selectedPokemon){
      record.catalogId = selectedPokemon.id;
      record.name = selectedPokemon.name;
      record.types = selectedPokemon.types.join(', ');
      applySpeciesBaseStats(record, selectedPokemon.name);
      if (record.ability && !selectedPokemon.abilities.includes(record.ability)){
        record.ability = '';
      }
    }

    levelInput.value = record.level || '';
    updateOpponentTypes(typesDisplay, selectedPokemon);
    fillPokemonAbilitySelect(abilitySelect, selectedPokemon, record.ability);
    fillReferenceSelect(itemSelect, items, record.item, '도구 없음');

    updateAbilityDetail(abilityDetail, record.ability);
    updateItemDetail(itemDetail, record.item);
    renderOpponentStatsPanel(statsPanel, record, selectedPokemon);

    pokemonSelect.addEventListener('change', () => {
      const selected = pokemonCatalog.find(item => item.id === pokemonSelect.value);

      if (!selected){
        record.catalogId = '';
        record.name = '';
        record.types = '';
        record.ability = '';
        updateOpponentTypes(typesDisplay, null);
        fillPokemonAbilitySelect(abilitySelect, null, '');
        updateAbilityDetail(abilityDetail, '');
        record.stats = normalizedStats({});
        renderOpponentStatsPanel(statsPanel, record, null);
        persistLocal();
        updateCounts();
        return;
      }

      record.catalogId = selected.id;
      record.name = selected.name;
      record.types = selected.types.join(', ');
      record.ability = '';
      applySpeciesBaseStats(record, selected.name);

      updateOpponentTypes(typesDisplay, selected);
      fillPokemonAbilitySelect(abilitySelect, selected, '');
      updateAbilityDetail(abilityDetail, '');
      renderOpponentStatsPanel(statsPanel, record, selected);
      persistLocal();
      updateCounts();
    });

    levelInput.addEventListener('input', () => {
      record.level = levelInput.value;
      renderOpponentStatsPanel(statsPanel, record, findCatalogPokemon(record.catalogId, record.name));
      persistLocal();
    });

    abilitySelect.addEventListener('change', () => {
      record.ability = abilitySelect.value;
      updateAbilityDetail(abilityDetail, record.ability);
      persistLocal();
    });

    itemSelect.addEventListener('change', () => {
      record.item = itemSelect.value;
      updateItemDetail(itemDetail, record.item);
      persistLocal();
    });

    const moveRows = [...fragment.querySelectorAll('.opponent-move-row')];
    moveRows.forEach((row, moveIndex) => {
      const select = row.querySelector('.opp-move-select');
      const detail = row.querySelector('.move-reference-detail');
      fillMoveSelect(select, record.moves[moveIndex], moveIndex);
      updateMoveDetail(detail, record.moves[moveIndex]);

      select.addEventListener('change', () => {
        record.moves[moveIndex] = select.value;
        updateMoveDetail(detail, select.value);
        persistLocal();
      });
    });

    container.appendChild(fragment);
  }
}

function fillPokemonCatalogSelect(select, selectedId, selectedName){
  const selectedPokemon = findCatalogPokemon(selectedId, selectedName);
  const selectedValue = selectedPokemon?.id || '';

  select.innerHTML = [
    '<option value="">포켓몬 선택</option>',
    ...pokemonCatalog.map(record =>
      `<option value="${escapeHtml(record.id)}"${record.id === selectedValue ? ' selected' : ''}>${escapeHtml(record.name)}</option>`
    )
  ].join('');
}

function findCatalogPokemon(id, name){
  return pokemonCatalog.find(item => item.id === id)
    || pokemonCatalog.find(item => item.name === name)
    || null;
}

function fillPokemonAbilitySelect(select, pokemonRecord, selectedValue){
  const names = pokemonRecord?.abilities || [];

  select.innerHTML = [
    '<option value="">특성 선택</option>',
    ...names.map(name =>
      `<option value="${escapeHtml(name)}"${name === selectedValue ? ' selected' : ''}>${escapeHtml(name)}</option>`
    )
  ].join('');

  select.disabled = !pokemonRecord;
}

function updateOpponentTypes(element, pokemonRecord){
  if (!pokemonRecord){
    element.className = 'auto-field opp-types-display empty-auto-field';
    element.textContent = '포켓몬을 선택하면 자동으로 표시돼요.';
    return;
  }

  element.className = 'auto-field opp-types-display';
  element.innerHTML = pokemonRecord.types
    .map(type => `<span class="type-pill">${escapeHtml(type)}</span>`)
    .join('');
}

function fillReferenceSelect(select, records, selectedValue, emptyLabel){
  const names = records.map(record => record.name);
  if (selectedValue && !names.includes(selectedValue)){
    names.unshift(selectedValue);
  }

  select.innerHTML = [
    `<option value="">${escapeHtml(emptyLabel)}</option>`,
    ...names.map(name =>
      `<option value="${escapeHtml(name)}"${name === selectedValue ? ' selected' : ''}>${escapeHtml(name)}</option>`
    )
  ].join('');
}

function fillMoveSelect(select, selectedValue, index){
  const names = moves.map(record => record.name);
  if (selectedValue && !names.includes(selectedValue)){
    names.unshift(selectedValue);
  }

  select.innerHTML = [
    `<option value="">기술 ${index + 1} 선택</option>`,
    ...names.map(name =>
      `<option value="${escapeHtml(name)}"${name === selectedValue ? ' selected' : ''}>${escapeHtml(name)}</option>`
    )
  ].join('');
}

function updateAbilityDetail(element, name){
  const record = abilities.find(item => item.name === name);
  element.textContent = record?.description || '특성을 선택하면 효과가 표시돼요.';
}

function updateItemDetail(element, name){
  const record = items.find(item => item.name === name);
  if (!record){
    element.textContent = '도구를 선택하면 효과가 표시돼요.';
    return;
  }

  const meta = [record.price, record.limit].filter(Boolean).join(' · ');
  element.innerHTML = `
    <div>${escapeHtml(record.description || '효과 정보 없음')}</div>
    ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
  `;
}

function updateMoveDetail(element, name){
  const record = moves.find(item => item.name === name);
  if (!record){
    element.textContent = '기술을 선택하면 효과가 표시돼요.';
    return;
  }

  const stats = [
    record.type,
    record.category,
    `위력 ${record.power || '-'}`,
    `명중 ${record.accuracy || '-'}`,
    `PP ${record.pp || '-'}`
  ].filter(Boolean);

  const flags = Array.isArray(record.flags) && record.flags.length
    ? ` · ${record.flags.join(' · ')}`
    : '';

  element.innerHTML = `
    <div class="move-reference-head">${stats.map(value => `<span>${escapeHtml(value)}</span>`).join('')}</div>
    <div>${escapeHtml(record.description || '효과 정보 없음')}</div>
    ${record.target ? `<small>대상 ${escapeHtml(record.target)}${escapeHtml(flags)}</small>` : ''}
  `;
}

function readPageValues(){
  battle.title = $('#battleTitle').value.trim();
  battle.notes = $('#battleNotes').value.trim();
  battle.updatedAt = new Date().toISOString();
}

function persistLocal(){
  readPageValues();
  localStorage.setItem(BATTLE_KEY, JSON.stringify(battle));
}

function makeBattleId(){
  if (globalThis.crypto?.randomUUID) return `battle_${crypto.randomUUID()}`;
  return `battle_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
}

function cacheBattleSaves(){
  localStorage.setItem(BATTLE_SAVES_KEY, JSON.stringify(battleSaves));
}

function sortBattleSaves(){
  battleSaves.sort((a,b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
}

function renderBattleSaves(){
  const list = $('#battleSaveList');
  const empty = $('#battleSaveEmpty');
  const count = $('#battleSaveCount');
  if (!list || !empty || !count) return;

  sortBattleSaves();
  count.textContent = `${battleSaves.length}개`;
  empty.hidden = battleSaves.length > 0;
  list.innerHTML = battleSaves.map(saved => `
    <article class="battle-save-card${saved.id === activeBattleId ? ' active' : ''}" data-id="${escapeHtml(saved.id)}">
      <button class="battle-save-open" type="button">
        <strong>${escapeHtml(saved.title || '이름 없는 배틀')}</strong>
        <small>${formatSavedAt(saved.updatedAt)}</small>
      </button>
      <div class="battle-save-actions">
        <button class="battle-save-rename" type="button">이름 변경</button>
        <button class="battle-save-delete danger" type="button">삭제</button>
      </div>
    </article>
  `).join('');

  list.querySelectorAll('.battle-save-card').forEach(card => {
    const id = card.dataset.id;
    card.querySelector('.battle-save-open').addEventListener('click', () => loadSavedBattle(id));
    card.querySelector('.battle-save-rename').addEventListener('click', () => renameSavedBattle(id));
    card.querySelector('.battle-save-delete').addEventListener('click', () => deleteSavedBattle(id));
  });
}

function formatSavedAt(value){
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return '저장 시각 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
  }).format(date);
}

function loadSavedBattle(id){
  const saved = battleSaves.find(item => item.id === id);
  if (!saved) return;
  battle = normalizeBattle(JSON.parse(JSON.stringify(saved)));
  activeBattleId = battle.id;
  localStorage.setItem(BATTLE_KEY, JSON.stringify(battle));
  render();
  window.scrollTo({top:0, behavior:'smooth'});
  say(`“${battle.title || '이름 없는 배틀'}”을 불러왔어요`);
}

async function refreshBattleSaves({silent = false} = {}){
  if (!CONFIG.apiEndpoint) return;
  try {
    const result = await api('list_battles');
    battleSaves = Array.isArray(result.battles) ? result.battles.map(normalizeBattle) : [];
    cacheBattleSaves();
    renderBattleSaves();
    setSync(true, '클라우드 동기화');
    if (!silent) say('다른 기기의 저장 목록까지 새로 불러왔어요');
  } catch (error){
    console.warn(error);
    setSync(false, '오프라인 · 로컬 캐시');
    if (!silent) say('클라우드 목록을 불러오지 못했어요');
  }
}

async function saveBattle(){
  readPageValues();
  if (!battle.title){
    $('#battleTitle').focus();
    say('배틀 이름을 먼저 입력해 주세요');
    return;
  }

  if (!activeBattleId){
    const sameTitle = battleSaves.find(item => item.title.trim() === battle.title.trim());
    if (sameTitle){
      if (!confirm(`“${battle.title}” 저장본이 이미 있어요. 덮어쓸까요?`)) return;
      activeBattleId = sameTitle.id;
    } else {
      activeBattleId = makeBattleId();
    }
  }

  battle.id = activeBattleId;
  battle.updatedAt = new Date().toISOString();
  localStorage.setItem(BATTLE_KEY, JSON.stringify(battle));

  if (!CONFIG.apiEndpoint){
    const index = battleSaves.findIndex(item => item.id === battle.id);
    if (index >= 0) battleSaves[index] = normalizeBattle(battle);
    else battleSaves.unshift(normalizeBattle(battle));
    cacheBattleSaves();
    renderBattleSaves();
    setSync(false);
    say('이 기기에만 저장했어요');
    return;
  }

  try {
    const result = await api('save_battle', {battle});
    battle = normalizeBattle(result.battle || battle);
    activeBattleId = battle.id;
    const index = battleSaves.findIndex(item => item.id === battle.id);
    if (index >= 0) battleSaves[index] = normalizeBattle(battle);
    else battleSaves.unshift(normalizeBattle(battle));
    cacheBattleSaves();
    localStorage.setItem(BATTLE_KEY, JSON.stringify(battle));
    renderBattleSaves();
    setSync(true, '클라우드 동기화');
    say('모든 기기에서 볼 수 있게 저장했어요');
  } catch (error){
    console.warn(error);
    setSync(false, '저장 실패 · 로컬 초안 유지');
    say('클라우드 저장에 실패했어요');
  }
}

async function renameSavedBattle(id){
  const saved = battleSaves.find(item => item.id === id);
  if (!saved) return;
  const nextTitle = prompt('새 배틀 이름을 입력해 주세요.', saved.title || '');
  if (nextTitle === null) return;
  const title = nextTitle.trim();
  if (!title) return say('이름은 비워둘 수 없어요');

  try {
    const result = CONFIG.apiEndpoint
      ? await api('rename_battle', {id, title})
      : {battle:{...saved, title, updatedAt:new Date().toISOString()}};
    const renamed = normalizeBattle(result.battle);
    const index = battleSaves.findIndex(item => item.id === id);
    if (index >= 0) battleSaves[index] = renamed;
    if (activeBattleId === id){
      battle.title = title;
      battle.updatedAt = renamed.updatedAt;
      localStorage.setItem(BATTLE_KEY, JSON.stringify(battle));
      $('#battleTitle').value = title;
    }
    cacheBattleSaves();
    renderBattleSaves();
    say('이름을 변경했어요');
  } catch (error){
    console.warn(error);
    say('이름 변경에 실패했어요');
  }
}

async function deleteSavedBattle(id){
  const saved = battleSaves.find(item => item.id === id);
  if (!saved || !confirm(`“${saved.title || '이름 없는 배틀'}” 저장본을 삭제할까요?`)) return;
  try {
    if (CONFIG.apiEndpoint) await api('delete_battle', {id});
    battleSaves = battleSaves.filter(item => item.id !== id);
    if (activeBattleId === id){
      activeBattleId = '';
      battle.id = '';
      localStorage.setItem(BATTLE_KEY, JSON.stringify(battle));
    }
    cacheBattleSaves();
    renderBattleSaves();
    say('저장본을 삭제했어요');
  } catch (error){
    console.warn(error);
    say('삭제에 실패했어요');
  }
}

function clearBattle(){
  if (!confirm('현재 편집 중인 3:3 배틀 구성을 모두 비울까요? 저장 목록은 삭제되지 않아요.')) return;
  battle = emptyBattle();
  activeBattleId = '';
  localStorage.setItem(BATTLE_KEY, JSON.stringify(battle));
  render();
  say('새 배틀을 시작했어요');
}

function updateCounts(){
  const myCount = battle.myTeam.filter(Boolean).length;
  const opponentCount = battle.opponentTeam.filter(item => item.name?.trim()).length;
  $('#myCount').textContent = `${myCount} / 3`;
  $('#opponentCount').textContent = `${opponentCount} / 3`;
}

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[char]));
}

$('#saveBattle').addEventListener('click', saveBattle);
$('#clearBattle').addEventListener('click', clearBattle);
$('#refreshBattleSaves')?.addEventListener('click', () => refreshBattleSaves());
$('#battleTitle').addEventListener('input', persistLocal);
$('#battleNotes').addEventListener('input', persistLocal);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshBattleSaves({silent:true});
});
window.addEventListener('focus', () => refreshBattleSaves({silent:true}));
setInterval(() => { if (!document.hidden) refreshBattleSaves({silent:true}); }, 30000);

window.EeveeAuth.ready.then(() => load()).catch(error => {
  console.error(error);
  setSync(false);
  say('페이지를 불러오지 못했어요');
});
