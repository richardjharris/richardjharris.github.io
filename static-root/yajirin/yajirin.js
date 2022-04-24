"use strict";

const dirs = {'LEFT': 0, 'UP': 1, 'RIGHT': 2, 'DOWN': 3};

// Size of each square (width + height)
const SQ = 64;

// Represents a square on the grid. May contain lines, clues or hint
// markings.
class CellModel {
    constructor(clueDir, clueNum) {
        // Corresponds to LEFT and UP.
        this.lines = [false, false];
        this.dot = false;
        this.filled = false;
        this.clueDir = clueDir;
        this.clueNum = clueNum;
    }

    isFilled() {
        return this.filled;
    }

    isClue() {
        return !(this.clueDir === undefined);
    }

    isDot() {
        return this.dot;
    }

    hasLine(dir) {
        return this.lines[dir];
    }

    hasLines() {
        return this.lines[dirs.LEFT] || this.lines[dirs.UP];
    }

    // Mark the cell as filled
    setFill() {
        if (this.isClue()) return;
        this.clear();
        this.filled = true;
    }

    // Mark the cell with a line from the centre to outside of the cell, in the
    // given direction
    setLine(dir) {
        if (this.isClue()) return;
        this.dot = false;
        this.filled = false;
        this.lines[dir] = true;
    }

    // Remove the line with the given direction, if present.
    removeLine(dir) {
        if (this.isClue()) return;
        this.lines[dir] = false;
    }

    // Mark the cell with a dot, which indicates that there cannot be a filled square
    // Clears all existing markings
    setDot() {
        if (this.isClue()) return;
        this.clear();
        this.dot = true;
    }

    // Remove all markings from the cell.
    clear() {
        if (this.isClue()) return;
        this.lines = [false, false, false, false];
        this.dot = false;
        this.filled = false;
    }
}

// Represents the grid itself
class PuzzleModel {
    constructor(width, height, clues) {
        this.width = width;
        this.height = height;
        this.clues = clues;
        this.grid = [];

        for(let i = 0; i < width; i++) {
            for(let j = 0; j < height; j++) {
                if (!this.grid[i]) this.grid[i] = []
                this.grid[i][j] = new CellModel();
            }
        }

        for(let clue of clues) {
            let [x, y, dir, num] = clue;
            this.grid[x][y] = new CellModel(dir, num);
        }
    }

    // Return the cell at co-ordinate (x,y)
    getCell(x,y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return null;
        }

