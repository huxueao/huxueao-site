import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function openDB(path=':memory:') {
  const db=new DatabaseSync(path);
  db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
  const bindValue=v=>v instanceof ArrayBuffer?new Uint8Array(v):v;
  return {
    raw:db,
    prepare(sql){
      let args=[];
      const query={
        bind(...v){args=v.map(bindValue);return query;},
        async first(){return db.prepare(sql).get(...args)||null;},
        async all(){return {results:db.prepare(sql).all(...args)};},
        async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};},
      };return query;
    },
  };
}
