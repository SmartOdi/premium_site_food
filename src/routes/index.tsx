import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Flame,
  Menu as MenuIcon,
  X,
  Plus,
  Minus,
  ShoppingBag,
  Truck,
  Leaf,
  Star,
  Clock,
  MapPin,
  Phone,
  Instagram,
  Facebook,
  MessageCircle,
  ChevronUp,
  Loader2,
  AlertTriangle,
} from "lucide-react";

import heroBurger from "@/assets/hero-burger.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

// =====================================================================
// SOURCES DE DONNÉES — Google Sheets publiés en CSV
// ---------------------------------------------------------------------
// Comment publier un onglet Google Sheets en CSV :
//   1. Ouvrez votre Google Sheet
//   2. Fichier > Partager > Publier sur le web
//   3. Dans la boîte de dialogue, sélectionnez l'onglet à publier
//      (ex: "menu" puis relancez pour "config")
//   4. Format : "Valeurs séparées par des virgules (.csv)"
//   5. Cliquez sur "Publier" puis copiez le lien fourni
//   6. Collez ce lien dans la constante correspondante ci-dessous
// ---------------------------------------------------------------------
// ⚠️  Chaque onglet a son propre lien CSV. Ne pas confondre.
// =====================================================================

const CSV_MENU_URL = "COLLER_ICI_LIEN_CSV_MENU";
const CSV_CONFIG_URL = "COLLER_ICI_LIEN_CSV_CONFIG";

// === CONFIG WHATSAPP ===
const WHATSAPP_NUMBER = "2290143124349";
// 📍 LOCALISATION — remplacez la valeur ci-dessous par votre lien Google Maps.
const GOOGLE_MAPS_URL = "https://maps.google.com/";
const RESTAURANT_ADDRESS = "Carré 512, Cotonou, Bénin";

// Image par défaut si la cellule Image est vide ou invalide
const DEFAULT_PRODUCT_IMAGE = heroBurger;

// =====================================================================
// PARSEUR CSV robuste — gère les guillemets, virgules dans les champs,
// guillemets échappés (""), et les retours à la ligne standards.
// =====================================================================
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  // Dernière cellule / dernière ligne
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// Convertit tableau CSV en objets, en s'appuyant sur la première ligne d'en-tête
function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

// Interprète les valeurs "Disponible" : Oui/Non, TRUE/FALSE, 1/0, vide = disponible
function parseDisponible(v: string): boolean {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "" ) return true;
  if (["non", "no", "false", "0", "faux"].includes(s)) return false;
  return true; // oui, yes, true, 1, vrai, ...
}

