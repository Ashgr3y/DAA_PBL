/* DAA PBL #20: Smart Relief Load Optimizer
   Exact 0/1 Knapsack solvers comparing Backtracking vs Branch & Bound.
   No dynamic programming is used. */

const body = document.querySelector('#itemsBody');
const capacityInput = document.querySelector('#capacity');
const message = document.querySelector('#message');
const results = document.querySelector('#results');

/* ---------------------------------------------------------
   REAL-WORLD MISSION SCENARIOS
--------------------------------------------------------- */

const scenarios = {
    disaster: {
        name: 'Disaster Relief',
        capacity: 500,
        items: [
            { name: 'Drinking Water', weight: 100, value: 95 },
            { name: 'Food Packets', weight: 80, value: 90 },
            { name: 'First Aid Kits', weight: 40, value: 100 },
            { name: 'Medicines', weight: 30, value: 100 },
            { name: 'Blankets', weight: 60, value: 70 },
            { name: 'Hygiene Kits', weight: 50, value: 65 },
            { name: 'Shelter Materials', weight: 120, value: 80 },
            { name: 'Cooking Supplies', weight: 70, value: 55 }
        ]
    },
    medical: {
        name: 'Medical Supply Transport',
        capacity: 250,
        items: [
            { name: 'Medicines', weight: 30, value: 100 },
            { name: 'First Aid Kits', weight: 40, value: 95 },
            { name: 'Vaccination Kits', weight: 50, value: 100 },
            { name: 'Blood Storage', weight: 60, value: 90 },
            { name: 'Medical Equipment', weight: 80, value: 85 },
            { name: 'PPE Kits', weight: 35, value: 75 },
            { name: 'Sanitation Kits', weight: 45, value: 65 }
        ]
    },
    delivery: {
        name: 'Priority Delivery',
        capacity: 300,
        items: [
            { name: 'Urgent Package A', weight: 40, value: 95 },
            { name: 'Urgent Package B', weight: 70, value: 90 },
            { name: 'Fragile Package', weight: 50, value: 85 },
            { name: 'Medical Package', weight: 35, value: 100 },
            { name: 'Express Package', weight: 80, value: 75 },
            { name: 'Standard Package', weight: 60, value: 50 },
            { name: 'Electronics', weight: 45, value: 80 }
        ]
    },
    custom: {
        name: 'Custom Mission',
        capacity: 100,
        items: []
    }
};

let currentScenarioKey = 'disaster';

/* ---------------------------------------------------------
   INPUT / TABLE FUNCTIONS
--------------------------------------------------------- */

