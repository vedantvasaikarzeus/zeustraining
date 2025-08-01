import { Rows } from "./rows.js";
import { Cols } from "./cols.js";
import { findIndexFromCoord } from "./utils.js";
import { CellManager } from "./cellmanager.js";
import { GridDrawer } from "./griddrawer.js";
import { EventManager } from "./eventmanager.js";
import { Statistics } from "./statistics.js";
import { Painter, SelectionRange,drawCornerCell,paintCell } from "./paint.js";
import { ScrollRefresh } from "./scrollrefresh.js";

export class ColumnSelectionManager {
    griddrawer: GridDrawer;
    rows: Rows;
    cols: Cols;
    cellmanager: CellManager;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D | null;
    container: HTMLElement;
    statistics: Statistics | null = null;
    eventmanager: EventManager | null = null;
    scrollRefresh: ScrollRefresh | null = null;
    selectionarr: SelectionRange[] = [];
    selection: SelectionRange | null = null;
    dragStartCol: number | null = null;
    mouseMoveHandler: ((event: PointerEvent) => void) | null = null;
    autoScrollInterval: null | number = null;
    lastX = 0;
    lastY = 0;

    constructor(
        griddrawer: GridDrawer,
        rows: Rows,
        cols: Cols,
        cellmanager: CellManager,
        canvas: HTMLCanvasElement,
        statistics: Statistics | null = null,
        scrollRefresh : ScrollRefresh | null = null
    ) {
        this.container = document.querySelector('.container') as HTMLElement;
        this.griddrawer = griddrawer;
        this.rows = rows;
        this.cols = cols;
        this.cellmanager = cellmanager;
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d");
        this.statistics = statistics;
        this.scrollRefresh = scrollRefresh;
        this.listenSelectionChange();
    }

    seteventmanager(em: EventManager) {
        this.eventmanager = em;
    }

    listenSelectionChange() {
        window.addEventListener('selection-changed', (e: any) => {
            if (e.detail) {
                this.selection = e.detail.selection;
                this.selectionarr = e.detail.selectionarr;
                // Painter.paintSelectedCells(
                //     this.ctx!, this.griddrawer, this.rows, this.cols,
                //     this.cellmanager, this.container, this.selection, this.selectionarr,e
                // );
            }
        });
    }

    dispatchSelectionChangeEvent(selection: SelectionRange, selectionarr: SelectionRange[]) {
        const event = new CustomEvent('selection-changed', {
            detail: { selection, selectionarr }
        });
        window.dispatchEvent(event);
    }

    hittest(event: PointerEvent): boolean {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        console.log(x);
        console.log(y);
        
        
        return y < this.rows.heights[0] && x > this.cols.widths[0];
    }

    handlePointerDown(event: PointerEvent) {
        console.log('colselection handlePointerDown');
        
        this.startAutoScroll();
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        if (y < this.rows.heights[0] && x > this.cols.widths[0]) {
            const virtualX = x + this.container.scrollLeft;
            const col = findIndexFromCoord(virtualX, this.cols.widths);
            const colSelection: SelectionRange = {
                    startRow: 0,
                    startCol: col,
                    endRow: this.rows.n - 1,
                    endCol: col
                };
            const exists = this.selectionarr.some(obj => obj.startRow == 0 && obj.startCol == col && obj.endRow == this.rows.n - 1 && obj.endCol == col) 
            
            if (event.ctrlKey) {
                
                if (exists){
                    this.selectionarr = this.selectionarr.filter(
                    obj => !(obj.startRow == 0 && obj.startCol == col && obj.endRow == this.rows.n - 1 && obj.endCol == col));
                }else {
                    this.selectionarr.push(colSelection);
                }
            } else if (!event.ctrlKey && this.selectionarr.length > 0) {
                this.selectionarr = [];
            }

            if(colSelection != this.selection && !exists){
                this.selection = {
                    startRow: 0,
                    startCol: col,
                    endRow: this.rows.n - 1,
                    endCol: col
                };
            }
            this.dragStartCol = col;
            console.log(col);
            
            this.mouseMoveHandler = (moveEvent) => this.handlePointerMove(moveEvent);
            this.container.addEventListener('pointermove', this.mouseMoveHandler);
            if(this.selection){
                this.dispatchSelectionChangeEvent(this.selection,this.selectionarr);
            }
            Painter.paintSelectedCells(this.ctx!, this.griddrawer, this.rows, this.cols, this.cellmanager, this.container, this.selection, this.selectionarr,event);
            //cornercell
            paintCell(this.ctx!, this.container, this.rows, this.cols,
                            0,0,null, this.selection!, this.selectionarr,event);   
        }
    }