// Parse le prix : accepte "2500", "2 500", "2,500", "2500 FCFA"...
function parsePrice(v: string): number {
  const cleaned = (v ?? "").replace(/[^\d]/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
}

// Valide grossièrement une URL d'image
function isValidImageUrl(v: string): boolean {
  if (!v) return false;
  const s = v.trim();
  return /^https?:\/\//i.test(s);
}

// Slugify pour créer des IDs stables à partir du Nom
function slugify(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type Product = {
  id: string;
  category: string;
  name: string;
  description: string;
  price: number;
  image: string;
  badge: string;
  available: boolean;
};

type Config = {
  nomRestaurant: string;
  accroche: string;
  logoUrl: string;
};

const DEFAULT_CONFIG: Config = {
  nomRestaurant: "RESTAU BJ",
  accroche: "Notre carte",
  logoUrl: "",
};

const formatFCFA = (n: number) =>
  `${n.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;

type CartItem = { id: string; qty: number };

function buildWhatsAppUrl(cart: CartItem[], products: Product[], restaurantName: string) {
  let text = `Bonjour ! Je souhaite passer une commande sur ${restaurantName} 🍔`;
  if (cart.length > 0) {
    text += `\n\n*Ma commande :*\n`;
    let total = 0;
    for (const it of cart) {
      const p = products.find((x) => x.id === it.id);
      if (!p) continue;
      const line = p.price * it.qty;
      total += line;
      text += `• ${it.qty}× ${p.name} — ${formatFCFA(line)}\n`;
    }
    text += `\n*Total : ${formatFCFA(total)}*`;
  }
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function Index() {
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCat, setActiveCat] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ===== Chargement des données CSV =====
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const isPlaceholder = (u: string) => !u || u.startsWith("COLLER_");

      if (isPlaceholder(CSV_MENU_URL) || isPlaceholder(CSV_CONFIG_URL)) {
        if (!cancelled) {
          setError(
            "Les liens CSV Google Sheets ne sont pas encore configurés. Ouvrez src/routes/index.tsx et remplacez CSV_MENU_URL et CSV_CONFIG_URL.",
          );
          setLoading(false);
        }
        return;
      }

      try {
        const [menuRes, configRes] = await Promise.all([
          fetch(CSV_MENU_URL),
          fetch(CSV_CONFIG_URL),
        ]);
        if (!menuRes.ok) throw new Error(`Chargement du menu impossible (HTTP ${menuRes.status})`);
        if (!configRes.ok) throw new Error(`Chargement de la config impossible (HTTP ${configRes.status})`);
        const [menuText, configText] = await Promise.all([menuRes.text(), configRes.text()]);

        // --- Parse menu ---
        const menuRows = csvToObjects(menuText);
        const parsedProducts: Product[] = menuRows
          .filter((r) => (r["Nom"] ?? "").trim() !== "")
          .map((r, idx) => {
            const name = r["Nom"] ?? "";
            const rawImg = (r["Image"] ?? "").trim();
            return {
              id: `${slugify(name)}-${idx}`,
              category: (r["Categorie"] ?? "Autres").trim() || "Autres",
              name,
              description: r["Description"] ?? "",
              price: parsePrice(r["Prix"] ?? ""),
              image: isValidImageUrl(rawImg) ? rawImg : DEFAULT_PRODUCT_IMAGE,
              badge: (r["Badge"] ?? "").trim(),
              available: parseDisponible(r["Disponible"] ?? ""),
            };
          });

        // --- Parse config (clé/valeur) ---
        const configRows = csvToObjects(configText);
        const cfg: Record<string, string> = {};
        for (const row of configRows) {
          const key = (row["Cle"] ?? row["Clé"] ?? "").trim();
          const val = (row["Valeur"] ?? "").trim();
          if (key) cfg[key] = val;
        }

        if (!cancelled) {
          setProducts(parsedProducts);
          setConfig({
            nomRestaurant: cfg["Nom_Restaurant"] || DEFAULT_CONFIG.nomRestaurant,
            accroche: cfg["Accroche"] || DEFAULT_CONFIG.accroche,
            logoUrl: cfg["Logo_URL"] || "",
          });
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur inconnue lors du chargement des données.");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Catégories dynamiques
  const categories = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; label: string }[] = [{ id: "all", label: "Tous" }];
    for (const p of products) {
      if (!seen.has(p.category)) {
        seen.add(p.category);
        list.push({ id: p.category, label: p.category });
      }
    }
    return list;
  }, [products]);

  const filtered = useMemo(
    () => (activeCat === "all" ? products : products.filter((p) => p.category === activeCat)),
    [activeCat, products],
  );

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => {
    const p = products.find((x) => x.id === i.id);
    return s + (p ? p.price * i.qty : 0);
  }, 0);

  const addToCart = (id: string) => {
    setCart((c) => {
      const found = c.find((i) => i.id === id);
      if (found) return c.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { id, qty: 1 }];
    });
  };
  const decFromCart = (id: string) => {
    setCart((c) =>
      c.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i)).filter((i) => i.qty > 0),
    );
  };
  const removeFromCart = (id: string) => setCart((c) => c.filter((i) => i.id !== id));

  const restaurantName = config.nomRestaurant;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <a href="#home" className="flex min-w-0 items-center gap-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl gradient-warm shadow-soft">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt={restaurantName} className="h-full w-full object-cover" />
              ) : (
                <Flame className="h-5 w-5 text-white" strokeWidth={2.5} />
              )}
            </span>
            <span className="truncate font-display text-xl font-extrabold tracking-tight">
              {restaurantName}
            </span>
          </a>

          <nav className="ml-auto hidden items-center gap-7 md:flex">
            {[
              { href: "#home", label: "Accueil" },
              { href: "#menu", label: "Menu" },
              { href: "#about", label: "À propos" },
              { href: "#contact", label: "Contact" },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-semibold text-foreground/80 transition-colors hover:text-primary"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <button
              onClick={() => setCartOpen(true)}
              aria-label="Ouvrir le panier"
              className="relative grid h-11 w-11 place-items-center rounded-full bg-secondary text-secondary-foreground transition-transform hover:scale-105"
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={2.4} />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-black text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </button>

            <a
              href={buildWhatsAppUrl(cart, products, restaurantName)}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-cta transition-transform hover:scale-[1.03] sm:inline-flex"
            >
              Commander
            </a>

            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Menu"
              className="grid h-11 w-11 place-items-center rounded-full bg-muted md:hidden"
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="border-t border-border bg-background md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col px-4 py-3">
              {[
                { href: "#home", label: "Accueil" },
                { href: "#menu", label: "Menu" },
                { href: "#about", label: "À propos" },
                { href: "#contact", label: "Contact" },
              ].map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-xl px-3 py-3 text-base font-semibold hover:bg-muted"
                >
                  {l.label}
                </a>
              ))}
              <a
                href={buildWhatsAppUrl(cart, products, restaurantName)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 rounded-full bg-primary px-5 py-3 text-center text-sm font-bold text-primary-foreground shadow-cta"
              >
                Commander sur WhatsApp
              </a>
            </nav>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="home" className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 gradient-hero opacity-95" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.25),transparent_50%)]" />

        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-24">
          <div className="text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur">
              <Flame className="h-3.5 w-3.5" /> Fast-food américain premium
            </span>
            <h1 className="mt-5 font-display text-4xl font-black leading-[1.05] sm:text-5xl md:text-6xl">
              Le meilleur fast-food<br />
              américain de la ville.
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/90 sm:text-lg">
              Burgers juteux, chicken croustillant, frites maison. Commandez en 2 clics,
              on s'occupe du reste. Livraison rapide à votre porte.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#menu"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-primary shadow-cta transition-transform hover:scale-[1.03]"
              >
                Voir le menu
              </a>
              <a
                href={buildWhatsAppUrl(cart, products, restaurantName)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[color:var(--whatsapp)] px-6 py-3.5 text-sm font-bold text-white shadow-cta transition-transform hover:scale-[1.03]"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2.5} />
                Commander sur WhatsApp
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/85">
              <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> Livraison en 30 min</div>
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[0,1,2,3,4].map(i => <Star key={i} className="h-4 w-4 fill-[color:var(--sun)] text-[color:var(--sun)]" />)}
                </div>
                4.9 / 5 (1200+ avis)
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-full bg-white/20 blur-3xl" />
            <img
              src={heroBurger}
              alt="Burger américain gourmand"
              width={1280}
              height={1280}
              className="mx-auto w-full max-w-md rotate-[-4deg] rounded-[2rem] shadow-2xl md:max-w-lg"
            />
            <span className="absolute -left-2 top-6 rotate-[-8deg] rounded-full bg-[color:var(--sun)] px-4 py-2 text-xs font-black text-[color:var(--ink)] shadow-card sm:-left-6 sm:text-sm">
              🔥 Best-seller
            </span>
            <span className="absolute -bottom-2 right-2 rotate-[6deg] rounded-full bg-white px-4 py-2 text-xs font-black text-primary shadow-card sm:-bottom-4 sm:right-6 sm:text-sm">
              Dès 2 500 FCFA
            </span>
          </div>
        </div>
      </section>

      {/* MENU / CATALOGUE */}
      <section id="menu" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--sun)]/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[color:var(--ink)]">
            {config.accroche}
          </span>
          <h2 className="mt-4 font-display text-3xl font-black sm:text-5xl">
            Trouve ton plat préféré
          </h2>
          <p className="mt-3 text-muted-foreground">
            Des recettes gourmandes, des produits frais, préparés à la commande.
          </p>
        </div>

        {/* ÉTATS : loading / error / vide */}
        {loading && (
          <div className="mt-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-semibold">Chargement du menu…</p>
          </div>
        )}

        {!loading && error && (
          <div className="mx-auto mt-12 flex max-w-xl flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-[color:var(--fire)]/40 bg-[color:var(--fire)]/5 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-[color:var(--fire)]" />
            <p className="font-bold text-[color:var(--fire)]">Impossible de charger le menu</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <p className="mt-12 text-center text-muted-foreground">Aucun plat pour le moment.</p>
        )}

        {/* Filtres */}
        {!loading && !error && products.length > 0 && (
          <div className="mt-8 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 sm:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((c) => {
              const active = c.id === activeCat;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`shrink-0 snap-start rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-cta"
                      : "bg-white text-foreground/80 shadow-soft hover:text-primary"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Grille produits */}
        {!loading && !error && products.length > 0 && (
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <article
                key={p.id}
                className={`group flex flex-col overflow-hidden rounded-3xl bg-card shadow-card transition-transform ${
                  p.available ? "hover:-translate-y-1" : "opacity-60 grayscale"
                }`}
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <img
                    src={p.image}
                    alt={p.name}
                    loading="lazy"
                    width={800}
                    height={800}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                    }}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {p.badge && p.available && (
                    <span className="absolute left-3 top-3 rounded-full bg-[color:var(--sun)] px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[color:var(--ink)] shadow-soft">
                      {p.badge}
                    </span>
                  )}
                  {!p.available && (
                    <span className="absolute left-3 top-3 rounded-full bg-neutral-800 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow-soft">
                      Indisponible
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-lg font-extrabold leading-tight">{p.name}</h3>
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="font-display text-lg font-black text-[color:var(--ink)]">
                      {formatFCFA(p.price)}
                    </span>
                    <button
                      onClick={() => addToCart(p.id)}
                      disabled={!p.available}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-cta transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                      {p.available ? "Ajouter" : "Indispo."}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* POURQUOI NOUS */}
      <section id="about" className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              Pourquoi nous choisir
            </span>
            <h2 className="mt-4 font-display text-3xl font-black sm:text-5xl">
              La qualité qu'on adore, la vitesse qu'on attend.
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Clock, title: "Rapidité", desc: "Commande prête en 15 min, livrée en 30." },
              { icon: Leaf, title: "Fraîcheur", desc: "Produits frais, jamais congelés, du marché à l'assiette." },
              { icon: Truck, title: "Livraison", desc: "À votre porte, 7j/7, dans toute la ville." },
              { icon: Flame, title: "Le vrai goût US", desc: "Recettes signature, sauces maison, pains briochés." },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-3xl bg-background p-6 text-center shadow-soft"
              >
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-warm shadow-soft">
                  <f.icon className="h-6 w-6 text-white" strokeWidth={2.4} />
                </div>
                <h3 className="mt-4 font-display text-lg font-extrabold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AVIS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--sun)]/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider">
            Ils nous adorent
          </span>
          <h2 className="mt-4 font-display text-3xl font-black sm:text-5xl">
            1200+ clients conquis
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { name: "Aïcha B.", text: "Le double bacon est une tuerie ! Livraison rapide, tout était chaud.", city: "Cotonou" },
            { name: "Ismaël K.", text: "Meilleurs wings de la ville, sans hésiter. Commande sur WhatsApp super simple.", city: "Porto-Novo" },
            { name: "Fatou D.", text: "Le milkshake choco… je suis fan. Prix corrects et service au top.", city: "Cotonou" },
          ].map((r) => (
            <div key={r.name} className="rounded-3xl bg-card p-6 shadow-card">
              <div className="flex gap-0.5 text-[color:var(--sun)]">
                {[0,1,2,3,4].map(i => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="mt-4 text-sm text-foreground/85">"{r.text}"</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full gradient-warm font-black text-white">
                  {r.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.city}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] gradient-hero p-8 text-center text-white sm:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
          <div className="relative">
            <h2 className="font-display text-3xl font-black sm:text-5xl">
              Une petite faim ? On s'en occupe.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/90">
              Commandez directement sur WhatsApp, on vous répond en quelques minutes.
            </p>
            <a
              href={buildWhatsAppUrl(cart, products, restaurantName)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-primary shadow-cta transition-transform hover:scale-[1.03]"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2.5} />
              Commander maintenant
            </a>
          </div>
        </div>
      </section>

      {/* LOCALISATION */}
      <section id="localisation" className="bg-[color:var(--soft)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--fire)]/10 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-[color:var(--fire)]">
              <MapPin className="h-3.5 w-3.5" strokeWidth={2.5} /> Nous trouver
            </span>
            <h2 className="mt-4 font-display text-3xl font-black uppercase tracking-tight text-neutral-900 sm:text-4xl">
              Venez déguster sur place
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-neutral-600 sm:text-base">
              Retrouvez {restaurantName} à {RESTAURANT_ADDRESS}. Cliquez sur la carte pour l'itinéraire.
            </p>
          </div>

          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 block overflow-hidden rounded-3xl border-4 border-[color:var(--sun)] shadow-cta transition-transform hover:scale-[1.01]"
          >
            <iframe
              title={`Localisation ${restaurantName}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(RESTAURANT_ADDRESS)}&output=embed`}
              className="pointer-events-none h-[320px] w-full sm:h-[420px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </a>

          <div className="mt-6 flex justify-center">
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--fire)] px-6 py-3.5 text-sm font-bold text-white shadow-cta transition-transform hover:scale-[1.03]"
            >
              <MapPin className="h-4 w-4" strokeWidth={2.5} />
              Ouvrir dans Google Maps
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" className="gradient-footer text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-white/15 backdrop-blur">
                {config.logoUrl ? (
                  <img src={config.logoUrl} alt={restaurantName} className="h-full w-full object-cover" />
                ) : (
                  <Flame className="h-5 w-5" strokeWidth={2.5} />
                )}
              </span>
              <span className="font-display text-xl font-extrabold">{restaurantName}</span>
            </div>
            <p className="mt-4 text-sm text-white/85">
              Le vrai goût du fast-food américain, préparé avec amour et livré chaud chez vous.
            </p>
            <div className="mt-5 flex gap-2">
              {[Instagram, Facebook, MessageCircle].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="Réseau social"
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-display text-sm font-black uppercase tracking-wider text-[color:var(--sun)]">Contact</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-white/90">
              <li className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0" /> +229 01 43 12 43 49</li>
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {RESTAURANT_ADDRESS}</li>
              <li className="flex items-start gap-2"><MessageCircle className="mt-0.5 h-4 w-4 shrink-0" /> WhatsApp direct</li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-black uppercase tracking-wider text-[color:var(--sun)]">Horaires</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-white/90">
              <li className="flex justify-between gap-4"><span>Lun — Jeu</span><span>11h — 23h</span></li>
              <li className="flex justify-between gap-4"><span>Ven — Sam</span><span>11h — 01h</span></li>
              <li className="flex justify-between gap-4"><span>Dimanche</span><span>15h — 23h</span></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-black uppercase tracking-wider text-[color:var(--sun)]">Commander</h4>
            <p className="mt-4 text-sm text-white/85">
              Passez commande en 30 secondes depuis WhatsApp, on vous rappelle pour confirmer.
            </p>
            <a
              href={buildWhatsAppUrl(cart, products, restaurantName)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[color:var(--whatsapp)] px-5 py-2.5 text-sm font-bold text-white shadow-cta"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2.5} />
              Commander maintenant
            </a>
          </div>
        </div>
        <div className="border-t border-white/15">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-5 text-xs text-white/70 sm:flex-row sm:justify-between sm:px-6">
            <span>© {new Date().getFullYear()} {restaurantName}. Tous droits réservés.</span>
            <span>Prix en FCFA · TVA incluse</span>
          </div>
        </div>
      </footer>

      {/* BARRE COMMANDER — apparaît quand le panier n'est pas vide */}
      {cartCount > 0 && (
        <a
          href={buildWhatsAppUrl(cart, products, restaurantName)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Commander maintenant sur WhatsApp"
          className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 bg-[color:var(--whatsapp)] px-4 py-4 text-center text-sm font-bold text-white shadow-cta transition-transform hover:brightness-110 sm:text-base"
        >
          <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.4} />
          <span>Commander maintenant</span>
          <span className="ml-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black sm:text-sm">
            {cartCount} · {formatFCFA(cartTotal)}
          </span>
        </a>
      )}

      {/* Retour haut de page */}
      <a
        href="#home"
        aria-label="Retour en haut"
        className={`fixed right-5 z-40 grid h-11 w-11 place-items-center rounded-full bg-white text-primary shadow-soft transition-transform hover:scale-110 ${
          cartCount > 0 ? "bottom-24 sm:bottom-28" : "bottom-5"
        }`}
      >
        <ChevronUp className="h-5 w-5" strokeWidth={2.6} />
      </a>

      {/* PANIER — DRAWER */}
      {cartOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            aria-label="Fermer le panier"
            onClick={() => setCartOpen(false)}
            className="absolute inset-0 bg-[color:var(--ink)]/50 backdrop-blur-sm"
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="font-display text-xl font-extrabold">Votre panier</h3>
              <button
                onClick={() => setCartOpen(false)}
                aria-label="Fermer"
                className="grid h-10 w-10 place-items-center rounded-full bg-muted hover:bg-border"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted">
                    <ShoppingBag className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="mt-4 font-bold">Votre panier est vide</p>
                  <p className="mt-1 text-sm text-muted-foreground">Ajoutez des plats pour commander.</p>
                  <button
                    onClick={() => setCartOpen(false)}
                    className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-cta"
                  >
                    Voir le menu
                  </button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {cart.map((it) => {
                    const p = products.find((x) => x.id === it.id);
                    if (!p) return null;
                    return (
                      <li key={it.id} className="flex gap-3 rounded-2xl bg-card p-3 shadow-soft">
                        <img
                          src={p.image}
                          alt=""
                          className="h-20 w-20 shrink-0 rounded-xl object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                          }}
                        />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <span className="truncate font-bold">{p.name}</span>
                            <button
                              onClick={() => removeFromCart(it.id)}
                              aria-label="Retirer"
                              className="text-muted-foreground hover:text-primary"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-primary">
                            {formatFCFA(p.price * it.qty)}
                          </span>
                          <div className="mt-auto flex items-center gap-2">
                            <button
                              onClick={() => decFromCart(it.id)}
                              className="grid h-8 w-8 place-items-center rounded-full bg-muted hover:bg-border"
                              aria-label="Diminuer"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-6 text-center font-bold">{it.qty}</span>
                            <button
                              onClick={() => addToCart(it.id)}
                              className="grid h-8 w-8 place-items-center rounded-full bg-secondary hover:brightness-95"
                              aria-label="Augmenter"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-border bg-white p-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="font-display text-2xl font-black text-[color:var(--ink)]">
                    {formatFCFA(cartTotal)}
                  </span>
                </div>
                <a
                  href={buildWhatsAppUrl(cart, products, restaurantName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--whatsapp)] px-5 py-3.5 text-sm font-bold text-white shadow-cta transition-transform hover:scale-[1.02]"
                >
                  <MessageCircle className="h-4 w-4" strokeWidth={2.5} />
                  Envoyer la commande sur WhatsApp
                </a>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Vous serez redirigé vers WhatsApp avec votre commande pré-remplie.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
