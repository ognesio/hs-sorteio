import { firstName } from './format'

/** Mensagem oficial (mesmo texto do template aprovado na Meta) */
export function luckyNumberMessage(name: string, number: string) {
  return [
    `Olá, ${firstName(name)}! 🎧`,
    '',
    'Seu cadastro no sorteio do SUNSET HOUSE foi confirmado!',
    '',
    `🍀 Seu número da sorte é: ${number}`,
    '',
    'Guarde esse número e fique de olho no sorteio.',
    '',
    'Boa sorte e curta a festa! 🌅',
    '',
    'SUNSET HOUSE',
    'Uma realização com Caos e Napiteira.',
  ].join('\n')
}

export function winnerMessage(name: string, number: string, prize: string) {
  return [
    `Olá, ${firstName(name)}! 🎉`,
    '',
    `Seu número ${number} foi sorteado no SUNSET HOUSE!`,
    `🏆 Prêmio: ${prize}`,
    '',
    'Venha retirar seu prêmio com a organização. Leve um documento com foto.',
    '',
    'SUNSET HOUSE 🌅',
    'Uma realização com Caos e Napiteira.',
  ].join('\n')
}

/** Abre uma conversa no WhatsApp com a mensagem preenchida (envio manual pelo admin) */
export function waLink(phoneE164: string, text: string) {
  return `https://wa.me/${phoneE164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}
