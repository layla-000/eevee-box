let data = [];
let editing = null;
let abilities = [];
let items = [];
let moveDex = [];
let moveMap = new Map();
let speciesMaster = [];
let speciesMasterByName = new Map();
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
  if (!window.EeveeBackend) throw new Error('Supabase backend missing');
  return window.EeveeBackend.api(action, payload);
}

function setSync(ok){
  $('#syncDot').classList.toggle('online', ok);
  $('#syncText').textContent = ok ? 'Supabase 연결' : 'Supabase 연결 끊김';
}

async function load(){
  setSync(false);
  $('#syncText').textContent = 'Supabase 불러오는 중';
  try {
    const [speciesResult, movesResult, itemsResult, abilitiesResult, pokemonResult] = await Promise.all([
      api('list_species'), api('list_moves'), api('list_items'), api('list_abilities'), api('get_all')
    ]);
    speciesMaster = speciesResult.species || [];
    speciesMasterByName = new Map(speciesMaster.map(record => [record.name, record]));
    moveDex = (movesResult.moves || []).slice().sort((a,b) => a.name.localeCompare(b.name, 'ko'));
    moveMap = new Map(moveDex.map(move => [move.name, move]));
    items = (itemsResult.items || []).slice().sort((a,b) => a.name.localeCompare(b.name, 'ko'));
    abilities = (abilitiesResult.abilities || []).slice().sort((a,b) => a.name.localeCompare(b.name, 'ko'));
    data = pokemonResult.records || [];
    const speciesNames = [...new Set(speciesMaster.map(record => record.name).filter(Boolean))].sort((a,b) => a.localeCompare(b,'ko'));
    $('#speciesList').innerHTML = speciesNames.map(name => `<option value="${esc(name)}"></option>`).join('');
    enhanceSpeciesSearchField();
    setSync(true);
    render();
  } catch (error){
    console.error('Supabase load failed', error);
    setSync(false);
    $('#syncText').textContent = 'Supabase 연결 실패';
    say('Supabase 데이터를 불러오지 못했어요');
    throw error;
  }
}

async function saveRecord(record){
  record.updatedAt = new Date().toISOString();
  try {
    const result = await api('save', {record});
    if (result.record) {
      const index = data.findIndex(item => item.id === record.id);
      if (index >= 0) data[index] = result.record;
      else data.push(result.record);
    }
    setSync(true);
    render();
    return result.record || record;
  } catch (error){
    console.error('Supabase save failed', error);
    setSync(false);
    $('#syncText').textContent = 'Supabase 저장 실패';
    say('저장에 실패했어요');
    throw error;
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
    ${window.EeveeTypeMatchups?.summary(p.types || [], p.teraType || '') || ''}
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
  const uniqueValues = [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'ko'));

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
  const speciesRecord = speciesMasterByName.get(editing.species);
  if ((!editing.moves || !editing.moves.length) && speciesRecord?.learnableMoves?.length){
    editing.moves = speciesRecord.learnableMoves.map(move => ({...move}));
  }
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
  const current = (editing.currentMoves || []).filter(Boolean);
  // Current move slots always use the full move master.
  // Species-specific learnable moves remain available separately in the move library/search.
  const source = [...moveDex.map(move => move.name), ...current];
  return ['', ...[...new Set(source)].sort((a, b) => String(a).localeCompare(String(b), 'ko'))];
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
      const slot = select.closest('.move-slot');
      if (slot) slot.querySelector('.move-detail').innerHTML = detail ? moveDetail(detail) : '';
    };
    enhanceMoveSearchSelect(select);
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
  const baseMoves = editing.moves || [];
  if (!baseMoves.length){
    $('#moveLibrary').innerHTML = '<div class="move-row">이 포켓몬의 학습 가능 기술 데이터가 아직 없어요.</div>';
    return;
  }
  const records = baseMoves
    .map(move => mergedMove(move))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'))
    .filter(move => !query || [move.name,move.type,move.category,move.description,move.learnMethod].join(' ').toLowerCase().includes(query));
  $('#moveLibrary').innerHTML = records.map(move => `<div class="move-row"><strong>${esc(move.name)}</strong>${moveDetail(move)}<small>${esc(move.learnMethod||'')} ${move.learnLevel && move.learnLevel !== '-' ? `Lv.${esc(move.learnLevel)}` : ''} · 우선도 ${esc(move.priority||0)}</small></div>`).join('') || '<div class="move-row">검색 결과가 없어요.</div>';
}


