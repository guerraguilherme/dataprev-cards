(() => {
  'use strict';
  const CONTENT_VERSION='2026.08.06-sessoes-02';
  const FILES=['sessions.json','PY-COND-R01.json','MAT-ALG-002.json','BD-NORM-002.json'];
  async function load(name){
    const response=await fetch(`../sessoes/${name}?v=041`,{cache:'no-store'});
    if(!response.ok)throw new Error(`Falha ao carregar ${name}.`);
    return response.json();
  }
  fetchRemoteCatalog=async function(){
    const [base,...extra]=await Promise.all(FILES.map(load));
    const byId=new Map();
    for(const item of [...(base.sessions||[]),...extra]){
      if(item?.id)byId.set(item.id,item);
    }
    const sessions=[...byId.values()];
    return {schemaVersion:1,contentVersion:CONTENT_VERSION,totalSessions:sessions.length,sessions};
  };
})();