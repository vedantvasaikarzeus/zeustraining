import { drawVisibleColumnHeaders, paintCell, Painter } from "./paint.js";
import { resizeColCommand } from "./resizecolcommand.js";
export class ResizeCols {
    constructor(
    /** Reference to the Cols object managing column widths */
    cols, rows, griddrawer, eventManager, selectionManager, cellmanager, scrollRefresh = null, commandpattern, selectioninputmanager = null) {
        this.cols = cols;
        this.rows = rows;
        this.griddrawer = griddrawer;
        this.eventManager = eventManager;
        this.selectionManager = selectionManager;
        /** @type {number | null} The index of the column border currently hovered for resizing */
        this.hoveredColBorder = null;
        this.resizingCol = null; // Which column is being resized
        this.startX = 0; // Where the drag started (for calculations)
        this.startWidth = 0; // Initial width of the column
        this.resizingColLeft = null;
        /** Position of the preview line when resizing */
        this.previewLineX = null;
        this.scrollRefresh = null;
        this.selectionarr = [];
        this.selection = null;
        this.commapndpattern = null;
        this.oldwidth = 0;
        this.selectioninputmanager = null;
        // Get the main canvas element
        this.canvas = document.getElementById("canvas");
        // Get the overlay canvas for temporary visual elements
        this.overlay = document.getElementById('overlay');
        //Get 2D rendering context
        const overlayCtx = this.overlay.getContext("2d");
        // Ensure we have valid contexts
        if (!overlayCtx)
            throw new Error("No 2D context");
        this.overlayCtx = overlayCtx;
        this.cols = cols;
        this.container = document.querySelector('.container');
        this.eventManager = eventManager;
        this.selectionManager = selectionManager;
        this.scrollRefresh = scrollRefresh;
        this.ctx = this.canvas.getContext("2d");
        this.cellmanager = cellmanager;
        this.commapndpattern = commandpattern;
        this.selectioninputmanager = selectioninputmanager;
        this.listenSelectionChange();
    }
    listenSelectionChange() {
        window.addEventListener('selection-changed', (e) => {
            if (e.detail) {
                this.selection = e.detail.selection;
                this.selectionarr = e.detail.selectionarr;
                // Painter.paintSelectedCells(
                //     this.ctx!, this.griddrawer, this.rows, this.cols,
                //     this.cellmanager, this.container, this.selection, this.selectionarr
                // );
            }
        });
    }
    /**
    * Draws a vertical preview line during column resizing
    * @param x - X-coordinate where to draw the line
    */
    drawPreviewLineOverlayCol(x) {
        // Clear the overlay canvas
        this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        // Begin drawing the dashed line
        this.overlayCtx.beginPath();
        this.overlayCtx.setLineDash([5, 5]); // Dashed line pattern
        this.overlayCtx.moveTo(x, 0);
        this.overlayCtx.lineTo(x, this.overlay.height);
        this.overlayCtx.strokeStyle = '#107c41';
        this.overlayCtx.lineWidth = 2;
        this.overlayCtx.stroke();
        this.overlayCtx.setLineDash([]); // Reset dash pattern
    }
    handlePointerDown(event) {
        // console.log("Pointer down on column resize");
        if (this.hoveredColBorder !== null) {
            this.resizingCol = this.hoveredColBorder;
            this.startX = event.clientX;
            this.startWidth = this.cols.widths[this.resizingCol];
            // Calculate initial preview line position
            let sum = 0;
            for (let i = 0; i < this.resizingCol; i++) {
                sum += this.cols.widths[i];
            }
            this.resizingColLeft = sum;
            this.previewLineX = sum + this.cols.widths[this.resizingCol];
        }
    }
    handlePointerMove(event) {
        if (this.resizingCol !== null && this.resizingColLeft !== null) {
            const { startRow, endRow, startCol, endCol } = this.griddrawer.getVisibleRange(this.rows, this.cols);
            const dx = event.clientX - this.startX;
            const newWidth = Math.max(10, this.startWidth + dx);
            this.cols.setWidth(this.resizingCol, newWidth);
            this.griddrawer.columnheaders(this.rows, this.cols); // Redraw headers
            let sum = 0;
            for (let i = 0; i < this.resizingCol; i++) {
                sum += this.cols.widths[i];
            }
            this.previewLineX = this.resizingColLeft + newWidth;
            // console.log(this.previewLineX);
            // Only draw preview line on overlay
            const adjustedPreviewLineX = this.previewLineX - this.container.scrollLeft;
            this.griddrawer.drawPreviewLineOverlay(adjustedPreviewLineX);
            if (this.selection) {
                drawVisibleColumnHeaders(startRow, endRow, this.rows, this.cols, this.container, this.ctx, this.selectionarr, this.selection);
                //cornercell
                paintCell(this.ctx, this.container, this.rows, this.cols, 0, 0, null, this.selection, this.selectionarr, event);
            }
            // this.griddrawer.drawVisibleColumnHeaders(startCol,endCol,this.rows, this.cols);
        }
    }
    handlePointerUp(event) {
        // console.log(this.selection, this.selectionarr);
        // Only do this if a column is being resized and a preview line exists
        if (this.resizingCol !== null && this.previewLineX !== null && this.resizingColLeft !== null) {
            // Calculate the sum of all column widths before the one being resized
            let sum = 0;
            let oldwidth = this.cols.widths[this.resizingCol];
            for (let i = 0; i < this.resizingCol; i++) {
                sum += this.cols.widths[i];
            }
            // The new width is the preview line position minus the sum of previous widths
            const finalWidth = this.previewLineX - this.resizingColLeft;
            // Update the width in the cols object
            this.cols.setWidth(this.resizingCol, finalWidth);
            this.commapndpattern?.execute(new resizeColCommand(this.cols, this.resizingCol, finalWidth, this.startWidth, this.griddrawer, event));
            // Disable the preview line
            this.griddrawer.ctx.clearRect(0, 0, this.griddrawer.canvas.width, this.griddrawer.canvas.height);
            //  Clear the overlay (removes preview line)
            this.griddrawer.clearOverlay();
            // Redraw everything
            this.griddrawer.rendervisible(this.rows, this.cols);
            // }
            this.selectioninputmanager?.positionInputOnSelection();
        }
        // Reset the resizingCol state
        this.resizingCol = null;
        this.resizingColLeft = null;
        window.removeEventListener('pointermove', this.handlePointerMove.bind(this));
        Painter.paintSelectedCells(this.ctx, this.griddrawer, this.rows, this.cols, this.cellmanager, this.container, this.selection, this.selectionarr, event);
        //cornercell
        paintCell(this.ctx, this.container, this.rows, this.cols, 0, 0, null, this.selection, this.selectionarr, event);
    }
    /**
     HIT TEST
     */
    hittest(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        // Calculate virtual coordinates with scroll offset
        const virtualX = x + this.container.scrollLeft;
        const virtualY = y + this.container.scrollTop;
        const threshold = 5; // px distance to detect border for resizing
        const headerHeight = this.rows.heights[0];
        const headerWidth = this.cols.widths[0];
        // --- Check for column resizing (hovering near right edge of any column in header row) ---
        if (y < headerHeight) {
            let sum = 0;
            for (let col = 0; col < this.cols.n; col++) {
                sum += this.cols.widths[col];
                // Using virtualX to account for scroll position
                if (Math.abs(virtualX - sum) < threshold) {
                    // this.canvas.style.cursor = "ew-resize";
                    this.hoveredColBorder = col;
                    return true;
                }
            }
        }
        return false;
    }
}