function mainSearchKey(value){
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[·•()\[\]{}._\-/\\]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function injectMainSearchStyles(){
  if (document.getElementById('mainSearchComboboxStyles')) return;
  const style = document.createElement('style');
  style.id = 'mainSearchComboboxStyles';
  style.textContent = `
    .main-search-combobox{position:relative;width:100%;min-width:0}
    .main-search-combobox-input{width:100%;padding-right:38px!important;background:#fff}
    .main-search-combobox.has-value .main-search-combobox-input{font-weight:800}
    .main-search-combobox-input.move-search-input{border-left:6px solid var(--selected-type-color,var(--line))!important}
    .main-search-combobox-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);z-index:3;width:24px;height:24px;padding:0;border:0;background:transparent;color:#71818b;font-size:14px;line-height:1;cursor:pointer}
    .main-search-combobox-list{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:1200;display:none;max-height:300px;overflow:auto;padding:6px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 30px rgba(28,49,63,.16)}
    .main-search-combobox.open .main-search-combobox-list{display:block}
    .main-search-combobox-option{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border:0;border-radius:9px;background:transparent;color:inherit;text-align:left;cursor:pointer}
    .main-search-combobox-option:hover,.main-search-combobox-option.active{background:#f2f6f8}
    .main-search-combobox-option-main{min-width:0;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .main-search-combobox-option-meta{display:flex;gap:5px;align-items:center;justify-content:flex-end;flex-wrap:wrap;flex:0 0 auto;color:#71818b;font-size:12px}
    .main-search-combobox-option-meta .mini-type{padding:2px 7px;border-radius:999px;background:color-mix(in srgb,var(--mini-type-color) 18%,#fff);color:color-mix(in srgb,var(--mini-type-color) 72%,#263238);font-weight:800}
    .main-search-combobox-empty{padding:12px 10px;color:#8998a1;font-size:13px}
    .main-search-combobox-source{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;clip:rect(0 0 0 0)!important}
    @media(max-width:700px){.main-search-combobox-list{max-height:250px}.main-search-combobox-option{padding:10px 9px}.main-search-combobox-option-meta{font-size:11px}}
  `;
  document.head.appendChild(style);
}

function typeColorFor(type){
  return window.EeveeBoxTypeColors?.colors?.[type] || '#9aa7ad';
}

function renderMainSearchOption(button, label, types = [], metaText = ''){
  const main = document.createElement('span');
  main.className = 'main-search-combobox-option-main';
  main.textContent = label;
  button.appendChild(main);
  if (!types.length && !metaText) return;
  const aside = document.createElement('span');
  aside.className = 'main-search-combobox-option-meta';
  types.forEach(type => {
    const pill = document.createElement('span');
    pill.className = 'mini-type';
    pill.textContent = type;
    pill.style.setProperty('--mini-type-color', typeColorFor(type));
    aside.appendChild(pill);
  });
  if (metaText){
    const text = document.createElement('span');
    text.textContent = metaText;
    aside.appendChild(text);
  }
  button.appendChild(aside);
}

function enhanceSpeciesSearchField(){
  const input = $('#editSpecies');
  if (!input || input.dataset.searchComboboxBound === 'true') return;
  injectMainSearchStyles();
  input.dataset.searchComboboxBound = 'true';
  input.removeAttribute('list');
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.classList.add('main-search-combobox-input');
  input.placeholder = '포켓몬 종류 검색';

  const wrapper = document.createElement('div');
  wrapper.className = 'main-search-combobox';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'main-search-combobox-toggle';
  toggle.textContent = '▾';
  toggle.setAttribute('aria-label', '포켓몬 후보 목록 열기');
  toggle.tabIndex = -1;
  const list = document.createElement('div');
  list.className = 'main-search-combobox-list';
  list.setAttribute('role', 'listbox');
  wrapper.append(toggle, list);

  let shown = [];
  let activeIndex = -1;
  const records = () => speciesMaster
    .filter(record => record?.name)
    .map(record => ({name:record.name, types:Array.isArray(record.types) ? record.types : []}));

  function closeList(){
    wrapper.classList.remove('open');
    input.setAttribute('aria-expanded','false');
    activeIndex = -1;
  }
  function setActive(index){
    const buttons = [...list.querySelectorAll('.main-search-combobox-option')];
    if (!buttons.length){activeIndex=-1;return;}
    activeIndex=((index%buttons.length)+buttons.length)%buttons.length;
    buttons.forEach((button,idx)=>button.classList.toggle('active',idx===activeIndex));
    buttons[activeIndex]?.scrollIntoView({block:'nearest'});
  }
  function choose(record){
    if (!record) return;
    input.value = record.name;
    wrapper.classList.add('has-value');
    closeList();
    input.dispatchEvent(new Event('change',{bubbles:true}));
    requestAnimationFrame(()=>{
      input.focus({preventScroll:true});
      input.setSelectionRange?.(input.value.length,input.value.length);
    });
  }
  function filtered(query){
    const key=mainSearchKey(query);
    const all=records();
    if (!key) return all.slice(0,60);
    const starts=[], contains=[];
    all.forEach(record=>{
      const nameKey=mainSearchKey(record.name);
      const combined=mainSearchKey(`${record.name} ${record.types.join(' ')}`);
      if (nameKey.startsWith(key)) starts.push(record);
      else if (combined.includes(key)) contains.push(record);
    });
    return [...starts,...contains].slice(0,60);
  }
  function renderList(query=input.value){
    shown=filtered(query);
    list.innerHTML='';
    activeIndex=-1;
    if (!shown.length){
      const empty=document.createElement('div');
      empty.className='main-search-combobox-empty';
      empty.textContent='일치하는 포켓몬이 없어요.';
      list.appendChild(empty);
    } else {
      shown.forEach((record,index)=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='main-search-combobox-option';
        renderMainSearchOption(button,record.name,record.types,'');
        button.addEventListener('mousedown',event=>event.preventDefault());
        button.addEventListener('click',()=>choose(record));
        list.appendChild(button);
        if(index===0)setActive(0);
      });
    }
    wrapper.classList.add('open');
    input.setAttribute('aria-expanded','true');
  }
  input.setAttribute('role','combobox');
  input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-expanded','false');
  input.addEventListener('focus',()=>renderList(speciesMasterByName.has(input.value.trim()) ? '' : input.value));
  input.addEventListener('click',()=>renderList(speciesMasterByName.has(input.value.trim()) ? '' : input.value));
  input.addEventListener('input',()=>{wrapper.classList.toggle('has-value',speciesMasterByName.has(input.value.trim()));renderList(input.value);});
  input.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'){event.preventDefault();if(!wrapper.classList.contains('open'))renderList(input.value);setActive(activeIndex+1);}
    else if(event.key==='ArrowUp'){event.preventDefault();if(!wrapper.classList.contains('open'))renderList(input.value);setActive(activeIndex-1);}
    else if(event.key==='Enter'&&wrapper.classList.contains('open')){event.preventDefault();choose(shown[Math.max(0,activeIndex)]);}
    else if(event.key==='Escape'){event.preventDefault();closeList();}
  });
  input.addEventListener('blur',()=>setTimeout(()=>{if(!wrapper.contains(document.activeElement))closeList();},80));
  toggle.addEventListener('mousedown',event=>event.preventDefault());
  toggle.addEventListener('click',()=>{if(wrapper.classList.contains('open'))closeList();else{input.focus();renderList('');}});
}

