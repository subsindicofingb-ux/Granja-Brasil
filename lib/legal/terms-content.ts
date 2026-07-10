export interface LegalDocument {
  title: string;
  paragraphs: string[];
}

export const TERMS_OF_USE: LegalDocument = {
  title: "Termo de Uso",
  paragraphs: [
    "TERMOS DE USO DO APLICATIVO",
    "Seja bem-vindo ao nosso aplicativo de gestão condominial. Ao se cadastrar, você concorda com as regras de uso descritas abaixo.",
    "1. Cadastro e Uso da Conta",
    "O cadastro é pessoal, intransferível e restrito a moradores, proprietários ou pessoas autorizadas pelo condomínio.",
    "Você é o único responsável por manter o sigilo da sua senha e pelas atividades realizadas em sua conta.",
    "Os dados fornecidos (nome, e-mail, telefone e foto) devem ser verdadeiros e atualizados.",
    "2. Regras de Conduta e Proibições",
    "É expressamente proibido utilizar o aplicativo para:",
    "Publicar conteúdos ofensivos, difamatórios, preconceituosos ou que gerem conflitos entre moradores.",
    "Expor dados, fotos ou informações privadas de outros moradores sem autorização prévia.",
    "Anunciar produtos, serviços ou eventos que violem as normas do regimento interno do condomínio.",
    "3. Limitação de Responsabilidade",
    "O aplicativo é uma ferramenta de facilitação de comunicação e gestão, não se responsabilizando por conflitos pessoais entre moradores.",
    "Não nos responsabilizamos por instabilidades temporárias de internet ou falhas de sinal dos dispositivos dos usuários.",
    "O mau uso do aplicativo pode resultar na suspensão temporária ou bloqueio definitivo da conta do usuário, por decisão da administração do condomínio.",
    "4. Alterações nos Termos",
    "Estes termos podem ser atualizados para melhorias técnicas ou jurídicas. Quando isso ocorrer, você receberá um aviso no aplicativo para ler e aceitar a nova versão.",
  ],
};

export const PRIVACY_POLICY: LegalDocument = {
  title: "Termo de Privacidade",
  paragraphs: [
    "POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS",
    "Este aplicativo coleta e trata seus dados pessoais para garantir a sua segurança, a comunicação e o controle de acesso ao condomínio.",
    "1. Dados Coletados e Finalidade",
    "Nome completo: Para identificação do morador ou visitante no sistema.",
    "E-mail e Telefone: Para envio de avisos importantes, notificações de encomendas, boletos e validação de segurança da conta.",
    "Foto do perfil: Para identificação visual na portaria eletrônica ou física, aumentando a segurança do condomínio.",
    "2. Compartilhamento de Dados",
    "Seus dados são confidenciais e de uso exclusivo para a gestão do condomínio. Nós não vendemos, alugamos ou compartilhamos seus dados com terceiros para fins comerciais ou publicitários.",
    "3. Armazenamento e Segurança",
    "Os dados e fotos coletados são armazenados em servidores criptografados e seguros. Eles permanecerão guardados apenas pelo período em que você possuir vínculo ativo com o condomínio ou até que solicite a exclusão.",
    "4. Seus Direitos (LGPD)",
    "Você tem o direito de, a qualquer momento, consultar quais dados temos armazenados, corrigir informações desatualizadas ou revogar este consentimento, ciente de que a exclusão de certos dados (como a foto) poderá limitar o seu acesso a áreas ou funções de segurança do aplicativo.",
  ],
};
