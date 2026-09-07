/* DAA PBL #20: Exact 0/1 solvers. No dynamic programming is used. */
const body = document.querySelector('#itemsBody');
const capacityInput = document.querySelector('#capacity');
const message = document.querySelector('#message');
const results = document.querySelector('#results');
const demoItems = [
  {name:'Camera',weight:2,value:40},{name:'Laptop',weight:3,value:50},
  {name:'Water',weight:4,value:35},{name:'Jacket',weight:5,value:10},
  {name:'Food Pack',weight:9,value:80},{name:'First-aid Kit',weight:7,value:65}
];
function itemRow(item={name:'',weight:'',value:''}) {
  const tr=document.createElement('tr');
  tr.innerHTML=`<td><input aria-label="Item name" value="${escapeHTML(item.name)}" placeholder="e.g. Laptop"></td><td><input aria-label="Item weight" type="number" min="1" step="1" value="${item.weight}" placeholder="kg"></td><td><input aria-label="Item value" type="number" min="0" step="1" value="${item.value}" placeholder="₹"></td><td><button class="delete" title="Remove item" aria-label="Remove item">×</button></td>`;
  tr.querySelector('.delete').onclick=()=>tr.remove(); body.append(tr);
}
function escapeHTML(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function readProblem(){
  const capacity=Number(capacityInput.value); const rows=[...body.rows];
  if(!Number.isFinite(capacity)||capacity<=0||!Number.isInteger(capacity)) throw Error('Capacity must be a positive whole number.');
  if(!rows.length) throw Error('Add at least one item before running the solvers.');
  if(rows.length>28) throw Error('For a responsive classroom demo, use 28 items or fewer.');
  const items=rows.map((r,i)=>{const x=r.querySelectorAll('input'),name=x[0].value.trim(),weight=Number(x[1].value),value=Number(x[2].value);if(!name||!Number.isInteger(weight)||weight<=0||!Number.isInteger(value)||value<0)throw Error(`Item ${i+1} needs a name, positive whole weight, and non-negative whole value.`);return {name,weight,value,original:i};});
  return {capacity,items};
}
// Sort does not alter the input display; both solvers use the same promising order.
function ordered(items){return [...items].sort((a,b)=>b.value/b.weight-a.value/a.weight||a.original-b.original);}
function backtracking(items, capacity){
  const a=ordered(items),n=a.length; let bestValue=0,bestWeight=0,bestTaken=[],nodes=0,pruned=0;
  const walk=(i,weight,value,taken)=>{nodes++; if(weight>capacity){pruned++;return;} if(i===n){if(value>bestValue||(value===bestValue&&weight<bestWeight)){bestValue=value;bestWeight=weight;bestTaken=[...taken];}return;}
    walk(i+1,weight+a[i].weight,value+a[i].value,[...taken,a[i]]); walk(i+1,weight,value,taken);
  };
  const t=performance.now();walk(0,0,0,[]);return {value:bestValue,weight:bestWeight,taken:bestTaken,nodes,pruned,time:performance.now()-t};
}
function branchAndBound(items,capacity){
  const a=ordered(items),n=a.length;let bestValue=0,bestWeight=0,bestTaken=[],nodes=0,pruned=0;
  const bound=node=>{if(node.weight>capacity)return -Infinity;let result=node.value,w=node.weight;for(let i=node.level;i<n&&w<capacity;i++){if(w+a[i].weight<=capacity){w+=a[i].weight;result+=a[i].value;}else result+=(capacity-w)*(a[i].value/a[i].weight);}return result;};
  const root={level:0,weight:0,value:0,taken:[]};root.bound=bound(root);const queue=[root]; const t=performance.now();
  while(queue.length){queue.sort((x,y)=>y.bound-x.bound);const node=queue.shift();nodes++;if(node.bound<bestValue){pruned++;continue;}if(node.level===n)continue;const it=a[node.level];
    const take={level:node.level+1,weight:node.weight+it.weight,value:node.value+it.value,taken:[...node.taken,it]};
    if(take.weight<=capacity){if(take.value>bestValue||(take.value===bestValue&&take.weight<bestWeight)){bestValue=take.value;bestWeight=take.weight;bestTaken=take.taken;}take.bound=bound(take);if(take.bound>=bestValue)queue.push(take);else pruned++;}else pruned++;
    const skip={level:node.level+1,weight:node.weight,value:node.value,taken:node.taken};skip.bound=bound(skip);if(skip.bound>=bestValue)queue.push(skip);else pruned++;
  }
  return {value:bestValue,weight:bestWeight,taken:bestTaken,nodes,pruned,time:performance.now()-t};
}
function formatTime(t){return t<0.01?'<0.01 ms':`${t.toFixed(3)} ms`;}
function renderResult(el,r){el.innerHTML=`<div class="metric"><b>${r.value}</b><span>Optimal value</span></div><div class="metric"><b>${r.weight}</b><span>Total weight</span></div><div class="metric"><b>${r.nodes.toLocaleString()}</b><span>Nodes explored</span></div><div class="metric"><b>${r.pruned.toLocaleString()}</b><span>Pruned nodes</span></div><div class="metric"><b>${formatTime(r.time)}</b><span>Execution time</span></div><div class="metric"><b>${r.taken.length}</b><span>Items selected</span></div>`;}
function renderSelection(el,r){el.innerHTML=`<strong>Selected:</strong> ${r.taken.length?r.taken.map(i=>i.name).join(' · '):'No items'}`;}
function renderChart(bt,bb){const maxNodes=Math.max(bt.nodes,bb.nodes,1),maxTime=Math.max(bt.time,bb.time,.01);const row=(label,a,b,max,fmt)=>`<div class="chart-row"><span class="chart-label">${label}</span><div class="bar-stack"><div class="bar-line"><span class="bar" style="width:${Math.max(3,a/max*100)}%"></span><small>Backtracking · ${fmt(a)}</small></div><div class="bar-line"><span class="bar bb" style="width:${Math.max(3,b/max*100)}%"></span><small>Branch &amp; Bound · ${fmt(b)}</small></div></div></div>`;document.querySelector('#chart').innerHTML=row('Nodes explored',bt.nodes,bb.nodes,maxNodes,n=>n.toLocaleString())+row('Execution time',bt.time,bb.time,maxTime,formatTime);}
function run(){try{message.textContent='';const {capacity,items}=readProblem();const bt=backtracking(items,capacity),bb=branchAndBound(items,capacity);renderResult(document.querySelector('#btMetrics'),bt);renderResult(document.querySelector('#bbMetrics'),bb);renderSelection(document.querySelector('#btSelection'),bt);renderSelection(document.querySelector('#bbSelection'),bb);const same=bt.value===bb.value&&bt.weight===bb.weight;const v=document.querySelector('#verification');v.textContent=same?'✓ Verified: both found the same optimum':'! Results differ — check inputs';v.className=`verification ${same?'verified':'failed'}`;renderChart(bt,bb);results.hidden=false;results.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){results.hidden=true;message.textContent=e.message;}}
document.querySelector('#addItemBtn').onclick=()=>itemRow();document.querySelector('#runBtn').onclick=run;document.querySelector('#demoBtn').onclick=()=>{capacityInput.value=15;body.innerHTML='';demoItems.forEach(itemRow);message.textContent='Demo loaded: try running both solvers.';results.hidden=true;};document.querySelector('#resetBtn').onclick=()=>{capacityInput.value='';body.innerHTML='';itemRow();message.textContent='';results.hidden=true;};
demoItems.forEach(itemRow);
