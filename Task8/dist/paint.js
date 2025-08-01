import { getExcelColumnLabel } from "./utils.js";
/**
 * Paints all selections in selectionarr (multi-selection).
 * Only paints cells and headers that are in the visible region (viewport).
 * Also paints rectangle overlays for selection blocks.
 *
 * @param ctx - Canvas rendering context
 * @param griddrawer - Object responsible for grid rendering (not used for visible region)
 * @param rows - Rows dimension object
 * @param cols - Columns dimension object
 * @param cellmanager - Provides cell values
 * @param container - Scrollable container element
 * @param selectionarr - Array of selection ranges (multi-selection)
 */
export function paintMultiSelections(ctx, griddrawer, rows, cols, cellmanager, container, selectionarr, event) {
    const visible = calculateVisibleRegion(rows, cols, container);
    // Track painted cells for this frame
    const paintedCells = new Set();
    for (const sel of selectionarr) {
        paintSelectionBlock(ctx, rows, cols, cellmanager, container, sel, selectionarr, visible, event, paintedCells);
        paintSelectionRectangle(ctx, rows, cols, container, sel, visible, false);
    }
}
/**
 * Main entry: Paints multi-selection and active selection.
 * Only visible region is painted. Also paints rectangle overlays.
 * This should be called on every selection change event, with both selection and selectionarr.
 *
 * @param ctx - Canvas rendering context
 * @param griddrawer - Object responsible for grid rendering
 * @param rows, cols - dimension objects
 * @param cellmanager - Provides cell values
 * @param container - Scrollable container element
 * @param selection - Current active selection
 * @param selectionarr - Array of multi-selection ranges
 */
export class Painter {
    static paintSelectedCells(ctx, griddrawer, rows, cols, cellmanager, container, selection, selectionarr, event) {
        const { startRow, endRow, startCol, endCol } = griddrawer.getVisibleRange(rows, cols);
        if (!ctx)
            return;
        griddrawer.rendervisible(rows, cols);
        const visible = calculateVisibleRegion(rows, cols, container);
        // Track which cells were already painted this frame
        const paintedCells = new Set();
        // Paint all multi-selections first (lower z-order)
        for (const sel of selectionarr) {
            paintSelectionBlock(ctx, rows, cols, cellmanager, container, sel, selectionarr, visible, event, paintedCells);
            paintSelectionRectangle(ctx, rows, cols, container, sel, visible, false);
        }
        // Paint the current/active selection last (topmost z-order)
        if (selection) {
            paintSelectionBlock(ctx, rows, cols, cellmanager, container, selection, selectionarr, visible, event, paintedCells);
            paintSelectionRectangle(ctx, rows, cols, container, selection, visible, true);
        }
        drawVisibleColumnHeaders(startCol, endCol, rows, cols, container, ctx, selectionarr, selection);
        drawVisibleRowHeaders(startRow, endRow, rows, cols, container, ctx, selectionarr, selection);
    }
}
/**
 * Calculates the first/last visible row and column based on container scroll and size.
 * This avoids painting cells outside the viewport, improving performance on large grids.
 *
 * @param rows - Rows dimension object
 * @param cols - Columns dimension object
 * @param container - Scrollable container element
 * @returns Object with indices: visibleLeft, visibleRight, visibleTop, visibleBottom
 */
function calculateVisibleRegion(rows, cols, container) {
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;
    const clientWidth = container.clientWidth;
    const clientHeight = container.clientHeight;
    // Use binary search to find first visible column
    const visibleLeft = binarySearchPosition(cols.positions, scrollLeft);
    const visibleRight = binarySearchPosition(cols.positions, scrollLeft + clientWidth);
    // Use binary search to find first visible row
    const visibleTop = binarySearchPosition(rows.positions, scrollTop);
    const visibleBottom = binarySearchPosition(rows.positions, scrollTop + clientHeight);
    return { visibleLeft, visibleRight, visibleTop, visibleBottom };
}
// Binary search helper - finds index where position would be inserted
function binarySearchPosition(positions, target) {
    let low = 0;
    let high = positions.length - 1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (positions[mid] < target) {
            low = mid + 1;
        }
        else if (positions[mid] > target) {
            high = mid - 1;
        }
        else {
            return mid; // Exact match
        }
    }
    return Math.max(0, low - 1); // Return closest position
}
/**
 * Paints a selection block cell-by-cell, but only for cells within the visible region.
 * Also paints row and column headers if they are visible.
 *
 * @param ctx - Canvas context
 * @param rows, cols - dimension objects
 * @param cellmanager - Provides cell values
 * @param container - Scrollable container element
 * @param selection - Selection range to paint
 * @param selectionarr - Array of multi-selection ranges (for header highlighting)
 * @param visible - Object with visible row/col indices
 */