function itemRow(item = { name: '', weight: '', value: '' }) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td>
            <input aria-label="Supply name"
                   value="${escapeHTML(item.name)}"
                   placeholder="e.g. Drinking Water">
        </td>

        <td>
            <input aria-label="Supply weight (kg)"
                   type="number"
                   min="1"
                   step="1"
                   value="${item.weight !== undefined ? item.weight : ''}"
                   placeholder="kg">
        </td>

        <td>
            <input aria-label="Supply priority score"
                   type="number"
                   min="0"
                   step="1"
                   value="${item.value !== undefined ? item.value : ''}"
                   placeholder="Priority (e.g. 95)">
        </td>

        <td>
            <button class="delete"
                    title="Remove supply"
                    aria-label="Remove supply"
                    type="button">×</button>
        </td>
    `;

    tr.querySelector('.delete').onclick = () => {
        tr.remove();
        markCustomScenario();
    };

    tr.querySelectorAll('input').forEach(input => {
        input.oninput = () => markCustomScenario();
    });

    body.append(tr);
}

function markCustomScenario() {
    if (currentScenarioKey !== 'custom') {
        currentScenarioKey = 'custom';
        document.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.scenario === 'custom');
        });
    }
}

function escapeHTML(v) {
    return String(v).replace(/[&<>'"]/g, c => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        "'":'&#39;',
        '"':'&quot;'
    }[c]));
}

function readProblem() {
    const capacity = Number(capacityInput.value);
    const rows = [...body.rows];

    if (!Number.isFinite(capacity) ||
        capacity <= 0 ||
        !Number.isInteger(capacity)) {
        throw Error('Vehicle cargo capacity must be a positive whole number.');
    }

    if (!rows.length) {
        throw Error('Add at least one supply before running the optimizer.');
    }

    if (rows.length > 28) {
        throw Error('For a responsive classroom demo, use 28 supplies or fewer.');
    }

    const items = rows.map((r, i) => {
        const x = r.querySelectorAll('input');
        const name = x[0].value.trim();
        const weight = Number(x[1].value);
        const value = Number(x[2].value);

        if (
            !name ||
            !Number.isInteger(weight) ||
            weight <= 0 ||
            !Number.isInteger(value) ||
            value < 0
        ) {
            throw Error(
                `Supply ${i + 1} needs a name, positive whole weight (kg), and non-negative whole priority score.`
            );
        }

        return {
            name,
            weight,
            value,
            original: i
        };
    });

    return { capacity, items };
}

function readProblemSafe() {
    try {
        return readProblem();
    } catch(e) {
        return {
            capacity: Number(capacityInput.value) || 500,
            items: []
        };
    }
}


/* ---------------------------------------------------------
   COMMON ITEM ORDER
--------------------------------------------------------- */

function ordered(items) {

    return [...items].sort(
        (a,b) =>
            b.value / b.weight - a.value / a.weight ||
            a.original - b.original
    );
}


/* ---------------------------------------------------------
   BACKTRACKING
--------------------------------------------------------- */

function backtracking(items, capacity) {

    const a = ordered(items);
    const n = a.length;

    let bestValue = 0;
    let bestWeight = 0;
    let bestTaken = [];

    let nodes = 0;
    let pruned = 0;

    /* New: complete execution trace */
    const trace = [];

    let nextNodeId = 0;


    const walk = (
        i,
        weight,
        value,
        taken,
        parentId = null,
        decision = 'ROOT'
    ) => {

        const node = {
            id: nextNodeId++,
            parentId,
            level:i,
            decision,
            item:i < n ? a[i].name : null,
            weight,
            value,
            status:'EXPLORE'
        };

        trace.push(node);

        nodes++;


        /* -----------------------------
           BACKTRACKING PRUNING
        ----------------------------- */

        if (weight > capacity) {

            pruned++;

            node.status = 'PRUNE';
            node.reason = 'Current load exceeds vehicle cargo capacity';

            return;
        }


        /* -----------------------------
           LEAF NODE
        ----------------------------- */

        if (i === n) {

            node.status = 'LEAF';

            if (
                value > bestValue ||
                (value === bestValue && weight < bestWeight)
            ) {

                bestValue = value;
                bestWeight = weight;
                bestTaken = [...taken];

                node.status = 'BEST';

                node.bestValue = bestValue;
                node.bestWeight = bestWeight;
            }

            return;
        }


        const it = a[i];


        /* -----------------------------
           TAKE BRANCH
        ----------------------------- */

        walk(
            i + 1,
            weight + it.weight,
            value + it.value,
            [...taken,it],
            node.id,
            'TAKE'
        );


        /* -----------------------------
           SKIP BRANCH
        ----------------------------- */

        walk(
            i + 1,
            weight,
            value,
            taken,
            node.id,
            'SKIP'
        );
    };


    const t = performance.now();

    walk(0,0,0,[]);

    return {
        value:bestValue,
        weight:bestWeight,
        taken:bestTaken,
        nodes,
        pruned,
        time:performance.now() - t,

        /* New */
        trace,
        algorithm:'Backtracking'
    };
}


/* ---------------------------------------------------------
   BRANCH & BOUND
--------------------------------------------------------- */

/*
   Calculates the optimistic upper bound.

   The calculation is based on the fractional-knapsack idea:
   remaining items are considered by value/weight ratio.

   The 0/1 solution itself is still exact.
*/

function branchAndBound(items,capacity) {

    const a = ordered(items);
    const n = a.length;

    let bestValue = 0;
    let bestWeight = 0;
    let bestTaken = [];

    let nodes = 0;
    let pruned = 0;

    const trace = [];

    let nextNodeId = 0;
    let executionOrder = 0;


    /* -----------------------------------------------------
       UPPER BOUND CALCULATION
    ----------------------------------------------------- */

    function calculateBound(node) {

        if (node.weight > capacity) {

            return {
                value: -Infinity,
                steps: []
            };
        }


        let result = node.value;
        let w = node.weight;

        const steps = [];


        for (
            let i = node.level;
            i < n && w < capacity;
            i++
        ) {

            const item = a[i];

            const remaining = capacity - w;


            if (w + item.weight <= capacity) {

                w += item.weight;
                result += item.value;

                steps.push({
                    item: item.name,
                    type: 'FULL',
                    amount: item.value,
                    weight: item.weight,
                    fraction: 1
                });

            } else {

                const fraction =
                    remaining / item.weight;

                const addedValue =
                    remaining *
                    (item.value / item.weight);

                result += addedValue;

                steps.push({
                    item: item.name,
                    type: 'FRACTION',
                    amount: addedValue,
                    weight: remaining,
                    originalWeight: item.weight,
                    fraction
                });

                break;
            }
        }


        return {
            value: result,
            steps
        };
    }


    /* -----------------------------------------------------
       CREATE NODE
    ----------------------------------------------------- */

    function createNode(
        level,
        weight,
        value,
        taken,
        parentId,
        decision
    ) {

        const node = {

            id: nextNodeId++,

            parentId,

            level,

            decision,

            item:
                level < n
                    ? a[level].name
                    : null,

            weight,

            value,

            taken: [...taken],

            status: 'PENDING'

        };


        const boundInfo =
            calculateBound(node);


        node.bound =
            boundInfo.value;

        node.boundSteps =
            boundInfo.steps;


        node.remainingCapacity =
            Math.max(
                0,
                capacity - weight
            );


        /*
           Important:

           This records the incumbent at the
           moment the node is created.

           It is NOT the execution order.
        */

        node.bestBefore =
            bestValue;


        return node;
    }


    /* -----------------------------------------------------
       ADD NODE TO EXECUTION TRACE
    ----------------------------------------------------- */

    function record(node, status, reason = '') {

        node.status = status;

        node.reason = reason;

        /*
           executionOrder is the position in the
           actual visualization sequence.

           This is deliberately separate from node.id.
        */

        node.executionOrder =
            executionOrder++;

        node.bestAfter =
            bestValue;

        trace.push(node);
    }


    /* -----------------------------------------------------
       ROOT
    ----------------------------------------------------- */

    const root = createNode(
        0,
        0,
        0,
        [],
        null,
        'ROOT'
    );


    const queue = [root];

    const t = performance.now();


    /* -----------------------------------------------------
       BEST-FIRST SEARCH
    ----------------------------------------------------- */

    while (queue.length) {

        /*
           Highest upper bound gets priority.
        */

        queue.sort(
            (x, y) =>
                y.bound - x.bound
        );


        const node =
            queue.shift();


        nodes++;


        /*
           Record the node only when it is
           actually removed from the priority queue.

           Therefore the trace represents the
           real execution order.
        */

        if (node.bound < bestValue) {

            pruned++;

            record(
                node,
                'PRUNE',
                'Upper bound cannot beat current best utility.'
            );

            continue;
        }


        /*
           This node is actually explored.
        */

        record(
            node,
            'EXPLORE'
        );


        /* -------------------------------------------------
           ALL ITEMS DECIDED
        ------------------------------------------------- */

        if (node.level === n) {

            if (
                node.value > bestValue ||
                (
                    node.value === bestValue &&
                    node.weight < bestWeight
                )
            ) {

                bestValue =
                    node.value;

                bestWeight =
                    node.weight;

                bestTaken =
                    [...node.taken];


                /*
                   The BEST status belongs to the
                   complete solution actually found.
                */

                node.status =
                    'BEST';

                node.bestValue =
                    bestValue;

                node.bestWeight =
                    bestWeight;

                node.bestAfter =
                    bestValue;
            }


            continue;
        }


        const it =
            a[node.level];


        /* -------------------------------------------------
           TAKE CHILD
        ------------------------------------------------- */

        const take =
            createNode(
                node.level + 1,

                node.weight +
                    it.weight,

                node.value +
                    it.value,

                [...node.taken, it],

                node.id,

                'TAKE'
            );


        if (take.weight > capacity) {

            pruned++;

            record(
                take,
                'PRUNE',
                'Current load exceeds vehicle cargo capacity.'
            );

        } else if (
            take.bound < bestValue
        ) {

            pruned++;

            record(
                take,
                'PRUNE',
                'Upper bound cannot beat current best utility.'
            );

        } else {

            queue.push(take);
        }


        /* -------------------------------------------------
           SKIP CHILD
        ------------------------------------------------- */

        const skip =
            createNode(
                node.level + 1,

                node.weight,

                node.value,

                node.taken,

                node.id,

                'SKIP'
            );


        if (
            skip.bound < bestValue
        ) {

            pruned++;

            record(
                skip,
                'PRUNE',
                'Upper bound cannot beat current best utility.'
            );

        } else {

            queue.push(skip);
        }
    }


    return {

        value: bestValue,

        weight: bestWeight,

        taken: bestTaken,

        nodes,

        pruned,

        time:
            performance.now() - t,

        trace,

        algorithm:
            'Branch & Bound'
    };
}


/* ---------------------------------------------------------
   RESULT DISPLAY
--------------------------------------------------------- */

function formatTime(t) {

    return t < 0.01
        ? '<0.01 ms'
        : `${t.toFixed(3)} ms`;
}


function renderVehicleOverview(capacity, r) {
    const el = document.querySelector('#vehicleOverviewCard');
    if (!el) return;

    const unused = Math.max(0, capacity - r.weight);
    const pct = capacity > 0 ? Math.min(100, (r.weight / capacity) * 100) : 0;

    const chipsHTML = r.taken.length
        ? r.taken.map(it => `
            <div class="supply-chip">
                <span class="supply-chip-icon">✓</span>
                <span><strong>${escapeHTML(it.name)}</strong> (${it.weight} kg · Priority ${it.value})</span>
            </div>
        `).join('')
        : '<p style="color:var(--muted);margin:0;font-size:0.85rem;">No supplies loaded within capacity limit.</p>';

    el.innerHTML = `
        <div class="vehicle-card-header">
            <div class="vehicle-card-title">
                <span class="vehicle-icon">🚚</span>
                <div>
                    <h3>OPTIMAL RELIEF LOAD</h3>
                    <p>Vehicle Cargo Allocation Summary</p>
                </div>
            </div>
            <span class="verification verified">✓ Optimum Found</span>
        </div>

        <div class="vehicle-metrics-grid">
            <div class="vehicle-metric-item">
                <span>Vehicle Capacity</span>
                <strong>${capacity.toLocaleString()}<small>kg</small></strong>
            </div>
            <div class="vehicle-metric-item">
                <span>Selected Load</span>
                <strong>${r.weight.toLocaleString()}<small>kg</small></strong>
            </div>
            <div class="vehicle-metric-item">
                <span>Unused Capacity</span>
                <strong>${unused.toLocaleString()}<small>kg</small></strong>
            </div>
            <div class="vehicle-metric-item">
                <span>Maximum Utility</span>
                <strong>${r.value.toLocaleString()}</strong>
            </div>
        </div>

        <div class="capacity-bar-container">
            <div class="capacity-bar-header">
                <span>Vehicle Cargo Utilization</span>
                <span>${r.weight.toLocaleString()} / ${capacity.toLocaleString()} kg (${pct.toFixed(1)}%)</span>
            </div>
            <div class="capacity-track">
                <div class="capacity-fill ${pct > 100 ? 'overload' : ''}" style="width: ${Math.max(3, pct)}%;">
                    <span class="capacity-fill-text">${pct.toFixed(0)}%</span>
                </div>
            </div>
            <div class="capacity-bar-footer">
                <span>0 kg</span>
                <span>Payload Limit: ${capacity.toLocaleString()} kg</span>
            </div>
        </div>

        <div class="loaded-supplies-wrap">
            <span class="loaded-supplies-label">Loaded Supplies (${r.taken.length})</span>
            <div class="loaded-chips-flex">
                ${chipsHTML}
            </div>
        </div>
    `;
}

function renderResult(el, r) {
    el.innerHTML = `
        <div class="metric">
            <b>${r.value.toLocaleString()}</b>
            <span>Maximum utility</span>
        </div>

        <div class="metric">
            <b>${r.weight.toLocaleString()} kg</b>
            <span>Selected load</span>
        </div>

        <div class="metric">
            <b>${r.nodes.toLocaleString()}</b>
            <span>Nodes explored</span>
        </div>

        <div class="metric">
            <b>${r.pruned.toLocaleString()}</b>
            <span>Pruned nodes</span>
        </div>

        <div class="metric">
            <b>${formatTime(r.time)}</b>
            <span>Execution time</span>
        </div>

        <div class="metric">
            <b>${r.taken.length}</b>
            <span>Supplies loaded</span>
        </div>
    `;
}

function renderSelection(el, r) {
    el.innerHTML = `
        <strong>Loaded supplies:</strong>
        ${
            r.taken.length
                ? r.taken.map(i => escapeHTML(i.name)).join(' · ')
                : 'No supplies'
        }
    `;
}

function renderDecisionSummary(items, taken, capacity, bbResult) {
    const container = document.querySelector('#decisionColumns');
    if (!container) return;

    const takenSet = new Set(taken.map(t => t.original !== undefined ? t.original : t.name));

    const loadedItems = [];
    const rejectedItems = [];

    items.forEach((it, idx) => {
        const idKey = it.original !== undefined ? it.original : it.name;
        if (takenSet.has(idKey)) {
            loadedItems.push(it);
        } else {
            rejectedItems.push(it);
        }
    });

    const loadedHTML = loadedItems.length
        ? loadedItems.map(it => `
            <div class="decision-card">
                <div class="decision-card-top">
                    <span class="decision-supply-name">✓ ${escapeHTML(it.name)}</span>
                    <span class="decision-supply-meta">${it.weight} kg · Priority ${it.value}</span>
                </div>
                <div class="decision-reason-text">
                    <strong>Optimal Selection:</strong> Included in the globally optimal combination that maximizes total utility within the ${capacity} kg payload limit.
                </div>
            </div>
        `).join('')
        : '<p style="color:var(--muted);font-size:0.85rem;padding:10px;">No supplies loaded within cargo capacity.</p>';

    const rejectedHTML = rejectedItems.length
        ? rejectedItems.map(it => {
            const reason = `Not part of the optimal combination: selecting this supply would displace higher-utility combinations, resulting in lower overall utility than ${bbResult.value}. (Specific capacity cutoffs and upper-bound pruning steps can be inspected in the Live Algorithm Visualization below).`;

            return `
                <div class="decision-card">
                    <div class="decision-card-top">
                        <span class="decision-supply-name">○ ${escapeHTML(it.name)}</span>
                        <span class="decision-supply-meta">${it.weight} kg · Priority ${it.value}</span>
                    </div>
                    <div class="decision-reason-text">
                        <strong>Allocation Note:</strong> ${reason}
                    </div>
                </div>
            `;
        }).join('')
        : '<p style="color:var(--muted);font-size:0.85rem;padding:10px;">All available supplies were loaded into the vehicle!</p>';

    container.innerHTML = `
        <div class="decision-col">
            <h3 class="decision-col-title loaded">✓ Loaded Supplies (${loadedItems.length})</h3>
            <div class="decision-list">${loadedHTML}</div>
        </div>
        <div class="decision-col">
            <h3 class="decision-col-title not-loaded">○ Not Loaded Supplies (${rejectedItems.length})</h3>
            <div class="decision-list">${rejectedHTML}</div>
        </div>
    `;
}

function renderChart(bt, bb) {
    const effortCallout = document.querySelector('#effortCallout');
    if (effortCallout) {
        if (bb.nodes < bt.nodes) {
            const diff = bt.nodes - bb.nodes;
            const pct = ((diff / bt.nodes) * 100).toFixed(1);
            effortCallout.textContent = `⚡ Branch & Bound explored fewer nodes for this mission (${bb.nodes.toLocaleString()} vs ${bt.nodes.toLocaleString()} nodes, saving ${pct}% search effort).`;
            effortCallout.style.borderLeftColor = 'var(--aqua)';
            effortCallout.style.background = '#eefbf9';
            effortCallout.style.color = '#0e6960';
        } else if (bt.nodes < bb.nodes) {
            effortCallout.textContent = `⚡ Backtracking explored fewer nodes for this mission (${bt.nodes.toLocaleString()} vs ${bb.nodes.toLocaleString()} nodes).`;
            effortCallout.style.borderLeftColor = 'var(--orange)';
            effortCallout.style.background = '#fff8f2';
            effortCallout.style.color = '#a24b10';
        } else {
            effortCallout.textContent = `⚖️ Both algorithms explored the exact same number of nodes (${bt.nodes.toLocaleString()}) for this mission.`;
            effortCallout.style.borderLeftColor = 'var(--navy)';
            effortCallout.style.background = '#f0f3fa';
            effortCallout.style.color = '#263b75';
        }
    }

    const maxNodes = Math.max(bt.nodes, bb.nodes, 1);
    const maxTime = Math.max(bt.time, bb.time, 0.01);

    const row = (label, a, b, max, fmt) => `
        <div class="chart-row">
            <span class="chart-label">${label}</span>
            <div class="bar-stack">
                <div class="bar-line">
                    <span class="bar" style="width:${Math.max(3, (a / max) * 100)}%"></span>
                    <small>Backtracking · ${fmt(a)}</small>
                </div>
                <div class="bar-line">
                    <span class="bar bb" style="width:${Math.max(3, (b / max) * 100)}%"></span>
                    <small>Branch &amp; Bound · ${fmt(b)}</small>
                </div>
            </div>
        </div>
    `;

    document.querySelector('#chart').innerHTML =
        row('Nodes explored', bt.nodes, bb.nodes, maxNodes, n => n.toLocaleString()) +
        row('Execution time', bt.time, bb.time, maxTime, formatTime);
}

function renderMissionSummary(scenarioKey, capacity, items, bt, bb) {
    const el = document.querySelector('#missionSummaryPanel');
    if (!el) return;

    const missionName = scenarios[scenarioKey] ? scenarios[scenarioKey].name : 'Custom Mission';
    const same = bt.value === bb.value && bt.weight === bb.weight;
    const notLoadedCount = Math.max(0, items.length - bt.taken.length);

    el.innerHTML = `
        <div class="mission-summary-header">
            <h3>MISSION SUMMARY</h3>
            <span class="mission-summary-badge">${escapeHTML(missionName)}</span>
        </div>
        <div class="mission-summary-grid">
            <div class="mission-summary-cell">
                <span>Mission</span>
                <strong>${escapeHTML(missionName)}</strong>
            </div>
            <div class="mission-summary-cell">
                <span>Vehicle Capacity</span>
                <strong>${capacity.toLocaleString()} kg</strong>
            </div>
            <div class="mission-summary-cell">
                <span>Optimal Load</span>
                <strong>${bt.weight.toLocaleString()} kg</strong>
            </div>
            <div class="mission-summary-cell">
                <span>Maximum Utility</span>
                <strong>${bt.value.toLocaleString()}</strong>
            </div>
            <div class="mission-summary-cell">
                <span>Supplies Loaded</span>
                <strong>${bt.taken.length}</strong>
            </div>
            <div class="mission-summary-cell">
                <span>Supplies Not Loaded</span>
                <strong>${notLoadedCount}</strong>
            </div>
            <div class="mission-summary-cell">
                <span>Search Method</span>
                <strong>Backtracking + Branch &amp; Bound</strong>
            </div>
        </div>
        <div class="mission-summary-footer">
            <span><strong>Verification:</strong> ${same ? '✓ Both exact solvers produced the same optimum' : '! Results differ — check inputs'}</span>
            <span>0/1 Knapsack Decision Support · DAA PBL #20</span>
        </div>
    `;
}

/* ---------------------------------------------------------
   VISUALIZATION DATA STORE
--------------------------------------------------------- */

let lastBacktrackingResult = null;
let lastBranchBoundResult = null;

/* ---------------------------------------------------------
   MAIN RUN
--------------------------------------------------------- */

function run() {
    try {
        message.textContent = '';

        const { capacity, items } = readProblem();

        const bt = backtracking(items, capacity);
        const bb = branchAndBound(items, capacity);

        /* Store traces for visualization */
        lastBacktrackingResult = bt;
        lastBranchBoundResult = bb;

        renderVehicleOverview(capacity, bt);

        renderResult(document.querySelector('#btMetrics'), bt);
        renderResult(document.querySelector('#bbMetrics'), bb);

        renderSelection(document.querySelector('#btSelection'), bt);
        renderSelection(document.querySelector('#bbSelection'), bb);

        renderDecisionSummary(items, bt.taken, capacity, bb);

        const same = bt.value === bb.value && bt.weight === bb.weight;

        const v = document.querySelector('#verification');
        v.textContent = same
            ? '✓ Verified: both exact solvers produced the same optimum'
            : '! Results differ — check inputs';
        v.className = `verification ${same ? 'verified' : 'failed'}`;

        renderChart(bt, bb);

        renderMissionSummary(currentScenarioKey, capacity, items, bt, bb);

        results.hidden = false;

        results.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });

        startVisualization();
    } catch(e) {
        results.hidden = true;
        visualizationPanel.hidden = true;
        message.textContent = e.message;
        message.style.color = '#c84038';
    }
}

/* ---------------------------------------------------------
   SCENARIOS & BUTTONS
--------------------------------------------------------- */

function loadScenario(key) {
    currentScenarioKey = key;
    const scenario = scenarios[key];
    if (!scenario) return;

    document.querySelectorAll('.scenario-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.scenario === key);
    });

    if (key !== 'custom') {
        capacityInput.value = scenario.capacity;
        body.innerHTML = '';
        scenario.items.forEach(it => itemRow(it));
        message.textContent = `Loaded preset: ${scenario.name} (${scenario.capacity} kg vehicle payload limit).`;
        message.style.color = 'var(--navy)';
    } else {
        message.textContent = 'Custom mission mode: configure your own vehicle capacity and supplies list.';
        message.style.color = 'var(--navy)';
    }

    results.hidden = true;
    visualizationPanel.hidden = true;
    stopAnimation();
}

document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.onclick = () => {
        loadScenario(btn.dataset.scenario);
    };
});

document.querySelector('#addItemBtn').onclick = () => {
    itemRow();
    markCustomScenario();
};

document.querySelector('#runBtn').onclick = run;

document.querySelector('#resetBtn').onclick = () => {
    capacityInput.value = '';
    body.innerHTML = '';
    itemRow();
    message.textContent = 'Inputs reset. Enter custom vehicle capacity and supplies.';
    message.style.color = 'var(--muted)';
    results.hidden = true;
    visualizationPanel.hidden = true;
    stopAnimation();
    loadScenario('custom');
};

/* =========================================================
   PHASE 1 — LIVE STATE-SPACE VISUALIZATION
========================================================= */

const visualizationPanel =
    document.querySelector('#visualizationPanel');

const stateTree =
    document.querySelector('#stateTree');

const visualAlgorithmTitle =
    document.querySelector('#visualAlgorithmTitle');

const visualizationStatus =
    document.querySelector('#visualizationStatus');

const traceCurrent =
    document.querySelector('#traceCurrent');

const traceTotal =
    document.querySelector('#traceTotal');

const selectedNodeTitle =
    document.querySelector('#selectedNodeTitle');

const nodeDetails =
    document.querySelector('#nodeDetails');

const upperBoundPanel =
    document.querySelector('#upperBoundPanel');

const btVisualBtn =
    document.querySelector('#btVisualBtn');

const bbVisualBtn =
    document.querySelector('#bbVisualBtn');

const playBtn =
    document.querySelector('#playBtn');

const pauseBtn =
    document.querySelector('#pauseBtn');

const stepBtn =
    document.querySelector('#stepBtn');

const restartVisualBtn =
    document.querySelector('#restartVisualBtn');

const speedControl =
    document.querySelector('#speedControl');

const speedValue =
    document.querySelector('#speedValue');


let visualAlgorithm = 'bt';

let visualTrace = [];

let visualIndex = 0;

let visualTimer = null;


/* ---------------------------------------------------------
   SELECT TRACE
--------------------------------------------------------- */

function getVisualTrace() {

    if (visualAlgorithm === 'bt') {

        return lastBacktrackingResult
            ? lastBacktrackingResult.trace
            : [];

    }

    return lastBranchBoundResult
        ? lastBranchBoundResult.trace
        : [];
}


/* ---------------------------------------------------------
   SHOW VISUALIZATION
--------------------------------------------------------- */

function startVisualization() {

    if (!lastBacktrackingResult ||
        !lastBranchBoundResult) {

        return;
    }

    visualizationPanel.hidden = false;

    visualTrace = getVisualTrace();

    visualIndex = 0;

    renderTree();

    showNode(null);

    visualizationStatus.textContent =
        `${visualTrace.length} execution nodes`;

    visualizationPanel.scrollIntoView({
        behavior:'smooth',
        block:'start'
    });
}


/* ---------------------------------------------------------
   SWITCH ALGORITHM
--------------------------------------------------------- */

function switchVisualAlgorithm(type) {

    stopAnimation();

    visualAlgorithm = type;

    visualTrace = getVisualTrace();

    visualIndex = 0;

    if (type === 'bt') {

        btVisualBtn.classList.add('active');
        bbVisualBtn.classList.remove('active');

        visualAlgorithmTitle.textContent =
            'Backtracking';

    } else {

        bbVisualBtn.classList.add('active');
        btVisualBtn.classList.remove('active');

        visualAlgorithmTitle.textContent =
            'Branch & Bound';
    }

    renderTree();

    showNode(null);

    visualizationStatus.textContent =
        `${visualTrace.length} execution nodes`;
}


/* ---------------------------------------------------------
   BUILD TREE
--------------------------------------------------------- */

function renderTree() {

    visualTrace = getVisualTrace();

    stateTree.innerHTML = '';


    if (!visualTrace.length) {

        stateTree.innerHTML = `
            <div class="tree-empty">
                No execution trace available.
            </div>
        `;

        traceCurrent.textContent = '0';
        traceTotal.textContent = '0';

        return;
    }


    /*
       -------------------------------------------------------
       BUILD PARENT → CHILD RELATIONSHIPS
       -------------------------------------------------------
    */

    const nodeMap =
        new Map();

    visualTrace.forEach(node => {

        nodeMap.set(
            node.id,
            node
        );
    });


    const children =
        new Map();


    visualTrace.forEach(node => {

        if (
            node.parentId !== null &&
            nodeMap.has(node.parentId)
        ) {

            if (
                !children.has(node.parentId)
            ) {

                children.set(
                    node.parentId,
                    []
                );
            }


            children
                .get(node.parentId)
                .push(node);
        }
    });


    /*
       -------------------------------------------------------
       CALCULATE TREE POSITIONS
       -------------------------------------------------------
    */

    const positions =
        new Map();

    const nodeWidth = 120;
    const nodeHeight = 82;
    const horizontalGap = 20;
    const verticalGap = 130;

    let nextLeafX = 0;


    function positionNode(node, depth) {

        const nodeChildren =
            children.get(node.id) || [];


        /*
           Leaf or currently visible endpoint.
        */

        if (!nodeChildren.length) {

            const x =
                nextLeafX;

            nextLeafX +=
                nodeWidth + horizontalGap;


            positions.set(
                node.id,
                {
                    x,
                    y: depth * verticalGap
                }
            );


            return x;
        }


        /*
           Position children first.
        */

        const childXs =
            nodeChildren.map(
                child =>
                    positionNode(
                        child,
                        depth + 1
                    )
            );


        /*
           Parent is centered above its children.
        */

        const first =
            childXs[0];

        const last =
            childXs[
                childXs.length - 1
            ];


        const x =
            (first + last) / 2;


        positions.set(
            node.id,
            {
                x,
                y: depth * verticalGap
            }
        );


        return x;
    }


    /*
       Find root.
    */

    const root =
        visualTrace.find(
            node =>
                node.parentId === null
        );


    if (root) {

        positionNode(root, 0);
    }


    /*
       -------------------------------------------------------
       CANVAS SIZE
       -------------------------------------------------------
    */

    const maxDepth =
        Math.max(
            ...visualTrace.map(
                node => node.level
            ),
            0
        );


    const treeContentWidth =
    nextLeafX + nodeWidth;

    const canvasWidth =
        Math.max(
            treeContentWidth + 120,
            900
        );


    const canvasHeight =
        Math.max(
            (maxDepth + 1) *
                verticalGap +
                80,
            500
        );


    /*
       -------------------------------------------------------
       CREATE CANVAS
       -------------------------------------------------------
    */

    const canvas =
        document.createElement('div');

    canvas.className =
        'tree-canvas';

    canvas.style.width =
        `${canvasWidth}px`;

    canvas.style.height =
        `${canvasHeight}px`;

    canvas.style.marginLeft = '40px';

    canvas.style.marginRight = '40px';

    if (typeof treeZoom === 'number' && treeZoom !== 1) {
        canvas.style.transform = `scale(${treeZoom})`;
        canvas.style.transformOrigin = 'top center';
    }


    /*
       SVG for actual connecting lines.
    */

    const svg =
        document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg'
        );

    svg.classList.add(
        'tree-svg'
    );

    svg.setAttribute(
        'width',
        canvasWidth
    );

    svg.setAttribute(
        'height',
        canvasHeight
    );


    canvas.appendChild(svg);


    /*
       -------------------------------------------------------
       DRAW EDGES
       -------------------------------------------------------
    */

    visualTrace.forEach(node => {

        if (
            node.parentId === null ||
            !positions.has(node.id) ||
            !positions.has(node.parentId)
        ) {

            return;
        }


        const parent =
            positions.get(
                node.parentId
            );

        const child =
            positions.get(
                node.id
            );


        const x1 =
            parent.x + nodeWidth / 2;

        const y1 =
            parent.y + nodeHeight;

        const x2 =
            child.x + nodeWidth / 2;

        const y2 =
            child.y;


        /*
           Curved connection.

           This makes the tree easier to read
           than straight diagonal lines.
        */

        const middleY =
            (y1 + y2) / 2;


        const path =
            document.createElementNS(
                'http://www.w3.org/2000/svg',
                'path'
            );


        path.setAttribute(
            'd',
            `
                M ${x1} ${y1}
                C ${x1} ${middleY},
                  ${x2} ${middleY},
                  ${x2} ${y2}
            `
        );


        path.classList.add(
            'tree-edge'
        );


        if (
            node.decision === 'TAKE'
        ) {

            path.classList.add(
                'take'
            );

        } else {

            path.classList.add(
                'skip'
            );
        }


        if (
            node.status === 'PRUNE'
        ) {

            path.classList.add(
                'pruned'
            );
        }


        path.dataset.parent =
            node.parentId;

        path.dataset.child =
            node.id;


        svg.appendChild(path);


        /*
           Edge label
        */

        const label =
            document.createElement('div');

        label.className =
            `tree-edge-label ${
                node.decision === 'TAKE'
                    ? 'take'
                    : 'skip'
            }`;

        label.textContent =
            node.decision;


        label.style.left =
            `${(x1 + x2) / 2}px`;

        label.style.top =
            `${middleY}px`;


        label.dataset.parent =
            node.parentId;

        label.dataset.child =
            node.id;


        canvas.appendChild(label);
    });


    /*
       -------------------------------------------------------
       ADD NODES
       -------------------------------------------------------
    */

    visualTrace.forEach(node => {

        const position =
            positions.get(
                node.id
            );


        if (!position) {
            return;
        }


        const nodeElement =
            createNodeElement(node);


        nodeElement.style.left =
            `${position.x}px`;

        nodeElement.style.top =
            `${position.y}px`;


        canvas.appendChild(
            nodeElement
        );
    });


    stateTree.appendChild(
        canvas
    );


    traceTotal.textContent =
        visualTrace.length;


    updateVisibleNodes();
}


/* ---------------------------------------------------------
   CREATE NODE
--------------------------------------------------------- */

function createNodeElement(node) {

    const div =
        document.createElement('div');

    div.className =
        `state-node ${node.status.toLowerCase()}`;

    div.dataset.nodeId = node.id;


    let statusClass =
        'status-explore';

    let statusText =
        'EXPLORE';


    if (node.status === 'PRUNE') {

        statusClass = 'status-prune';
        statusText = 'PRUNE';

    } else if (node.status === 'BEST') {

        statusClass = 'status-best';
        statusText = 'BEST';

    } else if (node.status === 'LEAF') {

        statusClass = 'status-leaf';
        statusText = 'LEAF';
    }


    const decision =
        node.decision === 'ROOT'
            ? 'START'
            : node.decision;


    div.innerHTML = `

        <div class="node-top">

            <span class="node-id">
                Node #${node.id}
            </span>

            <span class="node-status ${statusClass}">
                ${statusText}
            </span>

        </div>


        <div class="node-decision">
            ${decision}
        </div>


        <div class="node-item">
            ${
                node.item
                    ? escapeHTML(node.item)
                    : 'All supplies decided'
            }
        </div>


        <div class="node-values">

            <span>
                Load:
                <strong>${node.weight}kg</strong>
            </span>

            <span>
                Utility:
                <strong>${node.value}</strong>
            </span>

        </div>

    `;


    div.onclick = () => {

        selectVisualNode(node.id);
    };


    return div;
}


/* ---------------------------------------------------------
   HIDE FUTURE NODES
--------------------------------------------------------- */

function updateVisibleNodes() {

    const nodeElements =
        stateTree.querySelectorAll(
            '.state-node'
        );


    nodeElements.forEach(el => {

        const id =
            Number(
                el.dataset.nodeId
            );


        const node =
            visualTrace.find(
                n => n.id === id
            );


        if (!node) {
            return;
        }


        const order =
            node.executionOrder !== undefined
                ? node.executionOrder
                : node.id;


        if (order < visualIndex) {

            el.style.opacity = '1';

        } else {

            el.style.opacity = '.22';
        }
    });


    /*
       Also fade future connecting lines.
    */

    stateTree
        .querySelectorAll('.tree-edge')
        .forEach(edge => {

            const childId =
                Number(
                    edge.dataset.child
                );


            const child =
                visualTrace.find(
                    n => n.id === childId
                );


            if (!child) {
                return;
            }


            const order =
                child.executionOrder !== undefined
                    ? child.executionOrder
                    : child.id;


            edge.style.opacity =
                order < visualIndex
                    ? '1'
                    : '.2';
        });


    stateTree
        .querySelectorAll('.tree-edge-label')
        .forEach(label => {

            const childId =
                Number(
                    label.dataset.child
                );


            const child =
                visualTrace.find(
                    n => n.id === childId
                );


            if (!child) {
                return;
            }


            const order =
                child.executionOrder !== undefined
                    ? child.executionOrder
                    : child.id;


            label.style.opacity =
                order < visualIndex
                    ? '1'
                    : '.2';
        });


    traceCurrent.textContent =
        Math.min(
            visualIndex,
            visualTrace.length
        );
}


/* ---------------------------------------------------------
   SELECT NODE
--------------------------------------------------------- */

function selectVisualNode(id) {

    const index =
        visualTrace.findIndex(
            node => node.id === id
        );

    if (index === -1) {
        return;
    }

    visualIndex = index;

    const node =
        visualTrace[index];

    showNode(node);

    updateVisibleNodes();

    highlightNode(id);
}


/* ---------------------------------------------------------
   SHOW NODE DETAILS
--------------------------------------------------------- */

function showNode(node) {
    if (!node) {
        selectedNodeTitle.textContent = 'No node selected';
        nodeDetails.innerHTML = `
            <div class="detail-empty">
                Press <strong>Play</strong> or <strong>Next</strong> to inspect a node.
            </div>
        `;
        upperBoundPanel.hidden = true;
        return;
    }

    selectedNodeTitle.textContent = `Node #${node.id}`;

    const currentElement = stateTree.querySelector(`[data-node-id="${node.id}"]`);
    if (currentElement) {
        currentElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });
    }

    const capacity = Number(capacityInput.value) || 500;
    const remainingCap = Math.max(0, capacity - node.weight);

    let statusDisplay = node.status;
    let methodExplanationHTML = '';

    if (visualAlgorithm === 'bt') {
        if (node.status === 'PRUNE') {
            statusDisplay = '🚫 PRUNED';
            methodExplanationHTML = `
                <div class="execution-reason" style="background:#fff0ee;color:#bd4c45;border:1px solid #ffd0cc;">
                    <strong>PRUNED:</strong> This branch exceeds the vehicle's cargo capacity.<br>
                    <small>Reason: current load (${node.weight} kg) exceeds vehicle payload limit (${capacity} kg).</small>
                </div>
            `;
        } else if (node.status === 'BEST') {
            statusDisplay = '★ OPTIMAL';
            methodExplanationHTML = `
                <div class="execution-reason" style="background:#daf7ed;color:#0c6a4f;border:1px solid #b7ecd9;">
                    <strong>OPTIMAL LOAD UPDATE:</strong> Feasible combination achieving maximum utility ${node.bestValue} (${node.bestWeight} kg).
                </div>
            `;
        } else {
            statusDisplay = node.status === 'EXPLORE' ? '✓ EXPLORE' : node.status;
            methodExplanationHTML = `
                <div class="execution-reason">
                    <strong>Backtracking search:</strong> Explores TAKE/SKIP decisions depth-first.
                </div>
            `;
        }
    } else {
        // Branch & Bound
        if (node.status === 'PRUNE') {
            statusDisplay = '🚫 PRUNED';
            let reasonText = node.reason;
            if (!reasonText) {
                reasonText = node.weight > capacity
                    ? 'Current load exceeds vehicle cargo capacity.'
                    : 'Branch pruned because even its optimistic upper bound cannot improve the current best solution.';
            }
            methodExplanationHTML = `
                <div class="execution-reason" style="background:#fff0ee;color:#bd4c45;border:1px solid #ffd0cc;">
                    <strong>PRUNED:</strong> ${escapeHTML(reasonText)}
                </div>
            `;
        } else if (node.status === 'BEST') {
            statusDisplay = '★ OPTIMAL';
            methodExplanationHTML = `
                <div class="execution-reason" style="background:#daf7ed;color:#0c6a4f;border:1px solid #b7ecd9;">
                    <strong>OPTIMAL SOLUTION FOUND:</strong> Complete cargo plan achieving highest possible utility (${node.bestValue}).
                </div>
            `;
        } else {
            statusDisplay = '✓ EXPLORE';
            methodExplanationHTML = `
                <div class="execution-reason">
                    <strong>Branch &amp; Bound search:</strong> Best-first expansion prioritized by highest optimistic fractional upper bound.
                </div>
            `;
        }
    }

    nodeDetails.innerHTML = `
        <div class="detail-grid">
            <div class="detail-cell">
                <span>Decision</span>
                <strong>${node.decision === 'ROOT' ? 'START' : node.decision}</strong>
            </div>

            <div class="detail-cell">
                <span>Decision Level</span>
                <strong>Level ${node.level}</strong>
            </div>

            <div class="detail-cell">
                <span>Current Load</span>
                <strong>${node.weight} kg</strong>
            </div>

            <div class="detail-cell">
                <span>Current Utility</span>
                <strong>${node.value}</strong>
            </div>

            <div class="detail-cell">
                <span>Remaining Capacity</span>
                <strong>${remainingCap} kg</strong>
            </div>

            <div class="detail-cell">
                <span>Status</span>
                <strong>${statusDisplay}</strong>
            </div>
        </div>

        ${
            node.item
                ? `
                    <div class="execution-reason">
                        <strong>Supply:</strong>
                        ${escapeHTML(node.item)}
                    </div>
                  `
                : '<div class="execution-reason"><strong>Supply:</strong> All supplies evaluated</div>'
        }

        ${methodExplanationHTML}
    `;

    if (visualAlgorithm === 'bb') {
        renderUpperBound(node);
    } else {
        upperBoundPanel.hidden = true;
    }

    highlightNode(node.id);
}

