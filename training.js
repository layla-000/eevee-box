(() => {
  const TYPE_COLORS = {
    노말:'#9FA19F', 비행:'#81B9EF', 땅:'#915121', 바위:'#AFA981', 고스트:'#704170', 불꽃:'#E62829', 물:'#2980EF', 풀:'#3FA129', 전기:'#FAC000', 에스퍼:'#EF4179', 얼음:'#3DCEF3', 페어리:'#EF70EF', 독:'#9141CB', 강철:'#60A1B8', 드래곤:'#5060E1', 격투:'#FF8000', 벌레:'#91A119', 악:'#624D4E'
  };
  const COST = { ability:8000, move:5000, ev:2000 };
  let pokemon = [];
  let selectedPokemonId = '';
  let shown = [];
  let activeIndex = -1;
  const $ = id => document.getElementById(id);
  const won = value => `${Number(value || 0).toLocaleString('ko-KR')}원`;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,Number.isFinite(Number(value)) ? Math.floor(Number(value)) : min));
  const searchKey = value => String(value || '').toLocaleLowerCase('ko-KR').replace(/\s+/g,'').trim();

  function levelBreakdown(current, target){
    current = clamp(current,1,81); target = clamp(target,1,81);
    if (target <= current) return {total:0, tiers:[]};
    const tiers = [
      {from:1,to:21,rate:200,count:0},
      {from:21,to:61,rate:400,count:0},
      {from:61,to:81,rate:500,count:0}
    ];
    for (let next=current+1; next<=target; next++){
      const tier = next <= 21 ? tiers[0] : next <= 61 ? tiers[1] : tiers[2];
      tier.count++;
    }
    const used = tiers.filter(t=>t.count).map(t=>({...t,cost:t.count*t.rate}));
    return {total:used.reduce((sum,t)=>sum+t.cost,0),tiers:used};
  }

  function render(){
    let current = clamp($('currentLevel').value,1,81);
    let target = clamp($('targetLevel').value,1,81);
    $('currentLevel').value = current;
    $('targetLevel').value = target;
    const notice = $('levelNotice');
    if (target < current){
      notice.hidden = false;
      notice.textContent = '목표 레벨이 현재 레벨보다 낮아서 레벨업 비용은 0원으로 계산해요.';
    } else notice.hidden = true;
    const level = levelBreakdown(current,target);
    const ability = $('changeAbility').checked ? COST.ability : 0;
    const moves = clamp($('moveCount').value,0,4);
    $('moveCount').value = moves;
    const moveCost = moves * COST.move;
    const ev = $('trainEv').checked ? COST.ev : 0;
    const total = level.total + ability + moveCost + ev;
    $('levelCost').textContent = won(level.total);
    $('abilityCost').textContent = won(ability);
    $('movesCost').textContent = won(moveCost);
    $('evCost').textContent = won(ev);
    $('movePrice').textContent = `+${won(moveCost)}`;
    $('moveCountLabel').textContent = `${moves}개`;
    $('totalCost').textContent = won(total);
    const extras = [];
    if (ability) extras.push('특성 변경');
    if (moves) extras.push(`기술 ${moves}개`);
    if (ev) extras.push('노력치');
    $('totalSummary').textContent = `Lv.${current} → Lv.${target}${extras.length ? ` · ${extras.join(' · ')}` : ' · 레벨업만 계산'}`;
    $('levelTierBreakdown').innerHTML = level.tiers.length
      ? level.tiers.map(t=>`<div class="level-tier-row"><span>Lv.${Math.max(current,t.from)} → ${Math.min(target,t.to)} · ${t.count}레벨 × ${t.rate.toLocaleString('ko-KR')}원</span><strong>${won(t.cost)}</strong></div>`).join('')
      : '<div class="level-tier-row"><span>추가 레벨업 없음</span><strong>0원</strong></div>';
  }

  function optionHtml(record,index){
    const name = record.nickname || record.species || '이름 없음';
    const species = record.nickname && record.species ? record.species : '';
    const types = (record.types || []).map(type=>`<span class="training-type-pill" style="--pill-color:${TYPE_COLORS[type] || '#8a9aa3'}">${type}</span>`).join('');
    return `<button type="button" class="training-search-option${index===activeIndex?' active':''}" data-index="${index}" role="option"><span class="training-search-main"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(species || `Lv.${record.level || 1}`)}${species ? ` · Lv.${record.level || 1}` : ''}</span></span><span class="training-search-meta">${types}</span></button>`;
  }

  function escapeHtml(value){ return String(value ?? '').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }

  function renderSearch(query=''){
    const key = searchKey(query);
    shown = pokemon.filter(record => !key || searchKey([record.nickname,record.species,...(record.types||[])].join(' ')).includes(key)).slice(0,40);
    activeIndex = shown.length ? 0 : -1;
    $('pokemonSearchList').innerHTML = shown.length ? shown.map(optionHtml).join('') : '<div class="training-search-empty">일치하는 포켓몬이 없어요.</div>';
    $('pokemonSearchList').querySelectorAll('[data-index]').forEach(button=>button.addEventListener('mousedown',event=>{event.preventDefault(); selectPokemon(shown[Number(button.dataset.index)]);}));
    openSearch();
  }

  function openSearch(){ $('pokemonSearchBox').classList.add('open'); $('pokemonSearch').setAttribute('aria-expanded','true'); }
  function closeSearch(){ $('pokemonSearchBox').classList.remove('open'); $('pokemonSearch').setAttribute('aria-expanded','false'); activeIndex=-1; }

  function selectPokemon(record){
    if (!record) return;
    selectedPokemonId = record.id || '';
    const name = record.nickname || record.species || '';
    $('pokemonSearch').value = name;
    const level = clamp(record.level || 1,1,81);
    $('currentLevel').value = level;
    if (Number($('targetLevel').value) < level) $('targetLevel').value = Math.max(level,81);
    const detail = $('selectedPokemon');
    detail.hidden = false;
    detail.innerHTML = `<strong>${escapeHtml(name)}</strong><span>${escapeHtml(record.species || '')} · 현재 Lv.${record.level || 1}</span>`;
    closeSearch();
    render();
  }

  function clearPokemon(){
    selectedPokemonId=''; $('pokemonSearch').value=''; $('selectedPokemon').hidden=true; $('selectedPokemon').innerHTML='';
  }

  function refreshActive(){
    $('pokemonSearchList').querySelectorAll('.training-search-option').forEach((el,i)=>el.classList.toggle('active',i===activeIndex));
    const active = $('pokemonSearchList').querySelector('.training-search-option.active'); active?.scrollIntoView({block:'nearest'});
  }

  function bind(){
    ['currentLevel','targetLevel','moveCount'].forEach(id=>$(id).addEventListener('input',render));
    ['currentLevel','targetLevel','moveCount'].forEach(id=>$(id).addEventListener('change',render));
    ['changeAbility','trainEv'].forEach(id=>$(id).addEventListener('change',render));
    $('moveMinus').addEventListener('click',()=>{$('moveCount').value=clamp(Number($('moveCount').value)-1,0,4);render();});
    $('movePlus').addEventListener('click',()=>{$('moveCount').value=clamp(Number($('moveCount').value)+1,0,4);render();});
    $('resetTraining').addEventListener('click',()=>{clearPokemon();$('currentLevel').value=1;$('targetLevel').value=81;$('changeAbility').checked=false;$('moveCount').value=0;$('trainEv').checked=false;render();});
    $('pokemonSearch').addEventListener('focus',()=>renderSearch($('pokemonSearch').value));
    $('pokemonSearch').addEventListener('input',()=>{selectedPokemonId='';$('selectedPokemon').hidden=true;renderSearch($('pokemonSearch').value);});
    $('pokemonSearch').addEventListener('keydown',event=>{
      if (event.key==='ArrowDown'){event.preventDefault();if(!shown.length)renderSearch($('pokemonSearch').value);else{activeIndex=Math.min(shown.length-1,activeIndex+1);refreshActive();}}
      else if(event.key==='ArrowUp'){event.preventDefault();activeIndex=Math.max(0,activeIndex-1);refreshActive();}
      else if(event.key==='Enter' && shown[activeIndex]){event.preventDefault();selectPokemon(shown[activeIndex]);}
      else if(event.key==='Escape'){event.preventDefault();closeSearch();}
    });
    $('pokemonSearchToggle').addEventListener('mousedown',e=>e.preventDefault());
    $('pokemonSearchToggle').addEventListener('click',()=>{$('pokemonSearchBox').classList.contains('open')?closeSearch():renderSearch('');});
    document.addEventListener('pointerdown',event=>{if(!$('pokemonSearchBox').contains(event.target))closeSearch();});
  }

  async function loadPokemon(){
    const dot=$('trainingSyncDot'), text=$('trainingSyncText');
    try{
      await window.EeveeAuth?.ready;
      if(!window.EeveeBackend?.api) throw new Error('Supabase backend missing');
      const result=await window.EeveeBackend.api('get_all');
      pokemon=(result.records||[]).slice().sort((a,b)=>(a.order||99)-(b.order||99));
      dot?.classList.add('online'); if(text) text.textContent=`${pokemon.length}마리 불러옴`;
    }catch(error){
      console.error('육성 계산기 포켓몬 불러오기 실패',error);
      dot?.classList.remove('online'); if(text) text.textContent='포켓몬 불러오기 실패';
    }
  }

  function init(){ bind(); render(); loadPokemon(); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