function enhanceMoveSearchSelect(select){
  if (!select || select.dataset.searchComboboxBound === 'true') return;
  injectMainSearchStyles();
  select.dataset.searchComboboxBound = 'true';

  const wrapper=document.createElement('div');
  wrapper.className='main-search-combobox';
  const input=document.createElement('input');
  input.type='text';
  input.autocomplete='off';
  input.spellcheck=false;
  input.className='main-search-combobox-input move-search-input';
  input.placeholder='기술 이름 검색';
  input.setAttribute('role','combobox');
  input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-expanded','false');
  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.className='main-search-combobox-toggle';
  toggle.textContent='▾';
  toggle.setAttribute('aria-label','기술 후보 목록 열기');
  toggle.tabIndex=-1;
  const list=document.createElement('div');
  list.className='main-search-combobox-list';
  list.setAttribute('role','listbox');

  select.parentNode.insertBefore(wrapper,select);
  wrapper.append(input,toggle,list,select);
  select.classList.add('main-search-combobox-source');

  let shown=[];
  let activeIndex=-1;
  function records(){
    return [...select.options].filter(option=>option.value).map(option=>{
      const move=moveMap.get(option.value);
      return {value:option.value,label:String(option.textContent||'').trim(),move};
    });
  }
  function selectedLabel(){const option=select.options[select.selectedIndex];return option?.value ? String(option.textContent||'').trim() : '';}
  function updateColor(){
    const type=moveMap.get(select.value)?.type;
    input.style.setProperty('--selected-type-color',type ? typeColorFor(type) : 'var(--line)');
  }
  function syncFromSelect(){input.value=selectedLabel();wrapper.classList.toggle('has-value',Boolean(select.value));updateColor();}
  function closeList(){wrapper.classList.remove('open');input.setAttribute('aria-expanded','false');activeIndex=-1;}
  function setActive(index){
    const buttons=[...list.querySelectorAll('.main-search-combobox-option')];
    if(!buttons.length){activeIndex=-1;return;}
    activeIndex=((index%buttons.length)+buttons.length)%buttons.length;
    buttons.forEach((button,idx)=>button.classList.toggle('active',idx===activeIndex));
    buttons[activeIndex]?.scrollIntoView({block:'nearest'});
  }
  function choose(record){
    if(!record)return;
    select.value=record.value;
    syncFromSelect();
    closeList();
    select.dispatchEvent(new Event('change',{bubbles:true}));
    requestAnimationFrame(()=>{syncFromSelect();input.focus({preventScroll:true});input.setSelectionRange?.(input.value.length,input.value.length);});
  }
  function filtered(query){
    const key=mainSearchKey(query);
    const all=records();
    if(!key)return all.slice(0,60);
    const starts=[],contains=[];
    all.forEach(record=>{
      const move=record.move||{};
      const labelKey=mainSearchKey(record.label);
      const combined=mainSearchKey(`${record.label} ${move.type||''} ${move.category||''} ${move.power||''} ${move.description||''}`);
      if(labelKey.startsWith(key))starts.push(record);else if(combined.includes(key))contains.push(record);
    });
    return [...starts,...contains].slice(0,60);
  }
  function renderList(query=input.value){
    shown=filtered(query);list.innerHTML='';activeIndex=-1;
    if(!shown.length){const empty=document.createElement('div');empty.className='main-search-combobox-empty';empty.textContent='일치하는 기술이 없어요.';list.appendChild(empty);}
    else shown.forEach((record,index)=>{
      const move=record.move||{};
      const button=document.createElement('button');button.type='button';button.className='main-search-combobox-option';
      const meta=[move.category,move.power?`위력 ${move.power}`:''].filter(Boolean).join(' · ');
      renderMainSearchOption(button,record.label,move.type?[move.type]:[],meta);
      button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>choose(record));list.appendChild(button);if(index===0)setActive(0);
    });
    wrapper.classList.add('open');input.setAttribute('aria-expanded','true');
  }
  input.addEventListener('focus',()=>renderList(input.value===selectedLabel()?'':input.value));
  input.addEventListener('click',()=>renderList(input.value===selectedLabel()?'':input.value));
  input.addEventListener('input',()=>renderList(input.value));
  input.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'){event.preventDefault();if(!wrapper.classList.contains('open'))renderList(input.value);setActive(activeIndex+1);}
    else if(event.key==='ArrowUp'){event.preventDefault();if(!wrapper.classList.contains('open'))renderList(input.value);setActive(activeIndex-1);}
    else if(event.key==='Enter'&&wrapper.classList.contains('open')){event.preventDefault();choose(shown[Math.max(0,activeIndex)]);}
    else if(event.key==='Escape'){event.preventDefault();syncFromSelect();closeList();}
  });
  input.addEventListener('blur',()=>setTimeout(()=>{
    if(!wrapper.contains(document.activeElement)){
      const exact=records().find(record=>mainSearchKey(record.label)===mainSearchKey(input.value));
      if(exact&&exact.value!==select.value)choose(exact);else syncFromSelect();
      closeList();
    }
  },80));
  toggle.addEventListener('mousedown',event=>event.preventDefault());
  toggle.addEventListener('click',()=>{if(wrapper.classList.contains('open'))closeList();else{input.focus();renderList('');}});
  select.addEventListener('change',syncFromSelect);
  syncFromSelect();
}