        return this.grid[x][y];
    }

    // Given x,y, translate it in the given direction and return [x', y']
    translate(x,y,dir) {
        if (dir === dirs.LEFT)  return [x - 1, y];
        if (dir === dirs.RIGHT) return [x + 1, y];
        if (dir === dirs.UP)    return [x, y - 1];
        if (dir === dirs.DOWN)  return [x, y + 1];
        throw "invalid direction";
    }

    // Return the given neighbour cell, may be null
    getNeighbour(x,y,dir) {
        let [x2, y2] = this.translate(x,y,dir);
        return this.getCell(x2, y2);
    }

    // Return the cells adjacent to the given cell, in the same order
    // as 'dirs'
    // Cells will be null if missing
    getAllNeighbours(x,y) {
        return dirs.map((dir) => this.getNeighbour(x,y,dir));
    }

    // Return true if this cell may be filled
    canSetFill(x,y) {
        let cell = this.getCell(x,y);
        return !cell.isClue();
    }

    canSetDot(x,y) {
        let cell = this.getCell(x,y);
        return !cell.isClue();
    }

    canClearCell(x,y) {
        let cell = this.getCell(x,y);
        return !cell.isClue();
    }

    canSetLine(x,y,dir) {
        if (dir !== dirs.LEFT && dir !== dirs.UP) {
            return false;
        }
        if (y === 0 && dir === dirs.UP) {
            return false;
        }
        if (x === 0 && dir === dirs.LEFT) {
            return false;
        }

        let cell = this.getCell(x,y);
        if (cell.isClue()) {
            return false;
        }

        if (cell.hasLine(dir)) {
            return false;
        }

        // Check if neighbour is also a clue. Neighbour is non-null due to above check
        if (this.getNeighbour(x,y,dir).isClue()) {
            return false;
        }

        return true;
    }

    canRemoveLine(x,y,dir) {
        if (dir != dirs.LEFT && dir != dirs.UP) {
            return false;
        }

        let cell = this.getCell(x,y);
        if (cell.isClue()) {
            return false;
        }
        if (!cell.hasLine(dir)) {
            return false;
        }

        return true;
    }

    // Mark the cell as filled
    setFill(x,y) {
        if (!this.canSetFill(x,y)) return;

        // Clear any lines that overlap with the square
        let right = this.getNeighbour(x,y,dirs.RIGHT);
        if (right) right.removeLine(dirs.LEFT);

        let down = this.getNeighbour(x,y,dirs.DOWN);
        if (down) down.removeLine(dirs.UP);

        this.getCell(x,y).setFill();
    }

    clearCell(x,y) {
        if (!this.canClearCell(x,y)) return;

        this.getCell(x,y).clear();
    }

    setDot(x,y) {
        if (!this.canSetDot(x,y)) return;

        this.getCell(x,y).setDot();
    }

    // Add a line (must be left or up)
    setLine(x,y,dir) {
        if (!this.canSetLine(x,y,dir)) return;

        // Remove any filled cells that overlap
        let neighbour = this.getNeighbour(x,y,dir);
        if (neighbour && neighbour.isFilled()) {
            neighbour.clear();
        }

        this.getCell(x,y).setLine(dir);
    }

    removeLine(x,y,dir) {
        if (!this.canRemoveLine(x,y,dir)) return;

        this.getCell(x,y).removeLine(dir);
    }

    isSolved() {
        // Puzzle is solved if:
        // 1) all cells are filled
        // 2) no adjacent black cells
        // 3) all clues are enforced
        // 4) the lines form a single unbroken loop without any crossings or forks 

        let lineCells = new Set();
        let firstLine = null;

        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                let c = this.getCell(x,y);
                let n = this.getNeighbour(x,y,dirs.RIGHT);
                let n2 = this.getNeighbour(x,y,dirs.DOWN);

                // Check if this cell has lines including those from neighbours
                let hasLine = c.hasLines() || (n && n.hasLine(dirs.LEFT)) ||
                    (n2 && n2.hasLine(dirs.UP));

                if (!c.isClue() && !c.isFilled() && !hasLine) {
                    console.log("not solved - empty space at (" + x + ", " + y + ")");
                    return false;
                }
                if (c.isFilled()) {
                    if ((n && n.isFilled()) || (n2 && n2.isFilled())) {
                        console.log("not solved - adjacent filled squares");
                        return false;
                    }
                }

                if (c.hasLines()) {
                    if (c.hasLine(dirs.LEFT)) lineCells.add(x + "," + y + "l");
                    if (c.hasLine(dirs.UP)) lineCells.add(x + "," + y + "u");
                    if (firstLine === null) firstLine = { x: x, y: y };
                }
            }
        }

        // Check clues are enforced
        for (let clue of this.clues) {
            let [x, y, dir, num] = clue;
            
            let numFilled = 0;
            while (true) {
                [x, y] = this.translate(x, y, dir);
                let cell = this.getCell(x,y);
                // Reached the end of the grid
                if (cell === null) break;
                if (cell.isFilled()) numFilled ++;
            }

            if (numFilled !== num) {
                console.log("not solved - violated clue at (" + clue[0] + ", " + clue[1] + ")");
                return false;
            }
        }

        // Check lines form a loop.
        if (lineCells.size === 0 || firstLine === null) {
            console.log("not solved - no lines");
            return false;
        }
        
        // Follow the line in any direction
        let x = firstLine.x;
        let y = firstLine.y;
        let starting = true;
        while (true) {
            // There are up to four lines that we can follow
            // This is the key (in lineCells) and the (x,y) to move to
            let adjLines = [
                [x + "," + y + "l",       x - 1, y],     // left
                [(x + 1) + "," + y + "l", x + 1, y],     // right
                [x + "," + y + "u",       x, y - 1],     // up
                [x + "," + (y + 1) + "u", x, y + 1],     // down
            ];

            let available = adjLines.filter((key) => lineCells.has(key[0]));

            if (available.length == 0) {
                // Nowhere to go. Must be another loop somewhere
                console.log("not solved - not a single loop");
                return false;
            }

            // If there is more than one path, we have a fork, so we fail
            // (except for the first run where we have two paths)
            if (available.length > 2 || (!starting && available.length > 1)) {
                console.log("not solved - fork in loop");
                return false;
            }

            // Otherwise follow one and delete the key
            starting = false;
            let key;
            [key, x, y] = available[0];
            lineCells.delete(key);

            if (lineCells.size === 0) {
                // We have traversed the entire loop.
                console.log("solved!");
                return true;
            }
        }
    }
}

// View, controls the canvas and mouse events.
export default class Yajirin {

