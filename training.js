(() => {
  const TYPE_COLORS = {노말:'#9FA19F',비행:'#81B9EF',땅:'#915121',바위:'#AFA981',고스트:'#704170',불꽃:'#E62829',물:'#2980EF',풀:'#3FA129',전기:'#FAC000',에스퍼:'#EF4179',얼음:'#3DCEF3',페어리:'#EF70EF',독:'#9141CB',강철:'#60A1B8',드래곤:'#5060E1',격투:'#FF8000',벌레:'#91A119',악:'#624D4E'};
  const COST = { ability:8000, ev:2000, tera:3000 };
  const LEVEL_TIERS = [
    {from:1,to:21,rate:200},
    {from:21,to:61,rate:400},
    {from:61,to:81,rate:500},
    {from:81,to:100,rate:500} // 임시 단가: 추후 여기만 수정
  ];
  let pokemon = [], items = [], nextId = 1;
  const $ = id => document.getElementById(id);
  const won = n => `${Number(n||0).toLocaleString('ko-KR')}원`;
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Math.floor(Number(v)):min));
  const key = v => String(v||'').toLocaleLowerCase('ko-KR').replace(/\s+/g,'').trim();
  const esc = v => String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  function levelBreakdown(current,target){
    current=clamp(current,1,100); target=clamp(target,1,100);
    if(target<=current)return{total:0,tiers:[]};
    const used=LEVEL_TIERS.map(t=>({...t,count:0,cost:0}));
    for(let next=current+1;next<=target;next++){
      const i=next<=21?0:next<=61?1:next<=81?2:3;
      used[i].count++;
    }
    used.forEach(t=>t.cost=t.count*t.rate);
    const tiers=used.filter(t=>t.count);
    return{total:tiers.reduce((s,t)=>s+t.cost,0),tiers};
  }
  function newItem(){return{id:nextId++,selectedPokemonId:'',search:'',currentLevel:1,targetLevel:100,ability:false,ev:false,tera:false,move2000:0,move3000:0,move5000:0,shown:[],activeIndex:-1,searchOpen:false};}
  function itemById(id){return items.find(x=>x.id===Number(id));}
  function selectedRecord(item){return pokemon.find(r=>String(r.id)===String(item.selectedPokemonId))||null;}
  function moveCount(item){return item.move2000+item.move3000+item.move5000;}
  function moveCost(item){return item.move2000*2000+item.move3000*3000+item.move5000*5000;}
  function costs(item){const level=levelBreakdown(item.currentLevel,item.targetLevel);const ability=item.ability?COST.ability:0,moves=moveCost(item),ev=item.ev?COST.ev:0,tera=item.tera?COST.tera:0;return{level,ability,moves,ev,tera,total:level.total+ability+moves+ev+tera};}
  function displayName(item,index){const r=selectedRecord(item);return r?(r.nickname||r.species||`포켓몬 ${index+1}`):(item.search.trim()||`포켓몬 ${index+1}`);}

  function searchOptions(item){
    if(!item.searchOpen)return'';
    const q=key(item.search);
    item.shown=pokemon.filter(r=>!q||key([r.nickname,r.species,...(r.types||[])].join(' ')).includes(q)).slice(0,40);
    if(!item.shown.length){item.activeIndex=-1;return'<div class="training-search-empty">일치하는 포켓몬이 없어요.</div>';}
    if(item.activeIndex<0||item.activeIndex>=item.shown.length)item.activeIndex=0;
    return item.shown.map((r,i)=>{const name=r.nickname||r.species||'이름 없음';const species=r.nickname&&r.species?r.species:'';const types=(r.types||[]).map(t=>`<span class="training-type-pill" style="--pill-color:${TYPE_COLORS[t]||'#8a9aa3'}">${esc(t)}</span>`).join('');return `<button type="button" class="training-search-option${i===item.activeIndex?' active':''}" data-action="select-pokemon" data-item-id="${item.id}" data-option-index="${i}" role="option"><span class="training-search-main"><strong>${esc(name)}</strong><span>${esc(species||`Lv.${r.level||1}`)}${species?` · Lv.${r.level||1}`:''}</span></span><span class="training-search-meta">${types}</span></button>`;}).join('');
  }
  function moveRow(item,price,field){return `<div class="training-move-price-row"><span><strong>${price.toLocaleString('ko-KR')}원</strong> 기술</span><div class="training-stepper"><button type="button" data-action="step-move" data-item-id="${item.id}" data-move-key="${field}" data-delta="-1">−</button><input type="number" min="0" max="4" value="${item[field]}" inputmode="numeric" data-field="${field}" data-item-id="${item.id}" /><button type="button" data-action="step-move" data-item-id="${item.id}" data-move-key="${field}" data-delta="1">+</button></div></div>`;}
  function itemHtml(item,index){
    const r=selectedRecord(item), c=costs(item), mc=moveCount(item);
    const detail=r?`<div class="selected-training-pokemon"><strong>${esc(r.nickname||r.species||'')}</strong><span>${esc(r.species||'')} · 현재 Lv.${r.level||1}</span></div>`:'';
    const tiers=c.level.tiers.length?c.level.tiers.map(t=>`<div class="level-tier-row"><span>Lv.${Math.max(item.currentLevel,t.from)} → ${Math.min(item.targetLevel,t.to)} · ${t.count}레벨 × ${t.rate.toLocaleString('ko-KR')}원</span><strong>${won(t.cost)}</strong></div>`).join(''):'<div class="level-tier-row"><span>추가 레벨업 없음</span><strong>0원</strong></div>';
    return `<article class="training-pokemon-card" data-item-id="${item.id}"><div class="training-pokemon-card-head"><div><span class="training-pokemon-number">#${index+1}</span><h3>${esc(displayName(item,index))}</h3></div>${items.length>1?`<button class="training-remove-button" type="button" data-action="remove-item" data-item-id="${item.id}">삭제</button>`:''}</div>
    <label class="training-field"><span>내 포켓몬 불러오기 <small>선택</small></span><div class="training-combobox${item.searchOpen?' open':''}"><input type="text" autocomplete="off" placeholder="별명이나 종류를 입력해 검색" value="${esc(item.search)}" aria-autocomplete="list" aria-expanded="${item.searchOpen?'true':'false'}" data-field="search" data-item-id="${item.id}" /><button class="training-combobox-toggle" type="button" data-action="toggle-search" data-item-id="${item.id}">▾</button><div class="training-combobox-list" role="listbox">${searchOptions(item)}</div></div></label>${detail}
    <div class="training-level-row"><label class="training-field"><span>현재 레벨</span><div class="level-input-wrap"><span>Lv.</span><input type="number" min="1" max="100" value="${item.currentLevel}" inputmode="numeric" data-field="currentLevel" data-item-id="${item.id}" /></div></label><div class="training-arrow">→</div><label class="training-field"><span>목표 레벨</span><div class="level-input-wrap"><span>Lv.</span><input type="number" min="1" max="100" value="${item.targetLevel}" inputmode="numeric" data-field="targetLevel" data-item-id="${item.id}" /></div></label></div>
    ${item.targetLevel<item.currentLevel?'<div class="training-inline-notice">목표 레벨이 현재 레벨보다 낮아서 레벨업 비용은 0원으로 계산해요.</div>':''}
    <div class="training-divider"></div><div class="training-options-grid">
    <label class="training-option-card"><input type="checkbox" ${item.ability?'checked':''} data-field="ability" data-item-id="${item.id}" /><span class="training-option-check"></span><span class="training-option-copy"><strong>특성 변경</strong><small>필요할 때 한 번 적용</small></span><span class="training-option-price">+8,000원</span></label>
    <label class="training-option-card"><input type="checkbox" ${item.ev?'checked':''} data-field="ev" data-item-id="${item.id}" /><span class="training-option-check"></span><span class="training-option-copy"><strong>노력치 분배</strong><small>1회 비용</small></span><span class="training-option-price">+2,000원</span></label>
    <label class="training-option-card"><input type="checkbox" ${item.tera?'checked':''} data-field="tera" data-item-id="${item.id}" /><span class="training-option-check"></span><span class="training-option-copy"><strong>테라스탈 구매</strong><small>테라 타입 육성 비용</small></span><span class="training-option-price">+3,000원</span></label></div>
    <div class="training-move-box"><div class="training-move-head"><div><strong>기술 구매</strong><small>가격대별로 최대 4개까지</small></div><span>${mc} / 4개 · ${won(c.moves)}</span></div>${moveRow(item,2000,'move2000')}${moveRow(item,3000,'move3000')}${moveRow(item,5000,'move5000')}</div>
    <details class="training-item-breakdown"><summary><span>이 포켓몬 상세 비용</span><strong>${won(c.total)}</strong></summary><div class="training-breakdown"><div class="training-breakdown-row main"><span>레벨업</span><strong>${won(c.level.total)}</strong></div><div class="level-tier-breakdown">${tiers}</div><div class="training-breakdown-row"><span>특성 변경</span><strong>${won(c.ability)}</strong></div><div class="training-breakdown-row"><span>기술 구매 <small>${mc}개</small></span><strong>${won(c.moves)}</strong></div><div class="training-breakdown-row"><span>노력치 분배</span><strong>${won(c.ev)}</strong></div><div class="training-breakdown-row"><span>테라스탈 구매</span><strong>${won(c.tera)}</strong></div></div></details></article>`;
  }
  function render(){
    $('trainingPokemonList').innerHTML=items.map(itemHtml).join('');
    $('trainingResultList').innerHTML=items.map((item,i)=>`<div class="training-result-row"><span><b>#${i+1}</b> ${esc(displayName(item,i))}</span><strong>${won(costs(item).total)}</strong></div>`).join('');
    const total=items.reduce((s,item)=>s+costs(item).total,0);$('grandTotalCost').textContent=won(total);$('grandTotalSummary').textContent=`${items.length}마리 · 합계 ${won(total)}`;
  }
  function normalizeMoves(item,changed){item.move2000=clamp(item.move2000,0,4);item.move3000=clamp(item.move3000,0,4);item.move5000=clamp(item.move5000,0,4);const over=moveCount(item)-4;if(over>0)item[changed]=Math.max(0,item[changed]-over);}
  function closeOthers(id){items.forEach(x=>{if(x.id!==Number(id))x.searchOpen=false;});}
  function selectPokemon(item,r){item.selectedPokemonId=r.id||'';item.search=r.nickname||r.species||'';item.currentLevel=clamp(r.level||1,1,100);if(item.targetLevel<item.currentLevel)item.targetLevel=100;item.searchOpen=false;render();}
  function bind(){
    $('addTrainingPokemon').addEventListener('click',()=>{items.push(newItem());render();});
    $('resetTraining').addEventListener('click',()=>{nextId=1;items=[newItem()];render();});
    $('trainingPokemonList').addEventListener('input',e=>{const id=e.target.dataset.itemId,field=e.target.dataset.field;if(!id||!field)return;const item=itemById(id);if(field==='search'){item.search=e.target.value;item.selectedPokemonId='';item.searchOpen=true;item.activeIndex=0;closeOthers(id);render();requestAnimationFrame(()=>{const inp=document.querySelector(`[data-item-id="${id}"][data-field="search"]`);inp?.focus();if(inp)inp.setSelectionRange(inp.value.length,inp.value.length);});return;}if(field==='currentLevel'||field==='targetLevel'){item[field]=clamp(e.target.value,1,100);render();return;}if(field.startsWith('move')){item[field]=clamp(e.target.value,0,4);normalizeMoves(item,field);render();}});
    $('trainingPokemonList').addEventListener('change',e=>{const id=e.target.dataset.itemId,field=e.target.dataset.field;if(!id||!field)return;const item=itemById(id);if(['ability','ev','tera'].includes(field)){item[field]=e.target.checked;render();}});
    $('trainingPokemonList').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;if(action==='remove-item'){items=items.filter(x=>x.id!==Number(b.dataset.itemId));render();return;}const item=itemById(b.dataset.itemId);if(!item)return;if(action==='toggle-search'){item.searchOpen=!item.searchOpen;item.activeIndex=0;closeOthers(item.id);render();return;}if(action==='select-pokemon'){selectPokemon(item,item.shown[Number(b.dataset.optionIndex)]);return;}if(action==='step-move'){const f=b.dataset.moveKey;item[f]=clamp(item[f]+Number(b.dataset.delta||0),0,4);normalizeMoves(item,f);render();}});
    $('trainingPokemonList').addEventListener('keydown',e=>{const inp=e.target.closest('[data-field="search"]');if(!inp)return;const item=itemById(inp.dataset.itemId);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();item.searchOpen=true;const q=key(item.search);item.shown=pokemon.filter(r=>!q||key([r.nickname,r.species,...(r.types||[])].join(' ')).includes(q)).slice(0,40);item.activeIndex=e.key==='ArrowDown'?Math.min(item.shown.length-1,item.activeIndex+1):Math.max(0,item.activeIndex-1);render();requestAnimationFrame(()=>document.querySelector(`[data-item-id="${item.id}"][data-field="search"]`)?.focus());}else if(e.key==='Enter'&&item.shown[item.activeIndex]){e.preventDefault();selectPokemon(item,item.shown[item.activeIndex]);}else if(e.key==='Escape'){item.searchOpen=false;render();}});
  }
  async function loadPokemon(){const dot=$('trainingSyncDot'),text=$('trainingSyncText');try{await window.EeveeAuth?.ready;if(!window.EeveeBackend?.api)throw new Error('Supabase backend missing');const result=await window.EeveeBackend.api('get_all');pokemon=(result.records||[]).slice().sort((a,b)=>(a.order||99)-(b.order||99));dot?.classList.add('online');if(text)text.textContent=`${pokemon.length}마리 불러옴`;}catch(err){console.error(err);dot?.classList.remove('online');if(text)text.textContent='포켓몬 불러오기 실패';}}
  function init(){items=[newItem()];bind();render();loadPokemon();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
