/**
 * Sufixo `?url` do Vite: importa o asset e devolve a URL final dele, já
 * empacotada e com hash. Usado para o worker do pdf.js, que precisa ser
 * servido como arquivo próprio.
 *
 * Declarado à mão em vez de puxar `vite/client` inteiro — o projeto já segue
 * essa convenção em `function-plot.d.ts` e `speech-recognition.d.ts`, e uma
 * declaração estreita não muda a tipagem global de nada mais.
 */
declare module '*?url' {
  const url: string;
  export default url;
}
