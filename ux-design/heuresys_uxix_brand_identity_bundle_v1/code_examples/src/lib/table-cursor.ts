/**
 * Heuresys table cross-hair helper.
 *
 * Source: ux-design/prototypes/superuser-system-health.html
 * Doctrine: docs/13_best_practices_for_modern_saas_ui.md +
 *           docs/16_system_health_admin_dashboard_patterns.md
 *
 * Attaches `mouseenter` / `mouseleave` handlers on every `<th>` (header)
 * and `<td>` (body cell) of the table so that hovering a cell highlights
 * its column and its column header. The row highlight is handled by
 * `tbody tr:hover` CSS rule globally (see hover-affordance.css).
 *
 * Returns an `unbind()` function for React useEffect cleanup.
 */

export type CrossHairBindings = () => void;

export function attachCrossHair(table: HTMLTableElement): CrossHairBindings {
  const headerCells = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'));
  const bodyRows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr'));

  const listeners: Array<{
    el: EventTarget;
    type: 'mouseenter' | 'mouseleave';
    handler: EventListener;
  }> = [];

  function on(el: EventTarget, type: 'mouseenter' | 'mouseleave', handler: EventListener) {
    el.addEventListener(type, handler);
    listeners.push({ el, type, handler });
  }

  function clearTableCross() {
    table.querySelectorAll('.col-cross').forEach((el) => el.classList.remove('col-cross'));
    table.querySelectorAll('.cell-cross').forEach((el) => el.classList.remove('cell-cross'));
    table
      .querySelectorAll('.col-hover-header')
      .forEach((el) => el.classList.remove('col-hover-header'));
  }

  // Header hover → tint entire column
  headerCells.forEach((th, colIdx) => {
    on(th, 'mouseenter', () => {
      clearTableCross();
      th.classList.add('col-hover-header');
      bodyRows.forEach((row) => {
        const cell = row.children[colIdx] as HTMLElement | undefined;
        if (cell) cell.classList.add('col-cross');
      });
    });
    on(th, 'mouseleave', clearTableCross);
  });

  // Body cell hover → cross-hair (column tint + cell intersection + header highlight)
  bodyRows.forEach((row) => {
    Array.from(row.children).forEach((td, colIdx) => {
      on(td, 'mouseenter', () => {
        clearTableCross();
        const header = headerCells[colIdx];
        if (header) header.classList.add('col-hover-header');
        bodyRows.forEach((r) => {
          const c = r.children[colIdx] as HTMLElement | undefined;
          if (c) c.classList.add('col-cross');
        });
        (td as HTMLElement).classList.add('cell-cross');
      });
      on(td, 'mouseleave', clearTableCross);
    });
  });

  return function unbind() {
    listeners.forEach(({ el, type, handler }) => el.removeEventListener(type, handler));
    clearTableCross();
  };
}