    constructor(canvas) {
        this.canvas = canvas;

        // Default translation introduces bleeding (as we are drawing in between
        // physical pixels)
        // Not sure how else to fix this.
        canvas.getContext('2d').translate(0.5, 0.5);
        canvas.getContext('2d').imageSmoothingEnabled = false;

        // Puzzle information
        this.width = 0;
        this.height = 0;

        // Callbacks
        this.onSolved = null;

        this.clearCanvasCoordinates();
    }

    static get dirs() {
        return dirs;
    }

    get ctx() {
        return this.canvas.getContext('2d');
    }

    loadPuzzle(puzzle) {
        this.puzzle = new PuzzleModel(puzzle.width, puzzle.height, puzzle.clues);

        // Not thinking about dynamic scaling yet!
        this.canvas.width = puzzle.width * SQ - 1;
        this.canvas.height = puzzle.height * SQ - 1;

        this.draw();

        // Set up mouse event handlers
        this.canvas.onclick = (e) => {
            this.setCanvasCoordinates(e);

            this.clicked(e.button);
            this.draw();
        };
        this.canvas.onmousemove = (e) => {
            this.setCanvasCoordinates(e);

            this.draw();
        };
        this.canvas.onmouseout = (e) => {
            this.clearCanvasCoordinates();
            this.draw();
        };
    }

    draw() {
        let c = this.ctx;

        c.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for(let x = 0; x < this.puzzle.width; x++) {
            for (let y = 0; y < this.puzzle.height; y++) {
                this.drawCell(x,y);
            }
        }
        for(let x = 0; x < this.puzzle.width; x++) {
            for (let y = 0; y < this.puzzle.height; y++) {
                this.drawLines(x,y);
            }
        }

        // Draw border lines
        c.strokeStyle = '#aaa';
        for(let x = 1; x < this.puzzle.width; x++) {
            c.beginPath();
            c.moveTo(x * SQ, 0);
            c.lineTo(x * SQ, this.canvas.height);
            c.stroke();
        }
        for(let y = 1; y < this.puzzle.height; y++) {
            c.beginPath();
            c.moveTo(0, y * SQ);
            c.lineTo(this.canvas.width, y * SQ);
            c.stroke();
        }
    }

    drawLines(x, y) {
        let c = this.ctx;
        let sq = this.puzzle.getCell(x,y);

        // This is the top corner of the cell to draw in
        let xs = x * SQ;
        let ys = y * SQ; 

        // This is the centre of the cell
        let xc = xs + (SQ / 2);
        let yc = ys + (SQ / 2);

        // Is the mouse highlighting a potential line?
        // The hover area is thicker than the line, but slightly curtailed at both
        // ends to avoid confusion with the neighbouring lines.
        let curtail = parseInt(SQ/4);
        let padding = parseInt(SQ/4);

        c.save();
        c.lineWidth = SQ/10;
        c.lineCap = 'round';

        // Determine colors
        [dirs.LEFT, dirs.UP].forEach((dir) => {
            let hasLine = sq.hasLine(dir);

            let hovering = this.mouseLine && this.mouseLine.dir === dir
                && this.mouseLine.x === x && this.mouseLine.y === y;

            let canSetLine = hovering && this.puzzle.canSetLine(x,y,dir);

            let color = hovering && hasLine ? 'red'
                      : canSetLine ? 'green'
                      : hasLine ? 'black'
                      : null;
            if (color) {
                c.strokeStyle = color;
                c.beginPath();
                if (dir == dirs.LEFT) {
                    c.moveTo(xc - SQ, yc);
                }
                else {
                    c.moveTo(xc, yc - SQ);
                }
                c.lineTo(xc, yc);
                c.stroke();
            }
        });

        c.restore();
    }

