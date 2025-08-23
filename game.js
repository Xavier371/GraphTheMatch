class BipartiteMatchingGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Game state
        this.setASize = 2;
        this.setBSize = 3;
        this.nodeRadius = 20;
        this.nodes = { A: [], B: [] };
        this.edges = [];
        this.highlightedEdges = new Set();
        
        // Interaction states
        this.isDragging = false;
        this.draggedNode = null;
        this.isEditingWeight = false;
        this.editingEdge = null;
        this.lastTap = 0;
        this.lastEdgeClicked = null;
        
        // Add mobile detection
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        // Adjust node radius for mobile
        if (this.isMobile) {
            this.nodeRadius = 15; // Smaller nodes on mobile
        }
        
        // Initialize game
        this.resizeCanvas();
        this.initializeGraph();
        
        // Create max score display
        const scoreDisplay = document.querySelector('.score-display');
        if (!document.getElementById('maxScore')) {
            const maxScoreDiv = document.createElement('div');
            maxScoreDiv.innerHTML = `Max Score: <span id="maxScore">?</span>`;
            scoreDisplay.appendChild(maxScoreDiv);
        }
        
        // Create win message element
        if (!document.getElementById('winMessage')) {
            const winMessageDiv = document.createElement('div');
            winMessageDiv.id = 'winMessage';
            winMessageDiv.style.display = 'none';
            scoreDisplay.appendChild(winMessageDiv);
        }
        
        // Event listeners
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleStart(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleEnd(e));
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleEnd(e));
        this.canvas.addEventListener('touchcancel', (e) => this.handleEnd(e));
        
        // Global click/touch handler
        document.addEventListener('click', (e) => this.handleGlobalClick(e));
        document.addEventListener('touchend', (e) => this.handleGlobalClick(e));
        
        // Button handlers
        document.getElementById('toggleInstructions').addEventListener('click', () => this.toggleInstructions());
        document.getElementById('resetGraph').addEventListener('click', () => this.resetGraph());
        document.getElementById('checkMatching').addEventListener('click', () => this.checkMatching());
        document.getElementById('closeInstructions').addEventListener('click', () => {
            document.querySelector('.instructions-overlay').style.display = 'none';
            document.getElementById('gameCanvas').classList.remove('hidden');
            document.getElementById('toggleInstructions').textContent = 'Instructions';
        });
        
        // Size input handlers
        document.getElementById('setASize').addEventListener('change', (e) => this.handleSizeChange('A', e));
        document.getElementById('setBSize').addEventListener('change', (e) => this.handleSizeChange('B', e));
    }
       resizeCanvas() {
        const container = document.getElementById('canvasContainer');
        this.canvas.width = container.offsetWidth;
        this.canvas.height = container.offsetHeight;
        this.draw();
    }

    checkNodeOverlap(x, y, existingNodes, customMinDistance = null) {
        // Base minimum distance on screen size and device type
        let minDistance;
        if (this.isMobile) {
            minDistance = customMinDistance || Math.min(this.canvas.width, this.canvas.height) * 0.3; // 30% of screen size for mobile
        } else {
            minDistance = customMinDistance || Math.min(this.canvas.width, this.canvas.height) * 0.15; // 15% for desktop
        }

        for (const node of existingNodes) {
            const dx = node.x - x;
            const dy = node.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistance) {
                return true;
            }
        }
        return false;
    }

    checkWeightOverlap(x, y, existingNodes) {
        const weightRadius = this.isMobile ? 
            this.nodeRadius * 3 : // Larger spacing for weights on mobile
            this.nodeRadius * 2.5; // Desktop spacing

        for (const edge of this.edges) {
            const fromNode = this.nodes[edge.from.set][edge.from.index];
            const toNode = this.nodes[edge.to.set][edge.to.index];
            
            if (fromNode && toNode) {
                const midX = (fromNode.x + toNode.x) / 2;
                const midY = (fromNode.y + toNode.y) / 2;
                
                const dx = x - midX;
                const dy = y - midY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < weightRadius) {
                    return true;
                }
            }
        }
        return false;
    }

    getRandomPosition(allNodes) {
        const padding = this.nodeRadius * (this.isMobile ? 6 : 3); // Increased mobile padding
        const centerBuffer = this.isMobile ? 0.05 : 0.2; // Only 5% buffer on mobile to use more screen
        
        const minX = this.canvas.width * centerBuffer;
        const maxX = this.canvas.width * (1 - centerBuffer);
        const minY = this.canvas.height * centerBuffer;
        const maxY = this.canvas.height * (1 - centerBuffer);
        
        // Increased minimum distance for mobile
        const minDistance = this.isMobile ?
            Math.min(this.canvas.width, this.canvas.height) * 0.3 : // 30% for mobile
            Math.min(this.canvas.width, this.canvas.height) * 0.15;  // 15% for desktop
        
        let x, y;
        let attempts = 0;
        const maxAttempts = 150;

        do {
            x = minX + Math.random() * (maxX - minX);
            y = minY + Math.random() * (maxY - minY);
            attempts++;
            
            if (attempts > maxAttempts / 2) {
                const reductionFactor = 1 - (attempts - maxAttempts / 2) / (maxAttempts / 2);
                const currentMinDistance = minDistance * Math.max(0.6, reductionFactor);
                
                if (!this.checkNodeOverlap(x, y, allNodes, currentMinDistance)) {
                    break;
                }
            }
        } while (this.checkNodeOverlap(x, y, allNodes, minDistance) && attempts < maxAttempts);

        return { x, y };
    }

    // Return an array of {x,y} evenly placed around a circle
    computeRegularPolygonPositions(count, centerX, centerY, radius, rotationOffsetRadians = -Math.PI / 2) {
        const positions = [];
        if (count === 1) {
            positions.push({ x: centerX, y: centerY });
            return positions;
        }
        for (let i = 0; i < count; i++) {
            const angle = rotationOffsetRadians + (i * 2 * Math.PI) / count;
            positions.push({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            });
        }
        return positions;
    }

    generateWeight() {
        // Piecewise-uniform mixture:
        // 45%: U(0.20, 0.57)
        // 45%: U(0.57, 0.90)
        // 10%: Uniform over the union [0,0.20] ∪ [0.90,1.00]
        const r = Math.random();
        let value;
        if (r < 0.45) {
            value = 0.20 + Math.random() * (0.57 - 0.20);
        } else if (r < 0.90) {
            value = 0.57 + Math.random() * (0.90 - 0.57);
        } else {
            // Uniform across the union by sampling over its total length (0.20 + 0.10 = 0.30)
            const u = Math.random() * 0.30; // maps to [0,0.30)
            if (u <= 0.20) {
                value = u; // in [0,0.20]
            } else {
                value = 0.90 + (u - 0.20); // in [0.90,1.00]
            }
        }
        return Number(value.toFixed(2));
    }

       initializeGraph() {
        const allNodes = [];
        this.nodes = { A: [], B: [] };
        this.edges = [];
        this.highlightedEdges = new Set();

        // Board center
        const w = this.canvas.width;
        const h = this.canvas.height;
        const centerX = w * 0.5;
        const centerY = h * 0.5;

        // One single ring for ALL nodes → forms the correct n-gon (e.g., 5 → pentagon)
        const totalNodes = this.setASize + this.setBSize;
        const radius = Math.min(w, h) * (this.isMobile ? 0.40 : 0.38);
        const positions = this.computeRegularPolygonPositions(totalNodes, centerX, centerY, radius);

        // Alternate assignment around the ring while respecting requested counts
        let remainingA = this.setASize;
        let remainingB = this.setBSize;
        let nextSet = remainingA >= remainingB ? 'A' : 'B';
        let aIndex = 0;
        let bIndex = 0;

        for (let i = 0; i < positions.length; i++) {
            const p = positions[i];
            const dx = p.x - centerX;
            const dy = p.y - centerY;
            if (((nextSet === 'A') && remainingA > 0) || remainingB === 0) {
                const node = {
                    x: p.x,
                    y: p.y,
                    label: `A${++aIndex}`,
                    set: 'A',
                    angle: Math.atan2(dy, dx),
                    distance: Math.hypot(dx, dy)
                };
                this.nodes.A.push(node);
                allNodes.push(node);
                remainingA--;
                nextSet = remainingB > 0 ? 'B' : 'A';
            } else {
                const node = {
                    x: p.x,
                    y: p.y,
                    label: `B${++bIndex}`,
                    set: 'B',
                    angle: Math.atan2(dy, dx),
                    distance: Math.hypot(dx, dy)
                };
                this.nodes.B.push(node);
                allNodes.push(node);
                remainingB--;
                nextSet = remainingA > 0 ? 'A' : 'B';
            }
        }

        // Create edges with new random weights
        // Ensure displayed total weights are unique to two decimals across all edges
        const usedTotals = new Set();
        for (let i = 0; i < this.setASize; i++) {
            for (let j = 0; j < this.setBSize; j++) {
                let weight, half, total;
                let attempts = 0;
                do {
                    weight = this.generateWeight();
                    half = Number((weight / 2).toFixed(2));
                    total = Number((half + half).toFixed(2));
                    attempts++;
                } while (usedTotals.has(total) && attempts < 1000);
                usedTotals.add(total);
                this.edges.push({
                    from: { set: 'A', index: i },
                    to: { set: 'B', index: j },
                    weight1: half,
                    weight2: half,
                    highlighted: false
                });
            }
        }

        document.getElementById('maxScore').textContent = '?';
        this.updateScore();
        this.draw();
    }

    getEventPosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;
        
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        return {
            x: (clientX - rect.left) * (this.canvas.width / rect.width),
            y: (clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }

    findClickedEdge(pos) {
        const clickRadius = this.isMobile ? 30 : 20; // Larger click area for mobile
        
        for (let i = 0; i < this.edges.length; i++) {
            const edge = this.edges[i];
            const fromNode = this.nodes[edge.from.set][edge.from.index];
            const toNode = this.nodes[edge.to.set][edge.to.index];
            
            // Calculate distance from click to line segment
            const A = pos.x - fromNode.x;
            const B = pos.y - fromNode.y;
            const C = toNode.x - fromNode.x;
            const D = toNode.y - fromNode.y;
            
            const dot = A * C + B * D;
            const len_sq = C * C + D * D;
            let param = -1;
            
            if (len_sq !== 0) {
                param = dot / len_sq;
            }
            
            let xx, yy;
            
            if (param < 0) {
                xx = fromNode.x;
                yy = fromNode.y;
            } else if (param > 1) {
                xx = toNode.x;
                yy = toNode.y;
            } else {
                xx = fromNode.x + param * C;
                yy = fromNode.y + param * D;
            }
            
            const dx = pos.x - xx;
            const dy = pos.y - yy;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < clickRadius) {
                return i;
            }
        }
        return -1;
    }
       findClickedNode(pos) {
        // Check set A nodes first (to keep them on top)
        for (let i = 0; i < this.nodes.A.length; i++) {
            const node = this.nodes.A[i];
            const dx = node.x - pos.x;
            const dy = node.y - pos.y;
            if (dx * dx + dy * dy <= this.nodeRadius * this.nodeRadius) {
                return node;
            }
        }
        
        // Then check set B nodes
        for (let i = 0; i < this.nodes.B.length; i++) {
            const node = this.nodes.B[i];
            const dx = node.x - pos.x;
            const dy = node.y - pos.y;
            if (dx * dx + dy * dy <= this.nodeRadius * this.nodeRadius) {
                return node;
            }
        }
        
        return null;
    }

    findNodeAtPosition(pos) {
        // Check set A nodes first
        for (let i = 0; i < this.nodes.A.length; i++) {
            const node = this.nodes.A[i];
            if (Math.hypot(node.x - pos.x, node.y - pos.y) < this.nodeRadius) {
                return { set: 'A', index: i };
            }
        }
        // Then check set B nodes
        for (let i = 0; i < this.nodes.B.length; i++) {
            const node = this.nodes.B[i];
            if (Math.hypot(node.x - pos.x, node.y - pos.y) < this.nodeRadius) {
                return { set: 'B', index: i };
            }
        }
        return null;
    }

    findEdgeAtPosition(pos) {
        const clickRadius = this.isMobile ? 30 : 20;
        for (let i = 0; i < this.edges.length; i++) {
            const edge = this.edges[i];
            const fromNode = this.nodes[edge.from.set][edge.from.index];
            const toNode = this.nodes[edge.to.set][edge.to.index];
            
            // Check both the line and the weight position
            const midX = (fromNode.x + toNode.x) / 2;
            const midY = (fromNode.y + toNode.y) / 2;
            
            // Check if clicked near the edge line
            const A = pos.x - fromNode.x;
            const B = pos.y - fromNode.y;
            const C = toNode.x - fromNode.x;
            const D = toNode.y - fromNode.y;
            
            const dot = A * C + B * D;
            const len_sq = C * C + D * D;
            let param = -1;
            
            if (len_sq !== 0) {
                param = dot / len_sq;
            }
            
            let xx, yy;
            if (param < 0) {
                xx = fromNode.x;
                yy = fromNode.y;
            } else if (param > 1) {
                xx = toNode.x;
                yy = toNode.y;
            } else {
                xx = fromNode.x + param * C;
                yy = fromNode.y + param * D;
            }
            
            const distance = Math.hypot(pos.x - xx, pos.y - yy);
            if (distance < clickRadius) {
                return i;
            }
        }
        return -1;
    }

    handleStart(e) {
        e.preventDefault();
        const pos = this.getEventPosition(e);
        
        // Always check for node drag first
        const clickedNode = this.findClickedNode(pos);
        if (clickedNode) {
            this.isDragging = true;
            this.draggedNode = clickedNode;
            this.lastDragPos = pos;
            return;
        }
        
        // Then check for edge click
        const edgeIndex = this.findClickedEdge(pos);
        if (edgeIndex !== -1) {
            if (this.canHighlightEdge(edgeIndex)) {
                this.toggleEdgeHighlight(edgeIndex);
            }
            return;
        }
    }

    handleMove(e) {
        if (!this.isDragging || !this.draggedNode) return;
        e.preventDefault();
        
        const pos = this.getEventPosition(e);
        
        // Calculate new position with boundary constraints
        const newX = Math.min(Math.max(pos.x, this.nodeRadius), this.canvas.width - this.nodeRadius);
        const newY = Math.min(Math.max(pos.y, this.nodeRadius), this.canvas.height - this.nodeRadius);
        
        // Update node position with constrained values
        this.draggedNode.x = newX;
        this.draggedNode.y = newY;
        
        this.draw();
    }

    handleEnd(e) {
        if (e) e.preventDefault();
        this.isDragging = false;
        this.draggedNode = null;
        this.lastDragPos = null;
    }

    handleGlobalClick(e) {
        if (this.isEditingWeight && !e.target.classList.contains('weight-input')) {
            this.handleWeightInputComplete(document.querySelector('.weight-input'));
        }
    }

       startEdgeWeightEdit(edgeIndex, pos) {
        if (this.isEditingWeight) {
            return;
        }

        this.isEditingWeight = true;
        this.editingEdge = edgeIndex;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.classList.add('weight-input');
        
        const edge = this.edges[edgeIndex];
        input.value = (edge.weight1 + edge.weight2).toFixed(2);
        
        const rect = this.canvas.getBoundingClientRect();
        input.style.position = 'absolute';
        input.style.left = `${pos.x + rect.left - 30}px`;
        input.style.top = `${pos.y + rect.top - 10}px`;
        
        input.addEventListener('blur', () => {
            if (this.isEditingWeight) {
                this.handleWeightInputComplete(input);
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleWeightInputComplete(input);
                e.preventDefault();
            }
        });

        // Prevent event bubbling
        input.addEventListener('touchstart', (e) => e.stopPropagation());
        input.addEventListener('touchend', (e) => e.stopPropagation());
        input.addEventListener('touchmove', (e) => e.stopPropagation());
        input.addEventListener('mousedown', (e) => e.stopPropagation());

        document.body.appendChild(input);
        setTimeout(() => {
            input.focus();
            input.select();
        }, 50);
    }

    handleWeightInputComplete(input) {
        if (this.editingEdge !== null && input) {
            let value = parseFloat(input.value);
            
            if (isNaN(value) || value < 0) {
                value = this.generateWeight();
            } else {
                value = Number(value.toFixed(2));
            }
            
            const edge = this.edges[this.editingEdge];
            edge.weight1 = Number((value / 2).toFixed(2));
            edge.weight2 = Number((value / 2).toFixed(2));
            
            this.updateScore();
        }
        
        if (input && input.parentNode) {
            input.parentNode.removeChild(input);
        }
        this.isEditingWeight = false;
        this.editingEdge = null;
        this.draw();
    }

    removeWeightInput() {
        const input = document.querySelector('.weight-input');
        if (input) {
            input.remove();
        }
    }

    canHighlightEdge(edgeIndex) {
        const edge = this.edges[edgeIndex];
        if (edge.highlighted) {
            return true; // Can always unhighlight
        }

        if (this.highlightedEdges.size >= Math.min(this.setASize, this.setBSize)) {
            return false;
        }

        for (let highlightedEdgeIndex of this.highlightedEdges) {
            const highlightedEdge = this.edges[highlightedEdgeIndex];
            if (this.nodesOverlap(edge, highlightedEdge)) {
                return false;
            }
        }
        return true;
    }

    nodesOverlap(edge1, edge2) {
        return (
            (edge1.from.set === edge2.from.set && edge1.from.index === edge2.from.index) ||
            (edge1.to.set === edge2.to.set && edge1.to.index === edge2.to.index)
        );
    }

    toggleEdgeHighlight(edgeIndex) {
        if (this.edges[edgeIndex].highlighted) {
            this.edges[edgeIndex].highlighted = false;
            this.highlightedEdges.delete(edgeIndex);
        } else {
            this.edges[edgeIndex].highlighted = true;
            this.highlightedEdges.add(edgeIndex);
        }
        this.updateScore();
        this.draw();
    }
       updateScore() {
        let totalScore = 0;
        for (let edgeIndex of this.highlightedEdges) {
            const edge = this.edges[edgeIndex];
            totalScore += (edge.weight1 + edge.weight2);
        }
        document.getElementById('currentScore').textContent = totalScore.toFixed(2);
    }

    findMaximumMatching() {
        // Create weight matrix for easier access
        const weights = Array(this.setASize).fill().map(() => Array(this.setBSize).fill(0));
        for (let i = 0; i < this.setASize; i++) {
            for (let j = 0; j < this.setBSize; j++) {
                const edge = this.edges[i * this.setBSize + j];
                weights[i][j] = edge.weight1 + edge.weight2;
            }
        }

        // Helper function to check if a matching is valid
        const isValidMatching = (matching) => {
            const usedA = new Set();
            const usedB = new Set();
            for (const [a, b] of matching) {
                if (usedA.has(a) || usedB.has(b)) return false;
                usedA.add(a);
                usedB.add(b);
            }
            return true;
        };

        // Helper function to get edge weight
        const getEdgeWeight = (a, b) => weights[a][b];

        let maxScore = -Infinity;
        const generateMatchings = (current, aIndex) => {
            if (aIndex === this.setASize) {
                if (isValidMatching(current)) {
                    const score = current.reduce((sum, [a, b]) => 
                        sum + getEdgeWeight(a, b), 0);
                    maxScore = Math.max(maxScore, score);
                }
                return;
            }

            // Try matching current A node with each B node
            for (let b = 0; b < this.setBSize; b++) {
                generateMatchings([...current, [aIndex, b]], aIndex + 1);
            }
            // Try not matching current A node
            generateMatchings(current, aIndex + 1);
        };

        generateMatchings([], 0);
        return maxScore === -Infinity ? 0 : maxScore;
    }

    checkMatching() {
        const maxScore = this.findMaximumMatching();
        const currentScore = Array.from(this.highlightedEdges)
            .reduce((sum, edgeIndex) => {
                const edge = this.edges[edgeIndex];
                return sum + (edge.weight1 + edge.weight2);
            }, 0);
        
        document.getElementById('maxScore').textContent = maxScore.toFixed(2);
        
        const winMessage = document.getElementById('winMessage');
        if (Math.abs(currentScore - maxScore) < 0.01) {
            winMessage.textContent = "You win! This is the best matching available.";
            winMessage.style.display = 'block';
        } else {
            winMessage.style.display = 'none';
        }
    }

    resetGraph() {
        this.initializeGraph();
        document.getElementById('currentScore').textContent = '0.00';
        document.getElementById('maxScore').textContent = '?';
        document.getElementById('winMessage').style.display = 'none';
    }

    handleSizeChange(set, e) {
        const value = parseInt(e.target.value);
        if (value >= 1 && value <= 10) {
            if (set === 'A') {
                this.setASize = value;
            } else {
                this.setBSize = value;
            }
            this.initializeGraph();
            document.getElementById('maxScore').textContent = '?';
            document.getElementById('winMessage').style.display = 'none';
        }
    }

    toggleInstructions() {
        const instructionsOverlay = document.querySelector(".instructions-overlay");
        const gameCanvas = document.getElementById("gameCanvas");
        const toggleButton = document.getElementById("toggleInstructions");

        if (instructionsOverlay.style.display === "none" || instructionsOverlay.style.display === "") {
            instructionsOverlay.style.display = "flex";
            gameCanvas.classList.add("hidden");
            toggleButton.textContent = "Resume Game";
        } else {
            instructionsOverlay.style.display = "none";
            gameCanvas.classList.remove("hidden");
            toggleButton.textContent = "Instructions";
        }
    }

       draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1) Draw edges (lines only)
        this.edges.forEach((edge) => {
            const fromNode = this.nodes[edge.from.set][edge.from.index];
            const toNode = this.nodes[edge.to.set][edge.to.index];
            this.ctx.beginPath();
            this.ctx.moveTo(fromNode.x, fromNode.y);
            this.ctx.lineTo(toNode.x, toNode.y);
            this.ctx.strokeStyle = edge.highlighted ? '#000' : '#666';
            this.ctx.lineWidth = edge.highlighted ? 3 : 1;
            this.ctx.stroke();
        });

        // 2) Draw nodes on top of edges
        for (const set of ['A', 'B']) {
            this.nodes[set].forEach((node) => {
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, this.nodeRadius, 0, Math.PI * 2);
                this.ctx.fillStyle = set === 'A' ? '#f44336' : '#2196F3';
                this.ctx.fill();
                this.ctx.strokeStyle = '#333';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();

                this.ctx.fillStyle = 'white';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.font = '16px Arial';
                this.ctx.fillText(node.label, node.x, node.y);
            });
        }

        // 3) Draw weights last so they are visible above nodes
        this.edges.forEach((edge) => {
            const fromNode = this.nodes[edge.from.set][edge.from.index];
            const toNode = this.nodes[edge.to.set][edge.to.index];
            const midX = (fromNode.x + toNode.x) / 2;
            const midY = (fromNode.y + toNode.y) / 2;

            this.ctx.save();
            this.ctx.translate(midX, midY);
            let angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
            if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
                angle += Math.PI;
            }
            this.ctx.rotate(angle);

            const totalWeight = (edge.weight1 + edge.weight2).toFixed(2);
            const font = edge.highlighted ? 'bold 14px Arial' : '14px Arial';
            this.ctx.font = font;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            // Background box for readability
            const paddingX = 6;
            const paddingY = 3;
            const labelOffset = 14; // push off the edge line
            const metrics = this.ctx.measureText(totalWeight);
            const textWidth = metrics.width;
            const textHeight = 14; // approximate

            // Draw background rectangle
            this.ctx.fillStyle = 'rgba(255,255,255,0.95)';
            this.ctx.fillRect(-textWidth / 2 - paddingX, -labelOffset - textHeight / 2 - paddingY, textWidth + paddingX * 2, textHeight + paddingY * 2);

            // Draw text
            this.ctx.fillStyle = edge.highlighted ? '#000' : '#666';
            this.ctx.fillText(totalWeight, 0, -labelOffset);

            this.ctx.restore();
        });
    }
}

// Initialize game when window loads
window.addEventListener('load', () => {
    new BipartiteMatchingGame();
});

   
   
   

   
   

