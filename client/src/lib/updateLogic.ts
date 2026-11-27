// Update + Backup ke SHUDDH (pure) faisle — bina kisi import ke,
// taaki inhe alag se test kiya ja sake aur teeno apps ek hi niyam
// istemal karein.

// Naya version dikhana hai ya nahi?
// - Server ka code apne code se bada ho tabhi update hai.
// - Wahi version pehle "Baad me" (snooze) kiya ho aur zor-daar
//   (mandatory) na ho to dobara pareshan nahi karte.
// - Mandatory update snooze ko bhi overrule karta hai.
export function shouldPromptUpdate(args: {
  serverCode: number;
  ownCode: number;
  mandatory: boolean;
  snoozedCode: number | null;
}): boolean {
  if (!args.serverCode || args.serverCode <= args.ownCode) return false;
  if (
    !args.mandatory &&
    args.snoozedCode != null &&
    args.snoozedCode >= args.serverCode
  ) {
    return false;
  }
  return true;
}

// Backup due hai ya nahi? Kabhi backup na hua ho (null) ya aakhri
// backup 24 ghante se purana ho to due. Galat/adhuri tareekh bhi
// due mani jati hai (suraksha pehle).
export function isBackupDue(
  lastBackupAtIso: string | null,
  now: Date,
): boolean {
  if (!lastBackupAtIso) return true;
  const last = new Date(lastBackupAtIso).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last > 24 * 60 * 60 * 1000;
}
