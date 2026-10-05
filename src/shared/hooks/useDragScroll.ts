import { useRef, type MouseEvent } from 'react';

/**
 * Arrastar-com-o-mouse pra rolar uma faixa horizontal — no touch o navegador
 * já dá isso de graça, isto aqui é só o equivalente pra quem usa mouse/trackpad
 * sem scroll horizontal nativo. `onClickCapture` bloqueia o clique quando o
 * gesto foi um arraste (senão soltar o mouse em cima de um link navega sem
 * querer no meio do drag).
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const state = useRef({ isDown: false, startX: 0, scrollLeft: 0, moved: false });

  function onMouseDown(e: MouseEvent) {
    const el = ref.current;
    if (!el) return;
    state.current.isDown = true;
    state.current.moved = false;
    state.current.startX = e.pageX;
    state.current.scrollLeft = el.scrollLeft;
  }

  function endDrag() {
    state.current.isDown = false;
  }

  function onMouseMove(e: MouseEvent) {
    const el = ref.current;
    if (!el || !state.current.isDown) return;
    e.preventDefault();
    const delta = e.pageX - state.current.startX;
    if (Math.abs(delta) > 3) state.current.moved = true;
    el.scrollLeft = state.current.scrollLeft - delta;
  }

  function onClickCapture(e: MouseEvent) {
    if (state.current.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return {
    ref,
    onMouseDown,
    onMouseLeave: endDrag,
    onMouseUp: endDrag,
    onMouseMove,
    onClickCapture,
  };
}
