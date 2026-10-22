import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectQuestions,shuffle,formatTime,validateRegistration} from '../docs/game.js';
const bank=JSON.parse(fs.readFileSync(new URL('../docs/questions.json',import.meta.url),'utf8'));
test('35 preguntas únicas, opciones válidas y cambio de Goyeneche',()=>{
 assert.equal(bank.length,35);assert.equal(new Set(bank.map(q=>q.id)).size,35);
 for(const q of bank){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4);assert.doesNotMatch(q.text,/esa final|aquella final|ese ascenso|ese estadio|plantel campeón\?/i);}
 assert.match(bank[4].options[bank[4].answer],/Goyeneche/);
});
test('partidas de 10 sin repetir y dificultad 4/4/2',()=>{
 const sets=new Set();
 for(let i=0;i<100;i++){
  const picked=selectQuestions(bank);assert.equal(picked.length,10);assert.equal(new Set(picked.map(q=>q.id)).size,10);
  for(const [difficulty,n] of [['easy',4],['medium',4],['hard',2]])assert.equal(picked.filter(q=>q.difficulty===difficulty).length,n);
  sets.add(picked.map(q=>q.id).join(','));
 }
 assert.ok(sets.size>90);
});
test('mezclar opciones conserva el índice correcto y no modifica originales',()=>{
 const q=bank[4];const opts=q.options.map((text,i)=>({text,i}));const mixed=shuffle(opts,()=>0);
 assert.equal(mixed.find(o=>o.i===q.answer).text,q.options[q.answer]);assert.equal(opts[0].i,0);
});
test('formato del cronómetro y validación sin consentimiento comercial obligatorio',()=>{
 assert.equal(formatTime(95000),'01:35');assert.equal(formatTime(59999),'00:59');assert.equal(formatTime(60000),'01:00');
 const valid={first:'José',last:'Pérez',email:'prueba@example.com',consent:true,marketing:false};
 assert.equal(validateRegistration(valid),'');assert.ok(validateRegistration({...valid,consent:false}));assert.ok(validateRegistration({...valid,email:'incorrecto'}));
});
