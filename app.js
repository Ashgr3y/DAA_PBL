/* DAA PBL #20: Exact 0/1 solvers.
   No dynamic programming is used. */

const body = document.querySelector('#itemsBody');
const capacityInput = document.querySelector('#capacity');
const message = document.querySelector('#message');
const results = document.querySelector('#results');

const demoItems = [
    {name:'Camera',weight:2,value:40},
    {name:'Laptop',weight:3,value:50},
    {name:'Water',weight:4,value:35},
    {name:'Jacket',weight:5,value:10},
    {name:'Food Pack',weight:9,value:80},
    {name:'First-aid Kit',weight:7,value:65}
];


/* ---------------------------------------------------------
   INPUT / TABLE FUNCTIONS
--------------------------------------------------------- */

function itemRow(item={name:'',weight:'',value:''}) {

    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td>
            <input aria-label="Item name"
                   value="${escapeHTML(item.name)}"
                   placeholder="e.g. Laptop">
        </td>

        <td>
            <input aria-label="Item weight"
                   type="number"
                   min="1"
                   step="1"
                   value="${item.weight}"
                   placeholder="kg">
        </td>

        <td>
            <input aria-label="Item value"
                   type="number"
                   min="0"
                   step="1"
                   value="${item.value}"
                   placeholder="₹">
        </td>

        <td>
            <button class="delete"
                    title="Remove item"
                    aria-label="Remove item">×</button>
        </td>
    `;

    tr.querySelector('.delete').onclick = () => tr.remove();

    body.append(tr);
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

        throw Error('Capacity must be a positive whole number.');
    }

    if (!rows.length) {
        throw Error('Add at least one item before running the solvers.');
    }

    if (rows.length > 28) {
        throw Error(
            'For a responsive classroom demo, use 28 items or fewer.'
        );
    }

    const items = rows.map((r,i) => {

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
                `Item ${i+1} needs a name, positive whole weight, and non-negative whole value.`
            );
        }

        return {
            name,
            weight,
            value,
            original:i
        };
    });

    return {capacity,items};
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
            node.reason = 'Weight exceeds capacity';

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
                'Upper bound cannot beat current best value.'
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
                'Weight exceeds capacity.'
            );

        } else if (
            take.bound < bestValue
        ) {

            pruned++;

            record(
                take,
                'PRUNE',
                'Upper bound cannot beat current best value.'
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
                'Upper bound cannot beat current best value.'
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


function renderResult(el,r) {

    el.innerHTML = `
        <div class="metric">
            <b>${r.value}</b>
            <span>Optimal value</span>
        </div>

        <div class="metric">
            <b>${r.weight}</b>
            <span>Total weight</span>
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
            <span>Items selected</span>
        </div>
    `;
}


function renderSelection(el,r) {

    el.innerHTML = `
        <strong>Selected:</strong>
        ${
            r.taken.length
                ? r.taken.map(i => i.name).join(' · ')
                : 'No items'
        }
    `;
}


function renderChart(bt,bb) {

    const maxNodes =
        Math.max(bt.nodes,bb.nodes,1);

    const maxTime =
        Math.max(bt.time,bb.time,.01);


    const row = (
        label,
        a,
        b,
        max,
        fmt
    ) => `

        <div class="chart-row">

            <span class="chart-label">
                ${label}
            </span>

            <div class="bar-stack">

                <div class="bar-line">

                    <span
                        class="bar"
                        style="width:${Math.max(
                            3,
                            a/max*100
                        )}%">
                    </span>

                    <small>
                        Backtracking · ${fmt(a)}
                    </small>

                </div>


                <div class="bar-line">

                    <span
                        class="bar bb"
                        style="width:${Math.max(
                            3,
                            b/max*100
                        )}%">
                    </span>

                    <small>
                        Branch &amp; Bound · ${fmt(b)}
                    </small>

                </div>

            </div>

        </div>
    `;


    document.querySelector('#chart').innerHTML =
        row(
            'Nodes explored',
            bt.nodes,
            bb.nodes,
            maxNodes,
            n => n.toLocaleString()
        )
        +
        row(
            'Execution time',
            bt.time,
            bb.time,
            maxTime,
            formatTime
        );
}


/* ---------------------------------------------------------
   PHASE 1: VISUALIZATION PLACEHOLDER
--------------------------------------------------------- */

/*
   These variables will hold the results so the new
   visualization can use them.
*/

let lastBacktrackingResult = null;
let lastBranchBoundResult = null;


/* ---------------------------------------------------------
   MAIN RUN
--------------------------------------------------------- */

function run() {

    try {

        message.textContent = '';

        const {capacity,items} = readProblem();

        const bt =
            backtracking(items,capacity);

        const bb =
            branchAndBound(items,capacity);


        /* Store traces for visualization */
        lastBacktrackingResult = bt;
        lastBranchBoundResult = bb;


        renderResult(
            document.querySelector('#btMetrics'),
            bt
        );

        renderResult(
            document.querySelector('#bbMetrics'),
            bb
        );


        renderSelection(
            document.querySelector('#btSelection'),
            bt
        );

        renderSelection(
            document.querySelector('#bbSelection'),
            bb
        );


        const same =
            bt.value === bb.value &&
            bt.weight === bb.weight;


        const v =
            document.querySelector('#verification');


        v.textContent =
            same
                ? '✓ Verified: both found the same optimum'
                : '! Results differ — check inputs';


        v.className =
            `verification ${same?'verified':'failed'}`;


        renderChart(bt,bb);

        results.hidden = false;

        results.scrollIntoView({
            behavior:'smooth',
            block:'start'
        });

        startVisualization();


        console.log(
            'Backtracking trace:',
            bt.trace
        );

        console.log(
            'Branch & Bound trace:',
            bb.trace
        );

    }

    catch(e) {

        results.hidden = true;

        message.textContent =
            e.message;
    }
}


/* ---------------------------------------------------------
   BUTTONS
--------------------------------------------------------- */

document.querySelector('#addItemBtn').onclick =
    () => itemRow();


document.querySelector('#runBtn').onclick =
    run;


document.querySelector('#demoBtn').onclick =
    () => {

        capacityInput.value = 15;

        body.innerHTML = '';

        demoItems.forEach(itemRow);

        message.textContent =
            'Demo loaded: try running both solvers.';

        results.hidden = true;
    };


document.querySelector('#resetBtn').onclick =
    () => {

        capacityInput.value = '';

        body.innerHTML = '';

        itemRow();

        message.textContent = '';

        results.hidden = true;
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
    const horizontalGap = 22;
    const verticalGap = 115;

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
            parent.y + 95;

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
                    ? node.item
                    : 'All items decided'
            }
        </div>


        <div class="node-values">

            <span>
                W:
                <strong>${node.weight}</strong>
            </span>

            <span>
                V:
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

        selectedNodeTitle.textContent =
            'No node selected';

        nodeDetails.innerHTML = `
            <div class="detail-empty">
                Press <strong>Play</strong> or
                <strong>Next</strong> to inspect a node.
            </div>
        `;

        upperBoundPanel.hidden = true;

        return;
    }


    selectedNodeTitle.textContent =
        `Node #${node.id}`;

    const currentElement =
        stateTree.querySelector(
            `[data-node-id="${node.id}"]`
        );

    if (currentElement) {

        currentElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });
    }


    nodeDetails.innerHTML = `

        <div class="detail-grid">

            <div class="detail-cell">
                <span>Decision</span>
                <strong>${node.decision}</strong>
            </div>

            <div class="detail-cell">
                <span>Level</span>
                <strong>${node.level}</strong>
            </div>

            <div class="detail-cell">
                <span>Current weight</span>
                <strong>${node.weight}</strong>
            </div>

            <div class="detail-cell">
                <span>Current value</span>
                <strong>${node.value}</strong>
            </div>

        </div>

        ${
            node.item
                ? `
                    <div class="execution-reason">
                        <strong>Item:</strong>
                        ${escapeHTML(node.item)}
                    </div>
                  `
                : ''
        }

        <div class="execution-reason">
            <strong>Status:</strong>
            ${node.status}
            ${
                node.reason
                    ? ` — ${node.reason}`
                    : ''
            }
        </div>
    `;


    if (visualAlgorithm === 'bb') {

        renderUpperBound(node);

    } else {

        upperBoundPanel.hidden = true;
    }


    highlightNode(node.id);
}