function highlightNode(id) {
    stateTree.querySelectorAll('.state-node').forEach(el => {
        el.classList.toggle('active', Number(el.dataset.nodeId) === id);
    });

    const active = stateTree.querySelector(`.state-node[data-node-id="${id}"]`);
    if (active) {
        const treeRect = stateTree.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();

        const targetScrollLeft = stateTree.scrollLeft + (activeRect.left - treeRect.left) - (treeRect.width / 2) + (activeRect.width / 2);
        const targetScrollTop = stateTree.scrollTop + (activeRect.top - treeRect.top) - (treeRect.height / 2) + (activeRect.height / 2);

        stateTree.scrollTo({
            left: Math.max(0, targetScrollLeft),
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
        });
    }
}

function renderUpperBound(node) {
    upperBoundPanel.hidden = false;

    const capacity = Number(capacityInput.value) || 500;
    const remainingCap = node.remainingCapacity !== undefined
        ? node.remainingCapacity
        : Math.max(0, capacity - node.weight);

    document.querySelector('#boundDecision').textContent =
        node.decision === 'ROOT' ? 'START' : node.decision;

    document.querySelector('#boundCurrentValue').textContent =
        node.value;

    document.querySelector('#boundCurrentWeight').textContent =
        `${node.weight} kg`;

    document.querySelector('#boundRemaining').textContent =
        `${remainingCap} kg`;

    const boundNum = Number.isFinite(node.bound) ? node.bound : null;
    const boundStr = boundNum !== null ? boundNum.toFixed(2) : '—';
    document.querySelector('#boundValue').textContent = boundStr;

    const best = node.bestValue !== undefined
        ? node.bestValue
        : getBestValueAtNode(node.id);

    document.querySelector('#boundBest').textContent = best;

    const steps = document.querySelector('#boundSteps');

    if (!node.boundSteps || !node.boundSteps.length) {
        steps.innerHTML = `
            <div class="bound-step">
                <span>Current utility</span>
                <strong>${node.value}</strong>
            </div>
        `;
    } else {
        steps.innerHTML = node.boundSteps.map(step => {
            if (step.type === 'FULL') {
                return `
                    <div class="bound-step">
                        <span>+ ${escapeHTML(step.item)} <small>(full · ${step.weight} kg)</small></span>
                        <strong>+${step.amount.toFixed(1)}</strong>
                    </div>
                `;
            }
            return `
                <div class="bound-step">
                    <span>+ ${escapeHTML(step.item)} <small>(${step.weight} kg · ${(step.fraction * 100).toFixed(0)}%)</small></span>
                    <strong>+${step.amount.toFixed(1)}</strong>
                </div>
            `;
        }).join('');
    }

    const reason = document.querySelector('#boundReason');

    if (node.status === 'PRUNE') {
        reason.className = 'bound-reason pruned';
        if (node.weight > capacity) {
            reason.innerHTML = `🚫 <strong>Branch Pruned:</strong> Exceeds cargo capacity (${node.weight} kg > ${capacity} kg limit).`;
        } else {
            reason.innerHTML = `🚫 <strong>Branch Pruned:</strong> Upper bound (${boundStr}) &lt; Current Best (${best}). Branch pruned because even its optimistic upper bound cannot improve the current best solution.`;
        }
    } else {
        reason.className = 'bound-reason';
        if (boundNum !== null && boundNum >= best) {
            reason.innerHTML = `✓ <strong>Potentially Promising:</strong> Upper bound (${boundStr} ≥ ${best}) can still reach or exceed the current best solution.`;
        } else {
            reason.innerHTML = `✓ <strong>Active Evaluation:</strong> Node is under exploration.`;
        }
    }
}


