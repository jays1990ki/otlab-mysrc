import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState,applyAction,evaluate,templates} from '../src/services/simulation.js';
import {flows,bypasses} from './flows.mjs';
for(const [type,actions]of Object.entries(flows)){
 test(type+' completes its equipment mission',()=>{let state=initialState(type);for(let i=0;i<actions.length;i++){const previous=structuredClone(state);const next=applyAction(type,state,actions[i],0);assert.deepEqual(state,previous,'action must not mutate previous state');state=next;if(i<actions.length-1)assert.equal(evaluate(type,state,0).passed,false,'must complete the full scenario');}assert.equal(evaluate(type,state,0).score,100);});
 test(type+' rejects fabricated commands and incomplete workflow',()=>{const state=initialState(type);assert.throws(()=>applyAction(type,state,{kind:'force-pass',value:100},0));let partial=state;for(const action of bypasses[type])partial=applyAction(type,partial,action,0);assert.equal(evaluate(type,partial,0).passed,false);});
}
test('23 unique templates fit the existing MariaDB simulator column',()=>{assert.equal(templates.length,23);assert.equal(new Set(templates.map(t=>t.key)).size,23);for(const t of templates)assert(t.key.length<=20);});