/**
 * Paints a selection block cell-by-cell, but only for cells within the visible region.
 * Now only paints a cell if it hasn't been painted already this frame.
 */
function paintSelectionBlock(ctx, rows, cols, cellmanager, container, selection, selectionarr, visible, event, paintedCells) {
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);
    // Paint all normal cells that are visible (main grid region)
    for (let r = Math.max(minRow, visible.visibleTop); r <= Math.min(maxRow, visible.visibleBottom); r++)
        for (let c = Math.max(minCol, visible.visibleLeft); c <= Math.min(maxCol, visible.visibleRight); c++) {
            const key = `${r},${c}`;
            if (paintedCells.has(key))
                continue;
            paintedCells.add(key);
            const cell = cellmanager.getCell(r, c);
            const value = cell ? cell.value : null;
            paintCell(ctx, container, rows, cols, r, c, value, selection, selectionarr, event);
        }
    // Paint row headers if visible (first column)
    for (let r = Math.max(minRow, visible.visibleTop); r <= Math.min(maxRow, visible.visibleBottom); r++)
        if (visible.visibleLeft === 0) {
            const key = `${r},0`;
            if (!paintedCells.has(key)) {
                paintedCells.add(key);
                paintCell(ctx, container, rows, cols, r, 0, r, selection, selectionarr, event);
            }
        }
    // Paint column headers if visible (first row)
    for (let c = Math.max(minCol, visible.visibleLeft); c <= Math.min(maxCol, visible.visibleRight); c++)
        if (visible.visibleTop === 0) {
            const key = `0,${c}`;
            if (!paintedCells.has(key)) {
                paintedCells.add(key);
                const columnLabel = getExcelColumnLabel(c - 1);
                paintCell(ctx, container, rows, cols, 0, c, columnLabel, selection, selectionarr, event);
            }
        }
}
/**
 * Draws a rectangle overlay for a selection block, only for the visible part of the selection.
 * This rectangle visually outlines the selection block for the user
 * (useful for accessibility and keyboard navigation).
 *
 * @param ctx - Canvas context
 * @param rows, cols - dimension objects
 * @param container - Scrollable container element
 * @param selection - Selection range for the rectangle
 * @param visible - Object with visible row/col indices
 * @param isActive - Whether this is the main selection (true) or a multi-selection (false)
 */
function paintSelectionRectangle(ctx, rows, cols, container, selection, visible, isActive // true for main selection, false for multi-selection
) {
    // Clamp to data region (never include header row/col)
    const minRow = Math.max(1, Math.max(Math.min(selection.startRow, selection.endRow), visible.visibleTop));
    const maxRow = Math.max(1, Math.min(Math.max(selection.startRow, selection.endRow), visible.visibleBottom));
    const minCol = Math.max(1, Math.max(Math.min(selection.startCol, selection.endCol), visible.visibleLeft));
    const maxCol = Math.max(1, Math.min(Math.max(selection.startCol, selection.endCol), visible.visibleRight));
    // If selection is entirely in header, don't draw
    if (minRow > maxRow || minCol > maxCol)
        return;
    // Use position differences for efficient width/height calculation
    const w = cols.getPosition(maxCol + 1) - cols.getPosition(minCol);
    const h = rows.getPosition(maxRow + 1) - rows.getPosition(minRow);
    // Compute top-left pixel of the rectangle
    // Get positions directly with O(1) lookup
    const x = cols.getPosition(minCol);
    const y = rows.getPosition(minRow);
    // Adjust for scroll position
    const drawX = x - container.scrollLeft;
    const drawY = y - container.scrollTop;
    // ctx.save();
    // ctx.globalAlpha = 1;
    // ctx.strokeStyle = "rgb(19,126,67)";
    // ctx.lineWidth = 2;
    // ctx.beginPath();
    // ctx.rect(drawX, drawY, w, h);
    // ctx.stroke();
    // ctx.restore();
}
/**
 * Paints an individual cell or header cell.
 * Handles background, border, and text rendering based on selection and header state.
 * This logic is unchanged from your original code.
 *
 * @param ctx - Canvas context
 * @param container - Scrollable container element
 * @param rows, cols - dimension objects
 * @param row, col - Cell coordinates
 * @param value - Cell value or header label
 * @param activeSelection - Current selection range
 * @param selectionarr - All multi-selections (for multi-selected header state)
 */
