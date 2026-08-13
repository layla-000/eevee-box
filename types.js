(() => {
  const api = window.EeveeTypeMatchups;
  if (!api) return;

  const TYPES = api.TYPES;
  const type1Select = document.getElementById('type1Select');
  const type2Select = document.getElementById('type2Select');
  const quickGrid = document.getElementById('typeQuickGrid');
  const result = document.getElementById('typeResult');
  const clearType2 = document.getElementById('clearType2');

  function esc(value){
    return String(value ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  }

  function pill(type){
    return `<span class="type-pill type-colored" data-type="${esc(type)}">${esc(type)}</span>`;
  }

  function typePills(types){
    return (types || []).map(pill).join('');
  }

  function groupRow(label, list, tone){
    if (!list?.length) return '';
    return `<div class="type-result-row ${tone}"><strong>${label}</strong><div>${typePills(list)}</div></div>`;
  }

  function defenseCard(types){
    const groups = api.defense(types);
    return `<article class="type-detail-card defense-card">
      <div class="type-detail-head"><div><span class="types-kicker">DEFENSE</span><h3>공격받을 때</h3></div><span>${esc(types.join(' / '))}</span></div>
      ${groupRow('×4 약점', groups[4], 'danger-strong')}
      ${groupRow('×2 약점', groups[2], 'danger')}
      ${groupRow('×0 무효', groups[0], 'immune')}
      ${groupRow('×¼ 반감', groups[0.25], 'resist-strong')}
      ${groupRow('×½ 반감', groups[0.5], 'resist')}
      <details class="type-neutral-row"><summary>×1 보통 <span>${groups[1]?.length || 0}개 타입</span></summary><div>${typePills(groups[1])}</div></details>
    </article>`;
  }

  function offenseCard(type){
    const groups = api.offenseForType(type);
    return `<article class="type-detail-card offense-card">
      <div class="type-detail-head"><div><span class="types-kicker">OFFENSE</span><h3>${esc(type)} 공격</h3></div>${pill(type)}</div>
      ${groupRow('×2 강점', groups[2], 'attack-strong')}
      ${groupRow('×½ 반감', groups[0.5], 'attack-resist')}
      ${groupRow('×0 무효', groups[0], 'immune')}
      <details class="type-neutral-row"><summary>×1 보통 <span>${groups[1]?.length || 0}개 타입</span></summary><div>${typePills(groups[1])}</div></details>
    </article>`;
  }

  function render(){
    const type1 = type1Select.value;
    const type2 = type2Select.value && type2Select.value !== type1 ? type2Select.value : '';
    if (type2Select.value === type1) type2Select.value = '';
    const selected = [type1, type2].filter(Boolean);

    quickGrid.querySelectorAll('[data-pick-type]').forEach(button => {
      button.classList.toggle('active', button.dataset.pickType === type1);
    });

    result.innerHTML = `<div class="type-result-heading">
      <div><span class="types-kicker">SELECTED TYPE</span><h2>${selected.map(esc).join(' / ')}</h2></div>
      <div class="selected-type-pills">${typePills(selected)}</div>
    </div>
    <div class="type-result-grid">
      ${defenseCard(selected)}
      <div class="offense-stack">${selected.map(offenseCard).join('')}</div>
    </div>`;

    if (window.applyTypeColors) window.applyTypeColors(result);
  }

  type1Select.innerHTML = TYPES.map(type => `<option value="${esc(type)}">${esc(type)}</option>`).join('');
  type2Select.insertAdjacentHTML('beforeend', TYPES.map(type => `<option value="${esc(type)}">${esc(type)}</option>`).join(''));
  quickGrid.innerHTML = TYPES.map(type => `<button class="type-quick-button type-colored" data-type="${esc(type)}" data-pick-type="${esc(type)}" type="button">${esc(type)}</button>`).join('');

  type1Select.value = '페어리';
  quickGrid.addEventListener('click', event => {
    const button = event.target.closest('[data-pick-type]');
    if (!button) return;
    type1Select.value = button.dataset.pickType;
    if (type2Select.value === type1Select.value) type2Select.value = '';
    render();
  });
  type1Select.addEventListener('change', render);
  type2Select.addEventListener('change', render);
  clearType2.addEventListener('click', () => { type2Select.value = ''; render(); });

  window.EeveeAuth.ready.then(render);
})();
