import test from 'node:test';
import assert from 'node:assert/strict';
import {planImportTargets} from '../../live-loop/src/ui/importPlan.js';

test('multiple imports fill distinct lanes starting at the selected lane',()=>{
  assert.deepEqual(planImportTargets(0,3),[0,1,2]);
  assert.deepEqual(planImportTargets(4,3),[4,0,1]);
  assert.deepEqual(planImportTargets(2,8),[2,3,4,0,1], 'Live Loop must never overwrite a lane twice in one import');
});

test('import target planning rejects invalid input without creating hidden lanes',()=>{
  assert.deepEqual(planImportTargets(-1,2),[]);
  assert.deepEqual(planImportTargets(1,0),[]);
  assert.deepEqual(planImportTargets(5,1),[]);
});
