import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/brand'
import { backend } from '../../lib/backend'

// ⚠️ Revise os campos entre [colchetes] antes de publicar.
const CONTATO = '[e-mail de contato da organização]'
const CONTROLADOR = '[nome/razão social do organizador do Sunset House]'

export default function Legal({ page }: { page: 'regulamento' | 'privacidade' }) {
  const [rules, setRules] = useState<string | null>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    backend.getPublicConfig().then((c) => setRules(c.rules_text)).catch(() => {})
  }, [page])

  return (
    <div className="min-h-dvh bg-sun px-5 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <Link to="/" className="btn btn-sm btn-paper"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          <Logo className="w-28" />
        </div>
        <article className="sticker mt-6 space-y-4 p-6 text-[15px] leading-relaxed sm:p-8 [&_h2]:display [&_h2]:pt-2 [&_h2]:text-xl [&_h1]:display [&_h1]:text-[34px]">
          {page === 'regulamento' ? (
            <>
              <h1>Regulamento</h1>
              <p>Sorteio promocional gratuito realizado durante o evento <b>Sunset House</b>, em 15/11/2026, com patrocínio de Caos e Napiteira.</p>
              <h2>Participação</h2>
              {rules && <p className="whitespace-pre-line">{rules}</p>}
              <p>O cadastro é gratuito e não exige compra. Cada participante recebe um número sequencial de quatro dígitos, a partir de 0001.</p>
              <h2>Sorteio</h2>
              <p>O vencedor é escolhido de forma aleatória, por gerador criptograficamente seguro executado no servidor, entre todos os números válidos. Uma mesma pessoa não ganha mais de um prêmio. Cada sorteio fica registrado com data, horário e responsável.</p>
              <p>Prêmios: 1º — 2 chaveiros · 2º — copo de whisky + 1 chaveiro · 3º — Kit Napiteira · 4º — Case Napiteira.</p>
              <h2>Retirada</h2>
              <p>O ganhador deve estar presente no evento e apresentar documento com foto. Se o ganhador não for localizado, a organização pode realizar novo sorteio para o mesmo prêmio.</p>
              <h2>Dúvidas</h2>
              <p>Fale com a organização: {CONTATO}.</p>
            </>
          ) : (
            <>
              <h1>Política de privacidade</h1>
              <p>Em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).</p>
              <h2>Quem trata seus dados</h2>
              <p>{CONTROLADOR}, organizador do Sunset House. Contato: {CONTATO}.</p>
              <h2>Quais dados</h2>
              <p>Nome completo, celular, e-mail, data e hora do cadastro e registro técnico mínimo para segurança (um código não reversível derivado do endereço IP e o navegador utilizado).</p>
              <h2>Para quê</h2>
              <p>Exclusivamente para operar este sorteio: gerar seu número da sorte, impedir cadastros duplicados, identificar e contatar o vencedor. Seus dados não serão vendidos, cedidos ou usados para outras finalidades.</p>
              <h2>WhatsApp</h2>
              <p>O envio do número da sorte pelo WhatsApp depende de consentimento específico e opcional, que você pode dar no formulário ou no botão “Receber pelo WhatsApp”. A mensagem é enviada pela plataforma oficial do WhatsApp Business (Meta).</p>
              <h2>Base legal e prazo</h2>
              <p>Consentimento (art. 7º, I, LGPD). Os dados serão mantidos até 90 dias após o evento e então excluídos, salvo obrigação legal.</p>
              <h2>Seus direitos</h2>
              <p>Você pode pedir acesso, correção, exclusão dos dados ou revogar o consentimento a qualquer momento pelo contato {CONTATO}. A exclusão do cadastro retira o número do sorteio.</p>
              <h2>Segurança</h2>
              <p>Os dados ficam em banco de dados com acesso restrito a administradores autenticados, com criptografia em trânsito e registro de auditoria.</p>
            </>
          )}
        </article>
      </div>
    </div>
  )
}
