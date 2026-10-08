// Copia texto para a área de transferência com fallback para contextos
// onde a Clipboard API falha (permissão negada, iframe, HTTP). Retorna
// true quando o conteúdo ficou pronto para colar.
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // cai para o fallback legado abaixo
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