/* ---------------------------------------------------------
   FIND BEST VALUE AT CURRENT POINT
--------------------------------------------------------- */

function getBestValueAtNode(id) {

    const index =
        visualTrace.findIndex(
            node => node.id === id
        );


    if (index === -1) {
        return 0;
    }


    let best = 0;


    for (let i = 0; i <= index; i++) {

        const node =
            visualTrace[i];


        if (
            node &&
            node.bestAfter !== undefined
        ) {

            best =
                Math.max(
                    best,
                    node.bestAfter
                );
        }
    }


    return best;
}


/* ---------------------------------------------------------
   NEXT STEP
--------------------------------------------------------- */

function nextVisualStep() {

    if (!visualTrace.length) {
        return;
    }


    if (
        visualIndex >=
        visualTrace.length
    ) {

        stopAnimation();

        visualizationStatus.textContent =
            'Execution complete';

        return;
    }


    const node =
        visualTrace[
            visualIndex
        ];


    showNode(node);


    /*
       The current node is now visible.
    */

    visualIndex++;


    updateVisibleNodes();


    if (
        visualIndex >=
        visualTrace.length
    ) {

        visualizationStatus.textContent =
            'Execution complete';

    } else {

        visualizationStatus.textContent =
            `Executing node ${
                visualIndex
            } of ${
                visualTrace.length
            }`;
    }
}