    handlePointerMove(event: PointerEvent) {
        requestAnimationFrame(() => {
        this.lastX = event.clientX;
        this.lastY = event.clientY;
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const virtualX = x + this.container.scrollLeft;
        const currentCol = findIndexFromCoord(virtualX, this.cols.widths);
        console.log(`Current column: ${currentCol}, Drag start column: ${this.dragStartCol}`);
        
        if (this.selection && this.dragStartCol !== null) {
            this.selection.endCol = currentCol;
            this.dispatchSelectionChangeEvent(this.selection,this.selectionarr);
            
            
            
            
            
            Painter.paintSelectedCells(this.ctx!, this.griddrawer, this.rows, this.cols, this.cellmanager, this.container, this.selection, this.selectionarr,event);
            //cornercell
            paintCell(this.ctx!, this.container, this.rows, this.cols,
                            0,0,null, this.selection!, this.selectionarr,event); 
        }
        });
    }

    handlePointerUp(event: PointerEvent) {
        this.stopAutoScroll();
        if (this.mouseMoveHandler) {
            this.container.removeEventListener('pointermove', this.mouseMoveHandler);
            this.mouseMoveHandler = null;
        }
        if (this.selection) {
                this.selectionarr.push(this.selection);
                this.dispatchSelectionChangeEvent(this.selection,this.selectionarr);
                Painter.paintSelectedCells(this.ctx!, this.griddrawer, this.rows, this.cols, this.cellmanager, this.container, this.selection, this.selectionarr,event);
                //cornercell
                paintCell(this.ctx!, this.container, this.rows, this.cols,
                                0,0,null, this.selection!, this.selectionarr,event); 
        }
        
        this.lastX = 0;
        this.lastY = 0;
    }

    startAutoScroll() {
        if (this.autoScrollInterval != null) return;
        this.autoScrollInterval = window.setInterval(() => this.autoScrollLogic(), 60);
    }
    stopAutoScroll() {
        if (this.autoScrollInterval !== null) {
            clearInterval(this.autoScrollInterval);
            this.autoScrollInterval = null;
        }
    }
    autoScrollLogic() {
        if (!this.mouseMoveHandler) return;
        if (this.lastX === 0 && this.lastY === 0) return;
        const originalScrollLeft = this.container.scrollLeft;
        const originalScrollTop = this.container.scrollTop;
        const SCROLL_BUFFER_RIGHT = 50;
        const SCROLL_BUFFER_LEFT = 250;
        const SCROLL_BUFFER_BOTTOM = 2;
        const SCROLL_BUFFER_TOP = 100;
        const SCROLL_STEP = 20;
        const viewportLeft = this.container.scrollLeft;
        const viewportRight = viewportLeft + this.container.clientWidth;
        const viewportTop = this.container.scrollTop;
        const viewportBottom = viewportTop + this.container.clientHeight;
        if (this.lastX + this.container.scrollLeft > viewportRight - SCROLL_BUFFER_RIGHT) {
            this.container.scrollLeft += SCROLL_STEP;
        }
        else if (this.lastX < SCROLL_BUFFER_LEFT) {
            this.container.scrollLeft -= SCROLL_STEP;
        }
        if (this.lastY + this.container.scrollTop - 50 > viewportBottom - SCROLL_BUFFER_BOTTOM) {
            this.container.scrollTop += SCROLL_STEP;
        }
        else if (this.lastY < SCROLL_BUFFER_TOP) {
            this.container.scrollTop -= SCROLL_STEP;
        }
        const didScroll = (this.container.scrollLeft !== originalScrollLeft) ||
            (this.container.scrollTop !== originalScrollTop);
        if (didScroll && this.mouseMoveHandler) {
            const syntheticEvent = new PointerEvent('pointermove', {
                clientX: this.lastX,
                clientY: this.lastY,
                bubbles: true,
                cancelable: true,
                view: window
            });
            this.mouseMoveHandler(syntheticEvent);
        }
    }
}