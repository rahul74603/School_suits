// =============================================================================
// Modal Stack (v3.1) — hardware back button ke liye khule overlays ka hisaab
// -----------------------------------------------------------------------------
// Masla (user ki shikayat): Android ka back button dabane par app ke andar
// khula print page / bada overlay band nahi hota tha — ya to kuch nahi hota
// tha, ya app hi peeche chali jati thi. Wajah: App.tsx ka back handler sirf
// browser-history jaanta tha, app ke andar ke overlays ka use koi pata hi
// nahi tha.
//
// Hal: ek halka sa module-level stack. Jo bhi overlay khud ko "sabse upar
// wala band hone layak" samajhta hai (PrintViewer, aage chal kar bade
// dialogs), wo khulte samay apna close-callback yahan register karta hai
// aur band hote samay unregister. Back button ka handler pehle is stack
// ko poochta hai — stack khaali na ho to sabse upar wala band, history
// baad me.
//
// Ye file jaan-boojh kar React-free hai (sirf ek array) taaki iska unit
// test bina DOM/React ke chal sake aur koi bhi component bina context
// ke ise istemal kar sake.
// =============================================================================

export type ModalCloseFn = () => void;

interface ModalEntry {
  id: number;
  close: ModalCloseFn;
}

const stack: ModalEntry[] = [];
let nextId = 1;

/** Overlay khula — apna close-callback register karo. Mila hua id
 *  band hote samay popModal(id) ko dena hai. */
export function pushModal(close: ModalCloseFn): number {
  const id = nextId++;
  stack.push({ id, close });
  return id;
}

/** Overlay band ho gaya (kisi bhi tareeke se) — stack se hatao.
 *  Id na mile (pehle hi hata hua ho) to kuch nahi hota. */
export function popModal(id: number): void {
  const i = stack.findIndex((e) => e.id === id);
  if (i >= 0) stack.splice(i, 1);
}

/** Abhi kitne overlay khule hain. */
export function modalStackSize(): number {
  return stack.length;
}

/** Sabse upar wala overlay band karo. Kuch band hua to true,
 *  stack khaali tha to false. Close-callback agar error phenke to
 *  bhi stack saaf rehta hai (entry pehle hi nikal chuki hoti hai). */
export function closeTopModal(): boolean {
  const top = stack.pop();
  if (!top) return false;
  try {
    top.close();
  } catch {
    // Close-callback ki galti back-button ko nahi rok sakti.
  }
  return true;
}

/** Sirf tests ke liye — poora stack khaali karo. */
export function clearModalStack(): void {
  stack.length = 0;
}