/* ---------------------------------------------------------
   HIGHLIGHT NODE
--------------------------------------------------------- */

function highlightNode(id) {

    stateTree
        .querySelectorAll('.state-node')
        .forEach(el => {

            el.classList.toggle(
                'active',
                Number(el.dataset.nodeId) === id
            );
        });


    const active =
        stateTree.querySelector(
            `.state-node[data-node-id="${id}"]`
        );


    if (active) {

        active.scrollIntoView({
            behavior:'smooth',
            block:'nearest',
            inline:'center'
        });
    }
}


/* ---------------------------------------------------------
   BRANCH & BOUND UPPER-BOUND PANEL
--------------------------------------------------------- */

function renderUpperBound(node) {

    upperBoundPanel.hidden = false;


    document.querySelector('#boundDecision')
        .textContent =
            node.decision === 'ROOT'
                ? 'ROOT'
                : node.decision;


    document.querySelector('#boundCurrentValue')
        .textContent =
            node.value;


    document.querySelector('#boundCurrentWeight')
        .textContent =
            node.weight;


    document.querySelector('#boundRemaining')
        .textContent =
            node.remainingCapacity;


    document.querySelector('#boundValue')
        .textContent =
            Number.isFinite(node.bound)
                ? node.bound.toFixed(2)
                : '∞';


    /*
       bestValue is stored when the algorithm
       discovers a better solution.

       For nodes without an explicit bestValue,
       we show the best solution currently known
       up to this point.
    */

    const best =
        node.bestValue !== undefined
            ? node.bestValue
            : getBestValueAtNode(node.id);


    document.querySelector('#boundBest')
        .textContent =
            best;


    const steps =
        document.querySelector('#boundSteps');


    if (!node.boundSteps ||
        !node.boundSteps.length) {

        steps.innerHTML = `
            <div class="bound-step">
                <span>Current value</span>
                <strong>${node.value}</strong>
            </div>
        `;

    } else {

        steps.innerHTML =
            node.boundSteps.map(step => {

                if (step.type === 'FULL') {

                    return `
                        <div class="bound-step">

                            <span>
                                + ${escapeHTML(step.item)}
                                <small>(full)</small>
                            </span>

                            <strong>
                                +${step.amount.toFixed(2)}
                            </strong>

                        </div>
                    `;

                }


                return `
                    <div class="bound-step">

                        <span>
                            + ${escapeHTML(step.item)}
                            <small>
                                (${(step.fraction * 100).toFixed(1)}%)
                            </small>
                        </span>

                        <strong>
                            +${step.amount.toFixed(2)}
                        </strong>

                    </div>
                `;

            }).join('');
    }


    const reason =
        document.querySelector('#boundReason');


    if (node.status === 'PRUNE') {

        reason.className =
            'bound-reason pruned';

        reason.textContent =
            `✕ PRUNE — ${node.reason}`;

    } else {

        reason.className =
            'bound-reason';

        if (
            Number.isFinite(node.bound) &&
            node.bound >= best
        ) {

            reason.textContent =
                '✓ EXPLORE — Upper bound can still reach or exceed the current best.';

        } else {

            reason.textContent =
                '✓ Node is being evaluated.';

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
    
demoItems.forEach(itemRow);
