import React, { useState, useEffect, useRef, useCallback } from "react";
import { getAllMenuItems } from "@/services/menuItemService";
import { getAllCategories } from "@/services/categoryService";
import { MenuItem, Category, POPULAR_CATEGORY_ID } from "@/types/menu";
import RestaurantHeader from "@/components/RestaurantHeader";
import CategoryNav from "@/components/CategoryNav";
import MenuSection from "@/components/MenuSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X, MessageCircle, ClipboardList, LogOut, LogIn } from "lucide-react";
import ChatAssistant from "@/components/ChatAssistant";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { trackViewItemList, trackMenuVisit } from "@/utils/trackingEvents";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import { useActiveOrdersCount } from "@/hooks/useActiveOrdersCount";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import StoreClosedBanner from "@/components/StoreClosedBanner";

const Index = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { currentUser, logOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useLayoutSettings();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const activeOrdersCount = useActiveOrdersCount();
  const itemRefs = useRef<Record<string, { triggerClick: () => void } | null>>({});
  const deepLinkHandled = useRef(false);
  const menuVisitTracked = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      const [items, cats] = await Promise.all([getAllMenuItems(), getAllCategories()]);
      // Show available items AND items with zero stock (faded out)
      setMenuItems(items.filter(item => item.available !== false || (item.stock !== null && item.stock <= 0)));
      setCategories([{ id: "all", name: "Todos", order: -1 }, ...cats.filter(c => c.visible !== false)]);
    };
    loadData();
    if (!menuVisitTracked.current) {
      menuVisitTracked.current = true;
      trackMenuVisit();
    }
  }, []);

  // Verificação de retorno do Stripe
  useEffect(() => {
    const stripeStatus = searchParams.get("stripe");
    const sessionId = searchParams.get("session_id");
    const orderId = searchParams.get("order");
    if (!stripeStatus) return;

    if (stripeStatus === "success" && sessionId) {
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke("verificar-stripe-pagamento", {
            body: { sessionId, orderId },
          });
          if (error) throw error;
          if (data?.paid) {
            toast({ title: "Pagamento confirmado!", description: "Seu pedido foi pago com sucesso." });
          } else {
            toast({
              title: "Pagamento pendente",
              description: `Status: ${data?.payment_status || "desconhecido"}`,
            });
          }
        } catch (e: any) {
          toast({
            title: "Erro ao verificar pagamento",
            description: e.message || "Tente novamente.",
            variant: "destructive",
          });
        } finally {
          searchParams.delete("stripe");
          searchParams.delete("session_id");
          searchParams.delete("order");
          setSearchParams(searchParams, { replace: true });
        }
      })();
    } else if (stripeStatus === "cancel") {
      toast({ title: "Pagamento cancelado", description: "Você cancelou o pagamento.", variant: "destructive" });
      searchParams.delete("stripe");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleDeepLink = useCallback(() => {
    if (deepLinkHandled.current) return;
    const itemId = searchParams.get("item");
    if (!itemId || menuItems.length === 0) return;
    const matchedItem = menuItems.find(i => i.id === itemId);
    if (!matchedItem) return;

    let attempts = 0;
    const tryOpen = () => {
      const el = document.querySelector(`[data-product-id="${itemId}"]`);
      const handle = itemRefs.current[itemId];
      if (el && handle) {
        deepLinkHandled.current = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          handle.triggerClick();
          searchParams.delete("item");
          setSearchParams(searchParams, { replace: true });
        }, 600);
      } else if (attempts++ < 50) setTimeout(tryOpen, 100);
    };
    tryOpen();
  }, [menuItems, searchParams, setSearchParams]);

  useEffect(() => { handleDeepLink(); }, [handleDeepLink]);

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = searchTerm === "" || item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === "all" ? true : activeCategory === POPULAR_CATEGORY_ID ? item.popular : (item.category === activeCategory || (item.additionalCategories || []).includes(activeCategory));
    return matchesSearch && matchesCategory;
  }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const groupedItems = categories.reduce((acc, category) => {
    if (category.id === "all") return acc;
    const items = filteredItems.filter(item => category.id === POPULAR_CATEGORY_ID ? item.popular : (item.category === category.id || (item.additionalCategories || []).includes(category.id))).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (items.length > 0) acc.push({ category, items });
    return acc;
  }, [] as Array<{ category: Category; items: MenuItem[] }>);

  return (
    <div style={{ backgroundColor: settings.cor_background, color: settings.cor_fonte, minHeight: '100vh' }}>
      
      {/* HEADER COM SOBREPOSIÇÃO NO BANNER */}
      <div className="-mt-12 md:mt-0 relative z-20">
        <RestaurantHeader
          actions={
            <div className="flex flex-col gap-2">
              {currentUser && (
                <span
                  className="text-xs text-center sm:text-left"
                  style={{ color: settings.cor_fonte, opacity: 0.85 }}
                >
                  <b>Logado como:</b> {currentUser.email}
                </span>
              )}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsChatOpen(true)}
                  className="w-full px-1 text-[11px] md:text-sm h-9 flex items-center justify-center gap-1"
                  style={{ backgroundColor: settings.cor_botoes, color: settings.cor_fonte_botoes }}
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Fale Conosco
                </Button>
                <div className="relative">
                  <Button
                    variant="outline"
                    onClick={() => (currentUser ? navigate("/meus-pedidos") : navigate("/login"))}
                    className="w-full px-1 text-[11px] md:text-sm h-9 flex items-center justify-center gap-1"
                    style={{ backgroundColor: settings.cor_botoes, color: settings.cor_fonte_botoes }}
                  >
                    <ClipboardList className="h-3.5 w-3.5" /> Meus Pedidos
                  </Button>
                  {currentUser && activeOrdersCount > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md ring-2 ring-white">
                      {activeOrdersCount}
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={currentUser ? () => logOut() : () => navigate("/login")}
                  className="w-full px-1 text-[11px] md:text-sm h-9 flex items-center justify-center gap-1"
                  style={{ backgroundColor: settings.cor_botoes, color: settings.cor_fonte_botoes }}
                >
                  {currentUser ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
                  {currentUser ? "Sair" : "Entrar"}
                </Button>
              </div>
            </div>
          }
        />
      </div>

      {/* Banners extras (2:1) */}
      {(settings.empresa_banner_extra1_url || settings.empresa_banner_extra2_url) && (
        <div className="container mx-auto px-4 mt-3">
          <div className="grid grid-cols-2 gap-3">
            {[settings.empresa_banner_extra1_url, settings.empresa_banner_extra2_url].map((url, i) => (
              <div
                key={i}
                className="w-full overflow-hidden rounded-lg bg-muted"
                style={{ aspectRatio: "2 / 1" }}
              >
                {url ? (
                  <img src={url} alt={`Banner ${i + 1}`} className="w-full h-full object-cover" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 mt-2">
        <div className="max-w-3xl mx-auto">
          <StoreClosedBanner />
        </div>
      </div>



      {/* Busca - aparece antes da nav no mobile, depois no desktop */}
      {/* ALTERADO: Adicionado mb-8 para afastar a busca mobile da CategoryNav com simetria */}
      <div className="order-1 md:order-3 px-4 z-10 mt-4 flex md:hidden mb-4">
        <div className="relative w-full max-w-4xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/60" />
          <Input
            type="text"
            placeholder="Busque por pizza ou ingredientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 h-12 text-sm border-2 border-muted bg-card shadow-md rounded-xl focus-visible:ring-primary"
          />
          {searchTerm && <X onClick={() => setSearchTerm("")} className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground cursor-pointer" />}
        </div>
      </div>

      {/* CategoryNav - filha direta para sticky funcionar contra o container alto */}
      <CategoryNav 
        categories={categories} 
        activeCategory={activeCategory}
        onSelectCategory={(id) => setActiveCategory(id)}
      />

      {/* Busca no desktop - abaixo da nav */}
      <div className="px-4 z-10 mt-6 mb-6 hidden md:block">
        <div className="relative w-full max-w-4xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/60" />
          <Input
            type="text"
            placeholder="Busque por pizza ou ingredientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 h-12 text-sm border-2 border-muted bg-card shadow-md rounded-xl focus-visible:ring-primary"
          />
          {searchTerm && <X onClick={() => setSearchTerm("")} className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground cursor-pointer" />}
        </div>
      </div>


      {/* ALTERADO: Ajustado o padding-top de pt-0 para pt-4 no container mobile para harmonizar com a margem inferior da busca */}
      <div className="container mx-auto px-4 pt-4 pb-8 md:pt-8">
        {activeCategory === "all" ? (
          groupedItems.map(({ category, items }) => (
            <MenuSection key={category.id} title={category.name} categoryId={category.id} category={category} items={items} itemRefs={itemRefs} />
          ))
        ) : (
          (() => {
            const cat = categories.find(c => c.id === activeCategory);
            return (
              <MenuSection
                title={cat?.name || "Menu"}
                categoryId={cat?.id}
                category={cat}
                items={filteredItems}
                itemRefs={itemRefs}
              />
            );
          })()
        )}
      </div>
      <ChatAssistant isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
};

export default Index;
