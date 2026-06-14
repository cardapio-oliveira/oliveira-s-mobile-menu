## ClickCommerce

**Versão 1.1.2**  

**URL**: https://crave-cardapio-display.lovable.app

##Criado por ClickPrato##  

**Alteração:**  
- Instalado Gateway de Pagamento STRIPE
- Instalado API de Frete SuperFrete

Adicionado o card Gateway de Pagamento — Stripe em /configuracoes com toggle de habilitação, seletor de ambiente (Teste/Produção), Publishable Key, Secret Key e Webhook Signing Secret. As credenciais são salvas na tabela configuracoes.

Edge functions criadas: criar-stripe-checkout (cria sessão usando a Secret Key salva em Configurações) e verificar-stripe-pagamento (confirma o pagamento e marca o pedido como recebido).

Checkout: quando "Habilitar Stripe" está ativo em Configurações, aparece a opção "Cartão online (Stripe)". Ao finalizar, o pedido é criado e o cliente é redirecionado para o Stripe Checkout.

Retorno: ao voltar para / com sucesso, o app chama verificar-stripe-pagamento automaticamente e mostra a confirmação.

**Números de cartão em ambiente de teste para testar gateway de pagamento:**  

**Cartão de Crédito Comum (Sucesso) - Usar número 4242 4242 4242 4242 - Simula uma compra aprovada direto no crédito** 
**Débito com Autenticação (3DS) - Usar número 4000 0000 0000 3220 - Abre aquela janelinha pop-up simulando o banco do cliente aprovando o débito.**  
**artão sem Fundos (Recusado) - Usar número 4000 0000 0000 0002 - Simula um erro de "saldo insuficiente" para testar a mensagem de erro**