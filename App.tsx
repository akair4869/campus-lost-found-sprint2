import { useState, useEffect, FormEvent } from "react";
import {
  Search,
  MapPin,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Check,
  Package,
  BookOpen,
  Headphones,
  KeyRound,
  Shirt,
  Backpack,
  SlidersHorizontal,
  CalendarDays,
  LoaderCircle,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  Upload,
  Info,
  Bell,
  LogOut,
  Pencil,
  Archive,
  Flag,
  EyeOff,
  PackageCheck,
} from "lucide-react";
import { categories, buildings, points, validateItem, displayStatus } from "./domain";
import {
  api,
  User,
  Report,
  Claim,
  Dashboard,
  Catalog,
  today,
  readPhoto,
} from "./api";
import {
  LanguageContext,
  Language,
  useLanguage,
  setExtraLabels,
} from "./i18n";
import { AdminPanel } from "./admin";
import {
  Modal,
  Auth,
  ErrorMessage,
  ClaimForm,
  MySpace,
  StaffPanel,
} from "./workflow";
const iconFor = (c: string) =>
  c === "Electronics"
    ? Headphones
    : c === "Books & stationery"
      ? BookOpen
      : c === "Keys & cards"
        ? KeyRound
        : c === "Clothing"
          ? Shirt
          : c === "Bags & accessories"
            ? Backpack
            : Package;
