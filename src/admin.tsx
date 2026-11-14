import { useState, useEffect, FormEvent } from "react";
import {
  BarChart3,
  Flag,
  MapPinned,
  Download,
  EyeOff,
  Eye,
  Plus,
  LoaderCircle,
} from "lucide-react";
import {
  api,
  Analytics,
  Catalog,
  CatalogEntry,
  FlagQueue,
  FlagEntry,
  GroupStat,
} from "./api";
import { useLanguage } from "./i18n";
import { ErrorMessage } from "./workflow";
import { points } from "./domain";

// Validated categorical palette (lost / found / returned).
const SERIES = [
  { key: "lost", color: "#c06a1a" },
  { key: "found", color: "#12936b" },
  { key: "returned", color: "#5b5fc7" },
] as const;

export function AdminPanel({
  catalog,
  onCatalog,
  onRefresh,
}: {
  catalog: Catalog | null;
  onCatalog: (c: Catalog) => void;
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"analytics" | "flags" | "catalog">(
    "analytics",
  );
  return (
    <section className="board admin">
      <div className="section-title">
        <div>
          <div className="eyebrow">
            {t("CAMPUS ADMINISTRATION", "إدارة الحرم الجامعي")}
          </div>
          <h2>{t("Admin workspace", "مساحة الإدارة")}</h2>
          <p>
            {t(
              "Track trends, moderate reported posts, and manage campus buildings and categories.",
              "تابع المؤشرات، وراجع المنشورات المبلغ عنها، وأدر المباني والفئات.",
            )}
          </p>
        </div>
      </div>
      <div className="tabs admin-tabs" role="tablist">
        {(
          [
            ["analytics", t("Analytics", "الإحصاءات"), BarChart3],
            ["flags", t("Reported posts", "المنشورات المبلغ عنها"), Flag],
            [
              "catalog",
              t("Locations & categories", "المواقع والفئات"),
              MapPinned,
            ],
          ] as const
        ).map(([v, name, Icon]) => (
          <button
            key={v}
            role="tab"
            aria-selected={tab === v}
            className={tab === v ? "selected" : ""}
            onClick={() => setTab(v)}
          >
            <Icon size={15} />
            {name}
          </button>
        ))}
      </div>
      {tab === "analytics" && <AnalyticsView />}
      {tab === "flags" && <FlagsView onRefresh={onRefresh} />}
      {tab === "catalog" && (
        <CatalogView catalog={catalog} onCatalog={onCatalog} />
      )}
    </section>
  );
}

function Loading() {
  const { t } = useLanguage();
  return (
    <div className="empty loading" role="status">
      <LoaderCircle className="spin" size={26} />
      {t("Loading…", "جارٍ التحميل…")}
    </div>
  );
}

function AnalyticsView() {
  const { t, label, lang } = useLanguage();
  const [data, setData] = useState<Analytics | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    api<Analytics>("/api/analytics", undefined, c.signal)
      .then(setData)
      .catch((e) => !c.signal.aborted && setError(e.message));
    return () => c.abort();
  }, []);
  if (error) return <ErrorMessage error={error} />;
  if (!data) return <Loading />;
  const s = data.totals;
  const seriesName = (k: string) =>
    k === "lost"
      ? t("Lost", "مفقودة")
      : k === "found"
        ? t("Found", "موجودة")
        : t("Returned", "أعيدت");
  const monthName = (m: string) =>
    new Date(m + "-15").toLocaleDateString(lang === "ar" ? "ar-SA" : "en-GB", {
      month: "short",
    });
  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Section", "Name", "Lost", "Found", "Returned"],
      ...data!.byCategory.map((g) => ["Category", g.name, g.lost, g.found, g.returned]),
      ...data!.byBuilding.map((g) => ["Building", g.name, g.lost, g.found, g.returned]),
      ...data!.monthly.map((m) => ["Month", m.month, m.lost, m.found, m.returned]),
      [],
      ["Collection point", "Awaiting drop-off", "At desk", "Returned"],
      ...data!.byPoint.map((p) => [p.name, p.awaiting, p.atDesk, p.returned]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "Campus_Lost_Found_Analytics.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const tiles: [string, string | number, string?][] = [
    [t("Active reports", "البلاغات النشطة"), s.reports],
    [t("Still missing", "ما زالت مفقودة"), s.stillMissing],
    [
      t("At collection desks", "في مكاتب الاستلام"),
      s.atDesk,
      t(
        `${s.awaiting} awaiting drop-off (${s.handedOver} handed over)`,
        `${s.awaiting} بانتظار التسليم (${s.handedOver} سُلّمت للأمن)`,
      ),
    ],
    [t("Returned to owners", "أعيدت لأصحابها"), s.returned],
    [
      t("Recovery rate", "نسبة الاسترجاع"),
      s.recoveryRate + "%",
      t("returned ÷ found reports", "المعاد ÷ الموجودة"),
    ],
    [
      t("Average days to return", "متوسط أيام الإعادة"),
      s.avgDaysToReturn ?? "—",
      t("from found report to handover", "من البلاغ حتى التسليم"),
    ],
  ];
  return (
    <div className="analytics">
      <div className="analytics-head">
        <p className="helper">
          {t("Updated ", "آخر تحديث ")}
          {new Date(data.generatedAt).toLocaleString(
            lang === "ar" ? "ar-SA" : "en-GB",
          )}
          {" · "}
          {t(
            "Withdrawn and hidden posts are excluded from charts.",
            "لا تشمل الرسوم البلاغات المسحوبة أو المخفية.",
          )}
        </p>
        <button className="secondary small" onClick={exportCsv}>
          <Download size={16} />
          {t("Download CSV", "تنزيل CSV")}
        </button>
      </div>
      <div className="kpi-grid">
        {tiles.map(([name, value, note]) => (
          <div className="kpi" key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
            {note && <small>{note}</small>}
          </div>
        ))}
      </div>
      <div className="kpi-strip">
        <span>
          {t("Pending claims", "طلبات قيد المراجعة")}:{" "}
          <strong>{data.claims.pending || 0}</strong>
        </span>
        <span>
          {t("Approved, awaiting pickup", "معتمدة بانتظار الاستلام")}:{" "}
          <strong>{data.claims.approved || 0}</strong>
        </span>
        <span>
          {t("Open post reports", "بلاغات منشورات مفتوحة")}:{" "}
          <strong>{data.flags.open || 0}</strong>
        </span>
        <span>
          {t("Withdrawn", "مسحوبة")}: <strong>{s.withdrawn}</strong>
        </span>
        <span>
          {t("Hidden by security", "مخفية")}: <strong>{s.hidden}</strong>
        </span>
      </div>
      <div className="legend" aria-label={t("Chart legend", "مفتاح الرسم")}>
        {SERIES.map((x) => (
          <span key={x.key}>
            <i style={{ background: x.color }} />
            {seriesName(x.key)}
          </span>
        ))}
      </div>
      <div className="chart-grid">
        <BarGroups
          title={t("Reports by category", "البلاغات حسب الفئة")}
          rows={data.byCategory}
          name={(n) => label(n)}
          series={seriesName}
        />
        <BarGroups
          title={t("Reports by building", "البلاغات حسب المبنى")}
          rows={data.byBuilding}
          name={(n) => label(n)}
          series={seriesName}
        />
      </div>
      <div className="chart-grid">
        <div className="work-card chart-card">
          <h3>{t("Last six months", "آخر ستة أشهر")}</h3>
          <Columns
            rows={data.monthly.map((m) => ({ ...m, name: monthName(m.month) }))}
            series={seriesName}
          />
          <p className="helper">
            {t(
              "Lost and found use the date reported in the item; returned uses the handover date.",
              "المفقود والموجود حسب تاريخ البلاغ، والمعاد حسب تاريخ التسليم.",
            )}
          </p>
        </div>
        <div className="work-card chart-card">
          <h3>{t("Collection points", "نقاط الاستلام")}</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Desk", "المكتب")}</th>
                <th>{t("Awaiting", "بانتظار التسليم")}</th>
                <th>{t("At desk", "في المكتب")}</th>
                <th>{t("Returned", "أعيدت")}</th>
              </tr>
            </thead>
            <tbody>
              {data.byPoint.map((p) => (
                <tr key={p.id}>
                  <td>{label(p.name)}</td>
                  <td>{p.awaiting}</td>
                  <td>{p.atDesk}</td>
                  <td>{p.returned}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="helper">
            {t(
              "Desks with many items waiting may need more staff hours.",
              "المكاتب التي تنتظر فيها أغراض كثيرة قد تحتاج ساعات عمل إضافية.",
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function BarGroups({
  title,
  rows,
  name,
  series,
}: {
  title: string;
  rows: GroupStat[];
  name: (n: string) => string;
  series: (k: string) => string;
}) {
  const { t } = useLanguage();
  const max = Math.max(1, ...rows.flatMap((r) => [r.lost, r.found, r.returned]));
  return (
    <div className="work-card chart-card">
      <h3>{title}</h3>
      <div className="bar-groups">
        {rows.map((r) => (
          <div className="bar-group" key={r.name}>
            <span className="bar-label">{name(r.name)}</span>
            <div className="bars">
              {SERIES.map((x) => {
                const v = r[x.key];
                const tip = `${name(r.name)} · ${series(x.key)}: ${v}`;
                return (
                  <div className="bar-row" key={x.key} title={tip} aria-label={tip}>
                    <span
                      className="bar"
                      style={{
                        width: v ? `max(4px, ${(v / max) * 100}%)` : "0",
                        background: x.color,
                      }}
                    />
                    {v > 0 && <small>{v}</small>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <details className="table-view">
        <summary>{t("Show as table", "عرض كجدول")}</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th />
              {SERIES.map((x) => (
                <th key={x.key}>{series(x.key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{name(r.name)}</td>
                <td>{r.lost}</td>
                <td>{r.found}</td>
                <td>{r.returned}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function Columns({
  rows,
  series,
}: {
  rows: { name: string; lost: number; found: number; returned: number }[];
  series: (k: string) => string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.lost, r.found, r.returned]));
  return (
    <div className="columns" role="img" aria-label={rows
      .map((r) => `${r.name}: ${r.lost}/${r.found}/${r.returned}`)
      .join(", ")}>
      {rows.map((r) => (
        <div className="column-group" key={r.name}>
          <div className="column-bars">
            {SERIES.map((x) => {
              const v = r[x.key];
              return (
                <span
                  key={x.key}
                  className="column"
                  title={`${r.name} · ${series(x.key)}: ${v}`}
                  style={{
                    height: v ? `max(4px, ${(v / max) * 100}%)` : "0",
                    background: x.color,
                  }}
                />
              );
            })}
          </div>
          <small>{r.name}</small>
          <small className="column-total">{r.lost + r.found}</small>
        </div>
      ))}
    </div>
  );
}

function FlagsView({ onRefresh }: { onRefresh: () => void }) {
  const { t, label, lang } = useLanguage();
  const [data, setData] = useState<FlagQueue | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(""),
    [n, setN] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    api<FlagQueue>("/api/flags", undefined, c.signal)
      .then(setData)
      .catch((e) => !c.signal.aborted && setError(e.message));
    return () => c.abort();
  }, [n]);
  async function act(itemId: string, action: string, note: string) {
    setBusy(true);
    setError("");
    setDone("");
    try {
      await api("/api/flags/review", { itemId, action, note });
      setDone(
        action === "hide"
          ? t("Post hidden. The owner was notified.", "تم إخفاء المنشور وإشعار صاحبه.")
          : action === "restore"
            ? t("Post restored to the board.", "أعيد المنشور إلى اللوحة.")
            : t("Reports dismissed. The post stays visible.", "تم تجاهل البلاغات وبقي المنشور ظاهراً."),
      );
      setN((x) => x + 1);
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return error ? <ErrorMessage error={error} /> : <Loading />;
  const when = (d: string) =>
    new Date(d).toLocaleString(lang === "ar" ? "ar-SA" : "en-GB");
  const card = (e: FlagEntry, hidden: boolean) => (
    <form
      className="work-card flag-card"
      key={e.item.id}
      onSubmit={(ev: FormEvent<HTMLFormElement>) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        const action = (ev.nativeEvent as SubmitEvent).submitter?.getAttribute("value") || "";
        act(e.item.id, action, String(f.get("note") || ""));
      }}
    >
      <div className="work-card-head">
        <h3>{e.item.title}</h3>
        <span className={"type-badge inline " + e.item.type}>
          {e.item.type === "lost" ? t("Lost", "مفقود") : t("Found", "موجود")}
        </span>
      </div>
      <p className="helper">
        {t("Posted by ", "نشره ")}
        {e.ownerName} · {label(e.item.category)} · {label(e.item.building)} ·{" "}
        <span className={"pill " + e.item.status}>{label(e.item.status)}</span>
      </p>
      <p className="evidence pre-wrap">{e.item.description}</p>
      {hidden && e.item.hiddenNote && (
        <p className="review-note">
          {t("Hidden: ", "سبب الإخفاء: ")}
          {e.item.hiddenNote}
        </p>
      )}
      {!!e.flags.length && (
        <ul className="flag-list">
          {e.flags.map((f) => (
            <li key={f.id}>
              <strong>{label(f.reason)}</strong>
              {f.details && <span className="pre-wrap"> — {f.details}</span>}
              <small>
                {f.reporterName} · {when(f.createdAt)} ·{" "}
                <span className={"pill " + f.status}>{label(f.status)}</span>
              </small>
            </li>
          ))}
        </ul>
      )}
      {hidden ? (
        <button className="secondary" value="restore" disabled={busy}>
          <Eye size={16} />
          {t("Restore post", "إعادة نشر")}
        </button>
      ) : (
        <>
          <label className="field">
            {t("Note to the owner (required to hide)", "ملاحظة لصاحب المنشور (مطلوبة للإخفاء)")}
            <textarea name="note" rows={2} maxLength={500} />
          </label>
          <div className="form-actions start">
            <button className="primary" value="hide" disabled={busy}>
              <EyeOff size={16} />
              {t("Hide post", "إخفاء المنشور")}
            </button>
            <button className="secondary" value="dismiss" disabled={busy}>
              {t("Dismiss reports", "تجاهل البلاغات")}
            </button>
          </div>
        </>
      )}
    </form>
  );
  return (
    <div>
      <ErrorMessage error={error} />
      {done && (
        <p role="status" className="notice">
          {done}
        </p>
      )}
      <h3>
        {t("Waiting for review", "بانتظار المراجعة")} ({data.queue.length})
      </h3>
      {!data.queue.length && (
        <p className="empty-panel">
          {t(
            "No reported posts right now. Students can use “Report this post” on any item.",
            "لا توجد منشورات مبلغ عنها حالياً. يمكن للطلاب استخدام «الإبلاغ عن المنشور» في أي غرض.",
          )}
        </p>
      )}
      {data.queue.map((e) => card(e, false))}
      <details className="review-history" open={!!data.hidden.length}>
        <summary>
          {t("Hidden posts", "المنشورات المخفية")} ({data.hidden.length})
        </summary>
        {data.hidden.map((e) => card(e, true))}
      </details>
    </div>
  );
}

function CatalogView({
  catalog,
  onCatalog,
}: {
  catalog: Catalog | null;
  onCatalog: (c: Catalog) => void;
}) {
  const { t, label } = useLanguage();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState("");
  async function save(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setError("");
    setDone("");
    try {
      onCatalog(await api<Catalog>("/api/catalog", body));
      setDone(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!catalog) return <Loading />;
  const list = (
    kind: "building" | "category",
    title: string,
    rows: CatalogEntry[],
  ) => (
    <div className="work-card">
      <h3>{title}</h3>
      <form
        className="catalog-add"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          if (
            await save(
              { kind, action: "add", name: f.get("name"), nameAr: f.get("nameAr") },
              t("Added.", "تمت الإضافة."),
            )
          )
            form.reset();
        }}
      >
        <input
          name="name"
          required
          minLength={2}
          maxLength={60}
          placeholder={t("English name", "الاسم بالإنجليزية")}
          aria-label={t("English name", "الاسم بالإنجليزية")}
          dir="ltr"
        />
        <input
          name="nameAr"
          maxLength={60}
          placeholder={t("Arabic name (optional)", "الاسم بالعربية (اختياري)")}
          aria-label={t("Arabic name", "الاسم بالعربية")}
          dir="rtl"
        />
        <button className="primary small" disabled={busy}>
          <Plus size={16} />
          {t("Add", "إضافة")}
        </button>
      </form>
      <div className="catalog-list">
        {rows.map((r) => (
          <form
            key={r.name}
            className={"catalog-row " + (r.active ? "" : "inactive")}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save(
                {
                  kind,
                  action: "update",
                  name: r.name,
                  newName: f.get("newName"),
                  nameAr: f.get("nameAr"),
                  active: f.get("active") === "on",
                },
                t("Saved. Existing reports were updated.", "تم الحفظ وتحديث البلاغات الحالية."),
              );
            }}
          >
            <input
              name="newName"
              defaultValue={r.name}
              required
              minLength={2}
              maxLength={60}
              aria-label={t("English name", "الاسم بالإنجليزية")}
              dir="ltr"
            />
            <input
              name="nameAr"
              defaultValue={r.nameAr}
              maxLength={60}
              aria-label={t("Arabic name", "الاسم بالعربية")}
              dir="rtl"
            />
            <label className="checkbox">
              <input type="checkbox" name="active" defaultChecked={!!r.active} />
              {t("Active", "مفعل")}
            </label>
            <button className="secondary small" disabled={busy}>
              {t("Save", "حفظ")}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
  return (
    <div>
      <p className="helper">
        {t(
          "Inactive entries are hidden from report forms and filters but stay on existing reports. Renaming updates every report that uses the name. Collection desks are fixed for this version.",
          "تختفي العناصر غير المفعلة من النماذج والتصفية وتبقى في البلاغات الحالية. تغيير الاسم يحدّث كل البلاغات التي تستخدمه. نقاط الاستلام ثابتة في هذا الإصدار.",
        )}
      </p>
      <ErrorMessage error={error} />
      {done && (
        <p role="status" className="notice">
          {done}
        </p>
      )}
      <div className="workspace-grid even">
        {list("building", t("Campus buildings", "مباني الحرم"), catalog.buildings)}
        {list("category", t("Item categories", "فئات الأغراض"), catalog.categories)}
      </div>
      <p className="helper">
        {t("Collection desks: ", "نقاط الاستلام: ")}
        {points.map((p) => label(p.name)).join(" · ")}
      </p>
    </div>
  );
}
