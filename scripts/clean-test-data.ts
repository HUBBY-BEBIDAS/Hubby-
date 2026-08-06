import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('🚀 Iniciando a limpeza segura dos dados de teste (Distribuidoras e Bares/Clientes)...');

  // 1. Deletar dependências de pedidos e cotações
  console.log('🧹 Limpando feedback de pagamentos, pedidos e cotações...');
  await prisma.paymentFeedback.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.quotationItem.deleteMany({});
  await prisma.quotation.deleteMany({});

  // 2. Limpar carrinhos, listas de desejos e alertas
  console.log('🧹 Limpando itens de carrinho, lista de desejos e alertas de preço...');
  await prisma.cartItem.deleteMany({});
  await prisma.wishlistItem.deleteMany({});
  await prisma.priceAlert.deleteMany({});
  await prisma.priceHistory.deleteMany({});

  // 3. Limpar avaliações, favoritos, credenciais e pesquisas
  console.log('🧹 Limpando credenciais, avaliações, favoritos e pesquisas de onboarding...');
  await prisma.review.deleteMany({});
  await prisma.favoriteDistributor.deleteMany({});
  await prisma.clientCredential.deleteMany({});
  await prisma.clientDeliveryAddress.deleteMany({});
  await prisma.onboardingSurvey.deleteMany({});
  await prisma.monthlyReport.deleteMany({});
  await prisma.referral.deleteMany({});

  // 4. Limpar ofertas de distribuidoras, promoções e anúncios
  console.log('🧹 Limpando promoções, ofertas de vencimento e slots patrocinados...');
  await prisma.nearExpiryOffer.deleteMany({});
  await prisma.promotion.deleteMany({});
  await prisma.sponsoredSlot.deleteMany({});
  await prisma.deliveryRegion.deleteMany({});

  // 5. Limpar chats, webhooks e importações pendentes
  console.log('🧹 Limpando mensagens de chat, webhooks e sugestões de importação...');
  await prisma.chatMessage.deleteMany({});
  await prisma.chatRoom.deleteMany({});
  await prisma.webhookLog.deleteMany({});
  await prisma.unmatchedSuggestion.deleteMany({});
  await prisma.unmatchedImportItem.deleteMany({});
  await prisma.matchingHistory.deleteMany({});

  // 6. Limpar produtos das distribuidoras (mantendo o MasterProduct/Catálogo Global intacto!)
  console.log('🧹 Limpando catálogo cadastrado pelas distribuidoras de teste...');
  await prisma.product.deleteMany({});

  // 7. Limpar membros de equipes
  console.log('🧹 Limpando membros das equipes de clientes e distribuidoras...');
  await prisma.clientMember.deleteMany({});
  await prisma.distributorTeamMember.deleteMany({});

  // 8. Deletar Clientes e Distribuidoras
  console.log('🧹 Deletando registros de Clientes e Distribuidoras...');
  await prisma.client.deleteMany({});
  await prisma.distributor.deleteMany({});

  // 9. Deletar notificações de usuários não-admin
  const nonAdminUsers = await prisma.user.findMany({
    where: { role: { not: 'platform_admin' } },
    select: { id: true }
  });
  const nonAdminIds = nonAdminUsers.map(u => u.id);

  if (nonAdminIds.length > 0) {
    await prisma.notification.deleteMany({
      where: { user_id: { in: nonAdminIds } }
    });
  }

  // 10. Deletar usuários não-admin (mantendo platform_admin intacto)
  console.log('🧹 Deletando contas de usuários de teste (preservando Administradores da Plataforma)...');
  const deletedUsers = await prisma.user.deleteMany({
    where: { role: { not: 'platform_admin' } }
  });

  console.log('\n✅ LIMPEZA CONCLUÍDA COM SUCESSO!');
  console.log(`- Usuários de teste removidos: ${deletedUsers.count}`);
  console.log('- Usuários Administradores preservados.');
  console.log('- Catálogo Master de Produtos e Imagens mantido 100% intacto!');
  console.log('- O sistema está pronto para cadastrar as distribuidoras e bares reais!');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante a limpeza:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
