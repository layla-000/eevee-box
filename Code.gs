const SHEET_NAME = 'Pokemon';
const BATTLE_SHEET_NAME = 'Battle';

function doGet(){
  return json_({ok:true,message:'Eevee Box API'});
}

function doPost(e){
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    switch (body.action){
      case 'get_all': return getAll_();
      case 'save': return save_(body.record);
      case 'remove': return remove_(body.id);
      case 'seed': return seed_(body.records || []);
      case 'sync_all': return syncAll_(body.records || []);
      case 'get_battle': return getBattle_();
      case 'save_battle': return saveBattle_(body.battle);
      default: throw new Error('Unknown action: ' + body.action);
    }
  } catch (err){
    return json_({ok:false,error:String(err.message || err)});
  }
}

function sheet_(){
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh){
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['id','json','updatedAt']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readRecords_(){
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2,1,last-1,3).getValues().map(row => {
    try { return JSON.parse(row[1]); }
    catch (_) { return null; }
  }).filter(Boolean);
}

function getAll_(){
  return json_({ok:true,records:readRecords_()});
}

function save_(record){
  if (!record || !record.id) throw new Error('record.id is required');
  const sh = sheet_();
  const last = sh.getLastRow();
  const ids = last < 2 ? [] : sh.getRange(2,1,last-1,1).getValues().flat();
  const idx = ids.indexOf(record.id);
  const row = idx < 0 ? last + 1 : idx + 2;
  record.updatedAt = new Date().toISOString();
  sh.getRange(row,1,1,3).setValues([[record.id,JSON.stringify(record),record.updatedAt]]);
  return json_({ok:true,record});
}

function remove_(id){
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last >= 2){
    const ids = sh.getRange(2,1,last-1,1).getValues().flat();
    const idx = ids.indexOf(id);
    if (idx >= 0) sh.deleteRow(idx + 2);
  }
  return json_({ok:true});
}

function seed_(records){
  const sh = sheet_();
  if (sh.getLastRow() > 1) return getAll_();
  writeAll_(records);
  return json_({ok:true,count:records.length,records});
}

function syncAll_(clientRecords){
  const remoteRecords = readRecords_();
  const merged = {};
  remoteRecords.concat(clientRecords).forEach(record => {
    if (!record || !record.id) return;
    const old = merged[record.id];
    const oldTime = old ? Date.parse(old.updatedAt || 0) : -1;
    const newTime = Date.parse(record.updatedAt || 0);
    if (!old || newTime >= oldTime) merged[record.id] = record;
  });
  const records = Object.keys(merged).map(id => merged[id]);
  writeAll_(records);
  return json_({ok:true,records});
}

function writeAll_(records){
  const sh = sheet_();
  if (sh.getLastRow() > 1) sh.getRange(2,1,sh.getLastRow()-1,3).clearContent();
  const rows = records.map(record => {
    record.updatedAt = record.updatedAt || new Date().toISOString();
    return [record.id,JSON.stringify(record),record.updatedAt];
  });
  if (rows.length) sh.getRange(2,1,rows.length,3).setValues(rows);
}


function battleSheet_(){
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(BATTLE_SHEET_NAME);
  if (!sh){
    sh = ss.insertSheet(BATTLE_SHEET_NAME);
    sh.appendRow(['id','json','updatedAt']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function getBattle_(){
  const sh = battleSheet_();
  if (sh.getLastRow() < 2) return json_({ok:true,battle:null});
  const json = sh.getRange(2,2).getValue();
  if (!json) return json_({ok:true,battle:null});
  try {
    return json_({ok:true,battle:JSON.parse(json)});
  } catch (_) {
    return json_({ok:true,battle:null});
  }
}

function saveBattle_(battle){
  if (!battle) throw new Error('battle is required');
  const sh = battleSheet_();
  battle.id = battle.id || 'current_3v3';
  battle.updatedAt = new Date().toISOString();
  sh.getRange(2,1,1,3).setValues([[battle.id, JSON.stringify(battle), battle.updatedAt]]);
  return json_({ok:true,battle});
}

function json_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
