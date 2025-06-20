/**
 * Represents a single cell in the grid.
 */
class Cell {
  /** @type {string} The content of the cell */
  data: string;

  /** @type {number} X position (top-left corner) of the cell */
  x: number;

  /** @type {number} Y position (top-left corner) of the cell */
  y: number;

  /** @type {number} Width of the cell */
  width: number;

  /** @type {number} Height of the cell */
  height: number;

  /**
   * Initializes a Cell object.
   * @param {number} x - X position of the cell
   * @param {number} y - Y position of the cell
   * @param {number} width - Width of the cell
   * @param {number} height - Height of the cell
   * @param {string} [data=""] - Initial content of the cell
   */
  constructor(x: number, y: number, width: number, height: number, data: string = "") {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.data = data;
  }

  /**
   * Draws the cell on the canvas.
   * @param {CanvasRenderingContext2D} ctx - The canvas 2D rendering context
   */
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.3;
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    ctx.fillStyle = "#000";
    ctx.font = "12px Arial";
    ctx.textBaseline = "middle";
    ctx.fillText(this.data, this.x + 4, this.y + this.height / 2);
  }

  
 /**
   * Checks if a given point is on the resize handle of the cell.
   * @param {number} px - X coordinate of the point
   * @param {number} py - Y coordinate of the point
   * @returns {boolean} True if the point is on the resize handle
   */
  isOnResizeHandle(px: number, py: number): boolean {
    const handleSize = 10;
    return (
      px >= this.x + this.width - handleSize &&
      px <= this.x + this.width &&
      py >= this.y + this.height - handleSize &&
      py <= this.y + this.height
    );
  }

}

/**
 * Manages the grid of cells and canvas interactions.
 */
class GridDrawer {
  /** @type {HTMLCanvasElement} The canvas element */
  private canvas: HTMLCanvasElement;

  /** @type {CanvasRenderingContext2D} The 2D rendering context of the canvas */
  private ctx: CanvasRenderingContext2D;

  /** @type {number} Number of rows in the grid */
  private rows: number;

  /** @type {number} Number of columns in the grid */
  private cols: number;

  /** @type {number} Width of each cell */
  private cellWidth: number;

  /** @type {number} Height of each cell */
  private cellHeight: number;

  /** @type {Cell[][]} 2D array of Cell objects */
  private cells: Cell[][];

  /** @type {number} Currently selected row index */
  private selectedRow: number = 0;

  /** @type {number} Currently selected column index */
  private selectedCol: number = 0;

  /** @type {boolean} Whether a cell is being resized */
  private isResizing: boolean = false;

  /** @type {Cell | null} The cell currently being resized */
  private resizingCell: Cell | null = null;


  /**
   * Initializes the GridDrawer object.
   * @param {string} canvasId - The ID of the canvas element
   * @param {number} [rows=50] - Number of rows in the grid
   * @param {number} [cols=20] - Number of columns in the grid
   * @param {number} [cellWidth=100] - Width of each cell
   * @param {number} [cellHeight=30] - Height of each cell
   */
  constructor(
    canvasId: string,
    rows: number = 50,
    cols: number = 20,
    cellWidth: number = 100,
    cellHeight: number = 30
  ) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) {
      throw new Error(`Canvas with id "${canvasId}" not found.`);
    }

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to get 2D context from canvas.");
    }

    this.canvas = canvas;
    this.ctx = context;
    this.rows = rows;
    this.cols = cols;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;

    this.canvas.width = this.cols * this.cellWidth;
    this.canvas.height = this.rows * this.cellHeight;

    this.cells = [];
    this.initializeCells();
    this.attachEvents();
  }

  /**
   * Initializes the grid with Cell objects.
   */
  private initializeCells(): void {
    for (let row = 0; row < this.rows; row++) {
      const rowCells: Cell[] = [];
      for (let col = 0; col < this.cols; col++) {
        const x = col * this.cellWidth;
        const y = row * this.cellHeight;
        rowCells.push(new Cell(x, y, this.cellWidth, this.cellHeight));
      }
      this.cells.push(rowCells);
    }
  }

  /**
   * Draws the entire grid on the canvas.
   */
  drawGrid(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const row of this.cells) {
      for (const cell of row) {
        cell.draw(this.ctx);
      }
    }
  }

  /**
   * Attaches mouse and keyboard event listeners for editing and navigation.
   */
  attachEvents(): void {
    const input = document.getElementById("cellInput") as HTMLInputElement;

    /**
     * Displays the input box over the specified cell.
     * @param {number} row - Row index of the cell
     * @param {number} col - Column index of the cell
     */
    const showInput = (row: number, col: number) => {
      const cell = this.cells[row][col];
      input.style.left = `${cell.x}px`;
      input.style.top = `${cell.y}px`;
      input.style.width = `${cell.width}px`;
      input.style.height = `${cell.height}px`;
      input.value = cell.data;
      input.style.display = "block";
      input.focus();

      input.onblur = () => {
        cell.data = input.value;
        input.style.display = "none";
        this.ctx.clearRect(cell.x, cell.y, cell.width, cell.height);
        cell.draw(this.ctx);
      };
    };

    this.canvas.addEventListener("click", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.selectedCol = Math.floor(x / this.cellWidth);
      this.selectedRow = Math.floor(y / this.cellHeight);

      if (this.selectedRow < this.rows && this.selectedCol < this.cols) {
        showInput(this.selectedRow, this.selectedCol);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (input.style.display === "block") {
        const currentCell = this.cells[this.selectedRow][this.selectedCol];
        currentCell.data = input.value;
        this.ctx.clearRect(currentCell.x, currentCell.y, currentCell.width, currentCell.height);
        currentCell.draw(this.ctx);

        switch (e.key) {
          case "ArrowUp":
            if (this.selectedRow > 0) this.selectedRow--;
            break;
          case "ArrowDown":
            if (this.selectedRow < this.rows - 1) this.selectedRow++;
            break;
          case "ArrowLeft":
            if (this.selectedCol > 0) this.selectedCol--;
            break;
          case "ArrowRight":
            if (this.selectedCol < this.cols - 1) this.selectedCol++;
            break;
          case "Enter":
            if (this.selectedRow < this.rows - 1) this.selectedRow++;
            break;
          default:
            return;
        }

        e.preventDefault();
        showInput(this.selectedRow, this.selectedCol);
      }
    });

    // Handle pointer down for editing or resizing
    this.canvas.addEventListener("pointerdown", (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const col = Math.floor(x / this.cellWidth);
        const row = Math.floor(y / this.cellHeight);

        if (row < this.rows && col < this.cols) {
            const cell = this.cells[row][col];
            if (cell.isOnResizeHandle(x, y)) {
                this.isResizing = true;
                this.resizingCell = cell;
            } else {
                this.selectedCol = col;
                this.selectedRow = row;
                showInput(row, col);
            }
        }
    });

    // Handle pointer move for resizing
    this.canvas.addEventListener("pointermove", (e) => {
        if (this.isResizing && this.resizingCell) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.resizingCell.width = Math.max(20, x - this.resizingCell.x);
            this.resizingCell.height = Math.max(20, y - this.resizingCell.y);

            this.ctx.clearRect(this.resizingCell.x, this.resizingCell.y, this.canvas.width, this.canvas.height);
            this.resizingCell.draw(this.ctx);
        }
    });

    // Handle pointer up to stop resizing
    this.canvas.addEventListener("pointerup", () => {
        this.isResizing = false;
        this.resizingCell = null;
    });


  }
}

// Initialize and draw the grid
const grid = new GridDrawer("canvas");
grid.drawGrid();