/* ---------------------------------------------------------
   PLAY
--------------------------------------------------------- */

function playVisualization() {

    if (!visualTrace.length) {
        return;
    }


    if (visualIndex >= visualTrace.length) {

        visualIndex = 0;

        updateVisibleNodes();
    }


    stopAnimation();


    visualizationStatus.textContent =
        'Running...';


    visualTimer =
        setInterval(
            nextVisualStep,
            Number(speedControl.value)
        );
}


/* ---------------------------------------------------------
   PAUSE
--------------------------------------------------------- */

function stopAnimation() {

    if (visualTimer !== null) {

        clearInterval(visualTimer);

        visualTimer = null;
    }
}


/* ---------------------------------------------------------
   RESTART
--------------------------------------------------------- */

function restartVisualization() {

    stopAnimation();

    visualIndex = 0;

    visualTrace = getVisualTrace();

    renderTree();

    showNode(null);

    visualizationStatus.textContent =
        'Ready';
}


/* ---------------------------------------------------------
   SPEED
--------------------------------------------------------- */

speedControl.oninput = () => {

    speedValue.textContent =
        `${speedControl.value} ms`;


    if (visualTimer !== null) {

        playVisualization();
    }
};


/* ---------------------------------------------------------
   EVENT LISTENERS
--------------------------------------------------------- */

