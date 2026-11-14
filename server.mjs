import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { categories, buildings, points, validateItem } from "./src/domain.ts";

const root = dirname(fileURLToPath(import.meta.url));
const stamp = () => new Date().toISOString();
const hash = (s) => createHash("sha256").update(s).digest("hex");
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const clean = (v, min, max, label) => {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max)
    fail(400, `${label}: ${min}–${max} characters required.`);
  return v.trim();
};
const flagReasons = ["false", "inappropriate", "duplicate", "spam", "other"];
const publicUser = (u) =>
  u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null;
const passwordHash = (p) => {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
};
function passwordMatches(p, stored) {
  const [salt, key] = stored.split(":");
  return timingSafeEqual(scryptSync(p, salt, 64), Buffer.from(key, "hex"));
}

export function createApplication({
  dbPath = process.env.CAMPUS_DB || join(root, "data", "campus.sqlite"),
} = {}) {
  if (dbPath !== ":memory:")
    mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('student','staff')));
  CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,userId TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,ownerId TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL,createdAt TEXT NOT NULL,data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS claims(id TEXT PRIMARY KEY,itemId TEXT NOT NULL REFERENCES items(id),userId TEXT NOT NULL REFERENCES users(id),evidence TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',note TEXT NOT NULL DEFAULT '',createdAt TEXT NOT NULL,reviewedAt TEXT,reviewerId TEXT REFERENCES users(id),token TEXT UNIQUE,expires INTEGER,usedAt TEXT,UNIQUE(itemId,userId));
  CREATE UNIQUE INDEX IF NOT EXISTS one_approved_claim ON claims(itemId) WHERE status IN ('approved','collected');
  CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,userId TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,title TEXT NOT NULL,itemId TEXT REFERENCES items(id),createdAt TEXT NOT NULL,read INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS catalog(kind TEXT NOT NULL CHECK(kind IN ('category','building')),name TEXT NOT NULL,nameAr TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,sort INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(kind,name));
  CREATE TABLE IF NOT EXISTS flags(id TEXT PRIMARY KEY,itemId TEXT NOT NULL REFERENCES items(id),userId TEXT NOT NULL REFERENCES users(id),reason TEXT NOT NULL,details TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'open',createdAt TEXT NOT NULL,reviewedAt TEXT,reviewerId TEXT REFERENCES users(id),UNIQUE(itemId,userId));`);
  const get = (s, ...p) => db.prepare(s).get(...p),
    all = (s, ...p) => db.prepare(s).all(...p),
    run = (s, ...p) => db.prepare(s).run(...p);
  const transaction = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const r = fn();
      db.exec("COMMIT");
      return r;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  if (!get("SELECT value FROM settings WHERE key='catalog'"))
    transaction(() => {
      const arabic = {
        Electronics: "إلكترونيات",
        "Bags & accessories": "حقائب وإكسسوارات",
        "Books & stationery": "كتب وقرطاسية",
        "Keys & cards": "مفاتيح وبطاقات",
        Clothing: "ملابس",
        Other: "أخرى",
        "Central Library": "المكتبة المركزية",
        "College of Computer Science": "كلية علوم الحاسب",
        "Student Center": "مركز الطلاب",
        "Science Building": "مبنى العلوم",
        "Main Gate": "البوابة الرئيسية",
      };
      for (const [kind, names] of [
        ["category", categories],
        ["building", buildings],
      ])
        names.forEach((n, i) =>
          run(
            "INSERT OR IGNORE INTO catalog VALUES(?,?,?,1,?)",
            kind,
            n,
            arabic[n] || "",
            i,
          ),
        );
      run("INSERT INTO settings VALUES('catalog','1')");
    });
  const catalogList = (kind, activeOnly) =>
    all(
      `SELECT name,nameAr,active FROM catalog WHERE kind=?${activeOnly ? " AND active=1" : ""} ORDER BY sort,name`,
      kind,
    );
  const activeLists = (keep = {}) => ({
    categories: [
      ...catalogList("category", true).map((c) => c.name),
      ...(keep.category ? [keep.category] : []),
    ],
    buildings: [
      ...catalogList("building", true).map((c) => c.name),
      ...(keep.building ? [keep.building] : []),
    ],
  });
  const isPublic = (i) => i.status !== "withdrawn" && !i.hiddenAt;
  const saveData = (i, status = i.status) => {
    const { id, ownerId, status: _s, createdAt, ...data } = i;
    run(
      "UPDATE items SET status=?,data=? WHERE id=?",
      status,
      JSON.stringify(data),
      id,
    );
  };
  function checkPhoto(photo) {
    if (typeof photo !== "string" || photo.length > 6700000)
      fail(400, "Photo must be under 5 MB.");
    const m = photo.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) fail(400, "Choose a JPG, PNG, or WebP photo.");
    const b = Buffer.from(m[2], "base64");
    if (
      b.length > 5000000 ||
      !(
        (m[1] === "png" &&
          b
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
        (m[1] === "jpeg" && b[0] === 255 && b[1] === 216 && b[2] === 255) ||
        (m[1] === "webp" &&
          b.toString("ascii", 0, 4) === "RIFF" &&
          b.toString("ascii", 8, 12) === "WEBP")
      )
    )
      fail(400, "Invalid image file.");
  }
  const notify = (userId, kind, title, itemId) =>
    run(
      "INSERT INTO notifications VALUES(?,?,?,?,?,?,0)",
      randomUUID(),
      userId,
      kind,
      title,
      itemId,
      stamp(),
    );
  const itemRow = (r) =>
    r
      ? {
          ...JSON.parse(r.data),
          id: r.id,
          ownerId: r.ownerId,
          status: r.status,
          createdAt: r.createdAt,
        }
      : null;
  const item = (id) => itemRow(get("SELECT * FROM items WHERE id=?", id));
  const exposed = (r, u) => {
    const {
      ownerId,
      deskReference,
      checkedAt,
      hiddenAt,
      hiddenNote,
      withdrawnAt,
      withdrawReason,
      handoverNote,
      ...visible
    } = r;
    return {
      ...visible,
      isMine: u?.id === ownerId,
      ...(u?.role === "staff" || u?.id === ownerId
        ? {
            deskReference,
            checkedAt,
            hiddenAt: hiddenAt || null,
            hiddenNote: hiddenNote || null,
            withdrawnAt: withdrawnAt || null,
            withdrawReason: withdrawReason || null,
            handoverNote: handoverNote || null,
          }
        : {}),
    };
  };
  function addItem(
    v,
    ownerId,
    id = randomUUID(),
    status = v.type === "found" ? "awaiting" : "lost",
  ) {
    const data = {
      type: v.type,
      title: v.title.trim(),
      description: v.description.trim(),
      category: v.category,
      building: v.building,
      date: v.date,
      point: v.type === "found" ? v.point : null,
      photo: v.photo || null,
      checkedAt: status === "received" ? stamp() : null,
      deskReference: status === "received" ? "DEMO-RECEIPT" : null,
    };
    run(
      "INSERT INTO items VALUES(?,?,?,?,?)",
      id,
      ownerId,
      status,
      stamp(),
      JSON.stringify(data),
    );
    return item(id);
  }
  function seedDemo() {
    if (get("SELECT value FROM settings WHERE key='demo'")) return;
    transaction(() => {
      const accounts = [
        [
          "demo-student",
          "Demo Student",
          "student@campus.test",
          "CampusStudent123!",
          "student",
        ],
        [
          "demo-finder",
          "Demo Finder",
          "finder@campus.test",
          "CampusFinder123!",
          "student",
        ],
        [
          "demo-staff",
          "Demo Security",
          "staff@campus.test",
          "CampusStaff123!",
          "staff",
        ],
      ];
      for (const [id, name, email, password, role] of accounts)
        run(
          "INSERT INTO users VALUES(?,?,?,?,?)",
          id,
          name,
          email,
          passwordHash(password),
          role,
        );
      const day = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Riyadh",
      });
      const samples = [
        [
          "found",
          "Keys with a green keyring",
          "Keys & cards",
          "Main Gate",
          "security",
          "received",
        ],
        [
          "found",
          "Cream canvas tote bag",
          "Bags & accessories",
          "Student Center",
          "student",
          "awaiting",
        ],
        [
          "found",
          "Silver water bottle",
          "Other",
          "Science Building",
          "library",
          "received",
        ],
        [
          "lost",
          "Black wireless headphones",
          "Electronics",
          "Central Library",
          null,
          "lost",
        ],
        [
          "lost",
          "Blue spiral notebook",
          "Books & stationery",
          "College of Computer Science",
          null,
          "lost",
        ],
        ["lost", "Beige cardigan", "Clothing", "Central Library", null, "lost"],
      ];
      samples.forEach(([type, title, category, building, point, status], i) =>
        addItem(
          {
            type,
            title,
            description:
              "Fictional class demonstration item. Describe private identifying details when claiming ownership.",
            category,
            building,
            point,
            date: day,
          },
          "demo-finder",
          "sample-" + i,
          status,
        ),
      );
      run("INSERT INTO settings VALUES('demo','1')");
    });
  }
  const limits = new Map();
  function rateLimit(req) {
    const key = req.socket.remoteAddress;
    const now = Date.now();
    for (const [k, v] of limits) if (v.until < now) limits.delete(k);
    const r = limits.get(key) || { count: 0, until: now + 600000 };
    limits.set(key, r);
    if (++r.count > 30)
      fail(429, "Too many attempts. Try again in 10 minutes.");
  }
  function currentUser(req) {
    const match = (req.headers.cookie || "").match(
      /(?:^|;\s*)campus_session=([^;]+)/,
    );
    if (!match) return null;
    return get(
      "SELECT u.* FROM users u JOIN sessions s ON s.userId=u.id WHERE s.hash=? AND s.expires>?",
      hash(match[1]),
      Date.now(),
    );
  }
  function issueSession(res, u, req) {
    const token = randomBytes(32).toString("base64url");
    run("DELETE FROM sessions WHERE expires<?", Date.now());
    run(
      "INSERT INTO sessions VALUES(?,?,?)",
      hash(token),
      u.id,
      Date.now() + 8 * 3600000,
    );
    res.setHeader(
      "Set-Cookie",
      `campus_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE === "1" || req.socket.encrypted ? "; Secure" : ""}`,
    );
  }
  async function body(req) {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > 7000000) fail(413, "Upload is too large.");
    }
    try {
      const v = JSON.parse(raw || "{}");
      if (!v || typeof v !== "object" || Array.isArray(v))
        fail(400, "Invalid request.");
      return v;
    } catch {
      fail(400, "Invalid JSON request.");
    }
  }
  const requireUser = (u) => {
    if (!u) fail(401, "Please sign in to continue.");
  };
  const requireStaff = (u) => {
    requireUser(u);
    if (u.role !== "staff") fail(403, "Staff access is required.");
  };
  function claimView(c, u) {
    const i = item(c.itemId);
    const owner = get("SELECT name,email FROM users WHERE id=?", c.userId);
    const { token, reviewerId, ...rest } = c;
    return {
      ...rest,
      item: exposed(i, u),
      claimantName: owner.name,
      ...(u.role === "staff" ? { claimantEmail: owner.email } : {}),
      ...(u.id === c.userId && c.status === "approved" && c.expires > Date.now()
        ? { pickupToken: token }
        : {}),
      tokenExpired: c.status === "approved" && c.expires <= Date.now(),
    };
  }
  async function api(req, res, url) {
    const u = currentUser(req),
      route = url.pathname,
      method = req.method;
    if (
      method !== "GET" &&
      (req.headers["x-campus-request"] !== "1" ||
        !String(req.headers["content-type"]).startsWith("application/json"))
    )
      fail(403, "Invalid request origin. Reload the page.");
    if (route === "/api/session" && method === "GET")
      return {
        user: publicUser(u),
        demo: !!get("SELECT value FROM settings WHERE key='demo'"),
      };
    if (["/api/register", "/api/login"].includes(route) && method === "POST") {
      rateLimit(req);
      const v = await body(req);
      const email = clean(v.email, 3, 254, "Email").toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail(400, "Enter a valid email address.");
      if (
        typeof v.password !== "string" ||
        v.password.length < 10 ||
        v.password.length > 128
      )
        fail(400, "Password must contain 10–128 characters.");
      let account;
      if (route === "/api/register") {
        const name = clean(v.name, 2, 80, "Name");
        if (get("SELECT id FROM users WHERE email=?", email))
          fail(409, "An account already exists for this email.");
        const id = randomUUID();
        run(
          "INSERT INTO users VALUES(?,?,?,?,?)",
          id,
          name,
          email,
          passwordHash(v.password),
          "student",
        );
        account = get("SELECT * FROM users WHERE id=?", id);
      } else {
        account = get("SELECT * FROM users WHERE email=?", email);
        if (!account || !passwordMatches(v.password, account.password))
          fail(401, "Email or password is incorrect.");
      }
      issueSession(res, account, req);
      return { user: publicUser(account) };
    }
    if (route === "/api/logout" && method === "POST") {
      const token = (req.headers.cookie || "").match(
        /(?:^|;\s*)campus_session=([^;]+)/,
      )?.[1];
      if (token) run("DELETE FROM sessions WHERE hash=?", hash(token));
      res.setHeader(
        "Set-Cookie",
        "campus_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      );
      return { ok: true };
    }
    if (route === "/api/items" && method === "GET") {
      let rows = all("SELECT * FROM items ORDER BY createdAt DESC,id")
        .map(itemRow)
        .filter(isPublic);
      const counts = {};
      rows.forEach((i) => (counts[i.status] = (counts[i.status] || 0) + 1));
      const q = url.searchParams;
      const search = (q.get("q") || "").toLowerCase().trim();
      rows = rows.filter(
        (i) =>
          (!q.get("type") || i.type === q.get("type")) &&
          (!q.get("category") || i.category === q.get("category")) &&
          (!q.get("building") || i.building === q.get("building")) &&
          (!q.get("from") || i.date >= q.get("from")) &&
          (!q.get("to") || i.date <= q.get("to")) &&
          (!search ||
            (i.title + " " + i.description).toLowerCase().includes(search)),
      );
      const page = Math.max(1, parseInt(q.get("page") || "1", 10) || 1);
      return {
        items: rows.slice((page - 1) * 12, page * 12).map((i) => exposed(i, u)),
        total: rows.length,
        stats: counts,
      };
    }
    if (route === "/api/items" && method === "POST") {
      requireUser(u);
      const v = await body(req),
        error = validateItem(v, undefined, activeLists());
      if (error) fail(400, error);
      if (v.photo) checkPhoto(v.photo);
      return transaction(() => {
        const row = addItem(v, u.id);
        notify(u.id, "reported", row.title, row.id);
        const matches = all(
          "SELECT * FROM items WHERE id<>? AND ownerId<>? AND status NOT IN ('returned')",
          row.id,
          u.id,
        )
          .map(itemRow)
          .filter(
            (i) =>
              isPublic(i) &&
              i.type !== row.type &&
              i.category === row.category &&
              i.building === row.building,
          );
        for (const owner of new Set(matches.map((i) => i.ownerId)))
          notify(owner, "match", row.title, row.id);
        if (matches.length)
          notify(u.id, "match", matches[0].title, matches[0].id);
        return exposed(row, u);
      });
    }
    if (route === "/api/checkin" && method === "POST") {
      requireStaff(u);
      const v = await body(req),
        reference = clean(v.reference, 3, 80, "Desk reference");
      if (v.confirmed !== true) fail(400, "Confirm physical receipt first.");
      return transaction(() => {
        const i = item(v.id);
        if (!i || i.type !== "found" || i.status !== "awaiting")
          fail(409, "Item is already checked in or unavailable.");
        i.checkedAt = stamp();
        i.deskReference = reference;
        run(
          "UPDATE items SET status='received',data=? WHERE id=?",
          JSON.stringify(i),
          i.id,
        );
        notify(i.ownerId, "received", i.title, i.id);
        return exposed(item(i.id), u);
      });
    }
    if (route === "/api/dashboard" && method === "GET") {
      requireUser(u);
      const claims = all(
        "SELECT * FROM claims WHERE userId=? ORDER BY createdAt DESC",
        u.id,
      ).map((c) => claimView(c, u));
      return {
        items: all(
          "SELECT * FROM items WHERE ownerId=? ORDER BY createdAt DESC",
          u.id,
        )
          .map(itemRow)
          .map((i) => exposed(i, u)),
        claims,
        notifications: all(
          "SELECT * FROM notifications WHERE userId=? ORDER BY createdAt DESC LIMIT 100",
          u.id,
        ),
      };
    }
    if (route === "/api/notifications/read" && method === "POST") {
      requireUser(u);
      run("UPDATE notifications SET read=1 WHERE userId=?", u.id);
      return { ok: true };
    }
    if (route === "/api/claims" && method === "GET") {
      requireStaff(u);
      return {
        claims: all("SELECT * FROM claims ORDER BY createdAt DESC").map((c) =>
          claimView(c, u),
        ),
      };
    }
    if (route === "/api/claims" && method === "POST") {
      requireUser(u);
      const v = await body(req),
        evidence = clean(v.evidence, 20, 2000, "Private ownership details");
      return transaction(() => {
        const i = item(v.itemId);
        if (
          !i ||
          i.type !== "found" ||
          !["awaiting", "received"].includes(i.status) ||
          i.hiddenAt
        )
          fail(409, "This item is unavailable for claims.");
        if (i.ownerId === u.id)
          fail(400, "You cannot claim an item you reported as found.");
        if (
          get("SELECT id FROM claims WHERE itemId=? AND userId=?", i.id, u.id)
        )
          fail(409, "You already submitted a claim for this item.");
        if (
          get(
            "SELECT id FROM claims WHERE itemId=? AND status='approved'",
            i.id,
          )
        )
          fail(409, "This item already has an approved owner.");
        const id = randomUUID();
        run(
          "INSERT INTO claims(id,itemId,userId,evidence,createdAt) VALUES(?,?,?,?,?)",
          id,
          i.id,
          u.id,
          evidence,
          stamp(),
        );
        notify(u.id, "claimSubmitted", i.title, i.id);
        for (const staff of all("SELECT id FROM users WHERE role='staff'"))
          notify(staff.id, "reviewNeeded", i.title, i.id);
        return { id };
      });
    }
    if (route === "/api/claims/review" && method === "POST") {
      requireStaff(u);
      const v = await body(req);
      if (!["approved", "rejected"].includes(v.decision))
        fail(400, "Choose approve or reject.");
      const note = clean(
        v.note,
        v.decision === "rejected" ? 5 : 0,
        1000,
        "Review note",
      );
      return transaction(() => {
        const c = get("SELECT * FROM claims WHERE id=?", v.id);
        if (!c || c.status !== "pending")
          fail(409, "This claim has already been reviewed.");
        if (c.userId === u.id)
          fail(403, "Staff cannot review their own claim.");
        const i = item(c.itemId);
        if (v.decision === "approved" && i.status !== "received")
          fail(409, "Check the item into the collection desk before approval.");
        if (
          get(
            "SELECT id FROM claims WHERE itemId=? AND status IN ('approved','collected')",
            i.id,
          )
        )
          fail(409, "Another claim was approved for this item.");
        run(
          "UPDATE claims SET status=?,note=?,reviewedAt=?,reviewerId=?,token=?,expires=? WHERE id=?",
          v.decision,
          note,
          stamp(),
          u.id,
          v.decision === "approved"
            ? randomBytes(24).toString("base64url")
            : null,
          v.decision === "approved" ? Date.now() + 7 * 86400000 : null,
          c.id,
        );
        notify(c.userId, v.decision, i.title, i.id);
        if (v.decision === "approved") {
          for (const other of all(
            "SELECT * FROM claims WHERE itemId=? AND status='pending'",
            i.id,
          )) {
            run(
              "UPDATE claims SET status='rejected',note=?,reviewedAt=?,reviewerId=? WHERE id=?",
              "Another ownership claim was approved.",
              stamp(),
              u.id,
              other.id,
            );
            notify(other.userId, "rejected", i.title, i.id);
          }
        }
        return { ok: true };
      });
    }
    if (route === "/api/pickup/renew" && method === "POST") {
      requireUser(u);
      const v = await body(req);
      const c = get(
        "SELECT * FROM claims WHERE id=? AND userId=? AND status='approved'",
        v.id,
        u.id,
      );
      if (!c) fail(404, "Approved claim not found.");
      run(
        "UPDATE claims SET token=?,expires=? WHERE id=?",
        randomBytes(24).toString("base64url"),
        Date.now() + 7 * 86400000,
        c.id,
      );
      return { ok: true };
    }
    if (
      ["/api/pickup/verify", "/api/pickup/complete"].includes(route) &&
      method === "POST"
    ) {
      requireStaff(u);
      const v = await body(req);
      const token = clean(v.token, 32, 32, "Pickup code");
      return transaction(() => {
        const c = get(
          "SELECT * FROM claims WHERE token=? AND status='approved' AND usedAt IS NULL AND expires>?",
          token,
          Date.now(),
        );
        if (!c) fail(409, "Pickup code is invalid, expired, or already used.");
        if (c.userId === u.id)
          fail(403, "Staff cannot complete their own pickup.");
        const i = item(c.itemId);
        if (i.status !== "received")
          fail(409, "Item is not available at the desk.");
        if (route.endsWith("/complete")) {
          if (v.confirmed !== true)
            fail(400, "Confirm identity and physical handover first.");
          run(
            "UPDATE claims SET status='collected',usedAt=? WHERE id=?",
            stamp(),
            c.id,
          );
          i.returnedAt = stamp();
          saveData(i, "returned");
          notify(c.userId, "collected", i.title, i.id);
          notify(i.ownerId, "returned", i.title, i.id);
          return { ok: true };
        }
        return { claim: claimView(c, u) };
      });
    }
    // ---- PBI-12: finder marks a found item as handed over to security ----
    if (route === "/api/items/handover" && method === "POST") {
      requireUser(u);
      const v = await body(req);
      if (v.confirmed !== true)
        fail(400, "Confirm that you handed the item to security first.");
      const note = clean(v.note ?? "", 0, 200, "Note");
      return transaction(() => {
        const i = item(v.id);
        if (!i || i.ownerId !== u.id || i.type !== "found")
          fail(404, "Report not found.");
        if (i.hiddenAt) fail(409, "This report was hidden by security staff.");
        if (i.status !== "awaiting")
          fail(409, "Security staff already confirmed this item.");
        if (i.handedOverAt) fail(409, "You already marked this item as handed over.");
        i.handedOverAt = stamp();
        i.handoverNote = note;
        saveData(i);
        for (const staff of all("SELECT id FROM users WHERE role='staff'"))
          if (staff.id !== u.id) notify(staff.id, "handedOver", i.title, i.id);
        return exposed(item(i.id), u);
      });
    }
    // ---- PBI-14: campus locations (buildings) and categories ----
    if (route === "/api/catalog" && method === "GET") {
      const staff = u?.role === "staff";
      return {
        categories: catalogList("category", !staff),
        buildings: catalogList("building", !staff),
      };
    }
    if (route === "/api/catalog" && method === "POST") {
      requireStaff(u);
      const v = await body(req);
      if (!["category", "building"].includes(v.kind))
        fail(400, "Choose categories or buildings.");
      const nameAr =
        v.nameAr === undefined ? undefined : clean(v.nameAr ?? "", 0, 60, "Arabic name");
      transaction(() => {
        if (v.action === "add") {
          const name = clean(v.name, 2, 60, "Name");
          if (
            get(
              "SELECT name FROM catalog WHERE kind=? AND lower(name)=lower(?)",
              v.kind,
              name,
            )
          )
            fail(409, "This name already exists.");
          const max = get(
            "SELECT COALESCE(MAX(sort),-1) AS m FROM catalog WHERE kind=?",
            v.kind,
          ).m;
          run(
            "INSERT INTO catalog VALUES(?,?,?,1,?)",
            v.kind,
            name,
            nameAr || "",
            max + 1,
          );
          return;
        }
        if (v.action !== "update") fail(400, "Invalid request.");
        const row = get(
          "SELECT * FROM catalog WHERE kind=? AND name=?",
          v.kind,
          String(v.name),
        );
        if (!row) fail(404, "Entry not found.");
        if (v.active === false && row.active)
          if (
            get(
              "SELECT COUNT(*) AS n FROM catalog WHERE kind=? AND active=1",
              v.kind,
            ).n <= 1
          )
            fail(409, "Keep at least one active entry.");
        let name = row.name;
        if (v.newName !== undefined && v.newName.trim?.() !== row.name) {
          name = clean(v.newName, 2, 60, "Name");
          if (
            get(
              "SELECT name FROM catalog WHERE kind=? AND lower(name)=lower(?) AND name<>?",
              v.kind,
              name,
              row.name,
            )
          )
            fail(409, "This name already exists.");
          const field = v.kind === "category" ? "$.category" : "$.building";
          run(
            `UPDATE items SET data=json_set(data,'${field}',?) WHERE json_extract(data,'${field}')=?`,
            name,
            row.name,
          );
        }
        run(
          "UPDATE catalog SET name=?,nameAr=?,active=? WHERE kind=? AND name=?",
          name,
          nameAr === undefined ? row.nameAr : nameAr,
          v.active === undefined ? row.active : v.active ? 1 : 0,
          v.kind,
          row.name,
        );
      });
      return {
        categories: catalogList("category", false),
        buildings: catalogList("building", false),
      };
    }
    // ---- PBI-15: owners update or withdraw their own report ----
    if (route === "/api/items/update" && method === "POST") {
      requireUser(u);
      const v = await body(req);
      return transaction(() => {
        const i = item(v.id);
        if (!i || i.ownerId !== u.id) fail(404, "Report not found.");
        if (i.hiddenAt) fail(409, "This report was hidden by security staff.");
        if (!["lost", "awaiting"].includes(i.status))
          fail(409, "This report can no longer be edited.");
        const next = {
          type: i.type,
          title: v.title ?? i.title,
          description: v.description ?? i.description,
          category: v.category ?? i.category,
          building: v.building ?? i.building,
          date: v.date ?? i.date,
          point: i.type === "found" ? (v.point ?? i.point) : null,
        };
        const error = validateItem(
          next,
          undefined,
          activeLists({ category: i.category, building: i.building }),
        );
        if (error) fail(400, error);
        if (i.handedOverAt && next.point !== i.point)
          fail(409, "The item was already handed to this desk.");
        if (v.photo) checkPhoto(v.photo);
        Object.assign(i, {
          title: next.title.trim(),
          description: next.description.trim(),
          category: next.category,
          building: next.building,
          date: next.date,
          point: next.point,
          photo: v.photo === undefined ? i.photo : v.photo || null,
          updatedAt: stamp(),
        });
        saveData(i);
        return exposed(item(i.id), u);
      });
    }
    if (route === "/api/items/withdraw" && method === "POST") {
      requireUser(u);
      const v = await body(req);
      const reason = clean(v.reason ?? "", 0, 200, "Reason");
      return transaction(() => {
        const i = item(v.id);
        if (!i || i.ownerId !== u.id) fail(404, "Report not found.");
        if (!["lost", "awaiting"].includes(i.status) || i.handedOverAt)
          fail(
            409,
            i.status === "received" || i.handedOverAt
              ? "This item is already at the collection desk. Ask security staff for help."
              : "This report can no longer be withdrawn.",
          );
        i.withdrawnAt = stamp();
        i.withdrawReason = reason;
        saveData(i, "withdrawn");
        for (const c of all(
          "SELECT * FROM claims WHERE itemId=? AND status='pending'",
          i.id,
        )) {
          run(
            "UPDATE claims SET status='rejected',note=?,reviewedAt=? WHERE id=?",
            "The finder withdrew this report.",
            stamp(),
            c.id,
          );
          notify(c.userId, "rejected", i.title, i.id);
        }
        run(
          "UPDATE flags SET status='dismissed',reviewedAt=? WHERE itemId=? AND status='open'",
          stamp(),
          i.id,
        );
        return exposed(item(i.id), u);
      });
    }
    // ---- PBI-16: report false or inappropriate posts ----
    if (route === "/api/flags" && method === "POST") {
      requireUser(u);
      const v = await body(req);
      if (!flagReasons.includes(v.reason)) fail(400, "Choose a reason.");
      const details = clean(v.details ?? "", 0, 500, "Details");
      return transaction(() => {
        const i = item(v.itemId);
        if (!i || !isPublic(i)) fail(404, "Report not found.");
        if (i.ownerId === u.id) fail(400, "You cannot report your own post.");
        if (get("SELECT id FROM flags WHERE itemId=? AND userId=?", i.id, u.id))
          fail(409, "You already reported this post.");
        run(
          "INSERT INTO flags(id,itemId,userId,reason,details,createdAt) VALUES(?,?,?,?,?,?)",
          randomUUID(),
          i.id,
          u.id,
          v.reason,
          details,
          stamp(),
        );
        for (const staff of all("SELECT id FROM users WHERE role='staff'"))
          if (staff.id !== u.id) notify(staff.id, "flagged", i.title, i.id);
        return { ok: true };
      });
    }
    if (route === "/api/flags" && method === "GET") {
      requireStaff(u);
      const entry = (itemId) => {
        const i = item(itemId);
        const owner = get("SELECT name FROM users WHERE id=?", i.ownerId);
        return {
          item: exposed(i, u),
          ownerName: owner.name,
          flags: all(
            "SELECT f.id,f.reason,f.details,f.status,f.createdAt,u.name AS reporterName FROM flags f JOIN users u ON u.id=f.userId WHERE f.itemId=? ORDER BY f.createdAt DESC",
            i.id,
          ),
        };
      };
      return {
        queue: all(
          "SELECT itemId,MIN(createdAt) AS first FROM flags WHERE status='open' GROUP BY itemId ORDER BY COUNT(*) DESC,first",
        )
          .map((r) => entry(r.itemId))
          .filter((e) => !e.item.hiddenAt && e.item.status !== "withdrawn"),
        hidden: all("SELECT * FROM items ORDER BY createdAt DESC")
          .map(itemRow)
          .filter((i) => i.hiddenAt)
          .map((i) => entry(i.id)),
      };
    }
    if (route === "/api/flags/review" && method === "POST") {
      requireStaff(u);
      const v = await body(req);
      if (!["hide", "dismiss", "restore"].includes(v.action))
        fail(400, "Invalid request.");
      const note = clean(
        v.note ?? "",
        v.action === "hide" ? 5 : 0,
        500,
        "Review note",
      );
      return transaction(() => {
        const i = item(v.itemId);
        if (!i) fail(404, "Report not found.");
        if (v.action === "hide") {
          if (i.hiddenAt) fail(409, "This post is already hidden.");
          if (
            get(
              "SELECT id FROM claims WHERE itemId=? AND status IN ('approved','collected')",
              i.id,
            )
          )
            fail(409, "This item has an approved owner and cannot be hidden.");
          i.hiddenAt = stamp();
          i.hiddenNote = note;
          saveData(i);
          for (const c of all(
            "SELECT * FROM claims WHERE itemId=? AND status='pending'",
            i.id,
          )) {
            run(
              "UPDATE claims SET status='rejected',note=?,reviewedAt=?,reviewerId=? WHERE id=?",
              "This post was removed by security staff.",
              stamp(),
              u.id,
              c.id,
            );
            notify(c.userId, "rejected", i.title, i.id);
          }
          notify(i.ownerId, "hidden", i.title, i.id);
        } else if (v.action === "restore") {
          if (!i.hiddenAt) fail(409, "This post is not hidden.");
          i.hiddenAt = null;
          i.hiddenNote = null;
          saveData(i);
          notify(i.ownerId, "restored", i.title, i.id);
        }
        run(
          "UPDATE flags SET status=?,reviewedAt=?,reviewerId=? WHERE itemId=? AND status='open'",
          v.action === "dismiss" ? "dismissed" : "actioned",
          stamp(),
          u.id,
          i.id,
        );
        return { ok: true };
      });
    }
    // ---- PBI-13: lost-and-found analytics for staff/administrators ----
    if (route === "/api/analytics" && method === "GET") {
      requireStaff(u);
      const items = all("SELECT * FROM items").map(itemRow);
      const live = items.filter(isPublic);
      const count = (list, f) => list.filter(f).length;
      const group = (key, names) => {
        const map = new Map(names.map((n) => [n, { name: n, lost: 0, found: 0, returned: 0 }]));
        for (const i of live) {
          if (!map.has(i[key]))
            map.set(i[key], { name: i[key], lost: 0, found: 0, returned: 0 });
          const g = map.get(i[key]);
          g[i.type]++;
          if (i.status === "returned") g.returned++;
        }
        return [...map.values()].sort(
          (a, b) => b.lost + b.found - (a.lost + a.found) || a.name.localeCompare(b.name),
        );
      };
      const found = count(live, (i) => i.type === "found");
      const returned = live.filter((i) => i.status === "returned");
      const days = returned
        .filter((i) => i.returnedAt)
        .map((i) => (Date.parse(i.returnedAt) - Date.parse(i.createdAt)) / 86400000);
      const months = [];
      const now = new Date();
      for (let k = 5; k >= 0; k--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
        months.push(d.toISOString().slice(0, 7));
      }
      const claimRows = all("SELECT status,COUNT(*) AS n FROM claims GROUP BY status");
      const flagRows = all("SELECT status,COUNT(*) AS n FROM flags GROUP BY status");
      const toObj = (rows) => Object.fromEntries(rows.map((r) => [r.status, r.n]));
      return {
        generatedAt: stamp(),
        totals: {
          reports: live.length,
          lost: count(live, (i) => i.type === "lost"),
          found,
          stillMissing: count(live, (i) => i.status === "lost"),
          awaiting: count(live, (i) => i.status === "awaiting"),
          handedOver: count(
            live,
            (i) => i.status === "awaiting" && i.handedOverAt,
          ),
          atDesk: count(live, (i) => i.status === "received"),
          returned: returned.length,
          withdrawn: count(items, (i) => i.status === "withdrawn"),
          hidden: count(items, (i) => i.hiddenAt),
          recoveryRate: found ? Math.round((returned.length / found) * 100) : 0,
          avgDaysToReturn: days.length
            ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10
            : null,
        },
        byCategory: group("category", catalogList("category", false).map((c) => c.name)),
        byBuilding: group("building", catalogList("building", false).map((c) => c.name)),
        byPoint: points.map((p) => ({
          id: p.id,
          name: p.name,
          awaiting: count(live, (i) => i.point === p.id && i.status === "awaiting"),
          atDesk: count(live, (i) => i.point === p.id && i.status === "received"),
          returned: count(live, (i) => i.point === p.id && i.status === "returned"),
        })),
        monthly: months.map((m) => ({
          month: m,
          lost: count(live, (i) => i.type === "lost" && i.date.startsWith(m)),
          found: count(live, (i) => i.type === "found" && i.date.startsWith(m)),
          returned: count(returned, (i) => (i.returnedAt || "").startsWith(m)),
        })),
        claims: toObj(claimRows),
        flags: toObj(flagRows),
      };
    }
    fail(404, "Action not found.");
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
    );
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        const result = await api(req, res, url);
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD")
        fail(405, "Method not allowed.");
      const files = {
        "/": ["index.html", "text/html; charset=utf-8"],
        "/index.html": ["index.html", "text/html; charset=utf-8"],
        "/app.js": ["app.js", "text/javascript; charset=utf-8"],
        "/styles.css": ["styles.css", "text/css; charset=utf-8"],
      };
      const f = files[url.pathname];
      if (!f) fail(404, "Page not found.");
      res.setHeader("Content-Type", f[1]);
      res.setHeader("Cache-Control", "no-cache");
      res.end(req.method === "HEAD" ? "" : readFileSync(join(root, f[0])));
    } catch (e) {
      res.statusCode = e.status || 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: e.status
            ? e.message
            : "Something went wrong. Please try again.",
        }),
      );
      if (!e.status) console.error(e.message);
    }
  });
  return {
    server,
    db,
    seedDemo,
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          db.close();
          resolve();
        });
        server.closeAllConnections();
      }),
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApplication();
  const port = Number(process.env.PORT || 3000);
  app.server.listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(`Campus Lost & Found: http://localhost:${port}`),
  );
}