    drawCell(x, y) {
        let c = this.ctx;
        let sq = this.puzzle.getCell(x,y);

        // This is the top corner of the cell to draw in
        let xs = x * SQ;
        let ys = y * SQ; 

        // This is the centre of the cell
        let xc = xs + (SQ / 2);
        let yc = ys + (SQ / 2);

        // Is this square highlighted by the mouse?
        // If hovering over a line, that takes precedence
        let highlight = this.mouseSquareX === x && this.mouseSquareY === y
            && this.mouseLine.dir === null;

        if (sq.isClue()) {
            // Shade it
            c.fillStyle = highlight ? '#eff' : '#eee';
            c.fillRect(xs, ys, SQ - 1, SQ - 1);

            let fontSize = SQ * 3/4;

            c.fillStyle = 'black';
            c.strokeStyle = 'black';
            c.font = fontSize + 'px sans-serif';
            c.textAlign = 'center';
            c.textBaseline = 'middle';

            if (sq.clueDir === dirs.UP || sq.clueDir == dirs.DOWN) {
                let arrow = sq.clueDir == dirs.UP ? "🠕" : "🠗";

                c.fillText(sq.clueNum + arrow, xc + 1, yc);
            }
            else {
                let arrow = sq.clueDir == dirs.LEFT ? "🠔" : "🠖";

                c.fillText(arrow, xc + 1, ys + (SQ *3/16));
                c.fillText(sq.clueNum, xc + 1, ys + (SQ*5/8));
            }
        }
        else if (sq.isFilled()) {
            c.fillStyle = highlight ? '#c00' : 'black';
            c.fillRect(xs, ys, SQ - 1, SQ - 1);
        }
        else {
            c.fillStyle = highlight ? '#ccc' : 'white';
            c.fillRect(xs, ys, SQ - 1, SQ - 1);
        }

        if (sq.isDot()) {
            c.beginPath();
            // Draw circle: arc from 0 to 2pi
            c.arc(xc, yc, 2, 0, 2 * Math.PI);
            c.stroke();
        }
    }

    clicked(button) {
        if (this.mouseLine.dir !== null) {
            // We've mousing over an arrow.
            let m = this.mouseLine;

            if (this.puzzle.getCell(m.x,m.y).hasLine(m.dir)) {
                this.puzzle.removeLine(m.x, m.y, m.dir);
            }
            else {
                this.puzzle.setLine(m.x, m.y, m.dir);
            }
            this.draw();
        }
        else if (this.mouseSquareX !== -1) {
            // We're mousing over a square
            let [x,y] = [this.mouseSquareX, this.mouseSquareY];
            if (this.puzzle.getCell(x,y).isFilled()) {
                this.puzzle.setDot(x,y);
            }
            else if (this.puzzle.getCell(x,y).isDot()) {
                this.puzzle.clearCell(x,y);
            }
            else {
                this.puzzle.setFill(x,y);
            }
            this.draw();
        }
        else {
            // Clicking somewhere else, ignore.
        }

        // Test if solved now
        if (this.puzzle.isSolved()) {
            if (this.onSolved) {
                this.onSolved();
            }
        }
    }

    // Given an event, set the grid square and line being hovered over.
    // Relies on the canvas having no border or padding, and not being scaled.
    setCanvasCoordinates(e) {
        let canvasOffset = this.canvas.getBoundingClientRect();
        let mousex = parseInt(e.clientX - canvasOffset.left);
        let mousey = parseInt(e.clientY - canvasOffset.top);

        // Are we hovering over a line?
        let hover = { dir: null, x: 0, y: 0 };

        // The hover area is thicker than the line, but slightly curtailed at both
        // ends to avoid confusion with the neighbouring lines.
        let curtail = parseInt(SQ/4);
        let padding = parseInt(SQ/4);

        // This can be calculated faster but I'm lazy to change it atm
        for(let x = 0; x < this.puzzle.width; x++) {
            if (hover.dir) break;

            // Compute centre of cell
            let xc = (x * SQ) + (SQ / 2);

            for (let y = 0; y < this.puzzle.height; y++) {

                let yc = (y * SQ) + (SQ / 2);

                if (mousex >= xc - SQ + curtail && mousex <= xc - curtail &&
                    mousey >= yc - padding && mousey <= yc + padding) {
                    hover = { dir: dirs.LEFT, x: x, y: y };
                    break;
                }
                else if (mousey >= yc - SQ + curtail && mousey <= yc - curtail &&
                    mousex >= xc - padding && mousex <= xc + padding) {
                    hover = { dir: dirs.UP, x: x, y: y };
                    break;
                }
            }
        }

        this.mouseLine = hover;

        if (hover.dir === null) {
            // Are we hovering over a square?
            // Require the mouse to be reasonably central
            let pad = Math.floor(SQ/6);
            if (mousex % SQ < pad || mousex % SQ > (SQ - pad) ||
                mousey % SQ < pad || mousey % SQ > (SQ - pad)) {
                this.mouseSquareX = this.mouseSquareY = -1;
            }
            else {
                this.mouseSquareX = Math.floor(mousex / SQ);
                this.mouseSquareY = Math.floor(mousey / SQ);
            }
        }
    }

    clearCanvasCoordinates() {
        this.mouseSquareX = -1;
        this.mouseSquareY = -1;
        this.mouseLine = { dir: null, x: 0, y: 0 };
    }
}
