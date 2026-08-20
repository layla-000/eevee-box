(() => {
  const COST = { ability: 8000, ev: 2000, tera: 3000 };
  const LEVEL_TIERS = [
    { from: 1,  to: 21,  rate: 200 },
    { from: 21, to: 61,  rate: 400 },
    { from: 61, to: 81,  rate: 500 },
    { from: 81, to: 100, rate: 500 } // 임시 단가
  ];

  let pokemon = [];
  let items = [];
  let nextId = 1;
  let globalTools = { 3000: 0, 5000: 0, 7000: 0 };

  const $ = id => document.getElementById(id);
  const won = n => `${Number(n || 0).toLocaleString('ko-KR')}원`;
  const clamp = (v, min, max) =>
    Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Math.floor(Number(v)) : min));
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[ch]));

  const koreanCollator = new Intl.Collator('ko-KR', {
    usage: 'sort',
    sensitivity: 'base',
    numeric: true
  });

  function pokemonSortName(record) {
    return record.nickname || record.species || '';
  }

  function sortPokemonAlphabetically(records) {
    return records.slice().sort((a, b) => {
      const first = koreanCollator.compare(pokemonSortName(a), pokemonSortName(b));
      if (first !== 0) return first;
      return koreanCollator.compare(a.species || '', b.species || '');
    });
  }

  function levelBreakdown(current, target) {
    current = clamp(current, 1, 100);
    target = clamp(target, 1, 100);
    if (target <= current) return { total: 0, tiers: [] };

    const used = LEVEL_TIERS.map(t => ({ ...t, count: 0, cost: 0 }));
    for (let next = current + 1; next <= target; next++) {
      const i = next <= 21 ? 0 : next <= 61 ? 1 : next <= 81 ? 2 : 3;
      used[i].count++;
    }
    used.forEach(t => t.cost = t.count * t.rate);
    const tiers = used.filter(t => t.count);
    return { total: tiers.reduce((sum, t) => sum + t.cost, 0), tiers };
  }

  function newItem() {
    return {
      id: nextId++,
      selectedPokemonId: '',
      currentLevel: 1,
      targetLevel: 100,
      ability: false,
      ev: false,
      tera: false,
      move2000: 0,
      move3000: 0,
      move5000: 0
    };
  }

  function itemById(id) {
    return items.find(x => x.id === Number(id));
  }

  function selectedRecord(item) {
    return pokemon.find(r => String(r.id) === String(item.selectedPokemonId)) || null;
  }

  function moveCount(item) {
    return item.move2000 + item.move3000 + item.move5000;
  }

  function moveCost(item) {
    return item.move2000 * 2000 + item.move3000 * 3000 + item.move5000 * 5000;
  }

  function costs(item) {
    const level = levelBreakdown(item.currentLevel, item.targetLevel);
    const ability = item.ability ? COST.ability : 0;
    const moves = moveCost(item);
    const ev = item.ev ? COST.ev : 0;
    const tera = item.tera ? COST.tera : 0;
    return {
      level, ability, moves, ev, tera,
      total: level.total + ability + moves + ev + tera
    };
  }

  function displayName(item, index) {
    const r = selectedRecord(item);
    return r ? (r.nickname || r.species || `포켓몬 ${index + 1}`) : `포켓몬 ${index + 1}`;
  }

  function pokemonOptions(selectedId) {
    return [
      '<option value="">포켓몬을 선택해 주세요</option>',
      ...pokemon.map(r => {
        const name = r.nickname || r.species || '이름 없음';
        const species = r.nickname && r.species ? ` (${r.species})` : '';
        const level = ` · Lv.${r.level || 1}`;
        const selected = String(r.id) === String(selectedId) ? ' selected' : '';
        return `<option value="${esc(r.id)}"${selected}>${esc(name + species + level)}</option>`;
      })
    ].join('');
  }

  function moveRow(item, price, field) {
    return `
      <div class="training-move-price-row">
        <span><strong>${price.toLocaleString('ko-KR')}원</strong> 기술</span>
        <div class="training-stepper">
          <button type="button" data-action="step-move" data-item-id="${item.id}" data-move-key="${field}" data-delta="-1" aria-label="${price}원 기술 하나 줄이기">−</button>
          <input
            class="training-stepper-count"
            type="number"
            min="0"
            max="4"
            step="1"
            value="${item[field]}"
            inputmode="numeric"
            data-field="${field}"
            data-item-id="${item.id}"
            aria-label="${price}원 기술 수량"
          />
          <button type="button" data-action="step-move" data-item-id="${item.id}" data-move-key="${field}" data-delta="1" aria-label="${price}원 기술 하나 늘리기">+</button>
        </div>
      </div>`;
  }

  function itemHtml(item, index) {
    const r = selectedRecord(item);
    const c = costs(item);
    const mc = moveCount(item);

    const detail = r ? `
      <div class="selected-training-pokemon">
        <strong>${esc(r.nickname || r.species || '')}</strong>
        <span>${esc(r.species || '')} · 현재 Lv.${r.level || 1}</span>
      </div>` : '';

    const tiers = c.level.tiers.length
      ? c.level.tiers.map(t => `
          <div class="level-tier-row">
            <span>Lv.${Math.max(item.currentLevel, t.from)} → ${Math.min(item.targetLevel, t.to)} · ${t.count}레벨 × ${t.rate.toLocaleString('ko-KR')}원</span>
            <strong>${won(t.cost)}</strong>
          </div>`).join('')
      : '<div class="level-tier-row"><span>추가 레벨업 없음</span><strong>0원</strong></div>';

    return `
      <article class="training-pokemon-card" data-item-id="${item.id}">
        <div class="training-pokemon-card-head">
          <div>
            <span class="training-pokemon-number">#${index + 1}</span>
            <h3>${esc(displayName(item, index))}</h3>
          </div>
          ${items.length > 1
            ? `<button class="training-remove-button" type="button" data-action="remove-item" data-item-id="${item.id}">삭제</button>`
            : ''}
        </div>

        <label class="training-field">
          <span>내 포켓몬 불러오기 <small>가나다순</small></span>
          <select class="training-pokemon-select" data-field="selectedPokemonId" data-item-id="${item.id}">
            ${pokemonOptions(item.selectedPokemonId)}
          </select>
        </label>

        ${detail}

        <div class="training-level-row">
          <label class="training-field">
            <span>현재 레벨</span>
            <div class="level-input-wrap">
              <span>Lv.</span>
              <input type="number" min="1" max="100" value="${item.currentLevel}" inputmode="numeric"
                data-field="currentLevel" data-item-id="${item.id}" />
            </div>
          </label>
          <div class="training-arrow">→</div>
          <label class="training-field">
            <span>목표 레벨</span>
            <div class="level-input-wrap">
              <span>Lv.</span>
              <input type="number" min="1" max="100" value="${item.targetLevel}" inputmode="numeric"
                data-field="targetLevel" data-item-id="${item.id}" />
            </div>
          </label>
        </div>

        ${item.targetLevel < item.currentLevel
          ? '<div class="training-inline-notice">목표 레벨이 현재 레벨보다 낮아서 레벨업 비용은 0원으로 계산해요.</div>'
          : ''}

        <div class="training-divider"></div>

        <div class="training-options-grid">
          <label class="training-option-card">
            <input type="checkbox" ${item.ability ? 'checked' : ''} data-field="ability" data-item-id="${item.id}" />
            <span class="training-option-check"></span>
            <span class="training-option-copy"><strong>특성 변경</strong><small>필요할 때 한 번 적용</small></span>
            <span class="training-option-price">+8,000원</span>
          </label>

          <label class="training-option-card">
            <input type="checkbox" ${item.ev ? 'checked' : ''} data-field="ev" data-item-id="${item.id}" />
            <span class="training-option-check"></span>
            <span class="training-option-copy"><strong>노력치 분배</strong><small>1회 비용</small></span>
            <span class="training-option-price">+2,000원</span>
          </label>

          <label class="training-option-card">
            <input type="checkbox" ${item.tera ? 'checked' : ''} data-field="tera" data-item-id="${item.id}" />
            <span class="training-option-check"></span>
            <span class="training-option-copy"><strong>테라스탈 구매</strong><small>테라 타입 육성 비용</small></span>
            <span class="training-option-price">+3,000원</span>
          </label>
        </div>

        <div class="training-move-box">
          <div class="training-move-head">
            <div><strong>기술 구매</strong><small>가격대별로 최대 4개까지</small></div>
            <span>${mc} / 4개 · ${won(c.moves)}</span>
          </div>
          ${moveRow(item, 2000, 'move2000')}
          ${moveRow(item, 3000, 'move3000')}
          ${moveRow(item, 5000, 'move5000')}
        </div>

        <details class="training-item-breakdown">
          <summary><span>이 포켓몬 상세 비용</span><strong>${won(c.total)}</strong></summary>
          <div class="training-breakdown">
            <div class="training-breakdown-row main"><span>레벨업</span><strong>${won(c.level.total)}</strong></div>
            <div class="level-tier-breakdown">${tiers}</div>
            <div class="training-breakdown-row"><span>특성 변경</span><strong>${won(c.ability)}</strong></div>
            <div class="training-breakdown-row"><span>기술 구매 <small>${mc}개</small></span><strong>${won(c.moves)}</strong></div>
            <div class="training-breakdown-row"><span>노력치 분배</span><strong>${won(c.ev)}</strong></div>
            <div class="training-breakdown-row"><span>테라스탈 구매</span><strong>${won(c.tera)}</strong></div>
          </div>
        </details>
      </article>`;
  }

  function globalToolCost() {
    return Object.entries(globalTools)
      .reduce((sum, [price, count]) => sum + Number(price) * Number(count || 0), 0);
  }

  function globalToolCount() {
    return Object.values(globalTools)
      .reduce((sum, count) => sum + Number(count || 0), 0);
  }

  function syncGlobalToolInputs() {
    [3000, 5000, 7000].forEach(price => {
      const input = $(`tool${price}`);
      if (input) input.value = globalTools[price];
    });
    const sub = $('globalToolsSubtotal');
    if (sub) sub.textContent = won(globalToolCost());
  }

  function render() {
    $('trainingPokemonList').innerHTML = items.map(itemHtml).join('');

    const pokemonRows = items.map((item, i) => `
      <div class="training-result-row">
        <span><b>#${i + 1}</b> ${esc(displayName(item, i))}</span>
        <strong>${won(costs(item).total)}</strong>
      </div>`).join('');

    const toolCost = globalToolCost();
    const toolCount = globalToolCount();
    const toolRow = toolCount
      ? `<div class="training-result-row training-result-tools">
           <span><b>도구</b> 공용 도구 ${toolCount}개</span>
           <strong>${won(toolCost)}</strong>
         </div>`
      : '';

    $('trainingResultList').innerHTML = pokemonRows + toolRow;

    const pokemonTotal = items.reduce((sum, item) => sum + costs(item).total, 0);
    const total = pokemonTotal + toolCost;
    $('grandTotalCost').textContent = won(total);
    $('grandTotalSummary').textContent =
      `${items.length}마리${toolCount ? ` · 도구 ${toolCount}개` : ''} · 합계 ${won(total)}`;

    syncGlobalToolInputs();
  }

  function normalizeMoves(item, changed) {
    item.move2000 = clamp(item.move2000, 0, 4);
    item.move3000 = clamp(item.move3000, 0, 4);
    item.move5000 = clamp(item.move5000, 0, 4);
    const over = moveCount(item) - 4;
    if (over > 0) item[changed] = Math.max(0, item[changed] - over);
  }

  function selectPokemonById(item, id) {
    item.selectedPokemonId = id || '';
    const r = selectedRecord(item);
    if (r) {
      item.currentLevel = clamp(r.level || 1, 1, 100);
      if (item.targetLevel < item.currentLevel) item.targetLevel = 100;
    }
    render();
  }

  function bind() {
    $('addTrainingPokemon').addEventListener('click', () => {
      items.push(newItem());
      render();
    });

    $('resetTraining').addEventListener('click', () => {
      nextId = 1;
      items = [newItem()];
      globalTools = { 3000: 0, 5000: 0, 7000: 0 };
      render();
    });

    $('trainingPokemonList').addEventListener('input', e => {
      const id = e.target.dataset.itemId;
      const field = e.target.dataset.field;
      if (!id || !field) return;
      const item = itemById(id);
      if (!item) return;

      if (field === 'currentLevel' || field === 'targetLevel') {
        item[field] = clamp(e.target.value, 1, 100);
        render();
        return;
      }

      if (field.startsWith('move')) {
        item[field] = clamp(e.target.value, 0, 4);
        normalizeMoves(item, field);
        render();
      }
    });

    $('trainingPokemonList').addEventListener('change', e => {
      const id = e.target.dataset.itemId;
      const field = e.target.dataset.field;
      if (!id || !field) return;
      const item = itemById(id);
      if (!item) return;

      if (field === 'selectedPokemonId') {
        selectPokemonById(item, e.target.value);
        return;
      }

      if (['ability', 'ev', 'tera'].includes(field)) {
        item[field] = e.target.checked;
        render();
      }
    });

    $('trainingPokemonList').addEventListener('click', e => {
      const button = e.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      if (action === 'remove-item') {
        if (items.length > 1) {
          items = items.filter(x => x.id !== Number(button.dataset.itemId));
          render();
        }
        return;
      }

      const item = itemById(button.dataset.itemId);
      if (!item) return;

      if (action === 'step-move') {
        const field = button.dataset.moveKey;
        item[field] = clamp(item[field] + Number(button.dataset.delta || 0), 0, 4);
        normalizeMoves(item, field);
        render();
      }
    });

    document.querySelector('.training-global-tools')?.addEventListener('input', e => {
      const price = Number(e.target.dataset.toolPrice);
      if (!price) return;
      globalTools[price] = clamp(e.target.value, 0, 99);
      render();
    });

    document.querySelector('.training-global-tools')?.addEventListener('click', e => {
      const button = e.target.closest('[data-tool-action="step"]');
      if (!button) return;
      const price = Number(button.dataset.toolPrice);
      const delta = Number(button.dataset.delta || 0);
      globalTools[price] = clamp((globalTools[price] || 0) + delta, 0, 99);
      render();
    });
  }

  async function loadPokemon() {
    const dot = $('trainingSyncDot');
    const text = $('trainingSyncText');

    try {
      await window.EeveeAuth?.ready;
      if (!window.EeveeBackend?.api) throw new Error('Supabase backend missing');

      const result = await window.EeveeBackend.api('get_all');
      pokemon = sortPokemonAlphabetically(result.records || []);

      dot?.classList.add('online');
      if (text) text.textContent = `${pokemon.length}마리 · 가나다순`;
      render();
    } catch (err) {
      console.error('육성 계산기 포켓몬 불러오기 실패', err);
      dot?.classList.remove('online');
      if (text) text.textContent = '포켓몬 불러오기 실패';
    }
  }

  function init() {
    items = [newItem()];
    bind();
    render();
    loadPokemon();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
