import { useState, useEffect, useRef, FormEvent } from "react";
import {
  X,
  Check,
  ShieldCheck,
  LogIn,
  Camera,
  QrCode,
  Download,
  Bell,
  LoaderCircle,
} from "lucide-react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { api, User, Report, Claim, Dashboard } from "./api";
import { useLanguage } from "./i18n";
import { points, displayStatus } from "./domain";
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useLanguage();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-head">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-btn"
          aria-label={t("Close dialog", "إغلاق النافذة")}
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ErrorMessage({ error }: { error: string }) {
  const { label } = useLanguage();
  return error ? (
    <p className="error" role="alert">
      {label(error)}
    </p>
  ) : null;
}
export function Auth({
  onClose,
  onSuccess,
  demo,
}: {
  onClose: () => void;
  onSuccess: (u: User) => void;
  demo: boolean;
}) {
  const { t } = useLanguage();
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      const r = await api<{ user: User }>(
        register ? "/api/register" : "/api/login",
        data,
      );
      onSuccess(r.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        register
          ? t("Create student account", "إنشاء حساب طالب")
          : t("Welcome back", "مرحباً بعودتك")
      }
      onClose={() => !busy && onClose()}
    >
      <form className="report-form" onSubmit={submit}>
        <p className="form-intro">
          {t(
            "Use your project account to report items and track claims.",
            "استخدم حساب المشروع لإرسال البلاغات ومتابعة طلبات الملكية.",
          )}
        </p>
        {register && (
          <label className="field">
            {t("Full name", "الاسم الكامل")}
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
            />
          </label>
        )}
        <label className="field">
          {t("Email", "البريد الإلكتروني")}
          <input
            name="email"
            type="email"
            autoComplete="username"
            dir="ltr"
            required
            maxLength={254}
          />
        </label>
        <label className="field">
          {t("Password", "كلمة المرور")}
          <input
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={10}
            maxLength={128}
          />
        </label>
        {register && (
          <small>
            {t(
              "At least 10 characters. These are class-project accounts, without university single sign-on.",
              "10 أحرف على الأقل. هذه حسابات للمشروع الدراسي، دون ربط بتسجيل الدخول الجامعي.",
            )}
          </small>
        )}
        <ErrorMessage error={error} />
        <div className="form-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register
              ? t("Already registered? Sign in", "لديك حساب؟ تسجيل الدخول")
              : t("Create an account", "إنشاء حساب")}
          </button>
          <button className="primary" disabled={busy}>
            <LogIn size={17} />
            {busy
              ? t("Please wait…", "يرجى الانتظار…")
              : register
                ? t("Register", "إنشاء حساب")
                : t("Sign in", "تسجيل الدخول")}
          </button>
        </div>
        {demo && (
          <details className="demo-accounts">
            <summary>
              {t("Class demonstration accounts", "حسابات العرض الدراسي")}
            </summary>
            <p>
              {t(
                "Use these fictional accounts for the demonstration only.",
                "استخدم هذه الحسابات التجريبية للعرض فقط.",
              )}
            </p>
            <p dir="ltr">
              student@campus.test / CampusStudent123!
              <br />
              finder@campus.test / CampusFinder123!
              <br />
              staff@campus.test / CampusStaff123!
            </p>
          </details>
        )}
      </form>
    </Modal>
  );
}
export function ClaimForm({
  item,
  onDone,
  onCancel,
}: {
  item: Report;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="checkin-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await api("/api/claims", {
            itemId: item.id,
            evidence: f.get("evidence"),
          });
          onDone();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{t("Prove this item belongs to you", "أثبت ملكيتك لهذا الغرض")}</h3>
      <p>
        {t(
          "Only you and security staff can see these details. Mention a hidden mark, contents, serial number, or other identifying information.",
          "لن يطّلع على هذه التفاصيل إلا أنت وموظفو الأمن. اذكر علامة مخفية أو محتويات الغرض أو رقمه التسلسلي أو تفاصيل مميزة أخرى.",
        )}
      </p>
      <label className="field">
        {t("Private ownership details", "تفاصيل خاصة لإثبات الملكية")}
        <textarea
          name="evidence"
          rows={4}
          required
          minLength={20}
          maxLength={2000}
        />
      </label>
      <ErrorMessage error={error} />
      <div className="form-actions">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          {t("Cancel", "إلغاء")}
        </button>
        <button className="primary" disabled={busy}>
          {busy
            ? t("Submitting…", "جارٍ الإرسال…")
            : t("Submit claim", "إرسال طلب الملكية")}
        </button>
      </div>
    </form>
  );
}
function PickupPass({
  claim,
  onRefresh,
}: {
  claim: Claim;
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  const [image, setImage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    if (claim.pickupToken)
      QRCode.toDataURL(claim.pickupToken, {
        width: 240,
        margin: 4,
        errorCorrectionLevel: "M",
      })
        .then((url) => live && setImage(url))
        .catch(
          () =>
            live &&
            setError(
              t(
                "Could not generate QR. Use the pickup code below.",
                "تعذر إنشاء الرمز. استخدم رمز الاستلام المكتوب أدناه.",
              ),
            ),
        );
    else setImage("");
    return () => {
      live = false;
    };
  }, [claim.pickupToken]);
  return (
    <div className="pickup-pass">
      <h4>
        <QrCode size={18} />
        {t("Your pickup pass", "تصريح الاستلام")}
      </h4>
      {claim.tokenExpired ? (
        <>
          <p>
            {t(
              "Your pass has expired. Generate a new one before visiting the desk.",
              "انتهت صلاحية التصريح. أنشئ تصريحاً جديداً قبل زيارة المكتب.",
            )}
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/api/pickup/renew", { id: claim.id });
                onRefresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("Renew pickup pass", "تجديد تصريح الاستلام")}
          </button>
        </>
      ) : (
        <>
          {image && (
            <>
              <img
                className="qr-image"
                src={image}
                alt={t(
                  "One-time pickup QR code",
                  "رمز استلام للاستخدام مرة واحدة",
                )}
              />
              <a
                className="text-button"
                href={image}
                download="Campus_Pickup_QR.png"
              >
                <Download size={16} />
                {t("Save QR image", "حفظ صورة الرمز")}
              </a>
            </>
          )}
          <code className="pickup-code" dir="ltr">
            {claim.pickupToken}
          </code>
          <p>
            {t(
              "Show this pass and identification to staff. Keep the code private; it can be used once.",
              "أظهر التصريح وهويتك للموظف. احتفظ بالرمز سرياً؛ يُستخدم مرة واحدة.",
            )}
          </p>
          <small>
            {t("Valid until", "صالح حتى")}{" "}
            {new Date(claim.expires).toLocaleString()}
          </small>
        </>
      )}
      <ErrorMessage error={error} />
    </div>
  );
}
export function MySpace({
  data,
  onRefresh,
  onOpen,
}: {
  data: Dashboard | null;
  onRefresh: () => void;
  onOpen: (i: Report) => void;
}) {
  const { t, label, lang } = useLanguage();
  const [error, setError] = useState("");
  return (
    <section className="board">
      <div className="section-title">
        <div>
          <h2>{t("My campus space", "مساحتي الجامعية")}</h2>
          <p>
            {t(
              "Your reports, ownership claims, and updates in one place.",
              "بلاغاتك وطلبات الملكية والتحديثات في مكان واحد.",
            )}
          </p>
        </div>
      </div>
      {!data ? (
        <p role="status">{t("Loading…", "جارٍ التحميل…")}</p>
      ) : (
        <>
          <div className="workspace-grid">
            <div>
              <h3>{t("My claims", "طلبات الملكية")}</h3>
              {!data.claims.length && (
                <p className="empty-panel">
                  {t(
                    "No claims yet. Open a found item on the board to submit one.",
                    "لا توجد طلبات بعد. افتح غرضاً موجوداً في اللوحة لتقديم طلب ملكية.",
                  )}
                </p>
              )}
              {data.claims.map((c) => (
                <article className="work-card" key={c.id}>
                  <div className="work-card-head">
                    <h3>{c.item.title}</h3>
                    <span className={"pill " + c.status}>
                      {label(c.status)}
                    </span>
                  </div>
                  <p>
                    <strong>
                      {t("Collection point: ", "نقطة الاستلام: ")}
                    </strong>
                    {label(
                      points.find((p) => p.id === c.item.point)?.name || "",
                    )}
                  </p>
                  <details>
                    <summary>
                      {t("My ownership details", "تفاصيل إثبات ملكيتي")}
                    </summary>
                    <p className="pre-wrap">{c.evidence}</p>
                  </details>
                  {c.note && (
                    <p className="review-note">
                      {t("Staff note: ", "ملاحظة الموظف: ")}
                      {label(c.note)}
                    </p>
                  )}
                  {c.status === "pending" && (
                    <p className="helper">
                      {t(
                        "Security staff will review your identifying details.",
                        "سيراجع موظفو الأمن التفاصيل المميزة التي قدمتها.",
                      )}
                    </p>
                  )}
                  {c.status === "approved" && (
                    <PickupPass claim={c} onRefresh={onRefresh} />
                  )}
                </article>
              ))}
            </div>
            <aside>
              <div className="work-card">
                <div className="work-card-head">
                  <h3>
                    <Bell size={18} />
                    {t("Updates", "التحديثات")}
                  </h3>
                  <button
                    className="text-button"
                    onClick={async () => {
                      try {
                        await api("/api/notifications/read", {});
                        onRefresh();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {t("Mark read", "تحديد كمقروء")}
                  </button>
                </div>
                <ErrorMessage error={error} />
                {!data.notifications.length && (
                  <p>{t("You are all caught up.", "لا توجد تحديثات جديدة.")}</p>
                )}
                {data.notifications.map((n) => (
                  <div
                    key={n.id}
                    className={"notification " + (n.read ? "" : "unread")}
                  >
                    <strong>{label(n.kind)}</strong>
                    <span>{n.title}</span>
                    <small>
                      {new Date(n.createdAt).toLocaleString(
                        lang === "ar" ? "ar-SA" : "en-GB",
                      )}
                    </small>
                  </div>
                ))}
              </div>
            </aside>
          </div>
          <div className="work-card-head">
            <h3>{t("My reports", "بلاغاتي")}</h3>
            <button
              className="text-button"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob(
                    [
                      JSON.stringify(
                        {
                          app: "Campus Lost & Found",
                          exportedAt: new Date().toISOString(),
                          items: data.items,
                        },
                        null,
                        2,
                      ),
                    ],
                    { type: "application/json" },
                  ),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "Campus_My_Reports.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download size={16} />
              {t("Export my reports", "تصدير بلاغاتي")}
            </button>
          </div>
          {!data.items.length ? (
            <p className="empty-panel">
              {t(
                "Your reported items will appear here.",
                "ستظهر الأغراض التي أبلغت عنها هنا.",
              )}
            </p>
          ) : (
            <div className="report-list">
              {data.items.map((i) => (
                <button
                  key={i.id}
                  className="work-card report-row"
                  onClick={() => onOpen(i)}
                >
                  <span>
                    <strong>{i.title}</strong>
                    <small>{label(i.building)}</small>
                  </span>
                  <span className={"pill " + displayStatus(i)}>
                    {label(displayStatus(i))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
function Scanner({ onCode }: { onCode: (s: string) => void }) {
  const { t } = useLanguage();
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<number | null>(null),
    generation = useRef(0);
  const [active, setActive] = useState(false),
    [error, setError] = useState("");
  function stop() {
    generation.current++;
    if (timer.current) cancelAnimationFrame(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setActive(false);
  }
  useEffect(
    () => () => {
      generation.current++;
      if (timer.current) cancelAnimationFrame(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  async function start() {
    stop();
    setError("");
    const g = generation.current;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (g !== generation.current) {
        s.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = s;
      setActive(true);
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      const canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      function scan() {
        if (g !== generation.current) return;
        if (v.readyState >= 2) {
          canvas.width = 640;
          canvas.height = Math.round((640 * v.videoHeight) / v.videoWidth);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(image.data, image.width, image.height);
          if (code) {
            onCode(code.data);
            stop();
            return;
          }
        }
        timer.current = requestAnimationFrame(scan);
      }
      scan();
    } catch {
      stop();
      setError(
        t(
          "Camera unavailable. Upload a QR image or enter the code instead.",
          "الكاميرا غير متاحة. ارفع صورة الرمز أو أدخله يدوياً.",
        ),
      );
    }
  }
  async function upload(file: File) {
    setError("");
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
        code = jsQR(pixels.data, pixels.width, pixels.height);
      if (!code) throw Error();
      onCode(code.data);
      stop();
    } catch {
      setError(
        t(
          "No readable QR code found. Try a clearer image.",
          "لم يتم العثور على رمز واضح. جرّب صورة أوضح.",
        ),
      );
    } finally {
      bitmap?.close();
    }
  }
  return (
    <div className="scanner">
      <div className="scan-actions">
        <button
          className="secondary"
          type="button"
          onClick={active ? stop : start}
        >
          <Camera size={17} />
          {active
            ? t("Stop camera", "إيقاف الكاميرا")
            : t("Scan with camera", "المسح بالكاميرا")}
        </button>
        <label className="secondary file-label">
          {t("Upload QR image", "رفع صورة الرمز")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 5000000) setError("Photo must be under 5 MB.");
                else void upload(f);
              }
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <video
        ref={video}
        hidden={!active}
        muted
        playsInline
        aria-label={t("QR scanner camera", "كاميرا مسح الرمز")}
      />
      <ErrorMessage error={error} />
    </div>
  );
}
export function StaffPanel({
  claims,
  onRefresh,
}: {
  claims: Claim[];
  onRefresh: () => void;
}) {
  const { t, label } = useLanguage();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [token, setToken] = useState(""),
    [verified, setVerified] = useState<Claim | null>(null),
    [success, setSuccess] = useState("");
  const pending = claims.filter((c) => c.status === "pending");
  async function review(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/claims/review", {
        id,
        decision: data.get("decision"),
        note: data.get("note"),
      });
      onRefresh();
      setSuccess(
        t(
          "Claim reviewed. The student has been notified.",
          "تمت مراجعة الطلب وإشعار الطالب.",
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function setCode(code: string) {
    setToken(code.trim());
    setVerified(null);
    setError("");
    setSuccess("");
  }
  return (
    <section className="board">
      <div className="section-title">
        <div>
          <h2>{t("Security workspace", "مساحة عمل الأمن")}</h2>
          <p>
            {t(
              "Review ownership evidence, then verify the handover at the desk.",
              "راجع أدلة الملكية ثم تحقق من عملية التسليم في المكتب.",
            )}
          </p>
        </div>
        <ShieldCheck />
      </div>
      <ErrorMessage error={error} />
      {success && (
        <p role="status" className="notice">
          {success}
        </p>
      )}
      <div className="workspace-grid">
        <div>
          <h3>
            {t("Pending claims", "طلبات قيد المراجعة")} ({pending.length})
          </h3>
          {!pending.length && (
            <p className="empty-panel">
              {t(
                "No claims are waiting for review.",
                "لا توجد طلبات تنتظر المراجعة.",
              )}
            </p>
          )}
          {pending.map((c) => (
            <form
              key={c.id}
              className="work-card"
              onSubmit={(e) => review(e, c.id)}
            >
              <h3>{c.item.title}</h3>
              <p>
                {c.claimantName} · <span dir="ltr">{c.claimantEmail}</span>
              </p>
              <p className="pill">{label(c.item.status)}</p>
              <p>
                <strong>{t("Private evidence", "أدلة الملكية الخاصة")}</strong>
              </p>
              <p className="evidence pre-wrap">{c.evidence}</p>
              <label className="field">
                {t("Decision", "القرار")}
                <select name="decision" required defaultValue="">
                  <option value="" disabled>
                    {t("Choose a decision", "اختر القرار")}
                  </option>
                  <option
                    value="approved"
                    disabled={c.item.status !== "received"}
                  >
                    {t("Approve ownership", "قبول الملكية")}
                  </option>
                  <option value="rejected">
                    {t("Reject claim", "رفض الطلب")}
                  </option>
                </select>
              </label>
              {c.item.status !== "received" && (
                <p className="helper">
                  {t(
                    "Record physical receipt in the Collection desk tab before approval.",
                    "أكد وصول الغرض في تبويب مكتب الاستلام قبل الموافقة.",
                  )}
                </p>
              )}
              <label className="field">
                {t(
                  "Review note (required for rejection)",
                  "ملاحظة المراجعة (مطلوبة للرفض)",
                )}
                <textarea name="note" maxLength={1000} rows={2} />
              </label>
              <button className="primary" disabled={busy}>
                {t("Save decision", "حفظ القرار")}
              </button>
            </form>
          ))}
        </div>
        <aside className="work-card pickup-verifier">
          <h3>
            <QrCode size={19} />
            {t("Verify a pickup", "التحقق من الاستلام")}
          </h3>
          <p>
            {t(
              "Scan the student’s QR code or enter their pickup code.",
              "امسح رمز الطالب أو أدخل رمز الاستلام.",
            )}
          </p>
          <Scanner onCode={setCode} />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              setSuccess("");
              setVerified(null);
              try {
                const r = await api("/api/pickup/verify", { token });
                setVerified(r.claim);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              {t("Pickup code", "رمز الاستلام")}
              <input
                value={token}
                onChange={(e) => setCode(e.target.value)}
                required
                minLength={32}
                maxLength={32}
                dir="ltr"
                autoComplete="off"
              />
            </label>
            <button className="secondary" disabled={busy}>
              {t("Verify code", "التحقق من الرمز")}
            </button>
          </form>
          {verified && (
            <form
              className="verified"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api("/api/pickup/complete", { token, confirmed: true });
                  setVerified(null);
                  setToken("");
                  setSuccess(
                    t(
                      "Handover completed. The item is marked as returned.",
                      "اكتمل التسليم وتم تحديث حالة الغرض إلى تمت إعادته.",
                    ),
                  );
                  onRefresh();
                } catch (e) {
                  setError((e as Error).message);
                  setVerified(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h4>
                <Check size={18} />
                {t("Approved pickup", "استلام معتمد")}
              </h4>
              <p>
                <strong>{verified.item.title}</strong>
                <br />
                {verified.claimantName}
                <br />
                <span dir="ltr">{verified.claimantEmail}</span>
                <br />
                {label(
                  points.find((p) => p.id === verified.item.point)?.name || "",
                )}
              </p>
              <label className="checkbox">
                <input type="checkbox" required />
                {t(
                  "I checked identification and handed this item to its approved owner.",
                  "تحققت من الهوية وسلمت الغرض إلى مالكه المعتمد.",
                )}
              </label>
              <button className="primary" disabled={busy}>
                {t("Complete handover", "إتمام التسليم")}
              </button>
            </form>
          )}
        </aside>
      </div>
      <details className="review-history">
        <summary>
          {t("Reviewed claims", "الطلبات التي تمت مراجعتها")} (
          {claims.length - pending.length})
        </summary>
        {claims
          .filter((c) => c.status !== "pending")
          .map((c) => (
            <div className="report-row work-card" key={c.id}>
              <span>
                {c.item.title} · {c.claimantName}
              </span>
              <span className={"pill " + c.status}>{label(c.status)}</span>
            </div>
          ))}
      </details>
    </section>
  );
}
