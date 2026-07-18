const CONFIG = window.EEVEE_BOX_CONFIG || {};
const KEY = 'EEVEE_BOX_DATA_V1';
let data = [];
let editing = null;
let abilities = [];
let items = [];
let moveDex = [];
let moveMap = new Map();
let baseStatsByName = {};
let pokemonCatalog = [];
let pokemonCatalogByName = new Map();
const $ = s => document.querySelector(s);
const grid = $('#grid');
const toast = $('#toast');
const STAT_DEFS = [
  ['hp','HP'], ['attack','공격'], ['defense','방어'],
  ['spAttack','특공'], ['spDefense','특방'], ['speed','스피드']
];
const MAX_EV_PER_STAT = 252;
const MAX_TOTAL_EV = 510;
const HOUSE_STAT_BONUS = 14;

function clampNumber(value, min, max){
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function normalizeStats(record){
  const source = record?.stats || {};
  return Object.fromEntries(STAT_DEFS.map(([key]) => {
    const value = source[key] || {};
    return [key, {
      base: clampNumber(value.base ?? 0, 0, 999),
      ev: clampNumber(value.ev ?? 0, 0, MAX_EV_PER_STAT)
    }];
  }));
}

function statValues(record, key){
  const stat = normalizeStats(record)[key];
  const level = clampNumber(record?.level ?? 1, 1, 100);
  const evPart = Math.floor(stat.ev / 4);
  const scaled = Math.floor(((stat.base * 2) + evPart) * level / 100);
  const current = (key === 'hp' ? scaled + level + 10 : scaled + 5) + HOUSE_STAT_BONUS;
  return {...stat, level, evPart, current};
}

function totalEv(record){
  const stats = normalizeStats(record);
  return STAT_DEFS.reduce((sum, [key]) => sum + stats[key].ev, 0);
}

function say(text){
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

async function api(action, payload = {}){
  if (!CONFIG.apiEndpoint) throw new Error('API endpoint missing');

  const response = await fetch(CONFIG.apiEndpoint, {
    method: 'POST',
    headers: {'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({action, ...payload}),
    redirect: 'follow'
  });

  const text = await response.text();

  if (!response.ok){
    throw new Error(`API HTTP ${response.status}: ${text.slice(0, 160)}`);
  }

  let result;
  try {
    result = JSON.parse(text);
  } catch (_) {
    throw new Error(`API가 JSON 대신 다른 응답을 반환했어요: ${text.slice(0, 160)}`);
  }

  if (!result.ok) throw new Error(result.error || 'API error');
  return result;
}

function setSync(ok){
  $('#syncDot').classList.toggle('online', ok);
  $('#syncText').textContent = ok ? '웹 동기화' : '로컬 모드';
}

function persist(){
  localStorage.setItem(KEY, JSON.stringify(data));
}

function mergeRecords(localRecords, remoteRecords){
  const merged = new Map();
  [...remoteRecords, ...localRecords].forEach(record => {
    const old = merged.get(record.id);
    const oldTime = Date.parse(old?.updatedAt || 0);
    const newTime = Date.parse(record.updatedAt || 0);
    if (!old || newTime >= oldTime) merged.set(record.id, record);
  });
  return [...merged.values()];
}

async function load(){
  const [seed, abilityData, itemData, allMoves, baseStatData, catalogData] = await Promise.all([
    fetch('pokemon-data.json').then(r => r.json()),
    fetch('abilities.json').then(r => r.json()),
    fetch('items.json').then(r => r.json()),
    fetch('moves.json').then(r => r.json()),
    fetch('pokemon-base-stats-by-name.json').then(r => r.json()),
    fetch('pokemon-catalog.json').then(r => r.json())
  ]);
  abilities = abilityData;
  items = itemData;
  moveDex = allMoves;
  moveMap = new Map(moveDex.map(move => [move.name, move]));
  baseStatsByName = baseStatData || {};
  pokemonCatalog = Array.isArray(catalogData) ? catalogData : [];
  pokemonCatalogByName = new Map(pokemonCatalog.map(record => [record.name, record]));
  const speciesNames = [...new Set([...Object.keys(baseStatsByName), ...pokemonCatalog.map(record => record.name)])].sort((a, b) => a.localeCompare(b, 'ko'));
  $('#speciesList').innerHTML = speciesNames.map(name => `<option value="${esc(name)}"></option>`).join('');

  const local = JSON.parse(localStorage.getItem(KEY) || 'null');
  data = local || seed;

  if (CONFIG.apiEndpoint){
    try {
      const result = await api('sync_all', {records:data});
      data = result.records?.length ? result.records : data;
      persist();
      setSync(true);
    } catch (error){
      console.warn(error);
      setSync(false);
    }
  }
  render();
}

async function saveRecord(record){
  record.updatedAt = new Date().toISOString();
  persist();
  render();
  if (CONFIG.apiEndpoint){
    try {
      const result = await api('save', {record});
      if (result.record) Object.assign(record, result.record);
      persist();
      setSync(true);
    } catch (error){
      console.warn(error);
      setSync(false);
      say('로컬에는 저장됐어요');
    }
  }
}

function types(){
  return [...new Set(data.flatMap(p => p.types || []))].sort();
}

function render(){
  const query = $('#searchInput').value.trim().toLowerCase();
  const selectedType = $('#typeFilter').value;
  const filtered = data
    .filter(p => !query || [p.nickname,p.species,p.ability,p.heldItem,...(p.types||[])].join(' ').toLowerCase().includes(query))
    .filter(p => !selectedType || (p.types || []).includes(selectedType));

  $('#countText').textContent = `${filtered.length}마리`;
  grid.innerHTML = filtered.sort((a,b)=>(a.order||99)-(b.order||99)).map(card).join('');
  grid.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => openEditor(button.dataset.edit));
  grid.querySelectorAll('[data-level]').forEach(button => button.onclick = () => changeLevel(button.dataset.level, Number(button.dataset.delta)));
}

function card(p){
  return `<article class="card">
    <div class="card-head"><div><h3>${esc(p.nickname||p.species)}</h3><div class="species">${esc(p.species)}</div></div><button data-edit="${p.id}">수정</button></div>
    <div class="badges">${(p.types||[]).map(x=>`<span class="badge">${esc(x)}</span>`).join('')}${p.teraType?`<span class="badge">테라 ${esc(p.teraType)}</span>`:''}</div>
    <div class="level-row"><span>현재 레벨</span><strong>Lv.${p.level||1}</strong><div class="level-controls"><button data-level="${p.id}" data-delta="-1">−</button><button data-level="${p.id}" data-delta="1">+</button></div></div>
    ${statsPanel(p)}
    <ul class="moves">${[0,1,2,3].map(i=>`<li>${esc((p.currentMoves||[])[i]||'—')}</li>`).join('')}</ul>
    <div class="card-foot"><span>${esc(p.ability||'특성 미입력')}</span><span>${p.heldItem?esc(p.heldItem):'도구 없음'}</span></div>
  </article>`;
}

function statsPanel(record){
  const used = totalEv(record);
  const rows = STAT_DEFS.map(([key, label]) => {
    const value = statValues(record, key);
    const width = Math.min(100, Math.max(0, value.current / 300 * 100));
    return `<div class="stat-display-row">
      <span class="stat-label">${label}</span>
      <span class="stat-equation"><b>${value.base}</b><i>+${value.ev} EV</i><em>→</em><strong>${value.current}</strong></span>
      <span class="stat-bar"><span style="width:${width}%"></span></span>
    </div>`;
  }).join('');
  return `<section class="stats-panel">
    <div class="stats-panel-title"><span>능력치</span><small>${used} / ${MAX_TOTAL_EV} EV</small></div>
    ${rows}
  </section>`;
}

function changeLevel(id, delta){
  const p = data.find(x => x.id === id);
  if (!p) return;
  p.level = Math.max(1, Math.min(100, (Number(p.level)||1) + delta));
  saveRecord(p);
}

function fillSelect(id, values, selectedValue, emptyLabel){
  const select = $(id);
  const uniqueValues = [...new Set(values.filter(Boolean))];

  if (selectedValue && !uniqueValues.includes(selectedValue)){
    uniqueValues.unshift(selectedValue);
  }

  select.innerHTML = [
    `<option value="">${esc(emptyLabel)}</option>`,
    ...uniqueValues.map(value =>
      `<option value="${esc(value)}"${value === selectedValue ? ' selected' : ''}>${esc(value)}</option>`
    )
  ].join('');
}

function openEditor(id){
  editing = id ? data.find(x => x.id === id) : {
    id:'p'+Date.now(), order:data.length+1, nickname:'', species:'', level:1,
    types:[], ability:'', abilityEffect:'', teraType:'', nature:'', heldItem:'',
    notes:'', currentMoves:[], moves:[], stats: normalizeStats({})
  };
  $('#editorTitle').textContent = id ? '포켓몬 수정' : '포켓몬 추가';
  $('#editId').value = editing.id;
  $('#editNickname').value = editing.nickname || '';
  $('#editSpecies').value = editing.species || '';
  $('#editLevel').value = editing.level || 1;
  $('#editTypes').value = (editing.types || []).join(', ');
  fillSpeciesAbilitySelect(editing.species, editing.ability || '');
  $('#editAbilityEffect').value = editing.abilityEffect || abilityDescription(editing.ability);
  $('#editTera').value = editing.teraType || '';
  $('#editNature').value = editing.nature || '';
  fillSelect('#editItem', items.map(x => x.name), editing.heldItem || '', '도구 없음');
  $('#editItemEffect').value = itemDescription(editing.heldItem);
  $('#editNotes').value = editing.notes || '';
  editing.stats = normalizeStats(editing);
  renderStatsEditor();
  renderMoveInputs();
  renderMoveLibrary();
  $('#deleteButton').style.visibility = id ? 'visible' : 'hidden';
  $('#editor').showModal();
}

function renderStatsEditor(){
  const stats = normalizeStats(editing);
  const level = clampNumber($('#editLevel').value || editing?.level || 1, 1, 100);
  $('#statsEditor').innerHTML = STAT_DEFS.map(([key, label]) => {
    const value = statValues({stats, level}, key);
    return `<div class="stat-editor-row" data-stat="${key}">
      <strong>${label}</strong>
      <input class="stat-base-input" type="number" min="0" max="999" value="${value.base}" inputmode="numeric" aria-label="${label} 기본 능력치">
      <input class="stat-ev-input" type="number" min="0" max="252" step="1" value="${value.ev}" inputmode="numeric" aria-label="${label} 노력치">
      <span class="stat-current-value">${value.current}</span>
    </div>`;
  }).join('');

  $('#statsEditor').querySelectorAll('input').forEach(input => {
    input.addEventListener('input', updateStatsEditor);
    input.addEventListener('change', updateStatsEditor);
  });
  updateStatsEditor();
}

function readStatsEditor(){
  const stats = {};
  $('#statsEditor').querySelectorAll('.stat-editor-row').forEach(row => {
    stats[row.dataset.stat] = {
      base: clampNumber(row.querySelector('.stat-base-input').value, 0, 999),
      ev: clampNumber(row.querySelector('.stat-ev-input').value, 0, MAX_EV_PER_STAT)
    };
  });
  return stats;
}

function updateStatsEditor(){
  const stats = readStatsEditor();
  const level = clampNumber($('#editLevel').value || editing?.level || 1, 1, 100);
  let used = 0;
  $('#statsEditor').querySelectorAll('.stat-editor-row').forEach(row => {
    const value = statValues({stats, level}, row.dataset.stat);
    const evInput = row.querySelector('.stat-ev-input');
    const baseInput = row.querySelector('.stat-base-input');
    if (Number(evInput.value) !== value.ev) evInput.value = value.ev;
    if (Number(baseInput.value) !== value.base) baseInput.value = value.base;
    row.querySelector('.stat-current-value').textContent = value.current;
    used += value.ev;
  });

  const remaining = MAX_TOTAL_EV - used;
  $('#evUsed').textContent = `${used} / ${MAX_TOTAL_EV}`;
  $('#evRemaining').textContent = remaining >= 0 ? `남음 ${remaining}` : `초과 ${Math.abs(remaining)}`;
  const warning = $('#evWarning');
  warning.hidden = used <= MAX_TOTAL_EV;
  warning.textContent = used > MAX_TOTAL_EV ? `총 노력치가 ${used - MAX_TOTAL_EV}만큼 초과됐어요.` : '';
  $('#evUsed').classList.toggle('over', used > MAX_TOTAL_EV);
}

function abilityDescription(name){
  return abilities.find(x => x.name === name)?.description || '';
}
function itemDescription(name){
  if (!name || name === '도구 없음') return '';
  const item = items.find(x => x.name === name);
  if (!item) return '';
  return [item.description, item.price && `가격 ${item.price}`, item.limit && item.limit].filter(Boolean).join(' · ');
}

function currentMoveOptions(){
  return [...new Set(['', ...(editing.moves||[]).map(m=>m.name), ...(editing.currentMoves||[])])];
}

function renderMoveInputs(){
  const options = currentMoveOptions();
  $('#moveSelects').innerHTML = [0,1,2,3].map(i => {
    const selected = (editing.currentMoves || [])[i] || '';
    const detail = moveMap.get(selected);
    return `<div class="move-slot"><select class="move-select"><option value="">— 비움 —</option>${options.filter(Boolean).map(name=>`<option ${name===selected?'selected':''}>${esc(name)}</option>`).join('')}</select><div class="move-detail">${detail ? moveDetail(detail) : ''}</div></div>`;
  }).join('');
  document.querySelectorAll('.move-select').forEach(select => {
    select.onchange = () => {
      const detail = moveMap.get(select.value);
      select.parentElement.querySelector('.move-detail').innerHTML = detail ? moveDetail(detail) : '';
    };
  });
}

function mergedMove(move){
  const full = moveMap.get(move.name) || {};
  return {
    name: move.name,
    type: move.type || full.type || '',
    category: move.category || full.category || '',
    description: move.effect || full.description || '',
    learnMethod: move.method || full.learnMethod || '',
    learnLevel: move.learnLevel || full.learnLevel || '',
    power: move.power || full.power || '',
    accuracy: normalizeAccuracy(move.accuracy || full.accuracy || ''),
    pp: move.pp || full.pp || '',
    priority: move.priority || full.priority || '0'
  };
}
function normalizeAccuracy(value){
  if (value === '' || value == null || value === '-') return '-';
  const text = String(value);
  if (text.includes('%')) return text;
  const number = Number(text);
  if (!Number.isNaN(number) && number > 0 && number <= 1) return `${Math.round(number*100)}%`;
  return text;
}
function moveDetail(move){
  return `<div class="move-meta"><span>${esc(move.type||'-')}</span><span>${esc(move.category||'-')}</span><span>위력 ${esc(move.power||'-')}</span><span>명중 ${esc(normalizeAccuracy(move.accuracy)||'-')}</span><span>PP ${esc(move.pp||'-')}</span></div><p>${esc(move.description||'효과 정보 없음')}</p>`;
}

function renderMoveLibrary(){
  const query = $('#moveSearch').value.trim().toLowerCase();
  const records = (editing.moves || [])
    .map(mergedMove)
    .filter(move => !query || [move.name,move.type,move.category,move.description,move.learnMethod].join(' ').toLowerCase().includes(query));
  $('#moveLibrary').innerHTML = records.map(move => `<div class="move-row"><strong>${esc(move.name)}</strong>${moveDetail(move)}<small>${esc(move.learnMethod||'')} ${move.learnLevel && move.learnLevel !== '-' ? `Lv.${esc(move.learnLevel)}` : ''} · 우선도 ${esc(move.priority||0)}</small></div>`).join('') || '<div class="move-row">검색 결과가 없어요.</div>';
}

function fillSpeciesAbilitySelect(species, selectedValue = ''){
  const catalogRecord = pokemonCatalogByName.get(species);
  const availableAbilities = catalogRecord?.abilities || [];
  fillSelect(
    '#editAbility',
    availableAbilities.length ? availableAbilities : abilities.map(record => record.name),
    selectedValue,
    '특성 선택'
  );
}

function applySpeciesData({notify = true} = {}){
  const species = $('#editSpecies').value.trim();
  const baseRecord = baseStatsByName[species];
  const catalogRecord = pokemonCatalogByName.get(species);
  if (!baseRecord && !catalogRecord) return false;

  if (baseRecord?.stats){
    const current = readStatsEditor();
    STAT_DEFS.forEach(([key]) => {
      current[key].base = clampNumber(baseRecord.stats[key], 0, 999);
    });
    editing.stats = current;
    renderStatsEditor();
  }

  if (catalogRecord){
    $('#editTypes').value = (catalogRecord.types || []).join(', ');
    const currentAbility = $('#editAbility').value.trim();
    const nextAbility = (catalogRecord.abilities || []).includes(currentAbility) ? currentAbility : '';
    fillSpeciesAbilitySelect(species, nextAbility);
    $('#editAbilityEffect').value = abilityDescription(nextAbility);
  } else {
    fillSpeciesAbilitySelect(species, $('#editAbility').value.trim());
  }

  if (notify) say(`${species}의 타입, 특성, 기본 능력치를 반영했어요`);
  return true;
}

$('#editSpecies').addEventListener('input', () => applySpeciesData({notify:false}));
$('#editSpecies').addEventListener('change', () => applySpeciesData({notify:true}));
$('#editLevel').addEventListener('input', updateStatsEditor);
$('#editLevel').addEventListener('change', updateStatsEditor);

$('#editAbility').addEventListener('change', () => {
  $('#editAbilityEffect').value = abilityDescription($('#editAbility').value);
});
$('#editItem').addEventListener('change', () => {
  $('#editItemEffect').value = itemDescription($('#editItem').value);
});

$('#editorForm').onsubmit = event => {
  event.preventDefault();
  const held = $('#editItem').value.trim();
  const stats = readStatsEditor();
  const usedEv = STAT_DEFS.reduce((sum, [key]) => sum + stats[key].ev, 0);
  if (usedEv > MAX_TOTAL_EV){
    say(`노력치는 총 ${MAX_TOTAL_EV}까지만 투자할 수 있어요`);
    return;
  }
  Object.assign(editing, {
    nickname: $('#editNickname').value.trim(),
    species: $('#editSpecies').value.trim(),
    level: Number($('#editLevel').value),
    types: $('#editTypes').value.split(',').map(x=>x.trim()).filter(Boolean),
    ability: $('#editAbility').value.trim(),
    abilityEffect: $('#editAbilityEffect').value.trim(),
    teraType: $('#editTera').value.trim(),
    nature: $('#editNature').value.trim(),
    heldItem: held === '도구 없음' ? '' : held,
    notes: $('#editNotes').value.trim(),
    stats,
    currentMoves: [...document.querySelectorAll('.move-select')].map(x=>x.value).filter(Boolean)
  });
  if (!data.some(x => x.id === editing.id)) data.push(editing);
  saveRecord(editing);
  $('#editor').close();
  say('저장했어요');
};

$('#deleteButton').onclick = async () => {
  if (!confirm('이 포켓몬을 삭제할까요?')) return;
  data = data.filter(x => x.id !== editing.id);
  persist();
  render();
  $('#editor').close();
  if (CONFIG.apiEndpoint){
    try { await api('remove', {id:editing.id}); setSync(true); }
    catch (error){ console.warn(error); setSync(false); }
  }
  say('삭제했어요');
};

$('#closeEditor').onclick = () => $('#editor').close();
$('#addButton').onclick = () => openEditor();
$('#searchInput').oninput = render;
$('#typeFilter').onchange = render;
$('#moveSearch').oninput = renderMoveLibrary;
$('#syncButton').onclick = async () => {
  if (!CONFIG.apiEndpoint) return say('config.js에 Apps Script 주소를 넣어주세요');
  try {
    const result = await api('sync_all', {records:data});
    data = result.records || data;
    persist();
    render();
    setSync(true);
    say('웹과 동기화했어요');
  } catch (error){
    console.warn(error);
    setSync(false);
    say('동기화에 실패했어요');
  }
};

function esc(value){
  return String(value ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

(async () => {
  const select = $('#typeFilter');
  await load();
  types().forEach(type => select.insertAdjacentHTML('beforeend', `<option>${esc(type)}</option>`));
})();