btVisualBtn.onclick =
    () => switchVisualAlgorithm('bt');


bbVisualBtn.onclick =
    () => switchVisualAlgorithm('bb');


playBtn.onclick =
    playVisualization;


pauseBtn.onclick =
    () => {

        stopAnimation();

        visualizationStatus.textContent =
            'Paused';
    };


stepBtn.onclick =
    () => {

        stopAnimation();

        nextVisualStep();
    };


restartVisualBtn.onclick =
    restartVisualization;

/* ---------------------------------------------------------
   TREE ZOOM CONTROLS
--------------------------------------------------------- */

let treeZoom = 1;

function applyTreeZoom(delta) {
    if (delta === 0) {
        treeZoom = 1;
    } else {
        treeZoom = Math.min(1.6, Math.max(0.4, Number((treeZoom + delta).toFixed(2))));
    }

    const canvas = stateTree.querySelector('.tree-canvas');
    if (canvas) {
        canvas.style.transform = `scale(${treeZoom})`;
        canvas.style.transformOrigin = 'top center';
    }

    const zoomVal = document.querySelector('#zoomValue');
    if (zoomVal) {
        zoomVal.textContent = `${Math.round(treeZoom * 100)}%`;
    }
}

const zoomInBtn = document.querySelector('#zoomInBtn');
if (zoomInBtn) zoomInBtn.onclick = () => applyTreeZoom(0.15);

const zoomOutBtn = document.querySelector('#zoomOutBtn');
if (zoomOutBtn) zoomOutBtn.onclick = () => applyTreeZoom(-0.15);

const zoomResetBtn = document.querySelector('#zoomResetBtn');
if (zoomResetBtn) zoomResetBtn.onclick = () => applyTreeZoom(0);

/* ---------------------------------------------------------
   DEFAULT INITIALIZATION
--------------------------------------------------------- */

loadScenario('disaster');