export function paintCell(ctx, container, rows, cols, row, col, value, activeSelection, selectionarr, event) {
    if (row === 0 && col === 0) {
        value = ""; // Leave corner cell empty or put a custom value
    }
    const w = cols.widths[col];
    const h = rows.heights[row];
    // Calculate pixel position in canvas (with scroll offset)
    let drawX, drawY;
    drawX = calculateDrawX(row, col, cols, container);
    drawY = calculateDrawY(row, col, rows, container);
    // Selection and header logic
    const isHeader = row === 0 || col === 0;
    const isMultiSelectedHeader = isHeaderSelectedByAnySelection(row, col, selectionarr);
    const minRow = Math.min(activeSelection.startRow, activeSelection.endRow);
    const maxRow = Math.max(activeSelection.startRow, activeSelection.endRow);
    const minCol = Math.min(activeSelection.startCol, activeSelection.endCol);
    const maxCol = Math.max(activeSelection.startCol, activeSelection.endCol);
    const selectionStartedFromRowHeader = activeSelection.startCol === 0;
    const selectionStartedFromColHeader = activeSelection.startRow === 0;
    const isSelectedColumnHeader = row === 0 && col > 0 && selectionStartedFromColHeader &&
        col >= minCol && col <= maxCol;
    const isSelectedRowHeader = col === 0 && row > 0 && selectionStartedFromRowHeader &&
        row >= minRow && row <= maxRow;
    const isHighlightedColumnHeader = row === 0 && col > 0 &&
        col >= minCol && col <= maxCol &&
        !selectionStartedFromColHeader;
    const isHighlightedRowHeader = col === 0 && row > 0 &&
        row >= minRow && row <= maxRow &&
        !selectionStartedFromRowHeader;
    // ---- DRAWING CELL BACKGROUND ----
    ctx.clearRect(drawX, drawY, w, h);
    // Background color logic: unchanged (do not modify colors)
    if (isMultiSelectedHeader) {
        paintisMultiSelectedHeader(drawX, drawY, w, h, ctx);
    }
    else if (isSelectedColumnHeader || isSelectedRowHeader) {
        paintisSelectedHeader(drawX, drawY, w, h, ctx);
    }
    else if (isHighlightedColumnHeader || isHighlightedRowHeader) {
        paintisHighlitedHeder(drawX, drawY, w, h, ctx);
    }
    else if (isHeader) {
        paintisHeader(drawX, drawY, w, h, ctx);
    }
    else {
        ctx.fillStyle = "rgba(202,234,216,1)";
        ctx.fillRect(drawX + 0.5, drawY + 0.5, w - 1, h - 1);
    }
    // ---- DRAWING CELL BORDERS ----
    ctx.strokeStyle = "#e0e0e0";
    ctx.strokeRect(drawX + 0.5, drawY + 0.5, w, h);
    ctx.strokeStyle = "rgb(19, 126, 67)";
    ctx.lineWidth = 2;
    // Draw selection borders for edge cells
    if (!isHeader && !event.ctrlKey) {
        const isTopEdge = row === minRow;
        const isBottomEdge = row === maxRow;
        const isLeftEdge = col === minCol;
        const isRightEdge = col === maxCol;
        if (isTopEdge || isBottomEdge || isLeftEdge || isRightEdge) {
            ctx.beginPath();
            if (isTopEdge) {
                ctx.moveTo(drawX, drawY);
                ctx.lineTo(drawX + w, drawY);
            }
            if (isBottomEdge) {
                ctx.moveTo(drawX, drawY + h);
                ctx.lineTo(drawX + w, drawY + h);
            }
            if (isLeftEdge) {
                ctx.moveTo(drawX, drawY);
                ctx.lineTo(drawX, drawY + h);
            }
            if (isRightEdge) {
                ctx.moveTo(drawX + w, drawY);
                ctx.lineTo(drawX + w, drawY + h);
            }
            ctx.stroke();
        }
    }
    // Header borders (bottom for col headers, right for row headers)
    if (isSelectedColumnHeader || isHighlightedColumnHeader) {
        ctx.beginPath();
        ctx.moveTo(drawX + 0.5, drawY + h - 0.5);
        ctx.lineTo(drawX + w - 0.5, drawY + h - 0.5);
        ctx.stroke();
    }
    if (isSelectedRowHeader || isHighlightedRowHeader) {
        ctx.beginPath();
        ctx.moveTo(drawX + w - 0.5, drawY + 0.5);
        ctx.lineTo(drawX + w - 0.5, drawY + h - 0.5);
        ctx.stroke();
    }
    ctx.lineWidth = 1;
    // ---- DRAWING TEXT ----
    // console.log(typeof value, value);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = (isSelectedColumnHeader || isSelectedRowHeader) ? "#FFFFFF" : "#000";
    ctx.font = "12px Arial";
    let parsedNum = parseFloat(value != null ? value.toString() : "");
    if (!isNaN(parsedNum)) {
        ctx.textAlign = "right";
        ctx.fillText(value != null ? value.toString() : "", drawX + w - 8, drawY + h / 2);
    }
    else {
        ctx.textAlign = "left";
        ctx.fillText(value != null ? value.toString() : "", drawX + 8, drawY + h / 2);
    }
    // ctx.fillText(
    //     value != null ? String(value) : "",
    //     drawX + w / 2,
    //     drawY + h / 2
    // );
}
/**
 * Helper for multi-selected header highlighting.
 * Returns true if this cell is a header and selected by any selection in selectionarr.
 * Used to highlight headers for multi-selection.
 *
 * @param row, col - cell coordinates
 * @param selectionarr - array of selection ranges
 */
