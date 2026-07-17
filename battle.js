const CONFIG = window.EEVEE_BOX_CONFIG || {};
const POKEMON_KEY = 'EEVEE_BOX_DATA_V1';
const BATTLE_KEY = 'EEVEE_BOX_BATTLE_V1';

let pokemon = [];
let battle = emptyBattle();

const $ = selector => document.querySelector(selector);
const toast = $('#toast');

function emptyBattle(){
  return {
    id: 'current_3v3',
    title: '',
    myTeam: ['', '', ''],
    opponentTeam: [emptyOpponent(), emptyOpponent(), emptyOpponent()],
    notes: '',
    updatedAt: ''
  };
}

function emptyOpponent(){
  return {name:'', level:'', types:'', ability:'', item:'', moves:''};
}

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
  if (!CONFIG.apiEndpoint) throw new Error('API endpoint missing');

  const response = await fetch(CONFIG.apiEndpoint, {
    method: 'POST',
    headers: {'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({action, ...payload}),
    redirect: 'follow'
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`API HTTP ${response.status}: ${text.slice(0,160)}`);

  let result;
  try {
    result = JSON.parse(text);
  } catch (_) {
    throw new Error(`API가 JSON 대신 다른 응답을 반환했어요: ${text.slice(0,160)}`);
  }
  if (!result.ok) throw new Error(result.error || 'API error');
  return result;
}

async function load(){
  setSync(false, '불러오는 중');

  const localPokemon = JSON.parse(localStorage.getItem(POKEMON_KEY) || 'null');
  if (Array.isArray(localPokemon)) {
    pokemon = localPokemon;
  } else {
    pokemon = await fetch('pokemon-data.json').then(r => r.json());
  }

  const localBattle = JSON.parse(localStorage.getItem(BATTLE_KEY) || 'null');
  if (localBattle) battle = normalizeBattle(localBattle);

  if (CONFIG.apiEndpoint){
    try {
      const [pokemonResult, battleResult] = await Promise.all([
        api('get_all'),
        api('get_battle')
      ]);
      if (pokemonResult.records?.length) pokemon = pokemonResult.records;
      if (battleResult.battle) battle = normalizeBattle(battleResult.battle);
      localStorage.setItem(POKEMON_KEY, JSON.stringify(pokemon));
      localStorage.setItem(BATTLE_KEY, JSON.stringify(battle));
      setSync(true);
    } catch (error){
      console.warn(error);
      setSync(false);
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
      .map(item => ({...emptyOpponent(), ...(item || {})}))
  };
}

function render(){
  $('#battleTitle').value = battle.title || '';
  $('#battleNotes').value = battle.notes || '';

  renderMyTeam();
  renderOpponentTeam();
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

  const moves = (record.currentMoves || []).filter(Boolean);
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
    <dl class="preview-data">
      <div><dt>특성</dt><dd>${escapeHtml(record.ability || '—')}</dd></div>
      <div><dt>도구</dt><dd>${escapeHtml(record.heldItem || '없음')}</dd></div>
    </dl>
    <div class="preview-moves">${moves.length ? moves.map(move => `<span>${escapeHtml(move)}</span>`).join('') : '<em>현재 기술 없음</em>'}</div>
  `;
}

function renderOpponentTeam(){
  const container = $('#opponentTeam');
  container.innerHTML = '';

  for (let index = 0; index < 3; index += 1){
    const fragment = $('#opponentSlotTemplate').content.cloneNode(true);
    const slot = fragment.querySelector('.battle-slot');
    fragment.querySelector('.slot-number').textContent = index + 1;
    const record = battle.opponentTeam[index];

    const fields = {
      '.opp-name':'name',
      '.opp-level':'level',
      '.opp-types':'types',
      '.opp-ability':'ability',
      '.opp-item':'item',
      '.opp-moves':'moves'
    };

    Object.entries(fields).forEach(([selector, key]) => {
      const input = fragment.querySelector(selector);
      input.value = record[key] ?? '';
      input.addEventListener('input', () => {
        battle.opponentTeam[index][key] = input.value;
        persistLocal();
        updateCounts();
      });
    });

    container.appendChild(fragment);
  }
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

async function saveBattle(){
  readPageValues();
  localStorage.setItem(BATTLE_KEY, JSON.stringify(battle));

  if (!CONFIG.apiEndpoint){
    setSync(false);
    say('로컬에 저장했어요');
    return;
  }

  try {
    const result = await api('save_battle', {battle});
    if (result.battle) battle = normalizeBattle(result.battle);
    localStorage.setItem(BATTLE_KEY, JSON.stringify(battle));
    setSync(true);
    say('배틀 구성을 저장했어요');
  } catch (error){
    console.warn(error);
    setSync(false);
    say('웹 저장 실패 · 로컬에는 저장됐어요');
  }
}

function clearBattle(){
  if (!confirm('현재 3:3 배틀 구성을 모두 비울까요?')) return;
  battle = emptyBattle();
  localStorage.setItem(BATTLE_KEY, JSON.stringify(battle));
  render();
  say('배틀 구성을 비웠어요');
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
$('#battleTitle').addEventListener('input', persistLocal);
$('#battleNotes').addEventListener('input', persistLocal);

load().catch(error => {
  console.error(error);
  setSync(false);
  say('페이지를 불러오지 못했어요');
});