function fillSpeciesAbilitySelect(species, selectedValue = ''){
  const masterRecord = speciesMasterByName.get(species);
  const availableAbilities = masterRecord?.abilities || [];
  fillSelect(
    '#editAbility',
    availableAbilities.length ? availableAbilities : abilities.map(record => record.name),
    selectedValue,
    '특성 선택'
  );
}

function applySpeciesData({notify = true} = {}){
  const species = $('#editSpecies').value.trim();
  const masterRecord = speciesMasterByName.get(species);
  if (!masterRecord) return false;

  if (masterRecord.baseStats && Object.keys(masterRecord.baseStats).length){
    const current = readStatsEditor();
    STAT_DEFS.forEach(([key]) => {
      current[key].base = clampNumber(masterRecord.baseStats[key] ?? current[key].base, 0, 999);
    });
    editing.stats = current;
    renderStatsEditor();
  }

  const autoTypes = masterRecord.types || [];
  editing.types = [...autoTypes];
  $('#editTypes').value = autoTypes.join(', ');

  const currentAbility = $('#editAbility').value.trim();
  const availableAbilities = masterRecord.abilities || [];
  const nextAbility = !availableAbilities.length || availableAbilities.includes(currentAbility) ? currentAbility : '';
  fillSpeciesAbilitySelect(species, nextAbility);
  $('#editAbilityEffect').value = abilityDescription(nextAbility);

  editing.moves = (masterRecord.learnableMoves || []).map(move => ({...move}));
  editing.currentMoves = (editing.currentMoves || []).filter(Boolean);
  renderMoveInputs();
  renderMoveLibrary();

  if (notify) say(`${species}의 타입, 특성, 기본 능력치와 기술 목록을 반영했어요`);
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

$('#editorForm').onsubmit = async event => {
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
  try {
    await saveRecord(editing);
    $('#editor').close();
    say('Supabase에 저장했어요');
  } catch (_) {}
};

$('#deleteButton').onclick = async () => {
  if (!confirm('이 포켓몬을 삭제할까요?')) return;
  try {
    await api('remove', {id:editing.id});
    data = data.filter(x => x.id !== editing.id);
    render();
    $('#editor').close();
    setSync(true);
    say('Supabase에서 삭제했어요');
  } catch (error){
    console.error(error);
    setSync(false);
    say('삭제에 실패했어요');
  }
};

$('#closeEditor').onclick = () => $('#editor').close();
$('#addButton').onclick = () => openEditor();
$('#searchInput').oninput = render;
$('#typeFilter').onchange = render;
$('#moveSearch').oninput = renderMoveLibrary;

function esc(value){
  return String(value ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

(async () => {
  injectMainSearchStyles();
  const select = $('#typeFilter');
  await window.EeveeAuth.ready;
  await load();
  types().forEach(type => select.insertAdjacentHTML('beforeend', `<option>${esc(type)}</option>`));
})();