export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    try {
      return localStorage.getItem("campus-language") === "ar" ? "ar" : "en";
    } catch {
      return "en";
    }
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem("campus-language", lang);
    } catch {}
  }, [lang]);
  return (
    <LanguageContext.Provider value={lang}>
      <Home changeLanguage={() => setLang((l) => (l === "en" ? "ar" : "en"))} />
    </LanguageContext.Provider>
  );
}
function Home({ changeLanguage }: { changeLanguage: () => void }) {
  const { t, label, lang } = useLanguage();
  const [user, setUser] = useState<User | null>(null),
    [demo, setDemo] = useState(false),
    [sessionReady, setSessionReady] = useState(false),
    [auth, setAuth] = useState(false);
  const [view, setView] = useState("board"),
    [type, setType] = useState(""),
    [q, setQ] = useState(""),
    [building, setBuilding] = useState(""),
    [category, setCategory] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [page, setPage] = useState(1);
  const [rows, setRows] = useState<Report[]>([]),
    [total, setTotal] = useState(0),
    [stats, setStats] = useState<Record<string, number>>({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [privateError, setPrivateError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [toast, setToast] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [claims, setClaims] = useState<Claim[]>([]),
    [report, setReport] = useState<"lost" | "found" | null>(null),
    [detail, setDetail] = useState<Report | null>(null),
    [claiming, setClaiming] = useState(false),
    [point, setPoint] = useState("library"),
    [formError, setFormError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(""),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [editing, setEditing] = useState<Report | null>(null),
    [removePhoto, setRemovePhoto] = useState(false),
    [action, setAction] = useState<"" | "withdraw" | "flag" | "handover">(
      "",
    );
  const reload = () => setRefresh((v) => v + 1);
  useEffect(() => {
    let live = true;
    api("/api/session")
      .then((r) => {
        if (live) {
          setUser(r.user);
          setDemo(r.demo);
        }
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setSessionReady(true));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    setPage(1);
  }, [type, q, building, category, from, to, view]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          type: view === "desk" ? "found" : type,
          q,
          building,
          category,
          from,
          to,
          page: String(page),
        });
        const r = await api(
          "/api/items?" + params,
          undefined,
          controller.signal,
        );
        setRows(r.items);
        setTotal(r.total);
        setStats(r.stats);
        setError("");
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [type, q, building, category, from, to, page, view, refresh, user?.id]);
  useEffect(() => {
    const c = new AbortController();
    if (!user) return;
    Promise.all([
      api<Dashboard>("/api/dashboard", undefined, c.signal),
      user.role === "staff"
        ? api<{ claims: Claim[] }>("/api/claims", undefined, c.signal)
        : Promise.resolve({ claims: [] }),
    ])
      .then(([d, s]) => {
        setDashboard(d);
        setClaims(s.claims);
        setPrivateError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setPrivateError(e.message);
      });
    return () => c.abort();
  }, [user?.id, refresh]);
  useEffect(() => {
    const c = new AbortController();
    api<Catalog>("/api/catalog", undefined, c.signal)
      .then((r) => {
        setExtraLabels([...r.categories, ...r.buildings]);
        setCatalog(r);
      })
      .catch(() => {});
    return () => c.abort();
  }, [user?.id, refresh]);
  const activeNames = (k: "categories" | "buildings", keep?: string) => {
    const names = catalog
      ? catalog[k].filter((e) => e.active).map((e) => e.name)
      : k === "categories"
        ? categories
        : buildings;
    return keep && !names.includes(keep) ? [...names, keep] : names;
  };
  const categoryClass = (c: string) => {
    const all = catalog ? catalog.categories.map((e) => e.name) : categories;
    const i = all.indexOf(c);
    return "category-" + (i < 0 ? 5 : i % 6);
  };
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) reload();
    }, 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 6000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function clear() {
    setQ("");
    setBuilding("");
    setCategory("");
    setFrom("");
    setTo("");
    setType("");
    setPage(1);
  }
  function openReport(v: "lost" | "found") {
    if (!user) {
      setAuth(true);
      return;
    }
    setEditing(null);
    setReport(v);
    setPoint("library");
    setPreview("");
    setRemovePhoto(false);
    setFormError("");
  }
  function openEdit(i: Report) {
    setDetail(null);
    setEditing(i);
    setReport(i.type);
    setPoint(i.point || "library");
    setPreview("");
    setRemovePhoto(false);
    setFormError("");
  }
  function openDetail(i: Report) {
    setDetail(i);
    setFormError("");
    setClaiming(false);
    setAction("");
  }
  async function withdraw(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setFormError("");
    try {
      const r = await api<Report>("/api/items/withdraw", {
        id: detail!.id,
        reason: f.get("reason"),
      });
      setDetail(r);
      setAction("");
      reload();
      setToast(t("Your report was withdrawn.", "تم سحب بلاغك."));
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function handover(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setFormError("");
    try {
      const r = await api<Report>("/api/items/handover", {
        id: detail!.id,
        note: f.get("note"),
        confirmed: f.get("confirmed") === "on",
      });
      setDetail(r);
      setAction("");
      reload();
      setToast(
        t(
          "Thank you. Security staff will confirm receipt at the desk.",
          "شكراً لك. سيؤكد موظفو الأمن الاستلام في المكتب.",
        ),
      );
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function flag(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setFormError("");
    try {
      await api("/api/flags", {
        itemId: detail!.id,
        reason: f.get("reason"),
        details: f.get("details"),
      });
      setAction("");
      setDetail(null);
      setToast(
        t(
          "Thank you. Security staff will review this post.",
          "شكراً لك. سيراجع موظفو الأمن هذا المنشور.",
        ),
      );
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    data.type = report!;
    data.point = point;
    const invalid = validateItem(data, undefined, {
      categories: activeNames("categories", editing?.category),
      buildings: activeNames("buildings", editing?.building),
    });
    if (invalid) {
      setFormError(invalid);
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      const f = data.photo;
      let photo = null;
      if (f instanceof File && f.size) {
        if (f.size > 5000000) throw Error("Photo must be under 5 MB.");
        if (!["image/png", "image/jpeg", "image/webp"].includes(f.type))
          throw Error("Choose a JPG, PNG, or WebP photo.");
        photo = await readPhoto(f);
      }
      if (editing) {
        const { photo: _file, ...fields } = data;
        const updated = await api<Report>("/api/items/update", {
          ...fields,
          id: editing.id,
          ...(photo ? { photo } : removePhoto ? { photo: null } : {}),
        });
        setReport(null);
        setEditing(null);
        reload();
        setDetail(updated);
        setToast(t("Your changes were saved.", "تم حفظ التعديلات."));
        return;
      }
      await api("/api/items", { ...data, photo });
      setReport(null);
      setView("board");
      clear();
      reload();
      setToast(t("Your report has been saved.", "تم حفظ بلاغك."));
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function checkin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setFormError("");
    try {
      const r = await api<Report>("/api/checkin", {
        id: detail!.id,
        reference: f.get("reference"),
        confirmed: f.get("confirmed") === "on",
      });
      setDetail(r);
      reload();
      setToast(t("Physical receipt recorded.", "تم تسجيل استلام الغرض."));
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const dateLabel = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString(
      lang === "ar" ? "ar-SA" : "en-GB",
      { day: "numeric", month: "short", year: "numeric" },
    );
  const filtered = !!(q || building || category || from || to || type);
  const unread = dashboard?.notifications.filter((n) => !n.read).length || 0;
  return (
    <>
      <header>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setView("board");
          }}
        >
          <span className="brand-symbol">
            <MapPin size={24} />
          </span>
          <span>
            Campus<span className="brand-sub">LOST & FOUND</span>
          </span>
        </a>
        <nav aria-label={t("Main navigation", "التنقل الرئيسي")}>
          {[
            ["board", t("Item board", "لوحة الأغراض")],
            ["locations", t("Collection points", "نقاط الاستلام")],
            ...(user ? [["mine", t("My space", "مساحتي")]] : []),
            ...(user?.role === "staff"
              ? [
                  ["desk", t("Collection desk", "مكتب الاستلام")],
                  ["security", t("Claims & pickup", "الطلبات والاستلام")],
                  ["admin", t("Admin", "الإدارة")],
                ]
              : []),
          ].map(([v, name]) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              onClick={() => {
                setView(v);
                clear();
              }}
            >
              {name}
              {v === "mine" && unread > 0 && (
                <span className="count-badge">{unread}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="account-actions">
          <button
            className="language-btn"
            onClick={changeLanguage}
            lang={lang === "en" ? "ar" : "en"}
          >
            {lang === "en" ? "العربية" : "English"}
          </button>
          {user ? (
            <button
              className="icon-btn"
              aria-label={t("Sign out", "تسجيل الخروج")}
              title={t("Sign out", "تسجيل الخروج")}
              onClick={async () => {
                try {
                  await api("/api/logout", {});
                  setUser(null);
                  setDashboard(null);
                  setClaims([]);
                  setDetail(null);
                  setView("board");
                  setPrivateError("");
                  reload();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut size={18} />
            </button>
          ) : (
            <button
              className="primary small"
              disabled={!sessionReady}
              onClick={() => setAuth(true)}
            >
              {t("Sign in", "تسجيل الدخول")}
            </button>
          )}
        </div>
      </header>
      <main>
        <div className="local-tools">
          <span>
            <ShieldCheck size={15} />
            {t(
              "Class project · shared records · private ownership checks",
              "مشروع دراسي · سجلات مشتركة · تحقق خاص من الملكية",
            )}
          </span>
          <span>
            {user ? (
              <>
                {user.name} ·{" "}
                {user.role === "staff"
                  ? t("Security staff", "موظف أمن")
                  : t("Student", "طالب")}
              </>
            ) : (
              t(
                "Browse freely. Sign in to report or claim an item.",
                "تصفح الأغراض بحرية. سجل الدخول لإرسال بلاغ أو طلب ملكية.",
              )
            )}
          </span>
        </div>
        {view === "board" && (
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span />
                {t("A LITTLE HELP GOES A LONG WAY", "مساعدة صغيرة تصنع فرقاً")}
              </div>
              <h1>
                {t("Lost something?", "هل فقدت شيئاً؟")}
                <br />
                <em>{t("Let’s find it together.", "لنجده معاً.")}</em>
              </h1>
              <p>
                {t(
                  "Your campus, looking out for you. Report a missing item, share a find, and help belongings make their way home.",
                  "جامعتك تهتم بك. أبلغ عن غرض مفقود، وشارك ما وجدته، وساعد في إعادة الأغراض إلى أصحابها.",
                )}
              </p>
              <div className="hero-actions">
                <button className="primary" onClick={() => openReport("lost")}>
                  <Plus size={18} />
                  {t("I lost something", "فقدت غرضاً")}
                </button>
                <button
                  className="secondary"
                  onClick={() => openReport("found")}
                >
                  {t("I found something", "وجدت غرضاً")}
                  <ArrowUpRight size={18} />
                </button>
              </div>
              <div className="hero-note">
                <ShieldCheck size={15} />
                {t(
                  "Verified ownership. A safe handover at the campus desk.",
                  "إثبات الملكية وتسليم آمن في مكتب الاستلام.",
                )}
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit o1" />
              <div className="orbit o2" />
              <div className="float-card card-one">
                <span className="art-icon mint">
                  <Headphones size={43} strokeWidth={1.5} />
                </span>
                <span className="art-label">
                  {t("Found on campus", "عُثر عليه في الجامعة")}
                </span>
                <div className="art-line" />
                <div className="art-line short" />
                <span className="mini-tag">
                  <Check size={12} />
                  {t("A little kindness", "لفتة طيبة")}
                </span>
              </div>
              <div className="float-card card-two">
                <span className="art-icon lilac">
                  <KeyRound size={43} strokeWidth={1.5} />
                </span>
                <span className="art-label">
                  {t("Back where it belongs", "عاد إلى صاحبه")}
                </span>
                <div className="art-line" />
              </div>
              <div className="art-spark">✳</div>
              <span className="art-dot" />
              <div className="art-sticker">
                <CheckCircle2 size={18} />
                {t("Small finds. Happy endings.", "أغراض صغيرة، نهايات سعيدة.")}
              </div>
            </div>
          </section>
        )}
        <div className="overview">
          <div>
            <span className="stat-icon pale-purple">
              <Search size={18} />
            </span>
            <strong>{stats.lost || 0}</strong>
            <span>{t("Lost items", "أغراض مفقودة")}</span>
          </div>
          <div>
            <span className="stat-icon pale-green">
              <Package size={18} />
            </span>
            <strong>{(stats.awaiting || 0) + (stats.received || 0)}</strong>
            <span>{t("Found items", "أغراض موجودة")}</span>
          </div>
          <div>
            <span className="stat-icon pale-orange">
              <CheckCircle2 size={18} />
            </span>
            <strong>{stats.returned || 0}</strong>
            <span>{t("Returned to owners", "أعيدت لأصحابها")}</span>
          </div>
          <div className="overview-note">
            <span className="live-dot" />
            {t("A community that cares", "مجتمع يهتم بك")}
          </div>
        </div>
        {(view === "mine" || view === "security") && (
          <ErrorMessage error={privateError} />
        )}
        {view === "admin" && user?.role === "staff" ? (
          <AdminPanel
            catalog={catalog}
            onCatalog={(c) => {
              setExtraLabels([...c.categories, ...c.buildings]);
              setCatalog(c);
              reload();
            }}
            onRefresh={reload}
          />
        ) : view === "mine" && user ? (
          <MySpace data={dashboard} onRefresh={reload} onOpen={openDetail} />
        ) : view === "security" && user?.role === "staff" ? (
          <StaffPanel claims={claims} onRefresh={reload} />
        ) : view === "locations" ? (
          <section className="locations">
            <div className="section-title">
              <div>
                <div className="eyebrow">
                  {t("A SAFE PLACE FOR EVERY FIND", "مكان آمن لكل غرض")}
                </div>
                <h2>{t("Collection points", "نقاط الاستلام")}</h2>
                <p>
                  {t(
                    "Choose a desk to see where to drop off or collect an item.",
                    "اختر مكتباً لمعرفة مكان تسليم الغرض أو استلامه.",
                  )}
                </p>
              </div>
              <MapPin size={28} />
            </div>
            <div className="location-grid">
              <div className="campus-map">
                <div className="map-road horizontal" />
                <div className="map-road vertical" />
                <div className="map-block a">{label("Central Library")}</div>
                <div className="map-block b">{label("Student Center")}</div>
                <div className="map-block c">
                  {t("ACADEMIC BUILDINGS", "المباني الأكاديمية")}
                </div>
                <div className="map-block d">{label("Main Gate")}</div>
                <div className="map-garden">
                  {t("CAMPUS GREEN", "حديقة الجامعة")}
                </div>
                {points.map((p, i) => (
                  <button
                    key={p.id}
                    className={"map-pin " + (point === p.id ? "selected" : "")}
                    style={{ left: p.x + "%", top: p.y + "%" }}
                    onClick={() => setPoint(p.id)}
                    aria-label={label(p.name)}
                  >
                    <MapPin size={18} />
                    <span>{i + 1}</span>
                  </button>
                ))}
                <span className="map-caption">
                  {t(
                    "Illustrative campus map · not to scale",
                    "خريطة توضيحية للحرم الجامعي · ليست بمقياس رسم",
                  )}
                </span>
              </div>
              <div>
                {points.map((p, i) => (
                  <button
                    key={p.id}
                    className={"point-card " + (point === p.id ? "chosen" : "")}
                    onClick={() => setPoint(p.id)}
                  >
                    <span className="point-number">{i + 1}</span>
                    <span>
                      <strong>{label(p.name)}</strong>
                      <small>{label(p.building)}</small>
                      <small>{label(p.detail)}</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))}
                <p className="demo-note">
                  <Info size={16} />
                  {t(
                    "These are demonstration locations. Confirm official desk names before real use.",
                    "هذه مواقع توضيحية. تأكد من أسماء المكاتب الرسمية قبل الاستخدام الفعلي.",
                  )}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="board">
            <div className="section-title">
              <div>
                <h2>
                  {view === "desk"
                    ? t("Collection desk", "مكتب الاستلام")
                    : t("The campus item board", "لوحة أغراض الجامعة")}
                </h2>
                <p>
                  {view === "desk"
                    ? t(
                        "Open an item to confirm physical receipt at its assigned desk.",
                        "افتح الغرض لتأكيد استلامه فعلياً في المكتب المحدد.",
                      )
                    : t(
                        "Something familiar? Start here.",
                        "هل وجدت ما تبحث عنه؟ ابدأ هنا.",
                      )}
                </p>
              </div>
              <span className="section-count">
                {total} {t("reports", "بلاغ")}
              </span>
            </div>
            <div className="search-row">
              <div className="search-input">
                <Search size={20} />
                <input
                  aria-label={t("Search items", "البحث عن الأغراض")}
                  placeholder={t(
                    "Search for a water bottle, keys, headphones…",
                    "ابحث عن قارورة ماء، مفاتيح، سماعات…",
                  )}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              {view !== "desk" && (
                <div
                  className="tabs"
                  aria-label={t("Report type", "نوع البلاغ")}
                >
                  {[
                    ["", t("All items", "كل الأغراض")],
                    ["lost", t("Lost", "مفقودة")],
                    ["found", t("Found", "موجودة")],
                  ].map(([v, name]) => (
                    <button
                      key={v}
                      aria-pressed={type === v}
                      className={type === v ? "selected" : ""}
                      onClick={() => setType(v)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="filters">
              <span className="filter-label">
                <SlidersHorizontal size={16} />
                {t("Filter by", "تصفية حسب")}
              </span>
              <label>
                <span className="sr-only">
                  {t("Campus building", "المبنى الجامعي")}
                </span>
                <select
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                >
                  <option value="">{t("All buildings", "كل المباني")}</option>
                  {activeNames("buildings").map((b) => (
                    <option key={b} value={b}>
                      {label(b)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">{t("Category", "الفئة")}</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">{t("All categories", "كل الفئات")}</option>
                  {activeNames("categories").map((c) => (
                    <option key={c} value={c}>
                      {label(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="date-filter">
                {t("From", "من")}
                <input
                  type="date"
                  value={from}
                  max={to || today()}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="date-filter">
                {t("To", "إلى")}
                <input
                  type="date"
                  value={to}
                  min={from}
                  max={today()}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              {filtered && (
                <button className="text-button" onClick={clear}>
                  {t("Reset", "إعادة ضبط")}
                </button>
              )}
            </div>
            {from && to && from > to ? (
              <p className="error">
                {t(
                  "Start date must be on or before the end date.",
                  "يجب أن يسبق تاريخ البداية تاريخ النهاية أو يساويه.",
                )}
              </p>
            ) : error ? (
              <div className="empty">
                <ErrorMessage error={error} />
                <button className="secondary" onClick={reload}>
                  {t("Try again", "حاول مجدداً")}
                </button>
              </div>
            ) : loading ? (
              <div className="empty loading" role="status">
                <LoaderCircle className="spin" size={26} />
                {t("Loading the item board…", "جارٍ تحميل لوحة الأغراض…")}
              </div>
            ) : !rows.length ? (
              <div className="empty">
                <Search size={30} />
                <h3>{t("No items found", "لم يتم العثور على أغراض")}</h3>
                <p>
                  {filtered
                    ? t(
                        "Try another search or clear the filters.",
                        "جرّب بحثاً آخر أو أزل عوامل التصفية.",
                      )
                    : t(
                        "Add the first report to get things moving.",
                        "أضف أول بلاغ لبدء المشاركة.",
                      )}
                </p>
                <button
                  className="text-button"
                  onClick={() => (filtered ? clear() : openReport("lost"))}
                >
                  {filtered
                    ? t("Clear filters", "إزالة عوامل التصفية")
                    : t("Create a report", "إنشاء بلاغ")}
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="item-grid">
                {rows.map((i) => {
                  const Icon = iconFor(i.category);
                  return (
                    <button
                      className="item-card"
                      key={i.id}
                      onClick={() => openDetail(i)}
                    >
                      <div
                        className={"item-image " + categoryClass(i.category)}
                      >
                        {i.photo ? (
                          <img src={i.photo} alt={i.title} />
                        ) : (
                          <Icon size={57} strokeWidth={1.2} />
                        )}
                        <span className={"type-badge " + i.type}>
                          {i.type === "lost"
                            ? t("Lost", "مفقود")
                            : t("Found", "موجود")}
                        </span>
                      </div>
                      <div className="item-body">
                        <div className="item-category">
                          {label(i.category)}
                          <ArrowUpRight size={16} />
                        </div>
                        <h3>{i.title}</h3>
                        <p className="item-description">{i.description}</p>
                        <div className="item-meta">
                          <MapPin size={14} />
                          {label(i.building)}
                        </div>
                        <div className="item-bottom">
                          <span>
                            <CalendarDays size={13} />
                            {dateLabel(i.date)}
                          </span>
                          <span className={"status " + i.status}>
                            <i />
                            {label(displayStatus(i))}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {total > 12 && (
              <div className="pagination">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("Previous", "السابق")}
                </button>
                <span>
                  {page} / {Math.ceil(total / 12)}
                </span>
                <button
                  disabled={page >= Math.ceil(total / 12)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("Next", "التالي")}
                </button>
              </div>
            )}
          </section>
        )}
        <section className="how">
          <div>
            <span className="eyebrow">
              {t(
                "GOOD THINGS FIND THEIR WAY BACK",
                "الأشياء الجميلة تجد طريق العودة",
              )}
            </span>
            <h2>
              {t("A simple path back to you.", "خطوات بسيطة لاستعادة أغراضك.")}
            </h2>
          </div>
          {[
            [
              t("Share the details", "شارك التفاصيل"),
              t(
                "Report an item with a clear description and location.",
                "أبلغ عن الغرض مع وصف واضح ومكانه.",
              ),
            ],
            [
              t("Prove ownership", "أثبت الملكية"),
              t(
                "Send private identifying details for staff to review.",
                "أرسل تفاصيل خاصة ليراجعها موظفو الأمن.",
              ),
            ],
            [
              t("Collect with confidence", "استلم بثقة"),
              t(
                "Show your approved pickup QR and identification at the desk.",
                "أظهر رمز الاستلام المعتمد وهويتك في المكتب.",
              ),
            ],
          ].map(([h, p], i) => (
            <div key={i}>
              <span className="step">0{i + 1}</span>
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
        </section>
        <footer>
          <span className="footer-brand">
            <MapPin size={17} />
            Campus Lost & Found
          </span>
          <span>
            {t(
              "Made for a more connected campus.",
              "من أجل مجتمع جامعي أكثر ترابطاً.",
            )}
          </span>
          <span>{t("CS 388T · Class project", "CS 388T · مشروع دراسي")}</span>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
      {auth && (
        <Auth
          demo={demo}
          onClose={() => setAuth(false)}
          onSuccess={(u) => {
            setUser(u);
            setDashboard(null);
            setClaims([]);
            setAuth(false);
            setDetail(null);
            reload();
            setToast(t("You are signed in.", "تم تسجيل الدخول."));
          }}
        />
      )}
      {report && (
        <Modal
          title={
            editing
              ? t("Edit your report", "تعديل البلاغ")
              : report === "lost"
                ? t("Report a lost item", "الإبلاغ عن غرض مفقود")
                : t("Report a found item", "الإبلاغ عن غرض موجود")
          }
          onClose={() => {
            if (!busy) {
              setReport(null);
              setEditing(null);
            }
          }}
        >
          <form className="report-form" onSubmit={submit} key={editing?.id || report}>
            <p className="form-intro">
              {t(
                "Share the public details. Keep private identifiers for proving ownership.",
                "شارك التفاصيل العامة. احتفظ بالمعلومات الخاصة لإثبات الملكية.",
              )}
            </p>
            <label className="field">
              {t("Item title", "عنوان الغرض")} *
              <input
                name="title"
                required
                minLength={3}
                maxLength={100}
                defaultValue={editing?.title}
              />
            </label>
            <div className="two-fields">
              <label className="field">
                {t("Category", "الفئة")} *
                <select
                  name="category"
                  required
                  defaultValue={editing?.category || ""}
                >
                  <option value="" disabled>
                    {t("Select a category", "اختر الفئة")}
                  </option>
                  {activeNames("categories", editing?.category).map((c) => (
                    <option key={c} value={c}>
                      {label(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {t("Date lost / found", "تاريخ الفقد / العثور")} *
                <input
                  name="date"
                  type="date"
                  required
                  max={today()}
                  defaultValue={editing?.date}
                />
              </label>
            </div>
            <label className="field">
              {t("Campus building", "المبنى الجامعي")} *
              <select
                name="building"
                required
                defaultValue={editing?.building || ""}
              >
                <option value="" disabled>
                  {t("Select a building", "اختر المبنى")}
                </option>
                {activeNames("buildings", editing?.building).map((b) => (
                  <option key={b} value={b}>
                    {label(b)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {t("Description", "الوصف")} *
              <textarea
                name="description"
                rows={3}
                required
                minLength={10}
                maxLength={2000}
                defaultValue={editing?.description}
              />
            </label>
            <label className="field">
              {t("Item photo (optional)", "صورة الغرض (اختياري)")}
              <span className="upload-box">
                {preview || (editing?.photo && !removePhoto) ? (
                  <img
                    src={preview || editing!.photo!}
                    alt={t("Photo preview", "معاينة الصورة")}
                  />
                ) : (
                  <Upload size={24} />
                )}
                <input
                  name="photo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 5000000) {
                      setFormError("Photo must be under 5 MB.");
                      e.target.value = "";
                      setPreview("");
                    } else {
                      setFormError("");
                      setPreview(f ? URL.createObjectURL(f) : "");
                    }
                  }}
                />
                <small>
                  {t(
                    "JPG, PNG or WebP · up to 5 MB",
                    "JPG أو PNG أو WebP · حتى 5 ميغابايت",
                  )}
                </small>
              </span>
            </label>
            {editing?.photo && !preview && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={removePhoto}
                  onChange={(e) => setRemovePhoto(e.target.checked)}
                />
                {t("Remove the current photo", "حذف الصورة الحالية")}
              </label>
            )}
            {report === "found" && (
              <div className="field">
                <label>
                  {t("Designated collection point", "نقطة الاستلام المحددة")} *
                </label>
                <div className="mini-points">
                  {points.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={point === p.id ? "chosen" : ""}
                      aria-pressed={point === p.id}
                      onClick={() => setPoint(p.id)}
                    >
                      <MapPin size={17} />
                      <span>
                        <strong>{label(p.name)}</strong>
                        <small>{label(p.building)}</small>
                      </span>
                      {point === p.id && <Check size={17} />}
                    </button>
                  ))}
                </div>
                <p className="helper">
                  {t(
                    "Bring the item to this desk. Staff confirm receipt after handover.",
                    "أحضر الغرض إلى هذا المكتب. سيؤكد الموظف استلامه بعد التسليم.",
                  )}
                </p>
              </div>
            )}
            <ErrorMessage error={formError} />
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setReport(null);
                  setEditing(null);
                }}
              >
                {t("Cancel", "إلغاء")}
              </button>
              <button className="primary" disabled={busy}>
                {busy
                  ? t("Saving…", "جارٍ الحفظ…")
                  : editing
                    ? t("Save changes", "حفظ التعديلات")
                    : t("Submit report", "إرسال البلاغ")}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal title={detail.title} onClose={() => !busy && setDetail(null)}>
          <div className="detail-content">
            {detail.photo && (
              <img
                className="detail-photo"
                src={detail.photo}
                alt={detail.title}
              />
            )}
            <span className={"pill " + displayStatus(detail)}>
              {label(displayStatus(detail))}
            </span>
            <p className="pre-wrap">{detail.description}</p>
            <div className="detail-meta">
              <span>
                <MapPin size={16} />
                {label(detail.building)}
              </span>
              <span>
                <CalendarDays size={16} />
                {dateLabel(detail.date)}
              </span>
              <span>{label(detail.category)}</span>
            </div>
            {detail.type === "found" ? (
              <>
                <h3>{t("Collection point", "نقطة الاستلام")}</h3>
                <p>
                  {label(points.find((p) => p.id === detail.point)?.name || "")}
                </p>
                {detail.status === "withdrawn" || detail.hiddenAt ? null : detail.status === "returned" ? (
                  <div className="notice">
                    <CheckCircle2 />
                    {t(
                      "This item has been returned to its approved owner.",
                      "تمت إعادة الغرض إلى مالكه المعتمد.",
                    )}
                  </div>
                ) : (
                  <>
                    {detail.status === "awaiting" && !detail.handedOverAt && (
                      <p className="notice">
                        <Info size={20} />
                        {t(
                          "Awaiting physical drop-off. Staff can approve pickup after receipt.",
                          "بانتظار تسليم الغرض فعلياً. يمكن للموظف اعتماد الاستلام بعد وصوله.",
                        )}
                      </p>
                    )}
                    {detail.status === "awaiting" && detail.handedOverAt && (
                      <p className="notice">
                        <PackageCheck size={20} />
                        <span>
                          {t(
                            "The finder handed this item to security on ",
                            "سلّم الشخص الذي وجد الغرض إلى الأمن بتاريخ ",
                          )}
                          {new Date(detail.handedOverAt).toLocaleString(
                            lang === "ar" ? "ar-SA" : "en-GB",
                          )}
                          {t(
                            ". Waiting for staff to confirm receipt at the desk.",
                            ". بانتظار تأكيد الموظف للاستلام في المكتب.",
                          )}
                          {detail.handoverNote && (
                            <>
                              <br />
                              {t("Finder's note: ", "ملاحظة: ")}
                              {detail.handoverNote}
                            </>
                          )}
                        </span>
                      </p>
                    )}
                    {detail.isMine &&
                      detail.status === "awaiting" &&
                      !detail.handedOverAt &&
                      !detail.hiddenAt &&
                      (action === "handover" ? (
                        <form className="checkin-form" onSubmit={handover}>
                          <h3>
                            {t(
                              "Mark as handed to security",
                              "تسجيل تسليم الغرض للأمن",
                            )}
                          </h3>
                          <label className="field">
                            {t(
                              "Who received it? (optional)",
                              "من استلمه؟ (اختياري)",
                            )}
                            <input
                              name="note"
                              maxLength={200}
                              placeholder={t(
                                "e.g. Desk officer at the library reception",
                                "مثال: موظف مكتب استقبال المكتبة",
                              )}
                            />
                          </label>
                          <label className="checkbox">
                            <input type="checkbox" name="confirmed" required />
                            {t(
                              "I handed this item to security at the selected collection point.",
                              "سلّمت هذا الغرض إلى الأمن في نقطة الاستلام المحددة.",
                            )}
                          </label>
                          <ErrorMessage error={formError} />
                          <div className="form-actions start">
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => setAction("")}
                            >
                              {t("Cancel", "إلغاء")}
                            </button>
                            <button className="primary" disabled={busy}>
                              {t("Confirm handover", "تأكيد التسليم")}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          className="primary handover-button"
                          onClick={() => {
                            setFormError("");
                            setAction("handover");
                          }}
                        >
                          <PackageCheck size={17} />
                          {t(
                            "I handed it to security",
                            "سلّمته إلى الأمن",
                          )}
                        </button>
                      ))}
                    {detail.deskReference && (
                      <p>
                        {t("Desk reference: ", "مرجع المكتب: ")}
                        {detail.deskReference}
                      </p>
                    )}
                    {user?.role === "staff" && detail.status === "awaiting" && (
                      <form className="checkin-form" onSubmit={checkin}>
                        <h3>
                          {t(
                            "Confirm desk receipt",
                            "تأكيد الاستلام في المكتب",
                          )}
                        </h3>
                        <label className="field">
                          {t("Desk reference", "مرجع المكتب")}
                          <input
                            name="reference"
                            required
                            minLength={3}
                            maxLength={80}
                          />
                        </label>
                        <label className="checkbox">
                          <input type="checkbox" name="confirmed" required />
                          {t(
                            "I confirm this item has physically arrived at the selected desk.",
                            "أؤكد وصول هذا الغرض فعلياً إلى المكتب المحدد.",
                          )}
                        </label>
                        <ErrorMessage error={formError} />
                        <button className="primary" disabled={busy}>
                          {t("Confirm receipt", "تأكيد الاستلام")}
                        </button>
                      </form>
                    )}
                    {claiming ? (
                      <ClaimForm
                        item={detail}
                        onCancel={() => setClaiming(false)}
                        onDone={() => {
                          setDetail(null);
                          setView("mine");
                          reload();
                          setToast(
                            t(
                              "Claim submitted for staff review.",
                              "تم إرسال الطلب لمراجعة موظفي الأمن.",
                            ),
                          );
                        }}
                      />
                    ) : dashboard?.claims.some(
                        (c) => c.itemId === detail.id,
                      ) ? (
                      <button
                        className="primary claim-button"
                        onClick={() => {
                          setDetail(null);
                          setView("mine");
                        }}
                      >
                        {t("View my claim", "عرض طلب الملكية")}
                      </button>
                    ) : !detail.isMine && user?.role !== "staff" ? (
                      <button
                        className="primary claim-button"
                        onClick={() => {
                          if (!user) {
                            setDetail(null);
                            setAuth(true);
                          } else setClaiming(true);
                        }}
                      >
                        <ShieldCheck size={18} />
                        {t(
                          "This is mine — claim item",
                          "هذا غرضي — تقديم طلب ملكية",
                        )}
                      </button>
                    ) : (
                      detail.isMine && (
                        <p className="helper">
                          {t(
                            "You reported this find. Security staff will manage ownership claims.",
                            "أنت من أبلغ عن العثور على هذا الغرض. سيتولى موظفو الأمن مراجعة طلبات الملكية.",
                          )}
                        </p>
                      )
                    )}
                  </>
                )}
              </>
            ) : detail.status === "withdrawn" || detail.hiddenAt ? null : (
              <p className="notice">
                <Info size={20} />
                {t(
                  "Recognize this item? Use “I found something” and choose a collection point.",
                  "هل عثرت على هذا الغرض؟ اختر «وجدت غرضاً» وحدد نقطة الاستلام.",
                )}
              </p>
            )}
            {detail.hiddenAt && (
              <p className="notice warning">
                <EyeOff size={20} />
                <span>
                  {t(
                    "Security staff hid this post from the board.",
                    "أخفى موظفو الأمن هذا المنشور من اللوحة.",
                  )}
                  {detail.hiddenNote && (
                    <>
                      <br />
                      {t("Note: ", "ملاحظة: ")}
                      {detail.hiddenNote}
                    </>
                  )}
                </span>
              </p>
            )}
            {detail.status === "withdrawn" && (
              <p className="notice">
                <Archive size={20} />
                <span>
                  {t(
                    "You withdrew this report. It no longer appears on the board.",
                    "سحبت هذا البلاغ ولم يعد يظهر في اللوحة.",
                  )}
                  {detail.withdrawReason && (
                    <>
                      <br />
                      {t("Reason: ", "السبب: ")}
                      {detail.withdrawReason}
                    </>
                  )}
                </span>
              </p>
            )}
            {detail.isMine &&
              !detail.hiddenAt &&
              ["lost", "awaiting"].includes(detail.status) &&
              (action === "withdraw" ? (
                <form className="checkin-form" onSubmit={withdraw}>
                  <h3>{t("Withdraw this report?", "سحب هذا البلاغ؟")}</h3>
                  <p className="helper">
                    {detail.type === "lost"
                      ? t(
                          "Use this if you recovered the item yourself. The report is removed from the board.",
                          "استخدم هذا إذا استعدت الغرض بنفسك. سيُزال البلاغ من اللوحة.",
                        )
                      : t(
                          "Use this if the item never reached the desk. Pending ownership claims will be closed.",
                          "استخدم هذا إذا لم يصل الغرض إلى المكتب. ستُغلق طلبات الملكية المعلقة.",
                        )}
                  </p>
                  <label className="field">
                    {t("Reason (optional)", "السبب (اختياري)")}
                    <input
                      name="reason"
                      maxLength={200}
                      placeholder={
                        detail.type === "lost"
                          ? t("e.g. Found it at home", "مثال: وجدته في المنزل")
                          : t("e.g. The owner collected it directly", "مثال: استلمه صاحبه مباشرة")
                      }
                    />
                  </label>
                  <ErrorMessage error={formError} />
                  <div className="form-actions start">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setAction("")}
                    >
                      {t("Keep report", "إبقاء البلاغ")}
                    </button>
                    <button className="primary danger" disabled={busy}>
                      {t("Withdraw report", "سحب البلاغ")}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="owner-actions">
                  <button className="secondary" onClick={() => openEdit(detail)}>
                    <Pencil size={16} />
                    {t("Edit report", "تعديل البلاغ")}
                  </button>
                  {!detail.handedOverAt && (
                    <button
                      className="secondary"
                      onClick={() => {
                        setFormError("");
                        setAction("withdraw");
                      }}
                    >
                      <Archive size={16} />
                      {t("Withdraw report", "سحب البلاغ")}
                    </button>
                  )}
                </div>
              ))}
            {!detail.isMine &&
              user?.role !== "staff" &&
              detail.status !== "withdrawn" &&
              !detail.hiddenAt &&
              (action === "flag" ? (
                <form className="checkin-form" onSubmit={flag}>
                  <h3>{t("Report this post", "الإبلاغ عن المنشور")}</h3>
                  <label className="field">
                    {t("Reason", "السبب")} *
                    <select name="reason" required defaultValue="">
                      <option value="" disabled>
                        {t("Choose a reason", "اختر السبب")}
                      </option>
                      {["false", "inappropriate", "duplicate", "spam", "other"].map(
                        (r) => (
                          <option key={r} value={r}>
                            {label(r)}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="field">
                    {t("Details for security staff (optional)", "تفاصيل لموظفي الأمن (اختياري)")}
                    <textarea name="details" rows={2} maxLength={500} />
                  </label>
                  <ErrorMessage error={formError} />
                  <div className="form-actions start">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setAction("")}
                    >
                      {t("Cancel", "إلغاء")}
                    </button>
                    <button className="primary" disabled={busy}>
                      {t("Send report", "إرسال البلاغ")}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  className="text-button flag-button"
                  onClick={() => {
                    if (!user) {
                      setDetail(null);
                      setAuth(true);
                    } else {
                      setFormError("");
                      setAction("flag");
                    }
                  }}
                >
                  <Flag size={15} />
                  {t("Report this post", "الإبلاغ عن المنشور")}
                </button>
              ))}
            <p className="reference">
              {t("Report ID: ", "رقم البلاغ: ")}
              {detail.id}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
