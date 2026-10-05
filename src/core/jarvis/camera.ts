/**
 * camera.ts — foto para o chat do Jarvis (Fase 13).
 *
 * Sem fluxo especializado: a foto entra no chat como anexo e o Senhor escreve o
 * que quer saber sobre ela. A versão original do plano previa um pipeline de
 * cupom fiscal (extrair valor, estabelecimento, categoria e pré-preencher a
 * transação); foi descartada porque Bernardo disse que não usaria — o que
 * sobrou é a capacidade genérica, que serve para exercício, quadro, edital ou
 * qualquer outra coisa que ele aponte a câmera.
 */

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { ChatImage } from './jarvisService';

/**
 * 1568px é o lado maior útil para a API da Anthropic: acima disso a imagem é
 * reduzida do lado de lá de qualquer jeito, e o que sobe a mais só custa banda
 * (numa rede de celular) e memória. Qualidade 70 num JPEG de texto ainda deixa
 * letra de prova legível.
 */
const MAX_EDGE = 1568;
const QUALITY = 70;

/**
 * Abre câmera ou galeria e devolve a foto pronta para anexar.
 *
 * `CameraSource.Prompt` deixa escolher entre as duas — a galeria é o que
 * permite mandar um print que já está no aparelho, sem depender do
 * compartilhamento.
 *
 * `null` quando o Senhor cancela, que é uso normal e não erro.
 */
export async function takePhotoForChat(): Promise<ChatImage | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: QUALITY,
      width: MAX_EDGE,
      height: MAX_EDGE,
      // Sem isto, foto tirada na horizontal chega deitada e o modelo lê texto
      // rotacionado — que é exatamente o caso de fotografar um exercício.
      correctOrientation: true,
      resultType: CameraResultType.Base64,
      source: CameraSource.Prompt,
      promptLabelHeader: 'Foto para o JARVIS',
      promptLabelPhoto: 'Escolher da galeria',
      promptLabelPicture: 'Tirar foto',
      promptLabelCancel: 'Cancelar',
    });

    if (!photo.base64String) return null;

    return {
      mediaType: photo.format === 'png' ? 'image/png'
        : photo.format === 'webp' ? 'image/webp'
        : 'image/jpeg',
      data: photo.base64String,
    };
  } catch {
    // Cancelar lança no plugin. Não há como distinguir de forma confiável de um
    // erro real sem casar string de mensagem, e tratar os dois como "não veio
    // foto" não perde nada: o chat segue como se nada tivesse sido anexado.
    return null;
  }
}