function isHeaderSelectedByAnySelection(row, col, selectionarr) {
    if (row === 0 && col > 0) {
        // Column header: check if any selection started from header and includes this column
        return selectionarr.some(sel => sel.startRow === 0 &&
            col >= Math.min(sel.startCol, sel.endCol) &&
            col <= Math.max(sel.startCol, sel.endCol));
    }
    else if (col === 0 && row > 0) {
        // Row header: check if any selection started from header and includes this row
        return selectionarr.some(sel => sel.startCol === 0 &&
            row >= Math.min(sel.startRow, sel.endRow) &&
            row <= Math.max(sel.startRow, sel.endRow));
    }
    return false;
}
export function paintisMultiSelectedHeader(drawX, drawY, w, h, ctx) {
    ctx.fillStyle = "#0a753a";
    ctx.fillRect(drawX, drawY, w, h);
}
export function paintisSelectedHeader(drawX, drawY, w, h, ctx) {
    ctx.fillStyle = "#0a753a";
    ctx.fillRect(drawX, drawY, w, h);
}
export function paintisHighlitedHeder(drawX, drawY, w, h, ctx) {
    ctx.fillStyle = "rgba(202,234,216,1)";
    ctx.fillRect(drawX, drawY, w, h);
}
export function paintisHeader(drawX, drawY, w, h, ctx) {
    ctx.fillStyle = "rgba(245,245,245,1)";
    ctx.fillRect(drawX, drawY, w, h);
}
/**
 * Calculates the drawX coordinate for a cell, given its row, col, and scroll position.
 * Also calculates the x offset by summing column widths.
 */
