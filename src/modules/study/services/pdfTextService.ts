export const pdfTextService = {
  async getText(materialKey: string): Promise<string | null> {
    try {
      // Usa caminho relativo para funcionar tanto no PC quanto via backend acessado
      // do celular/Tailscale. O caller resolve se a chave é o id interno ou o id
      // externo do SIGAA.
      const res = await fetch(`/api/materials/${encodeURIComponent(materialKey)}/text`);
      if (!res.ok) return null;
      const data = (await res.json()) as { text?: string };
      return data.text ?? null;
    } catch {
      return null;
    }
  },
};
