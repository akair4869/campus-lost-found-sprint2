import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApplication } from "../server.mjs";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";

test("complete shared workflow, authorization, privacy, QR reuse, notifications and persistence", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "campus-integration-")),
    dbPath = join(dir, "test.sqlite");
  let app = createApplication({ dbPath });
  app.seedDemo();
  app.seedDemo();
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  let base = "http://127.0.0.1:" + app.server.address().port;
  const cookies = {};
  async function request(
    path,
    data,
    actor = "guest",
    expected = 200,
    headers = {},
  ) {
    const r = await fetch(base + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        ...(cookies[actor] ? { Cookie: cookies[actor] } : {}),
        ...(data === undefined
          ? {}
          : { "Content-Type": "application/json", "X-Campus-Request": "1" }),
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const b = await r.json();
    assert.equal(r.status, expected, JSON.stringify(b));
    if (r.headers.get("set-cookie"))
      cookies[actor] = r.headers.get("set-cookie").split(";")[0];
    return b;
  }
  try {
    await t.test(
      "accounts, student role enforcement and real session cookies",
      async () => {
        await request(
          "/api/register",
          {
            name: "Owner One",
            email: "owner@example.test",
            password: "OwnerPassword123",
            role: "staff",
          },
          "owner",
        );
        const me = await request("/api/session", undefined, "owner");
        assert.equal(me.user.role, "student");
        await request(
          "/api/register",
          {
            name: "Owner Two",
            email: "second@example.test",
            password: "AnotherPassword123",
          },
          "other",
        );
        await request(
          "/api/login",
          { email: "staff@campus.test", password: "CampusStaff123!" },
          "staff",
        );
        await request(
          "/api/login",
          { email: "finder@campus.test", password: "CampusFinder123!" },
          "finder",
        );
        await request(
          "/api/login",
          { email: "owner@example.test", password: "WrongPassword123" },
          "invalid",
          401,
        );
        await request("/api/claims", undefined, "guest", 401);
        await request("/api/claims", undefined, "owner", 403);
        await request("/api/dashboard", undefined, "guest", 401);
        await request("/api/logout", {}, "owner", 403, {
          "X-Campus-Request": "",
        });
      },
    );
    let foundId, claimId;
    const basic = {
      type: "found",
      title: "Test blue backpack",
      description: "Blue backpack found near the science lecture hall.",
      category: "Bags & accessories",
      building: "Science Building",
      date: "2026-01-01",
      point: "security",
      photo: null,
    };
    await t.test(
      "reports validate inputs, persist and notify possible matches",
      async () => {
        await request("/api/items", basic, "guest", 401);
        await request(
          "/api/items",
          { ...basic, date: "2099-01-01" },
          "finder",
          400,
        );
        await request(
          "/api/items",
          { ...basic, photo: "data:image/png;base64,YmFk" },
          "finder",
          400,
        );
        await request(
          "/api/items",
          { ...basic, type: "lost", title: "My blue backpack" },
          "owner",
        );
        const found = await request("/api/items", basic, "finder");
        foundId = found.id;
        const board = await request(
          "/api/items?category=Bags+%26+accessories&building=Science+Building&type=found&q=blue",
        );
        assert.equal(board.items.length, 1);
        assert.equal(board.items[0].id, foundId);
        assert.equal(board.items[0].ownerId, undefined);
        assert.equal(board.items[0].deskReference, undefined);
        const d = await request("/api/dashboard", undefined, "owner");
        assert.ok(d.notifications.some((n) => n.kind === "match"));
        assert.equal(d.items.length, 1);
      },
    );
    await t.test(
      "private claims, duplicate blocking and staff-only receipt",
      async () => {
        await request(
          "/api/claims",
          {
            itemId: foundId,
            evidence: "I am the finder with sufficient private details.",
          },
          "finder",
          400,
        );
        const c = await request(
          "/api/claims",
          {
            itemId: foundId,
            evidence:
              "Hidden identifier: ALPHA-PRIVATE-123 under the inside flap.",
          },
          "owner",
        );
        claimId = c.id;
        await request(
          "/api/claims",
          {
            itemId: foundId,
            evidence: "Duplicate evidence long enough to be valid.",
          },
          "owner",
          409,
        );
        await request(
          "/api/claims",
          {
            itemId: foundId,
            evidence:
              "Another claimant with different private identifying details.",
          },
          "other",
        );
        const second = await request("/api/dashboard", undefined, "other");
        assert.ok(!JSON.stringify(second).includes("ALPHA-PRIVATE-123"));
        const publicBoard = await request("/api/items");
        assert.ok(!JSON.stringify(publicBoard).includes("ALPHA-PRIVATE-123"));
        await request(
          "/api/checkin",
          { id: foundId, reference: "SEC-001", confirmed: true },
          "owner",
          403,
        );
        await request(
          "/api/claims/review",
          { id: claimId, decision: "approved", note: "" },
          "owner",
          403,
        );
        await request(
          "/api/claims/review",
          { id: claimId, decision: "approved", note: "" },
          "staff",
          409,
        );
        await request(
          "/api/checkin",
          { id: foundId, reference: "SEC-001", confirmed: true },
          "staff",
        );
        await request(
          "/api/checkin",
          { id: foundId, reference: "SEC-001", confirmed: true },
          "staff",
          409,
        );
      },
    );
    let token;
    await t.test(
      "approval creates an owner-only pass and rejects competing claims",
      async () => {
        await request(
          "/api/claims/review",
          {
            id: claimId,
            decision: "approved",
            note: "Identifying details matched the item.",
          },
          "staff",
        );
        await request(
          "/api/claims/review",
          { id: claimId, decision: "approved", note: "" },
          "staff",
          409,
        );
        const d = await request("/api/dashboard", undefined, "owner");
        token = d.claims[0].pickupToken;
        assert.equal(token.length, 32);
        assert.ok(d.notifications.some((n) => n.kind === "approved"));
        const other = await request("/api/dashboard", undefined, "other");
        assert.equal(other.claims[0].status, "rejected");
        assert.equal(other.claims[0].pickupToken, undefined);
        const staff = await request("/api/claims", undefined, "staff");
        assert.ok(!JSON.stringify(staff).includes(token));
        assert.ok(JSON.stringify(staff).includes("ALPHA-PRIVATE-123"));
        await request("/api/pickup/renew", { id: claimId }, "other", 404);
      },
    );
    await t.test(
      "actual QR image decodes to the exact pickup token",
      async () => {
        const png = PNG.sync.read(
          await QRCode.toBuffer(token, {
            width: 240,
            margin: 4,
            errorCorrectionLevel: "M",
          }),
        );
        const decoded = jsQR(
          new Uint8ClampedArray(png.data),
          png.width,
          png.height,
        );
        assert.equal(decoded.data, token);
      },
    );
    await t.test(
      "expired passes and token replacement cannot be reused",
      async () => {
        app.db.prepare("UPDATE claims SET expires=0 WHERE id=?").run(claimId);
        await request("/api/pickup/verify", { token }, "staff", 409);
        const d = await request("/api/dashboard", undefined, "owner");
        assert.equal(d.claims[0].tokenExpired, true);
        assert.equal(d.claims[0].pickupToken, undefined);
        await request("/api/pickup/renew", { id: claimId }, "owner");
        const renewed = await request("/api/dashboard", undefined, "owner");
        assert.notEqual(renewed.claims[0].pickupToken, token);
        await request("/api/pickup/verify", { token }, "staff", 409);
        token = renewed.claims[0].pickupToken;
      },
    );
    await t.test(
      "only staff can verify and one confirmed handover succeeds",
      async () => {
        await request("/api/pickup/verify", { token }, "owner", 403);
        const v = await request("/api/pickup/verify", { token }, "staff");
        assert.equal(v.claim.claimantEmail, "owner@example.test");
        assert.equal(v.claim.item.id, foundId);
        await request(
          "/api/pickup/complete",
          { token, confirmed: false },
          "staff",
          400,
        );
        const results = await Promise.allSettled([
          request("/api/pickup/complete", { token, confirmed: true }, "staff"),
          request(
            "/api/pickup/complete",
            { token, confirmed: true },
            "staff",
            409,
          ),
        ]);
        assert.ok(results.every((r) => r.status === "fulfilled"));
        await request("/api/pickup/verify", { token }, "staff", 409);
        const d = await request("/api/dashboard", undefined, "owner");
        assert.equal(d.claims[0].status, "collected");
        assert.equal(d.claims[0].pickupToken, undefined);
        const board = await request("/api/items?q=Test+blue");
        assert.equal(board.items[0].status, "returned");
      },
    );
    await t.test(
      "rejection requires a reason and notifies its claimant",
      async () => {
        const c = await request(
          "/api/claims",
          {
            itemId: "sample-2",
            evidence:
              "A different hidden description of the silver water bottle.",
          },
          "owner",
        );
        await request(
          "/api/claims/review",
          { id: c.id, decision: "rejected", note: "" },
          "staff",
          400,
        );
        await request(
          "/api/claims/review",
          {
            id: c.id,
            decision: "rejected",
            note: "The description does not match the item.",
          },
          "staff",
        );
        const d = await request("/api/dashboard", undefined, "owner");
        assert.ok(d.claims.some((c) => c.status === "rejected"));
        assert.ok(d.notifications.some((n) => n.kind === "rejected"));
        await request("/api/notifications/read", {}, "owner");
        assert.ok(
          (
            await request("/api/dashboard", undefined, "owner")
          ).notifications.every((n) => n.read === 1),
        );
      },
    );
    await t.test(
      "restart preserves data; private files cannot be downloaded; logout invalidates sessions",
      async () => {
        const savedCookie = cookies.owner;
        await app.close();
        app = createApplication({ dbPath });
        await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
        base = "http://127.0.0.1:" + app.server.address().port;
        assert.equal(
          (await request("/api/session", undefined, "owner")).user.email,
          "owner@example.test",
        );
        assert.equal(
          (await request("/api/items?q=Test+blue")).items[0].status,
          "returned",
        );
        for (const path of [
          "/data/campus.sqlite",
          "/server.mjs",
          "/package.json",
          "/src/App.tsx",
        ])
          await request(path, undefined, "guest", 404);
        const dbUser = app.db
          .prepare("SELECT password FROM users WHERE email=?")
          .get("owner@example.test");
        assert.ok(!dbUser.password.includes("OwnerPassword123"));
        await request("/api/logout", {}, "owner");
        cookies.owner = savedCookie;
        await request("/api/dashboard", undefined, "owner", 401);
      },
    );
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