export function calculateDrawX(row, col, cols, container) {
    const x = cols.getPosition(col);
    if (row === 0 && col === 0) {
        return 0;
    }
    else if (row === 0) {
        return x - container.scrollLeft;
    }
    else if (col === 0) {
        return 0;
    }
    else {
        return x - container.scrollLeft;
    }
}
/**
 * Calculates the drawY coordinate for a cell, given its row, col, and scroll position.
 * Also calculates the y offset by summing row heights.
 */
export function calculateDrawY(row, col, rows, container) {
    const y = rows.getPosition(row);
    if (row === 0 && col === 0) {
        return 0;
    }
    else if (row === 0) {
        return 0;
    }
    else if (col === 0) {
        return y - container.scrollTop;
    }
    else {
        return y - container.scrollTop;
    }
}
export function drawFixedRowHeader(row, col, rows, cols, container, ctx, selectionarr, activeSelection) {
    const w = cols.widths[col];
    const h = rows.heights[row];
    let drawX, drawY;
    drawX = calculateDrawX(row, col, cols, container);
    drawY = calculateDrawY(row, col, rows, container);
    // Selection and header logic
    const isHeader = row === 0 || col === 0;
    const isMultiSelectedHeader = isHeaderSelectedByAnySelection(row, col, selectionarr);
    const minRow = Math.min(activeSelection.startRow, activeSelection.endRow);
    const maxRow = Math.max(activeSelection.startRow, activeSelection.endRow);
    const minCol = Math.min(activeSelection.startCol, activeSelection.endCol);
    const maxCol = Math.max(activeSelection.startCol, activeSelection.endCol);
    const selectionStartedFromRowHeader = activeSelection.startCol === 0;
    const selectionStartedFromColHeader = activeSelection.startRow === 0;
    const isSelectedColumnHeader = row === 0 && col > 0 && selectionStartedFromColHeader &&
        col >= minCol && col <= maxCol;
    const isSelectedRowHeader = col === 0 && row > 0 && selectionStartedFromRowHeader &&
        row >= minRow && row <= maxRow;
    const isHighlightedColumnHeader = row === 0 && col > 0 &&
        col >= minCol && col <= maxCol &&
        !selectionStartedFromColHeader;
    const isHighlightedRowHeader = col === 0 && row > 0 &&
        row >= minRow && row <= maxRow &&
        !selectionStartedFromRowHeader;
    // Background color logic: unchanged (do not modify colors)
    if (isMultiSelectedHeader) {
        paintisMultiSelectedHeader(drawX, drawY, w, h, ctx);
    }
    else if (isSelectedColumnHeader || isSelectedRowHeader) {
        paintisSelectedHeader(drawX, drawY, w, h, ctx);
    }
    else if (isHighlightedColumnHeader || isHighlightedRowHeader) {
        paintisHighlitedHeder(drawX, drawY, w, h, ctx);
    }
    else if (isHeader) {
        paintisHeader(drawX, drawY, w, h, ctx);
    }
    else {
        ctx.fillStyle = "rgba(245,245,245,0.95)";
        ctx.fillRect(drawX + 0.5, drawY + 0.5, w - 1, h - 1);
    }
    // Header borders (bottom for col headers, right for row headers)
    if (isSelectedColumnHeader || isHighlightedColumnHeader) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#0a753a";
        ctx.beginPath();
        ctx.moveTo(drawX + 0.5, drawY + h - 0.5);
        ctx.lineTo(drawX + w - 0.5, drawY + h - 0.5);
        ctx.stroke();
    }
    if (isSelectedRowHeader || isHighlightedRowHeader) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#0a753a";
        ctx.beginPath();
        ctx.moveTo(drawX + w - 0.5, drawY + 0.5);
        ctx.lineTo(drawX + w - 0.5, drawY + h - 0.5);
        ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e0e0e0";
    ctx.strokeRect(drawX + 0.5, drawY + 0.5, w, h);
    ctx.fillStyle = "#000";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    ctx.fillText(row.toString(), drawX + w - 8, drawY + h / 2);
}
/** Modular function: Draw all row headers in visible range */
export function drawVisibleRowHeaders(startRow, endRow, rows, cols, container, ctx, selectionarr, selection) {
    for (let row = startRow; row <= endRow; row++) {
        if (row === 0)
            continue;
        drawFixedRowHeader(row, 0, rows, cols, container, ctx, selectionarr, selection);
    }
}
// --- Draw One Fixed Column Header ---
export function drawFixedColumnHeader(row, col, rows, cols, container, ctx, selectionarr, activeSelection) {
    const w = cols.widths[col];
    const h = rows.heights[row];
    let drawX, drawY;
    drawX = calculateDrawX(row, col, cols, container);
    drawY = calculateDrawY(row, col, rows, container);
    // Selection and header logic
    const isHeader = row === 0 || col === 0;
    const isMultiSelectedHeader = isHeaderSelectedByAnySelection(row, col, selectionarr);
    const minRow = Math.min(activeSelection.startRow, activeSelection.endRow);
    const maxRow = Math.max(activeSelection.startRow, activeSelection.endRow);
    const minCol = Math.min(activeSelection.startCol, activeSelection.endCol);
    const maxCol = Math.max(activeSelection.startCol, activeSelection.endCol);
    const selectionStartedFromRowHeader = activeSelection.startCol === 0;
    const selectionStartedFromColHeader = activeSelection.startRow === 0;
    const isSelectedColumnHeader = row === 0 && col > 0 && selectionStartedFromColHeader &&
        col >= minCol && col <= maxCol;
    const isSelectedRowHeader = col === 0 && row > 0 && selectionStartedFromRowHeader &&
        row >= minRow && row <= maxRow;
    const isHighlightedColumnHeader = row === 0 && col > 0 &&
        col >= minCol && col <= maxCol &&
        !selectionStartedFromColHeader;
    const isHighlightedRowHeader = col === 0 && row > 0 &&
        row >= minRow && row <= maxRow &&
        !selectionStartedFromRowHeader;
    // Background color logic
    if (isMultiSelectedHeader) {
        paintisMultiSelectedHeader(drawX, drawY, w, h, ctx);
    }
    else if (isSelectedColumnHeader || isSelectedRowHeader) {
        paintisSelectedHeader(drawX, drawY, w, h, ctx);
    }
    else if (isHighlightedColumnHeader || isHighlightedRowHeader) {
        paintisHighlitedHeder(drawX, drawY, w, h, ctx);
    }
    else if (isHeader) {
        paintisHeader(drawX, drawY, w, h, ctx);
    }
    else {
        ctx.fillStyle = "rgba(245,245,245,0.95)";
        ctx.fillRect(drawX + 0.5, drawY + 0.5, w - 1, h - 1);
    }
    // Header borders (bottom for col headers, right for row headers)
    if (isSelectedColumnHeader || isHighlightedColumnHeader) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#0a753a";
        ctx.beginPath();
        ctx.moveTo(drawX + 0.5, drawY + h - 0.5);
        ctx.lineTo(drawX + w - 0.5, drawY + h - 0.5);
        ctx.stroke();
    }
    if (isSelectedRowHeader || isHighlightedRowHeader) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#0a753a";
        ctx.beginPath();
        ctx.moveTo(drawX + w - 0.5, drawY + 0.5);
        ctx.lineTo(drawX + w - 0.5, drawY + h - 0.5);
        ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e0e0e0";
    ctx.strokeRect(drawX + 0.5, drawY + 0.5, w, h);
    ctx.fillStyle = "#000";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(getExcelColumnLabel(col - 1), drawX + w / 2, drawY + h / 2);
}
/** Modular function: Draw all column headers in visible range */
export function drawVisibleColumnHeaders(startCol, endCol, rows, cols, container, ctx, selectionarr, selection) {
    for (let col = startCol; col <= endCol; col++) {
        if (col === 0)
            continue;
        drawFixedColumnHeader(0, col, rows, cols, container, ctx, selectionarr, selection);
    }
}
// Add this function to paint.ts
export function drawCornerCell(rows, cols, container, ctx) {
    const w = cols.widths[0], h = rows.heights[0];
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(245,245,245,1)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#e0e0e0";
    ctx.strokeRect(0.5, 0.5, w, h);
}
